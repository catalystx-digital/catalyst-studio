import { PrismaClient, WebsiteStructure, WebsitePage } from '@/lib/generated/prisma'
import {
  IStructureService,
  StructureTree,
  StructureOptions,
  StructureImportDiagnostic
} from './interfaces/structure-service.interface'
import { z } from 'zod'
import {
  canonicalizePath,
  canonicalizeSlugSegments,
  parsePathSegments,
  slugSegmentsToPath
} from '@/lib/studio/utils/slug-canonicalizer'

// Properly typed recursive schema to avoid circular reference issues
type StructureTreeType = {
  id: string
  slug: string
  fullPath: string
  websitePageId?: string
  parentId?: string
  children: StructureTreeType[]
  position: number
  pathDepth: number
}

const StructureTreeSchema: z.ZodType<StructureTreeType> = z.object({
  id: z.string(),
  slug: z.string(),
  fullPath: z.string(),
  websitePageId: z.string().optional(),
  parentId: z.string().optional(),
  children: z.array(z.lazy(() => StructureTreeSchema)),
  position: z.number(),
  pathDepth: z.number()
})

const StructureOptionsSchema = z.object({
  preserveOriginalUrls: z.boolean().optional().default(true),
  generateSlugsFromTitle: z.boolean().optional().default(true),
  maxSlugLength: z.number().optional().default(100),
  slugSeparator: z.string().optional().default('-')
})

export class StructureService implements IStructureService {
  private readonly diagnostics: StructureImportDiagnostic[] = []

  constructor(private prisma: PrismaClient) {}

  private recordDiagnostic(diagnostic: StructureImportDiagnostic): void {
    this.diagnostics.push(diagnostic)
  }

  async createStructure(
    page: WebsitePage,
    websiteId: string,
    parentId?: string,
    url?: string
  ): Promise<WebsiteStructure> {
    try {
      const pageUrl = url || this.extractUrlFromMetadata(page.metadata)
      let slug = this.generateSlug(page.title, pageUrl || '')
      if (this.isHomepage(page, pageUrl)) {
        slug = 'home'
      }
      const canonicalSlug = this.normalizeSlug(slug, { slugSeparator: '-' })

      const parentStructure = parentId
        ? await this.prisma.websiteStructure.findUnique({ where: { id: parentId } })
        : null
      const parentPath = parentStructure?.fullPath ?? null
      const fullPath = this.generateFullPath(parentPath, canonicalSlug)
      const pathDepth = this.calculatePathDepth(fullPath)

      const existing = await this.prisma.websiteStructure.findFirst({
        where: {
          websiteId,
          fullPath
        }
      })

      if (existing) {
        // Case 1: Structure exists but has no page linked (e.g., created during resume)
        // Link the current page to this structure
        if (!existing.websitePageId) {
          console.log(`[StructureService] Linking page "${page.title}" to existing unlinked structure at "${fullPath}"`)
          return await this.prisma.websiteStructure.update({
            where: { id: existing.id },
            data: { websitePageId: page.id }
          })
        }

        // Case 2: Structure already linked to this same page - return as-is
        if (existing.websitePageId === page.id) {
          return existing
        }

        // Case 3: Structure linked to a different page - collision, log warning
        const existingPage = await this.prisma.websitePage.findUnique({ where: { id: existing.websitePageId } })
        const existingOriginalUrl = existingPage ? this.extractUrlFromMetadata(existingPage.metadata) : null
        this.recordDiagnostic({
          code: 'STRUCTURE_CANONICAL_COLLISION',
          level: 'warn',
          message: `Skipped structure creation for page "${page.title}" because canonical path "${fullPath}" is already assigned. Normalize source URLs to avoid case-only duplicates.`,
          context: {
            websiteId,
            pageId: page.id,
            existingStructureId: existing.id,
            existingPageId: existing.websitePageId,
            existingPageTitle: existingPage?.title ?? null,
            existingOriginalUrl,
            canonicalPath: fullPath,
            originalUrl: pageUrl ?? null
          }
        })
        return existing
      }

      const siblingCount = await this.prisma.websiteStructure.count({
        where: { websiteId, parentId }
      })

      return await this.prisma.websiteStructure.create({
        data: {
          websiteId,
          slug: canonicalSlug,
          fullPath,
          websitePageId: page.id,
          parentId,
          position: siblingCount,
          pathDepth,
          weight: 0
        }
      })
    } catch (error) {
      throw new Error(`Failed to create structure for page ${page.id}: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  generateSlug(pageTitle: string, url: string, options?: StructureOptions): string {
    const opts = StructureOptionsSchema.parse(options || {})
    
    // If preserveOriginalUrls is true and url is available, extract slug from URL
    if (opts.preserveOriginalUrls && url) {
      const urlSlug = this.extractSlugFromUrl(url)
      if (urlSlug) {
        return this.normalizeSlug(urlSlug, opts)
      }
    }
    
    // Generate from page title if no URL or URL extraction failed
    if (opts.generateSlugsFromTitle && pageTitle) {
      return this.normalizeSlug(pageTitle, opts)
    }
    
    // Fallback to a default slug
    return 'page'
  }

  async buildHierarchy(pages: WebsitePage[], websiteId: string, pageUrls?: Map<string, string>): Promise<StructureTree> {
    try {
    // Create a map to build the tree structure
    const structureMap = new Map<string, StructureTree>()
    const rootNodes: StructureTree[] = []
    
      // First pass: create all structure nodes
      for (const page of pages) {
        const pageUrl = pageUrls?.get(page.id) || this.extractUrlFromMetadata(page.metadata)
        let slug = this.generateSlug(page.title, pageUrl || '')
        if (this.isHomepage(page, pageUrl)) {
          slug = 'home'
        }
        const structure: StructureTree = {
          id: page.id,
          slug,
        fullPath: '', // Will be calculated in second pass
        websitePageId: page.id,
        parentId: undefined,
        children: [],
        position: 0,
        pathDepth: 0
      }
      structureMap.set(page.id, structure)
    }
    
      // Second pass: establish parent-child relationships and calculate paths
      for (const page of pages) {
        const structure = structureMap.get(page.id)!
        const pageUrl = pageUrls?.get(page.id) || this.extractUrlFromMetadata(page.metadata)
        const parentStructure = await this.findParentByUrl(pageUrl || '', websiteId)
      
      if (parentStructure) {
        structure.parentId = parentStructure.id
        const parentNode = structureMap.get(parentStructure.id)
        if (parentNode) {
          parentNode.children.push(structure)
          structure.fullPath = this.generateFullPath(parentNode.fullPath, structure.slug)
          structure.pathDepth = this.calculatePathDepth(structure.fullPath)
        }
      } else {
        // Root level page
        structure.fullPath = this.generateFullPath(null, structure.slug)
        structure.pathDepth = this.calculatePathDepth(structure.fullPath)
        rootNodes.push(structure)
      }
    }
    
    // Sort children by position
    structureMap.forEach(node => {
      node.children.sort((a, b) => a.position - b.position)
    })
    
    // Return root structure tree (for now, return first root or create a virtual root)
    if (rootNodes.length === 1) {
      return rootNodes[0]
    }
    
      // Create virtual root for multiple root nodes
      return {
        id: 'virtual-root',
        slug: '',
        fullPath: '/',
        parentId: undefined,
        children: rootNodes.sort((a, b) => a.position - b.position),
        position: 0,
        pathDepth: 0
      }
    } catch (error) {
      throw new Error(`Failed to build hierarchy: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  calculatePathDepth(fullPath: string): number {
    if (!fullPath || fullPath === '/') return 0
    return fullPath.split('/').filter(segment => segment.length > 0).length
  }

  generateFullPath(parentPath: string | null, slug: string): string {
    const canonicalParent = canonicalizePath(parentPath ?? '/')
    const trimmedSlug = (slug ?? '').trim().toLowerCase()
    const canonicalSlug = trimmedSlug.length > 0 ? trimmedSlug : 'page'
    const isRootParent = canonicalParent === '/' || canonicalParent.length === 0

    if (isRootParent && (canonicalSlug === 'index' || canonicalSlug === 'home')) {
      return '/'
    }

    if (isRootParent) {
      return `/${canonicalSlug}`
    }

    return `${canonicalParent}/${canonicalSlug}`
  }

  async validateStructureUniqueness(
    websiteId: string,
    fullPath: string,
    excludeId?: string
  ): Promise<boolean> {
    try {
      const canonicalFullPath = canonicalizePath(fullPath)
      const existing = await this.prisma.websiteStructure.findFirst({
        where: {
          websiteId,
          fullPath: canonicalFullPath,
          ...(excludeId && { id: { not: excludeId } })
        }
      })
      return !existing
    } catch (error) {
      throw new Error(`Failed to validate structure uniqueness: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  async updateSiblingPositions(
    parentId: string | null,
    websiteId: string
  ): Promise<void> {
    try {
      const siblings = await this.prisma.websiteStructure.findMany({
        where: {
          websiteId,
          parentId
        },
        orderBy: [
          { position: 'asc' },
          { createdAt: 'asc' }
        ]
      })
      
      const updates = siblings.map((sibling, index) => 
        this.prisma.websiteStructure.update({
          where: { id: sibling.id },
          data: { position: index }
        })
      )
      
      await Promise.all(updates)
    } catch (error) {
      throw new Error(`Failed to update sibling positions: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  async findParentByUrl(url: string, websiteId: string): Promise<WebsiteStructure | null> {
    try {
      if (!url) return null

      let parentPath = '/'
      try {
        const u = new URL(url)
        const parts = u.pathname.split('/').filter(Boolean)
        parentPath = parts.length > 1 ? '/' + parts.slice(0, -1).join('/') : '/'
      } catch {
        const parts = url.split('/').filter(Boolean)
        parentPath = parts.length > 1 ? '/' + parts.slice(0, -1).join('/') : '/'
      }

      const canonicalParentPath = canonicalizePath(parentPath)

      return await this.prisma.websiteStructure.findFirst({
        where: {
          websiteId,
          fullPath: canonicalParentPath
        }
      })
    } catch (error) {
      throw new Error(`Failed to find parent by URL: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  async createBatchStructures(
    pages: WebsitePage[],
    websiteId: string,
    pageUrls?: Map<string, string>
  ): Promise<WebsiteStructure[]> {
    try {
      const structures: WebsiteStructure[] = []
      
      // Sort pages by URL path depth to ensure parents are created before children
      const depthOf = (raw: string): number => {
        try {
          const u = new URL(raw)
          return u.pathname.split('/').filter(Boolean).length
        } catch {
          return raw.split('/').filter(Boolean).length
        }
      }
      const sortedPages = pages.sort((a, b) => {
        const aUrl = pageUrls?.get(a.id) || this.extractUrlFromMetadata(a.metadata) || ''
        const bUrl = pageUrls?.get(b.id) || this.extractUrlFromMetadata(b.metadata) || ''
        return depthOf(aUrl) - depthOf(bUrl)
      })
      
      // Precompute parent path counts to decide on virtual parent creation
      const parentPathCounts = new Map<string, number>()
      for (const page of pages) {
        const purl = pageUrls?.get(page.id) || this.extractUrlFromMetadata(page.metadata) || ''
        let parentPath: string | null = null
        try {
          const u = new URL(purl)
          const parts = u.pathname.split('/').filter(Boolean)
          parentPath = parts.length > 0 ? '/' + parts.slice(0, -1).join('/') : '/'
        } catch {
          const parts = purl.split('/').filter(Boolean)
          parentPath = parts.length > 0 ? '/' + parts.slice(0, -1).join('/') : '/'
        }
        const key = canonicalizePath(parentPath || '/')
        parentPathCounts.set(key, (parentPathCounts.get(key) || 0) + 1)
      }

      for (const page of sortedPages) {
        const pageUrl = pageUrls?.get(page.id) || this.extractUrlFromMetadata(page.metadata)

        // Resolve parent path from URL and classify page
        let parentPath: string | null = null
        const cls: { type: 'structural' | 'content' | 'archive' | 'virtual'; isNavigational: boolean; shouldCreateParent: boolean } = this.classifyPage(page, pageUrl || '')
        if (pageUrl) {
          try {
            const u = new URL(pageUrl)
            const parts = u.pathname.split('/').filter(Boolean)
            parentPath = parts.length > 0 ? '/' + parts.slice(0, -1).join('/') : null
          } catch {
            const parts = pageUrl.split('/').filter(Boolean)
            parentPath = parts.length > 0 ? '/' + parts.slice(0, -1).join('/') : null
          }
        }

        // Find existing parent if any
        let parentStructure = await this.findParentByUrl(pageUrl || '', websiteId)
        // Decide whether to create missing parent chain
        const canonicalParentPath = parentPath ? canonicalizePath(parentPath) : '/'
        const parentCount = parentPath ? (parentPathCounts.get(canonicalParentPath) || 0) : 0
        const allowCreateParent = cls.shouldCreateParent && parentPath && parentPath !== '/' && (cls.type === 'structural' || parentCount >= 2)
        if (!parentStructure && allowCreateParent && parentPath) {
          parentStructure = await this.ensureStructureChain(websiteId, canonicalParentPath)
        }

        const structure = await this.createStructure(
          page,
          websiteId,
          parentStructure?.id,
          pageUrl || undefined
        )

        if (!structures.some(existing => existing.id === structure.id)) {
          structures.push(structure)
        }
      }

      return structures
    } catch (error) {
      throw new Error(`Failed to create batch structures: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Creates structures for a batch of pages (used by ImportOrchestrator)
   * This method is called by ImportOrchestrator.orchestrateImport
   */
  async createStructures(
    pages: WebsitePage[],
    websiteId: string
  ): Promise<WebsiteStructure[]> {
    try {
      console.log(`[StructureService] createStructures called with ${pages.length} pages for websiteId: ${websiteId}`)
      
      // Use existing createBatchStructures logic
      return await this.createBatchStructures(pages, websiteId)
    } catch (error) {
      console.error(`[StructureService] Failed to create structures:`, error)
      throw new Error(`Failed to create structures: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  getDiagnostics(): StructureImportDiagnostic[] {
    return this.diagnostics.map(diagnostic => ({
      ...diagnostic,
      context: diagnostic.context ? { ...diagnostic.context } : undefined
    }))
  }

  clearDiagnostics(): void {
    this.diagnostics.length = 0
  }

  async repairStructureIntegrity(websiteId: string): Promise<void> {
    try {
      // Find and fix circular references
      const structures = await this.prisma.websiteStructure.findMany({
        where: { websiteId }
      })
      
      for (const structure of structures) {
        if (await this.hasCircularReference(structure.id, structure.parentId)) {
          // Break circular reference by removing parent
          await this.prisma.websiteStructure.update({
            where: { id: structure.id },
            data: { parentId: null }
          })
        }
      }
      
      // Update sibling positions for all parent groups
      const parentIds = [...new Set(structures.map(s => s.parentId))]
      for (const parentId of parentIds) {
        await this.updateSiblingPositions(parentId, websiteId)
      }
    } catch (error) {
      throw new Error(`Failed to repair structure integrity: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  // Private helper methods
  private extractSlugFromUrl(url: string): string | null {
    try {
      let pathname = ''
      try {
        const u = new URL(url)
        pathname = u.pathname
      } catch {
        const idx = url.indexOf('://')
        const raw = idx >= 0 ? url.slice(url.indexOf('/', idx + 3)) : url
        pathname = raw || '/'
      }
      const segments = pathname.split('/').filter(Boolean)
      if (segments.length === 0) return 'home'
      return segments[segments.length - 1]
    } catch {
      return null
    }
  }

  /**
   * Ensure that a WebsiteStructure exists for the given fullPath by creating
   * any missing ancestor structures (without associated pages). Returns the
   * structure for the target path.
   */
  private async ensureStructureChain(websiteId: string, fullPath: string): Promise<WebsiteStructure> {
    const canonicalFullPath = canonicalizePath(fullPath || '/')

    if (!canonicalFullPath || canonicalFullPath === '/') {
      const existingRoot = await this.prisma.websiteStructure.findFirst({ where: { websiteId, fullPath: '/' } })
      if (existingRoot) return existingRoot
      return existingRoot as any // null
    }

    const existing = await this.prisma.websiteStructure.findFirst({ where: { websiteId, fullPath: canonicalFullPath } })
    if (existing) return existing

    // Ensure parent first
    const segments = canonicalizeSlugSegments(parsePathSegments(canonicalFullPath))
    const parentPath = segments.length > 1 ? slugSegmentsToPath(segments.slice(0, -1)) : '/'
    const parent = await this.ensureStructureChain(websiteId, parentPath)

    // Create this node without associated page
    const slug = segments[segments.length - 1] ?? 'page'
    const siblingCount = await this.prisma.websiteStructure.count({ where: { websiteId, parentId: parent?.id || null } })

    // Try to create, handle race condition where another parallel process creates it first
    try {
      return await this.prisma.websiteStructure.create({
        data: {
          websiteId,
          slug,
          fullPath: canonicalFullPath,
          parentId: parent?.id || null,
          position: siblingCount,
          pathDepth: this.calculatePathDepth(canonicalFullPath),
          weight: 0
        }
      })
    } catch (error: any) {
      // P2002 = Unique constraint violation (another process created it)
      if (error.code === 'P2002') {
        const created = await this.prisma.websiteStructure.findFirst({
          where: { websiteId, fullPath: canonicalFullPath }
        })
        if (created) {
          return created
        }
      }
      throw error
    }
  }

  private extractUrlFromMetadata(metadata: any): string | null {
    try {
      if (!metadata) return null
      // Handle both JSON object and string formats
      const meta = typeof metadata === 'string' ? JSON.parse(metadata) : metadata
      return meta?.url || meta?.originalUrl || meta?.importSource || meta?.pageUrl || null
    } catch {
      return null
    }
  }

  // Heuristic page classification (content-aware signals)
  private classifyPage(page: WebsitePage, pageUrl: string): { type: 'structural' | 'content' | 'archive' | 'virtual'; isNavigational: boolean; shouldCreateParent: boolean } {
    try {
      const meta = typeof page.metadata === 'string' ? JSON.parse(page.metadata as any) : (page.metadata as any)
      const pageType = (meta?.classification?.pageType || '').toString().toLowerCase()
      const url = pageUrl || this.extractUrlFromMetadata(meta) || ''
      const path = (() => { try { return new URL(url).pathname } catch { return url } })().toLowerCase()
      const isDateArchive = /\/\d{4}\/(\d{2})(\/\d{2})?\//.test(path)
      const isArchivePath = /\/(tag|tags|category|categories|author|archive)s?\//.test(path)
      const isVirtual = /\/(products|collections|category|topics)\//.test(path)
      const isNav = /\/(about|contact|products|services|blog|news)\/?$/.test(path)

      if (pageType === 'home') return { type: 'structural', isNavigational: true, shouldCreateParent: false }
      if (isDateArchive || isArchivePath) return { type: 'archive', isNavigational: false, shouldCreateParent: false }
      if (isVirtual) return { type: 'virtual', isNavigational: isNav, shouldCreateParent: false }
      if (pageType === 'blog' || pageType === 'landing' || pageType === 'product') return { type: 'content', isNavigational: isNav, shouldCreateParent: false }
      return { type: 'structural', isNavigational: isNav, shouldCreateParent: true }
    } catch {
      return { type: 'content', isNavigational: false, shouldCreateParent: false }
    }
  }

  private normalizeSlug(input: string, options: StructureOptions): string {
    const { maxSlugLength = 100, slugSeparator = '-' } = options

    if (!input) return 'page' // Handle empty input

    // Remove common web file extensions before normalization
    input = input.replace(/\.(aspx?|html?|php\d*|jsp|cfm|shtml)$/i, '')

    return input
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '') // Remove special characters except word chars, spaces, hyphens
      .replace(/[\s_]+/g, slugSeparator) // Replace spaces and underscores with separator
      .replace(new RegExp(`${slugSeparator}+`, 'g'), slugSeparator) // Remove consecutive separators
      .replace(new RegExp(`^${slugSeparator}+|${slugSeparator}+$`, 'g'), '') // Remove leading/trailing separators
      .substring(0, maxSlugLength)
  }

  private async generateUniqueSlug(
    baseSlug: string,
    websiteId: string,
    parentId?: string
  ): Promise<string> {
    let counter = 2
    let uniqueSlug = `${baseSlug}-${counter}`
    
    while (!await this.isSlugUniqueInScope(uniqueSlug, websiteId, parentId)) {
      counter++
      uniqueSlug = `${baseSlug}-${counter}`
    }
    
    return uniqueSlug
  }

  private async isSlugUniqueInScope(
    slug: string,
    websiteId: string,
    parentId?: string
  ): Promise<boolean> {
    const parentPath = parentId 
      ? (await this.prisma.websiteStructure.findUnique({ where: { id: parentId } }))?.fullPath || null
      : null
    
    const fullPath = this.generateFullPath(parentPath, slug)
    return this.validateStructureUniqueness(websiteId, fullPath)
  }

  private async hasCircularReference(
    structureId: string,
    parentId: string | null,
    visited = new Set<string>()
  ): Promise<boolean> {
    if (!parentId) return false
    if (visited.has(parentId)) return true
    if (parentId === structureId) return true
    
    visited.add(parentId)
    
    const parent = await this.prisma.websiteStructure.findUnique({
      where: { id: parentId }
    })
    
    if (!parent) return false
    
    return this.hasCircularReference(structureId, parent.parentId, visited)
  }

  private isHomepage(page: WebsitePage, pageUrl?: string | null): boolean {
    try {
      const meta = typeof page.metadata === 'string' ? JSON.parse(page.metadata as any) : (page.metadata as any)
      // Check explicit classification
      const pageType = meta?.classification?.pageType || meta?.seo?.pageType
      if (typeof pageType === 'string' && pageType.toLowerCase() === 'home') return true
      // Check URL path root
      const url = pageUrl || this.extractUrlFromMetadata(meta)
      if (url) {
        try {
          const u = new URL(url)
          if (u.pathname === '/' || u.pathname === '') return true
          // Check for index patterns: /index_en, /index.html, /index-de
          const pathLower = u.pathname.toLowerCase()
          if (this.isIndexPattern(pathLower)) return true
        } catch {
          if (url === '/' || url.trim().endsWith('://') || url.trim().endsWith('/')) {
            // crude fallback
            try {
              const idx = url.indexOf('://')
              const path = idx >= 0 ? url.slice(url.indexOf('/', idx + 3)) : url
              if (path === '/' || path === '') return true
              // Also check index patterns for crude fallback
              if (this.isIndexPattern(path.toLowerCase())) return true
            } catch {}
          }
        }
      }
      // Heuristic: title equals Home/Homepage
      const t = (page.title || '').toLowerCase()
      if (t === 'home' || t === 'homepage') return true
    } catch {}
    return false
  }

  /**
   * Detects homepage index patterns:
   * - /index_en, /index_de (locale suffixes)
   * - /index.html, /index.php (file extensions)
   * - /index-en, /index-de (dash separators)
   * - /en/, /de/ (two-letter locale roots)
   */
  private isIndexPattern(pathname: string): boolean {
    // Remove trailing slash for consistent matching
    const path = pathname.replace(/\/$/, '')

    // Direct index file patterns
    if (path === '/index' || path === '/index.html' || path === '/index.php' || path === '/index.htm') {
      return true
    }

    // Index with locale suffix: /index_en, /index_de, /index-en, /index-de
    if (/^\/index[_-][a-z]{2,3}$/.test(path)) {
      return true
    }

    // Two-letter locale root: /en, /de, /fr, /es (common international homepage patterns)
    if (/^\/[a-z]{2}$/.test(path)) {
      return true
    }

    return false
  }
}
