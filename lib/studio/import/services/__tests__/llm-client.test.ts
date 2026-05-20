import { sanitizeHeaderValue } from '../llm-client';

describe('sanitizeHeaderValue', () => {
  describe('handles empty and undefined values', () => {
    it('returns undefined for undefined input', () => {
      expect(sanitizeHeaderValue(undefined)).toBeUndefined();
    });

    it('returns undefined for empty string', () => {
      expect(sanitizeHeaderValue('')).toBeUndefined();
    });

    it('returns undefined for whitespace-only string', () => {
      expect(sanitizeHeaderValue('   ')).toBeUndefined();
      expect(sanitizeHeaderValue('\t\n')).toBeUndefined();
    });
  });

  describe('handles ASCII strings', () => {
    it('returns ASCII strings unchanged', () => {
      expect(sanitizeHeaderValue('Catalyst Import')).toBe('Catalyst Import');
      expect(sanitizeHeaderValue('test-value')).toBe('test-value');
      expect(sanitizeHeaderValue('X-Custom-Header')).toBe('X-Custom-Header');
    });

    it('trims whitespace from ASCII strings', () => {
      expect(sanitizeHeaderValue('  test  ')).toBe('test');
      expect(sanitizeHeaderValue('\tvalue\n')).toBe('value');
    });
  });

  describe('handles non-ASCII characters', () => {
    it('encodes strings with non-ASCII characters', () => {
      const result = sanitizeHeaderValue('Test émoji');
      // encodeURI encodes the é character
      expect(result).toBeDefined();
      expect(result).not.toBe('Test émoji'); // Should be encoded
    });

    it('handles emoji characters', () => {
      const result = sanitizeHeaderValue('Hello 🚀');
      expect(result).toBeDefined();
      // encodeURI should handle or strip emojis
    });

    it('handles mixed ASCII and non-ASCII', () => {
      const result = sanitizeHeaderValue('Café & Restaurant');
      expect(result).toBeDefined();
    });
  });

  describe('edge cases', () => {
    it('handles strings with only special characters', () => {
      // Pure ASCII special chars should pass through
      expect(sanitizeHeaderValue('!@#$%')).toBe('!@#$%');
    });

    it('handles very long strings', () => {
      const longString = 'A'.repeat(1000);
      expect(sanitizeHeaderValue(longString)).toBe(longString);
    });

    it('handles strings with newlines and tabs', () => {
      // After trim, internal newlines should be preserved
      expect(sanitizeHeaderValue('line1\nline2')).toBe('line1\nline2');
    });
  });
});
