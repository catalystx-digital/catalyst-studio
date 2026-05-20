import { z } from 'zod';

const AIMessageSchema = z.object({
  id: z.string().min(3).max(200).optional(),
  role: z.enum(['user', 'assistant', 'system']),
  content: z.string().min(1).max(100000), // Max ~25k tokens
  timestamp: z.string().datetime().or(z.date()).transform((val) => new Date(val)),
  metadata: z.record(z.unknown()).optional(),
});

const AIMetadataSchema = z.object({
  model: z.string().optional(),
  tokens: z.number().optional(),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().optional(),
  totalMessages: z.number().optional(),
});

const AccountScopedContextSchema = z.object({
  scope: z.literal('account'),
  sessionId: z.string().min(1),
  initialMessage: AIMessageSchema.optional(),
});

const WebsiteScopedContextSchema = z.object({
  websiteId: z.string().min(1),
  sessionId: z.string().min(1).optional(),
  initialMessage: AIMessageSchema.optional(),
});

export const CreateAIContextSchema = z.union([WebsiteScopedContextSchema, AccountScopedContextSchema]);

export const UpdateAIContextSchema = z.object({
  metadata: AIMetadataSchema.optional(),
  summary: z.string().max(5000).optional(),
  isActive: z.boolean().optional(),
});

export const AppendMessageSchema = z.object({
  message: AIMessageSchema,
  pruneIfNeeded: z.boolean().default(true).optional(),
  revision: z.string().min(10).max(100).optional(),
});

export const GetAIContextsSchema = z.object({
  websiteId: z.string().min(1),
  limit: z.number().min(1).max(100).default(50).optional(),
  offset: z.number().min(0).default(0).optional(),
  isActive: z.boolean().optional(),
});

export type CreateAIContextInput = z.infer<typeof CreateAIContextSchema>;
export type UpdateAIContextInput = z.infer<typeof UpdateAIContextSchema>;
export type AppendMessageInput = z.infer<typeof AppendMessageSchema>;
export type GetAIContextsInput = z.infer<typeof GetAIContextsSchema>;
