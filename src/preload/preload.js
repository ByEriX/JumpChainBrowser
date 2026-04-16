"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
// Expose safe APIs to renderer
const electronAPI = {
    // API Configuration
    isApiConfigured: () => electron_1.ipcRenderer.invoke('api:isConfigured'),
    // Sync
    syncDrives: (allowedSources, nsfwEnabled) => electron_1.ipcRenderer.invoke('sync:drives', allowedSources, nsfwEnabled),
    cancelSync: () => electron_1.ipcRenderer.invoke('sync:cancel'),
    getLastSync: () => electron_1.ipcRenderer.invoke('sync:getLastSync'),
    onSyncProgress: (callback) => {
        const handler = (_, message) => callback(message);
        electron_1.ipcRenderer.on('sync:progress', handler);
        return () => electron_1.ipcRenderer.removeListener('sync:progress', handler);
    },
    clearDatabase: () => electron_1.ipcRenderer.invoke('database:clear'),
    // Files
    getNewFiles: (since) => electron_1.ipcRenderer.invoke('files:getNew', since),
    getFiles: (filters) => electron_1.ipcRenderer.invoke('files:getAll', filters),
    getFileCount: () => electron_1.ipcRenderer.invoke('files:getCount'),
    updateNsfwFlags: () => electron_1.ipcRenderer.invoke('files:updateNsfwFlags'),
    getNsfwStats: () => electron_1.ipcRenderer.invoke('files:getNsfwStats'),
    openExternal: (url) => electron_1.ipcRenderer.invoke('files:openExternal', url),
    // Thumbnails
    getThumbnail: (fileId) => electron_1.ipcRenderer.invoke('thumbnail:get', fileId),
    cacheThumbnail: (fileId) => electron_1.ipcRenderer.invoke('thumbnail:cache', fileId),
    getThumbnailCacheSize: () => electron_1.ipcRenderer.invoke('thumbnail:getCacheSize'),
    clearThumbnailCache: () => electron_1.ipcRenderer.invoke('thumbnail:clearCache'),
    // Bookmarks
    addBookmark: (fileId, notes) => electron_1.ipcRenderer.invoke('bookmark:add', fileId, notes),
    removeBookmark: (fileId) => electron_1.ipcRenderer.invoke('bookmark:remove', fileId),
    getBookmarks: () => electron_1.ipcRenderer.invoke('bookmark:getAll'),
    isBookmarked: (fileId) => electron_1.ipcRenderer.invoke('bookmark:isBookmarked', fileId),
    getBookmarkCount: () => electron_1.ipcRenderer.invoke('bookmark:getCount'),
    updateBookmarkNotes: (fileId, notes) => electron_1.ipcRenderer.invoke('bookmark:updateNotes', fileId, notes),
    // Downloads
    downloadFile: (fileId, fileName) => electron_1.ipcRenderer.invoke('download:file', fileId, fileName),
    hasLocalCopy: (fileId) => electron_1.ipcRenderer.invoke('download:hasLocal', fileId),
    openFile: (filePath) => electron_1.ipcRenderer.invoke('download:openFile', filePath),
    openDownloadFolder: () => electron_1.ipcRenderer.invoke('download:openFolder'),
    getDownloadSize: () => electron_1.ipcRenderer.invoke('download:getSize'),
    deleteLocalCopy: (fileId, filePath) => electron_1.ipcRenderer.invoke('download:delete', fileId, filePath),
    // Settings
    getSetting: (key) => electron_1.ipcRenderer.invoke('settings:get', key),
    setSetting: (key, value) => electron_1.ipcRenderer.invoke('settings:set', key, value),
    // Stats
    getStats: () => electron_1.ipcRenderer.invoke('stats:get'),
};
electron_1.contextBridge.exposeInMainWorld('electronAPI', electronAPI);
