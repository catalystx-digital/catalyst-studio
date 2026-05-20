import React from 'react';
import Image from 'next/image';

import { cn } from '@/lib/utils';

import {
  CmsSection,
  cmsBody,
  cmsHeading,
  dsSpacing,
} from '../../_ui';
import type { CMSComponentProps, ComponentTheme } from '../../_core/types';
import { sanitizeHtml, sanitizeText } from '../../_core/security';
import { SafeHtml } from '../../_core/safe-html';
import {
  validateImageUrl,
  validateVideoUrl,
  isTrustedVideoEmbedUrl,
  isStreamingManifestUrl,
} from '../../_utils/url-validation';
import { renderCMSComponents } from '../../_factory/renderer.server';
import { TwoColumnProps, ColumnContent } from './two-column.types';

const TEXT_ALLOWED_TAGS = [
  'p',
  'ul',
  'ol',
  'li',
  'a',
  'strong',
  'em',
  'br',
  'blockquote',
  'h3',
  'h4',
  'h5',
];

const TEXT_ALLOWED_ATTR = ['href', 'target', 'rel'];

type Alignment = NonNullable<ColumnContent['alignment']>;

const ALIGNMENT_CLASSNAMES: Record<
  Alignment | 'left' | 'center' | 'right',
  { container: string; text: string }
> = {
  left: { container: 'items-start text-left', text: 'text-left' },
  center: { container: 'items-center text-center', text: 'text-center' },
  right: { container: 'items-end text-right', text: 'text-right' },
};

type MediaHeightPreset = NonNullable<ColumnContent['imageHeight']>;

const MEDIA_HEIGHT_STYLES: Record<
  MediaHeightPreset,
  { minHeight: string; maxHeight: string }
> = {
  compact: { minHeight: '12rem', maxHeight: '20rem' },
  auto: {
    minHeight: 'var(--ds-media-min-height,14rem)',
    maxHeight: 'var(--ds-media-max-height,26rem)',
  },
  tall: { minHeight: '18rem', maxHeight: '32rem' },
};

function buildMediaStyle(
  height?: ColumnContent['imageHeight'] | ColumnContent['videoHeight'],
  aspectRatio?: string,
): React.CSSProperties {
  const preset = MEDIA_HEIGHT_STYLES[height ?? 'auto'];

  return {
    minHeight: preset.minHeight,
    maxHeight: preset.maxHeight,
    aspectRatio: aspectRatio || undefined,
  };
}

function sanitizeColumnBody(body?: ColumnContent['body']): string {
  if (!body) return '';
  return sanitizeHtml(body, {
    ALLOWED_TAGS: TEXT_ALLOWED_TAGS,
    ALLOWED_ATTR: TEXT_ALLOWED_ATTR,
    ALLOW_DATA_ATTR: false,
  });
}

function withTheme(
  components: CMSComponentProps[] | undefined,
  theme: ComponentTheme,
): CMSComponentProps[] | undefined {
  if (!Array.isArray(components) || components.length === 0) {
    return undefined;
  }

  return components.map((component) =>
    component.theme ? component : { ...component, theme },
  );
}

async function ColumnRenderer({
  components,
}: {
  components: CMSComponentProps[] | undefined;
}) {
  if (!Array.isArray(components) || components.length === 0) {
    return null;
  }

  const nodes = await renderCMSComponents(components);
  return <>{nodes}</>;
}

function renderTextColumn(
  column: ColumnContent,
  theme: ComponentTheme,
): React.ReactNode {
  const sanitizedHeading = column.heading
    ? sanitizeText(column.heading)
    : undefined;
  const sanitizedBody = sanitizeColumnBody(column.body);
  const alignment = ALIGNMENT_CLASSNAMES[column.alignment ?? 'left'];

  return (
    <div
      className={cn(
        'cms-two-column__text flex flex-col',
        dsSpacing.gap('lg'),
        alignment.container,
      )}
    >
      {sanitizedHeading ? (
        <h3
          className={cmsHeading(3, theme, cn('mb-2', alignment.text))}
          data-testid="two-column-heading"
        >
          {sanitizedHeading}
        </h3>
      ) : null}
      {column.body ? (
        <SafeHtml html={sanitizedBody} className={cmsBody(
            'md',
            theme,
            cn(
              alignment.text,
              'cms-two-column__rich-text',
              dsSpacing.spaceY('md'),
              '[&_a]:underline [&_a]:transition-colors',
              '[&_a:hover]:text-primary',
              '[&_ul]:list-disc [&_ul]:pl-5',
              '[&_ol]:list-decimal [&_ol]:pl-5',
            ),
          )} />
      ) : null}
    </div>
  );
}

function renderImageColumn(
  column: ColumnContent,
  theme: ComponentTheme,
  side: 'left' | 'right',
): React.ReactNode {
  const imageSrc = validateImageUrl(column.imageUrl);
  if (!imageSrc) {
    return null;
  }

  const altText = sanitizeText(column.imageAlt ?? '');
  const caption = column.imageCaption ? sanitizeText(column.imageCaption) : '';
  const mediaStyle = buildMediaStyle(column.imageHeight, column.imageAspectRatio);
  const imageFit = column.imageFit ?? 'cover';

  return (
    <div className={cn('cms-two-column__media group flex flex-col', dsSpacing.gap('sm'))}>
      <div
        className="relative w-full overflow-hidden rounded-xl border border-border/40 bg-card shadow-sm transition-shadow group-hover:shadow-md"
        style={mediaStyle}
      >
        <Image
          src={imageSrc}
          alt={altText || 'Two column media'}
          fill
          className="h-full w-full object-cover"
          style={{ objectFit: imageFit }}
          sizes="(max-width: 768px) 100vw, 50vw"
          priority={side === 'left'}
        />
      </div>
      {caption ? (
        <p className={cmsBody('sm', theme, 'text-muted-foreground')}>
          {caption}
        </p>
      ) : null}
    </div>
  );
}

function renderVideoColumn(
  column: ColumnContent,
  theme: ComponentTheme,
): React.ReactNode {
  const videoSrc = validateVideoUrl(column.videoUrl);
  if (!videoSrc) {
    return null;
  }
  const isEmbed = isTrustedVideoEmbedUrl(videoSrc);
  const isStreaming = isStreamingManifestUrl(videoSrc);
  const videoSources: Array<{ src: string; type?: string }> = [];

  if (!isEmbed) {
    const lower = videoSrc.toLowerCase();
    if (isStreaming) {
      videoSources.push({
        src: videoSrc,
        type: lower.includes('.mpd') ? 'application/dash+xml' : 'application/x-mpegURL',
      });
    } else if (/\.(webm)(\?|$)/.test(lower)) {
      videoSources.push({ src: videoSrc, type: 'video/webm' });
    } else if (/\.(ogg|ogv)(\?|$)/.test(lower)) {
      videoSources.push({ src: videoSrc, type: 'video/ogg' });
    } else {
      videoSources.push({ src: videoSrc, type: 'video/mp4' });
      const webmFallback = videoSrc.replace(/\.mp4(\?.*)?$/i, '.webm$1');
      if (webmFallback !== videoSrc) {
        videoSources.push({ src: webmFallback, type: 'video/webm' });
      }
    }
  }

  const containerStyle = buildMediaStyle(
    column.videoHeight ?? column.imageHeight,
    column.videoAspectRatio ?? column.imageAspectRatio,
  );
  const videoFit = column.videoFit ?? 'cover';

  return (
    <div className={cn('cms-two-column__media group flex flex-col', dsSpacing.gap('sm'))}>
      <div
        className="relative w-full overflow-hidden rounded-xl border border-border/40 bg-card shadow-sm transition-shadow group-hover:shadow-md"
        style={containerStyle}
      >
        {isEmbed ? (
          <iframe
            src={videoSrc}
            title="Embedded media"
            className="h-full w-full border-0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
            allowFullScreen
            loading="lazy"
          />
        ) : (
          <video
            className="h-full w-full object-cover"
            style={{ objectFit: videoFit }}
            controls
            preload="metadata"
          >
            {videoSources.map(source => (
              <source key={source.src} src={source.src} type={source.type} />
            ))}
          </video>
        )}
      </div>
    </div>
  );
}

/**
 * Allowed HTML tags for the 'html' column type.
 * More permissive than text to support full WYSIWYG content including links.
 */
const HTML_COLUMN_ALLOWED_TAGS = [
  'div',
  'span',
  'p',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'ul',
  'ol',
  'li',
  'a',
  'strong',
  'b',
  'em',
  'i',
  'br',
  'blockquote',
  'img',
  'figure',
  'figcaption',
];

const HTML_COLUMN_ALLOWED_ATTR = [
  'href',
  'target',
  'rel',
  'src',
  'alt',
  'title',
  'class',
  'id',
];

function renderHtmlColumn(
  column: ColumnContent,
  theme: ComponentTheme,
): React.ReactNode {
  const rawHtml = column.html || column.body;
  if (!rawHtml) {
    return null;
  }

  const sanitizedHtml = sanitizeHtml(String(rawHtml), {
    ALLOWED_TAGS: HTML_COLUMN_ALLOWED_TAGS,
    ALLOWED_ATTR: HTML_COLUMN_ALLOWED_ATTR,
    ALLOW_DATA_ATTR: false,
  });

  const alignment = ALIGNMENT_CLASSNAMES[column.alignment ?? 'left'];
  const LinkWrapper = column.link ? 'a' : 'div';
  const linkProps = column.link
    ? { href: column.link, className: 'block transition-opacity hover:opacity-80' }
    : {};

  return (
    <LinkWrapper {...linkProps}>
      <SafeHtml html={sanitizedHtml} className={cn(
          'cms-two-column__html flex flex-col',
          dsSpacing.gap('md'),
          alignment.container,
          'cms-two-column__rich-text',
          '[&_a]:underline [&_a]:transition-colors',
          '[&_a:hover]:text-primary',
          '[&_ul]:list-disc [&_ul]:pl-5',
          '[&_ol]:list-decimal [&_ol]:pl-5',
          '[&_img]:rounded-lg [&_img]:max-w-full',
        )} />
    </LinkWrapper>
  );
}

function renderColumnContent(
  column: ColumnContent | undefined,
  theme: ComponentTheme,
  side: 'left' | 'right',
): React.ReactNode {
  if (!column) return null;

  switch (column.type) {
    case 'text':
      return renderTextColumn(column, theme);
    case 'image':
      return renderImageColumn(column, theme, side);
    case 'video':
      return renderVideoColumn(column, theme);
    case 'html':
      return renderHtmlColumn(column, theme);
    default:
      return null;
  }
}

export const TwoColumnServer: React.FC<TwoColumnProps> = ({
  id,
  content,
  className,
  style,
  theme = 'auto',
  variant = 'default',
  analyticsId,
}) => {
  const {
    leftColumn,
    rightColumn,
    columnRatio = '50-50',
    reverseOnMobile = false,
    gap = 'medium',
    verticalAlignment = 'top',
    areas,
  } = content;

  const gapClass =
    {
      small: dsSpacing.gap('md'),
      medium: dsSpacing.gap('xl'),
      large: dsSpacing.gap('2xl'),
    }[gap] ?? dsSpacing.gap('xl');

  const alignClass =
    {
      top: 'items-start',
      center: 'items-center',
      bottom: 'items-end',
    }[verticalAlignment] ?? 'items-start';

  const ratioClass =
    {
      '25-75': 'lg:grid-cols-[1fr_3fr]',
      '30-70': 'lg:grid-cols-[3fr_7fr]',
      '40-60': 'lg:grid-cols-[2fr_3fr]',
      '50-50': 'lg:grid-cols-2',
      '60-40': 'lg:grid-cols-[3fr_2fr]',
      '70-30': 'lg:grid-cols-[7fr_3fr]',
      '75-25': 'lg:grid-cols-[3fr_1fr]',
    }[columnRatio] ?? 'lg:grid-cols-2';

  const themedLeftComponents = withTheme(
    Array.isArray(leftColumn)
      ? leftColumn
      : Array.isArray(areas?.left)
        ? areas.left
        : undefined,
    theme,
  );

  const themedRightComponents = withTheme(
    Array.isArray(rightColumn)
      ? rightColumn
      : Array.isArray(areas?.right)
        ? areas.right
        : undefined,
    theme,
  );

  const leftOrderClass = reverseOnMobile
    ? 'order-2 lg:order-1'
    : 'order-1 lg:order-1';
  const rightOrderClass = reverseOnMobile
    ? 'order-1 lg:order-2'
    : 'order-2 lg:order-2';

  return (
    <CmsSection
      id={id}
      size="md"
      theme={theme}
      variant={variant}
      className={cn('cms-two-column', className)}
      containerClassName={cn('w-full flex flex-col', dsSpacing.gap('lg'))}
      style={style}
      data-analytics-id={analyticsId}
      data-component-type="two-column"
      data-variant={variant}
    >
      <div
        className={cn(
          'grid grid-cols-1',
          ratioClass,
          gapClass,
          alignClass,
        )}
        data-testid="two-column-grid"
      >
        <div
          className={cn(
            'cms-two-column__column flex flex-col',
            dsSpacing.gap('md'),
            leftOrderClass,
          )}
          data-column="left"
          data-column-type={Array.isArray(leftColumn) ? 'components' : leftColumn?.type}
        >
          {themedLeftComponents ? (
            <ColumnRenderer components={themedLeftComponents} />
          ) : !Array.isArray(leftColumn) ? (
            renderColumnContent(leftColumn as ColumnContent | undefined, theme, 'left')
          ) : null}
        </div>
        <div
          className={cn(
            'cms-two-column__column flex flex-col',
            dsSpacing.gap('md'),
            rightOrderClass,
          )}
          data-column="right"
          data-column-type={Array.isArray(rightColumn) ? 'components' : rightColumn?.type}
        >
          {themedRightComponents ? (
            <ColumnRenderer components={themedRightComponents} />
          ) : !Array.isArray(rightColumn) ? (
            renderColumnContent(
              rightColumn as ColumnContent | undefined,
              theme,
              'right',
            )
          ) : null}
        </div>
      </div>
    </CmsSection>
  );
};
