/**
 * Context Summarizer
 *
 * Provides automatic summarization of conversation history when approaching
 * token limits. Uses LLM to create concise summaries that preserve key
 * decisions, state changes, and context.
 */

import type { AIMessage } from '@/types/ai-context';

/**
 * Summarization result
 */
export interface SummarizationResult {
  summary: string;
  originalMessageCount: number;
  summarizedMessageCount: number;
  tokensSaved: number;
  preservedMessages: AIMessage[];
}

/**
 * Summarization options
 */
export interface SummarizationOptions {
  /** Token threshold to trigger summarization */
  triggerThreshold?: number;
  /** Target token count after summarization */
  targetTokens?: number;
  /** Number of recent messages to preserve */
  preserveRecentCount?: number;
  /** Whether to preserve system messages */
  preserveSystemMessages?: boolean;
  /** Custom summarization prompt */
  customPrompt?: string;
}

const DEFAULT_OPTIONS: Required<SummarizationOptions> = {
  triggerThreshold: 6000,
  targetTokens: 3000,
  preserveRecentCount: 10,
  preserveSystemMessages: true,
  customPrompt: '',
};

/**
 * Estimate token count for messages
 * Approximation: ~4 characters per token
 */
export function estimateTokens(messages: AIMessage[]): number {
  let totalChars = 0;
  for (const msg of messages) {
    totalChars += msg.content.length;
    if (msg.metadata) {
      totalChars += JSON.stringify(msg.metadata).length;
    }
  }
  return Math.ceil(totalChars / 4);
}

/**
 * Check if summarization is needed
 */
export function needsSummarization(
  messages: AIMessage[],
  options: SummarizationOptions = {}
): boolean {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const currentTokens = estimateTokens(messages);
  return currentTokens > opts.triggerThreshold;
}

/**
 * Create a summary prompt for the LLM
 */
function buildSummaryPrompt(messages: AIMessage[], customPrompt?: string): string {
  const basePrompt = customPrompt || `Summarize this conversation concisely, preserving:
1. Key decisions made
2. Important state changes (pages/components created, updated, or deleted)
3. User preferences and requirements mentioned
4. Any errors or issues encountered and their resolutions
5. Current task status if any work is in progress

Keep the summary under 500 words. Focus on information the AI would need to continue helping effectively.`;

  const conversationText = messages
    .map(m => `${m.role.toUpperCase()}: ${m.content}`)
    .join('\n\n');

  return `${basePrompt}\n\n---\nCONVERSATION:\n${conversationText}`;
}

/**
 * Perform summarization using OpenRouter API
 * Falls back to simple extraction if API call fails
 */
async function callLLMForSummary(prompt: string): Promise<string> {
  try {
    // Use a small, fast model for summarization
    const response = await fetch('/api/chat/summarize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt }),
    });

    if (!response.ok) {
      throw new Error(`Summarization API error: ${response.status}`);
    }

    const data = await response.json();
    return data.summary || extractKeyPoints(prompt);
  } catch (error) {
    console.warn('LLM summarization failed, using fallback:', error);
    return extractKeyPoints(prompt);
  }
}

/**
 * Extract key points from conversation (fallback method)
 */
function extractKeyPoints(conversationText: string): string {
  const lines = conversationText.split('\n');
  const keyPoints: string[] = [];

  // Extract action-oriented lines
  const actionPatterns = [
    /created?\s+(page|component)/i,
    /updated?\s+(page|component)/i,
    /deleted?\s+(page|component)/i,
    /changed?\s+/i,
    /modified?\s+/i,
    /error/i,
    /failed/i,
    /completed/i,
  ];

  for (const line of lines) {
    if (actionPatterns.some(p => p.test(line))) {
      keyPoints.push(line.trim());
    }
  }

  // Limit to most recent key points
  const recentPoints = keyPoints.slice(-15);

  if (recentPoints.length === 0) {
    return 'Previous conversation context summarized. Continue assisting the user.';
  }

  return `Summary of previous conversation:\n${recentPoints.map(p => `- ${p}`).join('\n')}`;
}

/**
 * Split messages into preserved and to-summarize groups
 */
function splitMessages(
  messages: AIMessage[],
  options: Required<SummarizationOptions>
): { toSummarize: AIMessage[]; toPreserve: AIMessage[] } {
  const toPreserve: AIMessage[] = [];
  const toSummarize: AIMessage[] = [];

  // Always preserve system messages if option is enabled
  const systemMessages = options.preserveSystemMessages
    ? messages.filter(m => m.role === 'system')
    : [];

  // Get non-system messages
  const nonSystemMessages = messages.filter(m => m.role !== 'system');

  // Preserve recent messages
  const recentCount = Math.min(options.preserveRecentCount, nonSystemMessages.length);
  const recentMessages = nonSystemMessages.slice(-recentCount);
  const olderMessages = nonSystemMessages.slice(0, -recentCount);

  toPreserve.push(...systemMessages, ...recentMessages);
  toSummarize.push(...olderMessages);

  return { toSummarize, toPreserve };
}

/**
 * Summarize conversation history
 *
 * This function:
 * 1. Checks if summarization is needed based on token count
 * 2. Splits messages into preserved and to-summarize groups
 * 3. Generates a summary of older messages
 * 4. Returns the summary + preserved messages
 */
export async function summarizeConversation(
  messages: AIMessage[],
  options: SummarizationOptions = {}
): Promise<SummarizationResult> {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  // Check if summarization is needed
  const originalTokens = estimateTokens(messages);
  if (originalTokens <= opts.triggerThreshold) {
    return {
      summary: '',
      originalMessageCount: messages.length,
      summarizedMessageCount: 0,
      tokensSaved: 0,
      preservedMessages: messages,
    };
  }

  // Split messages
  const { toSummarize, toPreserve } = splitMessages(messages, opts);

  if (toSummarize.length === 0) {
    return {
      summary: '',
      originalMessageCount: messages.length,
      summarizedMessageCount: 0,
      tokensSaved: 0,
      preservedMessages: messages,
    };
  }

  // Generate summary
  const summaryPrompt = buildSummaryPrompt(toSummarize, opts.customPrompt);
  const summary = await callLLMForSummary(summaryPrompt);

  // Create summary message
  const summaryMessage: AIMessage = {
    id: `summary-${Date.now()}`,
    role: 'system',
    content: `[CONVERSATION SUMMARY]\n${summary}`,
    timestamp: new Date(),
    metadata: {
      type: 'summary',
      summarizedCount: toSummarize.length,
      generatedAt: new Date().toISOString(),
    },
  };

  // Combine summary with preserved messages
  const preservedMessages = [summaryMessage, ...toPreserve];
  const newTokens = estimateTokens(preservedMessages);

  return {
    summary,
    originalMessageCount: messages.length,
    summarizedMessageCount: toSummarize.length,
    tokensSaved: originalTokens - newTokens,
    preservedMessages,
  };
}

/**
 * Create a simple in-context summary for immediate use
 * (Does not call external API, uses heuristics only)
 */
export function createQuickSummary(messages: AIMessage[]): string {
  const actions: string[] = [];
  const errors: string[] = [];
  const decisions: string[] = [];

  for (const msg of messages) {
    const content = msg.content.toLowerCase();

    // Track actions
    if (/created? (a |the )?(new )?page/i.test(msg.content)) {
      actions.push('Created page(s)');
    }
    if (/updated? (a |the )?component/i.test(msg.content)) {
      actions.push('Updated component(s)');
    }
    if (/deleted? (a |the )?(page|component)/i.test(msg.content)) {
      actions.push('Deleted content');
    }

    // Track errors
    if (/error|failed|couldn't|unable/i.test(content)) {
      const errorMatch = msg.content.match(/error[:\s]+([^.]+)/i);
      if (errorMatch) {
        errors.push(errorMatch[1].trim());
      }
    }

    // Track decisions from assistant
    if (msg.role === 'assistant' && /will |going to |let me /i.test(content)) {
      const decisionMatch = msg.content.match(/(will|going to|let me)\s+([^.]+)/i);
      if (decisionMatch) {
        decisions.push(decisionMatch[2].trim());
      }
    }
  }

  const parts: string[] = [];

  if (actions.length > 0) {
    parts.push(`Actions: ${[...new Set(actions)].join(', ')}`);
  }
  if (errors.length > 0) {
    parts.push(`Errors encountered: ${errors.slice(-3).join('; ')}`);
  }
  if (decisions.length > 0) {
    parts.push(`Recent decisions: ${decisions.slice(-3).join('; ')}`);
  }

  return parts.length > 0
    ? parts.join('\n')
    : 'Conversation in progress.';
}
