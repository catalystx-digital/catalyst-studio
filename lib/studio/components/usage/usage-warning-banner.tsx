'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ComingSoonModal } from './coming-soon-modal';
import type { WarningLevel } from './usage-progress-bar';

interface UsageWarningBannerProps {
  type: 'website' | 'page' | 'token';
  current: number;
  limit: number | null;
  warningLevel: WarningLevel;
  className?: string;
}

/**
 * Usage Warning Banner - inline warning for creation flows
 *
 * Place this component in website/page creation modals to warn users
 * when they're approaching or at their usage limits.
 */
export function UsageWarningBanner({
  type,
  current,
  limit,
  warningLevel,
  className,
}: UsageWarningBannerProps) {
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);

  // Don't show if no warning needed
  if (warningLevel === 'none' || limit === null) {
    return null;
  }

  const typeLabels: Record<string, string> = {
    website: 'websites',
    page: 'pages',
    token: 'tokens',
  };

  const colors: Record<WarningLevel, string> = {
    none: '',
    warning80: 'border-yellow-200 bg-yellow-50 text-yellow-800',
    warning90: 'border-orange-200 bg-orange-50 text-orange-800',
    limit: 'border-red-200 bg-red-50 text-red-800',
    grace: 'border-red-200 bg-red-50 text-red-800',
    blocked: 'border-red-300 bg-red-100 text-red-900',
  };

  const messages: Record<WarningLevel, string> = {
    none: '',
    warning80: `You've used ${current}/${limit} ${typeLabels[type]} this month`,
    warning90: `You've used ${current}/${limit} ${typeLabels[type]}. Limit approaching!`,
    limit: `You've reached your limit. 1 grace ${type} remaining.`,
    grace: `Last ${type}! Using grace allowance.`,
    blocked: `Limit exceeded. Upgrade to Pro or wait until reset.`,
  };

  const showUpgradeButton = ['limit', 'grace', 'blocked'].includes(warningLevel);

  return (
    <>
      <div
        className={cn(
          'flex items-center justify-between gap-4 rounded-md border p-3',
          colors[warningLevel],
          className
        )}
      >
        <p className="text-sm">{messages[warningLevel]}</p>
        {showUpgradeButton && (
          <Button
            variant="link"
            size="sm"
            className="shrink-0 text-inherit underline"
            onClick={() => setUpgradeModalOpen(true)}
          >
            Upgrade to Pro
          </Button>
        )}
      </div>

      <ComingSoonModal
        open={upgradeModalOpen}
        onClose={() => setUpgradeModalOpen(false)}
      />
    </>
  );
}
