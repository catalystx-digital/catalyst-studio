export function sanitizeOptiKey(raw?: unknown): string | undefined {
  if (raw === undefined || raw === null) return undefined;
  let key = String(raw).trim();
  if (!key) return undefined;

  // Replace invalid separators with underscores without forcing case changes
  key = key.replace(/[^A-Za-z0-9_]+/g, '_');
  key = key.replace(/_+/g, '_');
  key = key.replace(/^_+|_+$/g, '');
  if (!key) return undefined;

  if (/^[0-9]/.test(key)) {
    key = `t_${key}`;
  }

  return key;
}

export function toOptiLookupKey(raw?: unknown): string {
  return sanitizeOptiKey(raw) ?? '';
}

export function buildOptiKeyLookup(byKey?: Record<string, unknown>): Map<string, string> {
  const lookup = new Map<string, string>();
  if (!byKey) return lookup;

  for (const key of Object.keys(byKey)) {
    lookup.set(key, key);

    const sanitized = sanitizeOptiKey(key);
    if (sanitized && !lookup.has(sanitized)) {
      lookup.set(sanitized, key);
    }

    const lowercase = (sanitized || key).toLowerCase();
    if (!lookup.has(lowercase)) {
      lookup.set(lowercase, key);
    }
  }

  return lookup;
}


const WORD_BREAK = /[^A-Za-z0-9]+/g;

function pascalize(raw: string): string {
  const segments = raw.split(WORD_BREAK).filter(Boolean);
  if (segments.length === 0) return '';
  return segments
    .map(segment => (segment[0] ? segment[0].toUpperCase() + segment.slice(1) : segment))
    .join('');
}

export function resolveOptiKey(lookup: Map<string, string>, raw?: unknown): string {
  const sanitized = sanitizeOptiKey(raw);
  if (!sanitized) return '';

  const direct = lookup.get(sanitized);
  if (direct) return direct;

  for (const [candidate, canonical] of lookup.entries()) {
    if (candidate === sanitized) return canonical;
    if (candidate.localeCompare(sanitized, undefined, { sensitivity: 'accent' }) === 0) {
      return canonical;
    }
  }

  const pascal = pascalize(sanitized);
  if (pascal) {
    const viaPascal = lookup.get(pascal);
    if (viaPascal) return viaPascal;
  }

  return sanitized;
}

export function sanitizeOptiObjectKeys<T extends Record<string, any>>(source: T | undefined | null): T {
  if (!source || typeof source !== 'object') {
    return {} as T;
  }

  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(source)) {
    const sanitized = sanitizeOptiKey(key);
    if (!sanitized) continue;
    out[sanitized] = value;
  }

  return out as T;
}



