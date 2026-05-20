import type { BlogPost } from '../blog/blog-list/blog-list.types';
import type { TeamMemberData } from '../about/team-grid/team-grid.types';

export interface ContentSort {
  field: string;
  direction?: 'asc' | 'desc';
}

export interface ContentQuery<F extends Record<string, unknown> = Record<string, unknown>> {
  filters?: Partial<F>;
  limit?: number;
  offset?: number;
  sort?: ContentSort[];
  page?: {
    size?: number;
    index?: number;
  };
  context?: Record<string, unknown>;
}

export interface ContentResult<TItem> {
  items: TItem[];
  total?: number;
  page?: {
    size: number;
    index: number;
  };
  hasMore?: boolean;
  metadata?: Record<string, unknown>;
}

export interface ContentProvider<TItem, F extends Record<string, unknown> = Record<string, unknown>> {
  fetch(query: ContentQuery<F>): ContentResult<TItem>;
}

export const ContentResource = {
  BlogPosts: 'cms.blog.posts',
  TeamMembers: 'cms.about.team-members',
  ContentFeed: 'cms.content.feed'
} as const;

export type ContentResourceKey = (typeof ContentResource)[keyof typeof ContentResource] | (string & {});

type ProviderEntry = ContentProvider<unknown, Record<string, unknown>>;

const providerRegistry = new Map<ContentResourceKey, ProviderEntry>();

export function registerContentProvider<TItem, F extends Record<string, unknown>>(
  key: ContentResourceKey,
  provider: ContentProvider<TItem, F>
): void {
  providerRegistry.set(key, provider as ProviderEntry);
}

export function getContentProvider<TItem, F extends Record<string, unknown>>(
  key: ContentResourceKey
): ContentProvider<TItem, F> | undefined {
  return providerRegistry.get(key) as ContentProvider<TItem, F> | undefined;
}

export function resetContentProviders(): void {
  providerRegistry.clear();
}

export interface BlogPostFilters extends Record<string, unknown> {
  categories?: string[];
  tags?: string[];
  excludeIds?: string[];
  strategy?: 'latest' | 'category' | 'tag' | 'mixed' | 'related';
  basePostId?: string;
  basePostSlug?: string;
}

export interface TeamMemberFilters extends Record<string, unknown> {
  department?: string;
  role?: string;
  location?: string;
  excludeIds?: string[];
}

export type BlogPostProvider = ContentProvider<BlogPost, BlogPostFilters>;
export type TeamMemberProvider = ContentProvider<TeamMemberData, TeamMemberFilters>;

export interface ContentFeedFilters extends Record<string, unknown> {
  contentTypes?: string[];
  tags?: string[];
  categories?: string[];
  ancestorId?: string;
  pathPrefix?: string;
  includeDescendants?: boolean;
  excludeIds?: string[];
  locale?: string;
  siteId?: string;
  sortField?: 'createdAt' | 'updatedAt' | 'publishDate' | (string & {});
}

export type ContentFeedProvider = ContentProvider<
  Record<string, unknown>,
  ContentFeedFilters
>;
