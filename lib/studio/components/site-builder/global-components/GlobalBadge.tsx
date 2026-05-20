'use client';

import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Globe } from 'lucide-react';
import { cn } from '@/lib/utils';

interface GlobalBadgeProps {
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
  className?: string;
  variant?: 'default' | 'secondary' | 'outline';
}

export function GlobalBadge({
  size = 'sm',
  showIcon = true,
  className,
  variant = 'default'
}: GlobalBadgeProps) {
  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-2.5 py-0.5',
    lg: 'text-base px-3 py-1'
  };

  const iconSizes = {
    sm: 'h-3 w-3',
    md: 'h-4 w-4',
    lg: 'h-5 w-5'
  };

  return (
    <Badge
      variant={variant}
      className={cn(
        'inline-flex items-center gap-1',
        sizeClasses[size],
        'bg-blue-100 text-blue-700 hover:bg-blue-200',
        'dark:bg-blue-900 dark:text-blue-300 dark:hover:bg-blue-800',
        className
      )}
    >
      {showIcon && (
        <Globe className={cn(iconSizes[size], 'shrink-0')} />
      )}
      <span>Global</span>
    </Badge>
  );
}