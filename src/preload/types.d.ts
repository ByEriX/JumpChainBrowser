import type {
  ElectronAPI,
  FileRecord,
  FileVariantRecord,
  FileSourceRecord,
  Bookmark,
  FileFilters,
  Stats,
  NsfwStats
} from './preload';

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

export type {
  ElectronAPI,
  FileRecord,
  FileVariantRecord,
  FileSourceRecord,
  Bookmark,
  FileFilters,
  Stats,
  NsfwStats
};
