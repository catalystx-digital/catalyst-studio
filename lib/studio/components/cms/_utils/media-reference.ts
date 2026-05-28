import { validateImageUrl } from './url-validation';

export interface NormalizedCmsImage {
  [key: string]: unknown;
  src: string;
  alt?: string;
  originalUrl?: string;
  renditions?: Array<{
    src: string;
    width: number | null;
    height: number | null;
  }>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function normalizeString(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function repairTinyImageTransformParam(src: string): string {
  try {
    const parsed = new URL(src);
    let changed = false;

    for (const key of ['w', 'width', 'h', 'height']) {
      const raw = parsed.searchParams.get(key);
      if (!raw) continue;
      const value = Number(raw);
      if (Number.isInteger(value) && value > 0 && value < 16) {
        parsed.searchParams.delete(key);
        changed = true;
      }
    }

    return changed ? parsed.toString() : src;
  } catch {
    return src;
  }
}

export function resolveImageSource(value: unknown): string | undefined {
  if (typeof value === 'string') {
    const validated = validateImageUrl(value) || undefined;
    return validated ? repairTinyImageTransformParam(validated) : undefined;
  }

  if (!isRecord(value)) {
    return undefined;
  }

  const directUrl = resolveImageSource(value.url);
  if (directUrl) {
    return directUrl;
  }

  const src = value.src;
  if (typeof src === 'string') {
    const validated = validateImageUrl(src) || undefined;
    return validated ? repairTinyImageTransformParam(validated) : undefined;
  }

  const nestedSrc = resolveImageSource(src);
  if (nestedSrc) {
    return nestedSrc;
  }

  const originalUrl = normalizeString(value.originalUrl);
  if (originalUrl) {
    const validated = validateImageUrl(originalUrl) || undefined;
    return validated ? repairTinyImageTransformParam(validated) : undefined;
  }

  return undefined;
}

function normalizeRenditions(value: unknown): NormalizedCmsImage['renditions'] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const renditions = value
    .map(entry => {
      if (!isRecord(entry)) {
        return null;
      }

      const src = resolveImageSource(entry.src);
      if (!src) {
        return null;
      }

      return {
        src,
        width: typeof entry.width === 'number' ? entry.width : null,
        height: typeof entry.height === 'number' ? entry.height : null,
      };
    })
    .filter((entry): entry is { src: string; width: number | null; height: number | null } => Boolean(entry))
    .sort((a, b) => (a.width ?? 0) - (b.width ?? 0));

  return renditions.length > 0 ? renditions : undefined;
}

export function normalizeCmsImage(value: unknown, fallbackAlt?: string): NormalizedCmsImage | undefined {
  const src = resolveImageSource(value);
  if (!src) {
    return undefined;
  }

  if (!isRecord(value)) {
    return { src, alt: fallbackAlt };
  }

  const nested = isRecord(value.src) ? value.src : undefined;
  const nestedUrl = isRecord(nested?.url) ? nested.url : undefined;
  const renditions =
    normalizeRenditions(value.renditions) ??
    normalizeRenditions(nested?.renditions) ??
    normalizeRenditions(nestedUrl?.renditions);
  const alt = normalizeString(value.alt) ?? normalizeString(nested?.alt) ?? normalizeString(nestedUrl?.alt) ?? fallbackAlt;
  const originalUrl =
    normalizeString(value.originalUrl) ??
    normalizeString(nested?.originalUrl) ??
    normalizeString(nestedUrl?.originalUrl);

  return {
    src,
    alt,
    originalUrl,
    ...(renditions ? { renditions } : {}),
  };
}
