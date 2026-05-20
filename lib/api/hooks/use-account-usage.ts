import { useQuery } from '@tanstack/react-query';
import type { QuotaKind } from '@/lib/usage/limits';

export interface AccountQuotaItem {
  limit: number | null;
  used: number;
  available: number | null;
  period: string | null;
  mode: string;
}

export interface AccountUsageSummary {
  quotas: Record<QuotaKind, AccountQuotaItem>;
  integrations: {
    total: number;
    enabled: number;
  };
  enforcement: {
    mode: string;
  };
}

interface UseAccountUsageOptions {
  enabled?: boolean;
  refetchInterval?: number;
}

async function fetchAccountUsage(): Promise<AccountUsageSummary> {
  const response = await fetch('/api/account/usage');
  const payload = await response.json();

  if (!response.ok) {
    const message = payload?.error?.message || 'Failed to load account usage';
    throw new Error(message);
  }

  return payload.data as AccountUsageSummary;
}

export function useAccountUsage(options?: UseAccountUsageOptions) {
  const refetchInterval = options?.refetchInterval ?? 30_000;

  return useQuery({
    queryKey: ['account', 'usage'],
    queryFn: fetchAccountUsage,
    enabled: options?.enabled ?? true,
    refetchInterval,
    staleTime: refetchInterval / 2,
  });
}
