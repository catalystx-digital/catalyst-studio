/**
 * AuthorBio Component
 * Story 10.12: Blog Components
 *
 * Author information box with photo, bio, social links,
 * and optional expandable content.
 */

'use client';

import React, { useCallback, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  CmsBadge,
  CmsSection,
  CARD_TONES,
  cmsBody,
  cmsHeading,
  dsSpacing,
  themeClass,
} from '../../_ui';
import type { CmsCardTone } from '../../_ui';
import { ComponentCategory, ComponentType } from '../../_core/types';
import { withPerformanceTracking } from '../../_core/monitoring';
import { sanitizeHtml, sanitizeText, validateUrl as coreValidateUrl } from '../../_core/security';
import { SafeHtml } from '../../_core/safe-html';
import { resolveCmsIcon } from '../../_utils/icon-resolver';
import { validateImageUrl } from '../../_utils/url-validation';
import type { AuthorBioProps } from './author-bio.types';

type StatKey = 'articlesCount' | 'followersCount' | 'yearsExperience';

type LayoutVariant = NonNullable<AuthorBioProps['layout']>;

type BioContent =
  | { type: 'html'; value: string; isTruncated: boolean }
  | { type: 'text'; value: string; isTruncated: boolean };

const LAYOUT_CLASS_MAP: Record<LayoutVariant, string> = {
  horizontal: cn(
    'flex flex-col md:flex-row md:items-start',
    dsSpacing.gap('lg'),
    `md:${dsSpacing.gap('xl')}`,
  ),
  vertical: cn(
    'flex flex-col items-center text-center',
    dsSpacing.gap('lg'),
  ),
  compact: cn('flex items-start', dsSpacing.gap('md')),
};

const SOCIAL_ICON_MAP: Record<string, string> = {
  email: 'Mail',
  website: 'Globe',
  twitter: 'Twitter',
  linkedin: 'Linkedin',
  github: 'Github',
  facebook: 'Facebook',
  instagram: 'Instagram',
  youtube: 'Youtube',
};

function formatFollowers(value?: number): string {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return '0';
  }
  if (value >= 1000) {
    return `${(value / 1000).toFixed(value % 1000 === 0 ? 0 : 1)}k`;
  }
  return String(value);
}

function buildBioContent(
  bio: string | undefined,
  expandable: boolean,
  maxBioLength: number,
  isExpanded: boolean,
): BioContent {
  const sanitizedHtml = sanitizeHtml(bio ?? '');
  const plainText = sanitizeText(bio ?? '');

  if (!expandable || plainText.length <= maxBioLength) {
    return { type: 'html', value: sanitizedHtml, isTruncated: false };
  }

  if (isExpanded) {
    return { type: 'html', value: sanitizedHtml, isTruncated: true };
  }

  const truncated = `${plainText.substring(0, maxBioLength).trim()}...`;
  return { type: 'text', value: truncated, isTruncated: true };
}

function getAvatarSize(layout: LayoutVariant): 'sm' | 'md' | 'lg' {
  if (layout === 'compact') {
    return 'md';
  }
  return 'lg';
}

function getAvatarClassName(layout: LayoutVariant): string {
  if (layout === 'compact') {
    return 'h-16 w-16';
  }
  if (layout === 'vertical') {
    return 'h-28 w-28 md:h-32 md:w-32';
  }
  return 'h-24 w-24 md:h-28 md:w-28';
}

const AuthorBio: React.FC<AuthorBioProps> = ({
  id,
  type = ComponentType.AuthorBio,
  category = ComponentCategory.Blog,
  content,
  className,
  theme = 'auto',
  variant = 'default',
  onFollowClick,
  onSocialClick,
  showStats = true,
  showExpertise = true,
  layout = 'horizontal',
}) => {
  const {
    name,
    title,
    bio,
    photo,
    email,
    website,
    socialLinks = {},
    stats = {},
    expertise = [],
    expandable = false,
    maxBioLength = 200,
  } = content;

  const [isExpanded, setIsExpanded] = useState(false);

  const sanitizedName = useMemo(() => sanitizeText(name ?? ''), [name]);
  const sanitizedTitle = useMemo(() => sanitizeText(title ?? ''), [title]);
  const fallbackInitial = useMemo(
    () => (sanitizedName ? sanitizedName.charAt(0).toUpperCase() : 'A'),
    [sanitizedName],
  );

  const bioContent = useMemo(
    () => buildBioContent(bio, expandable, maxBioLength, isExpanded),
    [bio, expandable, maxBioLength, isExpanded],
  );

  const shouldShowExpand = expandable && sanitizeText(bio ?? '').length > maxBioLength;

  const statEntries = useMemo(() => {
    const definitions: Array<{ key: StatKey; label: string; formatter?: (value?: number) => string }> = [
      { key: 'articlesCount', label: 'Articles' },
      { key: 'followersCount', label: 'Followers', formatter: formatFollowers },
      { key: 'yearsExperience', label: 'Years Exp.' },
    ];

    return definitions
      .map((definition) => {
        const value = stats?.[definition.key];
        if (typeof value !== 'number') {
          return null;
        }
        return {
          key: definition.key,
          label: definition.label,
          value: definition.formatter ? definition.formatter(value) : String(value),
        };
      })
      .filter((entry): entry is { key: StatKey; label: string; value: string } => Boolean(entry));
  }, [stats]);

  const expertiseItems = useMemo(
    () => (Array.isArray(expertise) ? expertise.map((item, index) => ({ key: `${item}-${index}`, label: sanitizeText(item) })).filter((entry) => Boolean(entry.label)) : []),
    [expertise],
  );

  const avatarSize = getAvatarSize(layout);
  const avatarClassName = getAvatarClassName(layout);
  const avatarImage = useMemo(() => validateImageUrl(photo), [photo]);

  const handleSocialClick = useCallback(
    (platform: string, url: string) => {
      if (platform !== 'email' && !coreValidateUrl(url)) {
        if (process.env.NODE_ENV === 'development') {
        console.warn(`Invalid URL for ${platform}: ${url}`);
        }
        return;
      }

      onSocialClick?.(platform, url);

      if (typeof window === 'undefined' || typeof window.open !== 'function') {
        return;
      }

      window.open(url, '_blank', 'noopener,noreferrer');
    },
    [onSocialClick],
  );

  const handleEmailClick = useCallback(() => {
    if (!email) return;
    const mailto = `mailto:${email}`;
    onSocialClick?.('email', mailto);

    if (typeof window === 'undefined' || typeof window.open !== 'function') {
      return;
    }

    window.open(mailto, '_blank', 'noopener,noreferrer');
  }, [email, onSocialClick]);

  const renderBio = () => {
    if (bioContent.type === 'html') {
      return (
        <SafeHtml
          html={bioContent.value}
          className={cmsBody('md', theme, 'text-muted-foreground')}
        />
      );
    }

    return <p className={cmsBody('md', theme, 'text-muted-foreground')}>{bioContent.value}</p>;
  };

  const sectionClassName = cn('cms-author-bio', className);

  return (
    <CmsSection
      id={id}
      size="md"
      theme={theme}
      variant={variant}
      className={sectionClassName}
      containerClassName={dsSpacing.gap('lg')}
      role="complementary"
      aria-label="Author information"
      data-layout={layout}
      data-component-type={type}
      data-component-category={category}
    >
      <Card
        className={cn(CARD_TONES['minimal' as CmsCardTone], themeClass(theme), 'shadow-sm')}
      >
      <CardHeader className={cn('flex flex-col gap-2 p-[var(--component-padding)]', 'pb-0')}>
        <CardTitle className={cn('text-2xl', layout === 'vertical' ? 'mx-auto' : undefined)}>
          {sanitizedName || 'Author'}
        </CardTitle>
        {sanitizedTitle && (
          <p className={cmsBody('sm', theme, layout === 'vertical' ? 'mx-auto text-muted-foreground' : 'text-muted-foreground')}>
            {sanitizedTitle}
          </p>
        )}
      </CardHeader>

      <CardContent className={cn('p-[var(--component-padding)]', 'flex flex-col', dsSpacing.gap('lg'), dsSpacing.pt('lg'))}>
        <div className={LAYOUT_CLASS_MAP[layout]}>
          <Avatar
            className={cn(
              avatarClassName,
              layout === 'compact' ? 'flex-shrink-0' : '',
              'shadow-md transition-shadow hover:shadow-lg ring-2 ring-background ring-offset-2 ring-offset-background'
            )}
          >
            {avatarImage ? (
              <AvatarImage src={avatarImage} alt={sanitizedName || 'Author portrait'} />
            ) : (
              <AvatarFallback>{fallbackInitial}</AvatarFallback>
            )}
          </Avatar>

          <div
            className={cn(
              'flex flex-1 flex-col',
              dsSpacing.gap('lg'),
              layout === 'vertical' ? 'items-center text-center' : '',
            )}
          >
            <div className={cn('max-w-prose', dsSpacing.spaceY('sm'))}>
              {renderBio()}
              {shouldShowExpand && (
                <Button
                  type="button"
                  variant="link"
                  className="p-0 text-primary"
                  aria-expanded={isExpanded}
                  onClick={() => setIsExpanded((previous) => !previous)}
                >
                  {isExpanded ? 'Show less' : 'Read more'}
                </Button>
              )}
            </div>

            {showExpertise && expertiseItems.length > 0 && (
              <div className={cn('flex flex-wrap', dsSpacing.gap('sm'))}>
                {expertiseItems.map((item) => (
                  <CmsBadge key={item.key} variant="neutral" theme={theme} className="text-xs transition-shadow  hover:bg-primary/10">
                    {item.label}
                  </CmsBadge>
                ))}
              </div>
            )}

            {showStats && statEntries.length > 0 && (
              <div
                className={cn(
                  'flex text-center text-sm text-muted-foreground',
                  dsSpacing.gap('lg'),
                  layout === 'vertical' ? 'justify-center' : '',
                )}
              >
                {statEntries.map((stat) => (
                  <div key={stat.key} className="group flex flex-col transition-shadow ">
                    <span className={cmsBody('md', theme, 'font-semibold text-foreground transition-colors duration-200 group-hover:text-primary')}>
                      {stat.value}
                    </span>
                    <span className={cmsBody('sm', theme, 'text-muted-foreground')}>{stat.label}</span>
                  </div>
                ))}
              </div>
            )}

            <div
              className={cn(
                'flex flex-wrap items-center',
                dsSpacing.gap('sm'),
                layout === 'vertical' ? 'justify-center' : '',
              )}
            >
              {onFollowClick && (
                <Button
                  type="button"
                  variant="default"
                  onClick={onFollowClick}
                  className="transition-shadow  hover:shadow-md"
                >
                  Follow
                </Button>
              )}

              <div className={cn('flex items-center', dsSpacing.gap('xs'))}>
                {email && (
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    aria-label="Email author"
                    onClick={handleEmailClick}
                    className="transition-shadow  hover:bg-primary/10"
                  >
                    {resolveCmsIcon(SOCIAL_ICON_MAP.email, { className: 'h-4 w-4', fallback: '@' })}
                  </Button>
                )}

                {website && (
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    aria-label="Visit website"
                    onClick={() => handleSocialClick('website', website)}
                    className="transition-shadow  hover:bg-primary/10"
                  >
                    {resolveCmsIcon(SOCIAL_ICON_MAP.website, { className: 'h-4 w-4', fallback: '∞' })}
                  </Button>
                )}

                {Object.entries(socialLinks).map(([platform, url]) => {
                  if (!url) {
                    return null;
                  }

                  if (!coreValidateUrl(url)) {
                    return null;
                  }

                  const iconName = SOCIAL_ICON_MAP[platform] ?? platform;

                  return (
                    <Button
                      key={platform}
                      type="button"
                      size="icon"
                      variant="ghost"
                      aria-label={`Follow on ${platform}`}
                      onClick={() => handleSocialClick(platform, url)}
                      className="transition-shadow  hover:bg-primary/10"
                    >
                      {resolveCmsIcon(iconName, { className: 'h-4 w-4', fallback: platform.slice(0, 1).toUpperCase() })}
                    </Button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </CardContent>
      </Card>
    </CmsSection>
  );
};

const AuthorBioWithPerformance = withPerformanceTracking(AuthorBio, ComponentType.AuthorBio);
export default AuthorBioWithPerformance;
