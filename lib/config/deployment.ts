const STUDIO_SITE_BUILDER_PATH = '/studio/site-builder';

/**
 * Always returns true - legacy studio routes have been removed.
 * Kept for backward compatibility with existing code that checks this.
 */
export function isStudioDeployment() {
  return true;
}

export function getStudioEntryRoute() {
  return STUDIO_SITE_BUILDER_PATH;
}

interface StudioWebsiteRouteOptions {
  legacyView?: string;
  query?: Record<string, string | number | boolean | undefined>;
}

export function getStudioWebsiteRoute(websiteId: string, options: StudioWebsiteRouteOptions = {}) {
  if (!websiteId) {
    return getStudioEntryRoute();
  }

  const params = new URLSearchParams({ websiteId });
  for (const [key, rawValue] of Object.entries(options.query ?? {})) {
    if (rawValue === undefined || rawValue === null) continue;
    params.set(key, String(rawValue));
  }

  const queryString = params.toString();
  return queryString ? `${STUDIO_SITE_BUILDER_PATH}?${queryString}` : STUDIO_SITE_BUILDER_PATH;
}
