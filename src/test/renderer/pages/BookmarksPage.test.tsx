import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import BookmarksPage from '../../../renderer/src/pages/BookmarksPage';

const mockStore = {
  bookmarks: [
    {
      id: 1,
      file_id: 'file-123',
      name: 'Example Jump.pdf',
      source: '4chan',
      drive_name: "DriveAnon's 4chan Drive",
      web_view_link: 'https://example.com/file-123',
      user_notes: null,
      created_at: '2026-02-17T12:00:00.000Z',
      has_local_copy: 0,
      local_path: null as string | null
    }
  ],
  isLoading: false,
  loadBookmarks: vi.fn().mockResolvedValue(undefined),
  removeBookmark: vi.fn().mockResolvedValue(undefined),
  updateNotes: vi.fn().mockResolvedValue(undefined)
};

vi.mock('../../../renderer/src/stores/bookmarksStore', () => ({
  useBookmarksStore: () => mockStore
}));

describe('BookmarksPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStore.bookmarks[0].has_local_copy = 0;
    mockStore.bookmarks[0].local_path = null;
    (window.electronAPI.getThumbnail as ReturnType<typeof vi.fn>).mockResolvedValue({ type: 'url', path: '' });
    (window.electronAPI.hasLocalCopy as ReturnType<typeof vi.fn>).mockResolvedValue({ exists: false, path: null });
    (window.electronAPI.downloadFile as ReturnType<typeof vi.fn>).mockResolvedValue('/tmp/Example Jump.pdf');
    (window.electronAPI.openFile as ReturnType<typeof vi.fn>).mockResolvedValue({ success: true });
  });

  it('reloads bookmarks after successful download', async () => {
    render(<BookmarksPage />);

    fireEvent.click(screen.getByTitle('Download'));

    await waitFor(() => {
      expect(window.electronAPI.downloadFile).toHaveBeenCalledWith('file-123', 'Example Jump.pdf');
      expect(mockStore.loadBookmarks).toHaveBeenCalled();
    });
  });

  it('opens local file instead of re-downloading when local copy exists', async () => {
    mockStore.bookmarks[0].has_local_copy = 1;
    mockStore.bookmarks[0].local_path = '/tmp/Example Jump.pdf';
    (window.electronAPI.hasLocalCopy as ReturnType<typeof vi.fn>).mockResolvedValue({
      exists: true,
      path: '/tmp/Example Jump.pdf'
    });

    render(<BookmarksPage />);

    const openLocalCopyButton = await screen.findByTitle('Open Local Copy');
    fireEvent.click(openLocalCopyButton);

    await waitFor(() => {
      expect(window.electronAPI.openFile).toHaveBeenCalledWith('/tmp/Example Jump.pdf');
      expect(window.electronAPI.downloadFile).not.toHaveBeenCalled();
    });
  });
});
