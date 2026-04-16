import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { HashRouter } from 'react-router-dom';
import SettingsPage from '../../../renderer/src/pages/SettingsPage';

function renderWithRouter() {
  return render(
    <HashRouter>
      <SettingsPage />
    </HashRouter>
  );
}

describe('SettingsPage - OAuth section', () => {
  const originalLocation = window.location;

  beforeEach(() => {
    vi.clearAllMocks();
    (window.electronAPI.getAuthStatus as ReturnType<typeof vi.fn>).mockResolvedValue({
      configured: true,
      authenticated: true
    });
    (window.electronAPI.signInWithGoogle as ReturnType<typeof vi.fn>).mockResolvedValue({ success: true });
    (window.electronAPI.signOutFromGoogle as ReturnType<typeof vi.fn>).mockResolvedValue({ success: true });
    (window.electronAPI.getThumbnailCacheSize as ReturnType<typeof vi.fn>).mockResolvedValue(0);
    (window.electronAPI.getDownloadSize as ReturnType<typeof vi.fn>).mockResolvedValue(0);
    (window.electronAPI.getLastSync as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (window.electronAPI.getSetting as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...originalLocation, reload: vi.fn() }
    });
  });

  afterEach(() => {
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: originalLocation
    });
  });

  it('renders Google OAuth section', async () => {
    renderWithRouter();
    await screen.findByText('Google OAuth', {}, { timeout: 2000 });
    expect(screen.getByText('Google OAuth')).toBeInTheDocument();
  });

  it('shows configured and signed-in badges', async () => {
    renderWithRouter();
    await screen.findByText('OAuth configured', {}, { timeout: 2000 });
    expect(screen.getByText('OAuth configured')).toBeInTheDocument();
    expect(screen.getByText('Signed in')).toBeInTheDocument();
  });

  it('shows not configured status when oauth is missing', async () => {
    (window.electronAPI.getAuthStatus as ReturnType<typeof vi.fn>).mockResolvedValue({
      configured: false,
      authenticated: false
    });
    renderWithRouter();
    await screen.findByText('OAuth not configured', {}, { timeout: 2000 });
    expect(screen.getByText('OAuth not configured')).toBeInTheDocument();
    expect(screen.getByText('Signed out')).toBeInTheDocument();
  });

  it('calls signInWithGoogle when sign-in button is clicked', async () => {
    (window.electronAPI.getAuthStatus as ReturnType<typeof vi.fn>).mockResolvedValue({
      configured: true,
      authenticated: true
    });
    renderWithRouter();
    await screen.findByText('Google OAuth', {}, { timeout: 2000 });

    fireEvent.click(screen.getByRole('button', { name: /Sign in with Google/i }));

    await waitFor(() => {
      expect(window.electronAPI.signInWithGoogle).toHaveBeenCalled();
    });
  });

  it('shows error when signInWithGoogle returns failure', async () => {
    (window.electronAPI.signInWithGoogle as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: false,
      error: 'OAuth failed'
    });
    renderWithRouter();
    await screen.findByText('Google OAuth', {}, { timeout: 2000 });
    fireEvent.click(screen.getByRole('button', { name: /Sign in with Google/i }));

    expect(await screen.findByText('OAuth failed')).toBeInTheDocument();
  });

  it('calls signOutFromGoogle when sign-out button is clicked', async () => {
    renderWithRouter();
    await screen.findByText('Google OAuth', {}, { timeout: 2000 });
    fireEvent.click(screen.getByRole('button', { name: /Sign out/i }));

    await waitFor(() => {
      expect(window.electronAPI.signOutFromGoogle).toHaveBeenCalled();
    });
  });

  it('has link to Google Cloud Console', async () => {
    renderWithRouter();
    await screen.findByText('Google OAuth', {}, { timeout: 2000 });
    const consoleBtn = screen.getByRole('button', { name: /Open Google Cloud Console/i });
    expect(consoleBtn).toBeInTheDocument();
  });

  it('has link to oauth setup guide', async () => {
    renderWithRouter();
    await screen.findByText('Google OAuth', {}, { timeout: 2000 });
    const guideBtn = screen.getByRole('button', { name: /View OAuth guide/i });
    expect(guideBtn).toBeInTheDocument();
  });

  it('keeps OAuth sign-in on reset when user chooses keep', async () => {
    const confirmMock = vi
      .spyOn(window, 'confirm')
      .mockReturnValueOnce(true)
      .mockReturnValueOnce(true);
    const alertMock = vi.spyOn(window, 'alert').mockImplementation(() => {});

    renderWithRouter();
    await screen.findByText('Database Management', {}, { timeout: 2000 });
    fireEvent.click(screen.getByRole('button', { name: /Clear Database & Reset Cache/i }));

    await waitFor(() => {
      expect(window.electronAPI.clearDatabase).toHaveBeenCalledWith({ keepOAuthSignIn: true });
    });
    expect(confirmMock).toHaveBeenCalledTimes(2);
    expect(alertMock).toHaveBeenCalled();

    confirmMock.mockRestore();
    alertMock.mockRestore();
  });

  it('fully resets when user does not keep OAuth sign-in', async () => {
    const confirmMock = vi
      .spyOn(window, 'confirm')
      .mockReturnValueOnce(true)
      .mockReturnValueOnce(false);
    const alertMock = vi.spyOn(window, 'alert').mockImplementation(() => {});

    renderWithRouter();
    await screen.findByText('Database Management', {}, { timeout: 2000 });
    fireEvent.click(screen.getByRole('button', { name: /Clear Database & Reset Cache/i }));

    await waitFor(() => {
      expect(window.electronAPI.clearDatabase).toHaveBeenCalledWith({ keepOAuthSignIn: false });
    });
    expect(confirmMock).toHaveBeenCalledTimes(2);
    expect(alertMock).toHaveBeenCalled();

    confirmMock.mockRestore();
    alertMock.mockRestore();
  });

  it('keeps thumbnail cache when using keep-cache reset button', async () => {
    const confirmMock = vi
      .spyOn(window, 'confirm')
      .mockReturnValueOnce(true)
      .mockReturnValueOnce(true);
    const alertMock = vi.spyOn(window, 'alert').mockImplementation(() => {});

    renderWithRouter();
    await screen.findByText('Database Management', {}, { timeout: 2000 });
    fireEvent.click(screen.getByRole('button', { name: /Clear Database \(Keep Thumbnail Cache\)/i }));

    await waitFor(() => {
      expect(window.electronAPI.clearDatabase).toHaveBeenCalledWith({ keepOAuthSignIn: true });
    });
    expect(window.electronAPI.clearThumbnailCache).not.toHaveBeenCalled();
    expect(confirmMock).toHaveBeenCalledTimes(2);
    expect(alertMock).toHaveBeenCalled();

    confirmMock.mockRestore();
    alertMock.mockRestore();
  });
});
