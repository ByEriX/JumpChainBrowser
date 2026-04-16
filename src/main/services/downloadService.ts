import path from 'path';
import fs from 'fs/promises';
import { app, shell } from 'electron';
import { DatabaseManager } from '../db/database';

export class DownloadService {
  private db: DatabaseManager;
  private downloadDir: string;

  constructor(db: DatabaseManager) {
    this.db = db;
    const documentsPath = app?.getPath('documents') || __dirname;
    this.downloadDir = path.join(documentsPath, 'JumpChain Archive');
  }

  async ensureDirectoryExists(): Promise<void> {
    try {
      await fs.mkdir(this.downloadDir, { recursive: true });
    } catch (error) {
      // Directory might already exist
    }
  }

  getDownloadPath(fileId: string, fileName: string): string {
    // Sanitize filename
    const sanitizedName = fileName.replace(/[<>:"/\\|?*]/g, '_').trim();
    const normalizedName = sanitizedName
      .replace(/_+/g, '_')
      .replace(/^[._\s]+|[._\s]+$/g, '');
    const effectiveName = normalizedName || fileId;
    const ext = path.extname(effectiveName);
    const fileNameWithExtension = ext ? effectiveName : `${effectiveName}.pdf`;
    return path.join(this.downloadDir, fileNameWithExtension);
  }

  async hasLocalCopy(fileId: string): Promise<{ exists: boolean; path: string | null }> {
    const bookmark = this.db.getBookmarks().find(b => b.file_id === fileId);
    
    if (bookmark?.local_path) {
      try {
        await fs.access(bookmark.local_path);
        return { exists: true, path: bookmark.local_path };
      } catch {
        // File was deleted, update database
        this.db.updateBookmarkLocalCopy(fileId, false);
      }
    }
    
    return { exists: false, path: null };
  }

  async downloadFile(fileId: string, fileName: string): Promise<string> {
    await this.ensureDirectoryExists();

    const downloadUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;
    const filePath = this.getDownloadPath(fileId, fileName);

    try {
      const response = await fetch(downloadUrl);
      
      if (!response.ok) {
        throw new Error(`Download failed: ${response.status} ${response.statusText}`);
      }

      const buffer = await response.arrayBuffer();
      await fs.writeFile(filePath, Buffer.from(buffer));

      // Update bookmark if exists
      if (this.db.isBookmarked(fileId)) {
        this.db.updateBookmarkLocalCopy(fileId, true, filePath);
      }

      return filePath;
    } catch (error) {
      console.error(`Error downloading file ${fileId}:`, error);
      throw error;
    }
  }

  async openFile(filePath: string): Promise<void> {
    await shell.openPath(filePath);
  }

  async openInExplorer(filePath: string): Promise<void> {
    shell.showItemInFolder(filePath);
  }

  async openDownloadFolder(): Promise<void> {
    await this.ensureDirectoryExists();
    await shell.openPath(this.downloadDir);
  }

  async deleteLocalCopy(fileId: string, filePath: string): Promise<void> {
    try {
      await fs.unlink(filePath);
      this.db.updateBookmarkLocalCopy(fileId, false);
    } catch (error) {
      console.error(`Error deleting file ${filePath}:`, error);
      throw error;
    }
  }

  /**
   * Get total size of downloaded files
   */
  async getDownloadSize(): Promise<number> {
    try {
      const files = await fs.readdir(this.downloadDir);
      let totalSize = 0;
      
      for (const file of files) {
        const stat = await fs.stat(path.join(this.downloadDir, file));
        totalSize += stat.size;
      }
      
      return totalSize;
    } catch {
      return 0;
    }
  }

  getDownloadDirectory(): string {
    return this.downloadDir;
  }
}
