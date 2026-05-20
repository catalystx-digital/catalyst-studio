import { pruneMessages, estimateTokenCount } from '@/lib/utils/ai-context-pruning';
import { AIMessage } from '@/types/ai-context';

describe('AI Context Pruning Verification', () => {
  it('should correctly estimate token count', () => {
    const messages: AIMessage[] = [
      { role: 'user', content: 'test', timestamp: new Date() } // 4 chars = ceil(4/4) * 1.1 = 1 * 1.1 = 2 tokens
    ];
    
    const tokens = estimateTokenCount(messages);
    expect(tokens).toBe(2);
  });

  it('should prune when exceeding token limit', () => {
    // Create messages that exceed 8000 token limit
    const largeMessage = 'x'.repeat(3200); // 800 tokens per message
    const messages: AIMessage[] = Array.from({ length: 11 }, (_, i) => ({
      role: (i % 2 === 0 ? 'user' : 'assistant') as 'user' | 'assistant',
      content: largeMessage,
      timestamp: new Date()
    }));

    // 11 messages * 800 tokens = 8800 tokens (exceeds 8000)
    const tokenCount = estimateTokenCount(messages);
    console.log('Token count:', tokenCount);
    expect(tokenCount).toBeGreaterThan(8000);

    const result = pruneMessages(messages, null, {
      maxMessages: 50,
      maxTokens: 8000,
      preserveSystemMessages: true,
      preserveRecentCount: 30
    });

    console.log('Original messages:', messages.length);
    console.log('Pruned messages:', result.messages.length);
    console.log('Pruned count:', result.prunedCount);
    console.log('Final token count:', result.tokenCount);

    // Should have pruned some messages
    expect(result.prunedCount).toBeGreaterThan(0);
    expect(result.messages.length).toBeLessThan(messages.length);
    expect(result.tokenCount).toBeLessThanOrEqual(8000);
  });

  it('should not prune when under limits', () => {
    const messages: AIMessage[] = [
      { role: 'user', content: 'Hello', timestamp: new Date() },
      { role: 'assistant', content: 'Hi there!', timestamp: new Date() }
    ];

    const result = pruneMessages(messages, null);
    
    expect(result.prunedCount).toBe(0);
    expect(result.messages.length).toBe(messages.length);
  });
});