import { ContentResource, getContentProvider, BlogPostFilters, BlogPostProvider, ContentQuery } from '../../_core/data-providers';
import type { BlogListContent, BlogPost, BlogAutoFillConfig } from '../blog-list/blog-list.types';
import type { RelatedPostsContent, RelatedPost } from '../related-posts/related-posts.types';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function normalizePath(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }

  try {
    const url = new URL(value, 'https://example.com');
    if (value.startsWith('http://') || value.startsWith('https://')) {
      return url.pathname || undefined;
    }
    return value;
  } catch {
    return value.startsWith('/') ? value : `/${value.replace(/^\/+/, '')}`;
  }
}

function slugify(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function stringValue(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function stringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const values = value.filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0);
  return values.length > 0 ? values : undefined;
}

function normalizeAuthor(value: unknown): BlogPost['author'] | undefined {
  if (typeof value === 'string') {
    const name = stringValue(value);
    return name ? { name } : undefined;
  }

  if (!isRecord(value)) {
    return undefined;
  }

  return {
    name: stringValue(value.name),
    avatar: stringValue(value.avatar),
    bio: stringValue(value.bio),
    title: stringValue(value.title),
    url: stringValue(value.url),
  };
}

function normalizeThumbnail(value: unknown): BlogPost['thumbnail'] | undefined {
  if (typeof value === 'string' && value.trim().length > 0) {
    return value;
  }

  if (!isRecord(value)) {
    return undefined;
  }

  return value as BlogPost['thumbnail'];
}

function resolveBlogPost(entry: unknown, index: number): BlogPost | null {
  if (!isRecord(entry)) {
    return null;
  }

  const source = isRecord(entry.content) ? (entry.content as Record<string, unknown>) : entry;
  const title = stringValue(source.title);

  if (!title) {
    return null;
  }

  const href = stringValue(source.href) ?? stringValue(source.url);
  const slug = stringValue(source.slug) ?? stringValue(entry.slug) ?? normalizePath(href) ?? slugify(title) ?? `blog-post-${index}`;
  const id = stringValue(source.id) ?? stringValue(entry.id) ?? slugify(slug) ?? slugify(title) ?? `blog-post-${index}`;
  const categories = stringArray(source.categories) ?? (stringValue(source.category) ? [stringValue(source.category)!] : []);
  const tags = stringArray(source.tags) ?? [];
  const author = normalizeAuthor(source.author) ?? normalizeAuthor(entry.author) ?? {};
  const stats = isRecord(source.stats) ? source.stats : undefined;

  return {
    id,
    title,
    excerpt: stringValue(source.excerpt) ?? '',
    thumbnail: normalizeThumbnail(source.thumbnail) ?? normalizeThumbnail(source.image),
    author,
    publishDate: stringValue(source.publishDate) ?? stringValue(source.date) ?? '',
    updatedDate: stringValue(source.updatedDate),
    readingTime:
      typeof source.readingTime === 'number'
        ? source.readingTime
        : typeof source.readTime === 'number'
          ? source.readTime
          : undefined,
    categories,
    tags,
    views: typeof source.views === 'number' ? source.views : typeof stats?.views === 'number' ? stats.views : undefined,
    likes: typeof source.likes === 'number' ? source.likes : typeof stats?.likes === 'number' ? stats.likes : undefined,
    comments: typeof source.comments === 'number' ? source.comments : typeof stats?.comments === 'number' ? stats.comments : undefined,
    slug,
    featured: typeof source.featured === 'boolean' ? source.featured : undefined,
  };
}

function resolveRelatedPost(entry: unknown, index: number): RelatedPost | null {
  if (isRecord(entry)) {
    const candidateId =
      typeof entry.id === 'string' && entry.id.trim().length > 0 ? entry.id : undefined;
    const candidateTitle =
      typeof entry.title === 'string' && entry.title.trim().length > 0 ? entry.title : undefined;
    const candidateSlug =
      typeof entry.slug === 'string' && entry.slug.trim().length > 0 ? entry.slug : undefined;

    if (candidateId && candidateTitle && candidateSlug) {
      const baseRecord = entry as Record<string, unknown>;
      const baseAuthor =
        isRecord(baseRecord.author) && typeof baseRecord.author.name === 'string'
          ? {
              name: baseRecord.author.name,
              avatar:
                typeof baseRecord.author.avatar === 'string'
                  ? baseRecord.author.avatar
                  : undefined,
            }
          : undefined;

      const baseCategories = Array.isArray(baseRecord.categories)
        ? baseRecord.categories.filter(
            (value): value is string => typeof value === 'string' && value.length > 0,
          )
        : undefined;

      return {
        id: candidateId,
        title: candidateTitle,
        slug: candidateSlug,
        href: typeof baseRecord.href === 'string' ? baseRecord.href : undefined,
        thumbnail:
          typeof baseRecord.thumbnail === 'string' ? baseRecord.thumbnail : undefined,
        excerpt:
          typeof baseRecord.excerpt === 'string' ? baseRecord.excerpt : undefined,
        ctaLabel:
          typeof baseRecord.ctaLabel === 'string' ? baseRecord.ctaLabel : undefined,
        author: baseAuthor,
        publishDate:
          typeof baseRecord.publishDate === 'string' ? baseRecord.publishDate : undefined,
        readingTime:
          typeof baseRecord.readingTime === 'number' ? baseRecord.readingTime : undefined,
        categories: baseCategories,
      };
    }

    const source = isRecord(entry.content) ? (entry.content as Record<string, unknown>) : entry;

    const title = typeof source.title === 'string' ? source.title : undefined;
    const href = typeof source.href === 'string' ? source.href : undefined;
    const slug =
      typeof source.slug === 'string'
        ? source.slug
        : typeof entry.slug === 'string'
          ? entry.slug
          : normalizePath(href);

    const id =
      (typeof entry.id === 'string' && entry.id.trim().length > 0
        ? entry.id
        : typeof source.id === 'string' && source.id.trim().length > 0
          ? source.id
          : slugify(slug) ?? slugify(title)) ?? `related-post-${index}`;

    if (!title) {
      return null;
    }

    const image = isRecord(source.image) ? source.image : undefined;
    const authorSource = isRecord(source.author) ? source.author : isRecord(entry.author) ? entry.author : undefined;
    const categories =
      Array.isArray(source.categories) ? source.categories.filter((value): value is string => typeof value === 'string') : undefined;

    const publishDate =
      typeof source.publishDate === 'string'
        ? source.publishDate
        : typeof source.date === 'string'
          ? source.date
          : undefined;

    const readingTime =
      typeof source.readingTime === 'number'
        ? source.readingTime
        : typeof source.readTime === 'number'
          ? source.readTime
          : undefined;

    return {
      id,
      title,
      thumbnail: image && typeof image.src === 'string' ? image.src : undefined,
      excerpt: typeof source.excerpt === 'string' ? source.excerpt : undefined,
      author:
        authorSource && typeof authorSource.name === 'string'
          ? {
              name: authorSource.name,
              avatar: typeof authorSource.avatar === 'string' ? authorSource.avatar : undefined
            }
          : undefined,
      publishDate,
      readingTime,
      categories,
      slug: slug && slug.length > 0 ? slug : id
    };
  }

  return null;
}

function dedupeById<T extends { id?: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  const result: T[] = [];

  for (const item of items) {
    const id = stringValue(item.id);
    if (!id) {
      result.push(item);
      continue;
    }

    if (!seen.has(id)) {
      seen.add(id);
      result.push(item);
    }
  }

  return result;
}

function collectManualPosts(content: BlogListContent): BlogPost[] {
  const manual = [
    ...(content.manualPosts ?? []),
    ...(content.posts ?? [])
  ];
  const normalized = manual
    .map((entry, index) => resolveBlogPost(entry, index))
    .filter((entry): entry is BlogPost => entry !== null);

  return dedupeById(normalized);
}

function desiredBlogCount(autoFill: BlogAutoFillConfig | undefined, content: BlogListContent, manualCount: number): number {
  if (autoFill?.desiredCount && autoFill.desiredCount > 0) {
    return autoFill.desiredCount;
  }

  if (content.showPagination && content.postsPerPage) {
    return Math.max(content.postsPerPage, manualCount);
  }

  return Math.max(manualCount, 9);
}

export function resolveBlogListContent(content: BlogListContent): BlogListContent {
  const manualPosts = collectManualPosts(content);
  const provider = getContentProvider<BlogPost, BlogPostFilters>(ContentResource.BlogPosts) as BlogPostProvider | undefined;
  const autoFill = content.autoFill;

  let posts = [...manualPosts];

  // Only invoke providers when autoFill is explicitly configured. Imported sites
  // often provide curated posts only; running the mock provider in those cases
  // was leaking demo content into real exports.
  if (provider && autoFill && autoFill.enabled !== false) {
    const desiredCount = desiredBlogCount(autoFill, content, manualPosts.length);
    const remaining = desiredCount - posts.length;

    if (remaining > 0) {
      const query: ContentQuery<BlogPostFilters> = {
        limit: remaining,
        filters: {
          strategy: autoFill?.strategy,
          categories: autoFill?.categories ?? content.selectedCategories,
          tags: autoFill?.tags ?? content.selectedTags,
          excludeIds: posts.map(post => post.id)
        },
        sort: content.sortBy
          ? [{ field: content.sortBy, direction: content.sortOrder ?? 'desc' }]
          : undefined
      };

      const { items } = provider.fetch(query);

      posts = dedupeById([...posts, ...items]);
    }
  }

  return {
    ...content,
    manualPosts,
    posts
  };
}

function collectManualRelatedPosts(content: RelatedPostsContent): RelatedPost[] {
  const combined = [
    ...(content.manualPosts ?? []),
    ...(content.posts ?? [])
  ];

  const normalized = combined
    .map((entry, index) => resolveRelatedPost(entry, index))
    .filter((entry): entry is RelatedPost => entry !== null);

  return dedupeById(normalized);
}

export function resolveRelatedPostsContent(content: RelatedPostsContent): RelatedPostsContent {
  const provider = getContentProvider<BlogPost, BlogPostFilters>(ContentResource.BlogPosts) as BlogPostProvider | undefined;
  const manualPosts = collectManualRelatedPosts(content);
  const selectionMode = content.selectionMode ?? 'automatic';
  const maxPosts = content.maxPosts ?? 3;

  let posts = [...manualPosts];

  if (provider && selectionMode !== 'manual') {
    const remaining = maxPosts - posts.length;
    if (remaining > 0) {
      const categoryPool = content.relatedBy === 'tags' ? undefined : Array.from(new Set(manualPosts.flatMap(post => post.categories ?? [])));
      const tagPool = content.relatedBy === 'categories'
        ? undefined
        : Array.from(
            new Set(
              manualPosts.flatMap(post => {
                const maybeTags = (post as unknown as { tags?: string[] }).tags;
                return maybeTags ?? [];
              })
            )
          );

      const query: ContentQuery<BlogPostFilters> = {
        limit: remaining,
        filters: {
          strategy: 'related',
          categories: categoryPool,
          tags: tagPool,
          excludeIds: posts.map(post => post.id),
          basePostId: manualPosts[0]?.id,
          basePostSlug: manualPosts[0]?.slug
        }
      };

      const { items } = provider.fetch(query);
      const fetched = items.map<RelatedPost>((post) => ({
        id: post.id,
        title: post.title,
        thumbnail: post.thumbnail,
        excerpt: post.excerpt,
        author: post.author,
        publishDate: post.publishDate,
        readingTime: post.readingTime,
        categories: post.categories,
        slug: post.slug
      }));

      posts = dedupeById([...posts, ...fetched]).slice(0, maxPosts);
    }
  } else {
    posts = posts.slice(0, maxPosts);
  }

  return {
    ...content,
    manualPosts,
    posts
  };
}
