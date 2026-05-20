/**
 * Page Resolver Service
 *
 * Provides fuzzy matching to resolve human-readable page descriptions
 * to specific page IDs. Used by findAndUpdateComponent tool.
 */

import { getClient } from '@/lib/db/client';

export interface PageSearchCriteria {
  title?: string;
  slug?: string;
  fullPath?: string;
  pageId?: string;
}

export interface PageMatch {
  pageId: string;
  title: string;
  slug: string;
  fullPath: string;
  updatedAt: Date;
  confidence: number;
  content: Record<string, unknown> | null;
}

export interface PageResolutionResult {
  matches: PageMatch[];
  exactMatch: boolean;
}

/**
 * Resolve page search criteria to matching pages
 */
export async function resolvePage(
  websiteId: string,
  search: PageSearchCriteria
): Promise<PageResolutionResult> {
  const prisma = getClient();

  // Direct ID lookup (highest confidence)
  if (search.pageId) {
    const page = await prisma.websitePage.findFirst({
      where: {
        id: search.pageId,
        websiteId
      },
      include: {
        structures: {
          take: 1,
          orderBy: { createdAt: 'desc' }
        }
      }
    });

    if (page) {
      const structure = page.structures[0];
      return {
        matches: [{
          pageId: page.id,
          title: page.title,
          slug: structure?.slug || '',
          fullPath: structure?.fullPath || '/',
          updatedAt: page.updatedAt,
          confidence: 1.0,
          content: page.content as Record<string, unknown> | null
        }],
        exactMatch: true
      };
    }
    return { matches: [], exactMatch: false };
  }

  // Fetch all pages for fuzzy matching
  const pages = await prisma.websitePage.findMany({
    where: { websiteId },
    include: {
      structures: {
        take: 1,
        orderBy: { createdAt: 'desc' }
      }
    }
  });

  // Calculate confidence scores for each page
  const matches = pages
    .map(page => {
      const structure = page.structures[0];
      const confidence = calculatePageConfidence(
        page.title,
        structure?.slug || '',
        structure?.fullPath || '/',
        search
      );

      return {
        pageId: page.id,
        title: page.title,
        slug: structure?.slug || '',
        fullPath: structure?.fullPath || '/',
        updatedAt: page.updatedAt,
        confidence,
        content: page.content as Record<string, unknown> | null
      };
    })
    .filter(m => m.confidence > 0.3)
    .sort((a, b) => b.confidence - a.confidence);

  // Check if we have an exact match
  const exactMatch = matches.length === 1 && matches[0].confidence >= 0.95;

  return { matches, exactMatch };
}

/**
 * Calculate confidence score for a page match
 */
function calculatePageConfidence(
  title: string,
  slug: string,
  fullPath: string,
  search: PageSearchCriteria
): number {
  let totalScore = 0;
  let criteriaCount = 0;

  // Title matching
  if (search.title) {
    criteriaCount++;
    const normalizedTitle = title.toLowerCase().trim();
    const searchTitle = search.title.toLowerCase().trim();

    if (normalizedTitle === searchTitle) {
      totalScore += 1.0;
    } else if (normalizedTitle.startsWith(searchTitle)) {
      totalScore += 0.8;
    } else if (normalizedTitle.includes(searchTitle)) {
      totalScore += 0.5;
    } else if (searchTitle.includes(normalizedTitle)) {
      totalScore += 0.4;
    }

    // Special handling for common page names
    const homeTerms = ['home', 'homepage', 'main', 'index', 'start'];
    const aboutTerms = ['about', 'about us', 'about-us', 'company'];
    const contactTerms = ['contact', 'contact us', 'contact-us', 'get in touch'];

    if (homeTerms.includes(searchTitle) && (homeTerms.includes(normalizedTitle) || fullPath === '/')) {
      totalScore = Math.max(totalScore, 0.9);
    }
    if (aboutTerms.includes(searchTitle) && aboutTerms.some(t => normalizedTitle.includes(t))) {
      totalScore = Math.max(totalScore, 0.85);
    }
    if (contactTerms.includes(searchTitle) && contactTerms.some(t => normalizedTitle.includes(t))) {
      totalScore = Math.max(totalScore, 0.85);
    }
  }

  // Slug matching
  if (search.slug) {
    criteriaCount++;
    const normalizedSlug = slug.toLowerCase();
    const searchSlug = search.slug.toLowerCase();

    if (normalizedSlug === searchSlug) {
      totalScore += 1.0;
    } else if (normalizedSlug.includes(searchSlug)) {
      totalScore += 0.6;
    } else if (searchSlug.includes(normalizedSlug)) {
      totalScore += 0.4;
    }
  }

  // Full path matching
  if (search.fullPath) {
    criteriaCount++;
    const normalizedPath = fullPath.toLowerCase();
    const searchPath = search.fullPath.toLowerCase();

    if (normalizedPath === searchPath) {
      totalScore += 1.0;
    } else if (normalizedPath.endsWith(searchPath)) {
      totalScore += 0.8;
    } else if (normalizedPath.includes(searchPath)) {
      totalScore += 0.5;
    }
  }

  return criteriaCount > 0 ? totalScore / criteriaCount : 0;
}

/**
 * Format a page match for display to user
 */
export function formatPageDescription(match: PageMatch): string {
  const timeAgo = formatTimeAgo(match.updatedAt);
  return `"${match.title}" at ${match.fullPath} (updated ${timeAgo})`;
}

/**
 * Format time ago string
 */
function formatTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}
