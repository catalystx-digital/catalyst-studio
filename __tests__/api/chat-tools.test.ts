/**
 * Chat API with Tools - Integration Test
 */

import { POST } from '@/app/api/chat/route';
import { tools } from '@/lib/ai-tools/tools';
import { loadWebsiteContext } from '@/lib/ai-tools/context/context-provider';

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
  Message: jest.fn()
}));

jest.mock('@/lib/ai-tools/context/context-provider', () => ({
  loadWebsiteContext: jest.fn(),
  generateSystemPrompt: jest.fn(() => 'Generated system prompt')
}));

jest.mock('@/lib/ai-tools/tools', () => ({
  tools: {
    testTool: {
      name: 'testTool',
      description: 'Test tool',
      parameters: { shape: {} },
      execute: jest.fn()
    }
  },
  allTools: [
    {
      name: 'testTool',
      description: 'Test tool',
      parameters: { shape: {} },
      execute: jest.fn()
    }
  ]
}));

// Import mocked modules
import { streamText } from 'ai';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';

describe('Chat API with Tools Integration', () => {
  const mockStreamText = streamText as jest.Mock;
  const mockCreateOpenRouter = createOpenRouter as jest.Mock;
  const mockLoadWebsiteContext = loadWebsiteContext as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup environment variables
    process.env.OPENROUTER_API_KEY = 'test-api-key';
    process.env.OPENROUTER_MODEL = 'test-model';

    // Setup default mock responses
    mockLoadWebsiteContext.mockResolvedValue({
      website: { id: 'website-123', name: 'Test Website' },
      contentTypes: [],
      metadata: { loadTime: 100, pruned: false }
    });
  });

  describe('Basic functionality', () => {
    it('should handle chat request without websiteId', async () => {
      const request = new Request('http://localhost/api/chat', {
        method: 'POST',
        body: JSON.stringify({
          messages: [
            { role: 'user', content: 'Hello' }
          ]
        })
      });

      const response = await POST(request);

      expect(response).toBeInstanceOf(Response);
      expect(mockStreamText).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'mock-model',
          messages: expect.arrayContaining([
            expect.objectContaining({ role: 'user', content: 'Hello' })
          ]),
          tools: expect.any(Object),
          toolChoice: 'auto',
          maxSteps: 10,
          system: undefined
        })
      );
    });

    it('should handle chat request with websiteId', async () => {
      const request = new Request('http://localhost/api/chat', {
        method: 'POST',
        body: JSON.stringify({
          messages: [
            { role: 'user', content: 'Hello' }
          ],
          websiteId: 'website-123'
        })
      });

      const response = await POST(request);

      expect(response).toBeInstanceOf(Response);
      expect(mockLoadWebsiteContext).toHaveBeenCalledWith('website-123');
      expect(mockStreamText).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'mock-model',
          messages: expect.any(Array),
          system: expect.stringContaining('Generated system prompt'),
          tools: expect.any(Object),
          toolChoice: 'auto',
          maxSteps: 10
        })
      );
    });
  });

  describe('Tool integration', () => {
    it('should pass all tools to streamText', async () => {
      const request = new Request('http://localhost/api/chat', {
        method: 'POST',
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'Use a tool' }]
        })
      });

      await POST(request);

      expect(mockStreamText).toHaveBeenCalledWith(
        expect.objectContaining({
          tools: expect.any(Object),
          toolChoice: 'auto',
          maxSteps: 10
        })
      );
    });

    it('should include onStepFinish callback', async () => {
      const request = new Request('http://localhost/api/chat', {
        method: 'POST',
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'Test' }]
        })
      });

      await POST(request);

      const call = mockStreamText.mock.calls[0][0];
      expect(call.onStepFinish).toBeDefined();
      expect(typeof call.onStepFinish).toBe('function');
    });

    it('should log tool executions in onStepFinish', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      const request = new Request('http://localhost/api/chat', {
        method: 'POST',
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'Test' }]
        })
      });

      await POST(request);

      const onStepFinish = mockStreamText.mock.calls[0][0].onStepFinish;
      
      // Simulate tool execution
      await onStepFinish({
        toolCalls: [
          { toolName: 'testTool', args: { input: 'test' } }
        ]
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        'Tool executed:',
        expect.objectContaining({
          tools: expect.arrayContaining([
            expect.objectContaining({
              name: 'testTool',
              args: { input: 'test' }
            })
          ]),
          timestamp: expect.any(String)
        })
      );

      consoleSpy.mockRestore();
    });
  });

  describe('Context loading', () => {
    it('should load context when websiteId provided', async () => {
      const request = new Request('http://localhost/api/chat', {
        method: 'POST',
        body: JSON.stringify({
          messages: [],
          websiteId: 'website-123'
        })
      });

      await POST(request);

      expect(mockLoadWebsiteContext).toHaveBeenCalledWith('website-123');
    });

    it('should handle context loading errors gracefully', async () => {
      mockLoadWebsiteContext.mockRejectedValue(new Error('Context load failed'));
      
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      const request = new Request('http://localhost/api/chat', {
        method: 'POST',
        body: JSON.stringify({
          messages: [],
          websiteId: 'website-123'
        })
      });

      const response = await POST(request);

      expect(response).toBeInstanceOf(Response);
      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to load website context:',
        expect.any(Error)
      );
      
      // Should continue without context
      expect(mockStreamText).toHaveBeenCalledWith(
        expect.objectContaining({
          system: undefined
        })
      );

      consoleSpy.mockRestore();
    });

    it('should not load context when websiteId not provided', async () => {
      const request = new Request('http://localhost/api/chat', {
        method: 'POST',
        body: JSON.stringify({
          messages: []
        })
      });

      await POST(request);

      expect(mockLoadWebsiteContext).not.toHaveBeenCalled();
    });
  });

  describe('Backward compatibility', () => {
    it('should maintain compatibility with existing chat requests', async () => {
      const request = new Request('http://localhost/api/chat', {
        method: 'POST',
        body: JSON.stringify({
          messages: [
            { role: 'system', content: 'You are helpful' },
            { role: 'user', content: 'Hello' },
            { role: 'assistant', content: 'Hi there!' },
            { role: 'user', content: 'How are you?' }
          ]
        })
      });

      const response = await POST(request);

      expect(response).toBeInstanceOf(Response);
      expect(mockStreamText).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({ role: 'system' }),
            expect.objectContaining({ role: 'user' }),
            expect.objectContaining({ role: 'assistant' }),
            expect.objectContaining({ role: 'user' })
          ])
        })
      );
    });

    it('should use default model when not specified', async () => {
      delete process.env.OPENROUTER_MODEL;
      
      const request = new Request('http://localhost/api/chat', {
        method: 'POST',
        body: JSON.stringify({
          messages: []
        })
      });

      await POST(request);

      expect(mockCreateOpenRouter).toHaveBeenCalledWith({
        apiKey: 'test-api-key'
      });
      
      const modelFactory = mockCreateOpenRouter.mock.results[0].value;
      expect(modelFactory).toHaveBeenCalledWith('anthropic/claude-3.5-sonnet');
    });
  });

  describe('Error handling', () => {
    it('should handle invalid JSON in request', async () => {
      const request = new Request('http://localhost/api/chat', {
        method: 'POST',
        body: 'invalid-json'
      });

      await expect(POST(request)).rejects.toThrow();
    });

    it('should handle missing messages in request', async () => {
      const request = new Request('http://localhost/api/chat', {
        method: 'POST',
        body: JSON.stringify({})
      });

      // Should not throw, messages will be undefined/empty
      const response = await POST(request);
      expect(response).toBeInstanceOf(Response);
    });
  });
});