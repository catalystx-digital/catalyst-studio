import { createHash, randomUUID } from 'crypto';
import { prisma } from '@/lib/prisma';
import { AIContext, AIMessage, AIMetadata } from '@/types/ai-context';
import { ApiError } from '@/lib/api/errors';

const MAX_MESSAGES = 50;
const MAX_TOKENS = 8000;
const OLD_MESSAGE_DAYS = 30;

function normalizeTimestamp(timestamp: Date | string | undefined): Date {
  if (timestamp instanceof Date) {
    return timestamp;
  }
  if (typeof timestamp === 'string') {
    const parsed = new Date(timestamp);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }
  return new Date();
}

function extractMessages(record: { context: unknown }): AIMessage[] {
  const contextData = (record.context as { messages?: AIMessage[] } | null) ?? null;
  if (contextData?.messages && Array.isArray(contextData.messages)) {
    return contextData.messages as AIMessage[];
  }
  return [];
}

export class AIContextService {
  private static resolveMessageId(message: AIMessage): string {
    if (message.id) {
      return message.id;
    }

    const metadata = message.metadata;
    if (metadata && typeof metadata === 'object' && !Array.isArray(metadata)) {
      const record = metadata as Record<string, unknown>;
      if (typeof record.id === 'string') {
        return record.id;
      }
      if (typeof record.idempotencyKey === 'string') {
        return record.idempotencyKey;
      }
    }

    const timestamp = normalizeTimestamp(message.timestamp).toISOString();
    const hash = createHash('sha256')
      .update(`${message.role}:${timestamp}:${message.content}`)
      .digest('hex')
      .slice(0, 32);
    return `msg_${hash}`;
  }

  private static normalizeMessage(message: AIMessage): AIMessage {
    return {
      ...message,
      id: this.resolveMessageId(message),
      timestamp: normalizeTimestamp(message.timestamp),
    };
  }

  private static normalizeMessageArray(messages: AIMessage[]): AIMessage[] {
    return messages.map((message) => this.normalizeMessage(message));
  }

  private static areMessagesEqual(a: AIMessage, b: AIMessage): boolean {
    if (a.role !== b.role || a.content !== b.content) {
      return false;
    }
    const aTimestamp = normalizeTimestamp(a.timestamp).toISOString();
    const bTimestamp = normalizeTimestamp(b.timestamp).toISOString();
    if (aTimestamp !== bTimestamp) {
      return false;
    }
    const serialize = (value?: unknown) => {
      if (value === undefined) {
        return '';
      }
      try {
        return JSON.stringify(value);
      } catch {
        return '';
      }
    };
    return serialize(a.metadata) === serialize(b.metadata);
  }

  private static nextRevision(): string {
    return randomUUID();
  }

  /**
   * Get all AI contexts for a website
   */
  static async getAIContexts(
    websiteId: string, 
    options?: { 
      limit?: number; 
      offset?: number; 
      isActive?: boolean;
    }
  ) {
    const { limit = 50, offset = 0, isActive } = options || {};
    
    const where = { 
      websiteId
    };
    
    const [contexts, total] = await Promise.all([
      prisma.aIContext.findMany({
        where,
        skip: offset,
        take: limit,
        orderBy: { updatedAt: 'desc' },
      }),
      prisma.aIContext.count({ where })
    ]);
    
    // Filter by isActive in memory since it's stored in the context JSON
    let filteredContexts = contexts;
    if (isActive !== undefined) {
      filteredContexts = contexts.filter(c => {
        const contextData = c.context as any || {};
        return contextData.isActive === isActive;
      });
    }
    
    return {
      contexts: filteredContexts.map(this.transformContext),
      total: filteredContexts.length,
      limit,
      offset
    };
  }
  
  /**
   * Get a specific AI context by sessionId
   */
  static async getAIContext(
    websiteId: string | null,
    sessionId: string,
    accountId?: string
  ): Promise<AIContext | null> {
    const context = await this.findContextRecord(websiteId, sessionId, accountId);
    return context ? this.transformContext(context) : null;
  }
  
  /**
   * Create a new AI context session
   */
  static async createAIContext(
    websiteId: string | null, 
    initialMessage: AIMessage | undefined,
    sessionId: string | undefined,
    accountId?: string
  ): Promise<AIContext> {
    if (!websiteId && !accountId) {
      throw new ApiError(400, 'Account ID is required to create account-scoped AI contexts');
    }

    const resolvedAccountId = accountId ?? null;
    
    const newSessionId = sessionId || `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const messages: AIMessage[] = initialMessage ? [this.normalizeMessage(initialMessage)] : [];
    const metadata: AIMetadata = {
      totalMessages: messages.length,
      tokens: await this.estimateTokens(messages),
      revision: this.nextRevision(),
    };
    
    try {
      const context = await prisma.aIContext.create({
        data: {
          websiteId,
          accountId: resolvedAccountId,
          sessionId: newSessionId,
          context: {
            messages: messages as any,
            isActive: true
          } as any,
          metadata: metadata as any
        }
      });
      
      return this.transformContext(context);
    } catch (error: any) {
      // Handle Prisma foreign key constraint errors
      if (error.code === 'P2003') {
        throw new ApiError(400, `Referenced record not found: Website with ID '${websiteId}' does not exist`);
      }
      if (error.code === 'P2002') {
        throw new ApiError(400, 'An AI context with this session already exists for the target scope');
      }
      throw error;
    }
  }
  
  /**
   * Append a message to the conversation
   */
  static async appendMessage(
    websiteId: string | null,
    sessionId: string,
    message: AIMessage,
    pruneIfNeeded = true,
    accountId?: string,
    expectedRevision?: string
  ): Promise<AIContext> {
    if (!websiteId && !accountId) {
      throw new ApiError(400, 'Account ID is required to append messages to account-scoped sessions');
    }

    const maxAttempts = 3;
    let revisionToCheck = expectedRevision;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const context = await this.getAIContext(websiteId, sessionId, accountId);
      
      if (!context) {
        throw new ApiError(404, 'AI context not found');
      }
      if (revisionToCheck && context.metadata?.revision && context.metadata.revision !== revisionToCheck) {
        if (attempt < maxAttempts - 1) {
          revisionToCheck = context.metadata?.revision;
          continue;
        }
        throw new ApiError(409, 'Transcript revision mismatch');
      }

      if (!context.isActive) {
        throw new ApiError(400, 'Context session is not active');
      }

      const normalizedMessage = this.normalizeMessage(message);
      let messages = this.normalizeMessageArray(context.messages);
      const existingIndex = messages.findIndex((entry) => entry.id === normalizedMessage.id);
      let didAppend = false;

      if (existingIndex >= 0) {
        const existingMessage = messages[existingIndex];
        if (this.areMessagesEqual(existingMessage, normalizedMessage)) {
          return context;
        }
        messages = [...messages];
        messages[existingIndex] = normalizedMessage;
      } else {
        messages = [...messages, normalizedMessage];
        didAppend = true;
      }
      
      // Prune if needed when appending new message
      if (didAppend && pruneIfNeeded) {
        const tokens = await this.estimateTokens(messages);
        if (messages.length > MAX_MESSAGES || tokens > MAX_TOKENS) {
          messages = await this.pruneContext(messages, context.summary);
        }
      }

      messages = this.normalizeMessageArray(messages);

      const tokenEstimate = await this.estimateTokens(messages);

      const metadata: AIMetadata = {
        ...context.metadata,
        totalMessages: messages.length,
        tokens: tokenEstimate,
        revision: this.nextRevision(),
      };
      
      const updateWhere = websiteId
        ? {
            websiteId_sessionId: {
              websiteId,
              sessionId
            }
          }
        : {
            accountId_sessionId: {
              accountId,
              sessionId
            }
          };

      const updated = await prisma.aIContext.update({
        where: updateWhere as any,
        data: {
          context: {
            messages: messages as any,
            summary: context.summary,
            isActive: true
          } as any,
          metadata: metadata as any,
          updatedAt: new Date()
        }
      });
      
      return this.transformContext(updated);
    }

    throw new ApiError(409, 'Transcript revision mismatch');
  }
  
  /**
   * Prune old messages from context
   * Note: This duplicates logic from ai-context-pruning.ts - should be refactored to use that utility
   */
  static async pruneContext(
    messages: AIMessage[], 
    existingSummary?: string | null
  ): Promise<AIMessage[]> {
    // Import pruning utility to avoid duplication
    const { pruneMessages } = await import('@/lib/utils/ai-context-pruning');
    
    const result = pruneMessages(messages, existingSummary, {
      maxMessages: MAX_MESSAGES,
      maxTokens: MAX_TOKENS,
      preserveSystemMessages: true,
      preserveRecentCount: 30
    });
    
    return result.messages;
  }
  
  /**
   * Summarize a long conversation context
   */
  static async summarizeContext(
    websiteId: string,
    sessionId: string,
    accountId?: string
  ): Promise<string> {
    const context = await this.getAIContext(websiteId, sessionId, accountId);
    
    if (!context) {
      throw new ApiError(404, 'AI context not found');
    }
    
    // In production, this would call an AI API to create a summary
    // For now, return a placeholder
    const summary = `Conversation summary: ${context.messages.length} messages exchanged`;
    
    await prisma.aIContext.update({
      where: {
        websiteId_sessionId: {
          websiteId,
          sessionId
        }
      },
      data: {
        context: {
          ...(context as any || {}),
          summary
        } as any
      }
    });
    
    return summary;
  }

  static async updateMetadata(
    websiteId: string | null,
    sessionId: string,
    updates: { metadata?: AIMetadata; summary?: string; isActive?: boolean },
    accountId?: string
  ): Promise<AIContext> {
    if (!websiteId && !accountId) {
      throw new ApiError(400, 'Account ID is required to update account-scoped sessions');
    }

    const context = await this.getAIContext(websiteId, sessionId, accountId);
    if (!context) {
      throw new ApiError(404, 'AI context not found');
    }

    const nextMetadata: AIMetadata = {
      ...(context.metadata ?? {}),
      ...(updates.metadata ?? {}),
      revision: this.nextRevision(),
      totalMessages: context.messages.length,
      tokens: context.metadata?.tokens ?? 0,
    };

    const updateWhere = websiteId
      ? {
          websiteId_sessionId: {
            websiteId,
            sessionId,
          },
        }
      : {
          accountId_sessionId: {
            accountId,
            sessionId,
          },
        };

    const updated = await prisma.aIContext.update({
      where: updateWhere as any,
      data: {
        context: {
          messages: context.messages as any,
          summary: updates.summary ?? context.summary,
          isActive: updates.isActive ?? context.isActive,
        } as any,
        metadata: nextMetadata as any,
      },
    });

    return this.transformContext(updated);
  }
  
  /**
   * Clear messages from a context (keep session)
   */
  static async clearContext(websiteId: string | null, sessionId: string, accountId?: string): Promise<AIContext> {
    if (!websiteId && !accountId) {
      throw new ApiError(400, 'Account ID is required to clear account-scoped sessions');
    }
    const context = await this.getAIContext(websiteId, sessionId, accountId);
    
    if (!context) {
      throw new ApiError(404, 'AI context not found');
    }
    
    const clearWhere = websiteId
      ? {
          websiteId_sessionId: {
            websiteId,
            sessionId
          }
        }
      : {
          accountId_sessionId: {
            accountId,
            sessionId
          }
        };

    const updated = await prisma.aIContext.update({
      where: clearWhere as any,
      data: {
        context: {
          messages: [],
          summary: null,
          isActive: true
        } as any,
        metadata: { totalMessages: 0, tokens: 0, revision: this.nextRevision() }
      }
    });

    return this.transformContext(updated);
  }
  
  /**
   * Soft delete a context session
   */
  static async deleteContext(websiteId: string | null, sessionId: string, accountId?: string): Promise<void> {
    if (!websiteId && !accountId) {
      throw new ApiError(400, 'Account ID is required to delete account-scoped sessions');
    }
    const existing = await this.findContextRecord(websiteId, sessionId, accountId);
    
    if (existing) {
      const where = websiteId
        ? {
            websiteId_sessionId: {
              websiteId,
              sessionId
            }
          }
        : {
            accountId_sessionId: {
              accountId,
              sessionId
            }
          };

      await prisma.aIContext.update({
        where: where as any,
        data: {
          context: {
            ...(existing.context as any || {}),
            isActive: false
          } as any
        }
      });
    }
  }
  
  private static async findContextRecord(
    websiteId: string | null,
    sessionId: string,
    accountId?: string
  ) {
    if (websiteId) {
      return prisma.aIContext.findUnique({
        where: {
          websiteId_sessionId: {
            websiteId,
            sessionId
          }
        }
      });
    }

    if (!accountId) {
      throw new ApiError(400, 'Account ID is required to locate account-scoped AI contexts');
    }

    return prisma.aIContext.findUnique({
      where: {
        accountId_sessionId: {
          accountId,
          sessionId
        }
      }
    });
  }
  
  /**
   * Adopt an account-scoped session once a website is available
   */
  static async adoptAccountSession(
    accountId: string,
    sourceSessionId: string,
    websiteId: string,
    targetSessionId: string
  ): Promise<AIContext> {
    const sourceContext = await prisma.aIContext.findUnique({
      where: {
        accountId_sessionId: {
          accountId,
          sessionId: sourceSessionId
        }
      }
    });

    if (!sourceContext) {
      throw new ApiError(404, 'AI context not found for adoption');
    }

    const sourceMessages = extractMessages(sourceContext);

    // If a target context already exists, return it without modifying the source
    const existingTarget = await prisma.aIContext.findUnique({
      where: {
        websiteId_sessionId: {
          websiteId,
          sessionId: targetSessionId
        }
      }
    });

    if (existingTarget) {
      let updatedTarget = existingTarget;

      if (sourceMessages.length > 0) {
        const targetMessages = extractMessages(existingTarget);
        const mergedMessages = [...targetMessages, ...sourceMessages];
        const mergedMetadata: AIMetadata = {
          ...((existingTarget.metadata as AIMetadata | null) ?? {}),
          totalMessages: mergedMessages.length,
          tokens: await this.estimateTokens(mergedMessages),
        };

        updatedTarget = await prisma.aIContext.update({
          where: { id: existingTarget.id },
          data: {
            context: {
              ...((existingTarget.context as Record<string, unknown>) ?? {}),
              messages: mergedMessages as any,
              isActive: true,
            } as any,
            metadata: mergedMetadata as any,
            updatedAt: new Date(),
          },
        });
      }

      await prisma.aIContext.delete({
        where: { id: sourceContext.id },
      });

      return this.transformContext(updatedTarget);
    }

    const updated = await prisma.aIContext.update({
      where: { id: sourceContext.id },
      data: {
        websiteId,
        sessionId: targetSessionId,
        accountId
      }
    });

    return this.transformContext(updated);
  }

  /**
   * Transform database record to typed AIContext
   */
  private static transformContext(record: any): AIContext {
    const rawContext = record.context || {};
    const legacyMessages =
      rawContext.messages ??
      (record.messages
        ? typeof record.messages === 'string'
          ? JSON.parse(record.messages)
          : record.messages
        : undefined);
    const contextData = {
      ...rawContext,
      messages: legacyMessages ?? [],
    };
    const metadataRaw =
      record.metadata && typeof record.metadata === 'string'
        ? JSON.parse(record.metadata)
        : (record.metadata as AIMetadata | null);
    const metadata = metadataRaw ?? { totalMessages: 0, tokens: 0 };
    const messages = this.normalizeMessageArray((contextData.messages as AIMessage[]) || []);

    const updatedAtIso =
      record.updatedAt instanceof Date
        ? record.updatedAt.toISOString()
        : record.updatedAt
          ? new Date(record.updatedAt).toISOString()
          : undefined;
    const fallbackRevision = metadata.revision ?? updatedAtIso ?? this.nextRevision();

    const normalizedMetadata: AIMetadata = {
      totalMessages: metadata.totalMessages ?? messages.length,
      tokens: metadata.tokens ?? 0,
      ...metadata,
      revision: fallbackRevision ?? this.nextRevision(),
    };

    return {
      id: record.id,
      websiteId: record.websiteId ?? null,
      accountId: record.accountId ?? null,
      sessionId: record.sessionId,
      messages,
      metadata: normalizedMetadata,
      summary: contextData.summary || undefined,
      isActive: contextData.isActive !== false,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }
  
  /**
   * Estimate token count for messages
   */
  private static async estimateTokens(messages: AIMessage[]): Promise<number> {
    // Use the improved estimation from pruning utility
    const { estimateTokenCount } = await import('@/lib/utils/ai-context-pruning');
    return estimateTokenCount(messages);
  }
  
  /**
   * Clean up old inactive sessions
   */
  static async cleanupOldSessions(): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - OLD_MESSAGE_DAYS);
    
    // First find all inactive sessions
    const oldInactiveSessions = await prisma.aIContext.findMany({
      where: {
        updatedAt: {
          lt: cutoffDate
        }
      }
    });
    
    // Filter for truly inactive sessions based on context.isActive
    const toDelete = oldInactiveSessions.filter(session => {
      const contextData = session.context as any || {};
      return contextData.isActive === false;
    });
    
    // Delete the inactive sessions
    if (toDelete.length > 0) {
      const result = await prisma.aIContext.deleteMany({
        where: {
          id: {
            in: toDelete.map(s => s.id)
          }
        }
      });
      return result.count;
    }
    
    return 0;
  }
}
