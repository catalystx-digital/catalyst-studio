"use client";

import * as React from 'react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { ComponentTheme } from '../_core/types';
import { themeClass } from './classnames';

/**
 * CmsBadge - Thin wrapper around shadcn Badge
 * Only adds: theme class, extended color variants
 * Core styling comes from shadcn
 */

export type CmsBadgeVariant = 'accent' | 'neutral' | 'outline' | 'positive' | 'negative';

// Extended color variants beyond shadcn's default/secondary/destructive/outline
const EXTENDED_VARIANT_CLASSES: Record<CmsBadgeVariant, string> = {
  accent: 'bg-primary/10 text-primary border-transparent',
  neutral: 'bg-muted text-foreground',
  outline: '', // Use shadcn default outline
  positive: 'bg-success/10 text-success border-transparent',
  negative: 'bg-destructive/10 text-destructive border-transparent',
};

export interface CmsBadgeProps extends Omit<React.ComponentPropsWithoutRef<typeof Badge>, 'variant'> {
  variant?: CmsBadgeVariant;
  theme?: ComponentTheme;
}

export const CmsBadge = React.forwardRef<HTMLDivElement, CmsBadgeProps>(
  ({ className, variant = 'neutral', theme, ...props }, ref) => (
    <Badge
      ref={ref}
      variant={variant === 'outline' ? 'outline' : 'secondary'}
      className={cn(EXTENDED_VARIANT_CLASSES[variant], themeClass(theme), className)}
      {...props}
    />
  ),
);
CmsBadge.displayName = 'CmsBadge';
