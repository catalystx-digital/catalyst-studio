import React from 'react';

import { cn } from '@/lib/utils';

import { CmsSection, cmsBody, cmsHeading, dsSpacing } from '../../_ui';
import { AccordionClient } from './accordion.client';
import { AccordionProps } from './accordion.types';
import { ComponentCategory } from '../../_core/types';
import { sanitizeText } from '../../_core/security';
import { SafeHtml } from '../../_core/safe-html';

function normalizeItems(content: AccordionProps['content']) {
  const areaItems = Array.isArray(content.areas?.items) ? content.areas.items : undefined;

  if (areaItems && areaItems.length > 0) {
    return areaItems.map((child) => ({
      id: child.id,
      title: child.content?.title ?? child.content?.heading ?? '',
      content: child.content?.content ?? child.content?.body ?? '',
      icon: child.content?.icon,
      defaultOpen: Boolean(child.content?.defaultOpen),
    }));
  }

  return Array.isArray(content.items) ? content.items : [];
}

export function AccordionServer({
  id,
  type,
  category,
  content,
  className,
  style,
  theme = 'auto',
  variant = 'default',
  analytics,
  animated = true,
  onItemToggle,
  onAllToggle,
}: AccordionProps) {
  const sourceItems = normalizeItems(content);

  const preparedContent = {
    ...content,
    items: sourceItems.map((item) => ({
      ...item,
      id: item.id || `accordion-item-${Math.random().toString(36).slice(2, 11)}`,
      defaultOpen:
        Boolean(item.defaultOpen) ||
        (Array.isArray(content.defaultOpenItems) && item.id
          ? content.defaultOpenItems.includes(item.id)
          : false),
    })),
  };

  const analyticsId =
    typeof analytics?.trackingId === 'string' && analytics.trackingId.length > 0
      ? analytics.trackingId
      : undefined;
  const headingText =
    typeof content.heading === 'string' ? sanitizeText(content.heading) : '';
  const isPricingFaq =
    category === ComponentCategory.Pricing ||
    /faq/i.test(headingText);

  const faqEntities = isPricingFaq
    ? preparedContent.items.reduce<
        Array<{ question: string; answer: string }>
      >((acc, item) => {
        const question =
          typeof item.title === 'string'
            ? sanitizeText(item.title)
            : undefined;
        const answer =
          typeof item.content === 'string'
            ? sanitizeText(item.content)
            : undefined;

        if (question && answer) {
          acc.push({ question, answer });
        }

        return acc;
      }, [])
    : [];

  const faqSchemaJson =
    faqEntities.length > 0
      ? JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'FAQPage',
          mainEntity: faqEntities.map(({ question, answer }) => ({
            '@type': 'Question',
            name: question,
            acceptedAnswer: {
              '@type': 'Answer',
              text: answer,
            },
          })),
        })
      : null;

  return (
    <CmsSection
      id={id}
      size="md"
      theme={theme}
      variant={variant}
      style={style}
      className="cms-accordion-section"
      containerClassName={cn('cms-accordion-wrapper', dsSpacing.gap('lg'))}
      data-component-id={id}
      data-component-type={type ?? 'accordion'}
      data-variant={variant}
      data-analytics-id={analyticsId}
    >
      {faqSchemaJson ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: faqSchemaJson }}
          suppressHydrationWarning
        />
      ) : null}
      {(content.heading || content.subheading) && (
        <header className={cn('flex flex-col', dsSpacing.gap('sm'))}>
          {content.heading && <h2 className={cmsHeading(2, theme)}>{content.heading}</h2>}
          {content.subheading && <p className={cmsBody('md', theme)}>{content.subheading}</p>}
        </header>
      )}

      <AccordionClient
        id={id}
        type={type}
        category={category}
        content={preparedContent}
        className={className}
        theme={theme}
        variant={variant}
        animated={animated}
        onItemToggle={onItemToggle}
        onAllToggle={onAllToggle}
      />
    </CmsSection>
  );
}
