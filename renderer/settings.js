// Settings Page JavaScript
document.addEventListener('DOMContentLoaded', function() {
    // Initialize settings page
    initializeSettings();
    
    // Load saved settings
    loadSettings();
    
    // Add event listeners
    addEventListeners();
    
    // Check initial connection status
    checkConnectionStatus();
    
    // Setup debug log toggle
    setupDebugLogToggle();
});

// Initialize settings page
function initializeSettings() {
    console.log('Settings page initialized');
}

// Add event listeners
function addEventListeners() {
    // Test connection button
    const testConnectionBtn = document.getElementById('testConnectionBtn');
    if (testConnectionBtn) {
        testConnectionBtn.addEventListener('click', testConnection);
    }
    
    // Save settings button
    const saveSettingsBtn = document.getElementById('saveSettingsBtn');
    if (saveSettingsBtn) {
        saveSettingsBtn.addEventListener('click', saveSettings);
    }
    
    // Load BigCommerce defaults button
    const loadBigCommerceBtn = document.getElementById('loadBigCommerceBtn');
    if (loadBigCommerceBtn) {
        loadBigCommerceBtn.addEventListener('click', loadBigCommerceDefaults);
    }
    
    // Export config button
    const exportConfigBtn = document.getElementById('exportConfigBtn');
    if (exportConfigBtn) {
        exportConfigBtn.addEventListener('click', exportConfig);
    }
    
    // Upload CyberDuck file button
    const uploadCyberduckBtn = document.getElementById('uploadCyberduckBtn');
    if (uploadCyberduckBtn) {
        uploadCyberduckBtn.addEventListener('click', uploadCyberduckFile);
    }
    
    // Auto-save on form changes
    const formFields = ['enableWebdav', 'webdavUrl', 'webdavUsername', 'webdavPassword', 'webdavPath', 'webdavPort'];
    formFields.forEach(fieldId => {
        const element = document.getElementById(fieldId);
        if (element) {
            element.addEventListener('change', autoSaveSettings);
            element.addEventListener('input', autoSaveSettings);
        }
    });
}

// Load saved settings from localStorage
function loadSettings() {
    const saved = localStorage.getItem('webdavSettings');
    if (saved) {
        try {
            const settings = JSON.parse(saved);
            
            // Populate form fields
            document.getElementById('enableWebdav').checked = settings.enabled || false;
            document.getElementById('webdavUrl').value = settings.url || '';
            document.getElementById('webdavUsername').value = settings.username || '';
            document.getElementById('webdavPassword').value = settings.password || '';
            document.getElementById('webdavPath').value = settings.path || '/product_images';
            document.getElementById('webdavPort').value = settings.port || '443';
            
            console.log('Settings loaded from localStorage');
            logDebugInfo('Settings loaded from localStorage', settings);
        } catch (error) {
            console.error('Error loading settings:', error);
            showStatus('Error loading saved settings', 'danger');
            logDebugInfo('Error loading settings from localStorage', { error: error.message, stack: error.stack });
        }
    }
}

// Auto-save settings when form changes
function autoSaveSettings() {
    const settings = getFormSettings();
    localStorage.setItem('webdavSettings', JSON.stringify(settings));
    console.log('Settings auto-saved');
    logDebugInfo('Settings auto-saved', settings);
}

// Get current form settings
function getFormSettings() {
    return {
        enabled: document.getElementById('enableWebdav').checked,
        url: document.getElementById('webdavUrl').value,
        username: document.getElementById('webdavUsername').value,
        password: document.getElementById('webdavPassword').value,
        path: document.getElementById('webdavPath').value,
        port: document.getElementById('webdavPort').value
    };
}

// Save settings manually
function saveSettings() {
    const settings = getFormSettings();
    localStorage.setItem('webdavSettings', JSON.stringify(settings));
    showStatus('Settings saved successfully!', 'success');
    console.log('Settings saved:', settings);
    logDebugInfo('Settings saved', settings);
}

// Load BigCommerce defaults
function loadBigCommerceDefaults() {
    document.getElementById('webdavUrl').value = 'https://store-c8jhcan2jv.mybigcommerce.com/dav';
    document.getElementById('webdavUsername').value = 'harry@e-bikebarn.com';
    document.getElementById('webdavPath').value = '/product_images';
    document.getElementById('webdavPort').value = '443';
    document.getElementById('enableWebdav').checked = true;
    
    autoSaveSettings();
    showStatus('BigCommerce defaults loaded. Please enter your password.', 'info');
}

// Export configuration
function exportConfig() {
    const settings = getFormSettings();
    const config = {
        webdav: settings,
        exportedAt: new Date().toISOString(),
        version: '1.0'
    };
    
    const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'webdav-config.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    showStatus('Configuration exported successfully!', 'success');
    logDebugInfo('Configuration exported', config);
}

// Test WebDAV connection
async function testConnection() {
    const settings = getFormSettings();
    
    if (!settings.url || !settings.username || !settings.password) {
        showStatus('Please fill in URL, username, and password before testing.', 'warning');
        logDebugInfo('Test WebDAV connection - missing fields', { settings });
        return;
    }
    
    showStatus('Testing WebDAV connection...', 'info');
    let logData = { ...settings };
    try {
        const response = await fetch('/test-webdav', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                url: settings.url,
                username: settings.username,
                password: settings.password,
                path: settings.path
            })
        });
        
        const result = await response.json();
        logData.responseStatus = response.status;
        logData.responseBody = result;
        if (result.success) {
            showStatus(`Connection successful! Found ${result.items || 0} items in directory.`, 'success');
            logDebugInfo('Test WebDAV connection - success', logData);
        } else {
            showStatus(`Connection failed: ${result.error}`, 'danger');
            logDebugInfo('Test WebDAV connection - failure', { ...logData, error: result.error });
        }
    } catch (error) {
        showStatus(`Error testing connection: ${error.message}`, 'danger');
        logDebugInfo('Test WebDAV connection - exception', { ...logData, error: error.message, stack: error.stack });
    }
}

// Upload and parse CyberDuck file
function uploadCyberduckFile() {
    const fileInput = document.getElementById('cyberduckFile');
    const file = fileInput.files[0];
    
    if (!file) {
        showStatus('Please select a CyberDuck connection file (.duck)', 'warning');
        return;
    }
    
    if (!file.name.endsWith('.duck')) {
        showStatus('Please select a valid .duck file', 'warning');
        return;
    }
    
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const content = e.target.result;
            const config = parseCyberduckFile(content);
            
            if (config) {
                // Populate form with parsed data
                document.getElementById('webdavUrl').value = config.url || '';
                document.getElementById('webdavUsername').value = config.username || '';
                document.getElementById('webdavPath').value = config.path || '/content/images/cards';
                document.getElementById('webdavPort').value = config.port || '443';
                document.getElementById('enableWebdav').checked = true;
                
                autoSaveSettings();
                showStatus('CyberDuck configuration loaded successfully! Please enter your password.', 'success');
            } else {
                showStatus('Could not parse CyberDuck file. Please check the file format.', 'danger');
            }
        } catch (error) {
            showStatus(`Error parsing CyberDuck file: ${error.message}`, 'danger');
        }
    };
    
    reader.readAsText(file);
}

// Parse CyberDuck .duck file
function parseCyberduckFile(content) {
    try {
        // Parse the XML content
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(content, 'text/xml');
        
        // Extract configuration from XML
        const config = {};
        
        // Get protocol (should be davs for HTTPS)
        const protocol = findXmlElementByKey(xmlDoc, 'Protocol');
        if (protocol) {
            config.protocol = protocol.textContent;
        }
        
        // Get hostname
        const hostname = findXmlElementByKey(xmlDoc, 'Hostname');
        if (hostname) {
            config.hostname = hostname.textContent;
        }
        
        // Get port
        const port = findXmlElementByKey(xmlDoc, 'Port');
        if (port) {
            config.port = port.textContent;
        }
        
        // Get username
        const username = findXmlElementByKey(xmlDoc, 'Username');
        if (username) {
            config.username = username.textContent;
        }
        
        // Get path
        const path = findXmlElementByKey(xmlDoc, 'Path');
        if (path) {
            config.path = path.textContent;
        }
        
        // Build URL
        if (config.hostname) {
            const protocol = config.protocol === 'davs' ? 'https' : 'http';
            const port = config.port && config.port !== '443' ? `:${config.port}` : '';
            config.url = `${protocol}://${config.hostname}${port}${config.path || '/dav'}`;
        }
        
        return config;
    } catch (error) {
        console.error('Error parsing CyberDuck file:', error);
        return null;
    }
}

// Check connection status
function checkConnectionStatus() {
    const settings = getFormSettings();
    
    if (settings.enabled && settings.url && settings.username) {
        showStatus('WebDAV is configured. Click "Test Connection" to verify.', 'info');
    } else {
        showStatus('WebDAV is not configured. Please fill in the required fields.', 'warning');
    }
}

// Show status message
function showStatus(message, type) {
    const statusDiv = document.getElementById('connectionStatus');
    const statusText = document.getElementById('statusText');
    
    if (statusDiv && statusText) {
        statusDiv.className = `alert alert-${type} mb-4`;
        statusText.textContent = message;
        statusDiv.style.display = 'block';
        
        // Auto-hide success messages after 5 seconds
        if (type === 'success') {
            setTimeout(() => {
                statusDiv.style.display = 'none';
            }, 5000);
        }
    }
}

// Helper function to find XML elements by key content
function findXmlElementByKey(xmlDoc, keyName) {
    const keys = xmlDoc.getElementsByTagName('key');
    for (let key of keys) {
        if (key.textContent === keyName) {
            return key.nextElementSibling;
        }
    }
    return null;
}

// Debug Log Toggle logic
function setupDebugLogToggle() {
    const debugToggle = document.getElementById('debugLogToggle');
    const everythingToggle = document.getElementById('logEverythingToggle');
    if (debugToggle) {
        // Load state from localStorage
        const enabled = localStorage.getItem('debugLogEnabled') === 'true';
        debugToggle.checked = enabled;
        window.debugLogEnabled = enabled;
        debugToggle.addEventListener('change', function() {
            localStorage.setItem('debugLogEnabled', debugToggle.checked);
            window.debugLogEnabled = debugToggle.checked;
            if (window.electronAPI && window.electronAPI.setDebugLogEnabled) {
                window.electronAPI.setDebugLogEnabled(debugToggle.checked);
            }
        });
        // Notify main process on load
        if (window.electronAPI && window.electronAPI.setDebugLogEnabled) {
            window.electronAPI.setDebugLogEnabled(enabled);
        }
    }
    if (everythingToggle) {
        const everythingEnabled = localStorage.getItem('logEverythingEnabled') === 'true';
        everythingToggle.checked = everythingEnabled;
        window.logEverythingEnabled = everythingEnabled;
        everythingToggle.addEventListener('change', function() {
            localStorage.setItem('logEverythingEnabled', everythingToggle.checked);
            window.logEverythingEnabled = everythingToggle.checked;
        });
    }
}

// Helper to log debug info
function logDebugInfo(message, data) {
    if ((window.debugLogEnabled || window.logEverythingEnabled) && window.electronAPI && window.electronAPI.logDebugInfo) {
        console.log('Sending log to main process:', { message, data });
        window.electronAPI.logDebugInfo({
            message,
            data,
            timestamp: new Date().toISOString(),
            page: 'settings'
        });
    }
}

// Call setup on DOMContentLoaded
const origDOMContentLoaded = document.onreadystatechange;
document.onreadystatechange = function() {
    if (origDOMContentLoaded) origDOMContentLoaded();
    if (document.readyState === 'complete') {
        setupDebugLogToggle();
    }
}; 