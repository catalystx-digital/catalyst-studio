import React from 'react';

import { cn } from '@/lib/utils';

import {
  CmsSection,
  dsSpacing,
} from '../../_ui';
import type { CMSComponentProps, ComponentTheme } from '../../_core/types';
import { renderCMSComponents } from '../../_factory/renderer.server';
import { TwoColumnProps } from './two-column.types';

function withTheme(
  components: CMSComponentProps[] | undefined,
  theme: ComponentTheme,
): CMSComponentProps[] | undefined {
  if (!Array.isArray(components) || components.length === 0) {
    return undefined;
  }

  return components.map((component) =>
    component.theme ? component : { ...component, theme },
  );
}

export async function TwoColumnServer({
  id,
  content,
  className,
  style,
  theme = 'auto',
  variant = 'default',
  analyticsId,
}: TwoColumnProps) {
  const {
    leftColumn,
    rightColumn,
    columnRatio = '50-50',
    reverseOnMobile = false,
    gap = 'medium',
    verticalAlignment = 'top',
  } = content;

  const gapClass =
    {
      small: dsSpacing.gap('md'),
      medium: dsSpacing.gap('xl'),
      large: dsSpacing.gap('2xl'),
    }[gap] ?? dsSpacing.gap('xl');

  const alignClass =
    {
      top: 'items-start',
      center: 'items-center',
      bottom: 'items-end',
    }[verticalAlignment] ?? 'items-start';

  const ratioClass =
    {
      '25-75': 'lg:grid-cols-[1fr_3fr]',
      '30-70': 'lg:grid-cols-[3fr_7fr]',
      '40-60': 'lg:grid-cols-[2fr_3fr]',
      '50-50': 'lg:grid-cols-2',
      '60-40': 'lg:grid-cols-[3fr_2fr]',
      '70-30': 'lg:grid-cols-[7fr_3fr]',
      '75-25': 'lg:grid-cols-[3fr_1fr]',
    }[columnRatio] ?? 'lg:grid-cols-2';

  const themedLeftComponents = withTheme(
    Array.isArray(leftColumn) ? leftColumn : undefined,
    theme,
  );

  const themedRightComponents = withTheme(
    Array.isArray(rightColumn) ? rightColumn : undefined,
    theme,
  );

  const leftOrderClass = reverseOnMobile
    ? 'order-2 lg:order-1'
    : 'order-1 lg:order-1';
  const rightOrderClass = reverseOnMobile
    ? 'order-1 lg:order-2'
    : 'order-2 lg:order-2';

  const leftNodes = themedLeftComponents
    ? await renderCMSComponents(themedLeftComponents)
    : null;
  const rightNodes = themedRightComponents
    ? await renderCMSComponents(themedRightComponents)
    : null;

  return (
    <CmsSection
      id={id}
      size="md"
      theme={theme}
      variant={variant}
      className={cn('cms-two-column', className)}
      containerClassName={cn('w-full flex flex-col', dsSpacing.gap('lg'))}
      style={style}
      data-analytics-id={analyticsId}
      data-component-type="two-column"
      data-variant={variant}
    >
      <div
        className={cn(
          'grid grid-cols-1',
          ratioClass,
          gapClass,
          alignClass,
        )}
        data-testid="two-column-grid"
      >
        <div
          className={cn(
            'cms-two-column__column flex flex-col',
            dsSpacing.gap('md'),
            leftOrderClass,
          )}
          data-column="left"
          data-column-type="components"
        >
          {leftNodes}
        </div>
        <div
          className={cn(
            'cms-two-column__column flex flex-col',
            dsSpacing.gap('md'),
            rightOrderClass,
          )}
          data-column="right"
          data-column-type="components"
        >
          {rightNodes}
        </div>
      </div>
    </CmsSection>
  );
}
