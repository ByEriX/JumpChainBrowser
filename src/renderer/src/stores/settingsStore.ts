import { create } from 'zustand';

interface SettingsState {
  allowedSources: string[];
  nsfwEnabled: boolean;
  lastSync: string | null;
  isLoading: boolean;
  
  loadSettings: () => Promise<void>;
  updateSettings: (settings: Partial<Pick<SettingsState, 'allowedSources' | 'nsfwEnabled'>>) => Promise<void>;
  setLastSync: (date: string | null) => void;
  refreshLastSync: () => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  allowedSources: ['4chan', 'QQ', 'SB', 'Reddit'],
  nsfwEnabled: false,
  lastSync: null,
  isLoading: true,

  loadSettings: async () => {
    try {
      const [sources, nsfw, lastSync] = await Promise.all([
        window.electronAPI.getSetting<string[]>('allowedSources'),
        window.electronAPI.getSetting<boolean>('nsfwEnabled'),
        window.electronAPI.getLastSync()
      ]);
      
      set({
        allowedSources: sources || ['4chan', 'QQ', 'SB', 'Reddit'],
        nsfwEnabled: nsfw || false,
        lastSync: lastSync,
        isLoading: false
      });
    } catch (error) {
      console.error('Failed to load settings:', error);
      set({ isLoading: false });
    }
  },

  updateSettings: async (newSettings) => {
    for (const [key, value] of Object.entries(newSettings)) {
      await window.electronAPI.setSetting(key, value);
    }
    set(newSettings);
  },

  setLastSync: (date) => set({ lastSync: date }),

  refreshLastSync: async () => {
    try {
      const lastSync = await window.electronAPI.getLastSync();
      set({ lastSync });
    } catch (error) {
      console.error('Failed to refresh last sync:', error);
    }
  }
}));
