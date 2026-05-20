'use client';

import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

export type WarningLevel = 'none' | 'warning80' | 'warning90' | 'limit' | 'grace' | 'blocked';

interface UsageProgressBarProps {
  label: string;
  current: number;
  limit: number | null;
  warningLevel: WarningLevel;
  graceAvailable?: boolean;
  className?: string;
}

/**
 * Usage Progress Bar - displays usage with color-coded warning levels
 */
export function UsageProgressBar({
  label,
  current,
  limit,
  warningLevel,
  graceAvailable,
  className,
}: UsageProgressBarProps) {
  // Calculate percentage (capped at 100 for display)
  const percentage = limit ? Math.min(100, (current / limit) * 100) : 0;

  // Determine indicator color based on warning level
  const indicatorColors: Record<WarningLevel, string> = {
    none: 'bg-green-500',
    warning80: 'bg-yellow-500',
    warning90: 'bg-orange-500',
    limit: 'bg-red-500',
    grace: 'bg-red-600',
    blocked: 'bg-red-700',
  };

  // Determine text color for the usage display
  const textColors: Record<WarningLevel, string> = {
    none: 'text-muted-foreground',
    warning80: 'text-yellow-600',
    warning90: 'text-orange-600',
    limit: 'text-red-600',
    grace: 'text-red-600',
    blocked: 'text-red-700',
  };

  // Format the usage display
  const formatUsage = () => {
    if (limit === null) {
      return `${current.toLocaleString()} (unlimited)`;
    }

    const suffix = warningLevel === 'grace' ? ' (grace)' : '';
    return `${current.toLocaleString()} / ${limit.toLocaleString()}${suffix}`;
  };

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{label}</span>
        <span className={cn('text-sm font-medium', textColors[warningLevel])}>
          {formatUsage()}
        </span>
      </div>
      <Progress
        value={percentage}
        className="h-2"
        indicatorClassName={indicatorColors[warningLevel]}
      />
      {warningLevel === 'grace' && graceAvailable && (
        <p className="text-xs text-red-600">Using grace allowance - last one!</p>
      )}
      {warningLevel === 'blocked' && (
        <p className="text-xs text-red-700">Limit exceeded. Upgrade or wait for reset.</p>
      )}
    </div>
  );
}
