import path from 'path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DownloadService } from '../../../main/services/downloadService';
import type { DatabaseManager } from '../../../main/db/database';

const {
  mockMkdir,
  mockWriteFile,
  mockAccess,
  mockUnlink,
  mockReaddir,
  mockStat,
  mockOpenPath,
  mockShowItemInFolder,
  mockGetPath
} = vi.hoisted(() => ({
  mockMkdir: vi.fn(),
  mockWriteFile: vi.fn(),
  mockAccess: vi.fn(),
  mockUnlink: vi.fn(),
  mockReaddir: vi.fn(),
  mockStat: vi.fn(),
  mockOpenPath: vi.fn(),
  mockShowItemInFolder: vi.fn(),
  mockGetPath: vi.fn()
}));

vi.mock('fs/promises', () => ({
  default: {
    mkdir: mockMkdir,
    writeFile: mockWriteFile,
    access: mockAccess,
    unlink: mockUnlink,
    readdir: mockReaddir,
    stat: mockStat
  }
}));

vi.mock('electron', () => ({
  app: {
    getPath: mockGetPath
  },
  shell: {
    openPath: mockOpenPath,
    showItemInFolder: mockShowItemInFolder
  }
}));

describe('DownloadService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetPath.mockReturnValue('/tmp/documents');
    mockMkdir.mockResolvedValue(undefined);
    mockWriteFile.mockResolvedValue(undefined);
    mockAccess.mockResolvedValue(undefined);
    mockUnlink.mockResolvedValue(undefined);
    mockReaddir.mockResolvedValue([]);
    mockStat.mockResolvedValue({ size: 0 });
  });

  const createService = () => {
    const dbMock = {
      getBookmarks: vi.fn().mockReturnValue([]),
      isBookmarked: vi.fn().mockReturnValue(true),
      updateBookmarkLocalCopy: vi.fn()
    } as unknown as DatabaseManager;
    return {
      service: new DownloadService(dbMock),
      dbMock
    };
  };

  it('appends .pdf when filename has no extension', async () => {
    const { service, dbMock } = createService();
    const fileId = 'abc123';
    const fileName = 'My Jump Document';
    const expectedPath = path.join('/tmp/documents', 'JumpChain Archive', 'My Jump Document.pdf');

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: async () => new ArrayBuffer(8)
    }));

    const result = await service.downloadFile(fileId, fileName);

    expect(result).toBe(expectedPath);
    expect(mockWriteFile).toHaveBeenCalledWith(expectedPath, expect.any(Buffer));
    expect((dbMock.isBookmarked as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith(fileId);
    expect((dbMock.updateBookmarkLocalCopy as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith(fileId, true, expectedPath);
  });

  it('keeps existing extension when filename already has one', () => {
    const { service } = createService();
    const result = service.getDownloadPath('file-1', 'already.pdf');

    expect(result.endsWith(path.join('JumpChain Archive', 'already.pdf'))).toBe(true);
  });

  it('falls back to fileId when sanitized filename is empty', () => {
    const { service } = createService();
    const result = service.getDownloadPath('file-xyz', '   <>:"/\\|?*   ');

    expect(result.endsWith(path.join('JumpChain Archive', 'file-xyz.pdf'))).toBe(true);
  });
});
