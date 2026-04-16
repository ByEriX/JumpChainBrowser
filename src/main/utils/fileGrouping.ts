export interface ParsedFileName {
  originalName: string;
  displayTitle: string;
  baseTitle: string;
  baseKey: string;
  versionLabel: string | null;
  versionParts: number[];
}

export interface GroupingIdentitySource {
  md5_checksum: string | null;
  size_bytes: number | null;
}

const PDF_EXTENSION_REGEX = /\.pdf$/i;
const TRAILING_JUMPCHAIN_REGEX = /(?:[\s_-]*jumpchain)\s*$/i;
const TRAILING_VERSION_REGEX =
  /(?:[\s_-]*(?:(?:v(?:ersion)?|ver)\.?\s*(\d+(?:\.\d+)*)|(\d+\.\d+(?:\.\d+)*)))\s*$/i;
const NON_ALPHANUMERIC_REGEX = /[^a-z0-9]+/g;

export function stripPdfExtension(name: string): string {
  return name.replace(PDF_EXTENSION_REGEX, '').trim();
}

export function normalizeFileName(name: string): string {
  return stripPdfExtension(name).replace(/\s+/g, ' ').trim();
}

function removeTrailingJumpchain(title: string): string {
  return title.replace(TRAILING_JUMPCHAIN_REGEX, '').trim();
}

function parseVersionParts(rawVersion: string | null): number[] {
  if (!rawVersion) {
    return [];
  }

  const parsed = rawVersion
    .split('.')
    .map((part) => Number.parseInt(part, 10))
    .filter((value) => Number.isFinite(value));

  return parsed;
}

export function extractVersionSuffix(title: string): {
  titleWithoutVersion: string;
  versionLabel: string | null;
  versionParts: number[];
} {
  const match = title.match(TRAILING_VERSION_REGEX);
  if (!match) {
    return {
      titleWithoutVersion: title.trim(),
      versionLabel: null,
      versionParts: []
    };
  }

  const normalizedVersion = match[1] ?? match[2];
  return {
    titleWithoutVersion: title.slice(0, match.index).trim(),
    versionLabel: `v${normalizedVersion}`,
    versionParts: parseVersionParts(normalizedVersion)
  };
}

export function toTitleKey(value: string): string {
  return value
    .toLowerCase()
    .replace(NON_ALPHANUMERIC_REGEX, '')
    .trim();
}

export function parseFileNameForGrouping(name: string): ParsedFileName {
  const normalizedTitle = normalizeFileName(name);
  const withoutJumpchain = removeTrailingJumpchain(normalizedTitle);
  const { titleWithoutVersion, versionLabel, versionParts } = extractVersionSuffix(withoutJumpchain);
  const baseTitle = removeTrailingJumpchain(titleWithoutVersion) || withoutJumpchain || normalizedTitle;
  return {
    originalName: name,
    displayTitle: normalizedTitle,
    baseTitle,
    baseKey: toTitleKey(baseTitle),
    versionLabel,
    versionParts
  };
}

export function getExactVariantKey(file: GroupingIdentitySource): string | null {
  if (file.md5_checksum && file.md5_checksum.length > 0) {
    return `md5:${file.md5_checksum}`;
  }
  if (typeof file.size_bytes === 'number' && Number.isFinite(file.size_bytes) && file.size_bytes > 0) {
    return `size:${file.size_bytes}`;
  }
  return null;
}

export function compareVersionParts(a: number[], b: number[]): number {
  const maxLength = Math.max(a.length, b.length);
  for (let index = 0; index < maxLength; index += 1) {
    const aValue = a[index] ?? 0;
    const bValue = b[index] ?? 0;
    if (aValue !== bValue) {
      return aValue - bValue;
    }
  }
  return 0;
}
