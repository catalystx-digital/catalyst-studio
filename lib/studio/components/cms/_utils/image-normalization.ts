import { validateImageUrl } from './url-validation';

export interface ImageRendition {
  src: string;
  width: number | null;
  height: number | null;
}

export interface NormalizedImage {
  src: string;
  alt?: string;
  originalUrl?: string;
  renditions?: ImageRendition[];
  srcSet?: string;
  sizes?: string;
}

/**
 * Check if a value is a nested media object from runtime-media-resolver
 * Structure: { src: "url", mediaId?: "...", originalUrl?: "...", renditions?: [...] }
 */
function isNestedMediaObject(
  value: unknown
): value is { src: string; mediaId?: string; originalUrl?: string; renditions?: unknown[] } {
  return (
    typeof value === 'object' &&
    value !== null &&
    'src' in value &&
    typeof (value as Record<string, unknown>).src === 'string'
  );
}

/**
 * Normalize renditions array from various formats
 */
export function normalizeRenditions(renditions?: unknown[]): ImageRendition[] {
  if (!Array.isArray(renditions)) return [];

  return renditions
    .map(r => {
      if (!r || typeof r !== 'object') return null;
      const obj = r as Record<string, unknown>;
      const src = typeof obj.src === 'string' ? validateImageUrl(obj.src) : undefined;
      if (!src) return null;
      return {
        src,
        width: typeof obj.width === 'number' ? obj.width : null,
        height: typeof obj.height === 'number' ? obj.height : null,
      };
    })
    .filter((entry): entry is ImageRendition => Boolean(entry))
    .sort((a, b) => (a.width ?? 0) - (b.width ?? 0));
}

/**
 * Build srcSet from normalized renditions
 */
export function buildSrcSet(renditions: ImageRendition[]): string | undefined {
  if (!renditions.length) return undefined;
  const parts = renditions
    .filter(r => r.width !== null)
    .map(r => `${r.src} ${r.width}w`);
  return parts.length > 0 ? parts.join(', ') : undefined;
}

interface RawImage {
  src?: string | { src?: string; originalUrl?: string; renditions?: unknown[] };
  alt?: string;
  originalUrl?: string;
  renditions?: unknown[];
}

/**
 * Normalize an image from various input formats
 * Handles: string URL, object with src string, nested media object
 */
export function normalizeImage(
  image: string | RawImage | undefined | null,
  fallbackAlt?: string,
  defaultSizes = '100vw'
): NormalizedImage | null {
  if (!image) return null;

  // Simple string URL
  if (typeof image === 'string') {
    const src = validateImageUrl(image);
    return src ? { src, alt: fallbackAlt, originalUrl: src } : null;
  }

  let resolvedSrc: string | undefined;
  let resolvedOriginalUrl: string | undefined;
  let sourceRenditions: unknown[] | undefined;

  if (typeof image.src === 'string') {
    resolvedSrc = validateImageUrl(image.src);
    resolvedOriginalUrl = image.originalUrl;
    sourceRenditions = image.renditions;
  } else if (isNestedMediaObject(image.src)) {
    resolvedSrc = validateImageUrl(image.src.src);
    resolvedOriginalUrl = image.src.originalUrl ?? image.originalUrl;
    sourceRenditions = Array.isArray(image.src.renditions)
      ? image.src.renditions
      : image.renditions;
  }

  const renditions = normalizeRenditions(sourceRenditions);
  const fallbackSrc = resolvedSrc ?? renditions[renditions.length - 1]?.src;

  if (!fallbackSrc) return null;

  const srcSet = buildSrcSet(renditions);

  return {
    src: fallbackSrc,
    alt: image.alt || fallbackAlt,
    originalUrl: resolvedOriginalUrl ?? fallbackSrc,
    renditions: renditions.length > 0 ? renditions : undefined,
    srcSet,
    sizes: srcSet ? defaultSizes : undefined,
  };
}
