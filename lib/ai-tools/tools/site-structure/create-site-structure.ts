/**
 * AI Tool for Creating Complete Site Structure
 *
 * Creates all WebsiteStructure records atomically in a transaction.
 * Used by greenfield workflow to establish IA-first site architecture.
 *
 * Key features:
 * - Topological sort ensures parents created before children
 * - Resolves parentSlug -> parentId internally
 * - Sets websitePageId = null, iaStatus = 'pending'
 * - Atomic transaction - rollback on any failure
 */

import { tool } from 'ai';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';

/**
 * Input schema for IA metadata per page
 */
const iaMetadataSchema = z.object({
  purpose: z.string().describe('The purpose of this page'),
  targetAudience: z.string().optional().describe('Who this page is for'),
  primaryQuestion: z.string().optional().describe('Main question this page answers'),
  journeyStage: z.enum(['awareness', 'interest', 'consideration', 'decision']).optional()
    .describe('Where in the customer journey this page fits'),
  requiredSections: z.array(z.string()).describe('Component sections needed on this page'),
  contentGuidance: z.object({
    tone: z.string().optional().describe('Writing tone for this page'),
    keyMessages: z.array(z.string()).optional().describe('Key messages to convey')
  }).optional().describe('Content writing guidance')
});

/**
 * Input schema for a single page in the structure
 */
const pageInputSchema = z.object({
  slug: z.string().describe('URL slug for this page (e.g., "about", "services/consulting")'),
  title: z.string().describe('Page title'),
  parentSlug: z.string().nullable().describe('Parent page slug (null for root pages)'),
  position: z.number().optional().describe('Position among siblings (auto-calculated if not provided)'),
  iaMetadata: iaMetadataSchema.describe('Information Architecture metadata for content generation')
});

type PageInput = z.infer<typeof pageInputSchema>;

/**
 * Structural component names that should NEVER be created as pages.
 * These are COMPONENTS that go WITHIN pages, not pages themselves.
 */
const INVALID_PAGE_SLUGS = new Set([
  'navbar', 'nav', 'navigation', 'header', 'top-nav', 'main-nav',
  'footer', 'bottom-nav', 'site-footer',
  'sidebar', 'left-sidebar', 'right-sidebar',
  'menu', 'main-menu', 'mobile-menu',
]);

/**
 * Validate that pages array doesn't contain structural components as pages.
 * Returns filtered pages and logs warnings for any removed items.
 */
function validateAndFilterPages(pages: PageInput[]): { valid: PageInput[]; removed: string[] } {
  const valid: PageInput[] = [];
  const removed: string[] = [];

  for (const page of pages) {
    const slugLower = page.slug.toLowerCase();
    if (INVALID_PAGE_SLUGS.has(slugLower)) {
      removed.push(page.slug);
      console.warn(`[createSiteStructure] Rejecting "${page.slug}" - structural components cannot be pages`);
    } else {
      valid.push(page);
    }
  }

  return { valid, removed };
}

/**
 * Auto-add missing parent pages to ensure valid hierarchy.
 * If a page references a parentSlug that doesn't exist, create a minimal parent.
 * This is a fallback safety net when AI forgets to include parent pages.
 *
 * TKT-071: Fixed to handle transitive missing parents and ensure 'home' is always created
 * when needed by auto-generated parents.
 */
function ensureParentsExist(pages: PageInput[]): PageInput[] {
  const slugSet = new Set(pages.map(p => p.slug));
  const missingParents: PageInput[] = [];

  // Track pages that need 'home' as their parent (for home auto-creation check later)
  let needsHomeAsRoot = false;

  for (const page of pages) {
    if (page.parentSlug && !slugSet.has(page.parentSlug)) {
      // Parent doesn't exist - create it
      slugSet.add(page.parentSlug);
      const parentSlug = page.parentSlug;

      // If the missing parent IS 'home', make it root (null), otherwise child of home
      const newParentSlug = parentSlug === 'home' ? null : 'home';
      if (newParentSlug === 'home') {
        needsHomeAsRoot = true;
      }

      missingParents.push({
        slug: parentSlug,
        title: parentSlug.charAt(0).toUpperCase() + parentSlug.slice(1).replace(/-/g, ' '),
        parentSlug: newParentSlug,
        iaMetadata: {
          purpose: `Category page for ${parentSlug}`,
          targetAudience: 'Visitors exploring categories',
          primaryQuestion: `What ${parentSlug} options are available?`,
          journeyStage: 'interest',
          // Use canonical component types (text-block, feature-list)
          requiredSections: ['text-block', 'feature-list']
        }
      });
    }
  }

  // Check if ANY page (original OR auto-created) references 'home' as parent
  const allPagesNeedingHome = pages.some(p => p.parentSlug === 'home') || needsHomeAsRoot;

  // Ensure 'home' exists if any page references it
  if (!slugSet.has('home') && allPagesNeedingHome) {
    console.warn('[createSiteStructure] AI did not create home page - auto-creating with default sections');
    slugSet.add('home');
    missingParents.unshift({
      slug: 'home',
      title: 'Home',
      parentSlug: null,
      iaMetadata: {
        purpose: 'Welcome visitors, establish credibility, and convert to action',
        targetAudience: 'First-time visitors exploring the business',
        primaryQuestion: 'What does this business offer and why should I care?',
        journeyStage: 'awareness',
        // Use canonical component types
        requiredSections: [
          'hero-simple',
          'text-block',
          'feature-grid',
          'testimonials',
          'cta-simple'
        ]
      }
    });
  }

  // Handle edge case: If there are pages with non-home, non-null parentSlug that reference
  // missing parents which themselves would need home - ensure those transitive parents exist
  // This handles chains like: page -> missing-parent -> home
  for (const page of missingParents) {
    if (page.parentSlug && page.parentSlug !== 'home' && !slugSet.has(page.parentSlug)) {
      // Transitive missing parent - this shouldn't happen with current logic but add safety
      console.warn(`[createSiteStructure] Orphaning page "${page.slug}" to home (missing parent: "${page.parentSlug}")`);
      page.parentSlug = slugSet.has('home') ? 'home' : null;
    }
  }

  if (missingParents.length > 0) {
    console.warn('[createSiteStructure] Auto-added missing parents:', missingParents.map(p => p.slug));
  }

  // Combine and ensure 'home' is always a root page (AI might mistakenly give it a parent)
  const allPages = [...missingParents, ...pages];
  for (const page of allPages) {
    if (page.slug === 'home' && page.parentSlug !== null) {
      console.warn('[createSiteStructure] Forcing "home" to be root page (had parentSlug:', page.parentSlug, ')');
      page.parentSlug = null;
    }
  }

  return allPages;
}

/**
 * Topologically sort pages so parents are created before children
 * Uses Kahn's algorithm for stable ordering
 */
function topologicalSortPages(pages: PageInput[]): PageInput[] {
  // Build adjacency map: parentSlug -> children
  const childrenMap = new Map<string | null, PageInput[]>();
  const slugToPage = new Map<string, PageInput>();

  for (const page of pages) {
    slugToPage.set(page.slug, page);
    const parentKey = page.parentSlug;
    if (!childrenMap.has(parentKey)) {
      childrenMap.set(parentKey, []);
    }
    childrenMap.get(parentKey)!.push(page);
  }

  // BFS from root nodes (parentSlug = null)
  const sorted: PageInput[] = [];
  const queue: (string | null)[] = [null]; // Start with root level

  while (queue.length > 0) {
    const currentParent = queue.shift()!;
    const children = childrenMap.get(currentParent) || [];

    // Sort children by position for consistent ordering
    children.sort((a, b) => (a.position ?? 0) - (b.position ?? 0));

    for (const child of children) {
      sorted.push(child);
      // Add this slug as a potential parent for next level
      queue.push(child.slug);
    }
  }

  // Verify all pages were included (detect cycles or orphans)
  if (sorted.length !== pages.length) {
    const sortedSlugs = new Set(sorted.map(p => p.slug));
    const missing = pages.filter(p => !sortedSlugs.has(p.slug));
    throw new Error(
      `Invalid page hierarchy: ${missing.length} pages have invalid parent references: ${missing.map(p => p.slug).join(', ')}`
    );
  }

  return sorted;
}

/**
 * Compute fullPath from slug and parent chain
 */
function computeFullPath(slug: string, parentSlug: string | null, slugToFullPath: Map<string, string>): string {
  if (parentSlug === null) {
    // Root level page
    return slug === 'home' || slug === '' ? '/' : `/${slug}`;
  }

  const parentPath = slugToFullPath.get(parentSlug);
  if (!parentPath) {
    throw new Error(`Parent slug "${parentSlug}" not found when computing path for "${slug}"`);
  }

  // Join parent path with current slug
  if (parentPath === '/') {
    return `/${slug}`;
  }
  return `${parentPath}/${slug}`;
}

/**
 * Compute path depth from fullPath
 */
function computePathDepth(fullPath: string): number {
  if (fullPath === '/') return 0;
  // Count segments: /about = 1, /services/consulting = 2
  return fullPath.split('/').filter(segment => segment.length > 0).length;
}

/**
 * Create site structure tool
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const createSiteStructure = (tool as any)({
  description: `Create complete site structure atomically for a greenfield website.

Use this tool when establishing the Information Architecture (IA) for a new site.
All pages are created in a single transaction - if any fails, all are rolled back.

The tool:
- Accepts an array of pages with their slugs, titles, and IA metadata
- Resolves parent-child relationships using parentSlug
- Creates WebsiteStructure records with websitePageId=null (pages generated later)
- Sets iaStatus='pending' for all pages

Example input:
{
  "websiteId": "abc123",
  "pages": [
    { "slug": "home", "title": "Home", "parentSlug": null, "iaMetadata": {...} },
    { "slug": "about", "title": "About Us", "parentSlug": null, "iaMetadata": {...} },
    { "slug": "team", "title": "Our Team", "parentSlug": "about", "iaMetadata": {...} }
  ]
}`,

  inputSchema: z.object({
    websiteId: z.string().describe('The website ID to create structure for'),
    pages: z.array(pageInputSchema).describe('Array of pages with their hierarchy and IA metadata')
  }),

  execute: async (params: { websiteId: string; pages: z.infer<typeof pageInputSchema>[] }) => {
    const startTime = Date.now();
    const { websiteId, pages } = params;

    try {
      // Validate website exists
      const website = await prisma.website.findUnique({
        where: { id: websiteId },
        select: { id: true, name: true }
      });

      if (!website) {
        return {
          success: false,
          error: `Website not found: ${websiteId}`,
          executionTime: `${Date.now() - startTime}ms`
        };
      }

      // Handle empty pages array
      if (pages.length === 0) {
        return {
          success: true,
          message: 'No pages to create',
          structures: {},
          executionTime: `${Date.now() - startTime}ms`
        };
      }

      // Clean up existing structures for idempotency (allows workflow retries)
      const existingStructures = await prisma.websiteStructure.findMany({
        where: { websiteId },
        select: { id: true, websitePageId: true }
      });

      if (existingStructures.length > 0) {
        console.info('[createSiteStructure] Cleaning up existing structures for retry', {
          websiteId,
          existingCount: existingStructures.length
        });

        // Delete structures that don't have pages linked yet (safe to recreate)
        const structuresWithoutPages = existingStructures.filter(s => !s.websitePageId);
        if (structuresWithoutPages.length > 0) {
          await prisma.websiteStructure.deleteMany({
            where: {
              id: { in: structuresWithoutPages.map(s => s.id) }
            }
          });
        }

        // If all existing structures have pages, skip creation (already complete)
        const structuresWithPages = existingStructures.filter(s => s.websitePageId);
        if (structuresWithPages.length === existingStructures.length && structuresWithPages.length > 0) {
          console.info('[createSiteStructure] Site structure already complete, skipping', {
            websiteId,
            existingPages: structuresWithPages.length
          });

          // Return existing structures
          const existing = await prisma.websiteStructure.findMany({
            where: { websiteId },
            select: { slug: true, id: true, fullPath: true }
          });

          const structures: Record<string, { id: string; fullPath: string }> = {};
          for (const s of existing) {
            structures[s.slug] = { id: s.id, fullPath: s.fullPath };
          }

          return {
            success: true,
            message: `Site structure already exists with ${existing.length} pages`,
            websiteId,
            websiteName: website.name,
            structures,
            executionTime: `${Date.now() - startTime}ms`
          };
        }
      }

      // VALIDATION: Filter out structural components that AI mistakenly created as pages
      const { valid: validatedPages, removed: removedSlugs } = validateAndFilterPages(pages);

      if (removedSlugs.length > 0) {
        console.warn('[createSiteStructure] Removed invalid page slugs (structural components):', removedSlugs);
      }

      // If ALL pages were invalid (e.g., AI only created navbar/footer), create default pages
      if (validatedPages.length === 0) {
        console.warn('[createSiteStructure] All AI-generated pages were invalid, creating default site structure');
        // Create a comprehensive home page
        validatedPages.push({
          slug: 'home',
          title: 'Home',
          parentSlug: null,
          iaMetadata: {
            purpose: 'Welcome visitors, establish credibility, and convert to action',
            targetAudience: 'First-time visitors exploring the business',
            primaryQuestion: 'What does this business offer and why should I care?',
            journeyStage: 'awareness',
            // Use canonical component types
            requiredSections: [
              'hero-simple',
              'text-block',
              'feature-grid',
              'testimonials',
              'cta-simple'
            ]
          }
        });
        // Also create a contact page as minimum viable site
        validatedPages.push({
          slug: 'contact',
          title: 'Contact',
          parentSlug: 'home',
          iaMetadata: {
            purpose: 'Enable visitors to get in touch or book a call',
            targetAudience: 'Interested prospects ready to take action',
            primaryQuestion: 'How do I get started or learn more?',
            journeyStage: 'decision',
            // Use canonical component types
            requiredSections: ['cta-simple', 'text-block']
          }
        });
      }

      // Auto-add any missing parent pages (safety net for AI errors)
      const pagesWithParents = ensureParentsExist(validatedPages);

      // Topologically sort pages (parents before children)
      const sortedPages = topologicalSortPages(pagesWithParents);

      // Create all structures in transaction
      const slugToId = new Map<string, string>();
      const slugToFullPath = new Map<string, string>();

      const createdStructures = await prisma.$transaction(async (tx) => {
        const results: Array<{ slug: string; id: string; fullPath: string }> = [];

        // Track sibling positions per parent
        const siblingPositions = new Map<string | null, number>();

        for (const page of sortedPages) {
          // Resolve parentId from parentSlug
          const parentId = page.parentSlug ? slugToId.get(page.parentSlug) : null;

          if (page.parentSlug && !parentId) {
            throw new Error(`Parent "${page.parentSlug}" not found for page "${page.slug}"`);
          }

          // Compute fullPath
          const fullPath = computeFullPath(page.slug, page.parentSlug, slugToFullPath);
          const pathDepth = computePathDepth(fullPath);

          // Auto-calculate position if not provided
          const parentKey = page.parentSlug ?? null;
          const position = page.position ?? (siblingPositions.get(parentKey) ?? 0);
          siblingPositions.set(parentKey, position + 1);

          // Create WebsiteStructure record
          const structure = await tx.websiteStructure.create({
            data: {
              websiteId,
              slug: page.slug,
              fullPath,
              parentId,
              position,
              pathDepth,
              weight: position, // Default weight same as position
              websitePageId: null, // Pages created later
              iaMetadata: page.iaMetadata,
              iaStatus: 'pending'
            }
          });

          // Track for child resolution
          slugToId.set(page.slug, structure.id);
          slugToFullPath.set(page.slug, fullPath);

          results.push({
            slug: page.slug,
            id: structure.id,
            fullPath: structure.fullPath
          });
        }

        return results;
      });

      // Build slug -> id mapping for response
      const structures: Record<string, { id: string; fullPath: string }> = {};
      for (const struct of createdStructures) {
        structures[struct.slug] = {
          id: struct.id,
          fullPath: struct.fullPath
        };
      }

      return {
        success: true,
        message: `Created ${createdStructures.length} site structure records`,
        websiteId,
        websiteName: website.name,
        structures,
        executionTime: `${Date.now() - startTime}ms`
      };

    } catch (error) {
      console.error('[createSiteStructure] Error:', error);

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create site structure',
        executionTime: `${Date.now() - startTime}ms`
      };
    }
  }
});
