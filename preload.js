const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  selectFile: () => ipcRenderer.invoke('select-file'),
  clearCache: () => ipcRenderer.invoke('clear-cache'),
  setDebugLogEnabled: (enabled) => ipcRenderer.invoke('set-debug-log-enabled', enabled),
  logDebugInfo: (info) => ipcRenderer.invoke('log-debug-info', info),
  saveImageToDisk: async (imageData, extension) => {
    return await ipcRenderer.invoke('save-image-to-disk', { imageData, extension });
  },
  cleanupOrphanedImages: async () => {
    return await ipcRenderer.invoke('cleanup-orphaned-images');
  },
  deleteImageFile: async (imagePath) => {
    return await ipcRenderer.invoke('delete-image-file', imagePath);
  },
  // Template file APIs
  readTemplateFile: async (filePath) => {
    return await ipcRenderer.invoke('read-template-file', filePath);
  },
  writeTemplateFile: async (filePath, content) => {
    return await ipcRenderer.invoke('write-template-file', { filePath, content });
  },
  listTemplateFiles: async (directory) => {
    return await ipcRenderer.invoke('list-template-files', directory);
  },
  platform: process.platform,
  isDev: process.env.NODE_ENV === 'development'
}); 