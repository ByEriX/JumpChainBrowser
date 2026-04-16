import { useEffect, useState, useRef } from 'react';
import { RefreshCw, FileText, Bookmark, Clock, FolderOpen } from 'lucide-react';
import { useFilesStore } from '../stores/filesStore';
import { useBookmarksStore } from '../stores/bookmarksStore';
import { useSettingsStore } from '../stores/settingsStore';
import FileCard from '../components/FileCard';
import LoadingSpinner from '../components/LoadingSpinner';
import EmptyState from '../components/EmptyState';

export default function HomePage() {
  const { files, isLoading, isSyncing, syncDrives, loadNewFiles, totalCount, error, clearError } = useFilesStore();
  const { loadBookmarks, bookmarks } = useBookmarksStore();
  const { lastSync, setLastSync, allowedSources, nsfwEnabled } = useSettingsStore();
  const [stats, setStats] = useState<{ totalFiles: number; totalBookmarks: number; totalDrives: number } | null>(null);
  const [isSignedIn, setIsSignedIn] = useState<boolean>(false);
  const prevIsSyncingRef = useRef<boolean>(false);

  useEffect(() => {
    // Load initial data
    const loadData = async () => {
      await loadBookmarks();
      
      // Get stats
      const statsData = await window.electronAPI.getStats();
      setStats(statsData);

      try {
        const authStatus = await window.electronAPI.getAuthStatus();
        setIsSignedIn(authStatus.configured && authStatus.authenticated);
      } catch {
        setIsSignedIn(false);
      }
      
      // Load new files from the past 7 days, filtered by settings
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      await loadNewFiles(sevenDaysAgo.toISOString(), allowedSources, nsfwEnabled);
    };
    
    loadData();
  }, [loadNewFiles, loadBookmarks, allowedSources, nsfwEnabled]);

  useEffect(() => {
    const handleAuthChanged = async () => {
      try {
        const status = await window.electronAPI.getAuthStatus();
        setIsSignedIn(status.configured && status.authenticated);
      } catch {
        setIsSignedIn(false);
      }
    };

    window.addEventListener('auth:changed', handleAuthChanged);
    return () => window.removeEventListener('auth:changed', handleAuthChanged);
  }, []);

  // Refresh stats when sync completes (transitions from true to false)
  useEffect(() => {
    const wasSyncing = prevIsSyncingRef.current;
    prevIsSyncingRef.current = isSyncing;
    
    // Only refresh if sync just completed (was syncing, now not syncing)
    if (wasSyncing && !isSyncing) {
      // Sync just completed, refresh stats and data
      const refreshData = async () => {
        // Refresh stats
        const statsData = await window.electronAPI.getStats();
        setStats(statsData);
        
        // Refresh bookmarks
        await loadBookmarks();
        
        // Reload recent files
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        await loadNewFiles(sevenDaysAgo.toISOString(), allowedSources, nsfwEnabled);
      };
      
      refreshData();
    }
  }, [isSyncing, loadNewFiles, loadBookmarks, allowedSources, nsfwEnabled]);

  const handleSync = async () => {
    if (isSyncing) {
      // Cancel ongoing sync
      await useFilesStore.getState().cancelSync();
      return;
    }
    
    const result = await syncDrives(allowedSources, nsfwEnabled);
    if (result.success) {
      setLastSync(new Date().toISOString());
      // Reload stats
      const statsData = await window.electronAPI.getStats();
      setStats(statsData);
      // Reload files with filters
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      await loadNewFiles(sevenDaysAgo.toISOString(), allowedSources, nsfwEnabled);
    }
  };

  const formatLastSync = () => {
    if (!lastSync) return 'Never synced';
    const date = new Date(lastSync);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffHours < 1) return 'Just now';
    if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white">Welcome Back</h1>
          <p className="text-gray-400 mt-1">
            <Clock size={14} className="inline mr-1" />
            Last synced: {formatLastSync()}
          </p>
        </div>
        
        <button
          onClick={handleSync}
          disabled={!isSignedIn && !isSyncing}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-lg transition-colors ${
            isSyncing 
              ? 'bg-red-600 text-white hover:bg-red-700' 
              : 'bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed'
          }`}
        >
          <RefreshCw size={18} className={isSyncing ? 'animate-spin' : ''} />
          {isSyncing ? 'Cancel Sync' : 'Sync Now'}
        </button>
      </div>

      {/* Stats Cards */}
      {!isSignedIn && (
        <div className="mb-4 rounded-lg border border-yellow-500/40 bg-yellow-500/10 p-3">
          <p className="text-sm text-yellow-200">
            You are currently signed out. Browsing indexed files still works, but syncing is disabled until you sign in again from Settings.
          </p>
        </div>
      )}

      {error && (
        <div className="mb-4 rounded-lg border border-red-500/40 bg-red-500/10 p-3">
          <div className="flex items-start justify-between gap-3">
            <p className="text-sm text-red-300 whitespace-pre-wrap">{error}</p>
            <button
              onClick={clearError}
              className="text-xs text-red-200 hover:text-white transition-colors"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-primary-500/20 rounded-lg">
              <FileText size={24} className="text-primary-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{stats?.totalFiles || totalCount || 0}</p>
              <p className="text-sm text-gray-400">Total Jumps</p>
            </div>
          </div>
        </div>
        
        <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-yellow-500/20 rounded-lg">
              <Bookmark size={24} className="text-yellow-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{stats?.totalBookmarks || bookmarks.length || 0}</p>
              <p className="text-sm text-gray-400">Bookmarked</p>
            </div>
          </div>
        </div>
        
        <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-green-500/20 rounded-lg">
              <FolderOpen size={24} className="text-green-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{stats?.totalDrives || 0}</p>
              <p className="text-sm text-gray-400">Drives Indexed</p>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Updates */}
      <div>
        <h2 className="text-xl font-semibold text-white mb-4">Recent Updates</h2>
        <p className="text-sm text-gray-500 mb-6">Files added or modified in the last 7 days</p>
        
        {isLoading ? (
          <LoadingSpinner message="Loading recent files..." />
        ) : files.length === 0 ? (
          <EmptyState
            icon={<FileText size={48} />}
            title="No Recent Updates"
            description="Click 'Sync Now' to check for new files from community drives."
            action={
              <button
                onClick={handleSync}
                disabled={isSyncing || !isSignedIn}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Sync Drives
              </button>
            }
          />
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {files.slice(0, 20).map(file => (
              <FileCard key={file.id} file={file} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
