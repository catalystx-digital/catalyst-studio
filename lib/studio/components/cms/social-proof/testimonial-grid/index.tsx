'use client';

import React from 'react';
import DOMPurify from 'isomorphic-dompurify';
import { cn } from '@/lib/utils';
import { BaseComponent } from '../../_core/base-component';
import { withPerformanceTracking } from '../../_core/monitoring';
import { ComponentType, ComponentCategory } from '../../_core/types';
import { SafeHtml } from '../../_core/safe-html';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import {
  CmsAlert,
  CmsAlertDescription,
  CmsSection,
  cmsBody,
  dsSpacing,
  CARD_TONES,
  shouldShowDevEmptyState,
} from '../../_ui';
import { resolveCmsIcon } from '../../_utils/icon-resolver';
import { validateImageUrl } from '../../_utils/url-validation';
import type {
  TestimonialGridProps,
  TestimonialGridContent,
  GridTestimonial,
} from './testimonial-grid.types';

const MAX_RATING = 5;
const ALLOWED_TAGS = ['b', 'i', 'em', 'strong', 'br'];

const MOBILE_COLUMN_CLASSES: Record<number, string> = {
  1: 'grid-cols-1',
  2: 'grid-cols-2',
  3: 'grid-cols-3',
  4: 'grid-cols-4',
};

const TABLET_COLUMN_CLASSES: Record<number, string> = {
  1: 'md:grid-cols-1',
  2: 'md:grid-cols-2',
  3: 'md:grid-cols-3',
  4: 'md:grid-cols-4',
};

const DESKTOP_COLUMN_CLASSES: Record<number, string> = {
  1: 'lg:grid-cols-1',
  2: 'lg:grid-cols-2',
  3: 'lg:grid-cols-3',
  4: 'lg:grid-cols-4',
};

function sanitizeQuote(quote: string): string {
  return DOMPurify.sanitize(quote, {
    ALLOWED_TAGS,
    ALLOWED_ATTR: [],
  });
}

function getInitials(name?: string): string {
  if (!name) {
    return '';
  }

  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);

  if (parts.length === 0) {
    return '';
  }

  return parts
    .map((part) => part.charAt(0).toUpperCase())
    .join('');
}

function clampColumns(value: number | undefined, fallback: number): number {
  if (!value || Number.isNaN(value)) {
    return fallback;
  }

  return Math.max(1, Math.min(4, Math.round(value)));
}

class TestimonialGridBase extends BaseComponent<TestimonialGridProps> {
  private buildGridClasses(columns?: TestimonialGridContent['columns']): string {
    const mobile = clampColumns(columns?.mobile, 1);
    const tablet = clampColumns(columns?.tablet, 2);
    const desktop = clampColumns(columns?.desktop, 3);

    return cn(
      'grid',
      dsSpacing.gap('lg'),
      `sm:${dsSpacing.gap('xl')}`,
      MOBILE_COLUMN_CLASSES[mobile],
      TABLET_COLUMN_CLASSES[tablet],
      DESKTOP_COLUMN_CLASSES[desktop],
    );
  }

  private renderRating(rating?: number): React.ReactNode {
    if (typeof rating !== 'number' || Number.isNaN(rating) || rating <= 0) {
      return null;
    }

    const normalized = Math.min(MAX_RATING, Math.max(0, Math.round(rating)));

    return (
      <div
        className={cn('flex items-center', dsSpacing.gap('xxs'))}
        aria-label={`${normalized} out of ${MAX_RATING} stars`}
        data-testid="testimonial-rating"
      >
        {Array.from({ length: MAX_RATING }).map((_, index) => {
          const star = resolveCmsIcon('Star', {
            className: 'h-4 w-4',
            fallback: '★',
          });
          const isActive = index < normalized;

          return (
            <span
              key={`star-${index}`}
              className={cn(
                'flex items-center',
                isActive ? 'text-primary' : 'text-border/50',
              )}
              aria-hidden="true"
            >
              {star}
            </span>
          );
        })}
      </div>
    );
  }

  private renderTestimonialCard(
    testimonial: GridTestimonial,
    showRating: boolean,
  ): React.ReactNode {
    const sanitizedQuote = sanitizeQuote(String(testimonial.quote ?? ''));
    const avatarUrl = validateImageUrl(testimonial.avatar);
    const initials = getInitials(testimonial.author);
    const roleAndCompany = [testimonial.role, testimonial.company]
      .filter(Boolean)
      .join(', ');

    return (
      <Card
        key={testimonial.id}
        className={cn(CARD_TONES.minimal, "h-full cms-card rounded-xl")}
        data-testid={`testimonial-card-${testimonial.id}`}
      >
        <CardContent
          className={cn('flex flex-col', dsSpacing.gap('md'), dsSpacing.py('lg'))}
        >
          {showRating ? this.renderRating(testimonial.rating) : null}
          <blockquote className="relative">
            <span className="absolute -left-2 -top-1 text-4xl font-serif text-primary/20 leading-none">"</span>
            <SafeHtml html={sanitizedQuote} className={cmsBody(
                'lg',
                this.props.theme,
                'text-muted-foreground leading-relaxed italic',
              )} />
          </blockquote>
        </CardContent>

        <CardFooter className={cn(dsSpacing.gap('sm'))}>
          <Avatar className="h-8 w-8 ring-1 ring-border">
            {avatarUrl ? (
              <AvatarImage
                src={avatarUrl}
                alt={`${testimonial.author} avatar`}
              />
            ) : null}
            <AvatarFallback>
              {initials || resolveCmsIcon('User', { fallback: '👤' })}
            </AvatarFallback>
          </Avatar>

          <cite
            className={cn(
              'flex flex-col not-italic',
              dsSpacing.gap('xxs'),
            )}
          >
            <span
              className={cmsBody(
                'sm',
                this.props.theme,
                'font-semibold text-foreground truncate max-w-[18rem]',
              )}
            >
              {testimonial.author}
            </span>
            {roleAndCompany ? (
              <span
                className={cmsBody(
                  'xs',
                  this.props.theme,
                  'truncate text-muted-foreground/80 max-w-[18rem]',
                )}
                aria-label={roleAndCompany}
              >
                {roleAndCompany}
              </span>
            ) : null}
          </cite>
        </CardFooter>
      </Card>
    );
  }

  protected renderComponent(): React.ReactNode {
    const content = (this.props.content ??
      {}) as Partial<TestimonialGridContent>;
    const testimonials = content.testimonials ?? [];

    // In production, return null when empty to avoid rendering empty sections
    // In development, the CmsAlert with devOnly will show a placeholder
    if (testimonials.length === 0 && !shouldShowDevEmptyState()) {
      return null;
    }

    const showRating = Boolean(content.showRating);

    return (
      <CmsSection
        id={this.props.id}
        theme={this.props.theme}
        variant={this.props.variant}
        className={this.getCombinedClassName('cms-testimonial-grid')}
        style={this.props.style}
        data-component-type={this.props.type}
        data-category={ComponentCategory.SocialProof}
        data-component-id={this.props.id}
        aria-label={
          this.props.aiMetadata?.accessibility?.ariaLabel ?? 'Testimonials'
        }
      >
        <div
          className={cn(
            'testimonial-grid__container w-full',
            this.buildGridClasses(content.columns),
          )}
          role="list"
          aria-label="Customer testimonials"
        >
          {testimonials.length === 0 ? (
            <CmsAlert
              variant="default"
              theme={this.props.theme}
              className="col-span-full"
              devOnly
            >
              <CmsAlertDescription>
                Testimonial content will appear here once configured.
              </CmsAlertDescription>
            </CmsAlert>
          ) : (
            testimonials.map((testimonial) => (
              <div key={testimonial.id} role="listitem" className="h-full">
                {this.renderTestimonialCard(testimonial, showRating)}
              </div>
            ))
          )}
        </div>
      </CmsSection>
    );
  }
}

const TestimonialGridMemo = React.memo(TestimonialGridBase);
export const TestimonialGrid = withPerformanceTracking(
  TestimonialGridMemo,
  ComponentType.Testimonials,
);
export default TestimonialGrid;
