/**
 * The one definition of "is this the home page".
 *
 * Exact spellings only. This used to also return true when ANY token in the
 * value was "home", which meant a page called "About Our Home Services" was
 * treated as the site's homepage. Matching is now on the whole value.
 *
 * There is no locale handling here: "/en" is not the home page by this
 * definition. That is a known limitation, chosen deliberately over the
 * alternative of matching any two-letter path, which would capture real pages
 * such as "/ai".
 */
const HOME_EQUIVALENTS = new Set(['home', 'homepage', 'home page', 'home-page', 'home_page']);
const SLUG_EQUIVALENTS = new Set(['', '/', 'home', 'homepage', 'index']);

export interface HomeDetectionOptions {
  allowEmpty?: boolean;
}

function normalize(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ').replace(/^\/+|\/+$/g, '');
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
    // Stripping the slashes makes '/' and '' normalise to the same empty
    // string, but they are not the same question and only one of them is the
    // caller's to decide.
    //
    // '/' is an explicit root PATH, and the root path is the home page on its
    // own — it is listed in SLUG_EQUIVALENTS and matched unconditionally before
    // the slash stripping was introduced. Nothing reaches here spelled '/'
    // except a path: a page is not titled '/', and a page type is not named
    // '/'. So it stays unconditional.
    //
    // '' is a value that is simply missing, and there the caller does decide,
    // because a missing slug may mean the root while a missing title means
    // nothing at all.
    if (value.trim().length > 0) {
      // Everything that survives to here was nothing but slashes: '/', '//'.
      return true;
    }
    return options.allowEmpty === true;
  }

  return HOME_EQUIVALENTS.has(normalized) || SLUG_EQUIVALENTS.has(normalized);
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

  // A blank slug is an unset value here, not the site root, so this asks
  // isHomeLike the default question and does not pass allowEmpty.
  //
  // The root still matches when it says so: '/' is an explicit root path and
  // 'home' is an explicit name, and both are matched below. What does NOT mean
  // the root is a slug that is missing or blank, because the code that invents
  // those is standing in for a page that does not exist — getTree() returns a
  // placeholder { title: 'Root', slug: '', websitePageId: null, children: [] }
  // for a site with no root structure, and the sitemap route returns the same
  // shape when the real root is a hidden import draft. Calling that the home
  // page would tell the site builder a site already has one when it has none,
  // and the builder would then refuse to let anyone create it.
  //
  // No guard on candidate.slug: isHomeLike already answers false for undefined,
  // null and blank strings. The guard that used to be here is what made the
  // allowEmpty it passed unreachable for '' — worth not rebuilding.
  if (isHomeLike(candidate.slug)) {
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
