import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useFilesStore } from '../../../renderer/src/stores/filesStore';
import { mockElectronAPI } from '../../setup';
import type { FileRecord } from '../../../preload/preload';

function createFileRecord(overrides: Partial<FileRecord> = {}): FileRecord {
  return {
    id: 'file-1',
    drive_id: 'drive-1',
    name: 'Jump 1.pdf',
    web_view_link: 'https://example.com',
    modified_time: '2026-01-01T00:00:00.000Z',
    md5_checksum: null,
    size_bytes: null,
    version: null,
    thumbnail_path: null,
    folder_path: null,
    nsfw: 0,
    is_deleted: 0,
    created_at: '2026-01-01T00:00:00.000Z',
    drive_name: 'Drive One',
    source: 'QQ',
    base_title: 'Jump 1',
    group_key: 'jump1',
    variant_count: 1,
    source_count: 1,
    variants: [
      {
        id: 'file-1',
        name: 'Jump 1.pdf',
        version_label: null,
        drive_id: 'drive-1',
        drive_name: 'Drive One',
        source: 'QQ',
        web_view_link: 'https://example.com',
        modified_time: '2026-01-01T00:00:00.000Z',
        md5_checksum: null,
        size_bytes: null,
        thumbnail_path: null,
        folder_path: null,
        nsfw: 0,
        created_at: '2026-01-01T00:00:00.000Z',
        sources: [
          {
            id: 'file-1',
            drive_id: 'drive-1',
            drive_name: 'Drive One',
            source: 'QQ',
            web_view_link: 'https://example.com',
            modified_time: '2026-01-01T00:00:00.000Z',
            md5_checksum: null,
            size_bytes: null
          }
        ]
      }
    ],
    ...overrides
  };
}

describe('filesStore pagination counts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useFilesStore.setState({
      files: [],
      isLoading: false,
      isSyncing: false,
      syncProgress: '',
      error: null,
      totalCount: 0,
    });

    mockElectronAPI.getFiles.mockResolvedValue([]);
    mockElectronAPI.getFileCount.mockResolvedValue(0);
  });

  it('requests file count using active filters without limit/offset', async () => {
    const filters = {
      sources: ['QQ'],
      nsfw: false,
      bookmarkedOnly: true,
      bookmarkedIds: ['file-1', 'file-2'],
      search: 'naruto',
      sortBy: 'date' as const,
      sortOrder: 'desc' as const,
      limit: 50,
      offset: 150,
    };

    await useFilesStore.getState().loadFiles(filters);

    expect(mockElectronAPI.getFiles).toHaveBeenCalledWith(filters);
    expect(mockElectronAPI.getFileCount).toHaveBeenCalledWith({
      sources: ['QQ'],
      nsfw: false,
      bookmarkedOnly: true,
      bookmarkedIds: ['file-1', 'file-2'],
      search: 'naruto',
      sortBy: 'date',
      sortOrder: 'desc',
    });
  });

  it('uses filtered count result as totalCount', async () => {
    mockElectronAPI.getFiles.mockResolvedValue([
      createFileRecord({
        name: 'Jump 1.pdf'
      })
    ]);
    mockElectronAPI.getFileCount.mockResolvedValue(1);

    await useFilesStore.getState().loadFiles({
      search: 'Jump 1',
      limit: 50,
      offset: 0,
    });

    const state = useFilesStore.getState();
    expect(state.files).toHaveLength(1);
    expect(state.totalCount).toBe(1);
  });

  it('sends empty count filters when only pagination params are provided', async () => {
    await useFilesStore.getState().loadFiles({
      limit: 50,
      offset: 100,
    });

    expect(mockElectronAPI.getFileCount).toHaveBeenCalledWith({});
  });

  it('filters new files by variant sources', async () => {
    mockElectronAPI.getNewFiles.mockResolvedValue([
      createFileRecord({
        source: 'QQ',
        source_count: 2,
        variants: [
          {
            ...createFileRecord().variants[0],
            id: 'file-1',
            source: 'QQ',
            sources: [
              {
                id: 'file-1',
                drive_id: 'drive-1',
                drive_name: 'Drive One',
                source: 'QQ',
                web_view_link: 'https://example.com',
                modified_time: '2026-01-01T00:00:00.000Z',
                md5_checksum: null,
                size_bytes: 1000
              },
              {
                id: 'file-2',
                drive_id: 'drive-2',
                drive_name: 'Reddit Mirror',
                source: 'Reddit',
                web_view_link: 'https://example.com/2',
                modified_time: '2026-01-02T00:00:00.000Z',
                md5_checksum: null,
                size_bytes: 1000
              }
            ]
          }
        ]
      })
    ]);
    mockElectronAPI.getFileCount.mockResolvedValue(1);

    await useFilesStore.getState().loadNewFiles('2025-12-31T00:00:00.000Z', ['Reddit'], true);

    const state = useFilesStore.getState();
    expect(state.files).toHaveLength(1);
    expect(state.files[0].source_count).toBe(2);
  });
});
