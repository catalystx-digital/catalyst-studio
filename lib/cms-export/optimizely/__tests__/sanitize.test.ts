import { sanitizeOptiKey, sanitizeOptiObjectKeys } from '../utils/sanitize';

describe('sanitizeOptiKey', () => {
  it('preserves camelCase keys', () => {
    expect(sanitizeOptiKey('menuItems')).toBe('menuItems');
  });

  it('trims whitespace and collapses separators', () => {
    expect(sanitizeOptiKey('  menu items  ')).toBe('menu_items');
    expect(sanitizeOptiKey('menu-items')).toBe('menu_items');
  });

  it('keeps existing capitalization when no separators are present', () => {
    expect(sanitizeOptiKey('MenuItems')).toBe('MenuItems');
  });

  it('prefixes keys that start with numbers', () => {
    expect(sanitizeOptiKey('123Field')).toBe('t_123Field');
  });

  it('returns undefined for empty results', () => {
    expect(sanitizeOptiKey('   ')).toBeUndefined();
    expect(sanitizeOptiKey(undefined)).toBeUndefined();
  });
});

describe('sanitizeOptiObjectKeys', () => {
  it('sanitizes object keys and drops invalid ones', () => {
    const source = { 'menu items': 'value', '': 1, '123Field': 2 };
    const result = sanitizeOptiObjectKeys(source);
    expect(result).toEqual({ menu_items: 'value', t_123Field: 2 });
  });

  it('returns empty object for non-objects', () => {
    expect(sanitizeOptiObjectKeys(null)).toEqual({});
    expect(sanitizeOptiObjectKeys(undefined)).toEqual({});
  });
});