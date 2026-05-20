'use client';

import React from 'react';
import Image from 'next/image';
import {
  Facebook,
  Github,
  Instagram,
  Linkedin,
  Mail,
  Phone,
  Twitter,
} from 'lucide-react';
import { cn } from '@/lib/utils';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { AspectRatio } from '@/components/ui/aspect-ratio';
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
import {
  sanitizeHtml,
  sanitizeText,
  validateUrl,
} from '../../_core/security';
import { withPerformanceTracking } from '../../_core/monitoring';
import { ComponentType } from '../../_core/types';
import { SafeHtml } from '../../_core/safe-html';
import { ExperienceEntrySchema } from '../../_core/value-objects';
import type { TeamMemberProps } from './team-member.types';

type SocialPlatform =
  | 'linkedin'
  | 'twitter'
  | 'facebook'
  | 'instagram'
  | 'github';

interface SocialConfig {
  key: SocialPlatform;
  platform: SocialPlatform;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  label: string;
  pattern: RegExp;
}

interface NormalizedSocialLink {
  platform: SocialPlatform;
  url: string;
  icon: SocialConfig['icon'];
  label: string;
}

interface NormalizedExperience {
  position: string;
  company: string;
  duration?: string;
  description?: string;
}

const SOCIAL_CONFIG: SocialConfig[] = [
  {
    key: 'linkedin',
    platform: 'linkedin',
    icon: Linkedin,
    label: 'LinkedIn',
    pattern: /^https:\/\/(www\.)?linkedin\.com\/.+/i,
  },
  {
    key: 'twitter',
    platform: 'twitter',
    icon: Twitter,
    label: 'Twitter',
    pattern: /^https:\/\/(www\.)?(twitter|x)\.com\/.+/i,
  },
  {
    key: 'facebook',
    platform: 'facebook',
    icon: Facebook,
    label: 'Facebook',
    pattern: /^https:\/\/(www\.)?facebook\.com\/.+/i,
  },
  {
    key: 'instagram',
    platform: 'instagram',
    icon: Instagram,
    label: 'Instagram',
    pattern: /^https:\/\/(www\.)?instagram\.com\/.+/i,
  },
  {
    key: 'github',
    platform: 'github',
    icon: Github,
    label: 'GitHub',
    pattern: /^https:\/\/(www\.)?github\.com\/.+/i,
  },
];

function resolveCardTone(mode: 'compact' | 'full'): CmsCardTone {
  return mode === 'compact' ? 'muted' : 'default';
}

function normalizeSocialLinks(
  content: TeamMemberProps['content'],
): NormalizedSocialLink[] {
  return SOCIAL_CONFIG.reduce((links, config) => {
    const raw = content[config.key as keyof typeof content];
    if (typeof raw !== 'string') {
      return links;
    }

    const url = raw.trim();
    if (url.length === 0) {
      return links;
    }

    if (!validateUrl(url) || !config.pattern.test(url)) {
      return links;
    }

    links.push({
      platform: config.platform,
      url,
      icon: config.icon,
      label: config.label,
    });

    return links;
  }, [] as NormalizedSocialLink[]);
}

function normalizeSkills(skills?: unknown): string[] {
  if (!Array.isArray(skills)) {
    return [];
  }

  return skills
    .map((skill) => (typeof skill === 'string' ? sanitizeText(skill) : ''))
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
}

function normalizeExperience(
  experience?: unknown,
): NormalizedExperience[] {
  if (!Array.isArray(experience)) {
    return [];
  }

  return experience
    .map((item) => {
      if (!item || typeof item !== 'object') {
        return null;
      }

      // Validate with Zod schema
      const parsed = ExperienceEntrySchema.safeParse(item);
      if (!parsed.success) {
        return null;
      }

      const { position: rawPosition, company: rawCompany, duration: rawDuration, description: rawDescription } = parsed.data;

      const position = sanitizeText(rawPosition);
      const company = sanitizeText(rawCompany);
      const duration = rawDuration ? sanitizeText(rawDuration) : undefined;
      const description = rawDescription ? sanitizeText(rawDescription) : undefined;

      if (position.length === 0 || company.length === 0) {
        return null;
      }

      const normalized: NormalizedExperience = {
        position,
        company,
      };

      if (duration) {
        normalized.duration = duration;
      }

      if (description) {
        normalized.description = description;
      }

      return normalized;
    })
    .filter(
      (item): item is NormalizedExperience =>
        item !== null,
    );
}

function normalizeContact(
  email?: string,
  phone?: string,
): Array<{
  type: 'email' | 'phone';
  href: string;
  label: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
}> {
  const items: Array<{
    type: 'email' | 'phone';
    href: string;
    label: string;
    icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  }> = [];

  if (email) {
    const sanitized = sanitizeText(email);
    if (sanitized.length > 0) {
      items.push({
        type: 'email',
        href: `mailto:${sanitized}`,
        label: sanitized,
        icon: Mail,
      });
    }
  }

  if (phone) {
    const sanitized = sanitizeText(phone);
    if (sanitized.length > 0) {
      items.push({
        type: 'phone',
        href: `tel:${sanitized}`,
        label: sanitized,
        icon: Phone,
      });
    }
  }

  return items;
}

function buildAvatarInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((segment) => segment[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

const TeamMemberBase: React.FC<TeamMemberProps> = ({
  id,
  className,
  style,
  theme = 'auto',
  content,
  analytics,
  loading = 'eager',
  onLoad,
  onError,
  onInteraction,
}) => {
  React.useEffect(() => {
    try {
      onLoad?.();
    } catch (error) {
      onError?.(error as Error);
    }
  }, [onLoad, onError]);

  const displayMode =
    content.displayMode === 'compact' ? 'compact' : 'full';

  const name = sanitizeText(content.name);
  const title = sanitizeText(content.title);
  const department = content.department
    ? sanitizeText(content.department)
    : undefined;
  const bioHtml = sanitizeHtml(content.bio);
  const socialLinks = normalizeSocialLinks(content);
  const skills = normalizeSkills(content.skills);
  const experience = normalizeExperience(content.experience);
  const contactItems = normalizeContact(
    content.email,
    content.phone,
  );
  const cardTone = resolveCardTone(displayMode);
  const photo = (() => {
    if (typeof content.photo === 'object' && content.photo?.src) {
      return content.photo.src;
    }
    if (typeof content.photo === 'string') {
      const trimmed = content.photo.trim();
      return trimmed.length > 0 ? trimmed : undefined;
    }
    return undefined;
  })();
  const photoAlt =
    typeof content.photo === 'object' && content.photo?.alt
      ? sanitizeText(content.photo.alt)
      : name.length > 0 && title.length > 0
        ? `${name} – ${title}`
        : name.length > 0
          ? name
          : 'Team member portrait';

  const analyticsId = analytics?.trackingId;

  const handleSocialClick = (platform: SocialPlatform) => {
    onInteraction?.('social-click', { platform });
  };

  const handleContactClick = (type: 'email' | 'phone') => {
    onInteraction?.('contact-click', { type });
  };

  const renderSocialButtons = () => {
    if (socialLinks.length === 0) {
      return null;
    }

    return (
      <div
        className={cn('flex flex-wrap', dsSpacing.gap('sm'))}
        aria-label="Social links"
      >
        {socialLinks.map((link) => {
          const Icon = link.icon;

          return (
            <Button
              key={link.platform}
              asChild
              variant="ghost"
              size="icon"
              aria-label={`${name}'s ${link.label} profile`}
              className={cn('transition-shadow hover:bg-primary/10', themeClass(theme))}
              onClick={(event: React.MouseEvent<HTMLButtonElement>) => handleSocialClick(link.platform)}
            >
              <a
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
              </a>
            </Button>
          );
        })}
      </div>
    );
  };

  const renderSkills = (headingLevel: 3 | 4 = 3) => {
    if (skills.length === 0) {
      return null;
    }

    return (
      <section
        aria-label="Skills"
        className={cn('flex flex-col', dsSpacing.gap('sm'))}
      >
        <h3 className={cmsHeading(headingLevel, theme)}>
          Skills
        </h3>
        <ul className={cn('flex flex-wrap', dsSpacing.gap('sm'))}>
          {skills.map((skill) => (
            <li key={skill}>
              <CmsBadge
                variant="outline"
                theme={theme}
                className="rounded-full px-3 py-1 text-xs font-medium uppercase tracking-wide transition-shadow  hover:border-primary hover:bg-primary/10"
              >
                {skill}
              </CmsBadge>
            </li>
          ))}
        </ul>
      </section>
    );
  };

  const renderExperience = () => {
    if (experience.length === 0) {
      return null;
    }

    return (
      <section
        aria-label="Experience"
        className={cn('flex flex-col', dsSpacing.gap('md'))}
      >
        <h3 className={cmsHeading(3, theme)}>Experience</h3>
        <ul className={cn('flex flex-col', dsSpacing.gap('md'))}>
          {experience.map((item, index) => (
            <li
              key={`${item.position}-${item.company}-${index}`}
              className={cn(
                'border-l border-border/60',
                dsSpacing.pl('md'),
              )}
            >
              <p className={cmsHeading(5, theme)}>{item.position}</p>
              <p className={cmsBody('sm', theme, 'text-muted-foreground')}>
                {item.company}
                {item.duration ? ` • ${item.duration}` : null}
              </p>
              {item.description ? (
                <p
                  className={cmsBody(
                    'sm',
                    theme,
                    dsSpacing.mt('xxs'),
                  )}
                >
                  {item.description}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      </section>
    );
  };

  const renderContact = () => {
    if (contactItems.length === 0) {
      return null;
    }

    return (
      <CardFooter
        className={cn(
          'flex items-center gap-3 p-[var(--component-padding)] pt-0',
          themeClass(theme),
          'flex-col border-t border-border/40',
          dsSpacing.gap('xs'),
          dsSpacing.pt('lg'),
        )}
        aria-label="Contact details"
      >
        {contactItems.map((item) => {
          const Icon = item.icon;
          return (
            <a
              key={item.type}
              href={item.href}
              className={cn(
                'inline-flex items-center text-left',
                dsSpacing.gap('xs'),
                cmsBody('sm', theme, 'text-foreground'),
              )}
              onClick={() => handleContactClick(item.type)}
            >
              <Icon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              <span>{item.label}</span>
            </a>
          );
        })}
      </CardFooter>
    );
  };

  const renderCompact = () => {
    return (
      <Card
        className={cn(CARD_TONES[cardTone], themeClass(theme), 'w-full')}
      >
        <CardHeader
          className={cn(
            'flex flex-col gap-2 p-[var(--component-padding)]',
            themeClass(theme),
            'flex-col sm:flex-row sm:items-center',
            dsSpacing.gap('md'),
            dsSpacing.pb('md'),
          )}
        >
          <Avatar
            className={cn('h-20 w-20 flex-shrink-0 shadow-sm transition-shadow hover:shadow-md', themeClass(theme))}
          >
            {photo ? (
              <AvatarImage src={photo} alt={photoAlt} />
            ) : (
              <AvatarFallback className={themeClass(theme)}>
                {buildAvatarInitials(name || photoAlt)}
              </AvatarFallback>
            )}
          </Avatar>

          <div
            className={cn(
              'flex flex-1 flex-col text-left',
              dsSpacing.gap('xs'),
            )}
          >
            {name ? (
              <h2 className={cmsHeading(4, theme)}>{name}</h2>
            ) : null}
            {title ? (
              <p className={cmsBody('sm', theme, 'text-muted-foreground')}>
                {title}
              </p>
            ) : null}
            {department ? (
              <CmsBadge
                variant="neutral"
                theme={theme}
                className="w-fit uppercase tracking-wide"
              >
                {department}
              </CmsBadge>
            ) : null}
          </div>
        </CardHeader>

        <CardContent
          className={cn('p-[var(--component-padding)] pt-0', themeClass(theme), 'flex flex-col', dsSpacing.gap('lg'))}
        >
          {bioHtml ? (
            <SafeHtml
              html={bioHtml}
              className={cn(
                'cms-team-member__bio prose prose-neutral text-left',
                'dark:prose-invert',
                cmsBody('sm', theme, 'max-w-none'),
              )}
            />
          ) : null}

          {renderSkills(4)}

          {socialLinks.length > 0 ? (
            <div className={dsSpacing.pt('xxs')}>{renderSocialButtons()}</div>
          ) : null}
        </CardContent>
      </Card>
    );
  };

  const renderFull = () => {
    return (
      <Card
        className={cn(CARD_TONES[cardTone], themeClass(theme), 'mx-auto w-full max-w-5xl')}
      >
        <CardHeader
          className={cn('flex flex-col gap-2 p-[var(--component-padding)]', themeClass(theme), 'flex-col lg:flex-row', dsSpacing.gap('xl'))}
        >
          <div className="lg:w-1/3">
            <AspectRatio
              ratio={4 / 5}
              className="group overflow-hidden rounded-2xl bg-muted/80 shadow-md transition-shadow duration-300 hover:shadow-lg"
            >
              {photo ? (
                <Image
                  src={photo}
                  alt={photoAlt}
                  fill
                  className="h-full w-full object-cover transition-shadow"
                  loading={loading}
                  sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 420px"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center transition-colors duration-300 group-hover:bg-muted">
                  <Avatar
                    className={cn('h-28 w-28 transition-shadow', themeClass(theme))}
                  >
                    <AvatarFallback className={themeClass(theme)}>
                      {buildAvatarInitials(name || photoAlt)}
                    </AvatarFallback>
                  </Avatar>
                </div>
              )}
            </AspectRatio>

            {socialLinks.length > 0 ? (
              <div className={dsSpacing.mt('md')}>
                {renderSocialButtons()}
              </div>
            ) : null}
          </div>

          <div className="lg:w-2/3">
            <div
              className={cn(
                'flex flex-col text-left',
                dsSpacing.gap('sm'),
              )}
            >
              {name ? (
                <h1 className={cmsHeading(2, theme)}>{name}</h1>
              ) : null}
              {title ? (
                <p className={cmsBody('lg', theme, 'text-muted-foreground')}>
                  {title}
                </p>
              ) : null}
              {department ? (
                <CmsBadge
                  variant="neutral"
                  theme={theme}
                  className="w-fit uppercase tracking-wide"
                >
                  {department}
                </CmsBadge>
              ) : null}
            </div>
          </div>
        </CardHeader>

        <CardContent
          className={cn('p-[var(--component-padding)] pt-0', themeClass(theme), 'flex flex-col', dsSpacing.gap('xl'))}
        >
          {bioHtml ? (
            <SafeHtml
              html={bioHtml}
              className={cn(
                'cms-team-member__bio prose prose-neutral text-left',
                'dark:prose-invert',
                cmsBody('md', theme, 'max-w-none'),
              )}
            />
          ) : null}

          {renderSkills()}

          {renderExperience()}
        </CardContent>

        {contactItems.length > 0 ? renderContact() : null}
      </Card>
    );
  };

  return (
    <CmsSection
      id={id}
      size="lg"
      theme={theme}
      className={cn('cms-team-member', className)}
      style={style}
      role="article"
      aria-label="Team member profile"
      data-component-type="team-member"
      data-analytics-id={analyticsId}
      containerClassName={cn('items-center', dsSpacing.gap('xl'))}
    >
      {displayMode === 'compact' ? renderCompact() : renderFull()}
    </CmsSection>
  );
};

const TeamMember = withPerformanceTracking(
  TeamMemberBase,
  ComponentType.TeamMember,
);

export default TeamMember;
