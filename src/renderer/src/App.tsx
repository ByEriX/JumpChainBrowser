import { useCallback, useEffect, useState } from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import HomePage from './pages/HomePage';
import BookmarksPage from './pages/BookmarksPage';
import SettingsPage from './pages/SettingsPage';
import BrowsePage from './pages/BrowsePage';
import OnboardingPage from './pages/OnboardingPage';
import { useSettingsStore } from './stores/settingsStore';
import LoadingSpinner from './components/LoadingSpinner';

function App() {
  const { loadSettings } = useSettingsStore();
  const [showOnboarding, setShowOnboarding] = useState<boolean | null>(null);
  const refreshAccessState = useCallback(async () => {
    try {
      const [status, stats] = await Promise.all([
        window.electronAPI.getAuthStatus(),
        window.electronAPI.getStats()
      ]);
      const isAuthenticated = status.configured && status.authenticated;
      const hasIndexedFiles = stats.totalFiles > 0;
      setShowOnboarding(!isAuthenticated && !hasIndexedFiles);
    } catch {
      // If status cannot be loaded, keep users in app unless this appears to be first run.
      setShowOnboarding(false);
    }
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  useEffect(() => {
    refreshAccessState();
  }, [refreshAccessState]);

  useEffect(() => {
    const handleAuthChanged = () => {
      void refreshAccessState();
    };

    window.addEventListener('auth:changed', handleAuthChanged);
    return () => window.removeEventListener('auth:changed', handleAuthChanged);
  }, [refreshAccessState]);

  if (showOnboarding === null) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  if (showOnboarding) {
    return (
      <HashRouter>
        <OnboardingPage />
      </HashRouter>
    );
  }

  return (
    <HashRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/browse" element={<BrowsePage />} />
          <Route path="/bookmarks" element={<BookmarksPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </Layout>
    </HashRouter>
  );
}

export default App;
