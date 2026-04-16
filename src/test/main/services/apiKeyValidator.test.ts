import { describe, it, expect, vi, beforeEach } from 'vitest';
import { validateApiKey } from '../../../main/services/apiKeyValidator';

// Mock googleapis
const mockFilesList = vi.fn();
vi.mock('googleapis', () => ({
  google: {
    drive: () => ({
      files: {
        list: mockFilesList
      }
    })
  }
}));

describe('validateApiKey', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFilesList.mockResolvedValue({ data: { files: [] } });
  });

  it('returns valid for correct API key format when Drive API succeeds', async () => {
    const result = await validateApiKey('AIzaSyValidKey123');
    expect(result).toEqual({ valid: true });
    expect(mockFilesList).toHaveBeenCalled();
  });

  it('returns invalid for empty key', async () => {
    const result = await validateApiKey('');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('required');
    expect(mockFilesList).not.toHaveBeenCalled();
  });

  it('returns invalid for whitespace-only key', async () => {
    const result = await validateApiKey('   ');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('required');
    expect(mockFilesList).not.toHaveBeenCalled();
  });

  it('returns invalid for key not starting with AIza', async () => {
    const result = await validateApiKey('invalid-key-format');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('AIza');
    expect(mockFilesList).not.toHaveBeenCalled();
  });

  it('returns invalid when API returns 403', async () => {
    mockFilesList.mockRejectedValue({ code: 403, message: 'API key invalid' });
    const result = await validateApiKey('AIzaBadKey');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Invalid');
  });

  it('returns invalid when API returns 401', async () => {
    mockFilesList.mockRejectedValue({ code: 401, message: 'Unauthorized' });
    const result = await validateApiKey('AIzaBadKey');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Invalid');
  });

  it('returns helpful error when Drive API not enabled', async () => {
    mockFilesList.mockRejectedValue({
      code: 403,
      message: 'Google Drive API has not been used in project'
    });
    const result = await validateApiKey('AIzaKey');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('not enabled');
  });

  it('trims whitespace from key before validation', async () => {
    const result = await validateApiKey('  AIzaValidKey  ');
    expect(result).toEqual({ valid: true });
    expect(mockFilesList).toHaveBeenCalled();
  });
});
