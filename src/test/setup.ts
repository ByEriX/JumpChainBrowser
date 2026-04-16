import { vi } from 'vitest';
import '@testing-library/jest-dom';

// Mock Electron APIs
const mockElectronAPI = {
  syncDrives: vi.fn().mockResolvedValue({ success: true, newFiles: 0, updatedFiles: 0, errors: [] }),
  getLastSync: vi.fn().mockResolvedValue(null),
  onSyncProgress: vi.fn().mockReturnValue(() => {}),
  getNewFiles: vi.fn().mockResolvedValue([]),
  getFiles: vi.fn().mockResolvedValue([]),
  getFileCount: vi.fn().mockResolvedValue(0),
  openExternal: vi.fn().mockResolvedValue(undefined),
  getThumbnail: vi.fn().mockResolvedValue({ type: 'url', path: '' }),
  cacheThumbnail: vi.fn().mockResolvedValue(null),
  getThumbnailCacheSize: vi.fn().mockResolvedValue(0),
  clearThumbnailCache: vi.fn().mockResolvedValue({ success: true }),
  addBookmark: vi.fn().mockResolvedValue(1),
  removeBookmark: vi.fn().mockResolvedValue({ success: true }),
  getBookmarks: vi.fn().mockResolvedValue([]),
  isBookmarked: vi.fn().mockResolvedValue(false),
  getBookmarkCount: vi.fn().mockResolvedValue(0),
  updateBookmarkNotes: vi.fn().mockResolvedValue({ success: true }),
  downloadFile: vi.fn().mockResolvedValue('/path/to/file.pdf'),
  hasLocalCopy: vi.fn().mockResolvedValue({ exists: false, path: null }),
  openFile: vi.fn().mockResolvedValue({ success: true }),
  openDownloadFolder: vi.fn().mockResolvedValue({ success: true }),
  getDownloadSize: vi.fn().mockResolvedValue(0),
  deleteLocalCopy: vi.fn().mockResolvedValue({ success: true }),
  getSetting: vi.fn().mockResolvedValue(null),
  setSetting: vi.fn().mockResolvedValue({ success: true }),
  getStats: vi.fn().mockResolvedValue({ totalFiles: 0, totalBookmarks: 0, totalDrives: 0, lastSync: null }),
  getNsfwStats: vi.fn().mockResolvedValue({ totalFiles: 0, nsfwFiles: 0, nsfwDrives: 0, filesWithNsfwInPath: 0, filesWithNsfwInName: 0 }),
  updateNsfwFlags: vi.fn().mockResolvedValue({ updated: 0 }),
  clearDatabase: vi.fn().mockResolvedValue({ success: true }),
  getAuthStatus: vi.fn().mockResolvedValue({ configured: true, authenticated: true }),
  signInWithGoogle: vi.fn().mockResolvedValue({ success: true }),
  signOutFromGoogle: vi.fn().mockResolvedValue({ success: true })
};

// Expose mock to window
Object.defineProperty(window, 'electronAPI', {
  value: mockElectronAPI,
  writable: true
});

export { mockElectronAPI };
