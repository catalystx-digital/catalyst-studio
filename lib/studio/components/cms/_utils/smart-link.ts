const SCHEME_PATTERN = /^[a-z][a-z0-9+.-]*:/i;

export function isSafeSmartLinkHref(href: string): boolean {
  const trimmed = href.trim();
  const lower = trimmed.toLowerCase();

  if (!trimmed || /\s/.test(trimmed) || lower.startsWith('javascript:') || lower.startsWith('data:')) {
    return false;
  }

  if (trimmed.startsWith('//')) {
    return false;
  }

  if (
    trimmed.startsWith('/') ||
    trimmed.startsWith('#') ||
    trimmed.startsWith('?') ||
    trimmed.startsWith('./') ||
    trimmed.startsWith('../')
  ) {
    return true;
  }

  if (SCHEME_PATTERN.test(trimmed)) {
    if (lower.startsWith('mailto:') || lower.startsWith('tel:')) {
      return true;
    }

    try {
      const parsed = new URL(trimmed);
      return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
      return false;
    }
  }

  return false;
}

export function resolveSmartLinkHref(raw: unknown): string | undefined {
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    return isSafeSmartLinkHref(trimmed) ? trimmed : undefined;
  }

  if (!raw || typeof raw !== 'object') {
    return undefined;
  }

  const record = raw as Record<string, unknown>;

  if (!record.type && 'href' in record) {
    return resolveSmartLinkHref(record.href);
  }

  if (record.type === 'internal') {
    const href = typeof record.path === 'string' ? record.path.trim() : '';
    return isSafeSmartLinkHref(href) ? href : undefined;
  }

  if (record.type === 'external') {
    const href = typeof record.url === 'string' ? record.url.trim() : '';
    if (!isSafeSmartLinkHref(href)) return undefined;
    const lower = href.toLowerCase();
    return lower.startsWith('http://') || lower.startsWith('https://') ? href : undefined;
  }

  if (record.type === 'email') {
    const href = typeof record.href === 'string' ? record.href.trim() : '';
    if (!href) return undefined;
    const resolved = href.startsWith('mailto:') ? href : `mailto:${href}`;
    return isSafeSmartLinkHref(resolved) ? resolved : undefined;
  }

  if (record.type === 'phone') {
    const href = typeof record.href === 'string' ? record.href.trim() : '';
    if (!href) return undefined;
    const resolved = href.startsWith('tel:') ? href : `tel:${href}`;
    return isSafeSmartLinkHref(resolved) ? resolved : undefined;
  }

  if (record.type === 'anchor') {
    const href = typeof record.href === 'string' ? record.href.trim() : '';
    return href.startsWith('#') && isSafeSmartLinkHref(href) ? href : undefined;
  }

  return undefined;
}
