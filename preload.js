const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  selectFile: () => ipcRenderer.invoke('select-file'),
  clearCache: () => ipcRenderer.invoke('clear-cache'),
  setDebugLogEnabled: (enabled) => ipcRenderer.invoke('set-debug-log-enabled', enabled),
  logDebugInfo: (info) => ipcRenderer.invoke('log-debug-info', info),
  
  // Add any other APIs you need to expose to the renderer
  platform: process.platform,
  isDev: process.env.NODE_ENV === 'development'
}); 