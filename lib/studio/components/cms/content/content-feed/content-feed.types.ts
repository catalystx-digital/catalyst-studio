import type { ComponentCategory, ComponentContent, ComponentTheme, CMSComponentProps } from '../../_core/types';
import type { SmartLink } from '../../_core/value-objects';

export type ContentFeedLayout = 'list' | 'card-grid';

export type ContentFeedSortingField = 'createdAt' | 'updatedAt' | 'publishDate' | (string & {});

export interface ContentFeedSorting {
  field: ContentFeedSortingField;
  direction?: 'asc' | 'desc';
}

export interface ContentFeedPagination {
  pageSize: number;
  currentPage?: number;
}

export interface ContentFeedSource {
  contentTypes?: string[];
  tags?: string[];
  categories?: string[];
  path?: string;
  pathPrefix?: string;
  ancestor?: string;
  ancestorId?: string;
  includeDescendants?: boolean;
  locale?: string;
  site?: string;
  siteId?: string;
}

export interface ContentFeedImage {
  src: string;
  alt?: string;
  renditions?: Array<{
    src?: string;
    width?: number | null;
    height?: number | null;
  }>;
  originalUrl?: string;
  [key: string]: unknown;
}

export interface ContentFeedItem extends ComponentContent {
  id?: string;
  slug?: string;
  title?: string;
  summary?: string;
  excerpt?: string;
  description?: string;
  href?: SmartLink | string;
  url?: string;
  image?: ContentFeedImage | string;
  date?: string;
  category?: string;
  tags?: string[];
  categories?: string[];
  publishDate?: string;
  updatedAt?: string;
  createdAt?: string;
  popularity?: number;
  metadata?: {
    publishDate?: string;
    updatedAt?: string;
    createdAt?: string;
    tags?: string[];
    categories?: string[];
    locale?: string;
    [key: string]: unknown;
  };
}

export interface ContentFeedContent extends ComponentContent {
  heading?: string;
  subheading?: string;
  layout?: ContentFeedLayout;
  limit?: number;
  pagination?: ContentFeedPagination;
  sorting?: ContentFeedSorting;
  emptyCopy?: string;
  pinned?: ContentFeedItem[];
  source?: ContentFeedSource;
}

export interface ContentFeedProps extends Omit<CMSComponentProps, 'onInteraction'> {
  category: ComponentCategory.Content;
  content: ContentFeedContent;
  theme?: ComponentTheme;
  variant?: 'default' | 'minimal';
  onItemClick?: (itemId: string, item: ContentFeedItem | NormalizedContentFeedItem) => void;
  onInteraction?: (event: { type: string; itemId?: string; href?: string }) => void;
}

export interface NormalizedContentFeedItem {
  id: string;
  title: string;
  summary?: string;
  href?: string;
  image?: ContentFeedImage;
  tags: string[];
  categories: string[];
  publishDate?: string;
  updatedAt?: string;
  createdAt?: string;
  isPinned?: boolean;
}

export interface ResolvedContentFeed {
  items: NormalizedContentFeedItem[];
  pinned: NormalizedContentFeedItem[];
  error?: string;
  total?: number;
  page?: {
    currentPage: number;
    pageSize: number;
  };
}
