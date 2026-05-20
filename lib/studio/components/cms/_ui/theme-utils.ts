/**
 * Theme utility for applying design system theme to shadcn components
 *
 * This is the ONLY customization layer between CMS and shadcn.
 * Everything else uses shadcn directly.
 */
import { cn } from '@/lib/utils';
import { ComponentTheme } from '../_core/types';

/**
 * Resolve theme to a concrete value (exclude 'auto')
 */
export function resolveTheme(
  theme?: ComponentTheme,
): Exclude<ComponentTheme, 'auto'> | undefined {
  if (!theme || theme === 'auto') {
    return undefined;
  }
  return theme;
}

/**
 * Get theme class for any component
 */
export function themeClass(theme?: ComponentTheme): string | undefined {
  const resolved = resolveTheme(theme);
  return resolved ? `theme-${resolved}` : undefined;
}

/**
 * Apply theme class to any component - thin utility, NOT a wrapper
 */
export function withTheme(className?: string, theme?: ComponentTheme): string {
  return cn(themeClass(theme), className);
}

/**
 * Standard focus ring classes - use shadcn's built-in pattern
 */
export const focusRing =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2';
