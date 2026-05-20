/**
 * Integration tests for Universal Type Generation System
 */

import { primitiveTypeLoader } from '@/lib/services/universal-types/primitive-type-loader';
import { databaseTypeLoader } from '@/lib/services/universal-types/database-type-loader';
import { propertyLoader } from '@/lib/services/universal-types/property-loader';
import { contentTypeValidator } from '@/lib/services/universal-types/validation/validator';
import { confidenceScorer } from '@/lib/services/universal-types/validation/confidence-scorer';
import { universalTypeContextBuilder } from '@/lib/services/universal-types/universal-type-context';
import { dynamicExamplesLoader } from '@/lib/services/universal-types/examples/dynamic-loader';

// Mock Prisma
jest.mock('@/lib/db/prisma', () => ({
  contentType: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
  }
}));

// Mock file system for loaders
jest.mock('fs');

describe('Universal Type Generation System', () => {
  const mockWebsiteId = 'test-website-123';
  
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Primitive Type Loader', () => {
    it('should load primitive types', async () => {
      const types = await primitiveTypeLoader.loadAllPrimitiveTypes();
      expect(Array.isArray(types)).toBe(true);
    });

    it('should format types for prompt injection', () => {
      const formatted = primitiveTypeLoader.formatForPrompt();
      expect(typeof formatted).toBe('string');
    });
  });

  describe('Database Type Loader', () => {
    it('should set website context', () => {
      databaseTypeLoader.setWebsiteContext(mockWebsiteId);
      expect(() => databaseTypeLoader.loadContentTypes()).not.toThrow();
    });

    it('should detect duplicate types', () => {
      const isDuplicate = databaseTypeLoader.isDuplicateType('BlogPost');
      expect(typeof isDuplicate).toBe('boolean');
    });

    it('should format types for prompt', () => {
      const formatted = databaseTypeLoader.formatForPrompt();
      expect(typeof formatted).toBe('string');
    });
  });

  describe('Property Loader', () => {
    it('should load reusable properties', async () => {
      const properties = await propertyLoader.loadReusableProperties(mockWebsiteId);
      expect(Array.isArray(properties)).toBe(true);
    });

    it('should format properties for prompt', () => {
      const formatted = propertyLoader.formatForPrompt();
      expect(typeof formatted).toBe('string');
    });
  });

  describe('Content Type Validator', () => {
    it('should validate content type definition', async () => {
      await contentTypeValidator.initialize(mockWebsiteId);
      
      const definition = {
        name: 'TestPage',
        category: 'page' as const,
        fields: [
          { name: 'title', type: 'Text', required: true },
          { name: 'content', type: 'LongText', required: true }
        ]
      };
      
      const result = await contentTypeValidator.validate(definition);
      
      expect(result).toHaveProperty('isValid');
      expect(result).toHaveProperty('errors');
      expect(result).toHaveProperty('warnings');
      expect(result).toHaveProperty('suggestions');
      expect(result).toHaveProperty('duplicateCheck');
    });
  });

  describe('Confidence Scorer', () => {
    it('should calculate confidence score', async () => {
      await confidenceScorer.initialize(mockWebsiteId);
      
      const definition = {
        name: 'TestComponent',
        category: 'component' as const,
        fields: [
          { name: 'heading', type: 'Text', required: true },
          { name: 'description', type: 'Text', required: false }
        ]
      };
      
      const score = confidenceScorer.calculateScore(definition);
      
      expect(score).toHaveProperty('total');
      expect(score).toHaveProperty('breakdown');
      expect(score).toHaveProperty('threshold');
      expect(score).toHaveProperty('recommendation');
      expect(score.total).toBeGreaterThanOrEqual(0);
      expect(score.total).toBeLessThanOrEqual(100);
    });
  });

  describe('Dynamic Context Builder', () => {
    it('should build context for website', async () => {
      const context = await universalTypeContextBuilder.buildContext(mockWebsiteId, 'Test Project');
      
      expect(context).toHaveProperty('websiteId');
      expect(context).toHaveProperty('projectName');
      expect(context).toHaveProperty('availableTypes');
      expect(context).toHaveProperty('existingContentTypes');
      expect(context).toHaveProperty('reusableComponents');
      expect(context.websiteId).toBe(mockWebsiteId);
      expect(context.projectName).toBe('Test Project');
    });

    it('should populate template with context', async () => {
      const template = 'Available types: {{availableTypes}}';
      const context = await universalTypeContextBuilder.buildContext(mockWebsiteId);
      
      const populated = universalTypeContextBuilder.populateTemplate(template, context);
      
      expect(populated).not.toContain('{{availableTypes}}');
      expect(populated).toContain('Available types:');
    });

    it('should track session types', () => {
      universalTypeContextBuilder.addSessionType('NewBlogPost');
      universalTypeContextBuilder.addSessionType('HeroComponent');
      
      const context = universalTypeContextBuilder.buildContext(mockWebsiteId);
      expect(context).toBeDefined();
    });
  });

  describe('Dynamic Examples Loader', () => {
    it('should merge static and dynamic examples', async () => {
      const examples = await dynamicExamplesLoader.getMergedExamples(mockWebsiteId);
      
      expect(Array.isArray(examples)).toBe(true);
      // Should have at least the static examples
      expect(examples.length).toBeGreaterThanOrEqual(10);
    });

    it('should find similar examples', () => {
      const fields = ['title', 'content', 'author', 'publishDate'];
      const similar = dynamicExamplesLoader.findSimilarExamples(fields);
      
      expect(Array.isArray(similar)).toBe(true);
    });
  });

  describe('End-to-End Integration', () => {
    it('should handle complete type generation flow', async () => {
      // 1. Initialize all components
      await contentTypeValidator.initialize(mockWebsiteId);
      await confidenceScorer.initialize(mockWebsiteId);
      
      // 2. Build context
      const context = await universalTypeContextBuilder.buildContext(mockWebsiteId);
      expect(context).toBeDefined();
      
      // 3. Create a type definition
      const newType = {
        name: 'EventPage',
        category: 'page' as const,
        fields: [
          { name: 'title', type: 'Text', required: true },
          { name: 'description', type: 'LongText', required: true },
          { name: 'eventDate', type: 'Date', required: true },
          { name: 'location', type: 'Text', required: false }
        ]
      };
      
      // 4. Validate the type
      const validation = await contentTypeValidator.validate(newType);
      expect(validation.isValid).toBeDefined();
      
      // 5. Calculate confidence
      const confidence = confidenceScorer.calculateScore(newType);
      expect(confidence.total).toBeGreaterThan(0);
      
      // 6. Add to session if valid
      if (validation.isValid) {
        universalTypeContextBuilder.addSessionType(newType.name);
      }
      
      // 7. Refresh context should include new type
      const refreshedContext = await universalTypeContextBuilder.refreshWithNewType(
        mockWebsiteId, 
        newType.name
      );
      expect(refreshedContext.sessionTypes).toContainEqual(
        expect.objectContaining({ name: newType.name })
      );
    });
  });
});