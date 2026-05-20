'use client';

import React from 'react';
import DOMPurify from 'isomorphic-dompurify';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import {
  CmsBadge,
  CARD_TONES,
  cmsBody,
  dsSpacing,
  themeClass,
} from '../../_ui';
import type { CmsCardTone } from '../../_ui';
import { withPerformanceTracking } from '../../_core/monitoring';
import { ComponentType, ComponentCategory } from '../../_core/types';
import { SafeHtml } from '../../_core/safe-html';
import { resolveCmsIcon } from '../../_utils/icon-resolver';
import { validateImageUrl } from '../../_utils/url-validation';
import type { ReviewCardProps } from './review-card.types';

const MAX_REVIEW_LENGTH = 220;
const RATING_PRECISION = 0.1;
const STAR_COUNT = 5;

const PLATFORM_BADGE_CLASSES: Record<string, string> = {
  google: 'border-transparent bg-red-500 text-primary-foreground',
  trustpilot: 'border-transparent bg-green-500 text-primary-foreground',
  yelp: 'border-transparent bg-red-500 text-primary-foreground',
  facebook: 'border-transparent bg-blue-500 text-primary-foreground',
  custom: 'border-border/50 bg-muted text-foreground',
};

function clampRating(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.min(STAR_COUNT, Math.max(0, Number(value)));
}

function formatDate(value: Date | string): string {
  const reviewDate = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(reviewDate.getTime())) {
    return '';
  }

  const now = new Date();
  const diffInMs = now.getTime() - reviewDate.getTime();
  const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));

  if (diffInDays <= 0) {
    return 'Today';
  }
  if (diffInDays === 1) {
    return 'Yesterday';
  }
  if (diffInDays < 7) {
    return `${diffInDays} days ago`;
  }

  return reviewDate.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function sanitizePlainText(value: string): string {
  return DOMPurify.sanitize(value, {
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: [],
  });
}

function sanitizeRichText(value: string): string {
  return DOMPurify.sanitize(value ?? '', {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'br'],
    ALLOWED_ATTR: [],
  });
}

function getPlatformBadgeClass(platform?: string): string {
  if (!platform) {
    return PLATFORM_BADGE_CLASSES.custom;
  }
  return PLATFORM_BADGE_CLASSES[platform] ?? PLATFORM_BADGE_CLASSES.custom;
}

function RatingStars({ rating }: { rating: number }) {
  const normalized = clampRating(rating);

  return (
    <div
      className={cn(
        'flex items-center transition-shadow ',
        dsSpacing.gap('xxs')
      )}
      aria-hidden="true"
      data-testid="review-rating-stars"
    >
      {Array.from({ length: STAR_COUNT }).map((_, index) => {
        const position = index + 1;
        const iconClassName =
          position <= normalized
            ? 'h-4 w-4 text-primary drop-shadow-sm'
            : position - 0.5 <= normalized
              ? 'h-4 w-4 text-primary drop-shadow-sm'
              : 'h-4 w-4 text-border/60';

        const icon =
          position - 0.5 <= normalized && position > normalized
            ? resolveCmsIcon('StarHalf', { className: iconClassName, fallback: '★' })
            : resolveCmsIcon('Star', { className: iconClassName, fallback: '★' });

        return (
          <span
            key={`star-${index}`}
            className="flex items-center"
            data-testid="review-rating-star"
          >
            {icon}
          </span>
        );
      })}
    </div>
  );
}

function PlatformIndicator({
  platform,
  platformName,
  platformLogo,
  theme,
}: {
  platform?: string;
  platformName?: string;
  platformLogo?: string;
  theme?: ReviewCardProps['theme'];
}) {
  const sanitizedName = sanitizePlainText(platformName || platform || 'Review platform');
  const logoUrl = validateImageUrl(platformLogo, '');

  if (!sanitizedName && !logoUrl) {
    return null;
  }

  if (logoUrl) {
    return (
      <span className={cn('inline-flex items-center', dsSpacing.gap('sm'))}>
        <img
          src={logoUrl}
          alt={sanitizedName}
          className="h-6 w-6 rounded-sm object-contain transition-shadow "
          loading="lazy"
        />
        <CmsBadge variant="outline" theme={theme} className="normal-case">
          {sanitizedName}
        </CmsBadge>
      </span>
    );
  }

  return (
    <CmsBadge
      variant="outline"
      theme={theme}
      className={cn(
        'normal-case',
        dsSpacing.py('xxs'),
        dsSpacing.px('xs'),
        getPlatformBadgeClass(platform),
      )}
    >
      <span>{sanitizedName}</span>
    </CmsBadge>
  );
}

export const ReviewCard: React.FC<ReviewCardProps> = ({
  id,
  content,
  className,
  theme,
  variant,
  onInteraction,
}) => {
  const {
    rating,
    reviewText,
    author,
    date,
    verified = false,
    platform,
    platformName,
    platformLogo,
    helpful,
  } = content;

  const [expanded, setExpanded] = React.useState(false);

  const sanitizedReview = React.useMemo(
    () => sanitizeRichText(reviewText),
    [reviewText],
  );
  const shouldTruncate = sanitizedReview.length > MAX_REVIEW_LENGTH;
  const displayReview =
    expanded || !shouldTruncate
      ? sanitizedReview
      : `${sanitizedReview.slice(0, MAX_REVIEW_LENGTH)}…`;

  const ratingValue = clampRating(typeof rating === 'number' ? rating : rating.value);
  const ratingLabel = `${ratingValue.toFixed(1)} out of ${STAR_COUNT} stars`;
  const sanitizedAuthor = sanitizePlainText(author);
  const formattedDate = formatDate(date);

  const handleToggleExpanded = () => {
    setExpanded((prev) => !prev);
  };

  const handleHelpfulClick = (vote: 'yes' | 'no') => {
    onInteraction?.('helpful-click', {
      vote,
      reviewId: id,
    });
  };

  const card = (
    <Card
      id={id}
      data-testid="review-card"
      data-component-type={ComponentType.Reviews}
      data-category={ComponentCategory.SocialProof}
      className={cn(CARD_TONES['minimal'], themeClass(theme), 'cms-review-card max-w-sm')}
    >
        <CardContent
          className={cn('flex flex-col gap-2 p-[var(--component-padding)]', dsSpacing.gap('sm'), dsSpacing.pb('sm'))}
        >
          <header
            className={cn('flex items-start justify-between', dsSpacing.gap('sm'))}
          >
            <div className={cn('flex flex-col', dsSpacing.gap('xs'))}>
              <div
                className={cn('flex flex-wrap items-center', dsSpacing.gap('xs'))}
                aria-label={ratingLabel}
              >
              <Tooltip>
                <TooltipTrigger asChild>
                  <CmsBadge
                    variant="accent"
                    className={cn('flex items-center text-sm', dsSpacing.gap('xs'))}
                  >
                    {resolveCmsIcon('Star', {
                      className: 'h-3.5 w-3.5',
                      fallback: '★',
                    })}
                    {ratingValue.toFixed(1)}
                  </CmsBadge>
                </TooltipTrigger>
                <TooltipContent>{ratingLabel}</TooltipContent>
              </Tooltip>
              <RatingStars rating={ratingValue} />
            </div>
            {verified && (
              <CmsBadge
                theme={theme}
                variant="positive"
                aria-label="Verified purchase"
                className="w-fit normal-case"
              >
                {resolveCmsIcon('ShieldCheck', {
                  className: cn(dsSpacing.mr('xs'), 'h-3.5 w-3.5'),
                  fallback: '✔',
                })}
                Verified
              </CmsBadge>
            )}
          </div>
          {(platform || platformLogo || platformName) && (
            <PlatformIndicator
              platform={platform}
              platformName={platformName}
              platformLogo={platformLogo}
              theme={theme}
            />
          )}
        </header>

        <blockquote
          className={cn(
            cmsBody('sm', theme, 'text-muted-foreground leading-relaxed'),
            'relative pl-4 border-l-2 border-primary/40 bg-primary/5 rounded-r-lg'
          )}
        >
          <SafeHtml html={displayReview} />
        </blockquote>

        {shouldTruncate ? (
          <Button
            variant="link"
            size="sm"
            onClick={handleToggleExpanded}
            className="self-start font-medium"
          >
            {expanded ? 'Show less' : 'Read more'}
          </Button>
        ) : null}

          <div className={cn('flex items-center justify-between', dsSpacing.gap('xs'))}>
          <span
            className={cmsBody('sm', theme, 'font-semibold text-foreground')}
            data-testid="review-author"
          >
            {sanitizedAuthor}
          </span>
          {formattedDate ? (
            <time
              className={cmsBody('xs', theme, 'text-muted-foreground')}
              dateTime={
                date instanceof Date
                  ? date.toISOString()
                  : sanitizePlainText(String(date ?? ''))
              }
            >
              {formattedDate}
            </time>
          ) : null}
        </div>
      </CardContent>

      {helpful ? (
        <CardFooter
          className={cn(
            'flex flex-col border-t border-border/40',
            dsSpacing.gap('xs'),
            dsSpacing.pt('sm'),
          )}
        >
          <span className={cmsBody('xs', theme, 'text-muted-foreground')}>
            Was this helpful?
          </span>
          <div className={cn('flex items-center', dsSpacing.gap('xs'))}>
            <Button
              variant="secondary"
              size="sm"
              className={cn('flex items-center', dsSpacing.gap('xs'))}
              onClick={() => handleHelpfulClick('yes')}
            >
              {resolveCmsIcon('ThumbsUp', {
                className: 'h-4 w-4',
                fallback: '👍',
              })}
              <span>{helpful.yes}</span>
              <span className="sr-only">people found this helpful</span>
            </Button>
            <Button
              variant="secondary"
              size="sm"
              className={cn('flex items-center', dsSpacing.gap('xs'))}
              onClick={() => handleHelpfulClick('no')}
            >
              {resolveCmsIcon('ThumbsDown', {
                className: 'h-4 w-4',
                fallback: '👎',
              })}
              <span>{helpful.no}</span>
              <span className="sr-only">people did not find this helpful</span>
            </Button>
          </div>
        </CardFooter>
      ) : null}
    </Card>
  );

  return (
    <TooltipProvider delayDuration={150}>
      {card}
    </TooltipProvider>
  );
};

const MemoizedReviewCard = React.memo(ReviewCard);

const ReviewCardWithPerformance = withPerformanceTracking(
  MemoizedReviewCard,
  ComponentType.Reviews,
);

export default ReviewCardWithPerformance;
