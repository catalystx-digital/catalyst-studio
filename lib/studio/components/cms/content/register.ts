/**
 * Component registration module for content display components.
 * 
 * CRITICAL: This module registers adapter components (NOT direct components)
 * with the factory to ensure TypeScript compatibility.
 */

import { cmsComponentFactory } from '../_factory/factory';
import { ComponentType } from '../_core/types';
import {
  TextBlockAdapter,
  TwoColumnAdapter,
  ImageGalleryAdapter,
  VideoPlayerAdapter,
  VideoEmbedAdapter,
  AccordionAdapter,
  TabsAdapter,
  CardGridAdapter,
  ContentFeedAdapter,
  QuoteBlockAdapter,
  HtmlBlockAdapter,
  CardItemAdapter
} from './adapters';
import { detectionToAIMetadata } from '../_core/component-definition';
import { TextBlockDef } from './text-block/text-block.def';
import { TwoColumnDef } from './two-column/two-column.def';
import { ImageGalleryDef } from './image-gallery/image-gallery.def';
import { VideoPlayerDef } from './video-player/video-player.def';
import { VideoEmbedDef } from './video-embed/video-embed.def';
import { AccordionDef } from './accordion/accordion.def';
import { TabsDef } from './tabs/tabs.def';
import { CardGridDef } from './card-grid/card-grid.def';
import { ContentFeedDef } from './content-feed/content-feed.def';
import { QuoteBlockDef } from './quote-block/quote-block.def';
import { HtmlBlockDef } from './html-block/html-block.def';
import { CardItemDef } from './card-item/card-item.def';

/**
 * Register all content display component adapters with the factory.
 * Using adapters ensures type safety and prevents TypeScript compilation errors.
 */
export function registerContentComponents(): void {
  // Register TextBlock adapter
  cmsComponentFactory.registerComponent(
    ComponentType.TextBlock,
    TextBlockAdapter,
    detectionToAIMetadata(TextBlockDef.detection!, ComponentType.TextBlock),
    { description: TextBlockDef.description, schema: TextBlockDef.schema }
  );

  // Register TwoColumn adapter
  cmsComponentFactory.registerComponent(
    ComponentType.TwoColumn,
    TwoColumnAdapter,
    detectionToAIMetadata(TwoColumnDef.detection!, ComponentType.TwoColumn),
    { description: TwoColumnDef.description, schema: TwoColumnDef.schema }
  );

  // Register ImageGallery adapter
  cmsComponentFactory.registerComponent(
    ComponentType.ImageGallery,
    ImageGalleryAdapter,
    detectionToAIMetadata(ImageGalleryDef.detection!, ComponentType.ImageGallery),
    { description: ImageGalleryDef.description, schema: ImageGalleryDef.schema }
  );

  // Register VideoPlayer adapter
  cmsComponentFactory.registerComponent(
    ComponentType.VideoPlayer,
    VideoPlayerAdapter,
    detectionToAIMetadata(VideoPlayerDef.detection!, ComponentType.VideoPlayer),
    { description: VideoPlayerDef.description, schema: VideoPlayerDef.schema }
  );

  // Register VideoEmbed adapter
  cmsComponentFactory.registerComponent(
    ComponentType.VideoEmbed,
    VideoEmbedAdapter,
    detectionToAIMetadata(VideoEmbedDef.detection!, ComponentType.VideoEmbed),
    { description: VideoEmbedDef.description, schema: VideoEmbedDef.schema }
  );

  // Register Accordion adapter
  cmsComponentFactory.registerComponent(
    ComponentType.Accordion,
    AccordionAdapter,
    detectionToAIMetadata(AccordionDef.detection!, ComponentType.Accordion),
    { description: AccordionDef.description, schema: AccordionDef.schema }
  );

  // Register Tabs adapter
  cmsComponentFactory.registerComponent(
    ComponentType.Tabs,
    TabsAdapter,
    detectionToAIMetadata(TabsDef.detection!, ComponentType.Tabs),
    { description: TabsDef.description, schema: TabsDef.schema }
  );

  // Register CardGrid adapter
  cmsComponentFactory.registerComponent(
    ComponentType.CardGrid,
    CardGridAdapter,
    detectionToAIMetadata(CardGridDef.detection!, ComponentType.CardGrid),
    { description: CardGridDef.description, schema: CardGridDef.schema }
  );

  // Register ContentFeed adapter
  cmsComponentFactory.registerComponent(
    ComponentType.ContentFeed,
    ContentFeedAdapter,
    detectionToAIMetadata(ContentFeedDef.detection!, ComponentType.ContentFeed),
    { description: ContentFeedDef.description, schema: ContentFeedDef.schema }
  );

  // Register QuoteBlock adapter
  cmsComponentFactory.registerComponent(
    ComponentType.QuoteBlock,
    QuoteBlockAdapter,
    detectionToAIMetadata(QuoteBlockDef.detection!, ComponentType.QuoteBlock),
    { description: QuoteBlockDef.description, schema: QuoteBlockDef.schema }
  );

  // Register HtmlBlock adapter
  cmsComponentFactory.registerComponent(
    ComponentType.HtmlBlock,
    HtmlBlockAdapter,
    detectionToAIMetadata(HtmlBlockDef.detection!, ComponentType.HtmlBlock),
    { description: HtmlBlockDef.description, schema: HtmlBlockDef.schema }
  );

  // CardItem - standalone card component for use in two-column and other containers
  cmsComponentFactory.registerComponent(
    ComponentType.CardItem,
    CardItemAdapter,
    detectionToAIMetadata(CardItemDef.detection!, ComponentType.CardItem),
    { description: CardItemDef.description, schema: CardItemDef.schema }
  );

  // AccordionItem and TabItem are no longer separate components - they're defined inline in parent schemas
  // Removed registration for AccordionItem and TabItem sub-components
}

// Auto-register components when module is imported
registerContentComponents();
