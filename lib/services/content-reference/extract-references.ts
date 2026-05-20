export interface ExtractedReference {
  targetType: 'page' | 'media';
  targetId: string;
  sourcePath: string;  // JSON path for debugging
}

/**
 * Check if object is a media reference
 * Format: { mediaId: 'id', mediaType: 'image'|'video'|'file', ... }
 */
function isMediaReference(obj: Record<string, unknown>): boolean {
  return 'mediaId' in obj && typeof obj.mediaId === 'string';
}

/**
 * Check if object is a page reference (internal link)
 * Format: { type: 'internal', pageId: 'id', path: '/...' }
 */
function isPageReference(obj: Record<string, unknown>): boolean {
  return obj.type === 'internal' && 'pageId' in obj && typeof obj.pageId === 'string';
}

/**
 * Recursively extract all references from content JSON
 */
export function extractReferences(
  content: unknown,
  path: string = ''
): ExtractedReference[] {
  const refs: ExtractedReference[] = [];

  if (!content || typeof content !== 'object') {
    return refs;
  }

  if (Array.isArray(content)) {
    content.forEach((item, index) => {
      refs.push(...extractReferences(item, `${path}[${index}]`));
    });
    return refs;
  }

  const obj = content as Record<string, unknown>;

  // Check for media reference: { mediaId, mediaType, ... }
  if (isMediaReference(obj)) {
    refs.push({
      targetType: 'media',
      targetId: obj.mediaId as string,
      sourcePath: path
    });
  }

  // Check for page reference: { type: 'internal', pageId, path }
  if (isPageReference(obj)) {
    refs.push({
      targetType: 'page',
      targetId: obj.pageId as string,
      sourcePath: path
    });
  }

  // Recurse into nested objects
  for (const [key, value] of Object.entries(obj)) {
    if (key !== 'type' && key !== 'pageId' && key !== 'mediaId') {
      const childPath = path ? `${path}.${key}` : key;
      refs.push(...extractReferences(value, childPath));
    }
  }

  return refs;
}
