import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { WebsiteMediaReference } from '@/types/api';

export type ImportJobStatus = 'pending' | 'processing' | 'queued' | 'completed' | 'failed' | 'cancelled';

export interface ImportActivityWebsite {
  id: string;
  name: string;
  icon: string | WebsiteMediaReference | null;
  metadata: Record<string, unknown> | null;
  updatedAt: string;
  createdAt: string;
}

export interface ImportActivityItem {
  id: string;
  websiteId: string;
  status: ImportJobStatus;
  state: 'active' | 'queued' | 'completed';
  progress: number;
  stage: string;
  message: string | null;
  url: string;
  createdAt: string;
  startedAt: string | null;
  updatedAt: string;
  completedAt: string | null;
  queuePosition: number | null;
  estimatedStartSeconds: number | null;
  website: ImportActivityWebsite | null;
}

interface UseImportActivityOptions {
  enabled?: boolean;
  /**
   * Base interval when no active imports are running.
   * Defaults to 120s per PRD guidance (was 30s).
   */
  refetchInterval?: number;
}

// Optimized polling intervals per PRD prd-prisma-query-optimization.md Solution 2
const DEFAULT_IDLE_INTERVAL_MS = 120_000; // 2 minutes when idle (was 30s)
const ACTIVE_BACKOFF_INTERVALS_MS = [10_000, 20_000, 30_000] as const; // Slower backoff (was 5/10/20s)
const STOP_POLLING_AFTER_IDLE_MS = 300_000; // Stop polling after 5 minutes of no activity

function collectActiveJobIds(data: ImportActivityItem[] | undefined): Set<string> {
  if (!data || data.length === 0) {
    return new Set();
  }

  const activeIds = new Set<string>();

  for (const job of data) {
    const isActiveState = job.state === 'active' || job.state === 'queued';
    const isActiveStatus = job.status === 'processing' || job.status === 'pending';

    if (isActiveState || isActiveStatus) {
      activeIds.add(job.id);
    }
  }

  return activeIds;
}

function setsEqual(a: Set<string>, b: Set<string>): boolean {
  if (a.size !== b.size) {
    return false;
  }

  for (const value of a) {
    if (!b.has(value)) {
      return false;
    }
  }

  return true;
}

async function fetchImportActivity(): Promise<ImportActivityItem[]> {
  const response = await fetch('/api/dashboard/import-activity');
  const payload = await response.json();

  if (!response.ok) {
    const message = payload?.error?.message || 'Failed to load import activity';
    throw new Error(message);
  }

  return (payload.data ?? []) as ImportActivityItem[];
}

export function useImportActivity(options?: UseImportActivityOptions) {
  const idleInterval = options?.refetchInterval ?? DEFAULT_IDLE_INTERVAL_MS;
  const pollingStateRef = useRef<{
    hasActive: boolean;
    intervalIndex: number;
    activeIds: Set<string>;
  }>({
    hasActive: false,
    intervalIndex: 0,
    activeIds: new Set(),
  });

  // Track last activity time and polling state
  const lastActivityRef = useRef<number>(Date.now());
  const [isPollingActive, setIsPollingActive] = useState(true);

  // Update activity timestamp on user interaction
  useEffect(() => {
    const updateActivity = () => {
      lastActivityRef.current = Date.now();
      if (!isPollingActive) {
        setIsPollingActive(true);
        console.log('[use-import-activity] Resuming polling due to user activity');
      }
    };

    // Listen for user activity
    window.addEventListener('focus', updateActivity);
    window.addEventListener('mousemove', updateActivity);
    window.addEventListener('keydown', updateActivity);

    return () => {
      window.removeEventListener('focus', updateActivity);
      window.removeEventListener('mousemove', updateActivity);
      window.removeEventListener('keydown', updateActivity);
    };
  }, [isPollingActive]);

  // Check if should stop polling due to idle
  useEffect(() => {
    const checkIdle = setInterval(() => {
      const idleTime = Date.now() - lastActivityRef.current;
      if (idleTime > STOP_POLLING_AFTER_IDLE_MS && isPollingActive) {
        setIsPollingActive(false);
        console.log('[use-import-activity] Stopping polling due to inactivity');
      }
    }, 60_000); // Check every minute

    return () => clearInterval(checkIdle);
  }, [isPollingActive]);

  const queryResult = useQuery({
    queryKey: ['dashboard', 'import-activity'],
    queryFn: fetchImportActivity,
    enabled: options?.enabled ?? true,
    refetchInterval: () => {
      // Stop polling if user is inactive
      if (!isPollingActive) {
        return false;
      }

      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
        return false;
      }

      if (!pollingStateRef.current.hasActive) {
        return idleInterval;
      }

      const cappedIndex = Math.min(
        pollingStateRef.current.intervalIndex,
        ACTIVE_BACKOFF_INTERVALS_MS.length - 1,
      );
      return ACTIVE_BACKOFF_INTERVALS_MS[cappedIndex];
    },
    refetchIntervalInBackground: false,
    staleTime: Math.max(idleInterval / 2, 5_000),
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });

  useEffect(() => {
    const data = queryResult.data;
    if (!data) {
      return;
    }

    const activeIds = collectActiveJobIds(data);

    if (activeIds.size === 0) {
      pollingStateRef.current = {
        hasActive: false,
        intervalIndex: 0,
        activeIds: new Set(),
      };
      return;
    }

    const previousState = pollingStateRef.current;
    const isSameActiveSet = setsEqual(previousState.activeIds, activeIds);
    const nextIntervalIndex = isSameActiveSet
      ? Math.min(previousState.intervalIndex + 1, ACTIVE_BACKOFF_INTERVALS_MS.length - 1)
      : 0;

    pollingStateRef.current = {
      hasActive: true,
      intervalIndex: nextIntervalIndex,
      activeIds,
    };
  }, [queryResult.data]);

  useEffect(() => {
    if (queryResult.isError) {
      pollingStateRef.current = {
        hasActive: false,
        intervalIndex: 0,
        activeIds: new Set(),
      };
    }
  }, [queryResult.isError]);

  return queryResult;
}
