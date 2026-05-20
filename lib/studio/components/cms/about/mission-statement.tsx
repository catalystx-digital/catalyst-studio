import React from 'react';
import { cn } from '@/lib/utils';

import { Card, CardContent, CardHeader } from '@/components/ui/card';
import {
  CmsBadge,
  CmsSection,
  CARD_TONES,
  cmsBody,
  cmsHeading,
  dsSpacing,
  themeClass,
} from '../_ui';
import type { CmsCardTone } from '../_ui';
import { sanitizeText } from '../_core/security';
import type {
  CMSComponentProps,
  ComponentTheme,
} from '../_core/types';

interface MissionStatementValue {
  title?: string;
  label?: string;
  value?: string;
  text?: string;
}

interface MissionStatementContent {
  title?: string;
  mission?: string;
  vision?: string;
  values?: Array<string | MissionStatementValue>;
}

export interface MissionStatementProps
  extends Omit<CMSComponentProps, 'content' | 'children'> {
  content: MissionStatementContent;
}

function resolveTone(): CmsCardTone {
  return 'default';
}

function normalizeValues(
  values?: MissionStatementContent['values'],
): string[] {
  if (!Array.isArray(values)) {
    return [];
  }

  return values
    .map((value) => {
      if (typeof value === 'string') {
        return sanitizeText(value);
      }

      if (typeof value === 'object' && value !== null) {
        const candidate =
          value.title ?? value.label ?? value.value ?? value.text;
        if (typeof candidate === 'string') {
          return sanitizeText(candidate);
        }
      }

      return '';
    })
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

function sanitizeCopy(value: unknown, fallback?: string): string | undefined {
  if (typeof value !== 'string') {
    return fallback;
  }

  const sanitized = sanitizeText(value);
  return sanitized.length > 0 ? sanitized : fallback;
}

const DEFAULT_TITLE = 'Our Mission';
const DEFAULT_MISSION =
  'To deliver exceptional value and innovation to the communities we serve.';

export default function MissionStatement({
  id,
  className,
  style,
  theme = 'auto' as ComponentTheme,
  content,
  analytics,
  onInteraction,
}: MissionStatementProps): React.ReactElement {
  const title = sanitizeCopy(content?.title, DEFAULT_TITLE);
  const mission = sanitizeCopy(content?.mission, DEFAULT_MISSION);
  const vision = sanitizeCopy(content?.vision);
  const values = normalizeValues(content?.values);

  return (
    <CmsSection
      id={id}
      size="md"
      theme={theme}
      className={cn('cms-mission-statement', className)}
      style={style}
      data-component-type="mission-statement"
      data-analytics-id={analytics?.trackingId}
      containerClassName={cn('items-center', dsSpacing.gap('xl'))}
    >
      <Card
        className={cn(
          CARD_TONES[resolveTone()],
          themeClass(theme),
          'mx-auto max-w-4xl text-center shadow-xl border-t-4 border-t-primary'
        )}
      >
        <CardHeader
          className={cn('flex flex-col gap-2 p-[var(--component-padding)]', themeClass(theme), 'text-center', dsSpacing.gap('sm'))}
        >
          {title ? (
            <h2 className={cmsHeading(3, theme, 'mx-auto max-w-3xl text-balance font-bold tracking-tight')}>
              {title}
            </h2>
          ) : null}
          {mission ? (
            <p
              className={cmsBody(
                'lg',
                theme,
                'mx-auto max-w-2xl text-balance text-muted-foreground italic font-medium leading-relaxed',
              )}
            >
              {mission}
            </p>
          ) : null}
        </CardHeader>

        <CardContent
          className={cn('p-[var(--component-padding)] pt-0', themeClass(theme), 'flex flex-col', dsSpacing.gap('xl'))}
        >
          {vision ? (
            <div className={cn('flex flex-col rounded-xl bg-gradient-to-r from-primary/5 to-transparent border-l-4 border-l-primary shadow-sm', dsSpacing.gap('sm'), dsSpacing.padding('lg'))}>
              <h3 className={cmsHeading(4, theme, 'font-bold')}>Our Vision</h3>
              <p className={cmsBody('md', theme, 'mx-auto max-w-2xl leading-relaxed')}>
                {vision}
              </p>
            </div>
          ) : null}

          {values.length > 0 ? (
            <div className={cn('flex flex-col', dsSpacing.gap('md'))}>
              <h3 className={cmsHeading(4, theme, 'font-bold')}>Our Values</h3>
              <ul
                className={cn(
                  'flex flex-wrap justify-center',
                  dsSpacing.gap('sm'),
                )}
              >
                {values.map((value) => (
                  <li key={value}>
                    <CmsBadge
                      variant="outline"
                      theme={theme}
                      className="rounded-full px-5 py-2.5 text-sm font-semibold uppercase tracking-wide transition-[box-shadow,background-color,border-color] duration-200 hover:shadow-md hover:bg-primary/10 hover:border-primary cursor-pointer"
                      onClick={(event: React.MouseEvent<HTMLDivElement>) => {
                        onInteraction?.('value-click', { value });
                      }}
                    >
                      {value}
                    </CmsBadge>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </CmsSection>
  );
}
