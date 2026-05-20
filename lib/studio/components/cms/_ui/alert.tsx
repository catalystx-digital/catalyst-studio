"use client";

import * as React from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { cn } from '@/lib/utils';
import { ComponentTheme } from '../_core/types';
import { themeClass } from './classnames';

/**
 * Check if we should show development-only empty states.
 * Returns false in production to prevent placeholder messages from appearing on exported sites.
 */
export function shouldShowDevEmptyState(): boolean {
  if (process.env.NODE_ENV === 'production') return false;
  if (process.env.NEXT_PUBLIC_EXPORT_BUILD === 'true') return false;
  if (typeof window !== 'undefined') {
    const isStaticExport = document.querySelector('meta[name="cms-export"]') !== null;
    if (isStaticExport) return false;
  }
  return true;
}

/**
 * CmsAlert wrappers - Thin wrappers around shadcn Alert components
 * Only add: theme class, extended variants (success/accent), devOnly prop
 * Core styling comes from shadcn
 */

export type CmsAlertVariant = 'default' | 'success' | 'accent' | 'destructive';

// Extended variants beyond shadcn's default/destructive
const EXTENDED_VARIANT_CLASSES: Record<CmsAlertVariant, string> = {
  default: '',
  destructive: '',
  accent: 'border-primary/50 bg-primary/10 text-primary [&>svg]:text-primary',
  success: 'border-success/50 bg-success/10 text-success [&>svg]:text-success',
};

export interface CmsAlertProps extends Omit<React.ComponentPropsWithoutRef<typeof Alert>, 'variant'> {
  variant?: CmsAlertVariant;
  theme?: ComponentTheme;
  /** When true, only renders in development mode (not on exported sites) */
  devOnly?: boolean;
}

export const CmsAlert = React.forwardRef<HTMLDivElement, CmsAlertProps>(
  ({ className, variant = 'default', theme, devOnly = false, ...props }, ref) => {
    if (devOnly && !shouldShowDevEmptyState()) return null;

    const shadcnVariant = variant === 'destructive' ? 'destructive' : 'default';

    return (
      <Alert
        ref={ref}
        variant={shadcnVariant}
        className={cn(EXTENDED_VARIANT_CLASSES[variant], themeClass(theme), className)}
        {...props}
      />
    );
  },
);
CmsAlert.displayName = 'CmsAlert';

export interface CmsAlertTitleProps extends React.ComponentPropsWithoutRef<typeof AlertTitle> {
  theme?: ComponentTheme;
}

export const CmsAlertTitle = React.forwardRef<HTMLParagraphElement, CmsAlertTitleProps>(
  ({ className, theme, ...props }, ref) => (
    <AlertTitle ref={ref} className={cn(themeClass(theme), className)} {...props} />
  ),
);
CmsAlertTitle.displayName = 'CmsAlertTitle';

export interface CmsAlertDescriptionProps extends React.ComponentPropsWithoutRef<typeof AlertDescription> {
  theme?: ComponentTheme;
}

export const CmsAlertDescription = React.forwardRef<HTMLParagraphElement, CmsAlertDescriptionProps>(
  ({ className, theme, ...props }, ref) => (
    <AlertDescription ref={ref} className={cn(themeClass(theme), className)} {...props} />
  ),
);
CmsAlertDescription.displayName = 'CmsAlertDescription';
