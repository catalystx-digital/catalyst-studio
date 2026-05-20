/**
 * Unit tests for slug-manager.ts
 * Tests slug generation, validation, and utility functions
 */

import {
  generateSlug,
  sanitizeSlug,
  isValidSlugFormat,
  parseSlugSuffix,
  createSlugWithSuffix,
  validateSlug,
  isReservedSlug,
  getSlugValidationDetails,
  RESERVED_SLUGS
} from '../slug-manager';

describe('slug-manager', () => {
  describe('generateSlug', () => {
    it('should convert basic title to slug', () => {
      expect(generateSlug('Hello World')).toBe('hello-world');
      expect(generateSlug('Hello World!')).toBe('hello-world');
      expect(generateSlug('Contact Us!!!')).toBe('contact-us');
    });

    it('should handle special characters', () => {
      expect(generateSlug('Products & Services')).toBe('products-services');
      expect(generateSlug('ABC 123 - Test Page')).toBe('abc-123-test-page');
      expect(generateSlug('__Special__Characters__')).toBe('special-characters');
      expect(generateSlug('Price: $99.99')).toBe('price-99-99');
    });

    it('should handle accented characters', () => {
      expect(generateSlug('café-résumé')).toBe('cafe-resume');
      expect(generateSlug('Zürich')).toBe('zurich');
      expect(generateSlug('São Paulo')).toBe('sao-paulo');
    });

    it('should handle numbers', () => {
      expect(generateSlug('2024 Annual Report')).toBe('2024-annual-report');
      expect(generateSlug('Top 10 Tips')).toBe('top-10-tips');
      expect(generateSlug('123')).toBe('123');
    });

    it('should handle spaces and trim', () => {
      expect(generateSlug('  Spaces  Everywhere  ')).toBe('spaces-everywhere');
      expect(generateSlug('   Leading and Trailing   ')).toBe('leading-and-trailing');
    });

    it('should remove consecutive hyphens', () => {
      expect(generateSlug('Hello---World')).toBe('hello-world');
      expect(generateSlug('Test -- Page')).toBe('test-page');
    });

    it('should handle empty and invalid inputs', () => {
      expect(generateSlug('')).toBe('');
      expect(generateSlug(null as unknown as string)).toBe('');
      expect(generateSlug(undefined as unknown as string)).toBe('');
      expect(generateSlug(123 as unknown as string)).toBe('');
    });

    it('should enforce max length', () => {
      const longTitle = 'a'.repeat(300);
      const result = generateSlug(longTitle);
      expect(result.length).toBeLessThanOrEqual(255);
      expect(result).toBe('a'.repeat(255));
    });

    it('should handle max length with truncation cleanup', () => {
      const title = 'word-'.repeat(60); // Creates a string longer than 255
      const result = generateSlug(title);
      expect(result.length).toBeLessThanOrEqual(255);
      expect(result.endsWith('-')).toBe(false); // Should trim trailing hyphen
    });

    it('should respect custom options', () => {
      expect(generateSlug('Hello World', { lowercase: false })).toBe('Hello-World');
      expect(generateSlug('hello-world-', { trim: false })).toBe('hello-world-');
      expect(generateSlug('hello', { maxLength: 3 })).toBe('hel');
    });

    it('should handle edge cases', () => {
      expect(generateSlug('!!!')).toBe('');
      expect(generateSlug('---')).toBe('');
      expect(generateSlug('   ')).toBe('');
      expect(generateSlug('@#$%^&*()')).toBe('');
    });
  });

  describe('sanitizeSlug', () => {
    it('should sanitize existing slugs', () => {
      expect(sanitizeSlug('Hello-World')).toBe('hello-world');
      expect(sanitizeSlug('TEST-SLUG')).toBe('test-slug');
      expect(sanitizeSlug('slug@with#special')).toBe('slugwithspecial');
    });

    it('should remove invalid characters', () => {
      expect(sanitizeSlug('slug!@#$%')).toBe('slug');
      expect(sanitizeSlug('hello_world')).toBe('helloworld');
      expect(sanitizeSlug('test.slug')).toBe('testslug');
    });

    it('should handle consecutive hyphens', () => {
      expect(sanitizeSlug('hello---world')).toBe('hello-world');
      expect(sanitizeSlug('--test--')).toBe('test');
    });

    it('should handle empty and invalid inputs', () => {
      expect(sanitizeSlug('')).toBe('');
      expect(sanitizeSlug(null as unknown as string)).toBe('');
      expect(sanitizeSlug(undefined as unknown as string)).toBe('');
    });
  });

  describe('isValidSlugFormat', () => {
    it('should validate correct slug formats', () => {
      expect(isValidSlugFormat('hello-world')).toBe(true);
      expect(isValidSlugFormat('test-123')).toBe(true);
      expect(isValidSlugFormat('abc')).toBe(true);
      expect(isValidSlugFormat('123')).toBe(true);
      expect(isValidSlugFormat('a-b-c-d')).toBe(true);
    });

    it('should reject invalid slug formats', () => {
      expect(isValidSlugFormat('Hello-World')).toBe(false); // Uppercase
      expect(isValidSlugFormat('hello world')).toBe(false); // Space
      expect(isValidSlugFormat('hello_world')).toBe(false); // Underscore
      expect(isValidSlugFormat('hello.world')).toBe(false); // Dot
      expect(isValidSlugFormat('hello@world')).toBe(false); // Special char
      expect(isValidSlugFormat('')).toBe(false); // Empty
    });

    it('should handle invalid inputs', () => {
      expect(isValidSlugFormat(null as unknown as string)).toBe(false);
      expect(isValidSlugFormat(undefined as unknown as string)).toBe(false);
      expect(isValidSlugFormat(123 as unknown as string)).toBe(false);
    });
  });

  describe('parseSlugSuffix', () => {
    it('should parse slugs with numeric suffixes', () => {
      expect(parseSlugSuffix('about-us-2')).toEqual({
        baseSlug: 'about-us',
        suffix: 2
      });
      expect(parseSlugSuffix('page-10')).toEqual({
        baseSlug: 'page',
        suffix: 10
      });
      expect(parseSlugSuffix('test-123-456')).toEqual({
        baseSlug: 'test-123',
        suffix: 456
      });
    });

    it('should handle slugs without suffixes', () => {
      expect(parseSlugSuffix('about-us')).toEqual({
        baseSlug: 'about-us',
        suffix: null
      });
      expect(parseSlugSuffix('contact')).toEqual({
        baseSlug: 'contact',
        suffix: null
      });
    });

    it('should handle edge cases', () => {
      // '-123' doesn't match the pattern, so it's treated as a base slug
      expect(parseSlugSuffix('-123')).toEqual({
        baseSlug: '-123',
        suffix: null
      });
      expect(parseSlugSuffix('123')).toEqual({
        baseSlug: '123',
        suffix: null
      });
    });
  });

  describe('createSlugWithSuffix', () => {
    it('should create slugs with suffixes', () => {
      expect(createSlugWithSuffix('about-us', 1)).toBe('about-us-1');
      expect(createSlugWithSuffix('page', 10)).toBe('page-10');
      expect(createSlugWithSuffix('test', 999)).toBe('test-999');
    });

    it('should handle zero and negative suffixes', () => {
      expect(createSlugWithSuffix('test', 0)).toBe('test');
      expect(createSlugWithSuffix('test', -1)).toBe('test');
      expect(createSlugWithSuffix('test', -10)).toBe('test');
    });
  });

  describe('validateSlug', () => {
    it('should validate correct slugs', () => {
      expect(validateSlug('hello-world')).toBe(true);
      expect(validateSlug('test-123')).toBe(true);
      expect(validateSlug('valid-slug')).toBe(true);
    });

    it('should reject invalid formats', () => {
      expect(validateSlug('Hello-World')).toBe(false); // Uppercase
      expect(validateSlug('hello world')).toBe(false); // Space
      expect(validateSlug('hello_world')).toBe(false); // Underscore
    });

    it('should reject slugs exceeding max length', () => {
      const longSlug = 'a'.repeat(256);
      expect(validateSlug(longSlug)).toBe(false);
      
      const maxLengthSlug = 'a'.repeat(255);
      expect(validateSlug(maxLengthSlug)).toBe(true);
    });

    it('should reject reserved slugs', () => {
      expect(validateSlug('api')).toBe(false);
      expect(validateSlug('admin')).toBe(false);
      expect(validateSlug('static')).toBe(false);
      expect(validateSlug('_next')).toBe(false);
    });

    it('should handle case-insensitive reserved slug check', () => {
      expect(validateSlug('API')).toBe(false);
      expect(validateSlug('Admin')).toBe(false);
      expect(validateSlug('STATIC')).toBe(false);
    });

    it('should handle empty and invalid inputs', () => {
      expect(validateSlug('')).toBe(false);
      expect(validateSlug(null as unknown as string)).toBe(false);
      expect(validateSlug(undefined as unknown as string)).toBe(false);
    });
  });

  describe('isReservedSlug', () => {
    it('should identify reserved slugs', () => {
      RESERVED_SLUGS.forEach(slug => {
        expect(isReservedSlug(slug)).toBe(true);
      });
    });

    it('should handle case-insensitive check', () => {
      expect(isReservedSlug('API')).toBe(true);
      expect(isReservedSlug('Admin')).toBe(true);
      expect(isReservedSlug('STATIC')).toBe(true);
      expect(isReservedSlug('_NeXt')).toBe(true);
    });

    it('should reject non-reserved slugs', () => {
      expect(isReservedSlug('about')).toBe(false);
      expect(isReservedSlug('contact')).toBe(false);
      expect(isReservedSlug('products')).toBe(false);
    });

    it('should handle invalid inputs', () => {
      expect(isReservedSlug('')).toBe(false);
      expect(isReservedSlug(null as unknown as string)).toBe(false);
      expect(isReservedSlug(undefined as unknown as string)).toBe(false);
    });
  });

  describe('getSlugValidationDetails', () => {
    it('should provide detailed validation for valid slugs', () => {
      const result = getSlugValidationDetails('hello-world');
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect uppercase letters', () => {
      const result = getSlugValidationDetails('Hello-World');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Invalid slug: 'Hello-World' contains uppercase letters");
    });

    it('should detect invalid characters', () => {
      const result = getSlugValidationDetails('hello@world');
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('invalid character'))).toBe(true);
      expect(result.errors.some(e => e.includes('@'))).toBe(true);
    });

    it('should detect multiple invalid characters', () => {
      const result = getSlugValidationDetails('hello@world#test');
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('invalid character'))).toBe(true);
    });

    it('should detect length violations', () => {
      const longSlug = 'a'.repeat(256);
      const result = getSlugValidationDetails(longSlug);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Invalid slug: exceeds maximum length of 255 characters');
    });

    it('should detect reserved slugs', () => {
      const result = getSlugValidationDetails('api');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Invalid slug: 'api' is a reserved system slug");
    });

    it('should detect multiple issues', () => {
      const result = getSlugValidationDetails('API');
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThanOrEqual(2); // Uppercase + reserved
    });

    it('should handle empty input', () => {
      const result = getSlugValidationDetails('');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Invalid slug: cannot be empty');
    });

    it('should handle invalid input types', () => {
      const result = getSlugValidationDetails(null as unknown as string);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Invalid slug: cannot be empty');
    });
  });

  describe('performance', () => {
    it('should generate slugs quickly (< 5ms)', () => {
      const start = performance.now();
      for (let i = 0; i < 1000; i++) {
        generateSlug(`Test Title ${i} with Special Characters!@#$`);
      }
      const end = performance.now();
      const avgTime = (end - start) / 1000;
      
      expect(avgTime).toBeLessThan(5);
    });

    it('should validate slugs quickly', () => {
      const start = performance.now();
      for (let i = 0; i < 1000; i++) {
        validateSlug(`test-slug-${i}`);
      }
      const end = performance.now();
      const avgTime = (end - start) / 1000;
      
      expect(avgTime).toBeLessThan(1);
    });
  });
});