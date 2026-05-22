import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthContext } from '@/lib/auth/context';
import { getQuotaUsageSnapshot, QUOTA_KINDS, type QuotaKind, type QuotaPeriod } from '@/lib/usage/limits';
import { Prisma } from '@/lib/generated/prisma';

function startOfDay(d = new Date()): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function computeAvailable(limit: number | null, used: number): number | null {
  if (typeof limit !== 'number') {
    return null;
  }
  return Math.max(0, limit - used);
}

type UsageResetMap = Partial<Record<QuotaKind, Partial<Record<QuotaPeriod | 'all', Date>>>>;

function toPlainObject(value: unknown): Record<string, unknown> | null {
  try {
    const normalized = JSON.parse(JSON.stringify(value ?? null)) as unknown;
    if (!normalized || typeof normalized !== 'object' || Array.isArray(normalized)) {
      return null;
    }
    return normalized as Record<string, unknown>;
  } catch {
    return null;
  }
}

function isQuotaKind(candidate: string): candidate is QuotaKind {
  return QUOTA_KINDS.includes(candidate as QuotaKind);
}

function isQuotaPeriod(candidate: string): candidate is QuotaPeriod | 'all' {
  return candidate === 'day' || candidate === 'week' || candidate === 'month' || candidate === 'all';
}

function parseUsageResets(limits: unknown): UsageResetMap {
  const root = toPlainObject(limits);
  if (!root) {
    return {};
  }
  const resetsNode = toPlainObject(root.usageResets);
  if (!resetsNode) {
    return {};
  }

  const result: UsageResetMap = {};
  for (const [kindKey, periodNode] of Object.entries(resetsNode)) {
    if (!isQuotaKind(kindKey)) {
      continue;
    }
    const periods = toPlainObject(periodNode);
    if (!periods) {
      continue;
    }
    for (const [periodKey, timestamp] of Object.entries(periods)) {
      if (!isQuotaPeriod(periodKey) || typeof timestamp !== 'string') {
        continue;
      }
      const date = new Date(timestamp);
      if (Number.isNaN(date.getTime())) {
        continue;
      }
      const existing = result[kindKey as QuotaKind] ?? {};
      existing[periodKey as QuotaPeriod | 'all'] = date;
      result[kindKey as QuotaKind] = existing;
    }
  }

  return result;
}

async function loadUsageResets(accountId: string): Promise<UsageResetMap> {
  const account = await prisma.account.findUnique({
    where: { id: accountId },
    select: { limits: true }
  });
  return parseUsageResets(account?.limits ?? null);
}

function resolveFallbackStart(
  defaultStart: Date,
  resets: UsageResetMap,
  kind: QuotaKind,
  period: QuotaPeriod | 'all'
): Date {
  const reset = resets[kind]?.[period];
  if (reset && reset > defaultStart) {
    return reset;
  }
  return defaultStart;
}

async function recordUsageResetMetadata(
  accountId: string,
  kinds: QuotaKind[],
  period: QuotaPeriod | 'all'
) {
  const account = await prisma.account.findUnique({
    where: { id: accountId },
    select: { limits: true }
  });
  const base = toPlainObject(account?.limits) ?? {};
  const resetNode = toPlainObject(base.usageResets) ?? {};
  const timestamp = new Date().toISOString();

  for (const kind of kinds) {
    const existing = toPlainObject(resetNode[kind]) ?? {};
    existing[period] = timestamp;
    resetNode[kind] = existing;
  }

  base.usageResets = resetNode;
  await prisma.account.update({
    where: { id: accountId },
    data: { limits: base as Prisma.InputJsonValue }
  });
}

type UsageSummary = {
  quotas: Record<QuotaKind, {
    limit: number | null;
    used: number;
    available: number | null;
    period: string | null;
    mode: string;
  }>;
  integrations: {
    total: number;
    enabled: number;
  };
  enforcement: {
    mode: string;
  };
};

export async function GET(request: NextRequest) {
  try {
    const { accountId } = await getAuthContext(request);
    const snapshot = await getQuotaUsageSnapshot(prisma, accountId);
    const now = new Date();
    const start = startOfDay(now);
    const usageResets = await loadUsageResets(accountId);
    const importFallbackStart = resolveFallbackStart(start, usageResets, 'import_page', 'day');
    const chatFallbackStart = resolveFallbackStart(start, usageResets, 'chat_tokens', 'day');

    const [
      importJobsToday,
      importedWebsitesToday,
      newWebsitesToday,
      aiContexts,
      totalIntegrations,
      enabledIntegrations,
    ] = await Promise.all([
      prisma.importJob.count({
        where: {
          createdAt: { gte: importFallbackStart },
          website: { accountId },
        },
      }),
      prisma.website.count({
        where: {
          accountId,
          category: 'imported',
          createdAt: { gte: importFallbackStart },
        },
      }),
      prisma.website.count({
        where: {
          accountId,
          createdAt: { gte: importFallbackStart },
        },
      }),
      prisma.aIContext.findMany({
        where: {
          website: { accountId },
          updatedAt: { gte: chatFallbackStart },
        },
        select: { metadata: true },
      }),
      prisma.accountIntegration.count({
        where: { accountId },
      }),
      prisma.accountIntegration.count({
        where: { accountId, status: 'enabled' },
      }),
    ]);

    const quotas: UsageSummary['quotas'] = {} as UsageSummary['quotas'];
    for (const kind of QUOTA_KINDS) {
      const entry = snapshot.quotas[kind];
      quotas[kind] = {
        limit: entry.limit,
        used: entry.used,
        available: entry.available,
        period: entry.period,
        mode: entry.mode,
      };
    }

    const fallbackImports = Math.max(
      typeof importJobsToday === 'number' ? importJobsToday : 0,
      typeof importedWebsitesToday === 'number' ? importedWebsitesToday : 0,
      typeof newWebsitesToday === 'number' ? newWebsitesToday : 0,
    );
    if (fallbackImports > quotas.import_page.used) {
      quotas.import_page.used = fallbackImports;
      quotas.import_page.available = computeAvailable(quotas.import_page.limit, fallbackImports);
    }

    const fallbackChatTokens = Array.isArray(aiContexts)
      ? aiContexts.reduce((sum: number, ctx: { metadata?: unknown }) => {
          if (!ctx?.metadata || typeof ctx.metadata !== 'object') return sum;
          const tokens = Number((ctx.metadata as Record<string, unknown>).tokens ?? 0);
          return Number.isFinite(tokens) ? sum + tokens : sum;
        }, 0)
      : 0;
    if (fallbackChatTokens > quotas.chat_tokens.used) {
      quotas.chat_tokens.used = fallbackChatTokens;
      quotas.chat_tokens.available = computeAvailable(quotas.chat_tokens.limit, fallbackChatTokens);
    }

    const summary: UsageSummary = {
      quotas,
      integrations: {
        total: typeof totalIntegrations === 'number' ? totalIntegrations : 0,
        enabled: typeof enabledIntegrations === 'number' ? enabledIntegrations : 0,
      },
      enforcement: {
        mode: snapshot.mode,
      },
    };

    return NextResponse.json({ data: summary });
  } catch (err) {
    return NextResponse.json({ error: { message: (err as Error).message } }, { status: 400 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { accountId } = await getAuthContext(request);
    const body = await request.json().catch(() => ({} as any));
    const action = body?.action;
    const kind: 'all' | QuotaKind = body?.kind || 'all';
    const period: QuotaPeriod | 'all' = body?.period || 'day';

    if (action !== 'reset') {
      return NextResponse.json({ error: { message: 'Unsupported action' } }, { status: 400 });
    }

    if (kind !== 'all' && !QUOTA_KINDS.includes(kind)) {
      return NextResponse.json({ error: { message: 'Invalid quota kind' } }, { status: 400 });
    }

    const where: any = { accountId };
    if (period === 'day') where.occurredAt = { gte: startOfDay() };
    if (kind !== 'all') where.kind = kind;

    await prisma.usageEvent.deleteMany({ where });
    const kindsToReset = kind === 'all' ? [...QUOTA_KINDS] : [kind];
    await recordUsageResetMetadata(accountId, kindsToReset, period);

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: { message: (err as Error).message } }, { status: 400 });
  }
}
