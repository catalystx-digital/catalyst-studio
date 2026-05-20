export function formatOptimizelyDisplayName(raw?: string, fallback = 'Component'): string {
  if (!raw) {
    return fallback;
  }

  const segments = String(raw)
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean);

  if (segments.length === 0) {
    const trimmed = String(raw).trim();
    return trimmed || fallback;
  }

  return segments
    .map(segment => segment.charAt(0).toUpperCase() + segment.slice(1).toLowerCase())
    .join(' ');
}

export function buildOptimizelyContentName(type: string | undefined, ...identifiers: Array<string | number | undefined>): string {
  const base = formatOptimizelyDisplayName(type);
  const suffix = identifiers
    .map(id => (id === undefined || id === null) ? '' : String(id).trim())
    .filter(Boolean);

  return suffix.length === 0 ? base : [base, ...suffix].join(' - ');
}



