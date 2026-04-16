import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('better-sqlite3', () => ({
  default: class MockDatabase {}
}));

import { DatabaseManager } from '../../../main/db/database';
import type { FileRecord } from '../../../main/db/database';

describe('DatabaseManager grouped file queries', () => {
  let db: DatabaseManager & {
    getRawFilesWithFilters: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    db = Object.create(DatabaseManager.prototype) as DatabaseManager & {
      getRawFilesWithFilters: ReturnType<typeof vi.fn>;
    };
    db.getRawFilesWithFilters = vi.fn();
  });

  it('merges exact duplicates and keeps same-name different-size files separate', () => {
    const rows: FileRecord[] = [
      {
      id: 'dup-1',
      drive_id: 'drive-qq',
      name: '7th Stand User Jumpchain.pdf',
      web_view_link: 'https://example.com/dup-1',
      modified_time: '2026-01-01T00:00:00.000Z',
      md5_checksum: 'same-md5',
      size_bytes: 12345,
      version: null,
      thumbnail_path: null,
      folder_path: null,
      nsfw: 0,
      is_deleted: 0,
      created_at: '2026-01-01T00:00:00.000Z',
      drive_name: 'QQ Drive',
      source: 'QQ'
      },
      {
      id: 'dup-2',
      drive_id: 'drive-reddit',
      name: '7th Stand User.pdf',
      web_view_link: 'https://example.com/dup-2',
      modified_time: '2026-01-02T00:00:00.000Z',
      md5_checksum: 'same-md5',
      size_bytes: 12345,
      version: null,
      thumbnail_path: null,
      folder_path: null,
      nsfw: 0,
      is_deleted: 0,
      created_at: '2026-01-02T00:00:00.000Z',
      drive_name: 'Reddit Drive',
      source: 'Reddit'
      },
      {
      id: 'zelda-a',
      drive_id: 'drive-qq',
      name: 'Zelda Jump.pdf',
      web_view_link: 'https://example.com/zelda-a',
      modified_time: '2026-01-03T00:00:00.000Z',
      md5_checksum: 'zelda-md5-a',
      size_bytes: 22222,
      version: null,
      thumbnail_path: null,
      folder_path: null,
      nsfw: 0,
      is_deleted: 0,
      created_at: '2026-01-03T00:00:00.000Z',
      drive_name: 'QQ Drive',
      source: 'QQ'
      },
      {
      id: 'zelda-b',
      drive_id: 'drive-reddit',
      name: 'Zelda Jump.pdf',
      web_view_link: 'https://example.com/zelda-b',
      modified_time: '2026-01-04T00:00:00.000Z',
      md5_checksum: 'zelda-md5-b',
      size_bytes: 33333,
      version: null,
      thumbnail_path: null,
      folder_path: null,
      nsfw: 0,
      is_deleted: 0,
      created_at: '2026-01-04T00:00:00.000Z',
      drive_name: 'Reddit Drive',
      source: 'Reddit'
      }
    ];

    db.getRawFilesWithFilters.mockReturnValue(rows);

    const grouped = db.getFilesWithFilters({ sortBy: 'date', sortOrder: 'desc' });
    const sevenStand = grouped.find((item) => item.base_title === '7th Stand User');
    const zelda = grouped.filter((item) => item.base_title === 'Zelda Jump');

    expect(grouped).toHaveLength(3);
    expect(sevenStand?.variant_count).toBe(1);
    expect(sevenStand?.source_count).toBe(2);
    expect(sevenStand?.variants[0].sources).toHaveLength(2);
    expect(zelda).toHaveLength(2);
  });

  it('groups versioned files under one card and paginates by grouped count', () => {
    const rows: FileRecord[] = [
      {
        id: 'cgpt-v1',
        drive_id: 'drive-qq',
        name: 'ChatGPT Jumpchain V1.pdf',
        web_view_link: 'https://example.com/cgpt-v1',
        modified_time: '2026-01-05T00:00:00.000Z',
        md5_checksum: 'cgpt-v1',
        size_bytes: 10000,
        version: null,
        thumbnail_path: null,
        folder_path: null,
        nsfw: 0,
        is_deleted: 0,
        created_at: '2026-01-05T00:00:00.000Z',
        drive_name: 'QQ Drive',
        source: 'QQ'
      },
      {
        id: 'cgpt-v2',
        drive_id: 'drive-reddit',
        name: 'ChatGPT Jumpchain V2.pdf',
        web_view_link: 'https://example.com/cgpt-v2',
        modified_time: '2026-02-05T00:00:00.000Z',
        md5_checksum: 'cgpt-v2',
        size_bytes: 12000,
        version: null,
        thumbnail_path: null,
        folder_path: null,
        nsfw: 0,
        is_deleted: 0,
        created_at: '2026-02-05T00:00:00.000Z',
        drive_name: 'Reddit Drive',
        source: 'Reddit'
      },
      {
        id: 'solo',
        drive_id: 'drive-qq',
        name: 'Another Jump.pdf',
        web_view_link: 'https://example.com/solo',
        modified_time: '2026-01-01T00:00:00.000Z',
        md5_checksum: 'solo',
        size_bytes: 9000,
        version: null,
        thumbnail_path: null,
        folder_path: null,
        nsfw: 0,
        is_deleted: 0,
        created_at: '2026-01-01T00:00:00.000Z',
        drive_name: 'QQ Drive',
        source: 'QQ'
      }
    ];

    db.getRawFilesWithFilters.mockReturnValue(rows);

    const full = db.getFilesWithFilters({ sortBy: 'date', sortOrder: 'desc' });
    const paged = db.getFilesWithFilters({ sortBy: 'date', sortOrder: 'desc', limit: 1, offset: 1 });
    const count = db.getFileCount({});

    expect(full).toHaveLength(2);
    expect(full[0].base_title).toBe('ChatGPT');
    expect(full[0].variant_count).toBe(2);
    expect(full[0].id).toBe('cgpt-v2');
    expect(count).toBe(2);
    expect(paged).toHaveLength(1);
    expect(paged[0].base_title).toBe('Another Jump');
  });
});
