import { google, drive_v3 } from 'googleapis';
import type { OAuth2Client } from 'google-auth-library';
import { DatabaseManager } from '../db/database';

interface KnownDriveDefinition {
  urlOrId: string;
  name: string;
  source: string;
  nsfw: number;
}

interface DriveInfo {
  id: string;
  name: string;
  source: string;
  nsfw: number;
  resourceKey?: string;
}

interface ParsedDriveLink {
  id: string;
  resourceKey?: string;
}

const KNOWN_DRIVE_DEFINITIONS: KnownDriveDefinition[] = [
  {
    urlOrId: '1Cx7KoDkQa9qmDfJN9_CehZ0fxXEweKOu', // DriveAnon's 4chan Drive
    name: "DriveAnon's 4chan Drive",
    source: '4chan',
    nsfw: 0
  },
  {
    urlOrId: 'https://drive.google.com/drive/folders/0By8NY-NO4-N5VlNqZWxxakJtVjg?resourcekey=0-AMm_C8DhQLJHHZ5Nt09NtQ', // QQ Drive
    name: 'Questionable Questing Drive',
    source: 'QQ',
    nsfw: 1
  },
  {
    urlOrId: 'https://drive.google.com/drive/folders/0By8NY-NO4-N5NUoxNzcxakZmd0E?resourcekey=0-FjB8xfxUCa0-R41gF-y_AA', // SB Drive
    name: 'SpaceBattles Drive',
    source: 'SB',
    nsfw: 0
  },
  {
    urlOrId: '1KxTXeHrbttL4G1lugsQdTd1CjktBmBwd', // Reddit Drive
    name: 'Reddit Jumpchain Drive',
    source: 'Reddit',
    nsfw: 0
  }
];

interface SyncResult {
  success: boolean;
  newFiles: number;
  updatedFiles: number;
  errors: string[];
}

export class GoogleDriveService {
  private drive: drive_v3.Drive | null = null;
  private db: DatabaseManager;
  private authClient: OAuth2Client | null = null;
  private abortController: AbortController | null = null;
  private readonly knownDrives: DriveInfo[];

  constructor(db: DatabaseManager, authClient?: OAuth2Client) {
    this.db = db;
    this.authClient = authClient || null;
    this.knownDrives = KNOWN_DRIVE_DEFINITIONS.map((entry) => {
      const parsed = this.parseDriveLink(entry.urlOrId);
      return {
        id: parsed.id,
        resourceKey: parsed.resourceKey,
        name: entry.name,
        source: entry.source,
        nsfw: entry.nsfw
      };
    });
    
    if (this.authClient) {
      this.drive = google.drive({ version: 'v3', auth: this.authClient });
    }
  }

  isConfigured(): boolean {
    return !!this.authClient;
  }

  cancelSync(): void {
    if (this.abortController && !this.abortController.signal.aborted) {
      this.abortController.abort();
      console.log('Sync cancellation requested');
    }
  }

  async syncAllDrives(onProgress?: (message: string) => void, allowedSources?: string[], nsfwEnabled?: boolean): Promise<SyncResult> {
    // Create new abort controller for this sync
    this.abortController = new AbortController();
    
    const result: SyncResult = {
      success: true,
      newFiles: 0,
      updatedFiles: 0,
      errors: []
    };

    if (!this.isConfigured() || !this.drive) {
      result.success = false;
      result.errors.push('Google OAuth is not configured or authenticated. Sign in from onboarding or settings.');
      onProgress?.('Error: Google OAuth is not configured');
      this.abortController = null;
      return result;
    }

    try {
      onProgress?.('Indexing files from selected community drives...');
      onProgress?.('This may take a few minutes on first sync...');
      
      // Filter drives based on source settings only.
      // NSFW preference controls visibility in UI, not indexing scope.
      const drivesToSync = this.knownDrives.filter(drive => {
        if (!allowedSources || allowedSources.length === 0) {
          return true;
        }
        return allowedSources.includes(drive.source);
      });

      const skippedDrives = this.knownDrives.filter((drive) => !drivesToSync.some((d) => d.id === drive.id));
      if (skippedDrives.length > 0) {
        const skippedMessage = `Skipped drives by source filter: ${skippedDrives.map((d) => d.source).join(', ')}`;
        onProgress?.(skippedMessage);
        result.errors.push(skippedMessage);
      }
      
      if (drivesToSync.length === 0) {
        onProgress?.('No drives selected in settings');
        this.abortController = null;
        return result;
      }

      onProgress?.(`Syncing sources: ${drivesToSync.map((d) => d.source).join(', ')}`);
      
      // Register known drives
      for (const drive of drivesToSync) {
        this.db.upsertDrive(drive);
      }

      // Scan each drive to get real file IDs
      for (let i = 0; i < drivesToSync.length; i++) {
        // Check if cancelled
        if (this.abortController?.signal.aborted) {
          result.success = false;
          result.errors.push('Sync cancelled by user');
          onProgress?.('Sync cancelled');
          this.abortController = null;
          return result;
        }
        
        const drive = drivesToSync[i];
        try {
          const driveLastSync = this.db.getDriveLastSync(drive.id);
          const existingDriveFileCount = this.db.getDriveFileCount(drive.id);
          const sinceDate = driveLastSync && existingDriveFileCount > 0
            ? new Date(driveLastSync).toISOString()
            : undefined;
          const syncMode = sinceDate ? 'incremental' : 'full';
          onProgress?.(`Scanning ${drive.name} (${i + 1}/${drivesToSync.length}) [${syncMode}]...`);

          const stats = await this.scanDriveRecursively(drive, undefined, '', sinceDate, drive.resourceKey);
          result.newFiles += stats.newFiles;
          result.updatedFiles += stats.updatedFiles;
          this.db.setDriveLastSync(drive.id, new Date().toISOString());
        } catch (error) {
          const errorMessage = (error as Error).message;
          
          // If sync was cancelled, stop immediately
          if (errorMessage === 'Sync cancelled') {
            result.success = false;
            result.errors.push('Sync cancelled by user');
            onProgress?.('Sync cancelled');
            this.abortController = null;
            return result;
          }
          
          // Otherwise, log the error and continue with next drive
          const message = this.formatDriveError(drive.name, error);
          console.error(message);
          result.errors.push(message);
        }
      }

      // Only record sync if not cancelled
      if (!this.abortController?.signal.aborted) {
        this.db.recordSync(result.newFiles, result.updatedFiles);
        this.db.setSetting('lastSync', new Date().toISOString());
        onProgress?.(`Sync complete! ${result.newFiles} new, ${result.updatedFiles} updated`);
      }
      
      // Clean up abort controller
      this.abortController = null;
    } catch (error) {
      const errorMessage = (error as Error).message;
      
      // Check if it was a cancellation
      if (errorMessage === 'Sync cancelled') {
        result.success = false;
        result.errors.push('Sync cancelled by user');
        onProgress?.('Sync cancelled');
      } else {
        result.success = false;
        result.errors.push(errorMessage);
        onProgress?.(`Sync failed: ${errorMessage}`);
      }
      
      // Clean up abort controller
      this.abortController = null;
    }

    return result;
  }

  /**
   * Recursively scan a drive to find all PDF files
   */
  private async scanDriveRecursively(
    driveInfo: DriveInfo,
    folderId?: string,
    folderPath: string = '',
    sinceDate?: string,
    folderResourceKey?: string
  ): Promise<{ newFiles: number; updatedFiles: number }> {
    if (!this.drive) throw new Error('Drive API not configured');

    const driveApi = this.drive;
    let newFiles = 0;
    let updatedFiles = 0;
    const targetFolderId = folderId || driveInfo.id;

    // Get all PDFs in this folder
    let pageToken: string | undefined;
    do {
        // Check if cancelled before API call
        if (this.abortController?.signal.aborted) {
          throw new Error('Sync cancelled');
        }
        
        const response = await driveApi.files.list({
          q: `'${targetFolderId}' in parents and mimeType='application/pdf' and trashed=false${sinceDate ? ` and modifiedTime > '${sinceDate}'` : ''}`,
          fields: 'nextPageToken, files(id, name, modifiedTime, webViewLink, md5Checksum, size)',
          pageSize: 100,
          pageToken,
          supportsAllDrives: true,
          includeItemsFromAllDrives: true
        }, this.buildResourceKeyRequestOptions(targetFolderId, folderResourceKey));

        // Check immediately after API call
        if (this.abortController?.signal.aborted) {
          throw new Error('Sync cancelled');
        }

        for (const file of response.data.files || []) {
          // Check cancellation during file processing (every file)
          if (this.abortController?.signal.aborted) {
            throw new Error('Sync cancelled');
          }
          
          if (!file.id || !file.name) continue;

          // Detect NSFW from path or filename (case-insensitive)
          const fullPath = folderPath ? `${folderPath}/${file.name}` : file.name;
          const isNsfw = fullPath.toLowerCase().includes('nsfw') ? 1 : 0;

          const result = this.db.upsertFile({
            id: file.id,
            drive_id: driveInfo.id,
            name: file.name,
            web_view_link: file.webViewLink || `https://drive.google.com/file/d/${file.id}/view`,
            modified_time: file.modifiedTime || new Date().toISOString(),
            md5_checksum: file.md5Checksum || undefined,
            size_bytes: file.size ? Number.parseInt(file.size, 10) : undefined,
            folder_path: folderPath || undefined,
            nsfw: isNsfw
          });

          if (result.isNew) newFiles++;
          else if (result.isUpdated) updatedFiles++;
        }

        pageToken = response.data.nextPageToken || undefined;
        await this.delay(100); // Small delay to avoid rate limiting
    } while (pageToken);

    // Get all subfolders
    let folderToken: string | undefined;
    do {
        // Check if cancelled before subfolder API call
        if (this.abortController?.signal.aborted) {
          throw new Error('Sync cancelled');
        }
        
        const folderList = await driveApi.files.list({
          q: `'${targetFolderId}' in parents and (mimeType='application/vnd.google-apps.folder' or mimeType='application/vnd.google-apps.shortcut') and trashed=false`,
          fields: 'nextPageToken, files(id, name, mimeType, resourceKey, shortcutDetails(targetId,targetMimeType,targetResourceKey))',
          pageSize: 100,
          pageToken: folderToken,
          supportsAllDrives: true,
          includeItemsFromAllDrives: true
        }, this.buildResourceKeyRequestOptions(targetFolderId, folderResourceKey));

        // Check immediately after API call
        if (this.abortController?.signal.aborted) {
          throw new Error('Sync cancelled');
        }

        const folders = folderList.data.files || [];
        for (const folder of folders) {
          if (!folder.id || !folder.name) continue;
          
          // Check before recursing
          if (this.abortController?.signal.aborted) {
            throw new Error('Sync cancelled');
          }

          if (folder.mimeType === 'application/vnd.google-apps.folder') {
            const subFolderPath = folderPath ? `${folderPath}/${folder.name}` : folder.name;
            const subStats = await this.scanDriveRecursively(
              driveInfo,
              folder.id,
              subFolderPath,
              sinceDate,
              folder.resourceKey || undefined
            );
            newFiles += subStats.newFiles;
            updatedFiles += subStats.updatedFiles;
            continue;
          }

          if (
            folder.mimeType === 'application/vnd.google-apps.shortcut' &&
            folder.shortcutDetails?.targetId &&
            folder.shortcutDetails.targetMimeType === 'application/vnd.google-apps.folder'
          ) {
            const subFolderPath = folderPath ? `${folderPath}/${folder.name}` : folder.name;
            const subStats = await this.scanDriveRecursively(
              driveInfo,
              folder.shortcutDetails.targetId,
              subFolderPath,
              sinceDate,
              folder.shortcutDetails.targetResourceKey || undefined
            );
            newFiles += subStats.newFiles;
            updatedFiles += subStats.updatedFiles;
          }
        }

        folderToken = folderList.data.nextPageToken || undefined;
        await this.delay(100);
    } while (folderToken);

    return { newFiles, updatedFiles };
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private parseDriveLink(urlOrId: string): ParsedDriveLink {
    const trimmed = urlOrId.trim();
    if (!trimmed.includes('://')) {
      return { id: trimmed };
    }

    try {
      const parsedUrl = new URL(trimmed);
      const folderMatch = parsedUrl.pathname.match(/\/folders\/([a-zA-Z0-9_-]+)/);
      if (!folderMatch) {
        return { id: trimmed };
      }

      const id = folderMatch[1];
      const resourceKey = parsedUrl.searchParams.get('resourcekey') || undefined;
      return { id, resourceKey };
    } catch {
      return { id: trimmed };
    }
  }

  private buildResourceKeyRequestOptions(folderId: string, resourceKey?: string): { headers: Record<string, string> } | undefined {
    if (!resourceKey) {
      return undefined;
    }

    return {
      headers: {
        'X-Goog-Drive-Resource-Keys': `${folderId}/${resourceKey}`
      }
    };
  }

  private formatDriveError(driveName: string, error: unknown): string {
    const err = error as { message?: string; code?: number; errors?: Array<{ message?: string }> };
    const message = err.message || err.errors?.[0]?.message || 'Unknown error';
    const code = err.code ? ` [${err.code}]` : '';
    return `Failed to scan ${driveName}${code}: ${message}`;
  }

  // Get direct download URL for a file
  getDownloadUrl(fileId: string): string {
    return `https://drive.google.com/uc?export=download&id=${fileId}`;
  }

  // Get thumbnail URL from Google Drive
  getThumbnailUrl(fileId: string): string {
    return `https://drive.google.com/thumbnail?id=${fileId}&sz=w400`;
  }
}
