import { z } from 'zod';

export const ChatLogMessageSchema = z.object({
  id: z.string().min(8).max(128).optional(),
  content: z.string().min(1).max(100000), // Allow large content for markdown attachments
  timestamp: z.string().datetime().optional(),
});

export const ChatLogPayloadSchema = z.object({
  sessionId: z.string().min(3).max(128),
  message: ChatLogMessageSchema,
  websiteId: z.string().min(1).optional(),
  idempotencyKey: z.string().min(8).max(128),
  metadata: z.record(z.unknown()).optional(),
  scope: z.enum(['website', 'account']).optional(),
});

export type ChatLogPayload = z.infer<typeof ChatLogPayloadSchema>;
