"use client";

import * as React from 'react';
import { cn } from '@/lib/utils';
import { ComponentTheme } from '../_core/types';
import { buildCmsClassName } from './classnames';

type CmsButtonGroupAlign = 'start' | 'center' | 'end' | 'stretch';
type CmsButtonGroupBreakpoint = 'sm' | 'md';

const ALIGN_CLASS_MAP: Record<
  CmsButtonGroupAlign,
  (prefix: string) => string
> = {
  start: (prefix) => `${prefix}items-center ${prefix}justify-start`,
  center: (prefix) => `${prefix}items-center ${prefix}justify-center`,
  end: (prefix) => `${prefix}items-center ${prefix}justify-end`,
  stretch: (prefix) => `${prefix}items-stretch ${prefix}justify-between`,
};

export interface CmsButtonGroupProps
  extends React.HTMLAttributes<HTMLDivElement> {
  theme?: ComponentTheme;
  /** Optional variant styling - passed through for data attributes */
  variant?: string;
  /**
   * Controls how items align on the responsive row breakpoint.
   * Defaults to `center`.
   */
  align?: CmsButtonGroupAlign;
  /**
   * Determines when the group switches from a column to a row layout.
   * Defaults to `sm`.
   */
  responsive?: CmsButtonGroupBreakpoint;
  /**
   * Allow buttons to wrap onto multiple rows once the responsive breakpoint is reached.
   */
  wrap?: boolean;
  /**
   * When true, forces the group to take full width on mobile layouts.
   */
  fullWidthOnMobile?: boolean;
}

export const CmsButtonGroup = React.forwardRef<
  HTMLDivElement,
  CmsButtonGroupProps
>(
  (
    {
      className,
      theme,
      align = 'center',
      responsive = 'sm',
      wrap = false,
      fullWidthOnMobile = false,
      children,
      ...props
    },
    ref,
  ) => {
    const prefix = `${responsive}:`;
    const alignClass = ALIGN_CLASS_MAP[align]?.(prefix) ?? ALIGN_CLASS_MAP.center(prefix);

    const baseClass = cn(
      'cms-button-group flex flex-col gap-3',
      `${prefix}flex-row`,
      wrap ? `${prefix}flex-wrap` : '',
      alignClass,
      fullWidthOnMobile && 'w-full',
      className,
    );

    return (
      <div
        ref={ref}
        className={buildCmsClassName({
          base: baseClass,
          theme,
        })}
        {...props}
      >
        {children}
      </div>
    );
  },
);
CmsButtonGroup.displayName = 'CmsButtonGroup';
