import React from 'react';

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
import { sanitizeHtml, sanitizeText } from '../../_core/security';
import { validateImageUrl } from '../../_utils/url-validation';
import { QuoteBlockClient } from './quote-block.client';
import type {
  QuoteAttribution,
  QuoteBlockContent,
  QuoteBlockServerProps,
} from './quote-block.types';

const QUOTE_ALLOWED_TAGS = ['b', 'i', 'em', 'strong', 'br', 'span'];
const QUOTE_ALLOWED_ATTR: string[] = [];

function sanitizeQuote(quote: QuoteBlockContent['quote']): string {
  if (!quote) {
    return '';
  }

  return sanitizeHtml(quote, {
    ALLOWED_TAGS: QUOTE_ALLOWED_TAGS,
    ALLOWED_ATTR: QUOTE_ALLOWED_ATTR,
    ALLOW_DATA_ATTR: false,
  });
}

function sanitizeAttribution(
  attribution?: QuoteAttribution,
): QuoteAttribution | undefined {
  if (!attribution) {
    return undefined;
  }

  const sanitized: QuoteAttribution = {};

  if (attribution.author) {
    const author = sanitizeText(attribution.author);
    if (author) sanitized.author = author;
  }

  if (attribution.title) {
    const title = sanitizeText(attribution.title);
    if (title) sanitized.title = title;
  }

  if (attribution.organization) {
    const organization = sanitizeText(attribution.organization);
    if (organization) sanitized.organization = organization;
  }

  if (attribution.date) {
    const date = sanitizeText(attribution.date);
    if (date) sanitized.date = date;
  }

  if (attribution.image) {
    const image = validateImageUrl(attribution.image);
    if (image) sanitized.image = image;
  }

  return Object.keys(sanitized).length > 0 ? sanitized : undefined;
}

function normalizeContent(content: QuoteBlockContent): QuoteBlockContent {
  const sanitizedQuote = sanitizeQuote(content.quote);
  const sanitizedHeading = content.heading
    ? sanitizeText(content.heading)
    : undefined;
  const sanitizedSubheading = content.subheading
    ? sanitizeText(content.subheading)
    : undefined;
  const sanitizedAttribution = sanitizeAttribution(content.attribution);
  const sanitizedCustomIcon =
    content.customIcon && content.icon === 'custom'
      ? sanitizeText(content.customIcon)
      : undefined;

  return {
    ...content,
    heading: sanitizedHeading,
    subheading: sanitizedSubheading,
    quote: sanitizedQuote,
    attribution: sanitizedAttribution,
    highlight: Boolean(content.highlight),
    icon: content.icon ?? 'quotes',
    customIcon: sanitizedCustomIcon,
    style: content.style ?? 'default',
    align: content.align ?? 'left',
    size: content.size ?? 'medium',
  };
}

function getTone(style: QuoteBlockContent['style']): CmsCardTone {
  switch (style) {
    case 'highlighted':
      return 'accent';
    case 'testimonial':
      return 'default';
    default:
      return 'minimal';
  }
}

export function QuoteBlockServer({
  content,
  className,
  theme = 'auto',
  variant = 'default',
  onShare,
}: QuoteBlockServerProps) {
  const normalizedContent = normalizeContent(content);
  const hasHeader =
    Boolean(normalizedContent.heading) || Boolean(normalizedContent.subheading);

  return (
    <CmsSection
      size="md"
      theme={theme}
      variant={variant}
      className={cn('cms-quote-block', className)}
      containerClassName={cn('flex w-full flex-col', dsSpacing.gap('xl'))}
      data-component-type="quote-block"
      data-variant={variant}
    >
      <Card
        className={cn(CARD_TONES[getTone(normalizedContent.style)], themeClass(theme), 'w-full')}
      >
      {hasHeader ? (
        <CardHeader
          className={cn('flex flex-col gap-2 p-[var(--component-padding)]', themeClass(theme), dsSpacing.gap('sm'), 'pb-0')}
        >
          {normalizedContent.heading ? (
            <h2 className={cmsHeading(3, theme)}>
              {normalizedContent.heading}
            </h2>
          ) : null}
          {normalizedContent.subheading ? (
            <p className={cmsBody('sm', theme)}>
              {normalizedContent.subheading}
            </p>
          ) : null}
        </CardHeader>
      ) : null}

      <CardContent
        className={cn('p-[var(--component-padding)] pt-0', themeClass(theme), 'flex flex-col', dsSpacing.gap('lg'), 'pt-0')}
      >
        <QuoteBlockClient
          content={normalizedContent}
          className={cn('cms-quote-block-figure flex flex-col', dsSpacing.gap('md'))}
          theme={theme}
          variant={variant}
          animated
          onShare={onShare}
        />
      </CardContent>
      </Card>
    </CmsSection>
  );
}
