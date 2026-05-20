import { cn } from '@/lib/utils';
import { ComponentTheme } from '../_core/types';
import { themeClass } from './classnames';

export type CmsHeadingLevel = 'display' | 1 | 2 | 3 | 4 | 5 | 6;
export type CmsBodySize = 'caption' | 'xs' | 'sm' | 'md' | 'lg' | 'xl';

const headingScale: Record<CmsHeadingLevel, string> = {
  // text-balance prevents orphan words in headings (Vercel design guidelines)
  display: 'ds-heading-display font-black tracking-tighter text-balance',
  1: 'ds-heading-1 font-bold tracking-tight text-balance',
  2: 'ds-heading-2 font-bold tracking-tight text-balance',
  3: 'ds-heading-3 font-semibold tracking-normal text-balance',
  4: 'ds-heading-4 font-semibold tracking-normal',
  5: 'ds-heading-5 font-medium tracking-normal',
  6: 'ds-heading-6 font-medium tracking-wide',
};

const bodyScale: Record<CmsBodySize, string> = {
  caption: 'ds-body-xs',
  xs: 'ds-body-xs',
  sm: 'ds-body-sm',
  md: 'ds-body-md',
  lg: 'ds-body-lg',
  xl: 'ds-body-xl',
};

/**
 * Returns heading typography classes using shadcn CSS variables.
 *
 * @param level - Heading level (display, 1-6)
 * @param theme - Optional theme override. Usually NOT needed when parent element
 *                already has theme class set (CSS cascade handles inheritance).
 *                Only pass when heading needs different theme than parent.
 * @param extra - Additional Tailwind classes to merge
 */
export function cmsHeading(
  level: CmsHeadingLevel = 3,
  theme?: ComponentTheme,
  extra?: string,
): string {
  return cn(
    'text-foreground',
    headingScale[level],
    themeClass(theme),
    extra,
  );
}

/**
 * Returns body text typography classes using shadcn CSS variables.
 *
 * @param size - Body text size (xs, sm, md, lg, xl, caption)
 * @param theme - Optional theme override. Usually NOT needed when parent element
 *                already has theme class set (CSS cascade handles inheritance).
 *                Only pass when text needs different theme than parent.
 * @param extra - Additional Tailwind classes to merge
 */
export function cmsBody(
  size: CmsBodySize = 'md',
  theme?: ComponentTheme,
  extra?: string,
): string {
  return cn(
    'text-muted-foreground',
    bodyScale[size],
    themeClass(theme),
    extra,
  );
}
