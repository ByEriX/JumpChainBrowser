-- Drives table - stores information about community Google Drives
CREATE TABLE IF NOT EXISTS drives (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  source TEXT, -- '4chan', 'QQ', 'SB', 'Reddit'
  nsfw INTEGER DEFAULT 0,
  last_sync DATETIME
);

-- Files table - stores PDF metadata
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

-- Bookmarks table - user's saved jumps
CREATE TABLE IF NOT EXISTS bookmarks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  file_id TEXT NOT NULL UNIQUE,
  user_notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  has_local_copy INTEGER DEFAULT 0,
  local_path TEXT,
  FOREIGN KEY (file_id) REFERENCES files(id)
);

-- Sync history for change detection
CREATE TABLE IF NOT EXISTS sync_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sync_time DATETIME DEFAULT CURRENT_TIMESTAMP,
  new_files_count INTEGER DEFAULT 0,
  updated_files_count INTEGER DEFAULT 0
);

-- Settings table for user preferences
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_files_drive_id ON files(drive_id);
CREATE INDEX IF NOT EXISTS idx_files_modified_time ON files(modified_time);
CREATE INDEX IF NOT EXISTS idx_files_name ON files(name);
CREATE INDEX IF NOT EXISTS idx_files_nsfw ON files(nsfw);
CREATE INDEX IF NOT EXISTS idx_bookmarks_file_id ON bookmarks(file_id);
