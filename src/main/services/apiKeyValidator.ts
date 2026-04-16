import { google } from 'googleapis';

/**
 * Validates a Google API key by making a minimal Drive API request.
 * Uses a known public folder ID to verify the key has Drive API access.
 */
export async function validateApiKey(apiKey: string): Promise<{ valid: boolean; error?: string }> {
  const trimmed = apiKey?.trim();
  if (!trimmed) {
    return { valid: false, error: 'API key is required' };
  }

  // Basic format check - Google API keys typically start with AIza
  if (!trimmed.startsWith('AIza')) {
    return { valid: false, error: 'Invalid API key format. Google API keys typically start with "AIza"' };
  }

  try {
    const drive = google.drive({ version: 'v3', auth: trimmed });
    // Minimal request: list 1 file from a known public JumpChain drive folder
    // This validates the key has Drive API access without making a heavy request
    const driveId = '1Cx7KoDkQa9qmDfJN9_CehZ0fxXEweKOu'; // DriveAnon's 4chan Drive
    await drive.files.list({
      q: `'${driveId}' in parents and mimeType='application/pdf' and trashed=false`,
      fields: 'files(id)',
      pageSize: 1,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true
    });

    return { valid: true };
  } catch (error: unknown) {
    const err = error as { code?: number; message?: string; errors?: Array<{ message?: string }> };
    const message = err.message || (err.errors?.[0]?.message) || 'Unknown error';

    if (err.code === 403) {
      if (message.includes('API has not been used') || message.includes('not enabled')) {
        return { valid: false, error: 'Google Drive API is not enabled for this key. Enable it in the Google Cloud Console.' };
      }
      if (message.includes('API key invalid') || message.includes('invalid')) {
        return { valid: false, error: 'Invalid API key. Please check that you copied the key correctly.' };
      }
      if (message.includes('restricted') || message.includes('referrer')) {
        return { valid: false, error: 'API key restrictions may be blocking access. Try "None" for application restrictions.' };
      }
      return { valid: false, error: `Access denied: ${message}` };
    }

    if (err.code === 401) {
      return { valid: false, error: 'Invalid API key. Please check that you copied the key correctly.' };
    }

    // Network or other errors
    return { valid: false, error: message };
  }
}
