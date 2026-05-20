import { AIContextService } from '@/lib/services/ai-context-service';
import { prisma } from '@/lib/prisma';
import { AIMessage } from '@/types/ai-context';

// Mock prisma
jest.mock('@/lib/prisma', () => ({
  prisma: {
    aiContext: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
      deleteMany: jest.fn(),
    },
  },
}));

describe('AIContextService', () => {
  const mockWebsiteId = 'test-website-123';
  const mockSessionId = 'test-session-456';
  
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  describe('getAIContexts', () => {
    it('should retrieve contexts for a website', async () => {
      const mockContexts = [
        {
          id: '1',
          websiteId: mockWebsiteId,
          sessionId: 'session1',
          messages: JSON.stringify([]),
          metadata: JSON.stringify({ totalMessages: 0 }),
          summary: null,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];
      
      (prisma.aiContext.findMany as jest.Mock).mockResolvedValue(mockContexts);
      (prisma.aiContext.count as jest.Mock).mockResolvedValue(1);
      
      const result = await AIContextService.getAIContexts(mockWebsiteId);
      
      expect(result.contexts).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(prisma.aiContext.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { websiteId: mockWebsiteId },
        })
      );
    });
  });
  
  describe('createAIContext', () => {
    it('should create a new context with initial message', async () => {
      const initialMessage: AIMessage = {
        role: 'user',
        content: 'Hello AI',
        timestamp: new Date(),
      };
      
      const mockCreated = {
        id: 'new-context',
        websiteId: mockWebsiteId,
        sessionId: mockSessionId,
        messages: JSON.stringify([initialMessage]),
        metadata: JSON.stringify({ totalMessages: 1, tokens: 3 }),
        summary: null,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      
      (prisma.aiContext.create as jest.Mock).mockResolvedValue(mockCreated);
      
      const result = await AIContextService.createAIContext(
        mockWebsiteId,
        initialMessage,
        mockSessionId
      );
      
      expect(result.websiteId).toBe(mockWebsiteId);
      expect(result.sessionId).toBe(mockSessionId);
      expect(result.messages).toHaveLength(1);
      expect(result.messages[0].content).toBe('Hello AI');
    });
    
    it('should create context without initial message', async () => {
      const mockCreated = {
        id: 'new-context',
        websiteId: mockWebsiteId,
        sessionId: mockSessionId,
        messages: JSON.stringify([]),
        metadata: JSON.stringify({ totalMessages: 0, tokens: 0 }),
        summary: null,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      
      (prisma.aiContext.create as jest.Mock).mockResolvedValue(mockCreated);
      
      const result = await AIContextService.createAIContext(mockWebsiteId);
      
      expect(result.messages).toHaveLength(0);
      expect(result.metadata?.totalMessages).toBe(0);
    });
  });
  
  describe('appendMessage', () => {
    it('should append message to existing context', async () => {
      const existingContext = {
        id: 'context-1',
        websiteId: mockWebsiteId,
        sessionId: mockSessionId,
        messages: JSON.stringify([
          { role: 'user', content: 'Hello', timestamp: new Date() },
        ]),
        metadata: JSON.stringify({ totalMessages: 1, tokens: 2 }),
        summary: null,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      
      const newMessage: AIMessage = {
        role: 'assistant',
        content: 'Hi there!',
        timestamp: new Date(),
      };
      
      (prisma.aiContext.findUnique as jest.Mock).mockResolvedValue(existingContext);
      (prisma.aiContext.update as jest.Mock).mockResolvedValue({
        ...existingContext,
        messages: JSON.stringify([
          { role: 'user', content: 'Hello', timestamp: new Date() },
          newMessage,
        ]),
        metadata: JSON.stringify({ totalMessages: 2, tokens: 5 }),
      });
      
      const result = await AIContextService.appendMessage(
        mockWebsiteId,
        mockSessionId,
        newMessage
      );
      
      expect(result.messages).toHaveLength(2);
      expect(result.messages[1].content).toBe('Hi there!');
    });
    
    it('should throw error if context not found', async () => {
      (prisma.aiContext.findUnique as jest.Mock).mockResolvedValue(null);
      
      const newMessage: AIMessage = {
        role: 'user',
        content: 'Test',
        timestamp: new Date(),
      };
      
      await expect(
        AIContextService.appendMessage(mockWebsiteId, 'invalid-session', newMessage)
      ).rejects.toThrow('AI context not found');
    });
  });
  
  describe('clearContext', () => {
    it('should clear messages from context', async () => {
      const existingContext = {
        id: 'context-1',
        websiteId: mockWebsiteId,
        sessionId: mockSessionId,
        messages: JSON.stringify([
          { role: 'user', content: 'Hello', timestamp: new Date() },
        ]),
        metadata: JSON.stringify({ totalMessages: 1, tokens: 2 }),
        summary: 'Previous conversation',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      
      (prisma.aiContext.findUnique as jest.Mock).mockResolvedValue(existingContext);
      (prisma.aiContext.update as jest.Mock).mockResolvedValue({
        ...existingContext,
        messages: JSON.stringify([]),
        metadata: JSON.stringify({ totalMessages: 0, tokens: 0 }),
        summary: null,
      });
      
      const result = await AIContextService.clearContext(mockWebsiteId, mockSessionId);
      
      expect(result.messages).toHaveLength(0);
      expect(result.metadata?.totalMessages).toBe(0);
      expect(result.summary).toBeUndefined();
    });
  });
  
  describe('deleteContext', () => {
    it('should soft delete context', async () => {
      (prisma.aiContext.update as jest.Mock).mockResolvedValue({
        id: 'context-1',
        isActive: false,
      });
      
      await AIContextService.deleteContext(mockWebsiteId, mockSessionId);
      
      expect(prisma.aiContext.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            websiteId_sessionId: {
              websiteId: mockWebsiteId,
              sessionId: mockSessionId,
            },
          },
          data: { isActive: false },
        })
      );
    });
  });
  
  describe('cleanupOldSessions', () => {
    it('should delete old inactive sessions', async () => {
      (prisma.aiContext.deleteMany as jest.Mock).mockResolvedValue({ count: 5 });
      
      const result = await AIContextService.cleanupOldSessions();
      
      expect(result).toBe(5);
      expect(prisma.aiContext.deleteMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            isActive: false,
          }),
        })
      );
    });
  });
});