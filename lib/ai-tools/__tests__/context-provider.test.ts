/**
 * Context Provider Unit Tests
 */

// Mock services before importing anything that uses them
jest.mock('@/lib/services/website-service');
jest.mock('@/lib/services/content-type-service');

import { 
  ContextProvider, 
  WebsiteContext,
  BusinessRules 
} from '../context/context-provider';
import { WebsiteService } from '@/lib/services/website-service';
import * as ContentTypeServiceModule from '@/lib/services/content-type-service';

// Get mock instances
const MockedWebsiteService = WebsiteService as jest.MockedClass<typeof WebsiteService>;

// Mock performance.now() for consistent timing tests
const mockPerformanceNow = jest.spyOn(performance, 'now');

describe('ContextProvider', () => {
  let contextProvider: ContextProvider;
  let mockGetWebsite: jest.Mock;
  let mockGetContentTypes: jest.Mock;

  const mockWebsite = {
    id: 'website-123',
    name: 'Test Website',
    websiteType: 'ecommerce',
    status: 'active',
    createdAt: new Date(),
    updatedAt: new Date(),
    metadata: null,
    studioId: 'studio-123'
  };

  const mockContentTypesWithParsedFields = [
    {
      id: 'ct-1',
      name: 'Product',
      slug: 'product',
      fields: [
        { name: 'title', type: 'string' },
        { name: 'price', type: 'number' }
      ],
      websiteId: 'website-123',
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      id: 'ct-2',
      name: 'Category',
      slug: 'category',
      fields: [
        { name: 'name', type: 'string' }
      ],
      websiteId: 'website-123',
      createdAt: new Date(),
      updatedAt: new Date()
    }
  ];
  
  const mockContentTypes = mockContentTypesWithParsedFields.map(ct => ({
    ...ct,
    fields: JSON.stringify(ct.fields)
  }));

  beforeEach(() => {
    // Create mock functions
    mockGetWebsite = jest.fn().mockResolvedValue(mockWebsite);
    mockGetContentTypes = jest.fn().mockResolvedValue(mockContentTypesWithParsedFields);
    
    // Setup service mocks
    MockedWebsiteService.mockImplementation(() => ({
      getWebsite: mockGetWebsite,
    } as any));
    
    // Mock the getContentTypes function
    (ContentTypeServiceModule.getContentTypes as jest.Mock) = mockGetContentTypes;
    
    // Create new context provider instance
    contextProvider = new ContextProvider();
    
    // Clear cache before each test
    contextProvider.clearCache();
    
    // Reset performance mock
    mockPerformanceNow.mockReset();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('loadWebsiteContext', () => {
    it('should load website context successfully', async () => {
      mockPerformanceNow
        .mockReturnValueOnce(0) // Start time
        .mockReturnValueOnce(100); // End time (100ms)

      const context = await contextProvider.loadWebsiteContext('website-123');

      expect(context.website).toEqual(mockWebsite);
      expect(context.contentTypes).toEqual(mockContentTypes);
      expect(context.metadata.loadTime).toBe(100);
      expect(context.metadata.pruned).toBe(false);
      
      expect(mockGetWebsite).toHaveBeenCalledWith('website-123');
      expect(mockGetContentTypes)
        .toHaveBeenCalledWith('website-123');
    });

    it('should include business rules when requested', async () => {
      const context = await contextProvider.loadWebsiteContext('website-123', {
        includeBusinessRules: true
      });

      expect(context.businessRules).toBeDefined();
      expect(context.businessRules?.websiteType).toBe('ecommerce');
      expect(context.businessRules?.rules).toBeInstanceOf(Array);
      expect(context.businessRules?.constraints).toBeDefined();
    });

    it('should skip content types when requested', async () => {
      const context = await contextProvider.loadWebsiteContext('website-123', {
        includeContentTypes: false
      });

      expect(context.contentTypes).toEqual([]);
      expect(mockGetContentTypes)
        .not.toHaveBeenCalled();
    });

    it('should cache context and return cached version', async () => {
      // First call
      const context1 = await contextProvider.loadWebsiteContext('website-123');
      
      // Second call should return cached version
      const context2 = await contextProvider.loadWebsiteContext('website-123');
      
      expect(context1).toBe(context2);
      expect(mockGetWebsite).toHaveBeenCalledTimes(1);
    });

    it('should throw error when website not found', async () => {
      mockGetWebsite.mockResolvedValue(null);

      await expect(contextProvider.loadWebsiteContext('invalid-id'))
        .rejects.toThrow('Website not found: invalid-id');
    });

    it('should warn when load time exceeds 500ms', async () => {
      mockPerformanceNow
        .mockReturnValueOnce(0) // Start time
        .mockReturnValueOnce(600); // End time (600ms)

      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      const context = await contextProvider.loadWebsiteContext('website-123');
      
      expect(context.metadata.loadTime).toBe(600);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Context load time exceeded 500ms: 600ms')
      );
      
      consoleSpy.mockRestore();
    });

    it('should handle content type loading errors gracefully', async () => {
      mockGetContentTypes.mockRejectedValue(new Error('Database error'));

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      const context = await contextProvider.loadWebsiteContext('website-123');
      
      expect(context.website).toEqual(mockWebsite);
      expect(context.contentTypes).toEqual([]);
      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to load content structure:',
        expect.any(Error)
      );
      
      consoleSpy.mockRestore();
    });
  });

  describe('Context Pruning', () => {
    it('should prune context when requested', async () => {
      const context = await contextProvider.loadWebsiteContext('website-123', {
        pruneForTokens: true,
        maxTokens: 1000
      });

      expect(context.metadata.pruned).toBe(true);
      expect(context.metadata.tokenEstimate).toBeDefined();
      expect(context.metadata.tokenEstimate).toBeLessThanOrEqual(1000);
    });

    it('should not prune if under token limit', async () => {
      const context = await contextProvider.loadWebsiteContext('website-123', {
        pruneForTokens: true,
        maxTokens: 100000 // Very high limit
      });

      expect(context.metadata.pruned).toBe(true);
      expect(context.contentTypes).toEqual(mockContentTypes);
    });

    it('should prune content type fields first', async () => {
      const context = await contextProvider.loadWebsiteContext('website-123', {
        pruneForTokens: true,
        maxTokens: 100 // Very low limit to force pruning
      });

      expect(context.metadata.pruned).toBe(true);
      // Content types should have summarized fields
      if (context.contentTypes.length > 0) {
        const fields = JSON.parse(context.contentTypes[0].fields as string);
        expect(fields.summary).toBeDefined();
        expect(fields.summary).toContain('fields');
      }
    });
  });

  describe('loadContentStructure', () => {
    it('should load content types for website', async () => {
      const contentTypes = await contextProvider.loadContentStructure('website-123');
      
      expect(contentTypes).toEqual(mockContentTypes);
      expect(mockGetContentTypes)
        .toHaveBeenCalledWith('website-123');
    });

    it('should return empty array on error', async () => {
      mockGetContentTypes.mockRejectedValue(new Error('Database error'));

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      const contentTypes = await contextProvider.loadContentStructure('website-123');
      
      expect(contentTypes).toEqual([]);
      expect(consoleSpy).toHaveBeenCalled();
      
      consoleSpy.mockRestore();
    });
  });

  describe('getBusinessRules', () => {
    it('should return business rules for website type', async () => {
      const rules = await contextProvider.getBusinessRules('ecommerce');
      
      expect(rules.websiteType).toBe('ecommerce');
      expect(rules.rules).toBeInstanceOf(Array);
      expect(rules.rules.length).toBeGreaterThan(0);
      expect(rules.constraints).toBeDefined();
      expect(rules.constraints.maxMenuDepth).toBe(3);
    });

    it('should return rules for any website type (stub)', async () => {
      const rules = await contextProvider.getBusinessRules('blog');
      
      expect(rules.websiteType).toBe('blog');
      expect(rules.rules).toBeInstanceOf(Array);
    });
  });

  describe('Cache Management', () => {
    it('should clear cache for specific website', () => {
      // Add to cache
      contextProvider.loadWebsiteContext('website-123');
      contextProvider.loadWebsiteContext('website-456');
      
      // Clear specific cache
      contextProvider.clearCache('website-123');
      
      // Verify cache cleared
      mockGetWebsite.mockClear();
      mockGetWebsite.mockResolvedValue(mockWebsite);
      contextProvider.loadWebsiteContext('website-123');
      
      expect(mockGetWebsite).toHaveBeenCalled();
    });

    it('should clear entire cache', async () => {
      // Add to cache
      await contextProvider.loadWebsiteContext('website-123');
      await contextProvider.loadWebsiteContext('website-456');
      
      // Clear all cache
      contextProvider.clearCache();
      
      // Verify cache cleared
      mockGetWebsite.mockClear();
      mockGetWebsite.mockResolvedValue(mockWebsite);
      await contextProvider.loadWebsiteContext('website-123');
      
      expect(mockGetWebsite).toHaveBeenCalled();
    });

    it('should invalidate cache after TTL expires', async () => {
      // First call
      await contextProvider.loadWebsiteContext('website-123');
      
      // Simulate time passing (> 5 minutes)
      const now = Date.now();
      jest.spyOn(Date, 'now').mockReturnValue(now + 6 * 60 * 1000);
      
      // Second call should fetch fresh data
      await contextProvider.loadWebsiteContext('website-123');
      
      expect(mockGetWebsite).toHaveBeenCalledTimes(2);
    });
  });

  describe('generateSystemPrompt', () => {
    it('should generate system prompt from context', async () => {
      const context = await contextProvider.loadWebsiteContext('website-123', {
        includeBusinessRules: true
      });
      
      const prompt = await contextProvider.generateSystemPrompt(context);
      
      expect(prompt).toContain('Test Website');
      expect(prompt).toContain('ecommerce');
      expect(prompt).toContain('active');
      expect(prompt).toContain('Product, Category');
      expect(prompt).toContain('Business rules:');
    });

    it('should generate minimal prompt without extras', async () => {
      const context: WebsiteContext = {
        website: mockWebsite,
        contentTypes: [],
        metadata: {
          loadTime: 100,
          pruned: false
        }
      };
      
      const prompt = await contextProvider.generateSystemPrompt(context);
      
      expect(prompt).toContain('Test Website');
      expect(prompt).not.toContain('Available content types');
      expect(prompt).not.toContain('Business rules');
    });
  });
});
