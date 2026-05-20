'use client';

import React, { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { useSiteBuilderStore } from '@/lib/studio/stores/site-builder-store';
import { useAutoSave } from '@/lib/studio/hooks/use-auto-save';
import { RefreshCw } from 'lucide-react';

export interface SaveStatusIndicatorProps {
  className?: string;
}

type StatusVisual = {
  key: 'idle' | 'saving' | 'saved' | 'error' | 'pending';
  label: string;
  dotClass: string;
  haloClass: string;
  pulse?: boolean;
  retry?: boolean;
};

const baseButtonClasses = 'fixed bottom-6 right-28 z-40 h-10 w-10 rounded-full border border-white/15 bg-black/70 backdrop-blur flex items-center justify-center shadow-lg transition-all text-white relative';

export function SaveStatusIndicator({ className }: SaveStatusIndicatorProps) {
  const { saveStatus, errorState } = useSiteBuilderStore();
  const { pendingOperations, retry, hasUnsavedChanges } = useAutoSave();

  const status = useMemo<StatusVisual>(() => {
    if (saveStatus === 'error') {
      return {
        key: 'error',
        label: errorState?.message ? `${errorState.message} — click to retry` : 'Save failed — click to retry',
        dotClass: 'bg-red-400',
        haloClass: 'ring-2 ring-red-400/70',
        retry: true
      };
    }

    if (saveStatus === 'saving') {
      return {
        key: 'saving',
        label: pendingOperations > 0 ? `Saving ${pendingOperations} change${pendingOperations > 1 ? 's' : ''}…` : 'Saving…',
        dotClass: 'bg-sky-400',
        haloClass: 'ring-2 ring-sky-400/50',
        pulse: true
      };
    }

    if (saveStatus === 'saved') {
      if (hasUnsavedChanges) {
        return {
          key: 'pending',
          label: 'Changes pending sync',
          dotClass: 'bg-amber-300',
          haloClass: 'ring-2 ring-amber-300/60',
          pulse: true
        };
      }
      return {
        key: 'saved',
        label: 'All changes saved',
        dotClass: 'bg-emerald-400',
        haloClass: 'ring-2 ring-emerald-400/50'
      };
    }

    if (hasUnsavedChanges) {
      return {
        key: 'pending',
        label: 'Changes pending sync',
        dotClass: 'bg-amber-300',
        haloClass: 'ring-2 ring-amber-300/60',
        pulse: true
      };
    }

    return {
      key: 'idle',
      label: 'Ready',
      dotClass: 'bg-zinc-300',
      haloClass: 'ring-1 ring-white/40'
    };
  }, [saveStatus, errorState?.message, pendingOperations, hasUnsavedChanges]);

  const handleRetry = () => {
    if (status.retry) {
      if (errorState?.retry) {
        errorState.retry();
      } else {
        retry();
      }
    }
  };

  return (
    <button
      type="button"
      onClick={status.retry ? handleRetry : undefined}
      className={cn(
        baseButtonClasses,
        status.pulse && 'animate-pulse',
        status.retry ? 'cursor-pointer hover:ring-2 hover:ring-red-300/70 hover:bg-black/60' : 'cursor-default',
        className
      )}
      title={status.label}
      aria-label={status.label}
      data-tutorial-id="save-indicator"
    >
      <span
        className={cn(
          'flex h-3 w-3 items-center justify-center rounded-full transition-colors',
          status.dotClass
        )}
      />
      {status.retry && (
        <span className="pointer-events-none absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px]">
          <RefreshCw className="h-3 w-3" />
        </span>
      )}
      <span
        aria-hidden="true"
        className={cn('pointer-events-none absolute inset-0 -z-10 rounded-full transition-all duration-300', status.haloClass)}
      />
    </button>
  );
}

export function SaveStatusBadge({ className }: { className?: string }) {
  const { saveStatus } = useSiteBuilderStore();
  const { hasUnsavedChanges } = useAutoSave();

  const getBadgeColor = () => {
    switch (saveStatus) {
      case 'saving':
        return 'bg-sky-400 animate-pulse';
      case 'saved':
        return hasUnsavedChanges ? 'bg-amber-300 animate-pulse' : 'bg-emerald-400';
      case 'error':
        return 'bg-red-500 animate-pulse';
      default:
        return hasUnsavedChanges ? 'bg-amber-300 animate-pulse' : 'bg-zinc-400';
    }
  };

  const label = (() => {
    switch (saveStatus) {
      case 'saving':
        return 'Saving changes…';
      case 'saved':
        return hasUnsavedChanges ? 'Changes pending sync' : 'All changes saved';
      case 'error':
        return 'Save failed';
      default:
        return hasUnsavedChanges ? 'Unsaved changes' : 'Ready';
    }
  })();

  return (
    <span
      className={cn('h-2.5 w-2.5 rounded-full border border-black/40', getBadgeColor(), className)}
      title={label}
      aria-label={label}
    />
  );
}



