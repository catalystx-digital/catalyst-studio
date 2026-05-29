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
import { AspectRatio } from '@/components/ui/aspect-ratio';
import { Card } from '@/components/ui/card';
import {
  CmsAlert,
  CmsAlertDescription,
  CmsSection,
  buildCmsClassName,
  CARD_TONES,
  cmsBody,
  dsSpacing,
  themeClass,
  shouldShowDevEmptyState,
} from '../../_ui';
import { withPerformanceTracking } from '../../_core/monitoring';
import { ComponentType, ComponentCategory } from '../../_core/types';
import { SafeHtml } from '../../_core/safe-html';
import { validateUrl } from '../../_utils/url-validation';
import { resolveImageSource } from '../../_utils/media-reference';
import { resolveSmartLinkHref } from '../../_utils/smart-link';
import type { LogoStripProps, LogoItem } from './logo-strip.types';

type LogoSize = NonNullable<LogoStripProps['content']['size']>;

const DEFAULT_SIZE: LogoSize = 'medium';
const CAPTION_ALLOWED_TAGS = ['b', 'i', 'em', 'strong', 'span', 'br'];

const IMAGE_HEIGHT_PX: Record<LogoSize, number> = {
  small: 32,
  medium: 48,
  large: 64,
};

const TILE_MIN_WIDTH: Record<LogoSize, string> = {
  small: 'min-w-[96px]',
  medium: 'min-w-[128px]',
  large: 'min-w-[144px]',
};

const CARD_PADDING: Record<LogoSize, string> = {
  small: `${dsSpacing.px('md')} ${dsSpacing.py('sm')}`,
  medium: `${dsSpacing.px('lg')} ${dsSpacing.py('md')}`,
  large: `${dsSpacing.px('xl')} ${dsSpacing.py('lg')}`,
};

interface PreparedLogo {
  key: string;
  id: string;
  alt: string;
  label: string;
  href?: string;
  captionHtml?: string;
  imageSrc: string;
}

function sanitizePlainText(value: string): string {
  return DOMPurify.sanitize(value, {
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: [],
  });
}

function sanitizeCaption(value?: string): string {
  if (!value) {
    return '';
  }

  return DOMPurify.sanitize(value, {
    ALLOWED_TAGS: CAPTION_ALLOWED_TAGS,
    ALLOWED_ATTR: [],
  });
}

function prepareLogos(logos: LogoItem[]): PreparedLogo[] {
  const keyCounts = new Map<string, number>();

  const safeStringTrim = (value: unknown): string =>
    typeof value === 'string' ? value.trim() : '';

  logos.forEach((logo) => {
    const base = (safeStringTrim(logo.id) || safeStringTrim(logo.originalUrl) || '').toLowerCase();
    keyCounts.set(base, (keyCounts.get(base) ?? 0) + 1);
  });

  return logos.map((logo, index) => {
    const base = (safeStringTrim(logo.id) || safeStringTrim(logo.originalUrl) || '').toLowerCase();
    const needsSuffix = base === '' || (keyCounts.get(base) ?? 0) > 1;
    const key = needsSuffix ? `${base || 'logo'}-${index}` : base;

    const sanitizedAlt = sanitizePlainText(String(logo.alt ?? ''));
    const sanitizedCaption = sanitizeCaption(logo.caption);
    const resolvedHref = resolveSmartLinkHref(logo.href);
    const validatedHref = validateUrl(resolvedHref, {
      fallback: '',
    });
    const validatedSrc = resolveImageSource(logo) ?? '';
    const resolvedId = safeStringTrim(logo.id) || key;
    const altText = sanitizedAlt || 'Company logo';

    return {
      key,
      id: resolvedId,
      alt: altText,
      label: altText,
      href: validatedHref || undefined,
      captionHtml: sanitizedCaption || undefined,
      imageSrc: validatedSrc,
    };
  });
}

interface LogoTileProps {
  logo: PreparedLogo;
  theme?: LogoStripProps['theme'];
  variant?: LogoStripProps['variant'];
  grayscale: boolean;
  size: LogoSize;
  loading?: LogoStripProps['loading'];
  onInteraction?: LogoStripProps['onInteraction'];
}

function LogoTile({
  logo,
  theme,
  variant,
  grayscale,
  size,
  loading,
  onInteraction,
}: LogoTileProps) {
  const imageHeight = IMAGE_HEIGHT_PX[size];
  const tileClasses = cn(
    'cms-logo-strip__tile flex h-full flex-none items-center justify-center',
    TILE_MIN_WIDTH[size],
  );

  const grayscaleClasses = grayscale
    ? 'grayscale opacity-75 transition-[opacity,filter] group-hover:opacity-100 group-hover:grayscale-0 group-focus-visible:opacity-100 group-focus-visible:grayscale-0'
    : 'opacity-100';

  const loadingAttr = loading === 'eager' ? 'eager' : 'lazy';

  const imageNode = logo.imageSrc ? (
    <img
      src={logo.imageSrc}
      alt={logo.alt}
      loading={loadingAttr}
      className={cn(
        'h-full w-auto max-w-full object-contain',
        grayscaleClasses,
      )}
      style={{ maxHeight: imageHeight }}
    />
  ) : (
    <span
      className={cmsBody(
        'sm',
        theme,
        'text-muted-foreground',
      )}
    >
      {logo.alt}
    </span>
  );

  const handleClick = React.useCallback(() => {
    onInteraction?.('logo-click', {
      logoId: logo.id,
      href: logo.href,
    });
  }, [logo.href, logo.id, onInteraction]);

  const cardContent = (
    <Card
      className={cn(
        CARD_TONES['minimal'],
        themeClass(theme),
        'cms-logo-strip__card group flex h-full w-full items-center justify-center rounded-2xl',
        'border-border/50 bg-card',
        CARD_PADDING[size],
      )}
    >
      <AspectRatio
        ratio={3}
        className="flex items-center justify-center bg-transparent"
      >
        <div className="flex h-full w-full items-center justify-center">
          {imageNode}
        </div>
      </AspectRatio>
    </Card>
  );

  const triggerClassName = buildCmsClassName({
    base: cn(
      'cms-logo-strip__trigger group block h-full w-full rounded-2xl border-0 bg-transparent p-0 text-left shadow-none',
      'focus-visible:outline-none',
    ),
    theme,
    variant,
    includeVariant: true,
  });

  const triggerNode = logo.href ? (
    <a
      href={logo.href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`Visit ${logo.label} website`}
      className={cn(triggerClassName, 'no-underline')}
      onClick={handleClick}
    >
      {cardContent}
    </a>
  ) : (
    <button
      type="button"
      aria-label={logo.label}
      className={triggerClassName}
    >
      {cardContent}
    </button>
  );

  return (
    <div className={tileClasses} data-testid={`logo-tile-${logo.id}`}>
      <Tooltip>
        <TooltipTrigger asChild>
          {triggerNode}
        </TooltipTrigger>
        {logo.captionHtml ? (
          <TooltipContent
            data-testid={`logo-tooltip-${logo.id}`}
          >
            <SafeHtml
              html={logo.captionHtml}
              tag="span"
              className={cmsBody(
                'sm',
                undefined,
                'font-medium tracking-tight',
              )}
            />
          </TooltipContent>
        ) : null}
      </Tooltip>
    </div>
  );
}

export const LogoStrip: React.FC<LogoStripProps> = ({
  id,
  content,
  className,
  theme,
  variant,
  style,
  loading,
  onInteraction,
}) => {
  const {
    logos = [],
    size = DEFAULT_SIZE,
    animateScroll = false,
    scrollSpeed = 30,
    grayscale = true,
    caption,
  } = content;
  const totalLogos = logos.length;
  const animationEnabled = animateScroll || totalLogos > 4;

  const scrollRef = React.useRef<HTMLDivElement>(null);
  const animationRef = React.useRef<number | null>(null);
  const [prefersReducedMotion, setPrefersReducedMotion] = React.useState(false);
  const [hasOverflow, setHasOverflow] = React.useState(false);
  const [isHovering, setIsHovering] = React.useState(false);
  const [isFocusWithin, setIsFocusWithin] = React.useState(false);

  React.useEffect(() => {
    if (!animationEnabled) {
      setPrefersReducedMotion(false);
      return;
    }

    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      setPrefersReducedMotion(false);
      return;
    }

    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handleChange = (event: MediaQueryListEvent | MediaQueryList) => {
      setPrefersReducedMotion(event.matches);
    };

    handleChange(motionQuery);
    const listener = (event: MediaQueryListEvent) => handleChange(event);
    motionQuery.addEventListener('change', listener);

    return () => {
      motionQuery.removeEventListener('change', listener);
    };
  }, [animationEnabled]);

  React.useEffect(() => {
    const scrollContainer = scrollRef.current;
    if (!scrollContainer) {
      return;
    }

    const scrollContent = scrollContainer.firstElementChild as HTMLElement | null;
    if (!scrollContent) {
      return;
    }

    const evaluateOverflow = () => {
      const overflow = scrollContent.scrollWidth - 1 > scrollContainer.clientWidth;
      setHasOverflow(overflow);
    };

    evaluateOverflow();

    if (typeof ResizeObserver === 'undefined') {
      return;
    }

    const observer = new ResizeObserver(evaluateOverflow);
    observer.observe(scrollContainer);
    observer.observe(scrollContent);

    return () => {
      observer.disconnect();
    };
  }, [animationEnabled, logos]);

  const isPaused = isHovering || isFocusWithin;
  const shouldAnimate = Boolean(
    animationEnabled && !prefersReducedMotion && hasOverflow && !isPaused,
  );

  React.useEffect(() => {
    const scrollContainer = scrollRef.current;
    if (!scrollContainer) {
      return;
    }

    const scrollContent = scrollContainer.firstElementChild as HTMLElement | null;
    if (!scrollContent) {
      return;
    }

    let clone: HTMLElement | null = null;

    const stopAnimation = () => {
      if (animationRef.current !== null) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
    };

    const cleanup = () => {
      stopAnimation();
      if (clone && scrollContainer.contains(clone)) {
        scrollContainer.removeChild(clone);
      }
      clone = null;
    };

    if (!shouldAnimate) {
      cleanup();
      scrollContainer.scrollLeft = 0;
      return cleanup;
    }

    clone = scrollContent.cloneNode(true) as HTMLElement;
    scrollContainer.appendChild(clone);

    let scrollPosition = scrollContainer.scrollLeft;

    const animate = () => {
      scrollPosition += scrollSpeed / 60;

      const resetThreshold = scrollContent.scrollWidth;
      if (scrollPosition >= resetThreshold) {
        scrollPosition = 0;
      }

      scrollContainer.scrollLeft = scrollPosition;
      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    return cleanup;
  }, [logos, scrollSpeed, shouldAnimate]);

  // In production, return null when empty to avoid rendering empty sections
  // In development, show a placeholder alert
  if (!logos || logos.length === 0) {
    if (!shouldShowDevEmptyState()) {
      return null;
    }
    return (
      <CmsSection
        id={id}
        size="md"
        theme={theme}
        variant={variant}
        className="cms-logo-strip-section"
        style={style}
        data-component-type={ComponentType.LogoCloud}
        data-category={ComponentCategory.SocialProof}
        aria-label="Our partners and clients"
      >
        <CmsAlert variant="default" theme={theme} devOnly>
          <CmsAlertDescription>
            Partner logos will appear here once configured.
          </CmsAlertDescription>
        </CmsAlert>
      </CmsSection>
    );
  }

  const sanitizedCaption = React.useMemo(
    () => sanitizeCaption(caption),
    [caption],
  );
  const preparedLogos = React.useMemo(
    () => prepareLogos(logos),
    [logos],
  );

  const baseHorizontalPadding = dsSpacing.px('lg');
  const responsiveHorizontalPadding = shouldAnimate
    ? `md:${dsSpacing.px('xl')}`
    : `md:${dsSpacing.px('2xl')}`;

  return (
    <CmsSection
      id={id}
      size="md"
      theme={theme}
      variant={variant}
      className="cms-logo-strip-section"
      containerClassName="w-full"
      style={style}
      data-component-type={ComponentType.LogoCloud}
      data-category={ComponentCategory.SocialProof}
      aria-label="Our partners and clients"
    >
      <TooltipProvider delayDuration={150}>
        <div
          className={buildCmsClassName({
            base: cn(
              'cms-logo-strip relative rounded-3xl border border-border/40',
              'bg-card shadow-sm',
              baseHorizontalPadding,
              dsSpacing.py('2xl'),
              responsiveHorizontalPadding,
            ),
            theme,
            variant,
            className,
            includeVariant: true,
          })}
          role="region"
        >
          {sanitizedCaption ? (
            <SafeHtml
              html={sanitizedCaption}
              data-testid="logo-strip-caption"
              className={cn(
                'cms-logo-strip__caption text-center',
                dsSpacing.mb('xl'),
                cmsBody('sm', theme, 'text-muted-foreground'),
              )}
            />
          ) : null}

          <div
            ref={scrollRef}
            className={cn(
              'cms-logo-strip__scroller',
              shouldAnimate
                ? 'overflow-hidden'
                : 'overflow-x-auto md:overflow-visible',
            )}
            style={{
              WebkitOverflowScrolling: 'touch',
              scrollBehavior: 'smooth',
            }}
            onPointerEnter={() => setIsHovering(true)}
            onPointerLeave={() => setIsHovering(false)}
            onFocusCapture={() => setIsFocusWithin(true)}
            onBlurCapture={(event) => {
              const nextTarget = event.relatedTarget as HTMLElement | null;
              if (!scrollRef.current || (nextTarget && scrollRef.current.contains(nextTarget))) {
                return;
              }
              setIsFocusWithin(false);
            }}
            aria-label="Partner logos"
          >
            <div
              className={cn(
                'cms-logo-strip__track inline-flex items-center',
                dsSpacing.gap('xl'),
                shouldAnimate
                  ? 'whitespace-nowrap'
                  : cn(
                      'flex-wrap justify-center whitespace-normal',
                      `md:${dsSpacing.gap('2xl')}`,
                    ),
              )}
            >
              {preparedLogos.map((logo) => (
                <LogoTile
                  key={logo.key}
                  logo={logo}
                  theme={theme}
                  variant={variant}
                  grayscale={grayscale}
                  size={size}
                  loading={loading}
                  onInteraction={onInteraction}
                />
              ))}
            </div>
          </div>

          {!shouldAnimate && preparedLogos.length > 4 ? (
            <div
              className={cn(
                'cms-logo-strip__indicator flex justify-center md:hidden',
                dsSpacing.mt('lg'),
              )}
            >
              <span
                className={cmsBody(
                  'xs',
                  theme,
                  'text-muted-foreground',
                )}
              >
                Scroll to see more →
              </span>
            </div>
          ) : null}
        </div>
      </TooltipProvider>
    </CmsSection>
  );
};

const MemoizedLogoStrip = React.memo(LogoStrip);

const LogoStripWithPerformance = withPerformanceTracking(
  MemoizedLogoStrip,
  ComponentType.LogoCloud,
);

export default LogoStripWithPerformance;
