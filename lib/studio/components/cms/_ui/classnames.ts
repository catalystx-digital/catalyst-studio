import { cn } from '@/lib/utils';
import { ComponentTheme } from '../_core/types';

export function resolveTheme(
  theme?: ComponentTheme,
): Exclude<ComponentTheme, 'auto'> | undefined {
  if (!theme || theme === 'auto') {
    return undefined;
  }
  return theme;
}

export function themeClass(theme?: ComponentTheme): string | undefined {
  const resolved = resolveTheme(theme);
  return resolved ? `theme-${resolved}` : undefined;
}

interface BuildClassOptions {
  base?: string;
  theme?: ComponentTheme;
  className?: string;
  /** Optional variant - currently unused but accepted for future use */
  variant?: string;
  /** Whether to include variant in class names - currently unused */
  includeVariant?: boolean;
}

export function buildCmsClassName({
  base,
  theme,
  className,
}: BuildClassOptions): string {
  return cn(
    base,
    themeClass(theme),
    className,
  );
}
