import { MAX_CODENAME_LENGTH } from './constants';

const NON_ALPHANUMERIC = /[^a-z0-9]+/g;
const TRAILING_UNDERSCORES = /^_+|_+$/g;

export function sanitizeCodename(input: string, fallback = 'kontent_item'): string {
  if (!input) {
    return fallback;
  }

  let value = input
    .toLowerCase()
    .replace(NON_ALPHANUMERIC, '_')
    .replace(TRAILING_UNDERSCORES, '');

  if (!value) {
    value = fallback;
  }

  if (/^[0-9]/.test(value)) {
    value = `k_${value}`;
  }

  if (value.length > MAX_CODENAME_LENGTH) {
    value = value.slice(0, MAX_CODENAME_LENGTH).replace(TRAILING_UNDERSCORES, '');
  }

  return value || fallback;
}

export function uniqueCodename(base: string, used: Set<string>): string {
  let candidate = base;
  let counter = 1;
  while (used.has(candidate)) {
    const suffix = `_${counter++}`;
    candidate = (base + suffix).slice(0, MAX_CODENAME_LENGTH);
  }
  used.add(candidate);
  return candidate;
}

export function asArray<T>(value: T | T[] | undefined | null): T[] {
  if (Array.isArray(value)) {
    return value;
  }
  if (value === null || value === undefined) {
    return [];
  }
  return [value];
}

export function coerceBoolean(value: unknown): boolean {
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'string') {
    const lowered = value.toLowerCase();
    return ['true', '1', 'yes', 'y'].includes(lowered);
  }
  if (typeof value === 'number') {
    return value !== 0;
  }
  return Boolean(value);
}

export function coerceNumber(value: unknown): number | null {
  if (typeof value === 'number' && !Number.isNaN(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isNaN(parsed) ? null : parsed;
  }
  return null;
}
