import http from 'http';
import { randomBytes } from 'crypto';
import { google } from 'googleapis';
import type { OAuth2Client } from 'google-auth-library';
import type { Credentials } from 'google-auth-library';
import { DatabaseManager } from '../db/database';

const OAUTH_TOKENS_KEY = 'googleOAuthTokens';

const DRIVE_READONLY_SCOPE = 'https://www.googleapis.com/auth/drive.readonly';
const DEFAULT_REDIRECT_URI = 'http://localhost:53682/oauth2callback';

interface AuthStatus {
  configured: boolean;
  authenticated: boolean;
}

interface AuthResult {
  success: boolean;
  error?: string;
}

export class OAuthService {
  private db: DatabaseManager;

  constructor(db: DatabaseManager) {
    this.db = db;
  }

  isConfigured(): boolean {
    return !!(this.getClientId() && this.getClientSecret());
  }

  async getAuthStatus(): Promise<AuthStatus> {
    if (!this.isConfigured()) {
      return { configured: false, authenticated: false };
    }

    const client = this.createClient();
    if (!client) {
      return { configured: false, authenticated: false };
    }

    const credentials = this.loadCredentials();
    if (!credentials) {
      return { configured: true, authenticated: false };
    }

    client.setCredentials(credentials);

    try {
      const accessToken = await client.getAccessToken();
      return { configured: true, authenticated: !!accessToken.token };
    } catch {
      return { configured: true, authenticated: false };
    }
  }

  async signIn(openExternal: (url: string) => Promise<void> | void): Promise<AuthResult> {
    if (!this.isConfigured()) {
      return {
        success: false,
        error: 'OAuth is not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET via environment variables or injected build config.'
      };
    }

    const client = this.createClient();
    if (!client) {
      return { success: false, error: 'Failed to initialize OAuth client.' };
    }

    const state = randomBytes(16).toString('hex');
    const redirect = new URL(this.getRedirectUri());
    if (redirect.hostname !== 'localhost' && redirect.hostname !== '127.0.0.1') {
      return { success: false, error: 'OAuth redirect URI must use localhost for this app.' };
    }
    if (!redirect.port) {
      return { success: false, error: 'OAuth redirect URI must include an explicit localhost port.' };
    }

    const authUrl = client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: [DRIVE_READONLY_SCOPE],
      state
    });

    const waitForCode = new Promise<string>((resolve, reject) => {
      const server = http.createServer((req, res) => {
        const requestUrl = req.url ? new URL(req.url, this.getRedirectUri()) : null;
        if (!requestUrl) {
          res.writeHead(400);
          res.end('Invalid request');
          return;
        }

        const code = requestUrl.searchParams.get('code');
        const receivedState = requestUrl.searchParams.get('state');
        const error = requestUrl.searchParams.get('error');

        if (error) {
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end('<html><body><h3>Sign-in cancelled.</h3><p>You can close this tab and return to JumpChain Browser.</p></body></html>');
          server.close();
          reject(new Error(`OAuth error: ${error}`));
          return;
        }

        if (!code || receivedState !== state) {
          res.writeHead(400, { 'Content-Type': 'text/html' });
          res.end('<html><body><h3>Invalid OAuth response.</h3><p>You can close this tab and try again.</p></body></html>');
          server.close();
          reject(new Error('Invalid OAuth callback response.'));
          return;
        }

        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end('<html><body><h3>Sign-in complete.</h3><p>You can close this tab and return to JumpChain Browser.</p></body></html>');
        server.close();
        resolve(code);
      });

      server.on('error', (err) => reject(err));

      server.listen(Number(redirect.port), redirect.hostname);

      setTimeout(() => {
        server.close();
        reject(new Error('OAuth sign-in timed out.'));
      }, 2 * 60 * 1000);
    });

    try {
      await openExternal(authUrl);
      const code = await waitForCode;
      const tokenResponse = await client.getToken(code);
      const tokens = tokenResponse.tokens;

      if (!tokens.access_token && !tokens.refresh_token) {
        return { success: false, error: 'Google did not return OAuth tokens.' };
      }

      client.setCredentials(tokens);
      this.saveCredentials(tokens);

      return { success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'OAuth sign-in failed';
      return { success: false, error: message };
    }
  }

  async signOut(): Promise<void> {
    const client = this.createClient();
    const credentials = this.loadCredentials();

    if (client && credentials?.access_token) {
      try {
        await client.revokeToken(credentials.access_token);
      } catch {
        // Revocation failure should not block local sign-out.
      }
    }

    this.db.setSetting(OAUTH_TOKENS_KEY, '');
  }

  async getAuthorizedClient(): Promise<OAuth2Client | null> {
    if (!this.isConfigured()) {
      return null;
    }

    const client = this.createClient();
    if (!client) {
      return null;
    }

    const credentials = this.loadCredentials();
    if (!credentials) {
      return null;
    }

    client.setCredentials(credentials);

    client.on('tokens', (tokens) => {
      const merged: Credentials = { ...client.credentials, ...tokens };
      this.saveCredentials(merged);
    });

    try {
      await client.getAccessToken();
      return client;
    } catch {
      return null;
    }
  }

  private createClient(): OAuth2Client | null {
    const clientId = this.getClientId();
    const clientSecret = this.getClientSecret();
    const redirectUri = this.getRedirectUri();
    if (!clientId || !clientSecret) {
      return null;
    }
    return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
  }

  private getClientId(): string | null {
    return process.env.GOOGLE_CLIENT_ID || null;
  }

  private getClientSecret(): string | null {
    return process.env.GOOGLE_CLIENT_SECRET || null;
  }

  private getRedirectUri(): string {
    return process.env.OAUTH_REDIRECT_URI || DEFAULT_REDIRECT_URI;
  }

  private loadCredentials(): Credentials | null {
    const raw = this.db.getSetting(OAUTH_TOKENS_KEY);
    if (!raw) {
      return null;
    }

    try {
      return JSON.parse(raw) as Credentials;
    } catch {
      return null;
    }
  }

  private saveCredentials(credentials: Credentials): void {
    this.db.setSetting(OAUTH_TOKENS_KEY, JSON.stringify(credentials));
  }
}
