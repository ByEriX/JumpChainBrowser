import { create } from 'zustand';
import type { Bookmark } from '../../../preload/types';

interface BookmarksState {
  bookmarks: Bookmark[];
  bookmarkedIds: Set<string>;
  isLoading: boolean;
  error: string | null;
  
  loadBookmarks: () => Promise<void>;
  addBookmark: (fileId: string, notes?: string) => Promise<void>;
  removeBookmark: (fileId: string) => Promise<void>;
  updateNotes: (fileId: string, notes: string) => Promise<void>;
  isBookmarked: (fileId: string) => boolean;
}

export const useBookmarksStore = create<BookmarksState>((set, get) => ({
  bookmarks: [],
  bookmarkedIds: new Set(),
  isLoading: false,
  error: null,

  loadBookmarks: async () => {
    set({ isLoading: true, error: null });
    try {
      const bookmarks = await window.electronAPI.getBookmarks();
      const bookmarkedIds = new Set(bookmarks.map(b => b.file_id));
      set({ bookmarks, bookmarkedIds, isLoading: false });
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false });
    }
  },

  addBookmark: async (fileId: string, notes?: string) => {
    try {
      await window.electronAPI.addBookmark(fileId, notes);
      const { bookmarkedIds } = get();
      bookmarkedIds.add(fileId);
      set({ bookmarkedIds: new Set(bookmarkedIds) });
      // Reload to get full bookmark data
      await get().loadBookmarks();
    } catch (error) {
      set({ error: (error as Error).message });
    }
  },

  removeBookmark: async (fileId: string) => {
    try {
      await window.electronAPI.removeBookmark(fileId);
      const { bookmarkedIds, bookmarks } = get();
      bookmarkedIds.delete(fileId);
      set({
        bookmarkedIds: new Set(bookmarkedIds),
        bookmarks: bookmarks.filter(b => b.file_id !== fileId)
      });
    } catch (error) {
      set({ error: (error as Error).message });
    }
  },

  updateNotes: async (fileId: string, notes: string) => {
    try {
      await window.electronAPI.updateBookmarkNotes(fileId, notes);
      const { bookmarks } = get();
      set({
        bookmarks: bookmarks.map(b =>
          b.file_id === fileId ? { ...b, user_notes: notes } : b
        )
      });
    } catch (error) {
      set({ error: (error as Error).message });
    }
  },

  isBookmarked: (fileId: string) => {
    return get().bookmarkedIds.has(fileId);
  }
}));
