'use client';

import React, { useMemo, useState } from 'react';

import { cn } from '@/lib/utils';

import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

import {
  CmsButtonGroup,
  cmsBody,
  cmsHeading,
  dsSpacing,
} from '../../_ui';
import { resolveCmsIcon } from '../../_utils/icon-resolver';
import { normalizeCmsImage } from '../../_utils/media-reference';
import { SafeHtml } from '../../_core/safe-html';
import type { QuoteBlockClientProps } from './quote-block.types';

type QuoteAlign = NonNullable<QuoteBlockClientProps['content']['align']>;
type QuoteSize = NonNullable<QuoteBlockClientProps['content']['size']>;
type QuoteStyle = NonNullable<QuoteBlockClientProps['content']['style']>;
type QuoteVariant = NonNullable<QuoteBlockClientProps['variant']>;

const ALIGN_CLASSNAMES: Record<QuoteAlign, { container: string; text: string }> =
  {
    left: { container: 'items-start text-left', text: 'text-left' },
    center: { container: 'items-center text-center', text: 'text-center' },
    right: { container: 'items-end text-right', text: 'text-right' },
  };

const VARIANT_GAP_CLASS: Record<QuoteVariant, string> = {
  default: dsSpacing.gap('md'),
  minimal: dsSpacing.gap('sm'),
  compact: dsSpacing.gap('sm'),
  detailed: dsSpacing.gap('lg'),
  expanded: dsSpacing.gap('xl'),
};

const STYLE_CLASSNAMES: Record<QuoteStyle, string> = {
  default: cn(
    'rounded-xl bg-background shadow-sm',
    dsSpacing.padding('lg'),
    `sm:${dsSpacing.padding('xl')}`,
  ),
  bordered: cn(
    'rounded-xl border-l-4 border-primary/80 shadow-sm',
    dsSpacing.padding('lg'),
    dsSpacing.pl('lg'),
    `sm:${dsSpacing.padding('xl')}`,
    `sm:${dsSpacing.pl('xl')}`,
  ),
  highlighted: cn(
    'rounded-xl bg-primary/10 ring-1 ring-primary/30 shadow-sm',
    dsSpacing.padding('lg'),
    `sm:${dsSpacing.padding('xl')}`,
  ),
  testimonial: cn(
    'rounded-xl bg-card shadow-md',
    dsSpacing.padding('lg'),
    `sm:${dsSpacing.padding('xl')}`,
  ),
  pullquote: cn(
    'rounded-xl bg-muted/50 shadow-sm',
    dsSpacing.padding('lg'),
    `sm:${dsSpacing.padding('xl')}`,
  ),
};

const SHARE_ACTIONS = [
  {
    key: 'twitter',
    label: 'Share on Twitter',
    icon: 'Twitter',
    buildUrl: (text: string, url: string) =>
      `https://twitter.com/intent/tweet?text=${encodeURIComponent(
        text,
      )}&url=${encodeURIComponent(url)}`,
  },
  {
    key: 'linkedin',
    label: 'Share on LinkedIn',
    icon: 'Linkedin',
    buildUrl: (_text: string, url: string) =>
      `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`,
  },
  {
    key: 'facebook',
    label: 'Share on Facebook',
    icon: 'Facebook',
    buildUrl: (_text: string, url: string) =>
      `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
  },
] as const;

const SHARE_ICON = resolveCmsIcon('Share2', {
  className: 'h-4 w-4 text-muted-foreground',
  fallback: '⇪',
});

function stripHtml(value: string): string {
  if (!value) {
    return '';
  }

  if (typeof window === 'undefined') {
    return value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  }

  const div = window.document.createElement('div');
  div.innerHTML = value;
  return div.textContent?.replace(/\s+/g, ' ').trim() ?? '';
}

function getInitials(value?: string): string | undefined {
  if (!value) {
    return undefined;
  }

  const parts = value.trim().split(/\s+/);
  if (parts.length === 0) {
    return undefined;
  }

  const initials = parts.slice(0, 2).map((part) => part.charAt(0).toUpperCase());
  return initials.join('');
}

export function QuoteBlockClient({
  content,
  className,
  theme = 'auto',
  variant = 'default',
  animated = true,
  onShare,
}: QuoteBlockClientProps) {
  const [showShareMenu, setShowShareMenu] = useState(false);

  const align: QuoteAlign = content.align ?? 'left';
  const size: QuoteSize = content.size ?? 'medium';
  const style: QuoteStyle = content.style ?? 'default';
  const highlight = Boolean(content.highlight);
  const isTestimonial = style === 'testimonial';

  const shareText = useMemo(() => stripHtml(content.quote ?? ''), [content.quote]);

  const iconNode = useMemo(() => {
    if (content.icon === 'none') {
      return null;
    }

    if (content.icon === 'custom' && content.customIcon) {
      return (
        <span
          aria-hidden="true"
          data-testid="cms-quote-icon-custom"
          className="text-3xl leading-none text-primary/70 transition-colors duration-300 hover:text-primary"
        >
          {content.customIcon}
        </span>
      );
    }

    return (
      <div className="relative flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-primary/20 to-primary/10 shadow-sm transition-shadow hover:shadow-md">
        {resolveCmsIcon('Quote', {
          className: 'h-6 w-6 text-primary transition-colors duration-300',
          fallback: '"',
        })}
      </div>
    );
  }, [content.icon, content.customIcon]);

  const quoteTypography = useMemo(() => {
    const alignClasses = ALIGN_CLASSNAMES[align]?.text ?? ALIGN_CLASSNAMES.left.text;
    const extra = cn(
      'leading-relaxed text-foreground',
      alignClasses,
      highlight ? 'text-primary' : undefined,
      variant === 'minimal' && !isTestimonial ? 'font-medium' : 'font-semibold',
      content.style === 'pullquote'
        ? 'italic'
        : undefined,
    );

    switch (size) {
      case 'small':
        return cmsBody('md', theme, extra);
      case 'large':
        return cmsHeading(3, theme, extra);
      case 'xlarge':
        return cmsHeading(2, theme, extra);
      case 'medium':
      default:
        return cmsHeading(4, theme, extra);
    }
  }, [align, content.style, highlight, size, theme, variant]);

  const handleShare = (platform: (typeof SHARE_ACTIONS)[number]) => {
    if (typeof window === 'undefined') {
      return;
    }

    const url = platform.buildUrl(shareText, window.location.href);
    window.open(url, '_blank', 'noopener');
    onShare?.(platform.key);
    setShowShareMenu(false);
  };

  const testimonialSpacingClass = isTestimonial
    ? cn(dsSpacing.gap('xl'), `sm:${dsSpacing.gap('2xl')}`)
    : undefined;

  const wrapperClasses = cn(
    'cms-quote-block relative flex w-full flex-col',
    ALIGN_CLASSNAMES[align]?.container ?? ALIGN_CLASSNAMES.left.container,
    VARIANT_GAP_CLASS[variant],
    STYLE_CLASSNAMES[style],
    testimonialSpacingClass,
    animated ? 'animate-fadeIn' : undefined,
    className,
  );

  const attribution = content.attribution;
  const initials = getInitials(attribution?.author);
  const attributionImage = normalizeCmsImage(
    attribution?.image,
    attribution?.author ?? 'Quote attribution',
  );
  const fallbackAvatar = resolveCmsIcon('User', {
    className: 'h-4 w-4 text-muted-foreground/60',
    fallback: '👤',
  });

  const blockquoteClasses = cn(
    'flex w-full flex-col gap-4 relative',
    'after:absolute after:inset-0 after:rounded-lg after:border after:border-primary/20 after:opacity-0 after:transition-opacity after:duration-300 after:pointer-events-none',
    'hover:after:opacity-100',
    isTestimonial ? 'sm:gap-6' : undefined,
  );

  const renderAttribution = () => {
    if (!attribution) {
      return null;
    }

    const avatarNode =
      (attributionImage || initials || fallbackAvatar) && (
        <Avatar className={isTestimonial ? 'h-16 w-16' : 'h-12 w-12'}>
          {attributionImage ? (
            <AvatarImage
              src={attributionImage.src}
              alt={attributionImage.alt ?? attribution.author ?? 'Quote attribution'}
            />
          ) : null}
          <AvatarFallback>
            {initials || fallbackAvatar}
          </AvatarFallback>
        </Avatar>
      );

    const authorName = attribution.author ? (
      <span className={cmsBody('md', theme, 'font-semibold text-foreground transition-colors duration-200 hover:text-primary')}>
        {attribution.author}
      </span>
    ) : null;

    const metaLine =
      attribution.title || attribution.organization ? (
        <div className={cmsBody('sm', theme, 'text-muted-foreground')}>
          {attribution.title ? <span>{attribution.title}</span> : null}
          {attribution.title && attribution.organization ? (
            <span aria-hidden="true" className="px-1">
              •
            </span>
          ) : null}
          {attribution.organization ? (
            <span>{attribution.organization}</span>
          ) : null}
        </div>
      ) : null;

    const dateLine = attribution.date ? (
      <div className={cmsBody('xs', theme, 'mt-1 text-muted-foreground')}>
        {attribution.date}
      </div>
    ) : null;

    if (isTestimonial) {
      return (
        <footer className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
          {avatarNode}
          <div className="flex flex-1 flex-col text-left">
            {authorName}
            {metaLine}
            {dateLine}
          </div>
        </footer>
      );
    }

    return (
      <footer
        className={cn(
          'flex w-full items-center gap-4 rounded-lg bg-gradient-to-r from-muted/30 to-transparent px-4 py-3 shadow-sm transition-shadow hover:shadow-md',
          align === 'center'
            ? 'justify-center text-center'
            : align === 'right'
              ? 'justify-end text-right'
              : 'justify-start text-left',
        )}
      >
        {avatarNode}

        <cite className="not-italic">
          {authorName}
          {metaLine}
          {dateLine}
        </cite>
      </footer>
    );
  };

  return (
    <figure
      className={wrapperClasses}
      data-testid="cms-quote-block"
      data-align={align}
      data-size={size}
      data-style={style}
      data-highlight={highlight}
    >
      {iconNode ? (
        <div
          className={cn(
            'cms-quote-block__icon flex w-full justify-start',
            align === 'center'
              ? 'justify-center'
              : align === 'right'
                ? 'justify-end'
                : 'justify-start',
          )}
          data-testid="cms-quote-icon"
        >
          {iconNode}
        </div>
      ) : null}

      <blockquote className={blockquoteClasses} role="blockquote">
        <SafeHtml
          html={content.quote}
          tag="p"
          className={quoteTypography}
        />

        {renderAttribution()}
      </blockquote>

      {variant === 'detailed' ? (
        <div className="relative self-end">
          <Button
            aria-expanded={showShareMenu}
            aria-haspopup="menu"
            aria-label="Share quote"
            className="rounded-full"
            onClick={() => setShowShareMenu((prev) => !prev)}
            size="icon"
            type="button"
            variant="ghost"
          >
            {SHARE_ICON}
          </Button>

          {showShareMenu ? (
            <div
              className="cms-quote-block__share-menu absolute right-0 z-10 mt-3 min-w-[12rem] rounded-xl border border-border/40 bg-card p-3 shadow-lg shadow-black/10"
              role="menu"
            >
              <CmsButtonGroup
                align="stretch"
                className="gap-2"
                responsive="md"
                theme={theme}
              >
                {SHARE_ACTIONS.map((action) => (
                  <Button
                    key={action.key}
                    className="justify-start gap-2"
                    onClick={() => handleShare(action)}
                    type="button"
                    variant="ghost"
                  >
                    {resolveCmsIcon(action.icon, {
                      className: 'h-4 w-4 text-muted-foreground',
                      fallback: action.label.charAt(0),
                    })}
                    <span className={cmsBody('sm', theme)}>{action.label}</span>
                  </Button>
                ))}
              </CmsButtonGroup>
            </div>
          ) : null}
        </div>
      ) : null}
    </figure>
  );
}
