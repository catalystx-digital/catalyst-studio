'use client';

import React, { useMemo } from 'react';
import Image from 'next/image';
import { Linkedin, Twitter } from 'lucide-react';
import { cn } from '@/lib/utils';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { AspectRatio } from '@/components/ui/aspect-ratio';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  CmsAlert,
  CmsAlertDescription,
  CmsBadge,
  CmsSection,
  CARD_TONES,
  cmsBody,
  cmsHeading,
  dsSpacing,
  themeClass,
  shouldShowDevEmptyState,
} from '../../_ui';
import type { CmsCardTone } from '../../_ui';
import {
  sanitizeHtml,
  sanitizeText,
  validateUrl,
} from '../../_core/security';
import { withPerformanceTracking } from '../../_core/monitoring';
import { ComponentType } from '../../_core/types';
import { SafeHtml } from '../../_core/safe-html';
import type {
  TeamGridProps,
  TeamMemberData,
} from './team-grid.types';

interface NormalizedMember {
  id: string;
  name: string;
  title?: string;
  department?: string;
  bioHtml?: string;
  photo?: string;
  photoAlt: string;
  profileUrl?: string;
  socialLinks: Array<{
    platform: 'linkedin' | 'twitter';
    url: string;
  }>;
  initials: string;
}

type GridColumns = NonNullable<TeamGridProps['content']['columns']>;

const DEFAULT_COLUMNS: Required<GridColumns> = {
  mobile: 2,
  tablet: 3,
  desktop: 4,
  large: 4,
};

const PHOTO_RATIO = 4 / 5;

function resolveColumns(columns?: GridColumns): Required<GridColumns> {
  return {
    mobile: columns?.mobile ?? DEFAULT_COLUMNS.mobile,
    tablet: columns?.tablet ?? DEFAULT_COLUMNS.tablet,
    desktop: columns?.desktop ?? DEFAULT_COLUMNS.desktop,
    large: columns?.large ?? DEFAULT_COLUMNS.large,
  };
}

function buildColumnClasses(columns: Required<GridColumns>): string {
  const mobileClass = columns.mobile === 1 ? 'grid-cols-1' : 'grid-cols-2';
  const smClass = columns.mobile === 1 ? 'sm:grid-cols-1' : 'sm:grid-cols-2';

  const tabletClass =
    columns.tablet === 2 ? 'md:grid-cols-2' : 'md:grid-cols-3';

  let desktopClass = 'lg:grid-cols-4';
  if (columns.desktop === 3) desktopClass = 'lg:grid-cols-3';
  if (columns.desktop === 5) desktopClass = 'lg:grid-cols-5';

  let largeClass = 'xl:grid-cols-4';
  if (columns.large === 5) largeClass = 'xl:grid-cols-5';
  if (columns.large === 6) largeClass = 'xl:grid-cols-6';

  return cn(
    mobileClass,
    smClass,
    tabletClass,
    desktopClass,
    largeClass,
  );
}

function resolveCardTone(): CmsCardTone {
  return 'default';
}

function isValidProfileUrl(url?: string): boolean {
  if (!url || typeof url !== 'string') {
    return false;
  }

  const trimmed = url.trim();
  return trimmed.startsWith('/') || validateUrl(trimmed);
}

function normalizeMember(member: TeamMemberData): NormalizedMember | null {
  if (!member || typeof member !== 'object') {
    return null;
  }

  const name = sanitizeText(member.name);
  const title = member.title ? sanitizeText(member.title) : undefined;
  const department = member.department
    ? sanitizeText(member.department)
    : undefined;
  const bioHtml = member.bio
    ? sanitizeHtml(member.bio, {
        ALLOWED_TAGS: ['p', 'strong', 'em', 'a', 'ul', 'ol', 'li', 'br'],
        ALLOWED_ATTR: ['href', 'target', 'rel'],
      })
    : undefined;

  if (!member.id || name.length === 0) {
    return null;
  }

  const socialLinks: NormalizedMember['socialLinks'] = [];

  if (member.linkedin && validateUrl(member.linkedin)) {
    socialLinks.push({
      platform: 'linkedin',
      url: member.linkedin,
    });
  }

  if (member.twitter && validateUrl(member.twitter)) {
    socialLinks.push({
      platform: 'twitter',
      url: member.twitter,
    });
  }

  const photo =
    typeof member.photo === 'string' && member.photo.trim().length > 0
      ? member.photo.trim()
      : undefined;

  const photoAlt = sanitizeText(
    member.photoAlt ??
      (name && title ? `${name} – ${title}` : name || 'Team member photo'),
  );

  const profileUrl = isValidProfileUrl(member.profileUrl)
    ? member.profileUrl!.trim()
    : undefined;

  return {
    id: member.id,
    name,
    title,
    department,
    bioHtml,
    photo,
    photoAlt,
    profileUrl,
    socialLinks,
    initials: name
      .split(/\s+/)
      .filter(Boolean)
      .map((segment) => segment[0])
      .join('')
      .slice(0, 2)
      .toUpperCase(),
  };
}

function renderSocialButtons(
  member: NormalizedMember,
  theme: TeamGridProps['theme'],
  onInteraction?: TeamGridProps['onInteraction'],
) {
  if (member.socialLinks.length === 0) {
    return null;
  }

  const iconMap = {
    linkedin: Linkedin,
    twitter: Twitter,
  } as const;

  return (
    <div
      className={cn(
        'flex flex-wrap',
        dsSpacing.gap('xs'),
        dsSpacing.pt('sm'),
      )}
      aria-label="Social links"
    >
      {member.socialLinks.map((link) => {
        const Icon = iconMap[link.platform];

        return (
          <Button
            key={`${member.id}-${link.platform}`}
            asChild
            variant="ghost"
            size="icon"
            aria-label={`${member.name} on ${link.platform}`}
            className={cn('transition-shadow hover:bg-primary/10', themeClass(theme))}
            onClick={(event: React.MouseEvent<HTMLButtonElement>) => {
              event.stopPropagation();
              onInteraction?.('social-link-click', {
                memberId: member.id,
                platform: link.platform,
              });
            }}
          >
            <a href={link.url} target="_blank" rel="noopener noreferrer">
              <Icon className="h-4 w-4" aria-hidden="true" />
            </a>
          </Button>
        );
      })}
    </div>
  );
}

function TeamGridBase({
  id,
  content,
  className,
  style,
  theme = 'auto',
  loading = 'eager',
  onLoad,
  onError,
  onInteraction,
}: TeamGridProps) {
  React.useEffect(() => {
    try {
      onLoad?.();
    } catch (error) {
      onError?.(error as Error);
    }
  }, [onLoad, onError]);

  const columns = useMemo(
    () => resolveColumns(content.columns),
    [content.columns],
  );

  const members = useMemo(() => {
    const sourceMembers =
      content.members ??
      content.manualMembers ??
      [];

    return sourceMembers
      .map(normalizeMember)
      .filter((member): member is NormalizedMember => member !== null);
  }, [content.members, content.manualMembers]);

  // In production, return null when empty to avoid rendering empty sections
  // In development, the CmsAlert with devOnly will show a placeholder
  if (members.length === 0 && !shouldShowDevEmptyState()) {
    return null;
  }

  const handleMemberClick = (member: NormalizedMember) => {
    onInteraction?.('member-click', {
      memberId: member.id,
      memberName: member.name,
    });
  };

  return (
    <CmsSection
      id={id}
      size="md"
      theme={theme}
      className={cn('cms-team-grid', className)}
      style={style}
      aria-label="Team members grid"
      role="region"
      data-component-type="team-grid"
      containerClassName={cn(dsSpacing.gap('xl'))}
    >
      {(content.heading || content.subheading) && (
        <div
          className={cn(
            'mx-auto flex max-w-3xl flex-col items-center text-center',
            dsSpacing.gap('xs'),
          )}
        >
          {content.heading ? (
            <h2 className={cmsHeading(2, theme, 'text-balance')}>
              {sanitizeText(content.heading)}
            </h2>
          ) : null}

          {content.subheading ? (
            <p className={cmsBody('lg', theme, 'text-muted-foreground')}>
              {sanitizeText(content.subheading)}
            </p>
          ) : null}
        </div>
      )}

      <div
        className={cn(
          'grid w-full',
          dsSpacing.gap('xl'),
          buildColumnClasses(columns),
        )}
      >
        {members.length === 0 ? (
          <CmsAlert
            variant="default"
            theme={theme}
            className="col-span-full"
            devOnly
          >
            <CmsAlertDescription>
              Team member content will appear here once configured.
            </CmsAlertDescription>
          </CmsAlert>
        ) : members.map((member) => {
          const card = (
            <Card
              key={member.id}
              className={cn(
                CARD_TONES[resolveCardTone()],
                themeClass(theme),
                'group flex h-full flex-col overflow-hidden text-left transition-shadow ease-out',
                content.enableHover && 'hover:border-primary/20',
              )}
              tabIndex={content.linkToProfile ? -1 : 0}
              role={content.linkToProfile ? 'presentation' : 'button'}
              onClick={
                content.linkToProfile
                  ? undefined
                  : () => handleMemberClick(member)
              }
              onKeyDown={
                content.linkToProfile
                  ? undefined
                  : (event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        handleMemberClick(member);
                      }
                    }
              }
            >
              <AspectRatio
                ratio={PHOTO_RATIO}
                className="overflow-hidden bg-muted/60"
              >
                {member.photo ? (
                  <Image
                    src={member.photo}
                    alt={member.photoAlt}
                    fill
                    className="h-full w-full object-cover transition-shadow"
                    loading={loading}
                    sizes="(max-width: 640px) 50vw, (max-width: 1024px) 25vw, 280px"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-muted transition-colors duration-300 group-hover:bg-muted/80">
                    <Avatar
                      className={cn('h-20 w-20 transition-shadow', themeClass(theme))}
                    >
                      <AvatarFallback
                        className={themeClass(theme)}
                      >
                        {member.initials || member.name.slice(0, 1)}
                      </AvatarFallback>
                    </Avatar>
                  </div>
                )}
              </AspectRatio>

              <CardContent
                className={cn(
                  'p-[var(--component-padding)] pt-0',
                  themeClass(theme),
                  'flex flex-1 flex-col',
                  dsSpacing.gap('sm'),
                )}
              >
                <div
                  className={cn(
                    'flex flex-col',
                    dsSpacing.gap('xs'),
                  )}
                >
                  <h3 className={cmsHeading(4, theme)}>{member.name}</h3>
                  {member.title ? (
                    <p className={cmsBody('sm', theme, 'text-muted-foreground')}>
                      {member.title}
                    </p>
                  ) : null}
                  {content.showDepartment && member.department ? (
                    <CmsBadge
                      variant="neutral"
                      theme={theme}
                      className="w-fit uppercase tracking-wide"
                    >
                      {member.department}
                    </CmsBadge>
                  ) : null}
                </div>

                {member.bioHtml ? (
                  <SafeHtml
                    html={member.bioHtml}
                    className={cmsBody(
                      'sm',
                      theme,
                      cn(
                        'cms-team-grid__bio text-muted-foreground [&_a]:text-primary [&_a]:underline [&_a:hover]:text-primary/80',
                        dsSpacing.mt('xxs'),
                        dsSpacing.spaceY('xs'),
                      ),
                    )}
                  />
                ) : null}

                {renderSocialButtons(member, theme, onInteraction)}
              </CardContent>
            </Card>
          );

          if (content.linkToProfile && member.profileUrl) {
            return (
              <a
                key={member.id}
                href={member.profileUrl}
                className="block focus:outline-none"
                aria-label={`View ${member.name}'s profile`}
                onClick={() => handleMemberClick(member)}
              >
                {card}
              </a>
            );
          }

          return card;
        })}
      </div>
    </CmsSection>
  );
}

const TeamGrid = withPerformanceTracking(TeamGridBase, ComponentType.TeamGrid);

export default TeamGrid;
