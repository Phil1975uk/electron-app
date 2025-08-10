const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const express = require('express');
const multer = require('multer');
const sharp = require('sharp');
const xml2js = require('xml2js');
const fs = require('fs').promises;
const fsSync = require('fs');
const DigestAuthClient = require('./digest-auth');
const { exiftool } = require('exiftool-vendored');
const tmp = require('tmp-promise');
const os = require('os');
const templateManager = require('./lib/template-manager');

let mainWindow;
let server;
let debugLogEnabled = false;
const debugLogPath = path.join(__dirname, 'debug-log.txt');

// Single instance lock to prevent multiple instances
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  console.log('Another instance is already running. Exiting...');
  app.quit();
} else {
  app.on('second-instance', (event, commandLine, workingDirectory) => {
    // Someone tried to run a second instance, we should focus our window instead.
    if (mainWindow) {
      if (mainWindow.isMinimized()) {
        mainWindow.restore();
      }
      mainWindow.focus();
      mainWindow.show();
    }
  });
}

// Keep a global reference of the window object
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    title: 'Card Creator',
    icon: 'https://store-c8jhcan2jv.mybigcommerce.com/product_images/e-bikebarn-logo-w_1681566343__57813.original.png'
  });

  // Load the app
  mainWindow.loadURL('http://localhost:3030');

  // Open DevTools in development
  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Start the Express server
function startServer() {
  const app = express();
  const port = 3030;

  // Middleware
  app.use(express.json({ limit: '50mb' }));
  app.use(express.static(path.join(__dirname, 'renderer')));

  // Multer configuration for file uploads
  const storage = multer.memoryStorage();
  const upload = multer({ storage: storage });

  // Routes
  app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'renderer', 'index.html'));
  });

  app.get('/card-creator', (req, res) => {
    res.sendFile(path.join(__dirname, 'renderer', 'card-creator.html'));
  });

  app.get('/card-manager', (req, res) => {
    res.sendFile(path.join(__dirname, 'renderer', 'card-manager.html'));
  });

  app.get('/webdav-explorer', (req, res) => {
    res.sendFile(path.join(__dirname, 'renderer', 'webdav-explorer.html'));
  });

  app.get('/settings', (req, res) => {
    res.sendFile(path.join(__dirname, 'renderer', 'settings.html'));
  });



  // Serve PapaParse library from node_modules
  app.get('/papaparse.min.js', (req, res) => {
    res.set('Content-Type', 'application/javascript');
    res.sendFile(path.join(__dirname, 'node_modules', 'papaparse', 'papaparse.min.js'));
  });

  // API route to serve configurations
  app.get('/api/configurations', async (req, res) => {
    try {
      const configPath = path.join(__dirname, 'renderer', 'data', 'configurations.json');
      if (!fsSync.existsSync(configPath)) {
        return res.json({ configurations: [] });
      }
      const configData = await fs.readFile(configPath, 'utf8');
      const parsed = JSON.parse(configData);
      const configurations = Array.isArray(parsed) ? parsed : (parsed.configurations || []);
      res.json({ configurations });
    } catch (error) {
      console.error('Error reading configurations:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // API route to serve cards
  app.get('/api/cards', async (req, res) => {
    try {
      const cardsDir = path.join(__dirname, 'renderer', 'cards');
      if (!fsSync.existsSync(cardsDir)) {
        return res.json([]);
      }

      const files = await fs.readdir(cardsDir);
      const jsonFiles = files.filter(file => file.endsWith('.json'));
      const cards = await Promise.all(jsonFiles.map(async file => {
        try {
          const content = await fs.readFile(path.join(cardsDir, file), 'utf8');
          const card = JSON.parse(content);

          return card;
        } catch (error) {
          console.error(`[api/cards] Error loading card file ${file}:`, error.message);
          return null;
        }
      }));
      
      // Filter out any null cards (failed to load)
      const validCards = cards.filter(card => card !== null);
      
      console.log(`[api/cards] Loaded ${validCards.length} cards from server (${cards.length - validCards.length} failed to load)`);
      

      res.json(validCards);
    } catch (error) {
      console.error('Error reading cards:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // API route to serve Hypa CSV cache
  app.get('/api/hypa-csv-cache', async (req, res) => {
    try {
      const cachePath = path.join(__dirname, 'renderer', 'data', 'hypaCsvCache.json');
      if (!fsSync.existsSync(cachePath)) {
        return res.json({ data: [] });
      }
      const cacheData = await fs.readFile(cachePath, 'utf8');
      res.json(JSON.parse(cacheData));
    } catch (error) {
      console.error('Error reading Hypa CSV cache:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // API route to save Hypa CSV cache
  app.post('/api/hypa-csv-cache', async (req, res) => {
    try {
      const { data, headers } = req.body;
      const cachePath = path.join(__dirname, 'renderer', 'data', 'hypaCsvCache.json');
      
      // Ensure the data directory exists
      const dataDir = path.dirname(cachePath);
      if (!fsSync.existsSync(dataDir)) {
        fsSync.mkdirSync(dataDir, { recursive: true });
      }

      const cacheData = { data, headers, timestamp: new Date().toISOString() };
      await fs.writeFile(cachePath, JSON.stringify(cacheData, null, 2));
      
      console.log('[hypa-csv-cache] Cache saved successfully:', cacheData.data?.length || 0, 'rows');
      res.json({ success: true, message: 'Hypa CSV cache saved successfully' });
    } catch (error) {
      console.error('Error saving Hypa CSV cache:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // API route to import Hypa CSV
  app.post('/api/import-hypa-csv', upload.single('hypaCsvFile'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ success: false, error: 'No file uploaded' });
      }

      console.log('[import-hypa-csv] Processing file:', req.file.originalname);
      
      // Read the CSV file from buffer (memory storage)
      const csvContent = req.file.buffer.toString('utf8');
      const lines = csvContent.split('\n');
      
      console.log(`[import-hypa-csv] Raw CSV content length: ${csvContent.length} characters`);
      console.log(`[import-hypa-csv] Lines found: ${lines.length}`);
      
      if (lines.length < 2) {
        return res.status(400).json({ success: false, error: 'CSV file is empty or invalid' });
      }

      // Function to properly parse CSV line with quoted fields
      const parseCSVLine = (line) => {
        const result = [];
        let current = '';
        let inQuotes = false;
        let i = 0;
        
        while (i < line.length) {
          const char = line[i];
          
          if (char === '"') {
            if (inQuotes && line[i + 1] === '"') {
              // Escaped quote
              current += '"';
              i += 2;
            } else {
              // Toggle quote state
              inQuotes = !inQuotes;
              i++;
            }
          } else if (char === ',' && !inQuotes) {
            // End of field
            result.push(current.trim());
            current = '';
            i++;
          } else {
            current += char;
            i++;
          }
        }
        
        // Add the last field
        result.push(current.trim());
        return result;
      };
      
      // Parse headers with proper CSV handling
      const headers = parseCSVLine(lines[0]);
      console.log('[import-hypa-csv] Headers:', headers);

      // Parse data rows with proper CSV handling
      const data = [];
      let skippedLines = 0;
      let totalLines = lines.length - 1; // Exclude header
      
      for (let i = 1; i < lines.length; i++) {
        const originalLine = lines[i];
        const line = originalLine.trim();
        
        if (!line) {
          skippedLines++;
          continue;
        }
        
        const values = parseCSVLine(line);
        // Create row even if values.length < headers.length (handle trailing empty fields)
        const row = {};
        headers.forEach((header, index) => {
          row[header] = values[index] || '';
        });
        data.push(row);
      }
      
      console.log(`[import-hypa-csv] Total lines in CSV: ${lines.length} (including header)`);
      console.log(`[import-hypa-csv] Data lines processed: ${totalLines}`);
      console.log(`[import-hypa-csv] Lines skipped (empty): ${skippedLines}`);
      console.log(`[import-hypa-csv] Rows successfully parsed: ${data.length}`);

      console.log('[import-hypa-csv] Parsed', data.length, 'data rows');
      
      // Log some sample data for debugging
      if (data.length > 0) {
        console.log('[import-hypa-csv] Sample rows:');
        data.slice(0, 3).forEach((row, index) => {
          console.log(`  Row ${index + 1}: SKU=${row.sku}, ID=${row.id}`);
        });
      }

      // Save to cache
      const cachePath = path.join(__dirname, 'renderer', 'data', 'hypaCsvCache.json');
      const cacheData = { 
        data, 
        headers, 
        timestamp: new Date().toISOString(),
        filename: req.file.originalname
      };
      
      // Ensure the data directory exists
      const dataDir = path.dirname(cachePath);
      if (!fsSync.existsSync(dataDir)) {
        fsSync.mkdirSync(dataDir, { recursive: true });
      }

      await fs.writeFile(cachePath, JSON.stringify(cacheData, null, 2));

      console.log('[import-hypa-csv] Import successful:', data.length, 'rows saved to cache');
      res.json({ 
        success: true, 
        message: 'Hypa CSV imported successfully',
        rows: data.length,
        headers: headers
      });
    } catch (error) {
      console.error('Error importing Hypa CSV:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // API route to save configurations
  app.post('/api/configurations', async (req, res) => {
    try {
      let configurations = req.body;
      if (Array.isArray(configurations)) {
        configurations = { configurations };
      } else if (configurations.configurations) {
        configurations = { configurations: configurations.configurations };
      } else {
        configurations = { configurations: [] };
      }
      const configPath = path.join(__dirname, 'renderer', 'data', 'configurations.json');
      // Ensure the data directory exists
      const dataDir = path.dirname(configPath);
      if (!fsSync.existsSync(dataDir)) {
        fsSync.mkdirSync(dataDir, { recursive: true });
      }
      await fs.writeFile(configPath, JSON.stringify(configurations, null, 2));
      res.json({ success: true, message: 'Configurations saved successfully' });
    } catch (error) {
      console.error('Error saving configurations:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // API routes
  const logToFile = (message) => {
    const logPath = path.join(__dirname, 'debug-log.txt');
    const timestamp = new Date().toISOString();
    fsSync.appendFileSync(logPath, `[${timestamp}] ${message}\n`);
  };

  app.post('/api/save-card', upload.single('image'), async (req, res) => {
    try {
      logToFile('*** /api/save-card endpoint was called ***');
      const cardData = JSON.parse(req.body.cardData);
      const imageBuffer = req.file ? req.file.buffer : null;

      logToFile(`[API/save-card] Received cardData: ${JSON.stringify(cardData)}`);
      if (imageBuffer) {
        const thumbnail = await sharp(imageBuffer)
          .resize(300, 200, { fit: 'cover' })
          .jpeg({ quality: 80 })
          .toBuffer();
        cardData.thumbnail = thumbnail.toString('base64');
      }

      const cardsDir = path.join(__dirname, 'renderer', 'cards');
      if (!fsSync.existsSync(cardsDir)) {
        fsSync.mkdirSync(cardsDir, { recursive: true });
      }

      let filename = cardData.filename;
      logToFile(`[API/save-card] Received filename: "${filename}"`);
      logToFile(`[API/save-card] Received originalFilename: "${cardData.originalFilename}"`);
      logToFile(`[API/save-card] Received id: "${cardData.id}"`);
      
      // If editing and originalFilename is present and different, delete the old file
      if (cardData.originalFilename && cardData.originalFilename !== filename) {
        const oldFilepath = path.join(cardsDir, cardData.originalFilename);
        if (fsSync.existsSync(oldFilepath)) {
          fsSync.unlinkSync(oldFilepath);
          logToFile(`[API/save-card] Deleted old card file: ${oldFilepath}`);
        }
      }
      
      // Check if this is an edit operation (has originalFilename or editingCardId)
      const isEditOperation = cardData.originalFilename || cardData.editingCardId;
      
      if (!filename && !isEditOperation) {
        // New card: generate filename and id
        const brand = cardData.configuration?.brand || 'unknown';
        const model = cardData.configuration?.model || 'unknown';
        const title = cardData.title || 'untitled';
        
        // Generate unique ID with timestamp + random suffix
        const timestamp = Date.now();
        const randomSuffix = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
        const uniqueId = `${timestamp}${randomSuffix}`;
        
        filename = `card_${brand}_${model}_${title}_${uniqueId}.json`;
        cardData.filename = filename;
        cardData.id = uniqueId;
        logToFile(`[API/save-card] No filename provided, creating new file: ${filename} with ID: ${uniqueId}`);
      } else if (isEditOperation && !filename) {
        // Edit operation but no filename - use originalFilename
        filename = cardData.originalFilename;
        cardData.filename = filename;
        logToFile(`[API/save-card] Edit operation with no filename, using originalFilename: ${filename}`);
      } else {
        // Editing existing card
        logToFile(`[API/save-card] Editing existing card, will overwrite file: ${filename}`);
      }
      // If editing, preserve the id
      if (!cardData.id) {
        // Generate unique ID with timestamp + random suffix
        const timestamp = Date.now();
        const randomSuffix = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
        cardData.id = `${timestamp}${randomSuffix}`;
      }

      const filepath = path.join(cardsDir, filename);
      await fs.writeFile(filepath, JSON.stringify(cardData, null, 2));
      logToFile(`[API/save-card] Card saved to: ${filepath}`);

      res.json({ success: true, card: cardData });
    } catch (error) {
      logToFile(`[API/save-card] Error: ${error.message}`);
      console.error('Error saving card:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/load-cards', async (req, res) => {
    try {
      const cardsDir = path.join(__dirname, 'renderer', 'cards');
      if (!fsSync.existsSync(cardsDir)) {
        return res.json([]);
      }

      const files = await fs.readdir(cardsDir);
      const jsonFiles = files.filter(file => file.endsWith('.json'));
      const cards = await Promise.all(jsonFiles.map(async file => {
        const content = await fs.readFile(path.join(cardsDir, file), 'utf8');
        return JSON.parse(content);
      }));

      res.json(cards);
    } catch (error) {
      console.error('Error loading cards:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.delete('/api/delete-card/:filename', (req, res) => {
    try {
      const filename = req.params.filename;
      const filepath = path.join(__dirname, 'renderer', 'cards', filename);
      
      if (fsSync.existsSync(filepath)) {
        fsSync.unlinkSync(filepath);
        res.json({ success: true });
      } else {
        res.status(404).json({ error: 'Card not found' });
      }
    } catch (error) {
      console.error('Error deleting card:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // API route to proxy external images for preview
  app.get('/api/image-proxy', async (req, res) => {
    const imageUrl = req.query.url;
    if (!imageUrl) {
      return res.status(400).json({ error: 'Missing url parameter' });
    }
    try {
      const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
      const response = await fetch(imageUrl);
      if (!response.ok) {
        return res.status(404).json({ error: 'Image not found' });
      }
      res.set('Content-Type', response.headers.get('content-type') || 'image/jpeg');
      response.body.pipe(res);
    } catch (error) {
      console.error('Error proxying image:', error);
      res.status(500).json({ error: 'Failed to fetch image' });
    }
  });

  // Delete all cards endpoint
  app.delete('/api/delete-all-cards', async (req, res) => {
    try {
      const cardsDir = path.join(__dirname, 'renderer', 'cards');
      if (fsSync.existsSync(cardsDir)) {
        const files = await fs.readdir(cardsDir);
        await Promise.all(files.map(async file => {
          if (file.endsWith('.json')) {
            await fs.unlink(path.join(cardsDir, file));
          }
        }));
      }
      
      // Clear import cache when all cards are deleted
      const hypaCachePath = path.join(__dirname, 'renderer', 'data', 'hypaCsvCache.json');
      if (fsSync.existsSync(hypaCachePath)) {
        await fs.unlink(hypaCachePath);
        console.log('[delete-all-cards] Deleted hypaCsvCache.json');
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting all cards:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Clear import cache endpoint
  app.post('/api/clear-import-cache', async (req, res) => {
    try {
      // Delete hypaCsvCache.json if it exists
      const hypaCachePath = path.join(__dirname, 'renderer', 'data', 'hypaCsvCache.json');
      if (fsSync.existsSync(hypaCachePath)) {
        await fs.unlink(hypaCachePath);
        console.log('[clear-import-cache] Deleted hypaCsvCache.json');
      }
      
      // Clear Electron app cache and storage
      if (mainWindow && mainWindow.webContents) {
        await mainWindow.webContents.session.clearCache();
        await mainWindow.webContents.session.clearStorageData();
        console.log('[clear-import-cache] Cleared Electron cache and storage');
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error('Error clearing import cache:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Delete all data endpoint
  app.delete('/api/delete-all-data', async (req, res) => {
    try {
      // Delete cards
      const cardsDir = path.join(__dirname, 'renderer', 'cards');
      if (fsSync.existsSync(cardsDir)) {
        const files = await fs.readdir(cardsDir);
        await Promise.all(files.map(async file => {
          await fs.unlink(path.join(cardsDir, file));
        }));
      }
      // Delete configurations
      const configPath = path.join(__dirname, 'renderer', 'data', 'configurations.json');
      if (fsSync.existsSync(configPath)) {
        await fs.unlink(configPath);
      }
      // Delete images
      const imagesDir = path.join(__dirname, 'renderer', 'images');
      if (fsSync.existsSync(imagesDir)) {
        await fs.rm(imagesDir, { recursive: true, force: true });
      }
      // Delete thumbnail cache
      const thumbDir = path.join(__dirname, 'renderer', 'thumbnail-cache');
      if (fsSync.existsSync(thumbDir)) {
        await fs.rm(thumbDir, { recursive: true, force: true });
      }
      // Delete import cache
      const hypaCachePath = path.join(__dirname, 'renderer', 'data', 'hypaCsvCache.json');
      if (fsSync.existsSync(hypaCachePath)) {
        await fs.unlink(hypaCachePath);
        console.log('[delete-all-data] Deleted hypaCsvCache.json');
      }
      // Clear Electron app cache and storage
      if (mainWindow && mainWindow.webContents) {
        await mainWindow.webContents.session.clearCache();
        await mainWindow.webContents.session.clearStorageData();
      }
      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting all data:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // WebDAV test connection route
  app.post('/test-webdav', async (req, res) => {
    try {
      const { url, username, password, path: webdavPath } = req.body;
      
      console.log('Testing WebDAV connection with Digest Auth', {
        url,
        username,
        path: webdavPath,
        debugLogEnabled
      });

      const client = new DigestAuthClient(url, username, password, debugLogEnabled);
      const contents = await client.getDirectoryContents(webdavPath || '/');
      
      console.log('WebDAV connection successful', {
        files: contents.files.length,
        folders: contents.folders.length
      });

      res.json({ 
        success: true, 
        items: contents.files.length + contents.folders.length,
        files: contents.files.length,
        folders: contents.folders.length
      });
    } catch (error) {
      console.error('WebDAV connection failed', {
        error: error.message,
        stack: error.stack
      });
      res.json({ success: false, error: error.message });
    }
  });

  // WebDAV list directory route
  app.get('/webdav-list', async (req, res) => {
    try {
      const { path: webdavPath } = req.query;
      
      console.log('WebDAV list request received', {
        path: webdavPath,
        timestamp: new Date().toISOString()
      });
      
      // Read WebDAV settings from settings.json
      const settingsPath = path.join(__dirname, 'renderer', 'settings.json');
      const settingsData = await fs.readFile(settingsPath, 'utf8');
      const settings = JSON.parse(settingsData);
      
      if (!settings.webdav || !settings.webdav.enabled) {
        console.error('WebDAV is not enabled in settings');
        return res.status(400).json({ error: 'WebDAV is not enabled in settings.' });
      }
      
      const { url, username, password } = settings.webdav;
      
      console.log('Listing WebDAV directory', {
        url,
        path: webdavPath,
        username,
        debugLogEnabled
      });

      const client = new DigestAuthClient(url, username, password, debugLogEnabled);
      const contents = await client.getDirectoryContents(webdavPath || '/dav');
      
      console.log('WebDAV directory listing successful', {
        files: contents.files.length,
        folders: contents.folders.length,
        timestamp: new Date().toISOString()
      });

      res.json(contents);
    } catch (error) {
      console.error('WebDAV directory listing failed', {
        error: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString()
      });
      res.status(500).json({ error: error.message });
    }
  });

  // WebDAV delete files/folders route
  app.post('/webdav-delete', async (req, res) => {
    try {
      const { items } = req.body;
      if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: 'No items specified for deletion.' });
      }

      // Read WebDAV settings from settings.json
      const settingsPath = path.join(__dirname, 'renderer', 'settings.json');
      const settingsData = await fs.readFile(settingsPath, 'utf8');
      const settings = JSON.parse(settingsData);
      
      if (!settings.webdav || !settings.webdav.enabled) {
        return res.status(400).json({ error: 'WebDAV is not enabled in settings.' });
      }
      
      const { url, username, password } = settings.webdav;
      let deletedCount = 0;
      const errors = [];

      const client = new DigestAuthClient(url, username, password, debugLogEnabled);

      for (const item of items) {
        try {
          await client.deleteItem(item.path);
          deletedCount++;
        } catch (error) {
          console.error(`Failed to delete ${item.path}:`, error);
          errors.push({ path: item.path, error: error.message });
        }
      }

      res.json({ 
        deletedCount, 
        errorCount: errors.length,
        errors: errors
      });

    } catch (error) {
      console.error('Error deleting WebDAV items:', error);
      res.status(500).json({ error: `Failed to delete items: ${error.message}` });
    }
  });

  // WebDAV create folder route
  app.post('/webdav-mkdir', async (req, res) => {
    try {
      const { path: folderPath } = req.body;
      console.log('Creating folder:', folderPath);
      
      if (!folderPath) {
        return res.status(400).json({ error: 'No folder path provided' });
      }

      // Read WebDAV settings from settings.json
      const settingsPath = path.join(__dirname, 'renderer', 'settings.json');
      const settingsData = await fs.readFile(settingsPath, 'utf8');
      const settings = JSON.parse(settingsData);
      
      if (!settings.webdav || !settings.webdav.enabled) {
        return res.status(400).json({ error: 'WebDAV is not enabled in settings.' });
      }
      
      const { url, username, password } = settings.webdav;

      const client = new DigestAuthClient(url, username, password, debugLogEnabled);
      await client.createDirectory(folderPath);
      
      res.json({ success: true, message: 'Folder created successfully' });

    } catch (error) {
      console.error('Error creating WebDAV folder:', error);
      res.status(500).json({ error: `Failed to create folder: ${error.message}` });
    }
  });

  // WebDAV move/rename route
  app.post('/webdav-move', async (req, res) => {
    try {
      const { sourcePath, destinationPath } = req.body;
      
      if (!sourcePath || !destinationPath) {
        return res.status(400).json({ error: 'Source and destination paths are required' });
      }

      // Read WebDAV settings from settings.json
      const settingsPath = path.join(__dirname, 'renderer', 'settings.json');
      const settingsData = await fs.readFile(settingsPath, 'utf8');
      const settings = JSON.parse(settingsData);
      
      if (!settings.webdav || !settings.webdav.enabled) {
        return res.status(400).json({ error: 'WebDAV is not enabled in settings.' });
      }
      
      const { url, username, password } = settings.webdav;

      const client = new DigestAuthClient(url, username, password, debugLogEnabled);
      await client.moveItem(sourcePath, destinationPath);
      
      res.json({ success: true, message: 'Item moved successfully' });

    } catch (error) {
      console.error('Error moving WebDAV item:', error);
      res.status(500).json({ error: `Failed to move item: ${error.message}` });
    }
  });

  // WebDAV thumbnail route
  app.get('/webdav-thumbnail', async (req, res) => {
    try {
      const { path: imagePath } = req.query;
      
      if (!imagePath) {
        return res.status(400).json({ error: 'Image path is required' });
      }

      // Read WebDAV settings from settings.json
      const settingsPath = path.join(__dirname, 'renderer', 'settings.json');
      const settingsData = await fs.readFile(settingsPath, 'utf8');
      const settings = JSON.parse(settingsData);
      
      if (!settings.webdav || !settings.webdav.enabled) {
        return res.status(400).json({ error: 'WebDAV is not enabled in settings.' });
      }
      
      const { url, username, password } = settings.webdav;

      const client = new DigestAuthClient(url, username, password, debugLogEnabled);
      const imageData = await client.getFile(imagePath);
      
      // Determine content type based on file extension
      const ext = path.extname(imagePath).toLowerCase();
      let contentType = 'image/jpeg'; // default
      if (ext === '.png') contentType = 'image/png';
      else if (ext === '.gif') contentType = 'image/gif';
      else if (ext === '.bmp') contentType = 'image/bmp';
      else if (ext === '.webp') contentType = 'image/webp';
      
      // Set appropriate headers for image
      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'public, max-age=3600');
      res.setHeader('Content-Length', imageData.length);
      res.send(imageData); // imageData is already a Buffer

    } catch (error) {
      console.error('Error getting WebDAV thumbnail:', error);
      res.status(500).json({ error: `Failed to get thumbnail: ${error.message}` });
    }
  });

  // WebDAV image info route
  app.get('/webdav-image-info', async (req, res) => {
    try {
      const { path: imagePath } = req.query;
      
      if (!imagePath) {
        return res.status(400).json({ error: 'Image path is required' });
      }

      // Read WebDAV settings from settings.json
      const settingsPath = path.join(__dirname, 'renderer', 'settings.json');
      const settingsData = await fs.readFile(settingsPath, 'utf8');
      const settings = JSON.parse(settingsData);
      
      if (!settings.webdav || !settings.webdav.enabled) {
        return res.status(400).json({ error: 'WebDAV is not enabled in settings.' });
      }
      
      const { url, username, password } = settings.webdav;

      const client = new DigestAuthClient(url, username, password, debugLogEnabled);
      const imageData = await client.getFile(imagePath);
      
      // Get image dimensions using a simple approach
      // For a more robust solution, you might want to use a library like 'sharp'
      const imageInfo = {
        size: imageData.length,
        sizeFormatted: formatFileSize(imageData.length)
      };

      res.json(imageInfo);

    } catch (error) {
      console.error('Error getting WebDAV image info:', error);
      res.status(500).json({ error: `Failed to get image info: ${error.message}` });
    }
  });

  // WebDAV bulk thumbnails route
  app.post('/webdav-bulk-thumbnails', async (req, res) => {
    try {
      const { paths } = req.body;
      
      if (!Array.isArray(paths) || paths.length === 0) {
        return res.status(400).json({ error: 'No image paths provided' });
      }

      // Read WebDAV settings from settings.json
      const settingsPath = path.join(__dirname, 'renderer', 'settings.json');
      const settingsData = await fs.readFile(settingsPath, 'utf8');
      const settings = JSON.parse(settingsData);
      
      if (!settings.webdav || !settings.webdav.enabled) {
        return res.status(400).json({ error: 'WebDAV is not enabled in settings.' });
      }
      
      const { url, username, password } = settings.webdav;

      const client = new DigestAuthClient(url, username, password, debugLogEnabled);
      const results = [];
      let successCount = 0;

      for (const imagePath of paths) {
        try {
          const imageData = await client.getFile(imagePath);
          results.push({
            path: imagePath,
            success: true,
            size: imageData.length,
            sizeFormatted: formatFileSize(imageData.length)
          });
          successCount++;
        } catch (error) {
          results.push({
            path: imagePath,
            success: false,
            error: error.message
          });
        }
      }

      res.json({ 
        results,
        successCount,
        totalCount: paths.length,
        errorCount: paths.length - successCount
      });

    } catch (error) {
      console.error('Error getting WebDAV bulk thumbnails:', error);
      res.status(500).json({ error: `Failed to get bulk thumbnails: ${error.message}` });
    }
  });

  // Bulk upload images to WebDAV
  app.post('/api/bulk-upload-image', async (req, res) => {
    try {
      let cards = req.body.cards || req.body;
      let singleObject = false;
      // If it's not an array, treat as a single card object
      if (!Array.isArray(cards)) {
        cards = [cards];
        singleObject = true;
      }
      if (!Array.isArray(cards) || cards.length === 0) {
        console.log('[bulk-upload] No cards/images provided:', req.body);
        return res.status(400).json({ error: 'No cards/images provided.' });
      }

      // Read WebDAV settings from settings.json
      const settingsPath = path.join(__dirname, 'renderer', 'settings.json');
      const settingsData = await fs.readFile(settingsPath, 'utf8');
      const settings = JSON.parse(settingsData);
      if (!settings.webdav || !settings.webdav.enabled) {
        console.log('[bulk-upload] WebDAV not enabled in settings:', settings.webdav);
        return res.status(400).json({ error: 'WebDAV is not enabled in settings.' });
      }
      const { url, username, password } = settings.webdav;
      const client = new DigestAuthClient(url, username, password, debugLogEnabled);

      const results = [];
      for (const card of cards) {
        try {
          console.log('[bulk-upload] Processing card:', {
            cardId: card.cardId,
            imageUrl: card.imageUrl,
            filename: card.filename || card.imageName,
            webdavPath: card.webdavPath,
            configuration: card.configuration
          });
          
          let imageBuffer = null;
          let imageName = card.imageName || card.filename || 'image.jpg';
          if (card.imageUrl) {
            console.log('[bulk-upload] Processing image from:', card.imageUrl);
            
            // Handle local files vs external URLs
            if (card.imageUrl.startsWith('http')) {
              // External URL - use fetch
              const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
              const response = await fetch(card.imageUrl);
              if (!response.ok) throw new Error('Failed to download image');
              imageBuffer = await response.buffer();
              // Try to get filename from URL if not provided
              if (!imageName && response.url) {
                imageName = response.url.split('/').pop();
              }
              console.log(`[bulk-upload] Downloaded external image, bytes: ${imageBuffer.length}`);
            } else {
              // Local file - read directly from filesystem
              const localPath = path.join(__dirname, card.imageUrl);
              console.log('[bulk-upload] Reading local file from:', localPath);
              imageBuffer = await fs.readFile(localPath);
              // Try to get filename from path if not provided
              if (!imageName) {
                imageName = path.basename(card.imageUrl);
              }
              console.log(`[bulk-upload] Read local image, bytes: ${imageBuffer.length}`);
            }
          } else if (card.imageData) {
            // If imageData (base64) is provided
            imageBuffer = Buffer.from(card.imageData, 'base64');
            console.log(`[bulk-upload] Using provided imageData, bytes: ${imageBuffer.length}`);
          } else {
            throw new Error('No imageUrl or imageData provided');
          }

          // --- Add metadata if JPEG ---
          let finalBuffer = imageBuffer;
          let meta = null;
          if (imageName.toLowerCase().endsWith('.jpg') || imageName.toLowerCase().endsWith('.jpeg')) {
            const tmpPath = path.join(os.tmpdir(), `upload_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.jpg`);
            
            // Get card configuration data from request body
            const config = card.configuration || {};
            const variants = config.variants || [];
            
            // Extract variant names from the variants array
            const variantNames = Array.isArray(variants) 
              ? variants.map(v => v.name || v).join(', ')
              : (variants || '');
            
            meta = {
              Model: config.model || '',
              Generation: config.generation || '',
              Variants: variantNames,
              Dimensions: card.dimensions || '',
              DateCreated: new Date().toISOString(),
              DateUploaded: new Date().toISOString(),
              // Add standard EXIF/IPTC fields that are more likely to be preserved
              ImageDescription: `${config.model || ''} ${config.generation || ''} - ${variantNames}`,
              UserComment: `Generation: ${config.generation || ''}, Variants: ${variantNames}`,
              Copyright: 'E-Bike Barn',
              Software: 'card-creator-desktop'
            };
            
            // Remove empty fields
            Object.keys(meta).forEach(k => { if (!meta[k]) delete meta[k]; });
            console.log('[bulk-upload] Writing metadata for image:', imageName, meta);
            try {
              await fs.writeFile(tmpPath, imageBuffer);
              await exiftool.write(tmpPath, meta);
              finalBuffer = await fs.readFile(tmpPath);
              console.log('[bulk-upload] Metadata written successfully, buffer size:', finalBuffer.length);
            } catch (metadataError) {
              console.warn('[bulk-upload] Failed to write metadata, uploading original image:', metadataError.message);
              meta = null; // Don't include metadata in response if writing failed
            } finally {
              try { 
                if (await fs.access(tmpPath).then(() => true).catch(() => false)) {
                  await fs.unlink(tmpPath); 
                }
              } catch (e) {
                console.warn('[bulk-upload] Failed to cleanup temp file:', e.message);
              }
            }
          }

          // Determine WebDAV destination path
          let webdavPath = card.webdavPath;
          if (!webdavPath) {
            // Fallback: use /dav/product_images/ + imageName
            webdavPath = `/dav/product_images/${imageName}`;
          }
          // If webdavPath ends with '/', append the imageName to make it a file path
          if (webdavPath.endsWith('/')) {
            webdavPath = webdavPath + imageName;
          }
          console.log(`[bulk-upload] Uploading to WebDAV path: ${webdavPath}, buffer size: ${finalBuffer.length}`);

          // Ensure the directory structure exists before uploading
          const pathParts = webdavPath.split('/').filter(Boolean);
          if (pathParts.length > 2) { // Skip 'dav' and 'product_images'
            let currentPath = '';
            for (let i = 0; i < pathParts.length - 1; i++) { // Don't create directory for the filename
              currentPath += '/' + pathParts[i];
              if (i >= 1) { // Start creating directories after 'dav'
                try {
                  console.log(`[bulk-upload] Creating directory: ${currentPath}`);
                  await client.createDirectory(currentPath);
                  console.log(`[bulk-upload] Directory created successfully: ${currentPath}`);
                } catch (dirErr) {
                  // Directory might already exist, continue
                  console.log(`[bulk-upload] Directory creation result for ${currentPath}:`, dirErr.message);
                }
              }
            }
          }

          // Upload to WebDAV
          let uploadResult = null;
          try {
            uploadResult = await client.uploadFile(webdavPath, finalBuffer);
            console.log('[bulk-upload] UploadFile result:', uploadResult);
          } catch (uploadErr) {
            console.error('[bulk-upload] uploadFile threw error:', uploadErr && uploadErr.stack ? uploadErr.stack : uploadErr);
            throw uploadErr;
          }
          console.log('[bulk-upload] Upload successful:', webdavPath);

          results.push({
            cardId: card.id,
            webdavPath,
            success: true,
            uploadResult,
            metadata: meta
          });
        } catch (err) {
          console.error('[bulk-upload] Upload failed for card:', card, err && err.stack ? err.stack : err);
          results.push({
            cardId: card.id,
            error: err.message,
            stack: err && err.stack ? err.stack : undefined,
            success: false
          });
        }
      }
      // If only one card was sent, return a single result object for compatibility
      if (singleObject) {
        res.json(results[0]);
      } else {
        res.json({ results });
      }
    } catch (error) {
      console.error('Bulk upload error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get image metadata from WebDAV
  app.get('/api/get-image-metadata', async (req, res) => {
    try {
      const { path: imagePath } = req.query;
      if (!imagePath) {
        return res.status(400).json({ error: 'Missing image path' });
      }
      
      console.log('[get-image-metadata] Requested path:', imagePath);
      
      // Read WebDAV settings
      const settingsPath = path.join(__dirname, 'renderer', 'settings.json');
      const settingsData = await fs.readFile(settingsPath, 'utf8');
      const settings = JSON.parse(settingsData);
      if (!settings.webdav || !settings.webdav.enabled) {
        return res.status(400).json({ error: 'WebDAV is not enabled in settings.' });
      }
      
      const { url, username, password } = settings.webdav;
      const client = new DigestAuthClient(url, username, password, debugLogEnabled);
      
      // Download image from WebDAV
      console.log('[get-image-metadata] Downloading image from WebDAV...');
      const imageBuffer = await client.getFile(imagePath);
      console.log('[get-image-metadata] Downloaded image, size:', imageBuffer.length);
      
      // Write to temp file with a more reliable approach
      const tmpPath = path.join(os.tmpdir(), `metadata_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.jpg`);
      console.log('[get-image-metadata] Writing to temp file:', tmpPath);
      
      try {
        await fs.writeFile(tmpPath, imageBuffer);
        console.log('[get-image-metadata] Temp file written successfully');
        
        // Verify file exists before reading metadata
        const fileExists = await fs.access(tmpPath).then(() => true).catch(() => false);
        if (!fileExists) {
          throw new Error('Temp file was not created successfully');
        }
        
        console.log('[get-image-metadata] Reading metadata with exiftool...');
        const metadata = await exiftool.read(tmpPath);
        console.log('[get-image-metadata] Metadata read successfully:', metadata);
        
        res.json({ metadata });
      } finally {
        // Clean up temp file after exiftool is done
        try {
          const fileExists = await fs.access(tmpPath).then(() => true).catch(() => false);
          if (fileExists) {
            await fs.unlink(tmpPath);
            console.log('[get-image-metadata] Temp file cleaned up');
          }
        } catch (cleanupError) {
          console.warn('[get-image-metadata] Failed to cleanup temp file:', cleanupError.message);
        }
      }
    } catch (error) {
      console.error('[get-image-metadata] Error getting image metadata:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Save updated card data
  app.post('/api/save-cards', async (req, res) => {
    try {
      const { cards } = req.body;
      if (!cards || !Array.isArray(cards)) {
        return res.status(400).json({ error: 'Invalid cards data' });
      }
      
      console.log('[save-cards] Saving updated cards data, count:', cards.length);
      
      // Save each card to its individual file in the cards directory
      const cardsDir = path.join(__dirname, 'renderer', 'cards');
      
      // Ensure cards directory exists
      if (!fsSync.existsSync(cardsDir)) {
        await fs.mkdir(cardsDir, { recursive: true });
      }
      
      // Save each card to its individual file
      await Promise.all(cards.map(async (card, index) => {
        let filename = card.filename;
        
        // Generate filename if not present
        if (!filename) {
          const timestamp = Date.now();
          const randomId = Math.random().toString(36).substr(2, 9);
          const sku = card.sku || 'unknown';
          const cardType = card.cardType || 'card';
          const position = card.position || 1;
          filename = `card_${sku}_${cardType}_${position}_${timestamp}_${randomId}.json`;
          
          // Update the card with the generated filename
          card.filename = filename;
        }
        
        const cardPath = path.join(cardsDir, filename);
        await fs.writeFile(cardPath, JSON.stringify(card, null, 2));
        console.log(`[save-cards] Saved card to: ${filename}`);
      }));
      
      console.log('[save-cards] Cards data saved successfully');
      res.json({ success: true, message: 'Cards saved successfully' });
    } catch (error) {
      console.error('[save-cards] Error saving cards:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Load configurations endpoint
  app.get('/api/load-configurations', async (req, res) => {
    try {
      const configPath = path.join(__dirname, 'renderer', 'data', 'configurations.json');
      if (!fsSync.existsSync(configPath)) {
        return res.json([]);
      }

      const configData = await fs.readFile(configPath, 'utf8');
      const configFile = JSON.parse(configData);
      // Return the configurations array from the nested structure
      const configurations = configFile.configurations || [];
      res.json(configurations);
    } catch (error) {
      console.error('Error loading configurations:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Restore a deleted card (for undo)
  app.post('/api/restore-card', async (req, res) => {
    try {
      const card = req.body;
      if (!card || !card.filename) {
        return res.status(400).json({ error: 'Missing card or filename.' });
      }
      const filepath = path.join(__dirname, 'renderer', 'cards', card.filename);
      await fs.writeFile(filepath, JSON.stringify(card, null, 2));
      res.json({ success: true });
    } catch (error) {
      console.error('Error restoring card:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // List all templates for a card type
  app.get('/api/templates/:cardType', async (req, res) => {
    try {
      const templates = await templateManager.listTemplates(req.params.cardType);
      res.json({ templates });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Get the content of a template
  app.get('/api/template/:cardType', async (req, res) => {
    try {
      const { path: templatePath } = req.query;
      if (!templatePath) return res.status(400).json({ error: 'Missing template path' });
      
      let templateName;
      if (templatePath.includes('reference-templates')) {
        templateName = 'reference';
      } else if (templatePath.includes('master')) {
        templateName = 'master';
      } else {
        templateName = templatePath.split('/').pop().replace(`${req.params.cardType}-`, '').replace('.html', '');
      }
      
      const content = await templateManager.getTemplateContent(req.params.cardType, templateName);
      res.json({ content });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Save a new custom template
  app.post('/api/template/:cardType', async (req, res) => {
    try {
      const { name, content } = req.body;
      const result = await templateManager.saveCustomTemplate(req.params.cardType, name, content);
      res.json({ 
        success: true, 
        exists: result.exists,
        willOverwrite: result.willOverwrite,
        filePath: result.filePath
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Write template file after confirmation
  app.post('/api/template/:cardType/write', async (req, res) => {
    try {
      const { filePath, content } = req.body;
      await templateManager.writeTemplateFile(filePath, content);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Set the active template for a card type
  app.post('/api/template/:cardType/activate', async (req, res) => {
    try {
      const { templatePath } = req.body;
      await templateManager.setActiveTemplate(req.params.cardType, templatePath);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Get the active template path for a card type
  app.get('/api/template/:cardType/active', async (req, res) => {
    try {
      const templatePath = await templateManager.getActiveTemplatePath(req.params.cardType);
      res.json({ templatePath });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Get processed template with card data
  app.post('/api/template/:cardType/process', async (req, res) => {
    try {
      const { templateName, cardData } = req.body;
      const processedTemplate = await templateManager.getProcessedTemplate(req.params.cardType, templateName, cardData);
      res.json({ processedTemplate });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Serve reference templates with real data
  app.get('/reference-templates/:filename', async (req, res) => {
    try {
      const filename = req.params.filename;
      const filePath = path.join(__dirname, 'renderer', 'reference-templates', filename);
      
      if (!fsSync.existsSync(filePath)) {
        return res.status(404).json({ error: 'Reference template not found' });
      }
      
      const content = await fs.readFile(filePath, 'utf8');
      res.type('text/html').send(content);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Helper function to format file size
  function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  server = app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
  });
}

// App event handlers
app.whenReady().then(async () => {
  startServer();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  if (server) {
    server.close();
  }
});

// IPC handlers for file dialogs
ipcMain.handle('select-folder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory']
  });
  return result.filePaths[0];
});

ipcMain.handle('select-file', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [
      { name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'gif', 'bmp'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  });
  return result.filePaths[0];
});

// IPC handlers
ipcMain.handle('clear-cache', async () => {
  try {
    if (mainWindow && mainWindow.webContents) {
      await mainWindow.webContents.session.clearCache();
      await mainWindow.webContents.session.clearStorageData();
      return { success: true };
    }
    return { success: false, error: 'Window not available' };
  } catch (error) {
    console.error('Error clearing cache:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('set-debug-log-enabled', (event, enabled) => {
  debugLogEnabled = !!enabled;
  if (!debugLogEnabled && fsSync.existsSync(debugLogPath)) {
    fsSync.unlinkSync(debugLogPath); // Optionally clear log when disabled
  }
});

ipcMain.handle('log-debug-info', (event, info) => {
  if (!debugLogEnabled) return;
  console.log('Writing to debug log:', info);
  const logEntry = `[${info.timestamp}] [${info.page}] ${info.message}\n${JSON.stringify(info.data, null, 2)}\n\n`;
  fsSync.appendFileSync(debugLogPath, logEntry, 'utf8');
}); 

ipcMain.handle('save-image-to-disk', async (event, { imageData, extension }) => {
  try {
    const imagesDir = path.join(__dirname, 'renderer', 'cards', 'images');
    if (!fsSync.existsSync(imagesDir)) {
      fsSync.mkdirSync(imagesDir, { recursive: true });
    }
    // Generate a unique filename
    const filename = `img_${Date.now()}_${Math.random().toString(36).substr(2, 6)}.${extension || 'png'}`;
    const filePath = path.join(imagesDir, filename);

    let buffer;
    if (imageData.startsWith('data:')) {
      // Handle base64 data URL
      const base64Data = imageData.split(',')[1];
      buffer = Buffer.from(base64Data, 'base64');
    } else if (/^https?:\/\//.test(imageData)) {
      // Handle image URL
      const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
      const response = await fetch(imageData);
      if (!response.ok) throw new Error('Failed to fetch image from URL');
      buffer = Buffer.from(await response.arrayBuffer());
    } else {
      throw new Error('Unsupported image data format');
    }

    await fs.writeFile(filePath, buffer);
    return { success: true, filePath };
  } catch (error) {
    console.error('Error in save-image-to-disk:', error);
    return { success: false, error: error.message };
  }
}); 

ipcMain.handle('read-template-file', async (event, filePath) => {
  return await fs.readFile(filePath, 'utf8');
});
ipcMain.handle('write-template-file', async (event, { filePath, content }) => {
  await fs.writeFile(filePath, content, 'utf8');
  return true;
});
ipcMain.handle('list-template-files', async (event, directory) => {
  const files = await fs.readdir(directory);
  return files.filter(f => f.endsWith('.html'));
}); 