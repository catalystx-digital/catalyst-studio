export function normalizePreviewPath(input?: string | null): string {
  const raw = typeof input === 'string' ? input.trim() : ''
  if (!raw || raw === '/') {
    return '/'
  }

  const withoutQuery = raw.split(/[?#]/, 1)[0] ?? ''
  const segments = withoutQuery
    .split('/')
    .map(segment => segment.trim())
    .filter(Boolean)

  if (segments.length === 0) {
    return '/'
  }

  return `/${segments.map(encodePathSegment).join('/')}`
}

function encodePathSegment(segment: string): string {
  try {
    return encodeURIComponent(decodeURIComponent(segment))
  } catch {
    return encodeURIComponent(segment)
  }
}

export function slugSegmentsToPreviewPath(slug?: string[]): string {
  if (!Array.isArray(slug) || slug.length === 0) {
    return '/'
  }

  return normalizePreviewPath(slug.join('/'))
}

export function resolvePreviewPathInput(input: {
  path?: string | null
  page?: string | null
}): string {
  if (input.path) {
    return normalizePreviewPath(input.path)
  }

  const page = input.page?.trim()
  if (!page || page === 'home' || page === 'index') {
    return '/'
  }

  return normalizePreviewPath(page)
}
