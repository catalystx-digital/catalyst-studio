// Centralized JSON size/depth constraints for API payloads

export const MAX_JSON_DEPTH = 8;
export const MAX_CONTENT_SIZE_BYTES = 262_144; // 256 KB for canonical content
export const MAX_OVERRIDES_SIZE_BYTES = 65_536; // 64 KB for per-page overrides

export function checkJSONDepth(obj: unknown, depth = 0, maxDepth = MAX_JSON_DEPTH): boolean {
  if (depth > maxDepth) return false;
  if (obj === null) return true;
  if (typeof obj !== 'object') return true;
  if (Array.isArray(obj)) {
    for (const item of obj) {
      if (!checkJSONDepth(item, depth + 1, maxDepth)) return false;
    }
    return true;
  }
  for (const value of Object.values(obj as Record<string, unknown>)) {
    if (!checkJSONDepth(value, depth + 1, maxDepth)) return false;
  }
  return true;
}

export function checkJSONSizeBytes(obj: unknown, maxBytes: number): boolean {
  try {
    const str = JSON.stringify(obj);
    return str.length <= maxBytes;
  } catch {
    return false;
  }
}

