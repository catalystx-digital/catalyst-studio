import { ContentResource, type ContentFeedFilters, type ContentQuery, type ContentFeedProvider, getContentProvider } from '../../_core/data-providers';
import { validateImageUrl } from '../../_utils/url-validation';
import type {
  ContentFeedContent,
  ContentFeedItem,
  ContentFeedSorting,
  NormalizedContentFeedItem,
  ResolvedContentFeed,
} from './content-feed.types';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function normalizeString(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function normalizeArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map(entry => normalizeString(entry))
    .filter((entry): entry is string => Boolean(entry));
}

/**
 * Checks if value is a nested media object: { src: "url", mediaId?, renditions?, ... }
 * This structure comes from runtime-media-resolver when mediaId references are resolved.
 */
function isNestedMediaSrc(
  value: unknown
): value is { src: string; mediaId?: string; originalUrl?: string; renditions?: unknown[] } {
  return (
    isRecord(value) &&
    typeof (value as Record<string, unknown>).src === 'string'
  );
}

function normalizeImage(value: unknown) {
  if (!value) {
    return undefined;
  }

  if (typeof value === 'string') {
    const src = validateImageUrl(value);
    return src ? { src } : undefined;
  }

  if (!isRecord(value)) {
    return undefined;
  }

  // Handle nested media object: image.src = { src: "url", mediaId, originalUrl, renditions }
  // This structure comes from runtime-media-resolver when mediaId references are resolved
  let resolvedSrc: string | undefined;
  let resolvedOriginalUrl: string | undefined;
  let sourceRenditions: unknown[] | undefined;

  if (typeof value.src === 'string') {
    // Direct string src
    resolvedSrc = validateImageUrl(value.src);
    resolvedOriginalUrl = normalizeString(value.originalUrl);
    sourceRenditions = value.renditions as unknown[] | undefined;
  } else if (isNestedMediaSrc(value.src)) {
    // Nested object: image.src = { src: "url", mediaId: "...", originalUrl: "...", renditions: [...] }
    resolvedSrc = validateImageUrl(value.src.src);
    resolvedOriginalUrl = normalizeString(value.src.originalUrl) ?? normalizeString(value.originalUrl);
    sourceRenditions = Array.isArray(value.src.renditions)
      ? value.src.renditions
      : (value.renditions as unknown[] | undefined);
  }

  if (!resolvedSrc) {
    return undefined;
  }

  const renditions = Array.isArray(sourceRenditions)
    ? sourceRenditions
        .map(entry => {
          if (!isRecord(entry)) return null;
          const renditionSrc = validateImageUrl(entry.src as string | undefined);
          if (!renditionSrc) return null;
          return {
            src: renditionSrc,
            width: typeof entry.width === 'number' ? entry.width : null,
            height: typeof entry.height === 'number' ? entry.height : null,
          };
        })
        .filter((entry): entry is { src: string; width: number | null; height: number | null } =>
          Boolean(entry),
        )
    : undefined;

  return {
    src: resolvedSrc,
    alt: normalizeString(value.alt),
    originalUrl: resolvedOriginalUrl,
    ...(renditions && renditions.length > 0 ? { renditions } : {}),
  };
}

function resolveItemKey(item: ContentFeedItem, index: number): string {
  const candidates = [
    normalizeString(item.id),
    normalizeString(item.slug),
    normalizeString(item.href),
    normalizeString(item.url),
    normalizeString(item.title),
  ];

  for (const candidate of candidates) {
    if (candidate) {
      return candidate;
    }
  }

  return `content-feed-item-${index}`;
}

function normalizeItem(item: ContentFeedItem, index: number, isPinned = false): NormalizedContentFeedItem | null {
  const id = resolveItemKey(item, index);
  const title = normalizeString(item.title) ?? 'Untitled';
  const summary =
    normalizeString(item.summary) ?? normalizeString(item.excerpt) ?? normalizeString(item.description);
  const href = normalizeString(item.href) ?? normalizeString(item.url);

  const tags = normalizeArray(item.tags ?? item.metadata?.tags);
  const categories = normalizeArray(item.categories ?? item.metadata?.categories);

  const publishDate =
    normalizeString(item.publishDate) ??
    normalizeString(item.metadata?.publishDate) ??
    normalizeString(item.metadata?.date);
  const updatedAt = normalizeString(item.updatedAt) ?? normalizeString(item.metadata?.updatedAt);
  const createdAt = normalizeString(item.createdAt) ?? normalizeString(item.metadata?.createdAt);

  const image = normalizeImage(item.image);

  return {
    id,
    title,
    summary,
    href,
    image,
    tags,
    categories,
    publishDate,
    updatedAt,
    createdAt,
    isPinned,
  };
}

function dedupeItems(items: NormalizedContentFeedItem[]): NormalizedContentFeedItem[] {
  const seen = new Set<string>();
  const result: NormalizedContentFeedItem[] = [];

  for (const item of items) {
    if (seen.has(item.id)) {
      continue;
    }
    seen.add(item.id);
    result.push(item);
  }

  return result;
}

function parseDate(value: string | undefined): number | null {
  if (!value) {
    return null;
  }
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
}

function sortItems(
  items: NormalizedContentFeedItem[],
  sorting: ContentFeedSorting,
): NormalizedContentFeedItem[] {
  const direction = sorting.direction === 'asc' ? 1 : -1;
  const field = sorting.field ?? 'publishDate';

  return [...items].sort((a, b) => {
    if (a.isPinned !== b.isPinned) {
      return a.isPinned ? -1 : 1;
    }

    const resolveFieldValue = (item: NormalizedContentFeedItem): number => {
      const target =
        field === 'updatedAt'
          ? parseDate(item.updatedAt) ?? parseDate(item.publishDate) ?? parseDate(item.createdAt)
          : field === 'createdAt'
            ? parseDate(item.createdAt) ?? parseDate(item.publishDate) ?? parseDate(item.updatedAt)
            : parseDate(item.publishDate) ?? parseDate(item.createdAt) ?? parseDate(item.updatedAt);

      return target ?? 0;
    };

    const aValue = resolveFieldValue(a);
    const bValue = resolveFieldValue(b);

    if (aValue === bValue) {
      return a.id.localeCompare(b.id);
    }

    return (aValue - bValue) * direction;
  });
}

function applyPagination(
  items: NormalizedContentFeedItem[],
  pagination?: ContentFeedContent['pagination'],
  fallbackLimit?: number,
): { pageItems: NormalizedContentFeedItem[]; pageSize: number; currentPage: number } {
  const pageSize = pagination?.pageSize ?? fallbackLimit ?? 10;
  const currentPage = pagination?.currentPage && pagination.currentPage > 0 ? pagination.currentPage : 1;

  if (!pagination) {
    return { pageItems: items.slice(0, pageSize), pageSize, currentPage: 1 };
  }

  const start = (currentPage - 1) * pageSize;
  return {
    pageItems: items.slice(start, start + pageSize),
    pageSize,
    currentPage,
  };
}

export function resolveContentFeed(content: ContentFeedContent): ResolvedContentFeed {
  const source = isRecord(content.source) ? (content.source as ContentFeedContent['source']) : undefined;
  const sorting: ContentFeedSorting = {
    field: content.sorting?.field ?? 'publishDate',
    direction: content.sorting?.direction ?? 'desc',
  };
  const userLimit = typeof content.limit === 'number' && content.limit > 0 ? content.limit : 10;
  const pagination = content.pagination && typeof content.pagination === 'object' ? content.pagination : undefined;

  const pinnedCandidates = Array.isArray(content.pinned) ? content.pinned : [];
  const normalizedPinned = pinnedCandidates
    .map((item, index) => normalizeItem(item, index, true))
    .filter((item): item is NormalizedContentFeedItem => Boolean(item));

  const pinnedKeys = new Set(normalizedPinned.map(item => item.id));

  const provider = getContentProvider<ContentFeedItem, ContentFeedFilters>(
    ContentResource.ContentFeed,
  ) as ContentFeedProvider | undefined;

  let fetched: NormalizedContentFeedItem[] = [];
  let total: number | undefined;
  let error: string | undefined;

  if (provider && source) {
    const desired = pagination
      ? Math.max(pagination.pageSize * ((pagination.currentPage && pagination.currentPage > 0 ? pagination.currentPage : 1)), userLimit)
      : userLimit + normalizedPinned.length;

    const query: ContentQuery<ContentFeedFilters> = {
      limit: desired,
      filters: {
        contentTypes: source.contentTypes,
        tags: source.tags,
        categories: source.categories,
        ancestorId: source.ancestorId,
        pathPrefix: source.pathPrefix,
        includeDescendants: source.includeDescendants ?? true,
        locale: source.locale,
        siteId: source.siteId,
        excludeIds: Array.from(pinnedKeys),
        sortField: sorting.field,
      },
      sort: [{ field: sorting.field, direction: sorting.direction }],
      page: pagination
        ? {
            size: desired,
            index: 1,
          }
        : undefined,
    };

    try {
      const result = provider.fetch(query);
      fetched = Array.isArray(result.items)
        ? result.items
            .map((item, index) => normalizeItem(item as ContentFeedItem, index + normalizedPinned.length, false))
            .filter((item): item is NormalizedContentFeedItem => Boolean(item))
        : [];
      total = typeof result.total === 'number' ? result.total : undefined;
    } catch (err) {
      error = err instanceof Error ? err.message : 'Unable to load content feed items.';
    }
  }

  const merged = dedupeItems([...normalizedPinned, ...fetched]);
  const sorted = sortItems(merged, sorting);
  const { pageItems, pageSize, currentPage } = applyPagination(sorted, pagination, userLimit);

  const pinnedOnPage = pageItems.filter(item => item.isPinned);

  return {
    items: pageItems,
    pinned: pinnedOnPage,
    error,
    total: total ?? merged.length,
    page: {
      currentPage,
      pageSize,
    },
  };
}
