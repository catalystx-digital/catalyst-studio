const HOME_KEYWORDS = new Set(['home', 'homepage']);
const HOME_EQUIVALENTS = new Set(['home', 'homepage', 'home page', 'home-page', 'home_page']);
const SLUG_EQUIVALENTS = new Set(['', '/', 'home', 'homepage', 'index']);

export interface HomeDetectionOptions {
  allowEmpty?: boolean;
}

const SEPARATOR_REGEX = /[\s/_-]+/g;

function normalize(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

function tokenise(value: string): string[] {
  return value
    .trim()
    .toLowerCase()
    .split(SEPARATOR_REGEX)
    .map((segment) => segment.trim())
    .filter(Boolean);
}

function hasHomeToken(tokens: string[]): boolean {
  return tokens.some((token) => HOME_KEYWORDS.has(token));
}

export function extractRequestedHomeType(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== 'object') {
    return null;
  }

  const record = metadata as Record<string, unknown>;
  const direct = record.pageType;
  if (typeof direct === 'string' && direct.trim().length > 0) {
    return direct.trim();
  }

  const classification = record.classification;
  if (classification && typeof classification === 'object') {
    const nested = (classification as Record<string, unknown>).pageType;
    if (typeof nested === 'string' && nested.trim().length > 0) {
      return nested.trim();
    }
  }

  return null;
}

export function isHomeLike(value: unknown, options: HomeDetectionOptions = {}): boolean {
  if (typeof value !== 'string') {
    return false;
  }

  const normalized = normalize(value);
  if (!normalized) {
    return options.allowEmpty === true;
  }

  if (HOME_EQUIVALENTS.has(normalized)) {
    return true;
  }

  if (SLUG_EQUIVALENTS.has(normalized)) {
    return true;
  }

  const tokens = tokenise(normalized);
  if (tokens.length === 0) {
    return false;
  }

  if (tokens.length === 1) {
    const [token] = tokens;
    if (HOME_EQUIVALENTS.has(token)) {
      return true;
    }
  }

  return hasHomeToken(tokens);
}

export interface HomeNodeCandidate {
  title?: unknown;
  slug?: unknown;
  metadata?: unknown;
}

export function isHomeNode(candidate: HomeNodeCandidate): boolean {
  if (!candidate) {
    return false;
  }

  if (candidate.slug && isHomeLike(candidate.slug, { allowEmpty: true })) {
    return true;
  }

  const requestedType = extractRequestedHomeType(candidate.metadata);
  if (requestedType && isHomeLike(requestedType)) {
    return true;
  }

  if (candidate.title && isHomeLike(candidate.title)) {
    return true;
  }

  return false;
}

export interface SitemapNodeLike {
  data?: {
    label?: unknown;
    slug?: unknown;
    metadata?: unknown;
  };
}

export function isHomeSitemapNode(node: SitemapNodeLike): boolean {
  return isHomeNode({
    title: node.data?.label,
    slug: node.data?.slug,
    metadata: node.data?.metadata,
  });
}
