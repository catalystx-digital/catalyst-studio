const ROOT_SLUG_KEY = '__root__'

export { ROOT_SLUG_KEY }

export type SlugSegments = string[]

export function sanitizeSlugSegments(input: SlugSegments): SlugSegments {
  if (!Array.isArray(input)) {
    return []
  }
  return input
    .map(segment => segment.trim())
    .filter(segment => segment.length > 0)
}

export function canonicalizeSlugSegments(input: SlugSegments): SlugSegments {
  return sanitizeSlugSegments(input).map(segment => segment.toLowerCase())
}

export function canonicalSlugKey(input: SlugSegments): string {
  const canonical = canonicalizeSlugSegments(input)
  if (canonical.length === 0) {
    return ROOT_SLUG_KEY
  }
  return canonical.join('/')
}

export function slugSegmentsToPath(segments: SlugSegments): string {
  if (segments.length === 0) {
    return '/'
  }
  return `/${segments.join('/')}`
}

export function parsePathSegments(path: string): SlugSegments {
  const trimmed = path.replace(/^\/+|\/+$/g, '')
  if (!trimmed) {
    return []
  }
  return trimmed.split('/').filter(segment => segment.length > 0)
}

export function canonicalizePath(path: string): string {
  const canonicalSegments = canonicalizeSlugSegments(parsePathSegments(path))
  return slugSegmentsToPath(canonicalSegments)
}
