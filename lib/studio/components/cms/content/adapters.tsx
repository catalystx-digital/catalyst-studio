/**
 * Adapter components that wrap content components to make them compatible
 * with the CMS component factory's type requirements.
 * 
 * These adapters convert generic CMSComponentProps to specific component props.
 * CRITICAL: This pattern is required to avoid TypeScript compilation errors.
 */

import React from 'react';
import { ComponentType, ComponentCategory } from '../_core/types';
import { readRuntimeContent } from '../_core/utils';
import { validateImageUrl } from '../_utils/url-validation';
import type { CMSComponentProps } from '../_core/types';
import { TextBlock } from './text-block';
import { TwoColumn } from './two-column';
import { ImageGallery } from './image-gallery';
import { VideoPlayer } from './video-player';
import { VideoEmbed } from './video-embed';
import { Accordion } from './accordion';
import { Tabs } from './tabs';
import { CardGrid } from './card-grid';
import { ContentFeed } from './content-feed';
import { QuoteBlock } from './quote-block';
import { HtmlBlock } from './html-block';
import { CardItem } from './card-item';
import type { TextBlockProps, TextBlockContent } from './text-block/text-block.types';
import type { TwoColumnProps, TwoColumnContent } from './two-column/two-column.types';
import type { ImageGalleryProps, ImageGalleryContent, GalleryImage } from './image-gallery/image-gallery.types';
import type { VideoPlayerProps, VideoPlayerContent } from './video-player/video-player.types';
import type { VideoEmbedProps, VideoEmbedContent } from './video-embed/video-embed.types';
import type { AccordionContent } from './accordion/accordion.types';
import type { TabsContent } from './tabs/tabs.types';
import type { CardGridContent } from './card-grid/card-grid.types';
import type { ContentFeedContent, ContentFeedProps } from './content-feed/content-feed.types';
import type { QuoteBlockContent } from './quote-block/quote-block.types';
import type { HtmlBlockProps, HtmlBlockContent } from './html-block/html-block.types';
import type { CardItemProps, CardItemContent } from './card-item/card-item.types';

/**
 * TextBlock Adapter Component
 * Transforms generic CMSComponentProps to TextBlockProps
 */
export const TextBlockAdapter: React.FC<CMSComponentProps> = (props) => {
  const raw = readRuntimeContent(props.content);
  const adaptedProps: TextBlockProps = {
    ...props,
    content: raw as TextBlockContent
  };
  return <TextBlock {...adaptedProps} />;
};

/**
 * TwoColumn Adapter Component
 * Transforms generic CMSComponentProps to TwoColumnProps
 */
export const TwoColumnAdapter: React.FC<CMSComponentProps> = (props) => {
  const raw = readRuntimeContent<TwoColumnContent>(props.content);

  const adaptedProps: TwoColumnProps = {
    ...props,
    content: raw as TwoColumnContent
  };
  return <TwoColumn {...adaptedProps} />;
};

/**
 * ImageGallery Adapter Component
 * Transforms generic CMSComponentProps to ImageGalleryProps
 */
export const ImageGalleryAdapter: React.FC<CMSComponentProps> = (props) => {
  const rawContent = readRuntimeContent<ImageGalleryContent>(props.content) as
    | Partial<ImageGalleryContent>
    | undefined;
  const source = rawContent ?? {};

  const rawImages = Array.isArray((source as { images?: unknown }).images)
    ? ((source as { images?: unknown }).images as unknown[])
    : [];

  const images = rawImages
    .map((entry): GalleryImage | null => {
      if (!entry || typeof entry !== 'object') {
        return null;
      }

      const record = entry as Record<string, unknown>;
      const primaryUrl =
        (record.url as string | Record<string, unknown> | null | undefined) ??
        undefined;
      const secondaryUrl =
        (record.src as string | Record<string, unknown> | null | undefined) ??
        undefined;
      const urlInput =
        (primaryUrl ?? secondaryUrl) ??
        (record as Record<string, unknown>);
      const resolvedUrl = validateImageUrl(urlInput);

      if (!resolvedUrl) {
        return null;
      }

      const altValue = record.alt ?? record.title ?? record.name ?? '';
      const captionValue = record.caption ?? record.description ?? record.subtitle;
      const widthValue = record.width ?? record.imageWidth ?? record.originalWidth;
      const heightValue = record.height ?? record.imageHeight ?? record.originalHeight;

      const mediaId =
        typeof record.mediaId === 'string'
          ? record.mediaId
          : record.url && typeof record.url === 'object'
            ? (() => {
                const nested = record.url as Record<string, unknown>;
                return typeof nested.mediaId === 'string' ? nested.mediaId : undefined;
              })()
            : undefined;

      return {
        url: resolvedUrl,
        alt: typeof altValue === 'string' ? altValue : '',
        caption: typeof captionValue === 'string' ? captionValue : undefined,
        width: typeof widthValue === 'number' ? widthValue : undefined,
        height: typeof heightValue === 'number' ? heightValue : undefined,
        ...(mediaId ? { mediaId } : {})
      };
    })
    .filter((image): image is GalleryImage => image !== null);

  const content: ImageGalleryContent = {
    ...source,
    images
  } as ImageGalleryContent;

  const adaptedProps: ImageGalleryProps = {
    ...props,
    content
  };
  return <ImageGallery {...adaptedProps} />;
};

/**
 * VideoPlayer Adapter Component
 * Transforms generic CMSComponentProps to VideoPlayerProps
 */
export const VideoPlayerAdapter: React.FC<CMSComponentProps> = (props) => {
  const raw = readRuntimeContent(props.content);
  const adaptedProps: VideoPlayerProps = {
    ...props,
    content: raw as VideoPlayerContent
  };
  return <VideoPlayer {...adaptedProps} />;
};

/**
 * VideoEmbed Adapter Component
 * Transforms generic CMSComponentProps to VideoEmbedProps
 */
export const VideoEmbedAdapter: React.FC<CMSComponentProps> = (props) => {
  const raw = readRuntimeContent(props.content);
  const adaptedProps: VideoEmbedProps = {
    ...props,
    content: raw as VideoEmbedContent
  };
  return <VideoEmbed {...adaptedProps} />;
};

// ---------------------------------------------------------------------------
// Additional content adapters merged from part2
// ---------------------------------------------------------------------------

export const AccordionAdapter: React.FC<CMSComponentProps> = (props) => {
  if (props.type !== ComponentType.Accordion) {
    throw new Error(`Invalid component type: expected ${ComponentType.Accordion}, got ${props.type}`);
  }
  const accordionContent = readRuntimeContent<AccordionContent>(props.content) as AccordionContent;

  const interactionHandlers =
    typeof props.onInteraction === 'function'
      ? {
          onItemToggle: (itemId: string, isOpen: boolean) => {
            props.onInteraction?.('item-toggle', { itemId, isOpen });
          },
          onAllToggle: (allOpen: boolean) => {
            props.onInteraction?.('all-toggle', { allOpen });
          }
        }
      : {};

  return React.createElement(Accordion, {
    id: props.id,
    type: props.type ?? ComponentType.Accordion,
    category: props.category ?? ComponentCategory.Content,
    content: accordionContent,
    className: props.className,
    style: props.style,
    theme: props.theme,
    analytics: props.analytics,
    animated: props.interactive,
    ...interactionHandlers
  });
};

export const TabsAdapter: React.FC<CMSComponentProps> = (props) => {
  if (props.type !== ComponentType.Tabs) {
    throw new Error(`Invalid component type: expected ${ComponentType.Tabs}, got ${props.type}`);
  }
  const tabsContent = readRuntimeContent<TabsContent>(props.content) as TabsContent;
  const interactionHandlers =
    typeof props.onInteraction === 'function'
      ? {
          onTabChange: (tabId: string) => {
            props.onInteraction?.('tab-change', { tabId });
          }
        }
      : {};

  return React.createElement(Tabs, {
    id: props.id,
    type: props.type ?? ComponentType.Tabs,
    category: props.category ?? ComponentCategory.Content,
    content: tabsContent,
    className: props.className,
    style: props.style,
    theme: props.theme,
    analytics: props.analytics,
    animated: props.interactive,
    ...interactionHandlers
  });
};

export const CardGridAdapter: React.FC<CMSComponentProps> = (props) => {
  if (props.type !== ComponentType.CardGrid) {
    throw new Error(`Invalid component type: expected ${ComponentType.CardGrid}, got ${props.type}`);
  }
  const cardGridContent = readRuntimeContent<CardGridContent>(props.content) as CardGridContent;
  const onCardClick =
    typeof props.onInteraction === 'function'
      ? (cardId: string) => {
          props.onInteraction?.('card-click', { cardId });
        }
      : undefined;

  const cardGridVariant = props.variant === 'segmented' ? undefined : props.variant as "default" | "minimal" | "expanded" | "compact" | "detailed" | undefined;

  return React.createElement(CardGrid, {
    content: cardGridContent,
    className: props.className,
    theme: props.theme,
    variant: cardGridVariant,
    hover: props.interactive,
    onCardClick
  });
};

export const ContentFeedAdapter: React.FC<CMSComponentProps> = (props) => {
  const raw = readRuntimeContent<ContentFeedContent>(props.content);
  const { variant, onInteraction, ...restProps } = props;

  // Adapt onInteraction to match ContentFeedProps signature
  const adaptedOnInteraction = onInteraction
    ? (event: { type: string; itemId?: string; href?: string }) => {
        onInteraction(event.type, { itemId: event.itemId, href: event.href });
      }
    : undefined;

  const adaptedProps: ContentFeedProps = {
    ...restProps,
    variant: variant as "default" | "minimal" | undefined,
    onInteraction: adaptedOnInteraction,
    type: ComponentType.ContentFeed,
    category: ComponentCategory.Content,
    content: {
      layout: 'card-grid',
      limit: 10,
      sorting: { field: 'publishDate', direction: 'desc' },
      ...(raw || {})
    }
  };

  return <ContentFeed {...adaptedProps} />;
};

export const QuoteBlockAdapter: React.FC<CMSComponentProps> = (props) => {
  if (props.type !== ComponentType.QuoteBlock) {
    throw new Error(`Invalid component type: expected ${ComponentType.QuoteBlock}, got ${props.type}`);
  }
  const quoteBlockContent = readRuntimeContent<QuoteBlockContent>(props.content) as QuoteBlockContent;
  const onShare =
    typeof props.onInteraction === 'function'
      ? (platform: string) => {
          props.onInteraction?.('share', { platform });
        }
      : undefined;

  const quoteVariant = props.variant === 'segmented' ? undefined : props.variant as "default" | "minimal" | "expanded" | "compact" | "detailed" | undefined;

  return React.createElement(QuoteBlock, {
    content: quoteBlockContent,
    className: props.className,
    theme: props.theme,
    variant: quoteVariant,
    animated: props.interactive,
    onShare
  });
};

/**
 * HtmlBlock Adapter Component
 * Transforms generic CMSComponentProps to HtmlBlockProps
 */
export const HtmlBlockAdapter: React.FC<CMSComponentProps> = (props) => {
  const raw = readRuntimeContent(props.content);
  const adaptedProps: HtmlBlockProps = {
    ...props,
    content: raw as HtmlBlockContent
  };
  return <HtmlBlock {...adaptedProps} />;
};

/**
 * CardItem Adapter Component
 * Transforms generic CMSComponentProps to CardItemProps
 *
 * CardItem is used as a standalone component in two-column layouts
 * and other containers where individual cards are needed.
 */
export const CardItemAdapter: React.FC<CMSComponentProps> = (props) => {
  const content = readRuntimeContent<CardItemContent>(props.content) as CardItemContent;

  const adaptedProps: CardItemProps = {
    ...props,
    content,
    theme: props.theme,
    variant: props.variant as CardItemProps['variant']
  };

  return <CardItem {...adaptedProps} />;
};
