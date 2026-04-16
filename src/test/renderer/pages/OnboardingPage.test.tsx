import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { HashRouter } from 'react-router-dom';
import OnboardingPage from '../../../renderer/src/pages/OnboardingPage';

// Mock useNavigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return {
    ...actual,
    useNavigate: () => mockNavigate
  };
});

async function renderWithRouter() {
  render(
    <HashRouter>
      <OnboardingPage />
    </HashRouter>
  );
  await waitFor(() => {
    expect(window.electronAPI.getAuthStatus).toHaveBeenCalled();
  });
}

describe('OnboardingPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (window.electronAPI.getAuthStatus as ReturnType<typeof vi.fn>).mockResolvedValue({ configured: true, authenticated: false });
    (window.electronAPI.signInWithGoogle as ReturnType<typeof vi.fn>).mockResolvedValue({ success: true });
    (window.electronAPI.openExternal as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
  });

  it('renders welcome message and instructions', async () => {
    await renderWithRouter();

    expect(screen.getByText('Welcome to JumpChain Browser')).toBeInTheDocument();
    expect(screen.getByText(/browse JumpChain PDFs from community drives/i)).toBeInTheDocument();
    expect(screen.getByText('Google OAuth Sign-In')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Sign in with Google/i })).toBeInTheDocument();
  });

  it('shows Open Google Cloud Console button', async () => {
    await renderWithRouter();
    const consoleBtn = screen.getByRole('button', { name: /Open Google Cloud Console/i });
    expect(consoleBtn).toBeInTheDocument();
  });

  it('shows View OAuth guide link', async () => {
    await renderWithRouter();
    const guideBtn = screen.getByRole('button', { name: /View OAuth guide/i });
    expect(guideBtn).toBeInTheDocument();
  });

  it('opens Google Cloud Console when button clicked', async () => {
    await renderWithRouter();
    fireEvent.click(screen.getByRole('button', { name: /Open Google Cloud Console/i }));
    expect(window.electronAPI.openExternal).toHaveBeenCalledWith('https://console.cloud.google.com/');
  });

  it('opens oauth guide when link clicked', async () => {
    await renderWithRouter();
    fireEvent.click(screen.getByRole('button', { name: /View OAuth guide/i }));
    expect(window.electronAPI.openExternal).toHaveBeenCalledWith(
      'https://developers.google.com/identity/protocols/oauth2/native-app'
    );
  });

  it('shows disabled sign-in button when OAuth is not configured', async () => {
    (window.electronAPI.getAuthStatus as ReturnType<typeof vi.fn>).mockResolvedValue({ configured: false, authenticated: false });
    await renderWithRouter();
    const signInBtn = screen.getByRole('button', { name: /Sign in with Google/i });
    expect(signInBtn).toBeDisabled();
    expect(screen.getByText(/OAuth credentials are not configured/i)).toBeInTheDocument();
  });

  it('calls signInWithGoogle and dispatches auth change on success', async () => {
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent');
    await renderWithRouter();
    fireEvent.click(screen.getByRole('button', { name: /Sign in with Google/i }));

    await waitFor(() => {
      expect(window.electronAPI.signInWithGoogle).toHaveBeenCalled();
    });
    expect(dispatchSpy).toHaveBeenCalledWith(expect.objectContaining({ type: 'auth:changed' }));
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('shows error when signInWithGoogle returns failure', async () => {
    (window.electronAPI.signInWithGoogle as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: false,
      error: 'OAuth failed'
    });
    await renderWithRouter();
    fireEvent.click(screen.getByRole('button', { name: /Sign in with Google/i }));

    expect(await screen.findByText('OAuth failed')).toBeInTheDocument();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('clears previous error on new sign-in attempt', async () => {
    (window.electronAPI.signInWithGoogle as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      success: false,
      error: 'OAuth failed'
    });
    (window.electronAPI.signInWithGoogle as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      success: true
    });
    await renderWithRouter();
    const button = screen.getByRole('button', { name: /Sign in with Google/i });
    fireEvent.click(button);
    expect(await screen.findByText('OAuth failed')).toBeInTheDocument();

    fireEvent.click(button);
    await waitFor(() => {
      expect(screen.queryByText('OAuth failed')).not.toBeInTheDocument();
    });
  });
});
