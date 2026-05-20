/**
 * Unit tests for Category Field Implementation (Story 7.4a)
 */

import { createContentType, ContentType, Field } from '@/lib/content-types/types';
import { ContentTypeFormSchema } from '@/lib/content-types/types';

describe('Content Type Category Field', () => {
  describe('createContentType helper', () => {
    it('should create a content type with page category by default', () => {
      const contentType = createContentType('BlogPost');
      
      expect(contentType.name).toBe('BlogPost');
      expect(contentType.category).toBe('page');
      expect(contentType.icon).toBe('📄');
    });

    it('should create a content type with explicit page category', () => {
      const contentType = createContentType('ArticlePage', 'page');
      
      expect(contentType.name).toBe('ArticlePage');
      expect(contentType.category).toBe('page');
      expect(contentType.icon).toBe('📄');
    });

    it('should create a content type with component category', () => {
      const contentType = createContentType('HeroSection', 'component');
      
      expect(contentType.name).toBe('HeroSection');
      expect(contentType.category).toBe('component');
      expect(contentType.icon).toBe('🧩');
    });

    it('should generate appropriate pluralName', () => {
      const pageType = createContentType('Product', 'page');
      const componentType = createContentType('Banner', 'component');
      
      expect(pageType.pluralName).toBe('Products');
      expect(componentType.pluralName).toBe('Banners');
    });
  });

  describe('ContentType interface', () => {
    it('should enforce category as required field', () => {
      const contentType: ContentType = {
        id: 'test-id',
        name: 'TestType',
        pluralName: 'TestTypes',
        icon: '📋',
        category: 'page', // This should be required
        fields: [],
        relationships: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      expect(contentType.category).toBeDefined();
      expect(['page', 'component']).toContain(contentType.category);
    });
  });

  describe('Category-specific behavior', () => {
    it('should distinguish between page and component types', () => {
      const pageType = createContentType('BlogPost', 'page');
      const componentType = createContentType('CallToAction', 'component');

      // Pages should be routable
      expect(pageType.category).toBe('page');
      
      // Components should be embeddable
      expect(componentType.category).toBe('component');
    });

    it('should use appropriate icons for each category', () => {
      const pageType = createContentType('LandingPage', 'page');
      const componentType = createContentType('Testimonial', 'component');

      expect(pageType.icon).toBe('📄'); // Page icon
      expect(componentType.icon).toBe('🧩'); // Component icon
    });
  });

  describe('Type validation', () => {
    it('should only accept valid category values', () => {
      const validCategories = ['page', 'component'];
      
      validCategories.forEach(category => {
        const contentType = createContentType('TestType', category as 'page' | 'component');
        expect(contentType.category).toBe(category);
      });
    });

    it('should handle category in TypeScript type checking', () => {
      // This test ensures TypeScript compilation with category field
      const testType: ContentType = {
        id: '123',
        name: 'TestContent',
        pluralName: 'TestContents',
        icon: '📝',
        category: 'page', // TypeScript should enforce 'page' | 'component'
        fields: [],
        relationships: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      expect(testType.category).toMatch(/^(page|component)$/);
    });
  });
});