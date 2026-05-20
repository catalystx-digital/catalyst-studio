import * as React from 'react';
import { cn } from '@/lib/utils';
import { ComponentTheme, SectionBackground } from '../_core/types';
import { themeClass } from './classnames';

type SectionSize = 'none' | 'xs' | 'sm' | 'md' | 'lg' | 'xl';

/**
 * Background color presets for visual rhythm.
 * Maps to Tailwind classes using CSS variables.
 */
const BACKGROUND_PRESETS: Record<NonNullable<SectionBackground['color']>, string> = {
  default: '', // White/card background (no class needed)
  muted: 'bg-muted/50', // Subtle gray background
  primary: 'bg-primary text-primary-foreground', // Brand color background
  accent: 'bg-accent text-accent-foreground', // Accent color background
};

/**
 * Section size configurations following v0.dev quality standards.
 *
 * These values are calibrated to match professional template quality (v0.dev level).
 * When sections stack, their paddings combine (no margin collapse with padding).
 *
 * Target gaps between stacked sections:
 * - xs + xs = ~48px (tight content)
 * - sm + sm = ~64px (standard content)
 * - md + md = ~128px (comfortable spacing - DEFAULT, increased for v0.dev parity)
 * - lg + lg = ~160px (feature sections)
 * - xl + xl = ~192px (hero sections only)
 *
 * v0.dev reference: Sections typically have 80-120px padding on desktop.
 * Updated padding values to match v0.dev's generous spacing.
 */
const SECTION_SIZE_MAP: Record<SectionSize, { padding: string; gap: string }> = {
  none: { padding: '', gap: '' },                              // No padding - for full-bleed heroes
  xs: { padding: 'py-6 md:py-8 lg:py-12', gap: 'gap-4' },     // 24-48px - tight/inline sections
  sm: { padding: 'py-8 md:py-12 lg:py-16', gap: 'gap-5' },    // 32-64px - compact content blocks
  md: { padding: 'py-16 md:py-20 lg:py-28', gap: 'gap-8' },   // 64-112px - standard sections (DEFAULT, v0.dev parity)
  lg: { padding: 'py-20 md:py-24 lg:py-32', gap: 'gap-10' },  // 80-128px - spacious feature sections
  xl: { padding: 'py-24 md:py-28 lg:py-36', gap: 'gap-12' }   // 96-144px - hero/major sections only
};

export interface CmsSectionProps extends React.HTMLAttributes<HTMLElement> {
  as?: React.ElementType;
  size?: SectionSize;
  theme?: ComponentTheme;
  /** Optional variant styling - passed through for data attributes */
  variant?: string;
  /**
   * When true, the container spans full width instead of max-w-7xl.
   */
  bleed?: boolean;
  /**
   * Optional override for the inner container class name.
   */
  containerClassName?: string;
  /**
   * Disable the inner container wrapper entirely. Useful for shell components.
   */
  container?: boolean;
  /**
   * Background configuration for visual rhythm between sections.
   */
  background?: SectionBackground;
}

/**
 * Shared marketing section wrapper that normalises vertical rhythm, container width,
 * and theme/variant classes across CMS components.
 */
/**
 * Resolves background configuration to CSS classes and inline styles.
 */
function resolveBackground(background?: SectionBackground): { className: string; style?: React.CSSProperties } {
  if (!background) {
    return { className: '' };
  }

  // Custom color takes precedence
  if (background.customColor) {
    return {
      className: '',
      style: { backgroundColor: background.customColor },
    };
  }

  // Use preset color class
  const presetClass = background.color ? BACKGROUND_PRESETS[background.color] : '';
  return { className: presetClass };
}

export const CmsSection = React.forwardRef<HTMLElement, CmsSectionProps>(function CmsSection(
  {
    as: Component = 'section',
    size = 'md',
    theme,
    bleed = false,
    container = false,
    background,
    className,
    containerClassName,
    children,
    style,
    ...rest
  },
  ref
) {
  const { padding, gap } = SECTION_SIZE_MAP[size] ?? SECTION_SIZE_MAP.md;
  const { className: bgClassName, style: bgStyle } = resolveBackground(background);

  const outerClassName = cn(
    'w-full',
    padding,
    themeClass(theme),
    bgClassName,
    className
  );

  const mergedStyle = bgStyle ? { ...bgStyle, ...style } : style;

  if (!container) {
    return (
      <Component ref={ref} className={outerClassName} style={mergedStyle} {...rest}>
        {children}
      </Component>
    );
  }

  const containerClasses = cn(
    'flex w-full flex-col',
    bleed ? 'mx-0 max-w-none px-4 sm:px-6 lg:px-8' : 'mx-auto max-w-7xl px-4 sm:px-6 lg:px-8',
    gap,
    containerClassName
  );

  return (
    <Component ref={ref} className={outerClassName} style={mergedStyle} {...rest}>
      <div className={containerClasses}>{children}</div>
    </Component>
  );
});
