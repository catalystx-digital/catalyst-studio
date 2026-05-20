/**
 * Umbraco Compose Utility Tests
 *
 * Tests for ID generation, schema mapping, and content transformation.
 */

import {
  sanitizeForId,
  generateContentId,
  generatePageId,
  generateSharedComponentId,
  generateTimestampSuffix,
  isSharedComponentId,
  generateDeterministicId,
} from '../utils/id-generator';
import {
  sanitizeSchemaAlias,
  sanitizePropertyKey,
  createPageSchema,
  createComponentSchema,
} from '../utils/schema-mapper';
import {
  resolveSlug,
} from '../utils/content-transformer';
import type { UnifiedContent } from '@/lib/services/export/content-orchestrator';

describe('ID Generator', () => {
  describe('sanitizeForId', () => {
    it('should convert to lowercase', () => {
      expect(sanitizeForId('MyPage')).toBe('mypage');
    });

    it('should replace non-alphanumeric with hyphens', () => {
      expect(sanitizeForId('my page here')).toBe('my-page-here');
      expect(sanitizeForId('test@example.com')).toBe('test-example-com');
    });

    it('should remove leading/trailing hyphens', () => {
      expect(sanitizeForId('--test--')).toBe('test');
    });

    it('should use fallback for empty input', () => {
      expect(sanitizeForId('')).toBe('item');
      expect(sanitizeForId('', 'page')).toBe('page');
    });

    it('should prefix with fallback if starts with number', () => {
      expect(sanitizeForId('123test')).toBe('item-123test');
      expect(sanitizeForId('123test', 'page')).toBe('page-123test');
    });

    it('should limit length to 50 characters', () => {
      const longInput = 'a'.repeat(100);
      expect(sanitizeForId(longInput).length).toBeLessThanOrEqual(50);
    });
  });

  describe('generateTimestampSuffix', () => {
    it('should generate non-empty string', () => {
      const suffix = generateTimestampSuffix();
      expect(suffix).toBeTruthy();
      expect(typeof suffix).toBe('string');
    });

    it('should generate base36 format', () => {
      const suffix = generateTimestampSuffix();
      expect(/^[a-z0-9]+$/.test(suffix)).toBe(true);
    });
  });

  describe('generateContentId', () => {
    it('should generate ID with format type-identifier-timestamp', () => {
      const id = generateContentId('page', 'home', 'abc123');
      expect(id).toBe('page-home-abc123');
    });

    it('should sanitize type and identifier', () => {
      const id = generateContentId('My Type', 'My Page', 'abc');
      expect(id).toBe('my-type-my-page-abc');
    });
  });

  describe('generatePageId', () => {
    it('should generate page ID with page prefix', () => {
      const id = generatePageId('home', 'abc');
      expect(id).toBe('page-home-abc');
    });

    it('should handle complex slugs', () => {
      const id = generatePageId('about/team', 'abc');
      expect(id).toBe('page-about-team-abc');
    });
  });

  describe('generateSharedComponentId', () => {
    it('should generate shared component ID', () => {
      const id = generateSharedComponentId('navbar', 'main', 'abc');
      expect(id).toBe('shared-navbar-main-abc');
    });

    it('should use component type as identifier if not provided', () => {
      const id = generateSharedComponentId('footer', undefined, 'abc');
      expect(id).toBe('shared-footer-footer-abc');
    });
  });

  describe('isSharedComponentId', () => {
    it('should return true for shared component IDs', () => {
      expect(isSharedComponentId('shared-navbar-abc')).toBe(true);
      expect(isSharedComponentId('shared-footer-main-xyz')).toBe(true);
    });

    it('should return false for non-shared IDs', () => {
      expect(isSharedComponentId('page-home-abc')).toBe(false);
      expect(isSharedComponentId('navbar-main-abc')).toBe(false);
    });
  });

  describe('generateDeterministicId', () => {
    it('should generate same ID for same content', () => {
      const content = { title: 'Test', value: 123 };
      const id1 = generateDeterministicId('page', 'test', content);
      const id2 = generateDeterministicId('page', 'test', content);
      expect(id1).toBe(id2);
    });

    it('should generate different IDs for different content', () => {
      const content1 = { title: 'Test 1' };
      const content2 = { title: 'Test 2' };
      const id1 = generateDeterministicId('page', 'test', content1);
      const id2 = generateDeterministicId('page', 'test', content2);
      expect(id1).not.toBe(id2);
    });
  });
});

describe('Schema Mapper', () => {
  describe('sanitizeSchemaAlias', () => {
    it('should convert to lowercase', () => {
      expect(sanitizeSchemaAlias('MySchema')).toBe('myschema');
    });

    it('should replace non-alphanumeric with hyphens', () => {
      expect(sanitizeSchemaAlias('my schema')).toBe('my-schema');
      expect(sanitizeSchemaAlias('my_schema')).toBe('my-schema');
    });

    it('should prefix if starts with number', () => {
      expect(sanitizeSchemaAlias('123schema')).toBe('s-123schema');
    });
  });

  describe('sanitizePropertyKey', () => {
    it('should convert kebab-case to camelCase', () => {
      expect(sanitizePropertyKey('my-property')).toBe('myProperty');
    });

    it('should convert snake_case to camelCase', () => {
      expect(sanitizePropertyKey('my_property')).toBe('myProperty');
    });

    it('should ensure lowercase start', () => {
      expect(sanitizePropertyKey('MyProperty')).toBe('myProperty');
    });
  });

  describe('createComponentSchema', () => {
    it('should create valid component schema', () => {
      const schema = createComponentSchema('hero', {
        headline: { type: 'string' },
        ctaText: { type: 'string' },
      });

      expect(schema.typeSchemaAlias).toBe('hero');
      expect(schema.schema.$schema).toBe('https://umbracocompose.com/v1/schema');
      expect(schema.schema.allOf).toHaveLength(1);
      expect(schema.schema.allOf[0].$ref).toBe('https://umbracocompose.com/v1/node');
      expect(schema.schema.properties.headline).toEqual({ type: 'string' });
    });
  });

  describe('createPageSchema', () => {
    it('should create page schema with navbar and footer refs by default', () => {
      const schema = createPageSchema('page', {
        hero: { type: 'object' },
      });

      expect(schema.schema.properties.title).toEqual({ type: 'string' });
      expect(schema.schema.properties.slug).toEqual({ type: 'string' });
      expect(schema.schema.properties.navbarRef).toBeDefined();
      expect(schema.schema.properties.footerRef).toBeDefined();
    });

    it('should allow disabling navbar/footer refs', () => {
      const schema = createPageSchema('page', {}, { navbarRef: false, footerRef: false });

      expect(schema.schema.properties.navbarRef).toBeUndefined();
      expect(schema.schema.properties.footerRef).toBeUndefined();
    });
  });
});

describe('Content Transformer', () => {
  describe('resolveSlug', () => {
    it('should extract slug from URL', () => {
      const page = {
        id: 'page-1',
        source: 'WebsitePage',
        type: 'page',
        title: 'About Us',
        contentTypeId: 'page',
        content: {},
        url: '/about-us',
        status: 'published',
        websiteId: 'ws-1',
      } as UnifiedContent;

      expect(resolveSlug(page)).toBe('about-us');
    });

    it('should use title if no URL', () => {
      const page = {
        id: 'page-1',
        source: 'WebsitePage',
        type: 'page',
        title: 'Contact Us',
        contentTypeId: 'page',
        content: {},
        status: 'published',
        websiteId: 'ws-1',
      } as UnifiedContent;

      expect(resolveSlug(page)).toBe('contact-us');
    });

    it('should use ID as fallback', () => {
      const page = {
        id: 'page-123',
        source: 'WebsitePage',
        type: 'page',
        title: '',
        contentTypeId: 'page',
        content: {},
        status: 'published',
        websiteId: 'ws-1',
      } as UnifiedContent;

      expect(resolveSlug(page)).toBe('page-123');
    });
  });
});
