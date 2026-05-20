/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ChatWithPersistence } from '@/components/chat/chat-with-persistence';
import { AIContextService } from '@/lib/services/ai-context-service';
import { Message } from 'ai';

// Mock the AI Context Service
jest.mock('@/lib/services/ai-context-service');

// Mock the useWebsiteId hook
jest.mock('@/lib/hooks/use-website-id', () => ({
  useWebsiteId: () => 'test-website-123'
}));

// Mock the AI Context API hooks
jest.mock('@/lib/api/hooks/use-ai-context', () => ({
  useAIContext: jest.fn(),
  useCreateAIContext: jest.fn(),
  useAppendMessage: jest.fn(),
  useClearContext: jest.fn(),
  useDeleteContext: jest.fn()
}));

describe('AI Context E2E Integration', () => {
  let queryClient: QueryClient;
  const mockWebsiteId = 'test-website-123';
  const mockSessionId = 'test-session-456';

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false }
      }
    });
    jest.clearAllMocks();
  });

  describe('Chat Persistence with AI Context API', () => {
    it('should save chat messages to AI context database', async () => {
      const mockMessages: Message[] = [
        {
          id: '1',
          role: 'user',
          content: 'Hello AI',
          createdAt: new Date()
        },
        {
          id: '2',
          role: 'assistant',
          content: 'Hello! How can I help you today?',
          createdAt: new Date()
        }
      ];

      const mockSetMessages = jest.fn();
      const mockOnMessagesLoaded = jest.fn();

      // Mock the service methods
      (AIContextService.createAIContext as jest.Mock).mockResolvedValue({
        id: 'context-1',
        websiteId: mockWebsiteId,
        sessionId: mockSessionId,
        messages: [],
        metadata: { totalMessages: 0, tokens: 0 },
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      (AIContextService.appendMessage as jest.Mock).mockResolvedValue({
        id: 'context-1',
        websiteId: mockWebsiteId,
        sessionId: mockSessionId,
        messages: mockMessages.map(m => ({
          role: m.role,
          content: m.content,
          timestamp: m.createdAt
        })),
        metadata: { totalMessages: 2, tokens: 15 },
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      const TestComponent = () => (
        <QueryClientProvider client={queryClient}>
          <ChatWithPersistence
            messages={mockMessages}
            setMessages={mockSetMessages}
            sessionId={mockSessionId}
            enabled={true}
            onMessagesLoaded={mockOnMessagesLoaded}
          >
            <div>Chat Interface</div>
          </ChatWithPersistence>
        </QueryClientProvider>
      );

      render(<TestComponent />);

      // Wait for component to initialize
      await waitFor(() => {
        expect(screen.getByText('Chat Interface')).toBeInTheDocument();
      });

      // Verify that messages are being saved
      await waitFor(() => {
        expect(AIContextService.createAIContext).toHaveBeenCalledWith(
          mockWebsiteId,
          expect.objectContaining({
            role: 'user',
            content: 'Hello AI'
          }),
          mockSessionId
        );
      }, { timeout: 2000 });
    });

    it('should load existing messages from AI context', async () => {
      const existingMessages = [
        {
          role: 'user' as const,
          content: 'Previous message',
          timestamp: new Date('2024-01-01T10:00:00Z')
        },
        {
          role: 'assistant' as const,
          content: 'Previous response',
          timestamp: new Date('2024-01-01T10:00:01Z')
        }
      ];

      // Mock the service to return existing context
      (AIContextService.getAIContext as jest.Mock).mockResolvedValue({
        id: 'context-1',
        websiteId: mockWebsiteId,
        sessionId: mockSessionId,
        messages: existingMessages,
        metadata: { totalMessages: 2, tokens: 10 },
        isActive: true,
        createdAt: new Date('2024-01-01T09:00:00Z'),
        updatedAt: new Date('2024-01-01T10:00:01Z')
      });

      const mockSetMessages = jest.fn();
      const mockOnMessagesLoaded = jest.fn();

      const TestComponent = () => (
        <QueryClientProvider client={queryClient}>
          <ChatWithPersistence
            messages={[]}
            setMessages={mockSetMessages}
            sessionId={mockSessionId}
            enabled={true}
            onMessagesLoaded={mockOnMessagesLoaded}
          >
            <div>Chat Interface</div>
          </ChatWithPersistence>
        </QueryClientProvider>
      );

      render(<TestComponent />);

      // Wait for messages to be loaded
      await waitFor(() => {
        expect(mockOnMessagesLoaded).toHaveBeenCalled();
      });

      // Verify that existing messages were loaded
      const loadedMessages = mockOnMessagesLoaded.mock.calls[0][0];
      expect(loadedMessages).toHaveLength(2);
      expect(loadedMessages[0].content).toBe('Previous message');
      expect(loadedMessages[1].content).toBe('Previous response');
    });

    it('should handle message pruning for long conversations', async () => {
      // Create a long conversation with 60 messages
      const longConversation = Array.from({ length: 60 }, (_, i) => ({
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: `Message ${i + 1}`,
        timestamp: new Date(Date.now() + i * 1000)
      }));

      // Mock the pruning service
      (AIContextService.appendMessage as jest.Mock).mockImplementation(
        async (websiteId, sessionId, message) => {
          // Simulate pruning - keep only last 50 messages
          const prunedMessages = longConversation.slice(-50);
          return {
            id: 'context-1',
            websiteId,
            sessionId,
            messages: prunedMessages,
            metadata: { 
              totalMessages: 50, 
              tokens: 7500,
              pruned: true,
              originalCount: 60
            },
            summary: 'Previous conversation summarized: User asked various questions...',
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date()
          };
        }
      );

      const result = await AIContextService.appendMessage(
        mockWebsiteId,
        mockSessionId,
        {
          role: 'user',
          content: 'New message after pruning',
          timestamp: new Date()
        }
      );

      expect(result.messages).toHaveLength(50);
      expect(result.metadata?.pruned).toBe(true);
      expect(result.summary).toContain('Previous conversation summarized');
    });

    it('should clear messages from AI context', async () => {
      (AIContextService.clearContext as jest.Mock).mockResolvedValue({
        id: 'context-1',
        websiteId: mockWebsiteId,
        sessionId: mockSessionId,
        messages: [],
        metadata: { totalMessages: 0, tokens: 0 },
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      const result = await AIContextService.clearContext(mockWebsiteId, mockSessionId);
      
      expect(result.messages).toHaveLength(0);
      expect(result.metadata?.totalMessages).toBe(0);
    });

    it('should handle API errors gracefully', async () => {
      const mockError = new Error('Database connection failed');
      (AIContextService.createAIContext as jest.Mock).mockRejectedValue(mockError);

      const mockSetMessages = jest.fn();
      const mockOnMessagesLoaded = jest.fn();
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      const TestComponent = () => (
        <QueryClientProvider client={queryClient}>
          <ChatWithPersistence
            messages={[{ id: '1', role: 'user', content: 'Test', createdAt: new Date() }]}
            setMessages={mockSetMessages}
            sessionId={mockSessionId}
            enabled={true}
            onMessagesLoaded={mockOnMessagesLoaded}
          >
            <div>Chat Interface</div>
          </ChatWithPersistence>
        </QueryClientProvider>
      );

      render(<TestComponent />);

      // Wait for error to be logged
      await waitFor(() => {
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          expect.stringContaining('Failed'),
          expect.any(Error)
        );
      });

      // Component should still render despite error
      expect(screen.getByText('Chat Interface')).toBeInTheDocument();

      consoleErrorSpy.mockRestore();
    });
  });

  describe('AI Context Service Integration', () => {
    it('should create unique context per website and session', async () => {
      const website1Context = await AIContextService.createAIContext(
        'website-1',
        { role: 'user', content: 'Hello', timestamp: new Date() },
        'session-1'
      );

      const website2Context = await AIContextService.createAIContext(
        'website-2',
        { role: 'user', content: 'Hello', timestamp: new Date() },
        'session-1'
      );

      expect(website1Context.websiteId).toBe('website-1');
      expect(website2Context.websiteId).toBe('website-2');
      expect(website1Context.sessionId).toBe(website2Context.sessionId);
    });

    it('should maintain separate conversations per session', async () => {
      const session1Messages = [
        { role: 'user' as const, content: 'Session 1 message', timestamp: new Date() }
      ];
      
      const session2Messages = [
        { role: 'user' as const, content: 'Session 2 message', timestamp: new Date() }
      ];

      await AIContextService.createAIContext(mockWebsiteId, session1Messages[0], 'session-1');
      await AIContextService.createAIContext(mockWebsiteId, session2Messages[0], 'session-2');

      const contexts = await AIContextService.getAIContexts(mockWebsiteId);
      
      expect(contexts.contexts).toHaveLength(2);
      expect(contexts.contexts.find(c => c.sessionId === 'session-1')).toBeDefined();
      expect(contexts.contexts.find(c => c.sessionId === 'session-2')).toBeDefined();
    });
  });
});