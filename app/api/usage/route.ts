import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthContext } from '@/lib/auth/context';
import { getQuotaUsageSnapshot, QUOTA_KINDS, type QuotaKind } from '@/lib/usage/limits';

/**
 * Usage API Response Types
 */
export interface UsageMetric {
  current: number;
  limit: number | null;
  remaining: number;
  warningLevel: 'none' | 'warning80' | 'warning90' | 'limit' | 'grace' | 'blocked';
  graceAvailable: boolean;
}

export interface MonthlyUsage {
  month: string; // '2025-12'
  websites: number;
  pages: number;
  tokens: number;
}

export interface UsageResponse {
  websites: UsageMetric;
  pages: UsageMetric;
  tokens: UsageMetric;
  resetDate: string; // ISO date
  isAdmin: boolean;
  history: MonthlyUsage[];
}

/**
 * Compute warning level based on usage percentage
 */
function computeWarningLevel(
  current: number,
  limit: number | null
): UsageMetric['warningLevel'] {
  if (limit === null) return 'none';
  if (current > limit) return 'blocked';
  if (current === limit) return 'grace';
  const percentage = (current / limit) * 100;
  if (percentage >= 90) return 'warning90';
  if (percentage >= 80) return 'warning80';
  return 'none';
}

/**
 * Compute reset date (1st of next month at midnight UTC)
 */
function computeResetDate(now: Date): Date {
  const year = now.getFullYear();
  const month = now.getMonth();
  return new Date(Date.UTC(year, month + 1, 1, 0, 0, 0, 0));
}

/**
 * Format month key for history (e.g., '2025-12')
 */
function formatMonthKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

/**
 * GET /api/usage - Fetch current usage stats for the account
 */
export async function GET(request: NextRequest) {
  try {
    const { accountId, userId } = await getAuthContext(request);
    const now = new Date();

    // Check if user is system admin
    let isAdmin = false;
    if (userId) {
      const systemAdmin = await prisma.systemAdmin.findUnique({
        where: { userId },
        select: { isActive: true },
      });
      isAdmin = systemAdmin?.isActive ?? false;
    }

    // Get quota usage snapshot
    const snapshot = await getQuotaUsageSnapshot(prisma, accountId, { now });

    // Build usage metrics
    const websiteQuota = snapshot.quotas.website_create;
    const pageQuota = snapshot.quotas.page_create;
    const tokenQuota = snapshot.quotas.chat_tokens;

    const websites: UsageMetric = {
      current: websiteQuota.used,
      limit: websiteQuota.limit,
      remaining: websiteQuota.available ?? 0,
      warningLevel: computeWarningLevel(websiteQuota.used, websiteQuota.limit),
      graceAvailable: websiteQuota.limit !== null && websiteQuota.used === websiteQuota.limit,
    };

    const pages: UsageMetric = {
      current: pageQuota.used,
      limit: pageQuota.limit,
      remaining: pageQuota.available ?? 0,
      warningLevel: computeWarningLevel(pageQuota.used, pageQuota.limit),
      graceAvailable: pageQuota.limit !== null && pageQuota.used === pageQuota.limit,
    };

    const tokens: UsageMetric = {
      current: tokenQuota.used,
      limit: tokenQuota.limit,
      remaining: tokenQuota.available ?? 0,
      warningLevel: computeWarningLevel(tokenQuota.used, tokenQuota.limit),
      graceAvailable: tokenQuota.limit !== null && tokenQuota.used === tokenQuota.limit,
    };

    // Compute reset date
    const resetDate = computeResetDate(now);

    // Get usage history for past 3 months
    const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1);

    const historyEvents = await prisma.usageEvent.findMany({
      where: {
        accountId,
        occurredAt: { gte: threeMonthsAgo },
        kind: {
          in: ['website_create', 'page_create', 'chat_tokens'] as QuotaKind[],
        },
      },
      select: {
        kind: true,
        amount: true,
        occurredAt: true,
      },
    });

    // Aggregate by month
    const monthlyMap = new Map<string, { websites: number; pages: number; tokens: number }>();

    for (const event of historyEvents) {
      const monthKey = formatMonthKey(event.occurredAt);
      if (!monthlyMap.has(monthKey)) {
        monthlyMap.set(monthKey, { websites: 0, pages: 0, tokens: 0 });
      }
      const entry = monthlyMap.get(monthKey)!;

      switch (event.kind) {
        case 'website_create':
          entry.websites += event.amount;
          break;
        case 'page_create':
          entry.pages += event.amount;
          break;
        case 'chat_tokens':
          entry.tokens += event.amount;
          break;
      }
    }

    // Build sorted history array (most recent first)
    const history: MonthlyUsage[] = Array.from(monthlyMap.entries())
      .map(([month, data]) => ({ month, ...data }))
      .sort((a, b) => b.month.localeCompare(a.month));

    const response: UsageResponse = {
      websites,
      pages,
      tokens,
      resetDate: resetDate.toISOString(),
      isAdmin,
      history,
    };

    return NextResponse.json({ data: response });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: { message } }, { status: 400 });
  }
}
