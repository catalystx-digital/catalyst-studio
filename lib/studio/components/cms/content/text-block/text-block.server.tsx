import React from 'react';
import DOMPurify from 'isomorphic-dompurify';
import { cn } from '@/lib/utils';

import { Card, CardContent, CardHeader } from '@/components/ui/card';
import {
  CmsSection,
  CmsCardTone,
  CARD_TONES,
  cmsBody,
  cmsHeading,
  dsSpacing,
  themeClass,
} from '../../_ui';
import { sanitizeText } from '../../_core/security';
import { SafeHtml } from '../../_core/safe-html';
import type { CmsHeadingLevel } from '../../_ui/typography';
import { TextBlockProps } from './text-block.types';

const ALIGNMENT_CLASS: Record<
  NonNullable<TextBlockProps['content']['alignment']>,
  string
> = {
  left: 'text-left',
  center: 'text-center',
  right: 'text-right',
  justify: 'text-justify',
};

const HEADING_TAG_MAP: Record<CmsHeadingLevel, React.ElementType> = {
  display: 'h1',
  1: 'h1',
  2: 'h2',
  3: 'h3',
  4: 'h4',
  5: 'h5',
  6: 'h6',
};

function resolveCardTone(variant: TextBlockProps['variant']): CmsCardTone {
  switch (variant) {
    case 'minimal':
      return 'minimal';
    case 'compact':
      return 'muted';
    case 'expanded':
      return 'accent';
    default:
      return 'default';
  }
}

function resolveColumnsClasses(columns: TextBlockProps['content']['columns']) {
  switch (columns) {
    case 3:
      return 'md:columns-2 xl:columns-3 md:gap-10 xl:gap-12';
    case 2:
      return 'md:columns-2 md:gap-10';
    default:
      return '';
  }
}

export const TextBlockServer: React.FC<TextBlockProps> = ({
  id,
  content,
  className,
  style,
  theme = 'auto',
  variant = 'default',
  analyticsId,
}) => {
  const {
    heading,
    headingLevel,
    subheading,
    body,
    alignment = 'left',
    columns = 1,
  } = content;

  const sanitizedBody = DOMPurify.sanitize(body, {
    ALLOWED_TAGS: [
      'h1',
      'h2',
      'h3',
      'h4',
      'h5',
      'h6',
      'p',
      'ul',
      'ol',
      'li',
      'a',
      'strong',
      'em',
      'br',
      'span',
      'blockquote',
    ],
    ALLOWED_ATTR: ['href', 'target', 'rel', 'class', 'id'],
  });

  const rawAlignment = ALIGNMENT_CLASS[alignment] ?? ALIGNMENT_CLASS.left;
  const cardAlignmentClass =
    alignment === 'justify' ? ALIGNMENT_CLASS.left : rawAlignment;
  const headingAlignmentClass =
    alignment === 'justify' ? ALIGNMENT_CLASS.left : rawAlignment;
  const bodyAlignment =
    alignment === 'justify' ? ALIGNMENT_CLASS.justify : cardAlignmentClass;
  const columnsClass = resolveColumnsClasses(columns);
  const cardTone = resolveCardTone(variant);
  const resolvedHeadingLevel = (headingLevel ?? 2) as CmsHeadingLevel;
  const HeadingTag = HEADING_TAG_MAP[resolvedHeadingLevel];
  const headingText = heading ? sanitizeText(heading) : null;
  const subheadingText = subheading ? sanitizeText(subheading) : null;

  return (
    <CmsSection
      id={id}
      size="md"
      theme={theme}
      variant={variant}
      className={cn('cms-text-block', className)}
      containerClassName={cn('flex w-full flex-col', dsSpacing.gap('xl'), cardAlignmentClass)}
      style={style}
      data-analytics-id={analyticsId}
      data-component-type="text-block"
      data-variant={variant}
    >
      <Card className={cn(CARD_TONES[cardTone], themeClass(theme), 'w-full')}>
      {(headingText || subheadingText) && (
        <CardHeader
          className={cn(
            'flex flex-col gap-2 p-[var(--component-padding)]',
            themeClass(theme),
            dsSpacing.gap('sm'),
            'pb-0',
            alignment === 'center' && 'items-center',
            alignment === 'right' && 'items-end text-right',
            alignment === 'justify' && 'items-stretch text-left',
          )}
        >
          {headingText ? (
            <HeadingTag
              className={cmsHeading(
                resolvedHeadingLevel,
                theme,
                headingAlignmentClass,
              )}
              data-testid="cms-text-block-heading"
            >
              {headingText}
            </HeadingTag>
          ) : null}
          {subheadingText ? (
            <p
              className={cmsBody(
                'md',
                theme,
                cn(
                  'max-w-3xl text-balance',
                  alignment === 'center' && 'mx-auto text-center',
                  alignment === 'right' && 'ml-auto text-right',
                  alignment === 'justify' && 'text-left',
                ),
              )}
              data-testid="cms-text-block-subheading"
            >
              {subheadingText}
            </p>
          ) : null}
        </CardHeader>
      )}

      <CardContent
        className={cn('p-[var(--component-padding)] pt-0', themeClass(theme), 'pt-0', alignment === 'center' && 'items-center')}
      >
        <SafeHtml html={sanitizedBody} className={cn(
            'cms-text-block-body',
            dsSpacing.spaceY('md'),
            cmsBody(
              'md',
              theme,
              cn(
                'max-w-none leading-relaxed text-balance',
                bodyAlignment,
                '[&_strong]:text-foreground',
                '[&_em]:text-muted-foreground',
                '[&_a]:text-primary [&_a]:underline [&_a]:transition-colors [&_a]:duration-200',
                '[&_a:hover]:text-primary/80 [&_a:hover]:underline-offset-4',
                '[&_ul]:list-disc [&_ol]:list-decimal [&_ul,_ol]:pl-5',
                '[&_li]:mb-2 [&_li:last-child]:mb-0',
                '[&_blockquote]:border-l-4 [&_blockquote]:border-primary/40 [&_blockquote]:bg-muted/30 [&_blockquote]:rounded-r-lg [&_blockquote]:shadow-sm [&_blockquote]:pl-4 [&_blockquote]:italic',
                columnsClass &&
                  cn(
                    columnsClass,
                    'md:[&>*]:break-inside-avoid md:space-y-0',
                  ),
              ),
            ),
          )} data-columns={columns}
          data-testid="cms-text-block-body" />
      </CardContent>
      </Card>
    </CmsSection>
  );
};
