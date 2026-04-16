import { ipcMain, shell, BrowserWindow } from 'electron';
import { GoogleDriveService } from './services/googleApi';
import { ThumbnailService } from './services/thumbnailService';
import { DownloadService } from './services/downloadService';
import { DatabaseManager } from './db/database';
import { OAuthService } from './services/oauthService';

interface FileFilters {
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

interface ClearDatabaseOptions {
  keepOAuthSignIn?: boolean;
}

const OAUTH_TOKENS_KEY = 'googleOAuthTokens';

async function getDriveService(db: DatabaseManager, oauthService: OAuthService): Promise<GoogleDriveService> {
  const authClient = await oauthService.getAuthorizedClient();
  return new GoogleDriveService(db, authClient || undefined);
}

async function getThumbnailService(db: DatabaseManager, oauthService: OAuthService): Promise<ThumbnailService> {
  const authClient = await oauthService.getAuthorizedClient();
  return new ThumbnailService(db, authClient || undefined);
}

let activeDriveService: GoogleDriveService | null = null;

export function setupIpcHandlers(): void {
  const db = DatabaseManager.getInstance();
  const downloadService = new DownloadService(db);
  const oauthService = new OAuthService(db);

  // Authentication (OAuth)
  ipcMain.handle('auth:getStatus', async () => {
    return oauthService.getAuthStatus();
  });

  ipcMain.handle('auth:signIn', async () => {
    return oauthService.signIn((url: string) => shell.openExternal(url));
  });

  ipcMain.handle('auth:signOut', async () => {
    await oauthService.signOut();
    return { success: true };
  });

  // Sync operations
  ipcMain.handle('sync:drives', async (event, allowedSources?: string[], nsfwEnabled?: boolean) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    activeDriveService = await getDriveService(db, oauthService);

    try {
      const result = await activeDriveService.syncAllDrives((message) => {
        // Send progress updates to renderer
        window?.webContents.send('sync:progress', message);
      }, allowedSources, nsfwEnabled);

      return result;
    } finally {
      activeDriveService = null;
    }
  });

  ipcMain.handle('sync:cancel', async () => {
    activeDriveService?.cancelSync();
    return { success: true };
  });

  ipcMain.handle('sync:getLastSync', async () => {
    return db.getLastSync();
  });

  // File operations
  ipcMain.handle('files:getNew', async (_, since: string) => {
    return db.getNewFiles(since);
  });

  ipcMain.handle('files:getAll', async (_, filters: FileFilters) => {
    return db.getFilesWithFilters(filters);
  });

  ipcMain.handle('files:getCount', async (_, filters?: FileFilters) => {
    return db.getFileCount(filters);
  });

  ipcMain.handle('files:openExternal', async (_, url: string) => {
    await shell.openExternal(url);
  });

  // Thumbnail operations
  ipcMain.handle('thumbnail:get', async (_, fileId: string) => {
    const thumbnailService = await getThumbnailService(db, oauthService);
    return thumbnailService.getThumbnail(fileId);
  });

  ipcMain.handle('thumbnail:cache', async (_, fileId: string) => {
    const thumbnailService = await getThumbnailService(db, oauthService);
    return thumbnailService.cacheThumbnail(fileId);
  });

  ipcMain.handle('thumbnail:getCacheSize', async () => {
    const thumbnailService = await getThumbnailService(db, oauthService);
    return thumbnailService.getCacheSize();
  });

  ipcMain.handle('thumbnail:clearCache', async () => {
    const thumbnailService = await getThumbnailService(db, oauthService);
    await thumbnailService.clearCache();
    return { success: true };
  });

  // Bookmark operations
  ipcMain.handle('bookmark:add', async (_, fileId: string, notes?: string) => {
    return db.addBookmark(fileId, notes);
  });

  ipcMain.handle('bookmark:remove', async (_, fileId: string) => {
    db.removeBookmark(fileId);
    return { success: true };
  });

  ipcMain.handle('bookmark:getAll', async () => {
    return db.getBookmarks();
  });

  ipcMain.handle('bookmark:isBookmarked', async (_, fileId: string) => {
    return db.isBookmarked(fileId);
  });

  ipcMain.handle('bookmark:getCount', async () => {
    return db.getBookmarkCount();
  });

  ipcMain.handle('bookmark:updateNotes', async (_, fileId: string, notes: string) => {
    db.addBookmark(fileId, notes); // Uses UPSERT
    return { success: true };
  });

  // Download operations
  ipcMain.handle('download:file', async (_, fileId: string, fileName: string) => {
    return downloadService.downloadFile(fileId, fileName);
  });

  ipcMain.handle('download:hasLocal', async (_, fileId: string) => {
    return downloadService.hasLocalCopy(fileId);
  });

  ipcMain.handle('download:openFile', async (_, filePath: string) => {
    await downloadService.openFile(filePath);
    return { success: true };
  });

  ipcMain.handle('download:openFolder', async () => {
    await downloadService.openDownloadFolder();
    return { success: true };
  });

  ipcMain.handle('download:getSize', async () => {
    return downloadService.getDownloadSize();
  });

  ipcMain.handle('download:delete', async (_, fileId: string, filePath: string) => {
    await downloadService.deleteLocalCopy(fileId, filePath);
    return { success: true };
  });

  // Settings operations
  ipcMain.handle('settings:get', async (_, key: string) => {
    const value = db.getSetting(key);
    if (value) {
      try {
        return JSON.parse(value);
      } catch {
        return value;
      }
    }
    return null;
  });

  ipcMain.handle('settings:set', async (_, key: string, value: unknown) => {
    const stringValue = typeof value === 'string' ? value : JSON.stringify(value);
    db.setSetting(key, stringValue);
    return { success: true };
  });

  // Stats for dashboard
  ipcMain.handle('stats:get', async () => {
    return {
      totalFiles: db.getFileCount(),
      totalBookmarks: db.getBookmarkCount(),
      totalDrives: db.getDrives().length,
      lastSync: db.getLastSync()
    };
  });

  // Utility: Update NSFW flags for all files
  ipcMain.handle('files:updateNsfwFlags', async () => {
    const result = db.updateNsfwFlags();
    return result;
  });

  // Diagnostic: Get NSFW statistics
  ipcMain.handle('files:getNsfwStats', async () => {
    return db.getNsfwStats();
  });

  // Database management
  ipcMain.handle('database:clear', async (_, options?: ClearDatabaseOptions) => {
    try {
      const shouldKeepOAuthSignIn = options?.keepOAuthSignIn === true;
      const existingOAuthTokens = shouldKeepOAuthSignIn ? db.getSetting(OAUTH_TOKENS_KEY) : null;

      db.clearAll();

      if (shouldKeepOAuthSignIn && existingOAuthTokens) {
        db.setSetting(OAUTH_TOKENS_KEY, existingOAuthTokens);
      }

      return { success: true };
    } catch (error) {
      console.error('Error clearing database:', error);
      throw error;
    }
  });
}
