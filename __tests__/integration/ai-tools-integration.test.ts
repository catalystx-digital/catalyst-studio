/**
 * AI Tools Integration Verification Tests
 * 
 * Verifies that:
 * - IV1: Existing chat endpoint continues to function without modifications
 * - IV2: Context provider successfully reads from existing Prisma models
 * - IV3: No performance impact on current chat response times
 */

import { POST } from '@/app/api/chat/route';
import { ContextProvider } from '@/lib/ai-tools/context/context-provider';
import { toolExecutor } from '@/lib/ai-tools/executor/tool-executor';
import { allTools } from '@/lib/ai-tools/tools';

// Mock dependencies
jest.mock('@openrouter/ai-sdk-provider', () => ({
  createOpenRouter: jest.fn(() => {
    return jest.fn(() => 'mock-model');
  })
}));

jest.mock('ai', () => ({
  streamText: jest.fn(() => ({
    toDataStreamResponse: jest.fn(() => new Response('stream-response'))
  })),
  tool: jest.fn((config) => config),
  Message: jest.fn()
}));

// Mock Prisma client
jest.mock('@/lib/db/client', () => ({
  getClient: jest.fn(() => Promise.resolve({
    website: {
      findUnique: jest.fn().mockResolvedValue({
        id: 'website-123',
        name: 'Test Website',
        websiteType: 'ecommerce',
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
        metadata: null,
        studioId: 'studio-123'
      })
    },
    contentType: {
      findMany: jest.fn().mockResolvedValue([
        {
          id: 'ct-1',
          name: 'Product',
          slug: 'product',
          fields: JSON.stringify([{ name: 'title', type: 'string' }]),
          websiteId: 'website-123',
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ])
    },
    $transaction: jest.fn((callback) => callback({}))
  }))
}));

// Mock services
jest.mock('@/lib/services/website-service', () => ({
  WebsiteService: jest.fn().mockImplementation(() => ({
    getWebsite: jest.fn().mockResolvedValue({
      id: 'website-123',
      name: 'Test Website',
      websiteType: 'ecommerce',
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
      metadata: null,
      studioId: 'studio-123'
    })
  }))
}));

jest.mock('@/lib/services/content-type-service', () => ({
  getContentTypes: jest.fn().mockResolvedValue([
    {
      id: 'ct-1',
      name: 'Product',
      slug: 'product',
      fields: [{ name: 'title', type: 'string' }],
      websiteId: 'website-123',
      createdAt: new Date(),
      updatedAt: new Date()
    }
  ])
}));

import { streamText } from 'ai';

describe('AI Tools Integration Verification', () => {
  const mockStreamText = streamText as jest.Mock;
  let contextProvider: ContextProvider;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.OPENROUTER_API_KEY = 'test-api-key';
    process.env.OPENROUTER_MODEL = 'test-model';
    contextProvider = new ContextProvider();
  });

  describe('IV1: Existing chat endpoint compatibility', () => {
    it('should handle legacy chat requests without any websiteId or tools', async () => {
      const request = new Request('http://localhost/api/chat', {
        method: 'POST',
        body: JSON.stringify({
          messages: [
            { role: 'user', content: 'Hello, how are you?' }
          ]
        })
      });

      const response = await POST(request);

      expect(response).toBeInstanceOf(Response);
      expect(mockStreamText).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'mock-model',
          messages: expect.arrayContaining([
            expect.objectContaining({ 
              role: 'user', 
              content: 'Hello, how are you?' 
            })
          ])
        })
      );
    });

    it('should maintain streaming response format', async () => {
      const request = new Request('http://localhost/api/chat', {
        method: 'POST',
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'Test' }]
        })
      });

      const response = await POST(request);
      const responseText = await response.text();

      expect(responseText).toBe('stream-response');
    });

    it('should handle conversation history correctly', async () => {
      const messages = [
        { role: 'system', content: 'You are a helpful assistant' },
        { role: 'user', content: 'What is 2+2?' },
        { role: 'assistant', content: 'The answer is 4' },
        { role: 'user', content: 'What about 3+3?' }
      ];

      const request = new Request('http://localhost/api/chat', {
        method: 'POST',
        body: JSON.stringify({ messages })
      });

      await POST(request);

      expect(mockStreamText).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining(messages)
        })
      );
    });
  });

  describe('IV2: Context provider Prisma integration', () => {
    it('should successfully read from existing Prisma models', async () => {
      // Clear any cached context
      contextProvider.clearCache();

      const context = await contextProvider.loadWebsiteContext('website-123');

      expect(context).toBeDefined();
      expect(context.website).toHaveProperty('id', 'website-123');
      expect(context.website).toHaveProperty('name', 'Test Website');
      expect(context.contentTypes).toBeInstanceOf(Array);
    });

    it('should handle different website types', async () => {
      const websiteTypes = ['ecommerce', 'blog', 'portfolio', 'corporate'];
      
      for (const websiteType of websiteTypes) {
        const rules = await contextProvider.getBusinessRules(websiteType);
        
        expect(rules).toBeDefined();
        expect(rules.websiteType).toBe(websiteType);
        expect(rules.rules).toBeInstanceOf(Array);
        expect(rules.constraints).toBeDefined();
      }
    });

    it('should properly convert content type fields format', async () => {
      const contentTypes = await contextProvider.loadContentStructure('website-123');
      
      expect(contentTypes).toBeInstanceOf(Array);
      expect(contentTypes.length).toBeGreaterThan(0);
      
      // Verify fields are properly stringified
      contentTypes.forEach(ct => {
        expect(typeof ct.fields).toBe('string');
        const parsed = JSON.parse(ct.fields as string);
        expect(parsed).toBeDefined();
      });
    });
  });

  describe('IV3: Performance impact', () => {
    it('should load context within 500ms requirement', async () => {
      const startTime = performance.now();
      await contextProvider.loadWebsiteContext('website-123');
      const endTime = performance.now();
      
      const loadTime = endTime - startTime;
      expect(loadTime).toBeLessThan(500);
    });

    it('should not impact chat response time when tools are not used', async () => {
      const request = new Request('http://localhost/api/chat', {
        method: 'POST',
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'Hello' }]
        })
      });

      const startTime = performance.now();
      await POST(request);
      const endTime = performance.now();
      
      const responseTime = endTime - startTime;
      // Should be very fast for mocked response
      expect(responseTime).toBeLessThan(100);
    });

    it('should cache context for repeated requests', async () => {
      // First request - will load from database
      const startTime1 = performance.now();
      await contextProvider.loadWebsiteContext('website-123');
      const endTime1 = performance.now();
      const firstLoadTime = endTime1 - startTime1;

      // Second request - should use cache
      const startTime2 = performance.now();
      await contextProvider.loadWebsiteContext('website-123');
      const endTime2 = performance.now();
      const secondLoadTime = endTime2 - startTime2;

      // Cached load should be significantly faster
      expect(secondLoadTime).toBeLessThan(firstLoadTime);
      expect(secondLoadTime).toBeLessThan(10); // Should be near instant
    });
  });

  describe('Tool infrastructure', () => {
    it('should have all tools properly registered', () => {
      expect(allTools).toBeDefined();
      expect(Object.keys(allTools).length).toBeGreaterThan(0);
      
      // Verify each tool has required properties
      Object.values(allTools).forEach(tool => {
        expect(tool).toHaveProperty('description');
        expect(tool).toHaveProperty('parameters');
        expect(tool).toHaveProperty('execute');
      });
    });

    it('should pass tools to streamText when using enhanced chat', async () => {
      const request = new Request('http://localhost/api/chat', {
        method: 'POST',
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'Use tools' }],
          websiteId: 'website-123'
        })
      });

      await POST(request);

      expect(mockStreamText).toHaveBeenCalledWith(
        expect.objectContaining({
          tools: allTools,
          toolChoice: 'auto',
          maxSteps: 5
        })
      );
    });

    it('should include system prompt when context is loaded', async () => {
      const request = new Request('http://localhost/api/chat', {
        method: 'POST',
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'Test' }],
          websiteId: 'website-123'
        })
      });

      await POST(request);

      expect(mockStreamText).toHaveBeenCalledWith(
        expect.objectContaining({
          system: expect.stringContaining('Test Website')
        })
      );
    });
  });
});