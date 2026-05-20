'use client';

import { useMemo } from 'react';
import { AlertTriangle, RefreshCcw } from 'lucide-react';

import { useAccountUsage } from '@/lib/api/hooks/use-account-usage';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const numberFormatter = new Intl.NumberFormat('en-US');

function formatNumber(value: number) {
  return numberFormatter.format(value);
}

function formatPeriod(period: string | null | undefined) {
  switch (period) {
    case 'day':
      return 'daily';
    case 'week':
      return 'weekly';
    case 'month':
      return 'monthly';
    case 'all':
      return 'lifetime';
    default:
      return 'per cycle';
  }
}

function formatMode(mode: string | undefined) {
  if (!mode) return null;
  const normalised = mode.toLowerCase();
  if (normalised === 'enforce' || normalised === 'hard') {
    return 'Enforced';
  }
  if (normalised === 'off') {
    return 'Disabled';
  }
  return 'Monitoring';
}

interface UsageMetricCardProps {
  label: string;
  quota?: {
    limit: number | null;
    used: number;
    available: number | null;
    period: string | null;
    mode: string;
  };
  isLoading: boolean;
}

function UsageMetricCard({ label, quota, isLoading }: UsageMetricCardProps) {
  if (isLoading) {
    return (
      <div className="rounded-lg border border-gray-800 bg-gray-900/50 p-5 animate-pulse space-y-4">
        <div className="h-5 w-2/3 rounded bg-gray-800" />
        <div className="h-3 w-1/2 rounded bg-gray-800" />
        <div className="h-2 w-full rounded bg-gray-800" />
        <div className="h-2 w-1/2 rounded bg-gray-800" />
      </div>
    );
  }

  if (!quota) {
    return (
      <div className="rounded-lg border border-gray-800 bg-gray-900/60 p-5 text-sm text-gray-400">
        <p className="font-semibold text-gray-200">{label}</p>
        <p className="mt-2">Usage data is unavailable for this metric.</p>
      </div>
    );
  }

  const limit = typeof quota.limit === 'number' ? quota.limit : null;
  const used = quota.used ?? 0;
  const available = typeof quota.available === 'number' ? Math.max(0, quota.available) : null;
  const remaining = available ?? (limit != null ? Math.max(0, limit - used) : null);
  const percentage = limit && limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  const modeLabel = formatMode(quota.mode);

  return (
    <div className="rounded-lg border border-gray-800 bg-gray-900/70 p-5 text-sm text-gray-200 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-semibold text-white text-base">{label}</p>
          <p className="text-xs text-gray-400 mt-1">{limit != null ? `Resets ${formatPeriod(quota.period)}` : 'Unlimited usage'}</p>
        </div>
        {modeLabel && (
          <Badge variant="outline" className="text-xs text-gray-200 border-gray-700">
            {modeLabel}
          </Badge>
        )}
      </div>

      {limit != null ? (
        <div className="space-y-3">
          <Progress value={percentage} className="h-2 bg-gray-800" indicatorClassName="bg-catalyst-orange" />
          <div className="flex items-center justify-between text-xs text-gray-400">
            <span>{formatNumber(used)} used</span>
            <span>{formatNumber(limit)} limit</span>
          </div>
          <p className="text-xs text-gray-400">
            {remaining != null ? `${formatNumber(remaining)} remaining` : 'Limit information unavailable'}
          </p>
        </div>
      ) : (
        <div className="rounded-md border border-gray-800 bg-gray-900/80 px-3 py-2 text-xs text-gray-300">
          No enforced limit for this metric. Usage is tracked for monitoring only.
        </div>
      )}
    </div>
  );
}

export function UsageOverview() {
  const { data, isLoading, error, refetch, isFetching } = useAccountUsage();

  const metrics = useMemo(
    () => [
      {
        key: 'import_page' as const,
        label: 'Website imports',
        quota: data?.quotas?.import_page,
      },
      {
        key: 'chat_tokens' as const,
        label: 'AI chat tokens',
        quota: data?.quotas?.chat_tokens,
      },
    ],
    [data?.quotas?.chat_tokens, data?.quotas?.import_page]
  );

  const showSkeleton = isLoading && !data;

  return (
    <section className="space-y-4" aria-label="Usage quotas">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-white">Usage & quotas</h2>
          <p className="text-sm text-gray-400">
            Track daily import and AI token consumption. Limits refresh automatically based on your plan.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isFetching && !showSkeleton && <RefreshCcw className="h-4 w-4 animate-spin text-gray-400" aria-hidden="true" />}
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => refetch()}
            className="border-gray-700 text-gray-200 hover:bg-gray-800"
          >
            Refresh usage
          </Button>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-100">
          <AlertTriangle className="h-5 w-5 flex-shrink-0" aria-hidden="true" />
          <div>
            <p className="font-medium text-amber-50">Unable to load usage metrics</p>
            <p className="text-xs text-amber-100/80 mt-1">
              {error instanceof Error ? error.message : 'An unexpected error occurred while fetching quota data.'}
            </p>
          </div>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {metrics.map(({ key, label, quota }) => (
          <UsageMetricCard key={key} label={label} quota={quota} isLoading={showSkeleton} />
        ))}
      </div>
    </section>
  );
}
