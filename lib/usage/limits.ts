import { PrismaClient, Prisma } from '@/lib/generated/prisma';
import { ApiError } from '@/lib/api/errors';
import { ensureAccount } from '@/lib/auth/account';

export const QUOTA_KINDS = [
  'import_page',
  'chat_tokens',
  'website_create',
  'page_create',
  'chat_sessions',
  'credits',
] as const;

export type QuotaKind = (typeof QUOTA_KINDS)[number];
export type QuotaPeriod = 'day' | 'week' | 'month' | 'all';
export type QuotaMode = 'off' | 'log' | 'enforce';

interface QuotaDefinition {
  defaultLimit: number | null;
  period: QuotaPeriod | null;
  legacyKey?: string;
  label: string;
  action: string;
}

interface ResolvedQuotaDefinition {
  limit: number | null;
  period: QuotaPeriod | null;
  mode?: QuotaMode;
}

interface QuotaOverrides {
  limit?: number | null;
  period?: QuotaPeriod | null;
  mode?: QuotaMode | null;
}

interface AccountQuotaPlan {
  mode: QuotaMode;
  definitions: Record<QuotaKind, ResolvedQuotaDefinition>;
}

export interface QuotaUsage {
  kind: QuotaKind;
  period: QuotaPeriod | null;
  limit: number | null;
  used: number;
  available: number | null;
  mode: QuotaMode;
}

/**
 * Extended result from checkAndRecordUsage with warning levels and grace period support
 */
export interface UsageCheckResult {
  allowed: boolean;
  current: number;
  limit: number | null;
  remaining: number;
  warningLevel: 'none' | 'warning80' | 'warning90' | 'limit' | 'grace' | 'blocked';
  isGrace: boolean;
  graceExhausted: boolean;
  resetDate: Date;
  message?: string;
  isAdmin?: boolean;
}

export interface QuotaUsageSnapshot {
  mode: QuotaMode;
  quotas: Record<QuotaKind, QuotaUsage>;
}

export interface QuotaCheckOptions {
  amount?: number;
  metadata?: Record<string, unknown>;
  now?: Date;
  modeOverride?: QuotaMode;
  periodOverride?: QuotaPeriod | null;
  skipEnsureAccount?: boolean;
  /** User ID for admin bypass check. If provided and user is admin, limits are bypassed. */
  userId?: string;
}

const QUOTA_DEFINITIONS: Record<QuotaKind, QuotaDefinition> = {
  import_page: {
    defaultLimit: 5,
    period: 'month',
    legacyKey: 'importsPerDay',
    label: 'Import',
    action: 'runs',
  },
  chat_tokens: {
    defaultLimit: 500000,
    period: 'month',
    legacyKey: 'chatTokensPerDay',
    label: 'Chat token',
    action: 'tokens',
  },
  website_create: {
    defaultLimit: 3,
    period: 'month',
    label: 'Website creation',
    action: 'websites',
  },
  page_create: {
    defaultLimit: 60,
    period: 'month',
    label: 'Page creation',
    action: 'pages',
  },
  chat_sessions: {
    defaultLimit: 25,
    period: 'month',
    label: 'Chat session',
    action: 'sessions',
  },
  credits: {
    defaultLimit: null,
    period: 'all',
    label: 'Credit',
    action: 'credits',
  },
};

const GLOBAL_MODE: QuotaMode = normaliseQuotaMode(process.env.STUDIO_QUOTA_ENFORCEMENT_MODE);

export class QuotaExceededError extends ApiError {
  constructor(kind: QuotaKind, usage: QuotaUsage, attempted: number) {
    const status = quotaStatus(kind);
    const message = quotaExceededMessage(kind, usage, attempted);
    const details = {
      kind,
      attempted,
      limit: usage.limit,
      period: usage.period,
      used: usage.used,
      available: usage.available,
      mode: usage.mode,
    };
    super(status, message, 'QUOTA_EXCEEDED', details);
    this.name = 'QuotaExceededError';
  }
}

export async function checkAndRecordUsage(
  prisma: PrismaClient,
  accountId: string,
  kind: QuotaKind,
  amount = 1,
  optionsOrPeriod?: QuotaCheckOptions | QuotaPeriod,
): Promise<QuotaUsage & Partial<UsageCheckResult>> {
  const options = resolveOptions(optionsOrPeriod, amount);
  if (!options.skipEnsureAccount) {
    await ensureAccount(prisma, accountId);
  }

  const now = options.now ?? new Date();
  const amountToRecord = options.amount ?? amount;

  // Task 2: Admin bypass - check if user is a system admin
  if (options.userId) {
    const systemAdmin = await prisma.systemAdmin.findUnique({
      where: { userId: options.userId },
      select: { isActive: true },
    });
    if (systemAdmin?.isActive) {
      // Record the usage event for audit purposes, but don't enforce limits
      if (amountToRecord !== 0) {
        await prisma.usageEvent.create({
          data: {
            accountId,
            kind,
            amount: amountToRecord,
            metadata: (options.metadata ?? Prisma.JsonNull) as Prisma.InputJsonValue,
          },
        });
      }
      const resetDate = computeResetDate(now);
      return {
        kind,
        limit: null,
        period: 'month',
        used: 0,
        available: null,
        mode: 'off',
        allowed: true,
        isAdmin: true,
        current: 0,
        remaining: Infinity,
        warningLevel: 'none',
        isGrace: false,
        graceExhausted: false,
        resetDate,
      };
    }
  }

  const plan = await buildAccountQuotaPlan(prisma, accountId);
  const definition = plan.definitions[kind];
  const period = options.periodOverride ?? definition.period;
  const mode = options.modeOverride ?? definition.mode ?? plan.mode;

  const windowStart = startOfWindow(period, now);
  const where: Record<string, unknown> = {
    accountId,
    kind,
  };
  if (windowStart) {
    where.occurredAt = { gte: windowStart };
  }

  const aggregate = await prisma.usageEvent.aggregate({
    _sum: { amount: true },
    where,
  });

  const usedBefore = aggregate._sum?.amount ?? 0;
  const limit = definition.limit;
  const resetDate = computeResetDate(now);

  // Task 3: Calculate warning level and grace period status
  let warningLevel: UsageCheckResult['warningLevel'] = 'none';
  let isGrace = false;
  let graceExhausted = false;
  let allowed = true;

  if (limit !== null && limit !== undefined) {
    const percentage = (usedBefore / limit) * 100;
    const projected = usedBefore + amountToRecord;

    if (usedBefore > limit) {
      // Already past limit (grace exhausted on previous use)
      warningLevel = 'blocked';
      graceExhausted = true;
      allowed = false;
    } else if (usedBefore === limit) {
      // At exact limit - this is the grace use
      warningLevel = 'grace';
      isGrace = true;
      allowed = true; // Allow ONE more (grace)
    } else if (projected > limit) {
      // This use would exceed limit, but if we're exactly at limit, it's grace
      if (usedBefore === limit - amountToRecord && amountToRecord === 1) {
        // Will hit exactly the limit after this use
        warningLevel = 'limit';
        allowed = true;
      } else {
        // Would exceed even with grace consideration
        warningLevel = 'blocked';
        allowed = false;
      }
    } else if (percentage >= 90) {
      warningLevel = 'warning90';
    } else if (percentage >= 80) {
      warningLevel = 'warning80';
    }
  }

  const usageBefore: QuotaUsage = {
    kind,
    limit: definition.limit,
    period,
    used: usedBefore,
    available: computeAvailable(definition.limit, usedBefore),
    mode,
  };

  // Enforce limits only in 'enforce' mode
  if (!allowed && mode === 'enforce') {
    throw new QuotaExceededError(kind, usageBefore, amountToRecord);
  }

  if (!allowed && mode === 'log') {
    console.warn('[quota] soft limit reached', {
      accountId,
      kind,
      used: usedBefore,
      attempted: amountToRecord,
      limit: definition.limit,
      period,
      warningLevel,
      graceExhausted,
    });
    // In log mode, still allow but record the warning
    allowed = true;
  }

  if (amountToRecord !== 0) {
    await prisma.usageEvent.create({
      data: {
        accountId,
        kind,
        amount: amountToRecord,
        metadata: (options.metadata ?? Prisma.JsonNull) as Prisma.InputJsonValue,
      },
    });
  }

  const usedAfter = usedBefore + amountToRecord;
  const remaining = limit !== null ? Math.max(0, limit - usedAfter) : null;

  return {
    kind,
    limit: definition.limit,
    period,
    used: usedAfter,
    available: computeAvailable(definition.limit, usedAfter),
    mode,
    // Extended UsageCheckResult fields
    allowed,
    current: usedAfter,
    remaining: remaining ?? Infinity,
    warningLevel,
    isGrace,
    graceExhausted,
    resetDate,
  };
}

export async function getQuotaUsageSnapshot(
  prisma: PrismaClient,
  accountId: string,
  options: { now?: Date } = {},
): Promise<QuotaUsageSnapshot> {
  const now = options.now ?? new Date();
  const plan = await buildAccountQuotaPlan(prisma, accountId);
  const snapshots: Partial<Record<QuotaKind, QuotaUsage>> = {};

  await Promise.all(
    QUOTA_KINDS.map(async kind => {
      const definition = plan.definitions[kind];
      const period = definition.period;
      const windowStart = startOfWindow(period, now);
      const where: Record<string, unknown> = {
        accountId,
        kind,
      };
      if (windowStart) {
        where.occurredAt = { gte: windowStart };
      }
      const aggregate = await prisma.usageEvent.aggregate({
        _sum: { amount: true },
        where,
      });
      const used = aggregate._sum?.amount ?? 0;
      snapshots[kind] = {
        kind,
        limit: definition.limit,
        period,
        used,
        available: computeAvailable(definition.limit, used),
        mode: definition.mode ?? plan.mode,
      };
    }),
  );

  return {
    mode: plan.mode,
    quotas: snapshots as Record<QuotaKind, QuotaUsage>,
  };
}

function resolveOptions(optionsOrPeriod: QuotaCheckOptions | QuotaPeriod | undefined, amount: number): QuotaCheckOptions {
  if (!optionsOrPeriod) {
    return { amount };
  }
  if (typeof optionsOrPeriod === 'string') {
    return { amount, periodOverride: normalisePeriod(optionsOrPeriod) };
  }
  return { amount, ...optionsOrPeriod };
}

async function buildAccountQuotaPlan(prisma: PrismaClient, accountId: string): Promise<AccountQuotaPlan> {
  const [account, quotaRows] = await Promise.all([
    prisma.account.findUnique({
      where: { id: accountId },
      select: { limits: true },
    }),
    prisma.accountQuota.findMany({
      where: { accountId },
    }),
  ]);

  const planOverrides: Partial<Record<QuotaKind, QuotaOverrides>> = {};
  for (const row of quotaRows) {
    if (!isQuotaKind(row.kind)) continue;
    planOverrides[row.kind] = {
      limit: row.value ?? undefined,
      period: row.period ? normalisePeriod(row.period) : undefined,
    };
  }

  const { quotas: accountOverrides, enforcementMode } = parseAccountLimits(account?.limits);
  const mode = enforcementMode ?? GLOBAL_MODE;

  const definitions = {} as Record<QuotaKind, ResolvedQuotaDefinition>;
  for (const kind of QUOTA_KINDS) {
    const base = QUOTA_DEFINITIONS[kind];
    const planOverride = planOverrides[kind] ?? {};
    const accountOverride = accountOverrides[kind] ?? {};
    const limit = coalesceNumber(accountOverride.limit, planOverride.limit, base.defaultLimit);
    const period = coalescePeriod(accountOverride.period, planOverride.period, base.period);
    const resolvedMode = accountOverride.mode ?? planOverride.mode;
    definitions[kind] = {
      limit,
      period,
      mode: resolvedMode ?? undefined,
    };
  }

  return { mode, definitions };
}

function parseAccountLimits(limits: unknown): { quotas: Partial<Record<QuotaKind, QuotaOverrides>>; enforcementMode?: QuotaMode } {
  const result: { quotas: Partial<Record<QuotaKind, QuotaOverrides>>; enforcementMode?: QuotaMode } = {
    quotas: {},
    enforcementMode: undefined,
  };
  if (!limits || typeof limits !== 'object') {
    return result;
  }

  const raw = limits as Record<string, unknown>;
  if (typeof raw.quotaMode === 'string') {
    result.enforcementMode = normaliseQuotaMode(raw.quotaMode);
  }

  if (typeof raw.importsPerDay === 'number') {
    result.quotas.import_page = { limit: raw.importsPerDay, period: 'day' };
  }
  if (typeof raw.chatTokensPerDay === 'number') {
    result.quotas.chat_tokens = { limit: raw.chatTokensPerDay, period: 'day' };
  }

  for (const [key, value] of Object.entries(raw)) {
    if (!isQuotaKind(key)) continue;
    const override = normaliseOverride(value);
    if (override) {
      result.quotas[key] = override;
    }
  }

  if (raw.quotaOverrides && typeof raw.quotaOverrides === 'object') {
    for (const [key, value] of Object.entries(raw.quotaOverrides as Record<string, unknown>)) {
      if (!isQuotaKind(key)) continue;
      const override = normaliseOverride(value);
      if (override) {
        result.quotas[key] = { ...(result.quotas[key] ?? {}), ...override };
      }
    }
  }

  return result;
}

function normaliseOverride(value: unknown): QuotaOverrides | null {
  if (typeof value === 'number') {
    return { limit: value };
  }
  if (!value || typeof value !== 'object') {
    return null;
  }
  const raw = value as Record<string, unknown>;
  const override: QuotaOverrides = {};
  if (typeof raw.limit === 'number') {
    override.limit = raw.limit;
  }
  if (typeof raw.period === 'string') {
    override.period = normalisePeriod(raw.period);
  }
  if (typeof raw.mode === 'string') {
    override.mode = normaliseQuotaMode(raw.mode);
  }
  return Object.keys(override).length ? override : null;
}

function isQuotaKind(value: unknown): value is QuotaKind {
  return typeof value === 'string' && (QUOTA_KINDS as readonly string[]).includes(value);
}

function coalesceNumber(...values: Array<number | null | undefined>): number | null {
  for (const value of values) {
    if (typeof value === 'number') {
      return value;
    }
  }
  return null;
}

function coalescePeriod(...values: Array<QuotaPeriod | null | undefined>): QuotaPeriod | null {
  for (const value of values) {
    if (value) {
      return value;
    }
  }
  return null;
}

function computeAvailable(limit: number | null, used: number): number | null {
  if (typeof limit !== 'number') {
    return null;
  }
  return Math.max(0, limit - used);
}

/**
 * Computes the reset date (1st of next month at midnight UTC)
 */
function computeResetDate(now: Date): Date {
  const year = now.getFullYear();
  const month = now.getMonth();
  // Next month, day 1, midnight
  return new Date(Date.UTC(year, month + 1, 1, 0, 0, 0, 0));
}

/**
 * Per-website page limit (20 pages per website + 1 grace)
 */
export const PER_WEBSITE_PAGE_LIMIT = 20;

/**
 * Check per-website page limit (Task 4: 20 pages max per website)
 * Returns the count of pages created for this website in the current month.
 * Caller should check if count >= PER_WEBSITE_PAGE_LIMIT + 1 (21) to block.
 */
export async function checkPerWebsitePageLimit(
  prisma: PrismaClient,
  accountId: string,
  websiteId: string,
  options: { now?: Date } = {},
): Promise<{ count: number; allowed: boolean; isGrace: boolean }> {
  const now = options.now ?? new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const pagesOnWebsite = await prisma.usageEvent.count({
    where: {
      accountId,
      kind: 'page_create',
      metadata: {
        path: ['websiteId'],
        equals: websiteId,
      },
      occurredAt: { gte: startOfMonth },
    },
  });

  const limit = PER_WEBSITE_PAGE_LIMIT;
  const graceLimit = limit + 1; // 21 total allowed (20 + 1 grace)

  return {
    count: pagesOnWebsite,
    allowed: pagesOnWebsite < graceLimit,
    isGrace: pagesOnWebsite === limit, // Exactly at 20 means next one is grace
  };
}

function startOfWindow(period: QuotaPeriod | null, now: Date): Date | null {
  if (!period || period === 'all') {
    return null;
  }
  if (period === 'day') {
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }
  if (period === 'week') {
    const day = now.getDate() - now.getDay();
    return new Date(now.getFullYear(), now.getMonth(), day);
  }
  if (period === 'month') {
    return new Date(now.getFullYear(), now.getMonth(), 1);
  }
  return null;
}

function normaliseQuotaMode(value?: string | null): QuotaMode {
  const normalised = (value || '').toLowerCase();
  if (['enforce', 'hard', 'strict'].includes(normalised)) {
    return 'enforce';
  }
  if (['off', 'disable', 'disabled'].includes(normalised)) {
    return 'off';
  }
  if (['log', 'soft', 'warn'].includes(normalised)) {
    return 'log';
  }
  return 'log';
}

function normalisePeriod(value: string | QuotaPeriod): QuotaPeriod {
  const normalised = value.toString().toLowerCase();
  if (['day', 'daily'].includes(normalised)) {
    return 'day';
  }
  if (['week', 'weekly'].includes(normalised)) {
    return 'week';
  }
  if (['month', 'monthly'].includes(normalised)) {
    return 'month';
  }
  return 'all';
}

function quotaStatus(kind: QuotaKind): number {
  if (kind === 'website_create' || kind === 'page_create' || kind === 'credits') {
    return 402;
  }
  return 429;
}

function quotaExceededMessage(kind: QuotaKind, usage: QuotaUsage, attempted: number): string {
  const definition = QUOTA_DEFINITIONS[kind];
  const periodLabel = usage.period === 'day'
    ? 'daily'
    : usage.period === 'week'
      ? 'weekly'
      : usage.period === 'month'
        ? 'monthly'
        : 'lifetime';
  if (typeof usage.limit !== 'number') {
    return `${definition.label} limit reached. Please contact support.`;
  }
  return `${definition.label} limit reached. ${usage.used} of ${usage.limit} ${periodLabel} ${definition.action} already used; attempting ${attempted} more exceeds the allowance.`;
}

