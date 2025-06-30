class WebDAVExplorer {
    constructor() {
        this.currentPath = '/dav';
        this.selectedItems = new Set();
        this.navigationHistory = ['/dav'];
        this.historyIndex = 0;
        this.viewMode = 'thumbnails'; // 'thumbnails' or 'list'
        
        // Restore state from localStorage
        this.restoreState();
        
        this.fileGrid = document.getElementById('file-grid');
        this.pathDisplay = document.getElementById('breadcrumb');
        this.upButton = document.getElementById('up-btn');
        this.refreshButton = document.getElementById('refresh-btn');
        this.searchInput = document.getElementById('search-input');
        this.viewToggle = document.getElementById('view-mode-btn');
        this.statusText = document.getElementById('status-text');
        this.connectionIndicator = document.getElementById('connection-indicator');
        this.testConnectionBtn = document.getElementById('test-connection-btn');
        
        // Lightbox elements
        this.lightboxModal = document.getElementById('imageLightbox');
        this.lightboxImage = document.getElementById('lightbox-image');
        this.lightboxImageName = document.getElementById('lightbox-image-name');
        this.lightboxImageInfo = document.getElementById('lightbox-image-info');
        this.lightboxCounter = document.getElementById('lightbox-counter-text');
        this.lightboxPrevBtn = document.getElementById('lightbox-prev-btn');
        this.lightboxNextBtn = document.getElementById('lightbox-next-btn');
        this.lightboxDownloadBtn = document.getElementById('lightbox-download-btn');
        this.lightboxPublicUrlBtn = document.getElementById('lightbox-public-url-btn');
        this.lightboxCopyPathBtn = document.getElementById('lightbox-copy-path-btn');
        this.lightboxZoomInBtn = document.getElementById('lightbox-zoom-in');
        this.lightboxZoomOutBtn = document.getElementById('lightbox-zoom-out');
        this.lightboxZoomResetBtn = document.getElementById('lightbox-zoom-reset');
        
        // Context menu
        this.contextMenu = document.getElementById('context-menu');
        
        // Add abort controller for canceling operations
        this.currentOperation = null;
        
        // Simple cache for image metadata
        this.imageMetadataCache = new Map();

        // Cache for folder item counts
        this.folderCountCache = new Map();

        // Batch loading for folder counts to prevent server overload
        this.folderCountQueue = [];
        this.isProcessingFolderCounts = false;
        
        // Lightbox state
        this.currentImageIndex = 0;
        this.currentImages = [];
        this.lightboxZoom = 1;
        
        // Context menu state
        this.contextMenuTarget = null;
        
        this.initializeElements();
        this.addEventListeners();
        this.loadCurrentDirectory();
    }

    initializeElements() {
        this.fileGrid = document.getElementById('file-grid');
        this.breadcrumb = document.getElementById('breadcrumb');
        this.searchInput = document.getElementById('search-input');
        this.upBtn = document.getElementById('up-btn');
        this.refreshBtn = document.getElementById('refresh-btn');
        this.viewModeBtn = document.getElementById('view-mode-btn');
        this.selectAllBtn = document.getElementById('select-all-btn');
        this.clearSelectionBtn = document.getElementById('clear-selection-btn');
        this.deleteSelectedBtn = document.getElementById('delete-selected-btn');
        this.itemCount = document.getElementById('item-count');
        this.newFolderBtn = document.getElementById('new-folder-btn');
        this.renameFolderBtn = document.getElementById('rename-folder-btn');
        
        // Initialize any elements that need setup
        if (this.upButton) {
            this.upButton.disabled = true; // Disable up button initially
        }
        
        // Set initial view mode
        this.viewMode = 'thumbnails';
        
        if (this.deleteSelectedBtn) {
            this.deleteSelectedBtn.title = 'Delete selected files/folders. WARNING: This cannot be undone!';
        }
        if (this.renameFolderBtn) {
            this.renameFolderBtn.title = 'Rename selected file/folder. WARNING: This may break links!';
        }
    }

    addEventListeners() {
        // Navigation events
        if (this.upButton) {
            this.upButton.addEventListener('click', () => {
                this.cancelCurrentOperation();
                this.navigateUp();
            });
        }
        
        if (this.refreshButton) {
            this.refreshButton.addEventListener('click', () => {
                this.cancelCurrentOperation();
                this.loadCurrentDirectory();
            });
        }
        
        // Test connection button
        const testConnectionBtn = document.getElementById('test-connection-btn');
        if (testConnectionBtn) {
            testConnectionBtn.addEventListener('click', () => {
                this.cancelCurrentOperation();
                this.testConnection();
            });
        }
        
        // Reset state button
        const resetStateBtn = document.getElementById('reset-state-btn');
        if (resetStateBtn) {
            resetStateBtn.addEventListener('click', () => {
                if (confirm('Reset WebDAV Explorer to default state? This will clear your saved location.')) {
                    this.resetToDefault();
                }
            });
        }
        
        // Search and sort events
        if (this.searchInput) {
            this.searchInput.addEventListener('input', () => {
                this.cancelCurrentOperation();
                this.filterItems();
            });
        }
        
        if (this.viewToggle) {
            this.viewToggle.addEventListener('click', () => {
                this.cancelCurrentOperation();
                this.toggleViewMode();
            });
        }
        
        // Save state when page is unloaded
        window.addEventListener('beforeunload', () => {
            this.saveState();
        });
        
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Backspace' && !this.searchInput?.matches(':focus')) {
                        e.preventDefault();
                this.cancelCurrentOperation();
                this.navigateUp();
            }
        });

        // New folder and rename functionality
        if (this.newFolderBtn) {
        this.newFolderBtn.addEventListener('click', () => this.createNewFolder());
        }
        if (this.renameFolderBtn) {
        this.renameFolderBtn.addEventListener('click', () => this.renameCurrentFolder());
        }

        // Create bike structure button
        const createBikeStructureBtn = document.getElementById('create-bike-structure-btn');
        if (createBikeStructureBtn) {
            createBikeStructureBtn.addEventListener('click', () => this.createBikeFolderStructure());
        }

        if (this.deleteSelectedBtn) {
            this.deleteSelectedBtn.addEventListener('click', () => this.deleteSelected());
        }
        
        // Lightbox event listeners
        if (this.lightboxPrevBtn) {
            this.lightboxPrevBtn.addEventListener('click', () => this.showPreviousImage());
        }
        if (this.lightboxNextBtn) {
            this.lightboxNextBtn.addEventListener('click', () => this.showNextImage());
        }
        if (this.lightboxDownloadBtn) {
            this.lightboxDownloadBtn.addEventListener('click', () => this.downloadCurrentImage());
        }
        if (this.lightboxPublicUrlBtn) {
            this.lightboxPublicUrlBtn.addEventListener('click', () => this.copyPublicUrl());
        }
        if (this.lightboxCopyPathBtn) {
            this.lightboxCopyPathBtn.addEventListener('click', () => this.copyWebdavPath());
        }
        if (this.lightboxZoomInBtn) {
            this.lightboxZoomInBtn.addEventListener('click', () => this.zoomIn());
        }
        if (this.lightboxZoomOutBtn) {
            this.lightboxZoomOutBtn.addEventListener('click', () => this.zoomOut());
        }
        if (this.lightboxZoomResetBtn) {
            this.lightboxZoomResetBtn.addEventListener('click', () => this.resetZoom());
        }
        
        // Context menu event listeners
        if (this.contextMenu) {
            this.contextMenu.addEventListener('click', (e) => {
                const action = e.target.closest('.context-menu-item')?.dataset.action;
                if (action && this.contextMenuTarget) {
                    this.handleContextMenuAction(action, this.contextMenuTarget);
                }
                this.hideContextMenu();
            });
        }
        
        // Global event listeners
        document.addEventListener('click', () => this.hideContextMenu());
        document.addEventListener('keydown', (e) => this.handleGlobalKeydown(e));
    }

    async loadCurrentDirectory() {
        // Cancel any ongoing operations
        this.cancelCurrentOperation();
        this.showLoadingOverlay();
        this.updatePathDisplay();
        this.updateStatus('Loading directory contents...', 'loading');
        this.updateConnectionStatus(true);
        
        try {
            console.log('WebDAV Explorer: Loading directory', {
                path: this.currentPath,
                timestamp: new Date().toISOString()
            });
            
            const response = await fetch(`/webdav-list?path=${encodeURIComponent(this.currentPath)}`);
            
            console.log('WebDAV Explorer: Response received', {
                status: response.status,
                statusText: response.statusText,
                timestamp: new Date().toISOString()
            });
            
            if (response.ok) {
                const data = await response.json();
                console.log('WebDAV Explorer: Data parsed successfully', {
                    folders: data.folders?.length || 0,
                    files: data.files?.length || 0,
                    timestamp: new Date().toISOString()
                });
                
                await this.renderDirectory(data);
                this.updateStatus(`Loaded ${data.folders?.length || 0} folders and ${data.files?.length || 0} files`, 'success');
                if (window.debugLogEnabled && window.electronAPI && window.electronAPI.logDebugInfo) {
                    window.electronAPI.logDebugInfo({
                        message: 'WebDAVExplorer: Directory loaded',
                        data: { path: this.currentPath, folders: data.folders?.length || 0, files: data.files?.length || 0 },
                        timestamp: new Date().toISOString(),
                        page: 'webdav-explorer'
                    });
                }
            } else {
                const errorText = await response.text();
                console.error('WebDAV Explorer: Failed to load directory', {
                    status: response.status,
                    statusText: response.statusText,
                    errorText: errorText,
                    timestamp: new Date().toISOString()
                });
                
                this.showError(`Failed to load directory: ${response.status} ${response.statusText}`);
                this.updateStatus(`Failed to load directory: ${response.status}`, 'error');
                this.updateConnectionStatus(false);
                
                if (window.debugLogEnabled && window.electronAPI && window.electronAPI.logDebugInfo) {
                    window.electronAPI.logDebugInfo({
                        message: 'WebDAVExplorer: Failed to load directory',
                        data: { 
                            path: this.currentPath, 
                            status: response.status, 
                            statusText: response.statusText,
                            errorText: errorText
                        },
                        timestamp: new Date().toISOString(),
                        page: 'webdav-explorer'
                    });
                }
            }
        } catch (error) {
            // Log the full error object for better debugging
            console.error('WebDAV Explorer: Error loading directory', error);
            let errorMsg = error && error.message ? error.message : String(error);
            if (error && error.stack) {
                errorMsg += '\n' + error.stack;
            }
            // Try to serialize the error object for logging
            let errorString = '';
            try {
                errorString = JSON.stringify(error, Object.getOwnPropertyNames(error));
            } catch (e) {
                errorString = String(error);
            }
            this.showError(`Connection error: ${errorMsg}`);
            this.updateStatus(`Connection error: ${errorMsg}`, 'error');
            this.updateConnectionStatus(false);
            
            if (window.debugLogEnabled && window.electronAPI && window.electronAPI.logDebugInfo) {
                window.electronAPI.logDebugInfo({
                    message: 'WebDAVExplorer: Error loading directory',
                    data: { 
                        path: this.currentPath, 
                        error: errorMsg, 
                        fullError: errorString 
                    },
                    timestamp: new Date().toISOString(),
                    page: 'webdav-explorer'
                });
            }
        } finally {
            this.hideLoadingOverlay();
        }
    }

    async renderDirectory(data) {
        console.log('Rendering directory with data:', data);
        console.log('Current path:', this.currentPath);
        
        this.fileGrid.innerHTML = '';
        
        if (!data || (!data.files && !data.folders)) {
            this.showEmptyState();
            this.hideLoadingOverlay();
            this.updateStatus('Directory is empty', 'info');
            return;
        }

        const allItems = [
            ...(data.folders || []).map(folder => ({ ...folder, type: 'folder' })),
            ...(data.files || []).map(file => ({ ...file, type: 'file' }))
        ];

        console.log('All items before filtering:', allItems.map(item => ({ path: item.path, type: item.type })));

        if (allItems.length === 0) {
            this.showEmptyState();
            this.hideLoadingOverlay();
            this.updateStatus('Directory is empty', 'info');
            return;
        }

        // Update status to show what we're doing
        this.updateStatus(`Rendering ${allItems.length} items...`, 'loading');

        // Preload all images in the current directory
        const imageItems = allItems.filter(item => item.type === 'file' && this.isImageFile(this.extractNameFromPath(item.path)));
        if (imageItems.length > 0) {
            this.updateStatus(`Preloading ${imageItems.length} images for faster browsing...`, 'loading');
            const imagePaths = imageItems.map(item => item.path);
            this.preloadImages(imagePaths);
        }

        // Filter out the current folder itself from the items list
        const filteredItems = allItems.filter(item => {
            // Exclude the current folder (where item.path === this.currentPath)
            // Also exclude if the item path ends with the current path (for trailing slash issues)
            const shouldExclude = item.path === this.currentPath || 
                                 item.path === this.currentPath + '/' ||
                                 item.path === this.currentPath.replace(/\/$/, '') ||
                                 item.path === this.currentPath.replace(/\/$/, '') + '/';
            
            if (shouldExclude) {
                console.log('Excluding current folder from display:', item.path);
            }
            
            return !shouldExclude;
        });

        console.log('Filtered items:', filteredItems.map(item => ({ path: item.path, type: item.type })));

        // Render all items
        filteredItems.forEach(item => {
            const element = this.createItemElement(item);
            this.fileGrid.appendChild(element);
        });

        this.hideLoadingOverlay();
        
        // Process folder counts in batches
        this.processFolderCountQueue();
        
        // Update final status
        const folderCount = filteredItems.filter(item => item.type === 'folder').length;
        const fileCount = filteredItems.filter(item => item.type === 'file').length;
        this.updateStatus(`Ready - ${folderCount} folders, ${fileCount} files`, 'success');
    }

    // Cancel any ongoing operations
    cancelCurrentOperation() {
        if (this.currentOperation) {
            console.log('Canceling current operation...');
            this.currentOperation.abort();
            this.currentOperation = null;
        }
    }

    async preloadImages(imagePaths) {
        if (imagePaths.length === 0) return;
        
        // Cancel any existing operation
        this.cancelCurrentOperation();
        
        console.log(`Preloading ${imagePaths.length} images...`);
        
        // Create new abort controller for this operation
        this.currentOperation = new AbortController();
        
        // Show a simple loading indicator
        const loadingDiv = document.createElement('div');
        loadingDiv.className = 'alert alert-info alert-dismissible fade show';
        loadingDiv.innerHTML = `
            <i class="fas fa-spinner fa-spin me-2"></i>
            Preloading ${imagePaths.length} images for faster browsing...
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        `;
        this.fileGrid.parentElement.insertBefore(loadingDiv, this.fileGrid);
        
        try {
            // Use the bulk endpoint to preload all images at once
            const response = await fetch('/webdav-bulk-thumbnails', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ paths: imagePaths }),
                signal: this.currentOperation.signal
            });
            
            if (response.ok) {
                const result = await response.json();
                console.log(`Successfully preloaded ${result.successCount || 0} images`);
                
                // Show success message briefly
                loadingDiv.className = 'alert alert-success alert-dismissible fade show';
                loadingDiv.innerHTML = `
                    <i class="fas fa-check me-2"></i>
                    Preloaded ${result.successCount || 0} images successfully!
                    <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
                `;
                
                // Auto-dismiss after 2 seconds
            setTimeout(() => {
                    if (loadingDiv.parentNode) {
                        loadingDiv.remove();
                    }
                }, 2000);
            } else {
                throw new Error(`Failed to preload images: ${response.status}`);
            }
        } catch (error) {
            if (error.name === 'AbortError') {
                console.log('Image preloading was canceled');
                loadingDiv.remove();
            } else {
                console.error('Error preloading images:', error);
                loadingDiv.className = 'alert alert-warning alert-dismissible fade show';
                loadingDiv.innerHTML = `
                    <i class="fas fa-exclamation-triangle me-2"></i>
                    Some images may load slower (preloading failed)
                    <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
                `;
            }
        } finally {
            this.currentOperation = null;
        }
    }

    createItemElement(item) {
        // Extract name from path since WebDAV response only provides path
        const itemName = this.extractNameFromPath(item.path);
        
        const div = document.createElement('div');
        div.className = 'file-item';
        div.dataset.path = item.path;
        div.dataset.type = item.type;
        div.dataset.name = itemName;

        const isImage = item.type === 'file' && this.isImageFile(itemName);
        const isFolder = item.type === 'folder';

        if (isFolder) {
            div.classList.add('folder');
        }

        if (isImage) {
            const thumbnailContainer = document.createElement('div');
            thumbnailContainer.className = 'thumbnail-container';

            const loadingOverlay = document.createElement('div');
            loadingOverlay.className = 'loading-overlay';
            loadingOverlay.innerHTML = `
                <div class="d-flex align-items-center text-muted">
                    <div class="spinner-border spinner-border-sm me-2" role="status">
                        <span class="visually-hidden">Loading...</span>
                    </div>
                    <span>Loading...</span>
                </div>
            `;
            thumbnailContainer.appendChild(loadingOverlay);

            const img = document.createElement('img');
            img.src = this.getThumbnailUrl(item.path);
            img.alt = this.decodePathComponent(itemName);
            img.className = 'thumbnail';
            img.loading = 'lazy';
            thumbnailContainer.appendChild(img);

            const nameDiv = document.createElement('div');
            nameDiv.className = 'file-name';
            nameDiv.textContent = this.decodePathComponent(itemName);

            const detailsDiv = document.createElement('div');
            detailsDiv.className = 'file-details';
            detailsDiv.innerHTML = this.getDetailsForItem({ ...item, name: itemName });

            const imageInfoDiv = document.createElement('div');
            imageInfoDiv.className = 'image-info';
            imageInfoDiv.style.display = 'block'; // Make it visible
            imageInfoDiv.innerHTML = `
                <div class="image-details d-flex justify-content-between">
                    <span class="image-dimensions"></span>
                    <span class="image-aspect"></span>
                </div>
            `;
            const dimensionsSpan = imageInfoDiv.querySelector('.image-dimensions');
            const aspectSpan = imageInfoDiv.querySelector('.image-aspect');

            img.onload = () => {
                loadingOverlay.remove();
                if (img.naturalWidth > 0 && img.naturalHeight > 0) {
                    const aspectRatio = this.getAspectRatio(img.naturalWidth, img.naturalHeight);
                    dimensionsSpan.innerHTML = `<i class="fas fa-ruler-combined me-1"></i> ${img.naturalWidth}&times;${img.naturalHeight}`;
                    aspectSpan.innerHTML = `<i class="fas fa-vector-square me-1"></i> ${aspectRatio}`;
                    
                    // Load and display bike metadata
                    this.loadImageMetadata(item.path, imageInfoDiv);
                } else {
                    imageInfoDiv.remove();
                }
            };

            img.onerror = () => {
                loadingOverlay.remove();
                imageInfoDiv.remove();
                const errorOverlay = document.createElement('div');
                errorOverlay.className = 'error-overlay';
                errorOverlay.style.display = 'flex';
                errorOverlay.innerHTML = '<i class="fas fa-exclamation-triangle"></i>';
                img.replaceWith(errorOverlay);
            };

            div.appendChild(thumbnailContainer);
            div.appendChild(nameDiv);
            div.appendChild(detailsDiv);
            div.appendChild(imageInfoDiv);

        } else if (isFolder) {
            div.innerHTML = `
                <div class="file-icon folder-icon">
                    <i class="fas fa-folder"></i>
                </div>
                <div class="file-name">${this.decodePathComponent(itemName)}</div>
                <div class="file-details">
                    <div class="spinner-border spinner-border-sm text-muted" role="status">
                        <span class="visually-hidden">Loading...</span>
                    </div>
                </div>
            `;
            // Observe this folder for lazy loading its count
            this.folderCountQueue.push({ div, folderPath: item.path });
        } else if (item.type === 'file') {
            div.innerHTML = `
                <div class="file-icon">
                    <i class="fas fa-file"></i>
                </div>
                <div class="file-name">${this.decodePathComponent(itemName)}</div>
                <div class="file-details">
                    ${this.getDetailsForItem({ ...item, name: itemName })}
                </div>
            `;
        }

        // Add event listeners
        div.addEventListener('click', (e) => {
            if (e.target.closest('.delete-btn')) return;
            
            // Single-click: select item (both folders and files)
            this.toggleSelection({ ...item, name: itemName });
        });
        
        div.addEventListener('dblclick', (e) => {
            // Double-click: open folder or file
            this.handleItemDoubleClick({ ...item, name: itemName }, div);
        });
        
        // Add right-click context menu
        div.addEventListener('contextmenu', (e) => {
            this.handleItemRightClick(item, div, e);
        });
        
        // Tooltip for selection
        div.title = 'Single-click to select. Double-click to open.';
        
        return div;
    }

    // Helper method to extract name from path
    extractNameFromPath(path) {
        if (!path) return '';
        
        // Remove trailing slash if present
        const cleanPath = path.endsWith('/') ? path.slice(0, -1) : path;
        
        // Split by '/' and get the last part
        const parts = cleanPath.split('/');
        const name = parts[parts.length - 1];
        
        // If the name is empty (e.g., root path), return a meaningful name
        if (!name || name === '') {
            return cleanPath === '/dav' ? 'Root' : 'Unknown';
        }
        
        return name;
    }

    getIconForItem(item) {
        if (item.type === 'folder') {
            return { icon: 'fas fa-folder', class: 'folder-icon' };
        }
        
        // Extract name from path if name doesn't exist
        const itemName = item.name || this.extractNameFromPath(item.path);
        const ext = itemName.split('.').pop()?.toLowerCase();
        if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext)) {
            return { icon: 'fas fa-image', class: 'image-icon' };
        }
        
        return { icon: 'fas fa-file', class: 'file-icon' };
    }

    getDetailsForItem(item) {
        if (item.type === 'folder') {
            return '<i class="fas fa-folder text-warning"></i> Folder';
        }

        // Extract name from path if name doesn't exist
        const itemName = item.name || this.extractNameFromPath(item.path);
        
        const details = [];
        let icon = '<i class="fas fa-file text-muted"></i>';
        let typeName = 'File';

        if (this.isImageFile(itemName)) {
            icon = '<i class="fas fa-image text-success"></i>';
            typeName = 'Image';
        }
        
        details.push(typeName);

        if (item.sizeFormatted && item.sizeFormatted !== '0 Bytes') {
            details.push(item.sizeFormatted);
        }
        if (item.lastModified) {
            details.push(new Date(item.lastModified).toLocaleDateString());
        }

        return `${icon} ${details.join(' &bull; ')}`;
    }

    async getFolderItemCount(folderPath) {
        // Check cache first
        if (this.folderCountCache.has(folderPath)) {
            console.log(`Cache HIT for folder: ${folderPath}`);
            return this.folderCountCache.get(folderPath);
        }

        console.log(`Cache MISS for folder: ${folderPath}, fetching...`);

        try {
            const response = await fetch(`/webdav-list?path=${encodeURIComponent(folderPath)}`);
            if (!response.ok) {
                const result = '? items';
                this.folderCountCache.set(folderPath, result);
                console.log(`Cached result for ${folderPath}: ${result}`);
                return result;
            }
            
            const data = await response.json();
            const totalItems = (data.files?.length || 0) + (data.folders?.length || 0);
            
            let result;
            if (totalItems === 0) result = 'Empty';
            else if (totalItems === 1) result = '1 item';
            else result = `${totalItems} items`;
            
            // Cache the result
            this.folderCountCache.set(folderPath, result);
            console.log(`Cached result for ${folderPath}: ${result}`);
            return result;
        } catch (error) {
            const result = '? items';
            this.folderCountCache.set(folderPath, result);
            console.log(`Cached error result for ${folderPath}: ${result}`);
            return result;
        }
    }

    handleItemClick(item, element) {
        this.cancelCurrentOperation();
        
        if (item.type === 'folder') {
            this.navigateToFolder(item.path);
        } else if (item.type === 'file') {
            this.handleFileClick(item, element);
        }
    }

    handleItemDoubleClick(item, element) {
        if (item.type === 'folder') {
            this.navigateToFolder(item.path);
        } else if (this.isImageFile(this.extractNameFromPath(item.path))) {
            // For images, open in lightbox
            this.openImageInLightbox(item);
        } else {
            // For other files, open in new tab
            const webdavUrl = `https://store-c8jhcan2jv.mybigcommerce.com${item.path}`;
            window.open(webdavUrl, '_blank');
        }
    }

    handleFileClick(item, element) {
        if (this.isImageFile(this.extractNameFromPath(item.path))) {
            this.openImageInLightbox(item);
        } else {
            // For other files, construct the direct WebDAV URL
            const webdavUrl = `https://store-c8jhcan2jv.mybigcommerce.com${item.path}`;
            window.open(webdavUrl, '_blank');
        }
    }

    handleFileDoubleClick(item, element) {
        // Double-click opens in new tab for all files
        const webdavUrl = `https://store-c8jhcan2jv.mybigcommerce.com${item.path}`;
        window.open(webdavUrl, '_blank');
    }

    navigateToFolder(path) {
        this.currentPath = path;
        this.navigationHistory.push(path);
        this.historyIndex = this.navigationHistory.length - 1;
        this.saveState(); // Save state when navigating
        this.loadCurrentDirectory();
    }

    navigateUp() {
        if (this.currentPath !== '/dav') {
            const parentPath = this.currentPath.substring(0, this.currentPath.lastIndexOf('/'));
            if (parentPath === '') parentPath = '/dav';
            this.currentPath = parentPath;
            this.navigationHistory.push(this.currentPath);
            this.historyIndex = this.navigationHistory.length - 1;
            this.saveState(); // Save state when navigating up
            this.loadCurrentDirectory();
        }
    }

    toggleSelection(item) {
        const itemKey = `${item.type}:${item.path}`;
        const itemElement = this.fileGrid.querySelector(`[data-path="${item.path}"]`);
        
        if (this.selectedItems.has(itemKey)) {
            this.selectedItems.delete(itemKey);
            itemElement?.classList.remove('selected');
        } else {
            this.selectedItems.add(itemKey);
            itemElement?.classList.add('selected');
        }
        
        this.updateToolbar();
    }

    selectAll() {
        const items = this.fileGrid.querySelectorAll('.file-item');
        items.forEach(item => {
            const itemData = {
                type: item.dataset.type,
                path: item.dataset.path,
                name: item.dataset.name
            };
            this.selectedItems.add(`${itemData.type}:${itemData.path}`);
            item.classList.add('selected');
        });
        this.updateToolbar();
    }

    clearSelection() {
        this.selectedItems.clear();
        this.fileGrid.querySelectorAll('.file-item.selected').forEach(item => {
            item.classList.remove('selected');
        });
        this.updateToolbar();
    }

    async deleteSelected() {
        if (this.selectedItems.size === 0) return;
        // Gather selected item names
        const itemsToDelete = Array.from(this.selectedItems).map(key => {
            const [type, path] = key.split(':');
            let name = path.split('/').filter(Boolean).pop();
            if (!name) name = path; // fallback
            return { type, path, name };
        });
        // Build file/folder list HTML
        const fileListHtml = itemsToDelete.map(item => `<div class="delete-modal-name"><i class=\"fas fa-${item.type === 'folder' ? 'folder' : 'file'}\"></i> ${this.decodePathComponent(item.name)}</div>`).join('');
        // Set modal content
        const fileListDiv = document.getElementById('delete-file-list');
        const modalElement = document.getElementById('deleteConfirmModal');
        const confirmBtn = document.getElementById('confirm-delete-btn');
        const confirmInput = document.getElementById('delete-confirm-input');
        if (!fileListDiv || !modalElement || !confirmBtn || !confirmInput) {
            alert('WARNING: Deleting files or folders cannot be undone and may impact website functionality.\n\nThe following will be deleted:\n' + itemsToDelete.map(i => i.name).join('\n'));
            return;
        }
        fileListDiv.innerHTML = fileListHtml;
        confirmBtn.disabled = true;
        confirmInput.value = '';
        
        // Enable delete button only if input is DELETE
        const inputHandler = () => {
            confirmBtn.disabled = confirmInput.value !== 'DELETE';
        };
        confirmInput.addEventListener('input', inputHandler);
        
        // Show modal (support both window.bootstrap and global Bootstrap)
        let ModalClass = window.bootstrap ? window.bootstrap.Modal : (window.Modal || null);
        if (!ModalClass && typeof bootstrap !== 'undefined') ModalClass = bootstrap.Modal;
        if (!ModalClass) {
            alert('WARNING: Deleting files or folders cannot be undone and may impact website functionality.\n\nThe following will be deleted:\n' + itemsToDelete.map(i => i.name).join('\n'));
            return;
        }
        const modal = new ModalClass(modalElement);
        
        // Focus the input field when modal is shown
        modalElement.addEventListener('shown.bs.modal', () => {
            confirmInput.focus();
        }, { once: true });
        
        modal.show();
        
        // Handle confirm button
        const handler = async () => {
            if (confirmInput.value !== 'DELETE') return;
            confirmBtn.removeEventListener('click', handler);
            confirmInput.removeEventListener('input', inputHandler);
            modal.hide();
            this.showLoadingOverlay();
            try {
                const response = await fetch('/webdav-delete', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ items: itemsToDelete })
                });
                if (!response.ok) throw new Error('Failed to delete items');
                const result = await response.json();
                alert(`Successfully deleted ${result.deletedCount} item(s)`);
                this.clearSelection();
                this.loadCurrentDirectory();
            } catch (error) {
                console.error('Error deleting items:', error);
                alert('Failed to delete selected items');
            } finally {
                this.hideLoadingOverlay();
            }
        };
        confirmBtn.addEventListener('click', handler);
        
        // Handle Enter key on input field
        const keydownHandler = (event) => {
            if (event.key === 'Enter' && confirmInput.value === 'DELETE') {
                handler();
            }
        };
        confirmInput.addEventListener('keydown', keydownHandler);
        
        // Clean up event listeners when modal is hidden
        modalElement.addEventListener('hidden.bs.modal', () => {
            confirmInput.removeEventListener('input', inputHandler);
            confirmInput.removeEventListener('keydown', keydownHandler);
            confirmBtn.removeEventListener('click', handler);
        }, { once: true });
    }

    filterItems() {
        // Simple search filter - can be enhanced later
        const searchTerm = this.searchInput?.value.toLowerCase() || '';
        const items = this.fileGrid.querySelectorAll('.file-item');
        
        items.forEach(item => {
            const fileName = item.querySelector('.file-name')?.textContent.toLowerCase() || '';
            if (fileName.includes(searchTerm)) {
                item.style.display = '';
            } else {
                item.style.display = 'none';
            }
        });
    }

    updateBreadcrumb() {
        const pathParts = this.currentPath.split('/').filter(part => part);
        this.breadcrumb.innerHTML = '';
        
        // Root
        const rootItem = document.createElement('li');
        rootItem.className = 'breadcrumb-item';
        rootItem.innerHTML = '<a href="#" data-path="/dav">WebDAV Root</a>';
        rootItem.addEventListener('click', (e) => {
            e.preventDefault();
            this.navigateToFolder('/dav');
        });
        this.breadcrumb.appendChild(rootItem);
        
        // Path parts
        let currentPath = '/dav';
        pathParts.forEach((part, index) => {
            if (part === 'dav') return;
            
            currentPath += '/' + part;
            const item = document.createElement('li');
            item.className = 'breadcrumb-item';
            item.innerHTML = `<a href="#" data-path="${currentPath}">${decodeURIComponent(part)}</a>`;
            item.addEventListener('click', (e) => {
                e.preventDefault();
                this.navigateToFolder(currentPath);
            });
            this.breadcrumb.appendChild(item);
        });
    }

    updateToolbar() {
        this.upBtn.disabled = this.currentPath === '/dav';
        this.deleteSelectedBtn.disabled = this.selectedItems.size === 0;
        
        const selectedCount = this.selectedItems.size;
        if (selectedCount > 0) {
            this.deleteSelectedBtn.textContent = `Delete Selected (${selectedCount})`;
        } else {
            this.deleteSelectedBtn.innerHTML = '<i class="fas fa-trash"></i> Delete Selected';
        }
    }

    showLoading() {
        this.fileGrid.innerHTML = `
            <div class="loading">
                <div class="spinner-border text-primary" role="status">
                    <span class="visually-hidden">Loading...</span>
                </div>
                <p class="mt-2">Connecting to WebDAV server...</p>
                <p class="text-muted small">This may take a few seconds due to authentication</p>
            </div>
        `;
        this.itemCount.textContent = 'Loading...';
    }

    showLoadingOverlay() {
        if (!this.fileGrid) return;
        
        this.fileGrid.innerHTML = `
            <div class="loading">
                <div class="spinner-border text-primary" role="status">
                        <span class="visually-hidden">Loading...</span>
                    </div>
                <p class="mt-2">Loading files...</p>
                </div>
            `;
    }

    hideLoadingOverlay() {
        // This is handled in renderDirectory now
    }

    showError(message) {
        if (!this.fileGrid) return;
        
        this.fileGrid.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-exclamation-triangle fa-3x text-warning mb-3"></i>
                <h5>Error</h5>
                <p>${message}</p>
                <button class="btn btn-primary" onclick="location.reload()">Retry</button>
            </div>
        `;
    }

    showEmptyState() {
        if (!this.fileGrid) return;
        
        this.fileGrid.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-folder-open fa-3x text-muted mb-3"></i>
                <h5>Empty Directory</h5>
                <p>This directory is empty.</p>
            </div>
        `;
    }

    isImageFile(filename) {
        const ext = filename.split('.').pop()?.toLowerCase();
        return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext);
    }

    getThumbnailUrl(filePath) {
        // Convert WebDAV path to a thumbnail URL with cache busting
        const encodedPath = encodeURIComponent(filePath);
        const timestamp = Date.now(); // Cache busting
        return `/webdav-thumbnail?path=${encodedPath}&t=${timestamp}`;
    }

    toggleViewMode() {
        this.viewMode = this.viewMode === 'thumbnails' ? 'list' : 'thumbnails';
        this.saveState(); // Save state when changing view mode
        this.applyViewMode();
        this.updateToolbar();
    }

    applyViewMode() {
        if (!this.fileGrid) return;
        
        if (this.viewMode === 'list') {
            this.fileGrid.classList.add('list-view');
            if (this.viewToggle) {
                this.viewToggle.innerHTML = '<i class="fas fa-th-large"></i> Thumbnails';
            }
        } else {
            this.fileGrid.classList.remove('list-view');
            if (this.viewToggle) {
                this.viewToggle.innerHTML = '<i class="fas fa-list"></i> List';
            }
        }
    }

    updateThumbnailProgress(loaded, total) {
        if (total > 0) {
            const percentage = Math.round((loaded / total) * 100);
            const progressText = `Loading thumbnails: ${loaded}/${total} (${percentage}%)`;
            
            // Update the loading overlay text
            const overlay = document.getElementById('loading-overlay');
            if (overlay) {
                const progressElement = overlay.querySelector('.loading-progress');
                if (progressElement) {
                    progressElement.textContent = progressText;
                } else {
                    // Create progress element if it doesn't exist
                    const progressDiv = document.createElement('div');
                    progressDiv.className = 'loading-progress mt-2';
                    progressDiv.textContent = progressText;
                    overlay.querySelector('.loading-content').appendChild(progressDiv);
                }
            }
            
            // Also update item count for consistency
            this.itemCount.textContent = progressText;
        }
    }

    updateItemCount() {
        // Count visible file items (not hidden by search filter)
        const visibleItems = Array.from(this.fileGrid.querySelectorAll('.file-item')).filter(item => 
            item.style.display !== 'none'
        );
        
        const totalItems = visibleItems.length;
        const folderCount = visibleItems.filter(item => item.dataset.type === 'folder').length;
        const fileCount = totalItems - folderCount;
        
        if (totalItems === 0) {
            this.itemCount.textContent = 'Empty directory';
        } else {
            this.itemCount.textContent = `${totalItems} items (${folderCount} folders, ${fileCount} files)`;
        }
    }

    async deleteItem(type, path, name) {
        let confirmMessage = `Are you sure you want to delete "${name}"? This action cannot be undone.`;
        
        // Check if it's a folder and has contents
        if (type === 'folder') {
            try {
                console.log('Checking folder contents for:', path);
                const response = await fetch(`/webdav-list?path=${encodeURIComponent(path)}`);
                console.log('Folder contents check status:', response.status);
                
                if (response.ok) {
                    const data = await response.json();
                    const totalItems = (data.files?.length || 0) + (data.folders?.length || 0);
                    
                    if (totalItems > 0) {
                        confirmMessage = `Warning: The folder "${name}" contains ${totalItems} item(s).\n\nAre you sure you want to delete this folder and all its contents? This action cannot be undone.`;
                    }
                } else {
                    console.log('Could not check folder contents, proceeding with deletion');
                }
            } catch (error) {
                console.error('Error checking folder contents:', error);
                confirmMessage = `Warning: Unable to check folder contents.\n\nAre you sure you want to delete the folder "${name}"? This action cannot be undone.`;
            }
        }
        
        if (!confirm(confirmMessage)) return;
        
        this.showLoadingOverlay();
        
        try {
            const response = await fetch('/webdav-delete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    items: [{ type, path, name }] 
                })
            });
            
            console.log('Delete response status:', response.status);
            const result = await response.json();
            console.log('Delete response body:', result);
            
            // Check if the operation was successful based on response status
            if (response.ok) {
                alert(`Successfully deleted "${name}"`);
                console.log('Refreshing directory after deletion...');
                this.loadCurrentDirectory(); // Refresh the current view
            } else {
                throw new Error('Failed to delete item');
            }
        } catch (error) {
            console.error('Error deleting item:', error);
            alert('Failed to delete item');
        } finally {
            this.hideLoadingOverlay();
        }
    }

    async createNewFolder() {
        const folderName = await this.showInputModal(
            'Create New Folder',
            'Folder Name:',
            'Enter a name for the new folder',
            'Create',
            ''
        );
        
        if (folderName) {
            try {
                const newFolderPath = this.currentPath.endsWith('/') 
                    ? this.currentPath + folderName 
                    : this.currentPath + '/' + folderName;
                
                this.updateLoadingStatus('Creating folder...');
                
                const response = await fetch('/api/webdav/create-directory', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ path: newFolderPath })
                });
                
                if (response.ok) {
                    this.showToast('Folder created successfully!', 'success');
                    this.loadCurrentDirectory();
                } else {
                    const error = await response.json();
                    this.showToast(`Failed to create folder: ${error.error}`, 'error');
            }
        } catch (error) {
                this.showToast(`Error creating folder: ${error.message}`, 'error');
            } finally {
                this.updateLoadingStatus('Ready');
            }
        }
    }

    async createBikeFolderStructure() {
        if (!confirm('Create standard bike folder structure? This will create generation and variant folders.')) {
            return;
        }

        try {
            this.updateLoadingStatus('Creating bike folder structure...');
            
            // Standard bike folder structure
            const folders = [
                '5', '6', '7', '8', '9', '10', // Generations
                '5/GT Touring', '5/GT Vario', '5/GT Rohloff',
                '6/GT Touring', '6/GT Vario', '6/GT Rohloff',
                '7/GT Touring', '7/GT Vario', '7/GT Rohloff',
                '8/GT Touring', '8/GT Vario', '8/GT Rohloff',
                '9/GT Touring', '9/GT Vario', '9/GT Rohloff',
                '10/GT Touring', '10/GT Vario', '10/GT Rohloff'
            ];

            let createdCount = 0;
            let errorCount = 0;

            for (const folder of folders) {
                try {
                    const folderPath = this.currentPath.endsWith('/') 
                        ? this.currentPath + folder 
                        : this.currentPath + '/' + folder;
                    
                    const response = await fetch('/api/webdav/create-directory', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ path: folderPath })
            });
            
            if (response.ok) {
                        createdCount++;
            } else {
                        errorCount++;
            }
        } catch (error) {
                    errorCount++;
                }
            }

            this.showToast(`Created ${createdCount} folders${errorCount > 0 ? `, ${errorCount} failed` : ''}`, 'success');
            this.loadCurrentDirectory();
            
        } catch (error) {
            this.showToast(`Error creating folder structure: ${error.message}`, 'error');
        } finally {
            this.updateLoadingStatus('Ready');
        }
    }

    showInputModal(title, label, helpText, confirmText, defaultValue = '') {
        return new Promise((resolve) => {
            // Update modal content
            document.getElementById('input-modal-title').textContent = title;
            document.getElementById('input-modal-label').textContent = label;
            document.getElementById('input-modal-help').textContent = helpText;
            document.getElementById('input-modal-confirm-btn').textContent = confirmText;
            
            const input = document.getElementById('folder-name-input');
            input.value = defaultValue;
            input.focus();
            
            // Show modal
            const modal = new bootstrap.Modal(document.getElementById('inputModal'));
            modal.show();
            
            // Handle confirm button click
            const confirmBtn = document.getElementById('input-modal-confirm-btn');
            const handleConfirm = () => {
                const value = input.value.trim();
                modal.hide();
                confirmBtn.removeEventListener('click', handleConfirm);
                resolve(value);
            };
            
            confirmBtn.addEventListener('click', handleConfirm);
            
            // Handle Enter key
            const handleKeydown = (event) => {
                if (event.key === 'Enter') {
                    handleConfirm();
                }
            };
            
            input.addEventListener('keydown', handleKeydown);
            
            // Handle modal hidden event to clean up
            const modalElement = document.getElementById('inputModal');
            const handleHidden = () => {
                input.removeEventListener('keydown', handleKeydown);
                modalElement.removeEventListener('hidden.bs.modal', handleHidden);
                resolve(''); // Resolve with empty string if modal is closed without confirmation
            };
            
            modalElement.addEventListener('hidden.bs.modal', handleHidden);
        });
    }

    async renameCurrentFolder() {
        const currentFolderName = this.currentPath.split('/').pop();
        const newFolderName = await this.showInputModal('Rename Folder', 'New Folder Name:', 'Enter the new name for the folder', 'Rename', currentFolderName);
        
        if (!newFolderName || newFolderName.trim() === '' || newFolderName === currentFolderName) return;
        
        const parentPath = this.currentPath.substring(0, this.currentPath.lastIndexOf('/'));
        const newFolderPath = parentPath + '/' + newFolderName.trim();
        
        this.showLoadingOverlay();
        
        try {
            const response = await fetch('/webdav-move', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    from: this.currentPath,
                    to: newFolderPath
                })
            });
            
            if (!response.ok) throw new Error('Failed to rename folder');
            
            const result = await response.json();
            if (result.success) {
                alert(`Folder renamed to "${newFolderName}" successfully`);
                // Navigate to the renamed folder
                this.currentPath = newFolderPath;
                this.updateBreadcrumb();
                this.loadCurrentDirectory();
            } else {
                alert('Failed to rename folder');
            }
        } catch (error) {
            console.error('Error renaming folder:', error);
            alert('Failed to rename folder');
        } finally {
            this.hideLoadingOverlay();
        }
    }

    updateLoadingStatus(status, showProgress = false) {
        const overlay = document.getElementById('loading-overlay');
        if (overlay) {
            const statusElement = overlay.querySelector('.loading-status');
            const progressElement = overlay.querySelector('.loading-progress');
            
            if (statusElement) {
                statusElement.textContent = status;
            }
            
            if (progressElement) {
                progressElement.style.display = showProgress ? 'block' : 'none';
            }
        }
    }

    updateLoadingProgress(loaded, total, status = null) {
        const overlay = document.getElementById('loading-overlay');
        if (overlay) {
            const progressBar = overlay.querySelector('.progress-bar');
            const progressText = overlay.querySelector('.progress-text');
            const statusElement = overlay.querySelector('.loading-status');
            
            if (progressBar && total > 0) {
                const percentage = Math.round((loaded / total) * 100);
                progressBar.style.width = percentage + '%';
            }
            
            if (progressText && total > 0) {
                progressText.textContent = `${loaded}/${total} items processed`;
            }
            
            if (statusElement && status) {
                statusElement.textContent = status;
            }
        }
    }

    async loadImageMetadata(path, imageInfoElement) {
        console.log('[WebDAV] Loading metadata for:', path);
        
        // Check cache first
        if (this.imageMetadataCache.has(path)) {
            console.log('[WebDAV] Using cached metadata for:', path);
            const cachedData = this.imageMetadataCache.get(path);
            this.displayImageMetadata(imageInfoElement, cachedData);
            return;
        }

        try {
            console.log('[WebDAV] Fetching metadata from API for:', path);
            // Use the new API endpoint to get EXIF metadata
            const response = await fetch(`/api/get-image-metadata?path=${encodeURIComponent(path)}`);
            console.log('[WebDAV] API response status:', response.status);
            
            if (response.ok) {
                const result = await response.json();
                console.log('[WebDAV] API response data:', result);
                
                if (result.metadata) {
                    // Extract bike details from EXIF metadata
                    const bikeDetails = this.extractBikeDetailsFromMetadata(result.metadata);
                    console.log('[WebDAV] Extracted bike details:', bikeDetails);
                    
                    // Cache the result
                    this.imageMetadataCache.set(path, { bikeDetails, metadata: result.metadata });
                    this.displayImageMetadata(imageInfoElement, { bikeDetails, metadata: result.metadata });
                } else {
                    console.log('[WebDAV] No metadata found in response');
                    this.displayFallbackMetadata(imageInfoElement);
                }
            } else {
                console.log('[WebDAV] API request failed with status:', response.status);
                this.displayFallbackMetadata(imageInfoElement);
            }
        } catch (error) {
            console.error('[WebDAV] Error fetching image metadata:', error);
            this.displayFallbackMetadata(imageInfoElement);
        }
    }

    extractBikeDetailsFromMetadata(metadata) {
        console.log('[WebDAV] Extracting bike details from metadata:', metadata);
        
        // Extract only the 7 specific fields
        let model = metadata.Model || '';
        let generation = metadata.Generation || '';
        let variants = metadata.Variants || '';
        let dimensions = metadata.Dimensions || '';
        let dateCreated = metadata.DateCreated || '';
        let dateUploaded = metadata.DateUploaded || '';
        
        // Fallback: try to extract Generation and Variants from ImageDescription or UserComment
        if (!generation || !variants) {
            const imageDesc = metadata.ImageDescription || '';
            const userComment = metadata.UserComment || '';
            
            // Try to extract from ImageDescription format: "Model Generation - Variants"
            if (imageDesc && !generation && !variants) {
                const match = imageDesc.match(/^([^-]+)\s+([^-]+)\s*-\s*(.+)$/);
                if (match) {
                    if (!model) model = match[1].trim();
                    if (!generation) generation = match[2].trim();
                    if (!variants) variants = match[3].trim();
                }
            }
            
            // Try to extract from UserComment format: "Generation: X, Variants: Y"
            if (userComment && (!generation || !variants)) {
                const genMatch = userComment.match(/Generation:\s*([^,]+)/);
                const varMatch = userComment.match(/Variants:\s*(.+)/);
                if (genMatch && !generation) generation = genMatch[1].trim();
                if (varMatch && !variants) variants = varMatch[1].trim();
            }
        }
        
        // Calculate aspect ratio from image dimensions if available
        let aspect = '';
        if (metadata.ImageWidth && metadata.ImageHeight) {
            const width = metadata.ImageWidth;
            const height = metadata.ImageHeight;
            const ratio = (width / height).toFixed(2);
            aspect = `${width}×${height} (${ratio}:1)`;
        }
        
        // Parse dates if they exist
        let createdDate = '';
        let uploadedDate = '';
        
        if (dateCreated) {
            try {
                // Handle ExifDate objects that have a rawValue property
                const dateValue = dateCreated.rawValue || dateCreated;
                
                // Handle exiftool date format 'YYYY:MM:DD' or 'YYYY:MM:DD HH:MM:SS'
                let date;
                if (typeof dateValue === 'string') {
                    if (dateValue.includes(':')) {
                        // Convert 'YYYY:MM:DD' to 'YYYY-MM-DD' for proper parsing
                        const normalizedDate = dateValue.replace(/:/g, '-');
                        date = new Date(normalizedDate);
                    } else {
                        date = new Date(dateValue);
                    }
                } else {
                    date = new Date(dateValue);
                }
                
                if (!isNaN(date.getTime())) {
                    createdDate = date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
                } else {
                    createdDate = dateValue;
                }
            } catch (e) {
                createdDate = dateCreated.rawValue || dateCreated;
            }
        }
        
        if (dateUploaded) {
            try {
                // Handle ExifDate objects that have a rawValue property
                const dateValue = dateUploaded.rawValue || dateUploaded;
                
                // Handle exiftool date format 'YYYY:MM:DD' or 'YYYY:MM:DD HH:MM:SS'
                let date;
                if (typeof dateValue === 'string') {
                    if (dateValue.includes(':')) {
                        // Convert 'YYYY:MM:DD' to 'YYYY-MM-DD' for proper parsing
                        const normalizedDate = dateValue.replace(/:/g, '-');
                        date = new Date(normalizedDate);
                    } else {
                        date = new Date(dateValue);
                    }
                } else {
                    date = new Date(dateValue);
                }
                
                if (!isNaN(date.getTime())) {
                    uploadedDate = date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
                } else {
                    uploadedDate = dateValue;
                }
            } catch (e) {
                uploadedDate = dateUploaded.rawValue || dateUploaded;
            }
        }
        
        return {
            model,
            generation,
            variants,
            dimensions,
            aspect,
            dateCreated: createdDate,
            dateUploaded: uploadedDate
        };
    }

    displayImageMetadata(imageInfoElement, imageData) {
        console.log('[WebDAV] Displaying metadata:', imageData);
        
        if (imageData.bikeDetails) {
            // Display bike details from embedded metadata
            const { model, generation, variants, dimensions, aspect, dateCreated, dateUploaded } = imageData.bikeDetails;
            console.log('[WebDAV] Bike details to display:', { model, generation, variants, dimensions, aspect, dateCreated, dateUploaded });
            
            let bikeInfo = `<div class="bike-details">`;
            
            // 1. Model
            if (model) {
                bikeInfo += `<div class="bike-model"><strong>${model}</strong></div>`;
            }
            
            // 2. Generation
            if (generation) {
                bikeInfo += `<div class="bike-generation"><small>Generation: ${generation}</small></div>`;
            }
            
            // 3. Variants
            if (variants) {
                bikeInfo += `<div class="bike-variants"><small>Variants: ${variants}</small></div>`;
            }
            
            // 4. Dimensions
            if (dimensions) {
                bikeInfo += `<div class="dimensions"><small>Dimensions: ${dimensions}</small></div>`;
            }
            
            // 5. Aspect
            if (aspect) {
                bikeInfo += `<div class="aspect"><small>Aspect: ${aspect}</small></div>`;
            }
            
            // 6. Date Created
            if (dateCreated) {
                bikeInfo += `<div class="date-created"><small>Created: ${dateCreated}</small></div>`;
            }
            
            // 7. Date Uploaded
            if (dateUploaded) {
                bikeInfo += `<div class="date-uploaded"><small>Uploaded: ${dateUploaded}</small></div>`;
            }
            
            bikeInfo += `</div>`;
            
            imageInfoElement.innerHTML = bikeInfo;
        } else {
            // Fallback to basic image info
            const { width, height, size } = imageData;
            imageInfoElement.innerHTML = `
                <div class="image-info">
                    <div class="image-details d-flex justify-content-between">
                        <span class="image-dimensions">${width} × ${height}</span>
                        <span class="image-size">${size}</span>
                    </div>
                </div>
            `;
        }
    }

    displayFallbackMetadata(imageInfoElement) {
        const img = imageInfoElement.parentElement.querySelector('.thumbnail');
        if (img && img.naturalWidth && img.naturalHeight) {
            const aspectRatio = this.getAspectRatio(img.naturalWidth, img.naturalHeight);
            imageInfoElement.innerHTML = `
                <div class="image-details">
                    <div class="dimension">${img.naturalWidth}px × ${img.naturalHeight}px</div>
                    <div class="aspect-ratio">Aspect: ${aspectRatio}</div>
                    <div class="file-info">Thumbnail</div>
                </div>
            `;
        } else {
            imageInfoElement.innerHTML = `
                <div class="image-details">
                    <div class="file-info">Image loaded</div>
                </div>
            `;
        }
        imageInfoElement.dataset.loaded = 'true';
        imageInfoElement.style.display = 'block';
    }

    updatePathDisplay() {
        if (!this.pathDisplay) return;
        
        const pathParts = this.currentPath.split('/').filter(part => part);
        let html = '';
        
        // Start with a clear root indicator
        html += '<li class="breadcrumb-item"><a href="#" data-path="/dav"><i class="fas fa-home"></i> WebDAV Root</a></li>';
        
        // Build the path hierarchy with cleaner names
        let currentPath = '/dav';
        pathParts.forEach((part, index) => {
            if (part === 'dav') return;
            
            currentPath += '/' + part;
            const isLast = index === pathParts.length - 1;
            
            // Clean up the display name
            let displayName = this.decodePathComponent(part);
            
            // Make common folders more readable
            if (displayName === 'product_images') {
                displayName = 'Product Images';
            } else if (displayName === 'content') {
                displayName = 'Content';
            } else if (displayName === 'product_modules') {
                displayName = 'Product Modules';
            }
            
            if (isLast) {
                // Current folder - show as active, not clickable
                html += `<li class="breadcrumb-item active" aria-current="page">
                    <i class="fas fa-folder-open"></i> ${displayName}
                </li>`;
            } else {
                // Parent folders - clickable links
                html += `<li class="breadcrumb-item">
                    <a href="#" data-path="${currentPath}">
                        <i class="fas fa-folder"></i> ${displayName}
                    </a>
                </li>`;
            }
        });
        
        this.pathDisplay.innerHTML = html;
        
        // Add click handlers for breadcrumb navigation
        this.pathDisplay.querySelectorAll('a[data-path]').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                this.cancelCurrentOperation();
                this.currentPath = e.target.closest('a').dataset.path;
                this.loadCurrentDirectory();
            });
        });
    }

    // Helper method to decode URL-encoded path components
    decodePathComponent(component) {
        try {
            return decodeURIComponent(component);
        } catch (e) {
            return component; // Return as-is if decoding fails
        }
    }

    updateStatus(message, type = 'info') {
        if (!this.statusText) return;
        
        const icons = {
            info: 'fas fa-info-circle',
            loading: 'fas fa-spinner fa-spin',
            success: 'fas fa-check-circle',
            error: 'fas fa-exclamation-triangle',
            warning: 'fas fa-exclamation-circle'
        };
        
        const colors = {
            info: 'text-muted',
            loading: 'text-primary',
            success: 'text-success',
            error: 'text-danger',
            warning: 'text-warning'
        };
        
        this.statusText.innerHTML = `<i class="${icons[type]}"></i> ${message}`;
        this.statusText.className = `small ${colors[type]}`;
    }

    updateConnectionStatus(connected) {
        if (!this.connectionIndicator) return;
        
        if (connected) {
            this.connectionIndicator.innerHTML = '<i class="fas fa-wifi"></i> Connected';
            this.connectionIndicator.className = 'badge bg-success';
        } else {
            this.connectionIndicator.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Disconnected';
            this.connectionIndicator.className = 'badge bg-danger';
        }
    }

    async renameSelected() {
        if (this.selectedItems.size !== 1) {
            alert('Please select exactly one item to rename.');
            return;
        }
        const itemKey = Array.from(this.selectedItems)[0];
        const [type, path] = itemKey.split(':');
        const name = path.split('/').pop();
        const warning = `WARNING: Renaming files or folders may break links or functionality on your website.\n\nAre you sure you want to rename '${name}'?`;
        if (!confirm(warning)) return;
        // ... existing code for renaming ...
    }

    async moveSelected() {
        if (this.selectedItems.size === 0) return;
        const warning = `WARNING: Moving files or folders may break links or functionality on your website.\n\nAre you sure you want to move the selected item(s)?`;
        if (!confirm(warning)) return;
        // ... existing code for moving ...
    }

    _gcd(a, b) {
        return b === 0 ? a : this._gcd(b, a % b);
    }

    getAspectRatio(width, height) {
        if (!width || !height) return '';
        const divisor = this._gcd(width, height);
        return `${width / divisor}:${height / divisor}`;
    }

    async getImageInfo(path) {
        try {
            const response = await fetch(`/webdav-image-info?path=${encodeURIComponent(path)}`);
            if (response.ok) {
                return await response.json();
            } else {
                console.error('Failed to load image info:', response.status);
                return null;
            }
        } catch (error) {
            console.error('Error loading image info:', error);
            return null;
        }
    }

    showDetails(item) {
        this.getImageInfo(item.path).then(metadata => {
            if (metadata && metadata.width && metadata.height) {
                const aspectRatio = this.getAspectRatio(metadata.width, metadata.height);
                detailsContent.innerHTML = `
                    <h5>${this.decodePathComponent(item.name)}</h5>
                    <p>Type: ${item.type}</p>
                    <p>Dimensions: ${metadata.width}x${metadata.height}</p>
                    <p class="aspect-ratio">Aspect: ${aspectRatio}</p>
                    <p>Size: ${metadata.fileSize || 'N/A'}</p>
                `;
            } else {
                detailsContent.innerHTML = 'Could not load image details.';
            }
        });
    }

    updateImageDetails(imageInfoElement, metadata) {
        if (metadata.width && metadata.height) {
            const aspectRatio = this.getAspectRatio(metadata.width, metadata.height);
            imageInfoElement.innerHTML = `
                <div class="image-details">
                    <div class="dimension">${metadata.width}px × ${metadata.height}px</div>
                    <div class="aspect-ratio">Aspect: ${aspectRatio}</div>
                    <div class="file-info">${metadata.format.toUpperCase()} • ${metadata.fileSize}</div>
                </div>
            `;
        }
    }

    // Process folder count queue in batches
    async processFolderCountQueue() {
        if (this.isProcessingFolderCounts || this.folderCountQueue.length === 0) {
            return;
        }

        this.isProcessingFolderCounts = true;
        
        while (this.folderCountQueue.length > 0) {
            const batch = this.folderCountQueue.splice(0, 3); // Process 3 at a time
            
            await Promise.all(batch.map(async ({ div, folderPath }) => {
                const detailEl = div.querySelector('.file-details');
                if (detailEl) {
                    const count = await this.getFolderItemCount(folderPath);
                    detailEl.innerHTML = `<i class="fas fa-folder text-warning"></i> Folder &bull; ${count}`;
                }
            }));
            
            // Small delay between batches to prevent server overload
            if (this.folderCountQueue.length > 0) {
                await new Promise(resolve => setTimeout(resolve, 100));
            }
        }
        
        this.isProcessingFolderCounts = false;
    }

    async testConnection() {
        this.updateStatus('Testing WebDAV connection...', 'loading');
        
        try {
            const response = await fetch('/test-webdav', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    url: 'https://store-c8jhcan2jv.mybigcommerce.com/dav',
                    username: 'harry@e-bikebarn.com',
                    password: '17834c9d87f021d5d76fc9c935b4efbda044df5b',
                    path: '/dav'
                })
            });
            
            const result = await response.json();
            
            if (result.success) {
                this.updateStatus(`Connection successful: ${result.items} items found`, 'success');
                console.log('WebDAV connection test successful', result);
            } else {
                this.updateStatus(`Connection failed: ${result.error}`, 'error');
                console.error('WebDAV connection test failed', result);
            }
        } catch (error) {
            this.updateStatus(`Connection test error: ${error.message}`, 'error');
            console.error('WebDAV connection test error', error);
        }
    }

    // Add right-click context menu support
    handleItemRightClick(item, element, event) {
        event.preventDefault();
        this.showContextMenu(event, item);
    }
    
    // Lightbox methods
    openImageInLightbox(imageItem) {
        // Get all images in current directory
        const allItems = Array.from(this.fileGrid.children).map(el => ({
            path: el.dataset.path,
            type: el.dataset.type,
            name: el.dataset.name
        }));
        
        this.currentImages = allItems.filter(item => 
            item.type === 'file' && this.isImageFile(this.extractNameFromPath(item.path))
        );
        
        this.currentImageIndex = this.currentImages.findIndex(img => img.path === imageItem.path);
        if (this.currentImageIndex === -1) this.currentImageIndex = 0;
        
        this.showImageInLightbox();
    }
    
    showImageInLightbox() {
        if (this.currentImages.length === 0) return;
        
        const imageItem = this.currentImages[this.currentImageIndex];
        const imageName = this.extractNameFromPath(imageItem.path);
        
        // Update lightbox UI
        this.lightboxImageName.textContent = imageName;
        this.lightboxCounter.textContent = `Image ${this.currentImageIndex + 1} of ${this.currentImages.length}`;
        
        // Show loading
        this.lightboxImage.style.display = 'none';
        document.querySelector('.lightbox-loading').style.display = 'block';
        
        // Load image
        const imageUrl = this.getThumbnailUrl(imageItem.path);
        this.lightboxImage.onload = () => {
            this.lightboxImage.style.display = 'block';
            document.querySelector('.lightbox-loading').style.display = 'none';
            this.resetZoom();
        };
        this.lightboxImage.src = imageUrl;
        
        // Update navigation buttons
        this.lightboxPrevBtn.style.display = this.currentImageIndex > 0 ? 'block' : 'none';
        this.lightboxNextBtn.style.display = this.currentImageIndex < this.currentImages.length - 1 ? 'block' : 'none';
        
        // Show modal
        const modal = new bootstrap.Modal(this.lightboxModal);
        modal.show();
    }
    
    showPreviousImage() {
        if (this.currentImageIndex > 0) {
            this.currentImageIndex--;
            this.showImageInLightbox();
        }
    }
    
    showNextImage() {
        if (this.currentImageIndex < this.currentImages.length - 1) {
            this.currentImageIndex++;
            this.showImageInLightbox();
        }
    }
    
    zoomIn() {
        this.lightboxZoom = Math.min(this.lightboxZoom * 1.2, 5);
        this.applyZoom();
    }
    
    zoomOut() {
        this.lightboxZoom = Math.max(this.lightboxZoom / 1.2, 0.1);
        this.applyZoom();
    }
    
    resetZoom() {
        this.lightboxZoom = 1;
        this.applyZoom();
    }
    
    applyZoom() {
        this.lightboxImage.style.transform = `scale(${this.lightboxZoom})`;
    }
    
    downloadCurrentImage() {
        if (this.currentImages.length === 0) return;
        
        const imageItem = this.currentImages[this.currentImageIndex];
        const imageName = this.extractNameFromPath(imageItem.path);
        const imageUrl = this.getThumbnailUrl(imageItem.path);
        
        const link = document.createElement('a');
        link.href = imageUrl;
        link.download = imageName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
    
    copyPublicUrl() {
        if (this.currentImages.length === 0) return;
        
        const imageItem = this.currentImages[this.currentImageIndex];
        const publicUrl = this.getPublicUrl(imageItem.path);
        
        navigator.clipboard.writeText(publicUrl).then(() => {
            this.showToast('Public URL copied to clipboard', 'success');
        }).catch(() => {
            this.showToast('Failed to copy URL', 'error');
        });
    }
    
    copyWebdavPath() {
        if (this.currentImages.length === 0) return;
        
        const imageItem = this.currentImages[this.currentImageIndex];
        
        navigator.clipboard.writeText(imageItem.path).then(() => {
            this.showToast('WebDAV path copied to clipboard', 'success');
        }).catch(() => {
            this.showToast('Failed to copy path', 'error');
        });
    }
    
    getPublicUrl(webdavPath) {
        // Remove /dav prefix and construct public URL
        const publicPath = webdavPath.replace(/^\/dav/, '');
        return `https://store-c8jhcan2jv.mybigcommerce.com${publicPath}`;
    }
    
    // Context menu methods
    showContextMenu(event, item) {
        this.contextMenuTarget = item;
        
        // Position context menu
        this.contextMenu.style.left = event.pageX + 'px';
        this.contextMenu.style.top = event.pageY + 'px';
        this.contextMenu.style.display = 'block';
        
        // Highlight the target item
        const element = event.target.closest('.file-item');
        if (element) {
            element.classList.add('context-menu-active');
        }
    }
    
    hideContextMenu() {
        this.contextMenu.style.display = 'none';
        this.contextMenuTarget = null;
        
        // Remove highlight from all items
        document.querySelectorAll('.file-item.context-menu-active').forEach(el => {
            el.classList.remove('context-menu-active');
        });
    }
    
    handleContextMenuAction(action, item) {
        switch (action) {
            case 'copy-path':
                navigator.clipboard.writeText(item.path).then(() => {
                    this.showToast('WebDAV path copied to clipboard', 'success');
                });
                break;
            case 'copy-public-url':
                const publicUrl = this.getPublicUrl(item.path);
                navigator.clipboard.writeText(publicUrl).then(() => {
                    this.showToast('Public URL copied to clipboard', 'success');
                });
                break;
            case 'download':
                this.downloadFile(item);
                break;
            case 'open-lightbox':
                if (this.isImageFile(this.extractNameFromPath(item.path))) {
                    this.openImageInLightbox(item);
                } else {
                    this.showToast('Lightbox is only available for images', 'warning');
                }
                break;
            case 'open-new-tab':
                const webdavUrl = `https://store-c8jhcan2jv.mybigcommerce.com${item.path}`;
                window.open(webdavUrl, '_blank');
                break;
        }
    }
    
    downloadFile(item) {
        const fileName = this.extractNameFromPath(item.path);
        const fileUrl = `https://store-c8jhcan2jv.mybigcommerce.com${item.path}`;
        
        const link = document.createElement('a');
        link.href = fileUrl;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
    
    handleGlobalKeydown(event) {
        // Only handle keys when lightbox is open
        if (!this.lightboxModal.classList.contains('show')) return;
        
        switch (event.key) {
            case 'ArrowLeft':
                event.preventDefault();
                this.showPreviousImage();
                break;
            case 'ArrowRight':
                event.preventDefault();
                this.showNextImage();
                break;
            case 'Escape':
                const modal = bootstrap.Modal.getInstance(this.lightboxModal);
                if (modal) modal.hide();
                break;
            case '+':
            case '=':
                event.preventDefault();
                this.zoomIn();
                break;
            case '-':
                event.preventDefault();
                this.zoomOut();
                break;
            case '0':
                event.preventDefault();
                this.resetZoom();
                break;
        }
    }
    
    showToast(message, type = 'info') {
        // Simple toast notification
        const toast = document.createElement('div');
        toast.className = `alert alert-${type} alert-dismissible fade show position-fixed`;
        toast.style.cssText = 'top: 20px; right: 20px; z-index: 9999; min-width: 300px;';
        toast.innerHTML = `
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        `;
        document.body.appendChild(toast);
        
        // Auto-remove after 3 seconds
        setTimeout(() => {
            if (toast.parentNode) {
                toast.remove();
            }
        }, 3000);
    }

    // Save current state to localStorage
    saveState() {
        try {
            const state = {
                currentPath: this.currentPath,
                navigationHistory: this.navigationHistory,
                historyIndex: this.historyIndex,
                viewMode: this.viewMode,
                timestamp: Date.now()
            };
            localStorage.setItem('webdav-explorer-state', JSON.stringify(state));
        } catch (error) {
            console.warn('Failed to save WebDAV explorer state:', error);
        }
    }

    // Restore state from localStorage
    restoreState() {
        try {
            const savedState = localStorage.getItem('webdav-explorer-state');
            if (savedState) {
                const state = JSON.parse(savedState);
                
                // Only restore if the saved state is less than 24 hours old
                const isRecent = (Date.now() - state.timestamp) < (24 * 60 * 60 * 1000);
                
                if (isRecent && state.currentPath) {
                    this.currentPath = state.currentPath;
                    this.navigationHistory = state.navigationHistory || ['/dav'];
                    this.historyIndex = state.historyIndex || 0;
                    this.viewMode = state.viewMode || 'thumbnails';
                    console.log('WebDAV Explorer: Restored state from localStorage', {
                        currentPath: this.currentPath,
                        viewMode: this.viewMode
                    });
                }
            }
        } catch (error) {
            console.warn('Failed to restore WebDAV explorer state:', error);
            // Fall back to defaults
            this.currentPath = '/dav';
            this.navigationHistory = ['/dav'];
            this.historyIndex = 0;
            this.viewMode = 'thumbnails';
        }
    }

    // Clear saved state (useful for debugging or reset)
    clearSavedState() {
        try {
            localStorage.removeItem('webdav-explorer-state');
            console.log('WebDAV Explorer: Cleared saved state');
        } catch (error) {
            console.warn('Failed to clear WebDAV explorer state:', error);
        }
    }

    // Add a method to reset to default state
    resetToDefault() {
        this.currentPath = '/dav';
        this.navigationHistory = ['/dav'];
        this.historyIndex = 0;
        this.viewMode = 'thumbnails';
        this.clearSavedState();
        this.loadCurrentDirectory();
        this.applyViewMode();
        this.updateToolbar();
        console.log('WebDAV Explorer: Reset to default state');
    }
}

// Initialize the WebDAV explorer when the page loads
let webdavExplorer;
document.addEventListener('DOMContentLoaded', () => {
    webdavExplorer = new WebDAVExplorer();
    
    // Make resetToDefault available globally
    window.resetWebDAVExplorer = () => {
        if (webdavExplorer) {
            webdavExplorer.resetToDefault();
        }
    };
}); 