import { useEffect, useState } from 'react';
import { ExternalLink, LogIn, AlertTriangle } from 'lucide-react';

const GOOGLE_CLOUD_CONSOLE_URL = 'https://console.cloud.google.com/';
const OAUTH_SETUP_GUIDE_URL = 'https://developers.google.com/identity/protocols/oauth2/native-app';

export default function OnboardingPage() {
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [authConfigured, setAuthConfigured] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadStatus = async () => {
      try {
        const status = await window.electronAPI.getAuthStatus();
        setAuthConfigured(status.configured);
      } catch {
        setAuthConfigured(false);
      }
    };
    loadStatus();
  }, []);

  const handleOpenGoogleCloudConsole = () => {
    window.electronAPI.openExternal(GOOGLE_CLOUD_CONSOLE_URL);
  };

  const handleOpenOauthGuide = () => {
    window.electronAPI.openExternal(OAUTH_SETUP_GUIDE_URL);
  };

  const handleSignIn = async () => {
    setIsSigningIn(true);
    setError(null);

    try {
      const result = await window.electronAPI.signInWithGoogle();
      if (result.success) {
        window.dispatchEvent(new Event('auth:changed'));
      } else {
        setError(result.error || 'Google sign-in failed. Please try again.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Google sign-in failed');
    } finally {
      setIsSigningIn(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center p-8">
      <div className="max-w-xl w-full">
        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold text-white mb-2">Welcome to JumpChain Browser</h1>
          <p className="text-gray-400">
            Sign in with Google to browse JumpChain PDFs from community drives.
          </p>
        </div>

        {/* Instructions */}
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-6 mb-6">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <LogIn size={20} />
            Google OAuth Sign-In
          </h2>
          <p className="text-gray-300 text-sm mb-4">
            JumpChain Browser uses Google OAuth. Clicking sign-in opens your browser so you can authorize read-only access to Google Drive.
          </p>
          {authConfigured === false && (
            <div className="mb-4 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/30 text-yellow-300 text-sm flex gap-2">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" />
              <span>
                OAuth credentials are not configured in this app instance. Set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in your environment first.
              </span>
            </div>
          )}
          <div className="flex flex-wrap gap-3">
            <button
              onClick={handleOpenGoogleCloudConsole}
              className="flex items-center gap-2 px-4 py-2 bg-gray-700 text-gray-200 rounded-lg hover:bg-gray-600 transition-colors"
            >
              <ExternalLink size={16} />
              Open Google Cloud Console
            </button>
            <button
              onClick={handleOpenOauthGuide}
              className="flex items-center gap-2 px-4 py-2 text-primary-400 hover:text-primary-300 transition-colors"
            >
              <ExternalLink size={16} />
              View OAuth guide
            </button>
          </div>
        </div>

        {error && (
          <p className="mb-4 text-sm text-red-400">{error}</p>
        )}

        {/* Sign-in button */}
        <button
          onClick={handleSignIn}
          disabled={isSigningIn || authConfigured === false}
          className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isSigningIn ? (
            <span className="animate-pulse">Waiting for Google sign-in...</span>
          ) : (
            <>
              <LogIn size={20} />
              Sign in with Google
            </>
          )}
        </button>

        <p className="text-center text-xs text-gray-500 mt-6">
          OAuth tokens are stored locally and used only for Google Drive read-only access.
        </p>
      </div>
    </div>
  );
}
