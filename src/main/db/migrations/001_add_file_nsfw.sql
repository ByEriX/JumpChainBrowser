-- Migration: Add NSFW detection at file level
-- This allows filtering NSFW content from individual files/folders,
-- not just entire drives

-- Add folder_path column to track the path within the drive
ALTER TABLE files ADD COLUMN folder_path TEXT;

-- Add nsfw flag at file level
ALTER TABLE files ADD COLUMN nsfw INTEGER DEFAULT 0;

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_files_nsfw ON files(nsfw);

-- Update existing files: mark as NSFW if name or path contains 'nsfw' (case-insensitive)
-- Note: This will only catch files with 'nsfw' in their name since folder_path is null for existing files
UPDATE files SET nsfw = 1 WHERE LOWER(name) LIKE '%nsfw%';
