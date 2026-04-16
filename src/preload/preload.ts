import { contextBridge, ipcRenderer } from 'electron';

// Define the API types
export interface ElectronAPI {
  // Authentication
  getAuthStatus: () => Promise<{ configured: boolean; authenticated: boolean }>;
  signInWithGoogle: () => Promise<{ success: boolean; error?: string }>;
  signOutFromGoogle: () => Promise<{ success: boolean }>;
  
  // Sync
  syncDrives: (allowedSources?: string[], nsfwEnabled?: boolean) => Promise<{ success: boolean; newFiles: number; updatedFiles: number; errors: string[] }>;
  cancelSync: () => Promise<{ success: boolean }>;
  getLastSync: () => Promise<string | null>;
  onSyncProgress: (callback: (message: string) => void) => () => void;
  clearDatabase: (options?: { keepOAuthSignIn?: boolean }) => Promise<{ success: boolean }>;
  
  // Files
  getNewFiles: (since: string) => Promise<FileRecord[]>;
  getFiles: (filters: FileFilters) => Promise<FileRecord[]>;
  getFileCount: (filters?: FileFilters) => Promise<number>;
  updateNsfwFlags: () => Promise<{ updated: number }>;
  getNsfwStats: () => Promise<NsfwStats>;
  openExternal: (url: string) => Promise<void>;
  
  // Thumbnails
  getThumbnail: (fileId: string) => Promise<{ type: 'local' | 'url'; path: string }>;
  cacheThumbnail: (fileId: string) => Promise<string | null>;
  getThumbnailCacheSize: () => Promise<number>;
  clearThumbnailCache: () => Promise<{ success: boolean }>;
  
  // Bookmarks
  addBookmark: (fileId: string, notes?: string) => Promise<number>;
  removeBookmark: (fileId: string) => Promise<{ success: boolean }>;
  getBookmarks: () => Promise<Bookmark[]>;
  isBookmarked: (fileId: string) => Promise<boolean>;
  getBookmarkCount: () => Promise<number>;
  updateBookmarkNotes: (fileId: string, notes: string) => Promise<{ success: boolean }>;
  
  // Downloads
  downloadFile: (fileId: string, fileName: string) => Promise<string>;
  hasLocalCopy: (fileId: string) => Promise<{ exists: boolean; path: string | null }>;
  openFile: (filePath: string) => Promise<{ success: boolean }>;
  openDownloadFolder: () => Promise<{ success: boolean }>;
  getDownloadSize: () => Promise<number>;
  deleteLocalCopy: (fileId: string, filePath: string) => Promise<{ success: boolean }>;
  
  // Settings
  getSetting: <T>(key: string) => Promise<T | null>;
  setSetting: <T>(key: string, value: T) => Promise<{ success: boolean }>;
  
  // Stats
  getStats: () => Promise<Stats>;
}

export interface FileRecord {
  id: string;
  drive_id: string;
  name: string;
  web_view_link: string;
  modified_time: string;
  md5_checksum: string | null;
  size_bytes: number | null;
  version: string | null;
  thumbnail_path: string | null;
  folder_path: string | null;
  nsfw: number;
  is_deleted: number;
  created_at: string;
  drive_name: string;
  source: string;
  base_title: string;
  group_key: string;
  variant_count: number;
  source_count: number;
  variants: FileVariantRecord[];
}

export interface FileSourceRecord {
  id: string;
  drive_id: string;
  drive_name: string;
  source: string;
  web_view_link: string;
  modified_time: string;
  md5_checksum: string | null;
  size_bytes: number | null;
}

export interface FileVariantRecord {
  id: string;
  name: string;
  version_label: string | null;
  drive_id: string;
  drive_name: string;
  source: string;
  web_view_link: string;
  modified_time: string;
  md5_checksum: string | null;
  size_bytes: number | null;
  thumbnail_path: string | null;
  folder_path: string | null;
  nsfw: number;
  created_at: string;
  sources: FileSourceRecord[];
}

export interface Bookmark {
  id: number;
  file_id: string;
  user_notes: string | null;
  created_at: string;
  has_local_copy: number;
  local_path: string | null;
  name?: string;
  web_view_link?: string;
  source?: string;
  drive_name?: string;
  base_title?: string;
  group_key?: string;
  variant_count?: number;
  source_count?: number;
  variants?: FileVariantRecord[];
}

export interface FileFilters {
  sources?: string[];
  nsfw?: boolean;
  nsfwOnly?: boolean;
  bookmarkedOnly?: boolean;
  bookmarkedIds?: string[];
  search?: string;
  sortBy?: 'name' | 'date' | 'source';
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

export interface Stats {
  totalFiles: number;
  totalBookmarks: number;
  totalDrives: number;
  lastSync: string | null;
}

export interface NsfwStats {
  totalFiles: number;
  nsfwFiles: number;
  nsfwDrives: number;
  filesWithNsfwInPath: number;
  filesWithNsfwInName: number;
}

// Expose safe APIs to renderer
const electronAPI: ElectronAPI = {
  // Authentication
  getAuthStatus: () => ipcRenderer.invoke('auth:getStatus'),
  signInWithGoogle: () => ipcRenderer.invoke('auth:signIn'),
  signOutFromGoogle: () => ipcRenderer.invoke('auth:signOut'),
  
  // Sync
  syncDrives: (allowedSources?: string[], nsfwEnabled?: boolean) => ipcRenderer.invoke('sync:drives', allowedSources, nsfwEnabled),
  cancelSync: () => ipcRenderer.invoke('sync:cancel'),
  getLastSync: () => ipcRenderer.invoke('sync:getLastSync'),
  onSyncProgress: (callback: (message: string) => void) => {
    const handler = (_: Electron.IpcRendererEvent, message: string) => callback(message);
    ipcRenderer.on('sync:progress', handler);
    return () => ipcRenderer.removeListener('sync:progress', handler);
  },
  clearDatabase: (options?: { keepOAuthSignIn?: boolean }) => ipcRenderer.invoke('database:clear', options),
  
  // Files
  getNewFiles: (since: string) => ipcRenderer.invoke('files:getNew', since),
  getFiles: (filters: FileFilters) => ipcRenderer.invoke('files:getAll', filters),
  getFileCount: (filters?: FileFilters) => ipcRenderer.invoke('files:getCount', filters),
  updateNsfwFlags: () => ipcRenderer.invoke('files:updateNsfwFlags'),
  getNsfwStats: () => ipcRenderer.invoke('files:getNsfwStats'),
  openExternal: (url: string) => ipcRenderer.invoke('files:openExternal', url),
  
  // Thumbnails
  getThumbnail: (fileId: string) => ipcRenderer.invoke('thumbnail:get', fileId),
  cacheThumbnail: (fileId: string) => ipcRenderer.invoke('thumbnail:cache', fileId),
  getThumbnailCacheSize: () => ipcRenderer.invoke('thumbnail:getCacheSize'),
  clearThumbnailCache: () => ipcRenderer.invoke('thumbnail:clearCache'),
  
  // Bookmarks
  addBookmark: (fileId: string, notes?: string) => ipcRenderer.invoke('bookmark:add', fileId, notes),
  removeBookmark: (fileId: string) => ipcRenderer.invoke('bookmark:remove', fileId),
  getBookmarks: () => ipcRenderer.invoke('bookmark:getAll'),
  isBookmarked: (fileId: string) => ipcRenderer.invoke('bookmark:isBookmarked', fileId),
  getBookmarkCount: () => ipcRenderer.invoke('bookmark:getCount'),
  updateBookmarkNotes: (fileId: string, notes: string) => ipcRenderer.invoke('bookmark:updateNotes', fileId, notes),
  
  // Downloads
  downloadFile: (fileId: string, fileName: string) => ipcRenderer.invoke('download:file', fileId, fileName),
  hasLocalCopy: (fileId: string) => ipcRenderer.invoke('download:hasLocal', fileId),
  openFile: (filePath: string) => ipcRenderer.invoke('download:openFile', filePath),
  openDownloadFolder: () => ipcRenderer.invoke('download:openFolder'),
  getDownloadSize: () => ipcRenderer.invoke('download:getSize'),
  deleteLocalCopy: (fileId: string, filePath: string) => ipcRenderer.invoke('download:delete', fileId, filePath),
  
  // Settings
  getSetting: <T>(key: string) => ipcRenderer.invoke('settings:get', key) as Promise<T | null>,
  setSetting: <T>(key: string, value: T) => ipcRenderer.invoke('settings:set', key, value),
  
  // Stats
  getStats: () => ipcRenderer.invoke('stats:get'),
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);
