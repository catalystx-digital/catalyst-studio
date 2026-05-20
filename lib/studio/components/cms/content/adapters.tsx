/**
 * Adapter components that wrap content components to make them compatible
 * with the CMS component factory's type requirements.
 * 
 * These adapters convert generic CMSComponentProps to specific component props.
 * CRITICAL: This pattern is required to avoid TypeScript compilation errors.
 */

import React from 'react';
import { ComponentType, ComponentCategory } from '../_core/types';
import { normalizeContentInput, generateComponentId } from '../_core/utils';
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
  const raw = normalizeContentInput(props.content);
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
  const raw = normalizeContentInput<TwoColumnContent>(props.content) as any;

  // Build slots if not present from legacy left/right columns
  let areas = raw?.areas as TwoColumnContent['areas'] | undefined;
  const mapLegacyToChild = (col: any): CMSComponentProps | null => {
    if (!col || typeof col !== 'object') return null;
    switch (col.type) {
      case 'text':
        return {
          id: generateComponentId(ComponentType.TextBlock),
          type: ComponentType.TextBlock,
          category: ComponentCategory.Content,
          content: { heading: col.heading, body: col.body }
        };
      case 'image':
        if (!col.imageUrl) return null;
        return {
          id: generateComponentId(ComponentType.ImageGallery),
          type: ComponentType.ImageGallery,
          category: ComponentCategory.Content,
          content: {
            images: [ { url: col.imageUrl, alt: col.imageAlt || '' } ],
            displayMode: 'grid',
            columns: 1
          }
        } as any;
      case 'video':
        if (!col.videoUrl) return null;
        return {
          id: generateComponentId(ComponentType.VideoPlayer),
          type: ComponentType.VideoPlayer,
          category: ComponentCategory.Content,
          content: {
            sources: [{ url: col.videoUrl, type: 'mp4' }],
            controls: true
          }
        } as any;
      default:
        return null;
    }
  };

  if (!areas) {
    const left = raw?.leftColumn;
    const right = raw?.rightColumn;
    const leftArray = Array.isArray(left) ? left : left ? [left] : [];
    const rightArray = Array.isArray(right) ? right : right ? [right] : [];
    const leftChildren = leftArray.map(mapLegacyToChild).filter(Boolean) as CMSComponentProps[];
    const rightChildren = rightArray.map(mapLegacyToChild).filter(Boolean) as CMSComponentProps[];
    if (leftChildren.length || rightChildren.length) {
      areas = { left: leftChildren, right: rightChildren };
    }
  }

  const adaptedProps: TwoColumnProps = {
    ...props,
    content: {
      ...(raw || {}),
      ...(areas ? { areas } : {})
    } as TwoColumnContent
  };
  return <TwoColumn {...adaptedProps} />;
};

/**
 * ImageGallery Adapter Component
 * Transforms generic CMSComponentProps to ImageGalleryProps
 */
export const ImageGalleryAdapter: React.FC<CMSComponentProps> = (props) => {
  const rawContent = normalizeContentInput<ImageGalleryContent>(props.content) as
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
  const raw = normalizeContentInput(props.content);
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
  const raw = normalizeContentInput(props.content);
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
  const raw = normalizeContentInput<AccordionContent>(props.content) as any;

  // Build areas.items if not present from legacy items
  let areas = raw?.areas as AccordionContent['areas'] | undefined;
  if (!areas) {
    const legacyItems = Array.isArray(raw?.items) ? raw.items : [];
    const children = legacyItems.map((it: any) => ({
      id: it.id || generateComponentId(ComponentType.AccordionItem),
      type: ComponentType.AccordionItem,
      category: ComponentCategory.Content,
      content: {
        title: it.title,
        content: it.content,
        icon: it.icon,
        defaultOpen: it.defaultOpen
      }
    })) as CMSComponentProps[];
    if (children.length) areas = { items: children };
  }

  const accordionContent: AccordionContent = {
    ...(raw || {}),
    ...(areas ? { areas } : {})
  } as AccordionContent;

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
  const raw = normalizeContentInput<TabsContent>(props.content) as any;

  let areas = raw?.areas as TabsContent['areas'] | undefined;
  if (!areas) {
    const legacyItems = Array.isArray(raw?.tabs) ? raw.tabs : [];
    const children = legacyItems.map((it: any) => ({
      id: it.id || generateComponentId(ComponentType.TabItem),
      type: ComponentType.TabItem,
      category: ComponentCategory.Content,
      content: {
        label: it.label,
        content: it.content,
        icon: it.icon,
        disabled: it.disabled,
        badge: it.badge
      }
    })) as CMSComponentProps[];
    if (children.length) areas = { items: children };
  }

  const tabsContent: TabsContent = {
    ...(raw || {}),
    ...(areas ? { areas } : {})
  } as TabsContent;
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
  // Normalize and coerce legacy shapes to the current CardGridContent/CardItem model
  const raw = normalizeContentInput<CardGridContent>(props.content) as any;

  type CardAction = NonNullable<CardGridContent['cards'][number]['actions']>[number];

  const coerceActions = (btn: any): CardAction | null => {
    if (!btn || typeof btn !== 'object') return null;
    const label = btn.label ?? btn.title ?? '';
    const url = btn.href ?? '';
    const variantValue = (btn.variant ?? btn.style ?? 'primary') as CardAction['variant'];
    if (!label && !url) return null;
    const action: CardAction = { label, url, variant: variantValue };
    return action;
  };

  const coerceCardItem = (item: any) => {
    if (!item || typeof item !== 'object') return item;
    let next: any = { ...item };

    if (next && typeof next.content === 'object' && !Array.isArray(next.content)) {
      const inner = next.content as Record<string, any>;
      delete next.content;
      next = { ...inner, ...next };
      if (!next.title && typeof inner.title === 'string') next.title = inner.title;
      if (!next.description && typeof inner.description === 'string') next.description = inner.description;
      if (!next.description && typeof inner.summary === 'string') next.description = inner.summary;
      if (!next.link && typeof inner.href === 'string') next.link = inner.href;
      if (!next.link && typeof inner.url === 'string') next.link = inner.url;
      if (!next.linkText && typeof inner.linkText === 'string') next.linkText = inner.linkText;
      if (!next.image && inner.image) next.image = inner.image;
      if (!next.badge && typeof inner.badge === 'string') next.badge = inner.badge;
      if (!next.icon && typeof inner.icon === 'string') next.icon = inner.icon;
      if (!next.variant && typeof inner.variant === 'string') next.variant = inner.variant;
      if (!next.imageAlt && typeof inner.imageAlt === 'string') next.imageAlt = inner.imageAlt;
    }

    if (!next.title && typeof next.heading === 'string') next.title = next.heading;
    if (!next.description && typeof next.body === 'string') next.description = next.body;
    if (!next.link && typeof next.href === 'string') next.link = next.href;
    if (!next.link && typeof next.url === 'string') next.link = next.url;
    if (!next.linkText && typeof next.ctaText === 'string') next.linkText = next.ctaText;

    // imageUrl -> image
    if (!next.image && typeof next.imageUrl === 'string') next.image = next.imageUrl;
    // linkUrl -> link
    if (!next.link && typeof next.linkUrl === 'string') next.link = next.linkUrl;
    // CTA buttons -> actions (array)
    if (!Array.isArray(next.actions)) {
      const ctas = Array.isArray(next.ctaButtons)
        ? next.ctaButtons
        : next.ctaButtons && typeof next.ctaButtons === 'object'
          ? [next.ctaButtons]
          : [];
      const mapped = ctas
        .map(coerceActions)
        .filter((action: CardAction | null): action is CardAction => Boolean(action));
      if (mapped.length) next.actions = mapped;
    } else {
      // Normalize existing actions
      next.actions = next.actions
        .map((a: any) => coerceActions(a))
        .filter((action: CardAction | null): action is CardAction => Boolean(action));
    }

    const metadata = { ...(next.metadata ?? {}) };
    // Skip structural subcomponent types when extracting category metadata
    const STRUCTURAL_TYPES = new Set(['card-item', 'promo-item', 'feature-item', 'blog-card', 'testimonial-item']);
    const nestedCategory = item && typeof item === 'object' && item.content && typeof item.content === 'object' && typeof (item.content as Record<string, any>).type === 'string'
      ? (item.content as Record<string, any>).type as string
      : undefined;
    const categoryCandidate =
      typeof next.type === 'string' && !STRUCTURAL_TYPES.has(next.type)
        ? next.type
        : (nestedCategory && !STRUCTURAL_TYPES.has(nestedCategory) ? nestedCategory : undefined);
    if (!metadata.category && typeof categoryCandidate === 'string') {
      metadata.category = categoryCandidate;
    }
    const dateCandidate = next.dates ?? next.date;
    if (!metadata.date && typeof dateCandidate === 'string') {
      metadata.date = dateCandidate;
    }
    if (!metadata.author && typeof next.author === 'string') {
      metadata.author = next.author;
    }
    if (typeof next.location === 'string') {
      const tags = Array.isArray(metadata.tags) ? [...metadata.tags] : [];
      if (!tags.includes(next.location)) {
        tags.push(next.location);
      }
      if (tags.length > 0) {
        metadata.tags = tags;
      }
    }
    if (Object.keys(metadata).length > 0) {
      next.metadata = metadata;
    }

    if (!next.imageAlt && next.image && typeof next.image === 'object' && typeof next.image.alt === 'string') {
      next.imageAlt = next.image.alt;
    }

    return next;
  };

  const cardGridContent: CardGridContent = {
    ...(raw || {}),
    cards: Array.isArray(raw?.cards) ? raw.cards.map(coerceCardItem) : []
  } as CardGridContent;
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
  const raw = normalizeContentInput<ContentFeedContent>(props.content);
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
  const quoteBlockContent = normalizeContentInput<QuoteBlockContent>(props.content) as QuoteBlockContent;
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
  const raw = normalizeContentInput(props.content);
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
  const raw = normalizeContentInput<CardItemContent>(props.content) as any;

  // Normalize the content structure
  let content: CardItemContent = raw || { title: '' };

  // Handle nested content structure from import
  if (raw && typeof raw.content === 'object' && !Array.isArray(raw.content)) {
    const inner = raw.content as Record<string, any>;
    content = {
      title: inner.title || raw.title || '',
      description: inner.description || inner.summary || raw.description || '',
      image: inner.image || raw.image,
      imageAlt: inner.imageAlt || raw.imageAlt,
      link: inner.link || inner.href || inner.url || raw.link,
      linkText: inner.linkText || raw.linkText,
      badge: inner.badge || raw.badge,
      icon: inner.icon || raw.icon,
      metadata: inner.metadata || raw.metadata,
      actions: inner.actions || raw.actions
    };
  }

  // Coerce legacy field names
  if (!content.title && raw?.heading) content.title = raw.heading;
  if (!content.description && raw?.body) content.description = raw.body;
  if (!content.link && raw?.href) content.link = raw.href;
  if (!content.link && raw?.url) content.link = raw.url;
  if (!content.linkText && raw?.ctaText) content.linkText = raw.ctaText;
  if (!content.image && raw?.imageUrl) content.image = raw.imageUrl;

  const adaptedProps: CardItemProps = {
    ...props,
    content,
    theme: props.theme,
    variant: props.variant as CardItemProps['variant']
  };

  return <CardItem {...adaptedProps} />;
};
