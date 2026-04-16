import { useState, useEffect } from 'react';
import { Save, Trash2, FolderOpen, HardDrive, RefreshCw, ShieldCheck, ExternalLink, LogIn, LogOut } from 'lucide-react';
import { useSettingsStore } from '../stores/settingsStore';

export default function SettingsPage() {
  const { allowedSources, nsfwEnabled, updateSettings, lastSync, refreshLastSync } = useSettingsStore();

  const [authStatus, setAuthStatus] = useState<{ configured: boolean; authenticated: boolean } | null>(null);
  const [isAuthActionLoading, setIsAuthActionLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const [localSources, setLocalSources] = useState(allowedSources);
  const [localNsfw, setLocalNsfw] = useState(nsfwEnabled);
  const [thumbnailCacheSize, setThumbnailCacheSize] = useState<number>(0);
  const [downloadSize, setDownloadSize] = useState<number>(0);
  const [isSaving, setIsSaving] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [hasConfirmedAge, setHasConfirmedAge] = useState<boolean | null>(null);

  const sources = [
    { id: '4chan', name: "DriveAnon's 4chan Drive", color: 'green' },
    { id: 'QQ', name: 'Questionable Questing', color: 'purple' },
    { id: 'SB', name: 'SpaceBattles', color: 'blue' },
    { id: 'Reddit', name: 'Reddit', color: 'orange' }
  ];

  useEffect(() => {
    const loadAuthStatus = async () => {
      try {
        const status = await window.electronAPI.getAuthStatus();
        setAuthStatus(status);
      } catch {
        setAuthStatus({ configured: false, authenticated: false });
      }
    };
    loadAuthStatus();
  }, []);

  useEffect(() => {
    // Load age confirmation status
    const loadAgeConfirmation = async () => {
      try {
        const confirmed = await window.electronAPI.getSetting<boolean>('nsfwAgeConfirmed');
        setHasConfirmedAge(confirmed === true);
      } catch {
        setHasConfirmedAge(false);
      }
    };
    loadAgeConfirmation();
  }, []);

  useEffect(() => {
    // Load cache sizes and refresh last sync
    const loadSizes = async () => {
      const [thumbSize, dlSize] = await Promise.all([
        window.electronAPI.getThumbnailCacheSize(),
        window.electronAPI.getDownloadSize()
      ]);
      setThumbnailCacheSize(thumbSize);
      setDownloadSize(dlSize);

      // Diagnostic: Log NSFW statistics to console
      const nsfwStats = await window.electronAPI.getNsfwStats();
      console.log('NSFW Statistics:', nsfwStats);
      console.log('Current nsfwEnabled setting:', nsfwEnabled);
    };
    loadSizes();
    refreshLastSync();
  }, [refreshLastSync, nsfwEnabled]);

  // Refresh last sync periodically when on this page
  useEffect(() => {
    const interval = setInterval(() => {
      refreshLastSync();
    }, 5000); // Refresh every 5 seconds

    return () => clearInterval(interval);
  }, [refreshLastSync]);

  useEffect(() => {
    setLocalSources(allowedSources);
    setLocalNsfw(nsfwEnabled);
  }, [allowedSources, nsfwEnabled]);

  const refreshAuthStatus = async () => {
    try {
      setAuthStatus(await window.electronAPI.getAuthStatus());
    } catch {
      setAuthStatus({ configured: false, authenticated: false });
    }
  };

  const handleSignInWithGoogle = async () => {
    setIsAuthActionLoading(true);
    setAuthError(null);
    try {
      const result = await window.electronAPI.signInWithGoogle();
      if (!result.success) {
        setAuthError(result.error || 'Google sign-in failed');
      }
      await refreshAuthStatus();
      if (result.success) {
        window.dispatchEvent(new Event('auth:changed'));
      }
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Google sign-in failed');
    } finally {
      setIsAuthActionLoading(false);
    }
  };

  const handleSignOutFromGoogle = async () => {
    setIsAuthActionLoading(true);
    setAuthError(null);
    try {
      await window.electronAPI.signOutFromGoogle();
      await refreshAuthStatus();
      window.dispatchEvent(new Event('auth:changed'));
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Sign-out failed');
    } finally {
      setIsAuthActionLoading(false);
    }
  };

  const handleOpenGoogleCloudConsole = () => {
    window.electronAPI.openExternal('https://console.cloud.google.com/');
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updateSettings({
        allowedSources: localSources,
        nsfwEnabled: localNsfw
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleClearThumbnailCache = async () => {
    setIsClearing(true);
    try {
      await window.electronAPI.clearThumbnailCache();
      setThumbnailCacheSize(0);
    } finally {
      setIsClearing(false);
    }
  };

  const handleOpenDownloads = async () => {
    await window.electronAPI.openDownloadFolder();
  };

  const performDatabaseReset = async (keepThumbnailCache: boolean) => {
    const confirmMessage = keepThumbnailCache
      ? 'Are you sure you want to clear all synced data while keeping thumbnail cache? This will remove indexed files and bookmarks, and you will need to sync again.'
      : 'Are you sure you want to clear all synced data and thumbnail cache? This will remove indexed files and bookmarks, and you will need to sync again.';

    if (!confirm(confirmMessage)) {
      return;
    }

    let keepOAuthSignIn = false;
    if (authStatus?.authenticated) {
      keepOAuthSignIn = confirm(
        'Keep your Google sign-in after reset?\n\nOK = Keep sign-in (recommended for quick re-sync)\nCancel = Also remove sign-in (full reset)'
      );
    }

    try {
      if (!keepThumbnailCache) {
        await window.electronAPI.clearThumbnailCache();
        setThumbnailCacheSize(0);
      }

      await window.electronAPI.clearDatabase({ keepOAuthSignIn });
      const outcome = [
        'Database cleared successfully.',
        keepThumbnailCache ? 'Thumbnail cache was kept.' : 'Thumbnail cache was cleared.',
        keepOAuthSignIn
          ? 'Your Google sign-in was kept.'
          : 'Google sign-in was removed (if previously saved).',
        'Click "Sync Now" on the home page to re-index files.'
      ];
      alert(outcome.join(' '));

      // Reload to refresh UI
      window.location.reload();
    } catch (error) {
      alert(`Failed to clear database: ${error}`);
    }
  };

  const handleClearDatabase = async () => {
    await performDatabaseReset(false);
  };

  const handleClearDatabaseKeepThumbnailCache = async () => {
    await performDatabaseReset(true);
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  };

  const formatLastSync = () => {
    if (!lastSync) return 'Never';
    return new Date(lastSync).toLocaleString();
  };

  const toggleSource = (sourceId: string) => {
    setLocalSources(prev =>
      prev.includes(sourceId)
        ? prev.filter(s => s !== sourceId)
        : [...prev, sourceId]
    );
  };

  const handleNsfwToggle = async (checked: boolean) => {
    // If enabling NSFW and user hasn't confirmed age, show confirmation
    // Show prompt if enabling (checked is true, localNsfw is false) and they haven't confirmed (null or false)
    if (checked && !localNsfw && hasConfirmedAge !== true) {
      const confirmed = confirm(
        'Age Verification Required\n\n' +
        'This content may include adult material. By enabling this option, you confirm that:\n\n' +
        '• You are 18 years of age or older\n' +
        '• You are legally allowed to view adult content in your jurisdiction\n' +
        '• You understand that this content may not be suitable for all audiences\n\n' +
        'Do you wish to proceed?'
      );

      if (!confirmed) {
        // User cancelled, don't toggle
        return;
      }

      // User confirmed, save the confirmation
      try {
        await window.electronAPI.setSetting('nsfwAgeConfirmed', true);
        setHasConfirmedAge(true);
      } catch (error) {
        console.error('Failed to save age confirmation:', error);
        // Continue anyway, but log the error
      }
    }

    // Toggle the NSFW setting
    setLocalNsfw(checked);
  };

  const hasChanges = 
    JSON.stringify(localSources.sort()) !== JSON.stringify(allowedSources.sort()) ||
    localNsfw !== nsfwEnabled;

  return (
    <div className="p-6 max-w-3xl">
      <h1 className="text-2xl font-bold text-white mb-6">Settings</h1>

      {/* Google OAuth */}
      <section className="bg-gray-800 rounded-xl border border-gray-700 p-6 mb-6">
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <ShieldCheck size={20} />
          Google OAuth
        </h2>
        <p className="text-sm text-gray-400 mb-4">
          OAuth-only authentication for syncing and browsing community drives.
        </p>
        {authStatus && (
          <div className="flex items-center gap-2 mb-4">
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-sm font-medium ${
                authStatus.configured
                  ? 'bg-blue-500/20 text-blue-300'
                  : 'bg-yellow-500/20 text-yellow-300'
              }`}
            >
              {authStatus.configured ? 'OAuth configured' : 'OAuth not configured'}
            </span>
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-sm font-medium ${
                authStatus.authenticated
                  ? 'bg-green-500/20 text-green-400'
                  : 'bg-red-500/20 text-red-400'
              }`}
            >
              {authStatus.authenticated ? 'Signed in' : 'Signed out'}
            </span>
          </div>
        )}
        <div className="flex gap-3 mb-3 flex-wrap">
          <button
            onClick={handleSignInWithGoogle}
            disabled={isAuthActionLoading || authStatus?.configured === false}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isAuthActionLoading ? <RefreshCw size={16} className="animate-spin" /> : <LogIn size={16} />}
            Sign in with Google
          </button>
          <button
            onClick={handleSignOutFromGoogle}
            disabled={isAuthActionLoading || !authStatus?.authenticated}
            className="flex items-center gap-2 px-4 py-2 bg-gray-700 text-gray-200 rounded-lg hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <LogOut size={16} />
            Sign out
          </button>
        </div>
        {authError && <p className="text-sm text-red-400 mb-3">{authError}</p>}
        <div className="flex flex-wrap gap-4">
          <button
            onClick={handleOpenGoogleCloudConsole}
            className="flex items-center gap-2 text-sm text-primary-400 hover:text-primary-300 transition-colors"
          >
            <ExternalLink size={14} />
            Open Google Cloud Console
          </button>
          <button
            onClick={() => window.electronAPI.openExternal('https://developers.google.com/identity/protocols/oauth2/native-app')}
            className="flex items-center gap-2 text-sm text-gray-400 hover:text-gray-300 transition-colors"
          >
            <ExternalLink size={14} />
            View OAuth guide
          </button>
        </div>
      </section>

      {/* Source Filters */}
      <section className="bg-gray-800 rounded-xl border border-gray-700 p-6 mb-6">
        <h2 className="text-lg font-semibold text-white mb-4">Source Drives</h2>
        <p className="text-sm text-gray-400 mb-4">
          Select which community drives to show in the browser.
        </p>
        
        <div className="space-y-3">
          {sources.map(source => (
            <label
              key={source.id}
              className="flex items-center gap-3 p-3 bg-gray-700/50 rounded-lg cursor-pointer hover:bg-gray-700 transition-colors"
            >
              <input
                type="checkbox"
                checked={localSources.includes(source.id)}
                onChange={() => toggleSource(source.id)}
                className="w-5 h-5 rounded border-gray-600 bg-gray-700 text-primary-500 focus:ring-primary-500 focus:ring-offset-gray-800"
              />
              <div className="flex-1">
                <span className="font-medium text-gray-200">{source.name}</span>
                <span className={`ml-2 px-2 py-0.5 rounded text-xs font-medium bg-${source.color}-500/20 text-${source.color}-400`}>
                  {source.id}
                </span>
              </div>
            </label>
          ))}
        </div>
      </section>

      {/* Content Filters */}
      <section className="bg-gray-800 rounded-xl border border-gray-700 p-6 mb-6">
        <h2 className="text-lg font-semibold text-white mb-4">Content Filters</h2>
        
        <label className="flex items-center gap-3 p-3 bg-gray-700/50 rounded-lg cursor-pointer hover:bg-gray-700 transition-colors">
          <input
            type="checkbox"
            checked={localNsfw}
            onChange={(e) => handleNsfwToggle(e.target.checked)}
            className="w-5 h-5 rounded border-gray-600 bg-gray-700 text-primary-500 focus:ring-primary-500 focus:ring-offset-gray-800"
          />
          <div>
            <span className="font-medium text-gray-200">Show NSFW Content</span>
            <p className="text-sm text-gray-500">Display adult content in search results</p>
          </div>
        </label>
      </section>

      {/* Storage */}
      <section className="bg-gray-800 rounded-xl border border-gray-700 p-6 mb-6">
        <h2 className="text-lg font-semibold text-white mb-4">Storage</h2>
        
        <div className="space-y-4">
          {/* Thumbnail Cache */}
          <div className="flex items-center justify-between p-4 bg-gray-700/50 rounded-lg">
            <div className="flex items-center gap-3">
              <HardDrive size={20} className="text-gray-400" />
              <div>
                <p className="font-medium text-gray-200">Thumbnail Cache</p>
                <p className="text-sm text-gray-500">{formatBytes(thumbnailCacheSize)}</p>
              </div>
            </div>
            <button
              onClick={handleClearThumbnailCache}
              disabled={isClearing || thumbnailCacheSize === 0}
              className="flex items-center gap-2 px-3 py-2 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isClearing ? (
                <RefreshCw size={16} className="animate-spin" />
              ) : (
                <Trash2 size={16} />
              )}
              Clear
            </button>
          </div>

          {/* Downloads */}
          <div className="flex items-center justify-between p-4 bg-gray-700/50 rounded-lg">
            <div className="flex items-center gap-3">
              <FolderOpen size={20} className="text-gray-400" />
              <div>
                <p className="font-medium text-gray-200">Downloaded Files</p>
                <p className="text-sm text-gray-500">{formatBytes(downloadSize)}</p>
              </div>
            </div>
            <button
              onClick={handleOpenDownloads}
              className="flex items-center gap-2 px-3 py-2 bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 transition-colors"
            >
              <FolderOpen size={16} />
              Open Folder
            </button>
          </div>
        </div>
      </section>

      {/* Sync Info & Database Management */}
      <section className="bg-gray-800 rounded-xl border border-gray-700 p-6 mb-6">
        <h2 className="text-lg font-semibold text-white mb-4">Database Management</h2>
        <p className="text-sm text-gray-400 mb-4">
          Last synchronized: <span className="text-gray-200">{formatLastSync()}</span>
        </p>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={handleClearDatabase}
            className="flex items-center gap-2 px-4 py-2 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition-colors"
          >
            <Trash2 size={18} />
            Clear Database & Reset Cache
          </button>
          <button
            onClick={handleClearDatabaseKeepThumbnailCache}
            className="flex items-center gap-2 px-4 py-2 bg-orange-500/20 text-orange-300 rounded-lg hover:bg-orange-500/30 transition-colors"
          >
            <Trash2 size={18} />
            Clear Database (Keep Thumbnail Cache)
          </button>
        </div>
        <p className="text-xs text-gray-500 mt-2">
          This will remove all synced files and bookmarks. Use this if you want to start fresh.
        </p>
      </section>

      {/* Save Button */}
      {hasChanges && (
        <div className="sticky bottom-6 flex justify-end">
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-2 px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 shadow-lg transition-colors"
          >
            {isSaving ? (
              <RefreshCw size={18} className="animate-spin" />
            ) : (
              <Save size={18} />
            )}
            Save Changes
          </button>
        </div>
      )}
    </div>
  );
}
