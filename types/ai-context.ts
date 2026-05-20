export interface AIMessage {
  id?: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date | string;
  metadata?: {
    model?: string;
    tokens?: number;
    temperature?: number;
    idempotencyKey?: string;
    source?: string;
    type?: string;
    [key: string]: unknown;
  } | Record<string, unknown>;
}

export interface AIMetadata {
  model?: string;
  tokens?: number;
  temperature?: number;
  maxTokens?: number;
  totalMessages?: number;
  revision?: string;
  [key: string]: unknown;
}

export interface AIContext {
  id: string;
  websiteId: string | null;
  accountId: string | null;
  sessionId: string;
  messages: AIMessage[];
  metadata?: AIMetadata;
  summary?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type CreateAIContextInput =
  | {
      websiteId: string;
      sessionId?: string;
      initialMessage?: AIMessage;
    }
  | {
      scope: 'account';
      sessionId: string;
      initialMessage?: AIMessage;
    };

export interface UpdateAIContextInput {
  metadata?: AIMetadata;
  summary?: string;
  isActive?: boolean;
}

export interface AppendMessageInput {
  message: AIMessage;
  pruneIfNeeded?: boolean;
  revision?: string;
}
