/**
 * URL validation utilities for CMS components
 * Provides security-focused validation for user-provided URLs
 */

const SAFE_URL_PROTOCOLS = ['http:', 'https:', 'data:'];
const SAFE_IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'];
const SAFE_IMAGE_TRUSTED_HOSTS: Array<string | RegExp> = [
  /(^|\.)supabase\.co$/i,
  /(^|\.)supabase\.in$/i,
  /(^|\.)supabase\.net$/i,
  /(^|\.)intelligencebank\.com$/i,
];
export const SAFE_VIDEO_EXTENSIONS = [
  '.mp4',
  '.webm',
  '.ogg',
  '.mov',
  '.m3u8',
  '.mpd',
];
const SAFE_VIDEO_EMBED_HOSTS: Array<string | RegExp> = [
  /(^|\.)youtube\.com$/i,
  /^youtu\.be$/i,
  /(^|\.)youtube-nocookie\.com$/i,
  /(^|\.)vimeo\.com$/i,
  /(^|\.)player\.vimeo\.com$/i,
  /(^|\.)wistia\.com$/i,
  /(^|\.)fast\.wistia\.net$/i,
  /(^|\.)loom\.com$/i,
  /(^|\.)mux\.com$/i,
  /(^|\.)vimeocdn\.com$/i,
];
const SAFE_VIDEO_EMBED_PATHS: RegExp[] = [
  /\/embed\//i,
  /\/video\//i,
  /\/videos?\//i,
  /^\/watch/i,
  /^\/\d+$/i,
  /^\/[\w-]{8,64}$/i, // short-form IDs (e.g. youtu.be/<id>)
];

const SAFE_VIDEO_STREAM_HOSTS: Array<string | RegExp> = [
  /(^|\.)cloudfront\.net$/i,
  /(^|\.)akamaihd\.net$/i,
  /(^|\.)akamized\.net$/i,
  /(^|\.)stream\.mux\.com$/i,
  /(^|\.)vimeocdn\.com$/i,
  /(^|\.)storage\.googleapis\.com$/i,
  /(^|\.)cdn\.shopify\.com$/i,
  /(^|\.)video\.cdn\.[\w-]+$/i,
  /(^|\.)videos\.cdn\.[\w-]+$/i,
  /(^|\.)media\.[\w-]*amazonaws\.com$/i,
];

const SAFE_VIDEO_STREAM_PATHS: RegExp[] = [
  /\/hls\//i,
  /\/dash\//i,
  /\/streams?\//i,
  /\/manifests?\//i,
  /\.m3u8(\?|$)/i,
  /\.mpd(\?|$)/i,
];

/**
 * Validates if a URL is safe for use in components
 * @param url The URL to validate
 * @param options Validation options
 * @returns The validated URL or a safe fallback
 */
type UrlInput = string | Record<string, unknown> | null | undefined;

function coerceUrl(input: UrlInput): string | undefined {
  if (typeof input === 'string') {
    const trimmed = input.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }

  if (!input || typeof input !== 'object') {
    return undefined;
  }

  const record = input as Record<string, unknown>;
  const candidateKeys = [
    'src',
    'url',
    'href',
    'originalUrl',
    'value',
    'link',
    'mediaUrl',
    'publicUrl',
    'signedUrl',
    'path'
  ];

  for (const key of candidateKeys) {
    if (!(key in record)) {
      continue;
    }

    const candidate = record[key];
    if (typeof candidate === 'string') {
      const trimmed = candidate.trim();
      if (trimmed.length > 0) {
        return trimmed;
      }
    } else if (candidate && typeof candidate === 'object') {
      const nested = coerceUrl(candidate as UrlInput);
      if (nested) {
        return nested;
      }
    }
  }

  return undefined;
}

function matchesPattern(value: string, pattern: string | RegExp): boolean {
  if (typeof pattern === 'string') {
    return value.toLowerCase() === pattern.toLowerCase();
  }
  return pattern.test(value);
}

interface ValidateUrlOptions {
  allowedProtocols?: string[];
  allowedExtensions?: string[];
  trustedHosts?: Array<string | RegExp>;
  trustedPathPatterns?: RegExp[];
  fallback?: string;
}

export function validateUrl(
  url: UrlInput,
  options: ValidateUrlOptions = {},
): string {
  const candidate = coerceUrl(url);
  if (!candidate) {
    return options.fallback || '';
  }

  const {
    allowedProtocols = SAFE_URL_PROTOCOLS,
    allowedExtensions,
    trustedHosts = [],
    trustedPathPatterns = [],
    fallback = ''
  } = options;

  try {
    // Handle relative URLs
    if (candidate.startsWith('/')) {
      return candidate;
    }

    // Handle anchor-only URLs (e.g., "#", "#section")
    if (candidate.startsWith('#')) {
      return candidate;
    }

    // Parse the URL
    const parsed = new URL(candidate);
    const hostname = parsed.hostname.toLowerCase();
    const pathname = parsed.pathname;

    // Check protocol
    if (!allowedProtocols.includes(parsed.protocol)) {
      if (process.env.NODE_ENV === 'development') {
      console.warn(`Unsafe URL protocol blocked: ${parsed.protocol}`);
      }
      return fallback;
    }

    const isTrustedHost = trustedHosts.some(pattern => matchesPattern(hostname, pattern));
    const isTrustedPath = trustedPathPatterns.some(pattern => pattern.test(pathname));
    const shouldValidateExtension =
      parsed.protocol !== 'data:' &&
      allowedExtensions &&
      allowedExtensions.length > 0 &&
      !isTrustedHost &&
      !isTrustedPath;

    // Check file extension if specified
    if (shouldValidateExtension) {
      const hasValidExtension = allowedExtensions.some(ext => 
        parsed.pathname.toLowerCase().endsWith(ext)
      );
      if (!hasValidExtension) {
        if (process.env.NODE_ENV === 'development') {
        console.warn(`Invalid file extension for URL: ${candidate}`);
        }
        return fallback;
      }
    }

    return candidate;
  } catch (error) {
    // Invalid URL format
    if (process.env.NODE_ENV === 'development') {
    console.warn(`Invalid URL format: ${candidate}`, error);
    }
    return fallback;
  }
}

/**
 * Validates image URLs
 */
export function validateImageUrl(
  url: UrlInput,
  fallback = ''
): string {
  return validateUrl(url, {
    allowedExtensions: SAFE_IMAGE_EXTENSIONS,
    trustedHosts: SAFE_IMAGE_TRUSTED_HOSTS,
    fallback
  });
}

/**
 * Validates video URLs
 */
type ValidateVideoUrlOptions =
  | string
  | (ValidateUrlOptions & {
      trustedHosts?: Array<string | RegExp>;
      trustedPathPatterns?: RegExp[];
    });

export function validateVideoUrl(
  url: UrlInput,
  options: ValidateVideoUrlOptions = '',
): string {
  const resolvedOptions =
    typeof options === 'string'
      ? { fallback: options }
      : options ?? {};

  const {
    fallback = '',
    allowedExtensions = SAFE_VIDEO_EXTENSIONS,
    trustedHosts = [],
    trustedPathPatterns = [],
  } = resolvedOptions;

  return validateUrl(url, {
    allowedExtensions,
    fallback,
    trustedHosts: [
      ...SAFE_VIDEO_EMBED_HOSTS,
      ...SAFE_VIDEO_STREAM_HOSTS,
      ...trustedHosts,
    ],
    trustedPathPatterns: [
      ...SAFE_VIDEO_EMBED_PATHS,
      ...SAFE_VIDEO_STREAM_PATHS,
      ...trustedPathPatterns,
    ],
  });
}

export function isTrustedVideoEmbedUrl(candidate?: string): boolean {
  if (!candidate) {
    return false;
  }

  try {
    const parsed = new URL(candidate);
    const hostname = parsed.hostname.toLowerCase();
    const pathname = parsed.pathname;

    const hostMatch = SAFE_VIDEO_EMBED_HOSTS.some(pattern =>
      matchesPattern(hostname, pattern),
    );
    if (!hostMatch) {
      return false;
    }

    if (SAFE_VIDEO_EMBED_PATHS.length === 0) {
      return true;
    }

    return SAFE_VIDEO_EMBED_PATHS.some(pattern => pattern.test(pathname));
  } catch {
    return false;
  }
}

export function isStreamingManifestUrl(candidate?: string): boolean {
  if (!candidate) {
    return false;
  }
  return /\.(m3u8|mpd)(\?|$)/i.test(candidate);
}

/**
 * Validates CSS background pattern URLs
 */
export function validatePatternUrl(url: UrlInput): string {
  // Only allow data URLs for patterns or relative paths
  return validateUrl(url, {
    allowedProtocols: ['data:', 'https:', 'http:'],
    allowedExtensions: ['.svg', '.png'],
    fallback: ''
  });
}
