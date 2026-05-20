const MEDIA_ALT_KEYS = ['altText', 'alt', 'description', 'caption', 'label', 'title'] as const;

export type MediaReference = {
  altText?: string | null;
};

export type MediaReferenceMap = Map<string, MediaReference>;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

export const extractAltText = (record: Record<string, unknown>): string | undefined => {
  for (const key of MEDIA_ALT_KEYS) {
    const value = record[key];
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed.length > 0) {
        return trimmed;
      }
    }
  }
  return undefined;
};

export const collectMediaReferences = (
  value: unknown,
  accumulator: MediaReferenceMap,
  visited: WeakSet<object> = new WeakSet()
): void => {
  if (value === null || value === undefined) {
    return;
  }
  if (typeof value !== 'object') {
    return;
  }
  if (visited.has(value as object)) {
    return;
  }
  visited.add(value as object);

  if (Array.isArray(value)) {
    value.forEach(item => collectMediaReferences(item, accumulator, visited));
    return;
  }

  const record = value as Record<string, unknown>;
  const mediaId = typeof record.mediaId === 'string' ? record.mediaId.trim() : '';
  if (mediaId) {
    const altCandidate = extractAltText(record);
    const existing = accumulator.get(mediaId);
    if (!existing) {
      accumulator.set(mediaId, { altText: altCandidate ?? null });
    } else if (!existing.altText && altCandidate) {
      existing.altText = altCandidate;
    }
  }

  for (const child of Object.values(record)) {
    collectMediaReferences(child, accumulator, visited);
  }
};
