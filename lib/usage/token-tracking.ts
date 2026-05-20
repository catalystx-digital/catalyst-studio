import { PrismaClient, Prisma } from '@/lib/generated/prisma';

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

export interface TokenRecordOptions {
  websiteId?: string;
  model?: string;
  jobId?: string;
  jobType?: string;
  [key: string]: unknown;
}

/**
 * Records token usage to the database.
 * This is a centralized utility for tracking LLM token consumption.
 *
 * @param prisma - Prisma client instance
 * @param accountId - The account ID to record usage for
 * @param kind - The type of usage (e.g., 'chat_tokens', 'import_tokens', 'greenfield_tokens')
 * @param usage - Token usage data with inputTokens, outputTokens, totalTokens
 * @param options - Additional metadata to store with the usage record
 * @returns The created usage event or null if recording failed
 */
export async function recordTokenUsage(
  prisma: PrismaClient,
  accountId: string,
  kind: string,
  usage: TokenUsage,
  options?: TokenRecordOptions
): Promise<unknown> {
  try {
    // Validate usage data
    if (!usage.totalTokens || usage.totalTokens <= 0) {
      console.warn('[token-tracking] Invalid token usage data:', { accountId, kind, usage });
      return null;
    }

    // Build metadata with token breakdown
    const metadata: Record<string, unknown> = {
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      totalTokens: usage.totalTokens,
      ...(options ?? {}),
    };

    // Create usage event with new schema fields
    const event = await prisma.usageEvent.create({
      data: {
        accountId,
        kind,
        amount: usage.totalTokens,
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        totalTokens: usage.totalTokens,
        model: options?.model ?? null,
        metadata: metadata as Prisma.InputJsonValue,
      },
    });

    return event;
  } catch (error) {
    console.error('[token-tracking] Failed to record token usage:', {
      accountId,
      kind,
      usage,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}
