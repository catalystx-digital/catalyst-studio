import { AIMessage } from '@/types/ai-context';

export interface PruningOptions {
  maxMessages?: number;
  maxTokens?: number;
  preserveSystemMessages?: boolean;
  preserveRecentCount?: number;
}

export interface PruningResult {
  messages: AIMessage[];
  summary?: string;
  prunedCount: number;
  tokenCount: number;
}

const DEFAULT_OPTIONS: Required<PruningOptions> = {
  maxMessages: 50,
  maxTokens: 8000,
  preserveSystemMessages: true,
  preserveRecentCount: 30
};

/**
 * Prune AI conversation messages using sliding window strategy
 */
export function pruneMessages(
  messages: AIMessage[],
  existingSummary?: string | null,
  options?: PruningOptions
): PruningResult {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  
  // Separate system and non-system messages
  const systemMessages = opts.preserveSystemMessages 
    ? messages.filter(m => m.role === 'system')
    : [];
  const conversationMessages = messages.filter(m => m.role !== 'system');
  
  // Calculate current token count
  const tokenCount = estimateTokenCount(messages);
  
  // Check if pruning is needed
  const needsPruning = 
    conversationMessages.length > opts.maxMessages ||
    tokenCount > opts.maxTokens;
  
  if (!needsPruning) {
    return {
      messages,
      summary: existingSummary || undefined,
      prunedCount: 0,
      tokenCount
    };
  }
  
  // Calculate how many messages to prune
  let messagesToKeep = Math.min(
    opts.preserveRecentCount,
    opts.maxMessages - systemMessages.length
  );
  
  // If we're over token limit, reduce messages further
  if (tokenCount > opts.maxTokens) {
    // Estimate how many messages we can keep within token limit
    const avgTokensPerMessage = tokenCount / messages.length;
    const maxMessagesForTokens = Math.floor(opts.maxTokens / avgTokensPerMessage);
    messagesToKeep = Math.min(messagesToKeep, maxMessagesForTokens - systemMessages.length);
    messagesToKeep = Math.max(1, messagesToKeep); // Keep at least 1 message
  }
  
  const messagesToPrune = conversationMessages.slice(0, -messagesToKeep);
  const recentMessages = conversationMessages.slice(-messagesToKeep);
  
  // Create summary if we're pruning significant content
  let summary = existingSummary;
  if (messagesToPrune.length > 5 && !summary) {
    summary = createContextSummary(messagesToPrune);
  }
  
  // Combine preserved messages
  const prunedMessages = [...systemMessages, ...recentMessages];
  const newTokenCount = estimateTokenCount(prunedMessages);
  
  return {
    messages: prunedMessages,
    summary: summary || undefined,
    prunedCount: messages.length - prunedMessages.length,
    tokenCount: newTokenCount
  };
}

/**
 * Estimate token count for messages
 * More accurate estimation based on content type:
 * - Regular text: ~1 token per 4 characters
 * - Code/technical: ~1 token per 2.5 characters (more special chars)
 * - URLs: ~1 token per 2 characters
 * - Numbers: ~1 token per 3 characters
 */
export function estimateTokenCount(messages: AIMessage[]): number {
  const totalTokens = messages.reduce((sum, msg) => {
    const content = msg.content;
    let tokens = 0;
    
    // Check for code blocks (```...```)
    const codeBlockMatches = content.match(/```[\s\S]*?```/g) || [];
    const codeBlockChars = codeBlockMatches.join('').length;
    tokens += Math.ceil(codeBlockChars / 2.5); // Code is more token-dense
    
    // Check for URLs
    const urlMatches = content.match(/https?:\/\/[^\s]+/g) || [];
    const urlChars = urlMatches.join('').length;
    tokens += Math.ceil(urlChars / 2); // URLs have many special chars
    
    // Check for inline code (`...`)
    const inlineCodeMatches = content.match(/`[^`]+`/g) || [];
    const inlineCodeChars = inlineCodeMatches.join('').length;
    tokens += Math.ceil(inlineCodeChars / 2.5);
    
    // Remove already counted content
    let remainingContent = content;
    [...codeBlockMatches, ...urlMatches, ...inlineCodeMatches].forEach(match => {
      remainingContent = remainingContent.replace(match, '');
    });
    
    // Check for numbers and special characters
    const numberMatches = remainingContent.match(/\d+\.?\d*/g) || [];
    const numberChars = numberMatches.join('').length;
    tokens += Math.ceil(numberChars / 3);
    
    // Remove numbers from remaining content
    numberMatches.forEach(match => {
      remainingContent = remainingContent.replace(match, '');
    });
    
    // Regular text (what's left)
    tokens += Math.ceil(remainingContent.length / 4);
    
    // Add metadata tokens if present
    if (msg.metadata) {
      const metadataStr = JSON.stringify(msg.metadata);
      tokens += Math.ceil(metadataStr.length / 3); // JSON has more special chars
    }
    
    return sum + tokens;
  }, 0);
  
  // Add a small buffer for message formatting overhead (role markers, etc.)
  return Math.ceil(totalTokens * 1.1);
}

/**
 * Calculate exact token count (would use tiktoken in production)
 */
export function calculateExactTokens(text: string): number {
  // In production, this would use tiktoken or similar library
  // For now, use estimation
  return Math.ceil(text.length / 4);
}

/**
 * Create a summary of pruned messages
 */
function createContextSummary(messages: AIMessage[]): string {
  // In production, this would call an AI API to generate a proper summary
  // For now, create a simple summary
  
  const userMessages = messages.filter(m => m.role === 'user').length;
  const assistantMessages = messages.filter(m => m.role === 'assistant').length;
  
  const topics = extractTopics(messages);
  const topicSummary = topics.length > 0 
    ? `Topics discussed: ${topics.slice(0, 3).join(', ')}.`
    : '';
  
  return `Previous conversation context: ${userMessages} user messages and ${assistantMessages} assistant responses. ${topicSummary}`;
}

/**
 * Extract key topics from messages (simplified version)
 */
function extractTopics(messages: AIMessage[]): string[] {
  // In production, this would use NLP to extract actual topics
  // For now, extract some keywords
  
  const keywords = new Set<string>();
  const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for']);
  
  messages.forEach(msg => {
    if (msg.role === 'user') {
      const words = msg.content
        .toLowerCase()
        .split(/\W+/)
        .filter(word => word.length > 3 && !stopWords.has(word));
      
      words.slice(0, 5).forEach(word => keywords.add(word));
    }
  });
  
  return Array.from(keywords).slice(0, 10);
}

/**
 * Identify important messages that should be preserved
 */
export function identifyImportantMessages(messages: AIMessage[]): Set<number> {
  const importantIndices = new Set<number>();
  
  messages.forEach((msg, index) => {
    // Preserve system messages
    if (msg.role === 'system') {
      importantIndices.add(index);
      return;
    }
    
    // Preserve messages with specific markers
    const markers = ['important', 'remember', 'note:', 'key:', 'critical:'];
    const hasMarker = markers.some(marker => 
      msg.content.toLowerCase().includes(marker)
    );
    
    if (hasMarker) {
      importantIndices.add(index);
    }
    
    // Preserve first and last messages in conversation
    if (index === 0 || index === messages.length - 1) {
      importantIndices.add(index);
    }
  });
  
  return importantIndices;
}

/**
 * Check if pruning should be triggered
 */
export function shouldTriggerPruning(
  messages: AIMessage[],
  options?: PruningOptions
): boolean {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  
  const nonSystemMessages = messages.filter(m => m.role !== 'system');
  const tokenCount = estimateTokenCount(messages);
  
  return (
    nonSystemMessages.length > opts.maxMessages ||
    tokenCount > opts.maxTokens
  );
}

/**
 * Get pruning statistics
 */
export function getPruningStats(messages: AIMessage[]): {
  totalMessages: number;
  systemMessages: number;
  userMessages: number;
  assistantMessages: number;
  estimatedTokens: number;
  oldestMessage?: Date;
  newestMessage?: Date;
} {
  const stats = {
    totalMessages: messages.length,
    systemMessages: messages.filter(m => m.role === 'system').length,
    userMessages: messages.filter(m => m.role === 'user').length,
    assistantMessages: messages.filter(m => m.role === 'assistant').length,
    estimatedTokens: estimateTokenCount(messages),
    oldestMessage: undefined as Date | undefined,
    newestMessage: undefined as Date | undefined
  };
  
  if (messages.length > 0) {
    const timestamps = messages.map(m => new Date(m.timestamp));
    stats.oldestMessage = new Date(Math.min(...timestamps.map(d => d.getTime())));
    stats.newestMessage = new Date(Math.max(...timestamps.map(d => d.getTime())));
  }
  
  return stats;
}