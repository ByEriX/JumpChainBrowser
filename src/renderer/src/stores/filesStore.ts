import { create } from 'zustand';
import type { FileRecord, FileFilters } from '../../../preload/types';

interface FilesState {
  files: FileRecord[];
  isLoading: boolean;
  isSyncing: boolean;
  syncProgress: string;
  error: string | null;
  totalCount: number;
  
  loadFiles: (filters?: FileFilters) => Promise<void>;
  loadNewFiles: (since: string, sources?: string[], nsfw?: boolean) => Promise<void>;
  syncDrives: (allowedSources?: string[], nsfwEnabled?: boolean) => Promise<{ success: boolean; newFiles: number; updatedFiles: number; errors: string[] }>;
  cancelSync: () => Promise<void>;
  setSyncProgress: (message: string) => void;
  clearError: () => void;
}

export const useFilesStore = create<FilesState>((set, get) => ({
  files: [],
  isLoading: false,
  isSyncing: false,
  syncProgress: '',
  error: null,
  totalCount: 0,

  loadFiles: async (filters = {}) => {
    set({ isLoading: true, error: null });
    try {
      const countFilters: FileFilters = { ...filters };
      delete countFilters.limit;
      delete countFilters.offset;

      const [files, count] = await Promise.all([
        window.electronAPI.getFiles(filters),
        window.electronAPI.getFileCount(countFilters)
      ]);
      set({ files, totalCount: count, isLoading: false });
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false });
    }
  },

  loadNewFiles: async (since: string, sources?: string[], nsfwEnabled?: boolean) => {
    set({ isLoading: true, error: null });
    try {
      const allFiles = await window.electronAPI.getNewFiles(since);
      
      // Filter files based on settings
      let filteredFiles = allFiles;
      
      // Filter by source if specified
      if (sources !== undefined && sources.length > 0) {
        filteredFiles = filteredFiles.filter(file => 
          file.variants.some((variant) =>
            variant.sources.some((source) => sources.includes(source.source))
          )
        );
      }
      
      // Filter NSFW content if not enabled
      if (!nsfwEnabled) {
        filteredFiles = filteredFiles.filter(file =>
          file.variants.every((variant) => variant.nsfw === 0)
        );
      }
      
      // Load total count for stats
      const count = await window.electronAPI.getFileCount();
      
      set({ files: filteredFiles, totalCount: count, isLoading: false });
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false });
    }
  },

  syncDrives: async (allowedSources?: string[], nsfwEnabled?: boolean) => {
    set({ isSyncing: true, syncProgress: 'Starting sync...', error: null });
    
    // Listen for progress updates
    const unsubscribe = window.electronAPI.onSyncProgress((message) => {
      set({ syncProgress: message });
    });
    
    try {
      const result = await window.electronAPI.syncDrives(allowedSources, nsfwEnabled);
      
      if (!result.success || result.errors.length > 0) {
        set({ error: result.errors.join('\n') });
      } else {
        set({ error: null });
      }
      
      // Reload file count
      const count = await window.electronAPI.getFileCount();
      set({ totalCount: count });
      
      return result;
    } catch (error) {
      set({ error: (error as Error).message });
      return { success: false, newFiles: 0, updatedFiles: 0, errors: [(error as Error).message] };
    } finally {
      unsubscribe();
      set({ isSyncing: false, syncProgress: '' });
    }
  },

  cancelSync: async () => {
    try {
      await window.electronAPI.cancelSync();
      set({ syncProgress: 'Cancelling...', error: null });
    } catch (error) {
      set({ error: (error as Error).message });
    }
  },

  setSyncProgress: (message) => set({ syncProgress: message }),
  clearError: () => set({ error: null })
}));
