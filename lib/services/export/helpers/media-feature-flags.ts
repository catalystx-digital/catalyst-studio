const TRUTHY_VALUES = new Set(['1', 'true', 'yes', 'on']);

export const isMediaResolutionEnabled = (): boolean => {
  const raw = String(process.env.EXPORT_ENABLE_MEDIA_RESOLUTION ?? '').trim().toLowerCase();
  return raw.length > 0 && TRUTHY_VALUES.has(raw);
};

export const withMediaResolution = async <T>(enabled: boolean, fn: () => Promise<T>): Promise<T> => {
  const previous = process.env.EXPORT_ENABLE_MEDIA_RESOLUTION;
  process.env.EXPORT_ENABLE_MEDIA_RESOLUTION = enabled ? 'true' : 'false';
  try {
    return await fn();
  } finally {
    if (previous === undefined) {
      delete process.env.EXPORT_ENABLE_MEDIA_RESOLUTION;
    } else {
      process.env.EXPORT_ENABLE_MEDIA_RESOLUTION = previous;
    }
  }
};
