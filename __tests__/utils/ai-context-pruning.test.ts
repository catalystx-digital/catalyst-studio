import { 
  pruneMessages, 
  estimateTokenCount, 
  shouldTriggerPruning,
  getPruningStats,
  identifyImportantMessages
} from '@/lib/utils/ai-context-pruning';
import { AIMessage } from '@/types/ai-context';

describe('AI Context Pruning', () => {
  const createMessage = (role: 'user' | 'assistant' | 'system', content: string): AIMessage => ({
    role,
    content,
    timestamp: new Date(),
  });
  
  describe('pruneMessages', () => {
    it('should not prune when under limits', () => {
      const messages: AIMessage[] = [
        createMessage('system', 'You are a helpful assistant'),
        createMessage('user', 'Hello'),
        createMessage('assistant', 'Hi there!'),
      ];
      
      const result = pruneMessages(messages);
      
      expect(result.messages).toHaveLength(3);
      expect(result.prunedCount).toBe(0);
      expect(result.summary).toBeUndefined();
    });
    
    it('should prune old messages when over message limit', () => {
      const messages: AIMessage[] = [];
      
      // Add system message
      messages.push(createMessage('system', 'System prompt'));
      
      // Add 60 conversation messages (over default limit of 50)
      for (let i = 0; i < 60; i++) {
        messages.push(createMessage('user', `Message ${i}`));
        messages.push(createMessage('assistant', `Reply ${i}`));
      }
      
      const result = pruneMessages(messages, null, { maxMessages: 50 });
      
      // Should keep system message + recent 30 messages
      expect(result.messages).toHaveLength(31);
      expect(result.messages[0].role).toBe('system');
      expect(result.prunedCount).toBeGreaterThan(0);
      expect(result.summary).toBeDefined();
    });
    
    it('should preserve system messages when pruning', () => {
      const messages: AIMessage[] = [
        createMessage('system', 'System 1'),
        createMessage('system', 'System 2'),
        ...Array(60).fill(null).map((_, i) => 
          createMessage(i % 2 === 0 ? 'user' : 'assistant', `Message ${i}`)
        ),
      ];
      
      const result = pruneMessages(messages, null, { 
        maxMessages: 20,
        preserveSystemMessages: true 
      });
      
      // Should keep both system messages
      const systemMessages = result.messages.filter(m => m.role === 'system');
      expect(systemMessages).toHaveLength(2);
      expect(systemMessages[0].content).toBe('System 1');
      expect(systemMessages[1].content).toBe('System 2');
    });
    
    it('should use existing summary when available', () => {
      const messages: AIMessage[] = Array(60).fill(null).map((_, i) => 
        createMessage(i % 2 === 0 ? 'user' : 'assistant', `Message ${i}`)
      );
      
      const existingSummary = 'Previous conversation about testing';
      const result = pruneMessages(messages, existingSummary, { maxMessages: 30 });
      
      expect(result.summary).toBe(existingSummary);
    });
    
    it('should prune based on token count', () => {
      // Create messages with long content to exceed token limit
      const messages: AIMessage[] = [
        createMessage('user', 'a'.repeat(10000)), // ~2500 tokens
        createMessage('assistant', 'b'.repeat(10000)), // ~2500 tokens
        createMessage('user', 'c'.repeat(10000)), // ~2500 tokens
        createMessage('assistant', 'd'.repeat(10000)), // ~2500 tokens
      ];
      
      const result = pruneMessages(messages, null, { maxTokens: 8000 });
      
      expect(result.messages.length).toBeLessThan(4);
      expect(result.tokenCount).toBeLessThanOrEqual(8000);
    });
  });
  
  describe('estimateTokenCount', () => {
    it('should estimate tokens based on character count', () => {
      const messages: AIMessage[] = [
        createMessage('user', 'Hello world'), // 11 chars
        createMessage('assistant', 'Hi there!'), // 9 chars
      ];
      
      const tokens = estimateTokenCount(messages);
      
      // (ceil(11/4) + ceil(9/4)) * 1.1 = (3 + 3) * 1.1 = 6.6 -> 7 tokens
      expect(tokens).toBe(7);
    });
    
    it('should include metadata in token count', () => {
      const messages: AIMessage[] = [
        {
          role: 'user',
          content: 'Test', // 4 chars
          timestamp: new Date(),
          metadata: {
            model: 'gpt-4', // Additional chars from metadata
            tokens: 100,
          },
        },
      ];
      
      const tokens = estimateTokenCount(messages);
      
      expect(tokens).toBeGreaterThan(1); // More than just content
    });
  });
  
  describe('shouldTriggerPruning', () => {
    it('should trigger when message count exceeds limit', () => {
      const messages: AIMessage[] = Array(51).fill(null).map((_, i) => 
        createMessage('user', `Message ${i}`)
      );
      
      const shouldPrune = shouldTriggerPruning(messages, { maxMessages: 50 });
      
      expect(shouldPrune).toBe(true);
    });
    
    it('should trigger when token count exceeds limit', () => {
      const messages: AIMessage[] = [
        createMessage('user', 'a'.repeat(40000)), // ~10000 tokens
      ];
      
      const shouldPrune = shouldTriggerPruning(messages, { maxTokens: 8000 });
      
      expect(shouldPrune).toBe(true);
    });
    
    it('should not trigger when within limits', () => {
      const messages: AIMessage[] = [
        createMessage('user', 'Hello'),
        createMessage('assistant', 'Hi'),
      ];
      
      const shouldPrune = shouldTriggerPruning(messages);
      
      expect(shouldPrune).toBe(false);
    });
  });
  
  describe('identifyImportantMessages', () => {
    it('should identify system messages as important', () => {
      const messages: AIMessage[] = [
        createMessage('system', 'System prompt'),
        createMessage('user', 'Hello'),
        createMessage('assistant', 'Hi'),
      ];
      
      const important = identifyImportantMessages(messages);
      
      expect(important.has(0)).toBe(true); // System message
    });
    
    it('should identify messages with important markers', () => {
      const messages: AIMessage[] = [
        createMessage('user', 'Normal message'),
        createMessage('user', 'IMPORTANT: Remember this'),
        createMessage('assistant', 'Note: This is critical'),
        createMessage('user', 'Another normal message'),
      ];
      
      const important = identifyImportantMessages(messages);
      
      expect(important.has(1)).toBe(true); // Has "IMPORTANT"
      expect(important.has(2)).toBe(true); // Has "Note:"
    });
    
    it('should identify first and last messages', () => {
      const messages: AIMessage[] = [
        createMessage('user', 'First'),
        createMessage('assistant', 'Middle'),
        createMessage('user', 'Last'),
      ];
      
      const important = identifyImportantMessages(messages);
      
      expect(important.has(0)).toBe(true); // First
      expect(important.has(2)).toBe(true); // Last
    });
  });
  
  describe('getPruningStats', () => {
    it('should calculate statistics correctly', () => {
      const now = new Date();
      const past = new Date(now.getTime() - 3600000); // 1 hour ago
      
      const messages: AIMessage[] = [
        { role: 'system', content: 'System', timestamp: past },
        { role: 'user', content: 'User 1', timestamp: past },
        { role: 'assistant', content: 'Assistant 1', timestamp: now },
        { role: 'user', content: 'User 2', timestamp: now },
      ];
      
      const stats = getPruningStats(messages);
      
      expect(stats.totalMessages).toBe(4);
      expect(stats.systemMessages).toBe(1);
      expect(stats.userMessages).toBe(2);
      expect(stats.assistantMessages).toBe(1);
      expect(stats.estimatedTokens).toBeGreaterThan(0);
      expect(stats.oldestMessage).toEqual(past);
      expect(stats.newestMessage).toEqual(now);
    });
    
    it('should handle empty message array', () => {
      const stats = getPruningStats([]);
      
      expect(stats.totalMessages).toBe(0);
      expect(stats.systemMessages).toBe(0);
      expect(stats.userMessages).toBe(0);
      expect(stats.assistantMessages).toBe(0);
      expect(stats.estimatedTokens).toBe(0);
      expect(stats.oldestMessage).toBeUndefined();
      expect(stats.newestMessage).toBeUndefined();
    });
  });
});