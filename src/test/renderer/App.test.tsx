import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from '../../renderer/src/App';

describe('App', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (window.electronAPI.getAuthStatus as ReturnType<typeof vi.fn>).mockResolvedValue({ configured: true, authenticated: true });
    (window.electronAPI.getSetting as ReturnType<typeof vi.fn>).mockResolvedValue(null);
  });

  it('shows main app when OAuth is authenticated', async () => {
    (window.electronAPI.getAuthStatus as ReturnType<typeof vi.fn>).mockResolvedValue({ configured: true, authenticated: true });

    render(<App />);
    await screen.findByText('JumpChain Browser', {}, { timeout: 2000 });

    expect(screen.getByText('JumpChain Browser')).toBeInTheDocument();
  });

  it('shows onboarding when OAuth is not authenticated', async () => {
    (window.electronAPI.getAuthStatus as ReturnType<typeof vi.fn>).mockResolvedValue({ configured: true, authenticated: false });

    render(<App />);
    await screen.findByText('Welcome to JumpChain Browser', {}, { timeout: 2000 });

    expect(screen.getByText('Welcome to JumpChain Browser')).toBeInTheDocument();
    expect(screen.getByText('Google OAuth Sign-In')).toBeInTheDocument();
  });
});
