export function resolveSmartLinkHref(raw: unknown): string | undefined {
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }

  if (!raw || typeof raw !== 'object') {
    return undefined;
  }

  const record = raw as Record<string, unknown>;

  if (record.type === 'internal') {
    return typeof record.path === 'string' ? record.path.trim() || undefined : undefined;
  }

  if (record.type === 'external') {
    return typeof record.url === 'string' ? record.url.trim() || undefined : undefined;
  }

  if (record.type === 'email') {
    const href = typeof record.href === 'string' ? record.href.trim() : '';
    if (!href) return undefined;
    return href.startsWith('mailto:') ? href : `mailto:${href}`;
  }

  if (record.type === 'phone') {
    const href = typeof record.href === 'string' ? record.href.trim() : '';
    if (!href) return undefined;
    return href.startsWith('tel:') ? href : `tel:${href}`;
  }

  if (record.type === 'anchor') {
    return typeof record.href === 'string' ? record.href.trim() || undefined : undefined;
  }

  return undefined;
}
