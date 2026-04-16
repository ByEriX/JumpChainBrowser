import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { app } from 'electron';
import {
  compareVersionParts,
  getExactVariantKey,
  parseFileNameForGrouping
} from '../utils/fileGrouping';

export interface Drive {
  id: string;
  name: string;
  source: string;
  nsfw: number;
  last_sync: string | null;
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
  drive_name?: string;
  source?: string;
}

export interface MergedSourceRecord {
  id: string;
  drive_id: string;
  drive_name: string;
  source: string;
  web_view_link: string;
  modified_time: string;
  md5_checksum: string | null;
  size_bytes: number | null;
}

export interface MergedVariantRecord {
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
  sources: MergedSourceRecord[];
}

export interface MergedFileRecord {
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
  variants: MergedVariantRecord[];
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
  variants?: MergedVariantRecord[];
}

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

export class DatabaseManager {
  private db: Database.Database;
  private static instance: DatabaseManager | null = null;

  constructor(dbPath?: string) {
    const userDataPath = app?.getPath('userData') || __dirname;
    const DB_PATH = dbPath || path.join(userDataPath, 'jumpchain.db');
    
    const isNew = !fs.existsSync(DB_PATH);
    
    // Ensure directory exists
    const dbDir = path.dirname(DB_PATH);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }
    
    this.db = new Database(DB_PATH);
    this.db.pragma('journal_mode = WAL');
    
    if (isNew) {
      this.initSchema();
    } else {
      // Run migrations on existing database
      this.runMigrations();
      // Always update NSFW flags after migrations to catch any missed files
      this.updateNsfwFlags();
    }
  }

  private runMigrations(): void {
    try {
      // Migration: Update old "Other" source tags to "4chan" in drives table
      const drivesUpdated = this.db.prepare(`
        UPDATE drives 
        SET source = '4chan' 
        WHERE source = 'Other'
      `).run();
      
      if (drivesUpdated.changes > 0) {
        console.log(`Migrated ${drivesUpdated.changes} drive(s) from "Other" to "4chan"`);
      }

      // Migration: Add NSFW detection at file level
      // Check if folder_path column exists
      const tableInfo = this.db.prepare(`PRAGMA table_info(files)`).all() as Array<{ name: string }>;
      const hasFolderPath = tableInfo.some(col => col.name === 'folder_path');
      const hasNsfw = tableInfo.some(col => col.name === 'nsfw');
      const hasSizeBytes = tableInfo.some(col => col.name === 'size_bytes');

      if (!hasFolderPath) {
        console.log('Adding folder_path column to files table...');
        this.db.exec(`ALTER TABLE files ADD COLUMN folder_path TEXT`);
      }

      if (!hasNsfw) {
        console.log('Adding nsfw column to files table...');
        this.db.exec(`ALTER TABLE files ADD COLUMN nsfw INTEGER DEFAULT 0`);
        this.db.exec(`CREATE INDEX IF NOT EXISTS idx_files_nsfw ON files(nsfw)`);
      }

      if (!hasSizeBytes) {
        console.log('Adding size_bytes column to files table...');
        this.db.exec(`ALTER TABLE files ADD COLUMN size_bytes INTEGER`);
      }

      // Always update NSFW flags for existing files based on name and folder_path
      // This handles cases where files were synced before NSFW detection was added
      // Only run if nsfw column exists (to avoid errors on fresh installs)
      if (hasNsfw) {
        const updated = this.db.prepare(`
          UPDATE files 
          SET nsfw = CASE 
            WHEN LOWER(name) LIKE '%nsfw%' OR 
                 (folder_path IS NOT NULL AND LOWER(folder_path) LIKE '%nsfw%') 
            THEN 1 
            ELSE 0 
          END
          WHERE nsfw = 0 AND (
            LOWER(name) LIKE '%nsfw%' OR 
            (folder_path IS NOT NULL AND LOWER(folder_path) LIKE '%nsfw%')
          )
        `).run();
        
        if (updated.changes > 0) {
          console.log(`Updated ${updated.changes} existing file(s) to mark as NSFW based on name/path`);
        }
      }
    } catch (error) {
      console.error('Error running migrations:', error);
    }
  }

  static getInstance(dbPath?: string): DatabaseManager {
    if (!DatabaseManager.instance) {
      DatabaseManager.instance = new DatabaseManager(dbPath);
    }
    return DatabaseManager.instance;
  }

  private initSchema(): void {
    const schemaPath = path.join(__dirname, 'schema.sql');
    if (fs.existsSync(schemaPath)) {
      const schema = fs.readFileSync(schemaPath, 'utf-8');
      this.db.exec(schema);
    } else {
      // Inline schema as fallback
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS drives (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          source TEXT,
          nsfw INTEGER DEFAULT 0,
          last_sync DATETIME
        );
        
        CREATE TABLE IF NOT EXISTS files (
          id TEXT PRIMARY KEY,
          drive_id TEXT NOT NULL,
          name TEXT NOT NULL,
          web_view_link TEXT,
          modified_time DATETIME,
          md5_checksum TEXT,
          size_bytes INTEGER,
          version TEXT,
          thumbnail_path TEXT,
          folder_path TEXT,
          nsfw INTEGER DEFAULT 0,
          is_deleted INTEGER DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (drive_id) REFERENCES drives(id)
        );
        
        CREATE TABLE IF NOT EXISTS bookmarks (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          file_id TEXT NOT NULL UNIQUE,
          user_notes TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          has_local_copy INTEGER DEFAULT 0,
          local_path TEXT,
          FOREIGN KEY (file_id) REFERENCES files(id)
        );
        
        CREATE TABLE IF NOT EXISTS sync_history (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          sync_time DATETIME DEFAULT CURRENT_TIMESTAMP,
          new_files_count INTEGER DEFAULT 0,
          updated_files_count INTEGER DEFAULT 0
        );
        
        CREATE TABLE IF NOT EXISTS settings (
          key TEXT PRIMARY KEY,
          value TEXT
        );
        
        CREATE INDEX IF NOT EXISTS idx_files_drive_id ON files(drive_id);
        CREATE INDEX IF NOT EXISTS idx_files_modified_time ON files(modified_time);
        CREATE INDEX IF NOT EXISTS idx_files_name ON files(name);
        CREATE INDEX IF NOT EXISTS idx_files_nsfw ON files(nsfw);
        CREATE INDEX IF NOT EXISTS idx_bookmarks_file_id ON bookmarks(file_id);
      `);
    }
  }

  // Drive operations
  upsertDrive(drive: { id: string; name: string; source: string; nsfw?: number }): void {
    const stmt = this.db.prepare(`
      INSERT INTO drives (id, name, source, nsfw, last_sync)
      VALUES (@id, @name, @source, @nsfw, NULL)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        source = excluded.source,
        nsfw = excluded.nsfw
    `);
    stmt.run({ ...drive, nsfw: drive.nsfw || 0 });
  }

  getDrives(): Drive[] {
    return this.db.prepare('SELECT * FROM drives').all() as Drive[];
  }

  getDriveLastSync(driveId: string): string | null {
    const result = this.db
      .prepare('SELECT last_sync FROM drives WHERE id = ?')
      .get(driveId) as { last_sync: string | null } | undefined;
    return result?.last_sync || null;
  }

  setDriveLastSync(driveId: string, timestamp: string): void {
    this.db.prepare('UPDATE drives SET last_sync = ? WHERE id = ?').run(timestamp, driveId);
  }

  getDriveFileCount(driveId: string): number {
    const result = this.db
      .prepare('SELECT COUNT(*) as count FROM files WHERE drive_id = ? AND is_deleted = 0')
      .get(driveId) as { count: number };
    return result.count;
  }

  // File operations
  upsertFile(file: {
    id: string;
    drive_id: string;
    name: string;
    web_view_link: string;
    modified_time: string;
    md5_checksum?: string;
    size_bytes?: number;
    folder_path?: string;
    nsfw?: number;
  }): { isNew: boolean; isUpdated: boolean } {
    const existing = this.db.prepare('SELECT md5_checksum FROM files WHERE id = ?').get(file.id) as { md5_checksum: string } | undefined;
    
    const stmt = this.db.prepare(`
      INSERT INTO files (id, drive_id, name, web_view_link, modified_time, md5_checksum, size_bytes, folder_path, nsfw)
      VALUES (@id, @drive_id, @name, @web_view_link, @modified_time, @md5_checksum, @size_bytes, @folder_path, @nsfw)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        web_view_link = excluded.web_view_link,
        modified_time = excluded.modified_time,
        md5_checksum = excluded.md5_checksum,
        size_bytes = excluded.size_bytes,
        folder_path = excluded.folder_path,
        nsfw = excluded.nsfw,
        is_deleted = 0
    `);
    stmt.run({
      ...file,
      size_bytes: typeof file.size_bytes === 'number' ? file.size_bytes : null,
      folder_path: file.folder_path || null,
      nsfw: file.nsfw || 0
    });
    
    return {
      isNew: !existing,
      isUpdated: !!existing && existing.md5_checksum !== file.md5_checksum
    };
  }

  getNewFiles(since: string): MergedFileRecord[] {
    const rows = this.db.prepare(`
      SELECT f.*, d.name as drive_name, d.source
      FROM files f
      JOIN drives d ON f.drive_id = d.id
      WHERE f.modified_time > ? AND f.is_deleted = 0
    `).all(since) as FileRecord[];

    const grouped = this.groupFiles(rows);
    return this.sortGroupedFiles(grouped, 'date', 'desc');
  }

  private buildFileFilterClause(filters: FileFilters): {
    clause: string;
    params: (string | number)[];
  } {
    let clause = `
      FROM files f
      JOIN drives d ON f.drive_id = d.id
      WHERE f.is_deleted = 0
    `;
    const params: (string | number)[] = [];

    if (filters.sources && filters.sources.length > 0) {
      const placeholders = filters.sources.map(() => '?').join(', ');
      clause += ` AND d.source IN (${placeholders})`;
      params.push(...filters.sources);
    }

    // Filter NSFW content at both drive and file level
    if (!filters.nsfw) {
      clause += ' AND d.nsfw = 0 AND f.nsfw = 0';
    } else if (filters.nsfwOnly) {
      // Only show NSFW content
      clause += ' AND (d.nsfw = 1 OR f.nsfw = 1)';
    }

    // Filter bookmarked content
    if (
      filters.bookmarkedOnly &&
      filters.bookmarkedIds &&
      filters.bookmarkedIds.length > 0
    ) {
      const placeholders = filters.bookmarkedIds.map(() => '?').join(', ');
      clause += ` AND f.id IN (${placeholders})`;
      params.push(...filters.bookmarkedIds);
    } else if (filters.bookmarkedOnly) {
      // no bookmarks, return empty result
      clause += ' AND 1 = 0';
    }

    if (filters.search) {
      clause += ' AND f.name LIKE ?';
      params.push(`%${filters.search}%`);
    }

    return { clause, params };
  }

  getFilesWithFilters(filters: FileFilters): MergedFileRecord[] {
    const unpagedFilters: FileFilters = { ...filters };
    delete unpagedFilters.limit;
    delete unpagedFilters.offset;

    const rows = this.getRawFilesWithFilters(unpagedFilters);
    const grouped = this.groupFiles(rows);
    const sorted = this.sortGroupedFiles(grouped, filters.sortBy, filters.sortOrder);

    const offset = filters.offset && filters.offset > 0 ? filters.offset : 0;
    const limit = filters.limit && filters.limit > 0 ? filters.limit : undefined;

    if (limit === undefined) {
      return offset > 0 ? sorted.slice(offset) : sorted;
    }
    return sorted.slice(offset, offset + limit);
  }

  updateThumbnailPath(fileId: string, thumbnailPath: string): void {
    this.db.prepare('UPDATE files SET thumbnail_path = ? WHERE id = ?').run(thumbnailPath, fileId);
  }

  // Bookmark operations
  addBookmark(fileId: string, notes?: string): number {
    const stmt = this.db.prepare(`
      INSERT INTO bookmarks (file_id, user_notes)
      VALUES (?, ?)
      ON CONFLICT(file_id) DO UPDATE SET user_notes = excluded.user_notes
    `);
    const result = stmt.run(fileId, notes || null);
    return result.lastInsertRowid as number;
  }

  removeBookmark(fileId: string): void {
    this.db.prepare('DELETE FROM bookmarks WHERE file_id = ?').run(fileId);
  }

  getBookmarks(): Bookmark[] {
    const bookmarks = this.db.prepare(`
      SELECT b.*, f.name, f.web_view_link, d.source, d.name as drive_name
      FROM bookmarks b
      JOIN files f ON b.file_id = f.id
      JOIN drives d ON f.drive_id = d.id
      ORDER BY b.created_at DESC
    `).all() as Bookmark[];

    if (bookmarks.length === 0) {
      return bookmarks;
    }

    const allRows = this.db.prepare(`
      SELECT f.*, d.name as drive_name, d.source
      FROM files f
      JOIN drives d ON f.drive_id = d.id
      WHERE f.is_deleted = 0
    `).all() as FileRecord[];
    const groupedFiles = this.groupFiles(allRows);

    const groupByFileId = new Map<string, MergedFileRecord>();
    for (const grouped of groupedFiles) {
      for (const variant of grouped.variants) {
        for (const source of variant.sources) {
          groupByFileId.set(source.id, grouped);
        }
      }
    }

    return bookmarks.map((bookmark) => {
      const grouped = groupByFileId.get(bookmark.file_id);
      if (!grouped) {
        return bookmark;
      }

      return {
        ...bookmark,
        base_title: grouped.base_title,
        group_key: grouped.group_key,
        variant_count: grouped.variant_count,
        source_count: grouped.source_count,
        variants: grouped.variants
      };
    });
  }

  isBookmarked(fileId: string): boolean {
    const result = this.db.prepare('SELECT 1 FROM bookmarks WHERE file_id = ?').get(fileId);
    return !!result;
  }

  updateBookmarkLocalCopy(fileId: string, hasLocalCopy: boolean, localPath?: string): void {
    this.db.prepare(`
      UPDATE bookmarks SET has_local_copy = ?, local_path = ? WHERE file_id = ?
    `).run(hasLocalCopy ? 1 : 0, localPath || null, fileId);
  }

  // Sync history operations
  recordSync(newCount: number = 0, updatedCount: number = 0): void {
    this.db.prepare(`
      INSERT INTO sync_history (new_files_count, updated_files_count)
      VALUES (?, ?)
    `).run(newCount, updatedCount);
  }

  getLastSync(): string | null {
    const result = this.db.prepare(`
      SELECT sync_time FROM sync_history ORDER BY sync_time DESC LIMIT 1
    `).get() as { sync_time: string } | undefined;
    return result?.sync_time || null;
  }

  // Settings operations
  getSetting(key: string): string | null {
    const result = this.db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined;
    return result?.value || null;
  }

  setSetting(key: string, value: string): void {
    this.db.prepare(`
      INSERT INTO settings (key, value) VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `).run(key, value);
  }

  // File count for stats and pagination
  getFileCount(filters?: FileFilters): number {
    if (!filters) {
      const result = this.db
        .prepare('SELECT COUNT(*) as count FROM files WHERE is_deleted = 0')
        .get() as { count: number };
      return result.count;
    }

    const grouped = this.getFilesWithFilters({
      ...filters,
      limit: undefined,
      offset: undefined
    });
    return grouped.length;
  }

  private getRawFilesWithFilters(filters: FileFilters): FileRecord[] {
    const { clause, params } = this.buildFileFilterClause(filters);
    const query = `
      SELECT f.*, d.name as drive_name, d.source
      ${clause}
    `;
    return this.db.prepare(query).all(...params) as FileRecord[];
  }

  private groupFiles(rows: FileRecord[]): MergedFileRecord[] {
    interface ParsedRow {
      row: FileRecord;
      baseKey: string;
      baseTitle: string;
      versionLabel: string | null;
      versionParts: number[];
      exactKey: string | null;
    }

    interface VariantAccumulator {
      key: string;
      versionLabel: string | null;
      versionParts: number[];
      newestRow: FileRecord;
      sources: MergedSourceRecord[];
    }

    interface GroupAccumulator {
      baseTitle: string;
      baseKey: string;
      variants: Map<string, VariantAccumulator>;
    }

    const rowsByBaseKey = new Map<string, ParsedRow[]>();
    for (const row of rows) {
      const parsed = parseFileNameForGrouping(row.name);
      const baseKey = parsed.baseKey || row.id;
      const baseTitle = parsed.baseTitle || parsed.displayTitle || row.name;
      const parsedRows = rowsByBaseKey.get(baseKey);
      const entry: ParsedRow = {
        row,
        baseKey,
        baseTitle,
        versionLabel: parsed.versionLabel,
        versionParts: parsed.versionParts,
        exactKey: getExactVariantKey(row)
      };
      if (parsedRows) {
        parsedRows.push(entry);
      } else {
        rowsByBaseKey.set(baseKey, [entry]);
      }
    }

    const groups = new Map<string, GroupAccumulator>();
    for (const entries of rowsByBaseKey.values()) {
      const hasVersionLabel = entries.some((entry) => entry.versionLabel !== null);
      for (const entry of entries) {
        const variantKey = entry.exactKey ?? `file:${entry.row.id}`;
        const groupMapKey = hasVersionLabel
          ? entry.baseKey
          : `${entry.baseKey}::${variantKey}`;

        let group = groups.get(groupMapKey);
        if (!group) {
          group = {
            baseTitle: entry.baseTitle,
            baseKey: groupMapKey,
            variants: new Map<string, VariantAccumulator>()
          };
          groups.set(groupMapKey, group);
        }

        let variant = group.variants.get(variantKey);
        if (!variant) {
          variant = {
            key: variantKey,
            versionLabel: entry.versionLabel,
            versionParts: entry.versionParts,
            newestRow: entry.row,
            sources: []
          };
          group.variants.set(variantKey, variant);
        } else if (new Date(entry.row.modified_time).getTime() > new Date(variant.newestRow.modified_time).getTime()) {
          variant.newestRow = entry.row;
        }

        const sourceExists = variant.sources.some((source) => source.id === entry.row.id);
        if (!sourceExists) {
          variant.sources.push({
            id: entry.row.id,
            drive_id: entry.row.drive_id,
            drive_name: entry.row.drive_name || '',
            source: entry.row.source || '',
            web_view_link: entry.row.web_view_link,
            modified_time: entry.row.modified_time,
            md5_checksum: entry.row.md5_checksum,
            size_bytes: entry.row.size_bytes
          });
        }
      }
    }

    const merged: MergedFileRecord[] = [];
    for (const group of groups.values()) {
      const variants = Array.from(group.variants.values())
        .sort((left, right) => {
          const dateDiff = new Date(right.newestRow.modified_time).getTime() - new Date(left.newestRow.modified_time).getTime();
          if (dateDiff !== 0) {
            return dateDiff;
          }
          return compareVersionParts(right.versionParts, left.versionParts);
        })
        .map<MergedVariantRecord>((variant) => {
          const newestRow = variant.newestRow;
          const sortedSources = [...variant.sources].sort(
            (left, right) => new Date(right.modified_time).getTime() - new Date(left.modified_time).getTime()
          );
          return {
            id: newestRow.id,
            name: newestRow.name,
            version_label: variant.versionLabel,
            drive_id: newestRow.drive_id,
            drive_name: newestRow.drive_name || '',
            source: newestRow.source || '',
            web_view_link: newestRow.web_view_link,
            modified_time: newestRow.modified_time,
            md5_checksum: newestRow.md5_checksum,
            size_bytes: newestRow.size_bytes,
            thumbnail_path: newestRow.thumbnail_path,
            folder_path: newestRow.folder_path,
            nsfw: newestRow.nsfw,
            created_at: newestRow.created_at,
            sources: sortedSources
          };
        });

      const primary = variants[0];
      if (!primary) {
        continue;
      }

      const sourceCount = variants.reduce((count, variant) => count + variant.sources.length, 0);
      merged.push({
        id: primary.id,
        drive_id: primary.drive_id,
        name: primary.name,
        web_view_link: primary.web_view_link,
        modified_time: primary.modified_time,
        md5_checksum: primary.md5_checksum,
        size_bytes: primary.size_bytes,
        version: primary.version_label,
        thumbnail_path: primary.thumbnail_path,
        folder_path: primary.folder_path,
        nsfw: primary.nsfw,
        is_deleted: 0,
        created_at: primary.created_at,
        drive_name: primary.drive_name,
        source: primary.source,
        base_title: group.baseTitle,
        group_key: group.baseKey,
        variant_count: variants.length,
        source_count: sourceCount,
        variants
      });
    }

    return merged;
  }

  private sortGroupedFiles(
    rows: MergedFileRecord[],
    sortBy: FileFilters['sortBy'],
    sortOrder: FileFilters['sortOrder']
  ): MergedFileRecord[] {
    const direction = sortOrder === 'asc' ? 1 : -1;
    return [...rows].sort((left, right) => {
      switch (sortBy) {
        case 'name':
          return left.base_title.localeCompare(right.base_title, undefined, { sensitivity: 'base' }) * direction;
        case 'source': {
          const sourceDiff = left.source.localeCompare(right.source, undefined, { sensitivity: 'base' });
          if (sourceDiff !== 0) {
            return sourceDiff * direction;
          }
          return left.base_title.localeCompare(right.base_title, undefined, { sensitivity: 'base' }) * direction;
        }
        case 'date':
        default: {
          const dateDiff =
            new Date(left.modified_time).getTime() - new Date(right.modified_time).getTime();
          return dateDiff * direction;
        }
      }
    });
  }

  getBookmarkCount(): number {
    const result = this.db.prepare('SELECT COUNT(*) as count FROM bookmarks').get() as { count: number };
    return result.count;
  }

  // Update NSFW flags for all files based on name and folder_path
  // Useful for fixing existing databases or re-evaluating NSFW status
  // Only updates files where the NSFW flag doesn't match the detected value
  updateNsfwFlags(): { updated: number } {
    // Update files that should be NSFW but aren't marked
    const markNsfw = this.db.prepare(`
      UPDATE files 
      SET nsfw = 1
      WHERE nsfw = 0 AND (
        LOWER(name) LIKE '%nsfw%' OR 
        (folder_path IS NOT NULL AND LOWER(folder_path) LIKE '%nsfw%')
      )
    `).run();

    // Update files that are marked NSFW but shouldn't be
    const unmarkNsfw = this.db.prepare(`
      UPDATE files 
      SET nsfw = 0
      WHERE nsfw = 1 AND 
        LOWER(name) NOT LIKE '%nsfw%' AND 
        (folder_path IS NULL OR LOWER(folder_path) NOT LIKE '%nsfw%')
    `).run();
    
    const totalUpdated = markNsfw.changes + unmarkNsfw.changes;
    console.log(`NSFW flags updated: ${markNsfw.changes} marked, ${unmarkNsfw.changes} unmarked`);
    return { updated: totalUpdated };
  }

  // Diagnostic: Get NSFW statistics
  getNsfwStats(): { 
    totalFiles: number; 
    nsfwFiles: number; 
    nsfwDrives: number;
    filesWithNsfwInPath: number;
    filesWithNsfwInName: number;
  } {
    const totalFiles = (this.db.prepare('SELECT COUNT(*) as count FROM files WHERE is_deleted = 0').get() as { count: number }).count;
    const nsfwFiles = (this.db.prepare('SELECT COUNT(*) as count FROM files WHERE nsfw = 1 AND is_deleted = 0').get() as { count: number }).count;
    const nsfwDrives = (this.db.prepare('SELECT COUNT(*) as count FROM drives WHERE nsfw = 1').get() as { count: number }).count;
    const filesWithNsfwInPath = (this.db.prepare(`
      SELECT COUNT(*) as count FROM files 
      WHERE folder_path IS NOT NULL AND LOWER(folder_path) LIKE '%nsfw%' AND is_deleted = 0
    `).get() as { count: number }).count;
    const filesWithNsfwInName = (this.db.prepare(`
      SELECT COUNT(*) as count FROM files 
      WHERE LOWER(name) LIKE '%nsfw%' AND is_deleted = 0
    `).get() as { count: number }).count;
    
    return { totalFiles, nsfwFiles, nsfwDrives, filesWithNsfwInPath, filesWithNsfwInName };
  }

  // Clear all data
  clearAll(): void {
    this.db.exec(`
      DELETE FROM bookmarks;
      DELETE FROM files;
      DELETE FROM sync_history;
      DELETE FROM settings;
      DELETE FROM drives;
    `);
  }

  close(): void {
    this.db.close();
  }
}
