const crypto = require('crypto');
const https = require('https');
const url = require('url');

class DigestAuthClient {
    constructor(baseUrl, username, password, debugLogEnabled = false) {
        this.baseUrl = baseUrl;
        this.username = username;
        this.password = password;
        this.debugLogEnabled = debugLogEnabled;
        this.nonce = null;
        this.realm = null;
        this.qop = null;
        this.opaque = null;
        this.nc = 0;
        this.cnonce = null;
    }

    log(message, data = null) {
        if (this.debugLogEnabled) {
            const timestamp = new Date().toISOString();
            const logEntry = `[${timestamp}] [digest-auth] ${message}`;
            console.log(logEntry);
            if (data) {
                console.log(JSON.stringify(data, null, 2));
            }
        }
    }

    generateCNonce() {
        return crypto.randomBytes(16).toString('hex');
    }

    md5(data) {
        return crypto.createHash('md5').update(data).digest('hex');
    }

    parseWWWAuthenticate(wwwAuthHeader) {
        this.log('Parsing WWW-Authenticate header', { header: wwwAuthHeader });
        
        const auth = wwwAuthHeader.replace('Digest ', '');
        const params = {};
        
        auth.split(',').forEach(param => {
            const [key, value] = param.trim().split('=');
            if (key && value) {
                // Remove quotes from value
                params[key] = value.replace(/"/g, '');
            }
        });

        this.realm = params.realm;
        this.nonce = params.nonce;
        this.qop = params.qop;
        this.opaque = params.opaque;

        this.log('Parsed authentication parameters', {
            realm: this.realm,
            nonce: this.nonce,
            qop: this.qop,
            opaque: this.opaque
        });

        return params;
    }

    generateDigestResponse(method, uri) {
        this.nc++;
        this.cnonce = this.generateCNonce();

        const ha1 = this.md5(`${this.username}:${this.realm}:${this.password}`);
        const ha2 = this.md5(`${method}:${uri}`);

        this.log('Generated HA1 and HA2', {
            ha1: ha1,
            ha2: ha2,
            nc: this.nc.toString().padStart(8, '0'),
            cnonce: this.cnonce
        });

        let response;
        if (this.qop) {
            response = this.md5(`${ha1}:${this.nonce}:${this.nc.toString().padStart(8, '0')}:${this.cnonce}:${this.qop}:${ha2}`);
        } else {
            response = this.md5(`${ha1}:${this.nonce}:${ha2}`);
        }

        this.log('Generated digest response', { response });

        return response;
    }

    buildAuthorizationHeader(method, uri) {
        const response = this.generateDigestResponse(method, uri);
        
        let authHeader = `Digest username="${this.username}", realm="${this.realm}", nonce="${this.nonce}", uri="${uri}", response="${response}"`;
        
        if (this.qop) {
            authHeader += `, qop=${this.qop}, nc=${this.nc.toString().padStart(8, '0')}, cnonce="${this.cnonce}"`;
        }
        
        if (this.opaque) {
            authHeader += `, opaque="${this.opaque}"`;
        }

        this.log('Built authorization header', { header: authHeader });
        
        return authHeader;
    }

    makeRequest(method, path, headers = {}, body = null) {
        return new Promise((resolve, reject) => {
            // Don't double-encode the path - it should already be properly encoded from the frontend
            const url = new URL(this.baseUrl);
            url.pathname = path;

            const options = {
                hostname: url.hostname,
                port: url.port || (url.protocol === 'https:' ? 443 : 80),
                path: url.pathname + url.search,
                method: method,
                headers: {
                    'User-Agent': 'DigestAuthClient/1.0',
                    ...headers
                }
            };

            if (body) {
                options.headers['Content-Length'] = Buffer.byteLength(body);
            }

            this.log('Request options', options);

            const req = https.request(options, (res) => {
                this.log('Received response', {
                    statusCode: res.statusCode,
                    statusMessage: res.statusMessage,
                    headers: res.headers
                });

                // Check if response is binary (images, files)
                const contentType = res.headers['content-type'] || '';
                const isBinary = contentType.startsWith('image/') || 
                                contentType.includes('application/') ||
                                contentType.includes('video/') ||
                                contentType.includes('audio/');

                if (isBinary) {
                    // Handle binary data
                    const chunks = [];
                    res.on('data', (chunk) => {
                        chunks.push(chunk);
                    });

                    res.on('end', () => {
                        const buffer = Buffer.concat(chunks);
                        this.log('Binary response complete', {
                            dataLength: buffer.length,
                            contentType: contentType
                        });

                        resolve({
                            statusCode: res.statusCode,
                            statusMessage: res.statusMessage,
                            headers: res.headers,
                            data: buffer,
                            isBinary: true
                        });
                    });
                } else {
                    // Handle text data
                    let responseData = '';
                    res.on('data', (chunk) => {
                        responseData += chunk;
                    });

                    res.on('end', () => {
                        this.log('Text response complete', {
                            dataLength: responseData.length,
                            data: responseData.substring(0, 500) + (responseData.length > 500 ? '...' : '')
                        });

                        resolve({
                            statusCode: res.statusCode,
                            statusMessage: res.statusMessage,
                            headers: res.headers,
                            data: responseData,
                            isBinary: false
                        });
                    });
                }
            });

            req.on('error', (error) => {
                this.log('Request error', { error: error.message });
                reject(error);
            });

            if (body) {
                req.write(body);
            }

            req.end();
        });
    }

    async request(method, path, headers = {}, body = null) {
        try {
            // First request - expect 401 with WWW-Authenticate
            this.log('Making initial request (expecting 401)');
            let response = await this.makeRequest(method, path, headers, body);

            if (response.statusCode === 401) {
                this.log('Received 401, processing digest challenge');
                
                const wwwAuth = response.headers['www-authenticate'];
                if (!wwwAuth || !wwwAuth.startsWith('Digest')) {
                    throw new Error('Server did not return Digest authentication challenge');
                }

                this.parseWWWAuthenticate(wwwAuth);
                
                // Second request with digest authentication
                this.log('Making authenticated request');
                const authHeader = this.buildAuthorizationHeader(method, path);
                headers['Authorization'] = authHeader;
                
                response = await this.makeRequest(method, path, headers, body);
                
                if (response.statusCode === 401) {
                    throw new Error('Authentication failed - invalid credentials or server configuration');
                }
            }

            return response;
        } catch (error) {
            this.log('Request failed', { error: error.message, stack: error.stack });
            throw error;
        }
    }

    async getDirectoryContents(path = '/') {
        this.log('Getting directory contents', { path });
        
        const response = await this.request('PROPFIND', path, {
            'Depth': '1',
            'Content-Type': 'text/xml; charset=utf-8'
        }, `<?xml version="1.0" encoding="utf-8"?>
<propfind xmlns="DAV:">
    <prop>
        <resourcetype/>
        <getcontentlength/>
        <getlastmodified/>
        <getcontenttype/>
    </prop>
</propfind>`);

        if (response.statusCode === 207) {
            this.log('Successfully retrieved directory contents');
            return this.parseDirectoryResponse(response.data);
        } else {
            throw new Error(`Failed to get directory contents: ${response.statusCode} ${response.statusMessage}`);
        }
    }

    parseDirectoryResponse(xmlData) {
        this.log('Parsing directory response', { dataLength: xmlData.length });
        
        // Convert Buffer to string if needed
        let xmlString = xmlData;
        if (Buffer.isBuffer(xmlData)) {
            xmlString = xmlData.toString('utf8');
            this.log('Converted Buffer to string', { originalLength: xmlData.length, stringLength: xmlString.length });
        } else if (typeof xmlData !== 'string') {
            // Handle other data types
            try {
                xmlString = String(xmlData);
                this.log('Converted non-string data to string', { 
                    originalType: typeof xmlData, 
                    originalLength: xmlData.length, 
                    stringLength: xmlString.length 
                });
            } catch (error) {
                this.log('Failed to convert data to string', { 
                    error: error.message, 
                    dataType: typeof xmlData,
                    dataLength: xmlData?.length 
                });
                throw new Error(`Failed to parse directory response: data is not a string or Buffer (type: ${typeof xmlData})`);
            }
        }
        
        // Validate that we have a proper string
        if (!xmlString || typeof xmlString !== 'string') {
            throw new Error(`Invalid XML data: expected string but got ${typeof xmlString}`);
        }
        
        const files = [];
        const folders = [];
        
        // Parse the XML more carefully by finding each response block
        const responseBlocks = xmlString.match(/<d:response>[\s\S]*?<\/d:response>/g);
        
        if (responseBlocks) {
            responseBlocks.forEach(block => {
                // Extract href from this response block
                const hrefMatch = block.match(/<d:href>([^<]+)<\/d:href>/);
                if (!hrefMatch) return;
                
                const href = hrefMatch[1];
                
                // Check if this response block contains a collection (folder)
                const isDirectory = block.includes('<d:collection/>');
                
                // Skip the root directory itself and the current directory
                // The current directory will have the same path as what we requested
                if (href === '/dav' || href.endsWith('/dav/')) {
                    this.log('Skipping root directory:', href);
                    return;
                }
                
                // Skip if this is the current directory (should not appear in its own listing)
                // We need to determine what the current directory path is from the request
                // This will be handled by the frontend filtering for now
                
                if (isDirectory) {
                    folders.push({ path: href, type: 'folder' });
                } else {
                    // Extract additional file properties if available
                    const contentLengthMatch = block.match(/<d:getcontentlength>([^<]+)<\/d:getcontentlength>/);
                    const lastModifiedMatch = block.match(/<d:getlastmodified>([^<]+)<\/d:getlastmodified>/);
                    const contentTypeMatch = block.match(/<d:getcontenttype>([^<]+)<\/d:getcontenttype>/);
                    
                    const fileInfo = {
                        path: href,
                        type: 'file'
                    };
                    
                    if (contentLengthMatch) {
                        fileInfo.size = parseInt(contentLengthMatch[1]) || 0;
                        fileInfo.sizeFormatted = this.formatFileSize(fileInfo.size);
                    }
                    
                    if (lastModifiedMatch) {
                        fileInfo.lastModified = lastModifiedMatch[1];
                    }
                    
                    if (contentTypeMatch) {
                        fileInfo.contentType = contentTypeMatch[1];
                    }
                    
                    files.push(fileInfo);
                }
            });
        }

        this.log('Parsed directory contents', { 
            files: files.length, 
            folders: folders.length,
            sampleFiles: files.slice(0, 3), // Log first 3 files
            sampleFolders: folders.slice(0, 3) // Log first 3 folders
        });

        return { files, folders };
    }

    // Helper method to format file size
    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    async deleteItem(path) {
        this.log('Deleting item', { path });
        
        const response = await this.request('DELETE', path);
        
        if (response.statusCode === 204 || response.statusCode === 200) {
            this.log('Successfully deleted item', { path });
            return true;
        } else {
            throw new Error(`Failed to delete item: ${response.statusCode} ${response.statusMessage}`);
        }
    }

    // Create a directory on WebDAV
    async createDirectory(path) {
        this.log('Creating directory', { path });
        
        try {
            const response = await this.request('MKCOL', path);
            this.log('MKCOL response', { 
                path, 
                statusCode: response.statusCode, 
                statusMessage: response.statusMessage,
                headers: response.headers
            });
            
            if (response.statusCode === 201) {
                this.log('Directory created successfully', { path });
                return true;
            } else if (response.statusCode === 405) {
                this.log('Directory already exists (Method Not Allowed)', { path });
                return true;
            } else if (response.statusCode === 409) {
                this.log('Directory creation failed - conflict (may already exist)', { path });
                // Try to verify if directory exists by listing it
                try {
                    await this.getDirectoryContents(path);
                    this.log('Directory exists (verified by listing)', { path });
                    return true;
                } catch (listErr) {
                    this.log('Directory does not exist (verified by listing)', { path, error: listErr.message });
                    throw new Error(`Failed to create directory: ${response.statusCode} ${response.statusMessage}`);
                }
            } else {
                this.log('Failed to create directory', { 
                    path, 
                    statusCode: response.statusCode, 
                    statusMessage: response.statusMessage 
                });
                throw new Error(`Failed to create directory: ${response.statusCode} ${response.statusMessage}`);
            }
        } catch (err) {
            this.log('MKCOL request threw error', { 
                path, 
                error: err.message, 
                stack: err.stack 
            });
            throw err;
        }
    }

    async moveItem(sourcePath, destinationPath) {
        this.log('Moving item', { sourcePath, destinationPath });
        
        const response = await this.request('MOVE', sourcePath, {
            'Destination': destinationPath,
            'Overwrite': 'T'
        });
        
        if (response.statusCode === 201 || response.statusCode === 200) {
            this.log('Successfully moved item', { sourcePath, destinationPath });
            return true;
        } else {
            throw new Error(`Failed to move item: ${response.statusCode} ${response.statusMessage}`);
        }
    }

    async getFile(path) {
        this.log('Getting file', { path });
        
        const response = await this.request('GET', path);
        
        if (response.statusCode === 200) {
            if (response.isBinary) {
                this.log('Successfully retrieved binary file', { path, size: response.data.length });
                return response.data; // Return Buffer directly
            } else {
                this.log('Successfully retrieved text file', { path, size: response.data.length });
                return response.data; // Return string
            }
        } else {
            throw new Error(`Failed to get file: ${response.statusCode} ${response.statusMessage}`);
        }
    }

    // Upload a file to WebDAV with digest authentication
    async uploadFile(path, buffer) {
        this.log('Preparing to upload file', { path, size: buffer.length });
        
        // Ensure parent directory exists - extract directory path before filename
        let parentDir;
        if (path.endsWith('/')) {
            parentDir = path;
        } else {
            const lastSlashIndex = path.lastIndexOf('/');
            if (lastSlashIndex > 0) {
                parentDir = path.substring(0, lastSlashIndex + 1);
            } else {
                parentDir = '/';
            }
        }
        
        this.log('Parent directory for upload', { parentDir, originalPath: path });
        
        if (parentDir && parentDir !== '/' && parentDir !== path) {
            try {
                this.log('Attempting to create parent directory before upload', { parentDir });
                await this.createDirectory(parentDir);
                this.log('Parent directory creation completed successfully', { parentDir });
            } catch (err) {
                this.log('Failed to create parent directory (may already exist)', { 
                    parentDir, 
                    error: err.message 
                });
                // Don't throw here, continue with upload attempt
            }
        } else {
            this.log('No parent directory to create', { parentDir, path });
        }
        
        // Use the path as-is since it's already properly encoded from the card manager
        this.log('Attempting PUT request', { path });
        
        let response;
        try {
            response = await this.request('PUT', path, {
                'Content-Type': 'application/octet-stream'
            }, buffer);
        } catch (err) {
            this.log('PUT request threw error', { 
                path, 
                error: err.message, 
                stack: err.stack 
            });
            throw err;
        }
        
        this.log('PUT response from WebDAV', { 
            path, 
            statusCode: response.statusCode, 
            statusMessage: response.statusMessage, 
            headers: response.headers 
        });
        
        if (response.statusCode === 201 || response.statusCode === 200 || response.statusCode === 204) {
            this.log('File uploaded successfully', { path, size: buffer.length });
            return { 
                success: true, 
                statusCode: response.statusCode, 
                statusMessage: response.statusMessage, 
                headers: response.headers 
            };
        } else {
            this.log('File upload failed', { 
                path, 
                statusCode: response.statusCode, 
                statusMessage: response.statusMessage, 
                headers: response.headers 
            });
            throw new Error(`Failed to upload file: ${response.statusCode} ${response.statusMessage}`);
        }
    }
}

module.exports = DigestAuthClient; 