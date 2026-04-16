import { describe, expect, it } from 'vitest';
import {
  compareVersionParts,
  extractVersionSuffix,
  getExactVariantKey,
  parseFileNameForGrouping
} from '../../../main/utils/fileGrouping';

describe('fileGrouping utility', () => {
  it('normalizes trailing jumpchain suffix for grouping key', () => {
    const withSuffix = parseFileNameForGrouping('7th Stand User Jumpchain.pdf');
    const withoutSuffix = parseFileNameForGrouping('7th Stand User.pdf');

    expect(withSuffix.baseKey).toBe(withoutSuffix.baseKey);
    expect(withSuffix.baseTitle).toBe('7th Stand User');
  });

  it('extracts trailing semantic version labels', () => {
    const parsed = parseFileNameForGrouping('ChatGPT Jumpchain V1.2.pdf');
    expect(parsed.baseTitle).toBe('ChatGPT');
    expect(parsed.versionLabel).toBe('v1.2');
    expect(parsed.versionParts).toEqual([1, 2]);
  });

  it('extracts trailing versions with "ver." prefix', () => {
    const parsed = parseFileNameForGrouping('ChatGPT Jumpchain ver. 1.0.pdf');
    expect(parsed.baseTitle).toBe('ChatGPT');
    expect(parsed.versionLabel).toBe('v1.0');
    expect(parsed.versionParts).toEqual([1, 0]);
  });

  it('extracts trailing bare dotted versions', () => {
    const parsed = parseFileNameForGrouping('ChatGPT Jumpchain 1.1.pdf');
    expect(parsed.baseTitle).toBe('ChatGPT');
    expect(parsed.versionLabel).toBe('v1.1');
    expect(parsed.versionParts).toEqual([1, 1]);
  });

  it('does not treat trailing non-version numbers as versions', () => {
    const parsed = parseFileNameForGrouping('Sonic 2 Jumpchain.pdf');
    expect(parsed.baseTitle).toBe('Sonic 2');
    expect(parsed.versionLabel).toBeNull();
    expect(parsed.versionParts).toEqual([]);
  });

  it('falls back cleanly when no version suffix exists', () => {
    const extracted = extractVersionSuffix('Generic Jump');
    expect(extracted.titleWithoutVersion).toBe('Generic Jump');
    expect(extracted.versionLabel).toBeNull();
    expect(extracted.versionParts).toEqual([]);
  });

  it('prefers md5 identity key and falls back to size', () => {
    expect(getExactVariantKey({ md5_checksum: 'abc123', size_bytes: 1000 })).toBe('md5:abc123');
    expect(getExactVariantKey({ md5_checksum: null, size_bytes: 1000 })).toBe('size:1000');
    expect(getExactVariantKey({ md5_checksum: null, size_bytes: null })).toBeNull();
  });

  it('compares version parts numerically', () => {
    expect(compareVersionParts([1, 10], [1, 2])).toBeGreaterThan(0);
    expect(compareVersionParts([2], [2, 0])).toBe(0);
    expect(compareVersionParts([1, 0, 1], [1, 0, 2])).toBeLessThan(0);
  });
});
