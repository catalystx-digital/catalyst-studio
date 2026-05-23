import { PrismaClient, ContentTypeCategory } from '@/lib/generated/prisma'
import type { UniversalMediaAsset, UniversalMediaService } from '@/lib/cms-export/universal/types'
import { collectMediaReferences } from './helpers/media-reference-utils'

// Simple LRU-like cache using Map with max size eviction
class SimpleLRUCache<K, V> {
  private cache = new Map<K, V>()
  private maxSize: number

  constructor(options: { max: number }) {
    this.maxSize = options.max
  }

  get(key: K): V | undefined {
    return this.cache.get(key)
  }

  set(key: K, value: V): void {
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value
      if (firstKey !== undefined) this.cache.delete(firstKey)
    }
    this.cache.set(key, value)
  }

  clear(): void {
    this.cache.clear()
  }
}
import { isMediaResolutionEnabled } from './helpers/media-feature-flags'
import { resolveUniversalMediaService } from './helpers/media-service-loader'

// Simple logger interface - can be replaced with a more sophisticated logger later
interface ILogger {
  info(message: string, metadata?: Record<string, any>): void
  warn(message: string, metadata?: Record<string, any>): void
  error(message: string, error?: Error, metadata?: Record<string, any>): void
}

// Default console logger implementation
class ConsoleLogger implements ILogger {
  info(message: string, metadata?: Record<string, any>): void {
    console.log(`[ContentOrchestrator INFO] ${message}`, metadata || '')
  }
  
  warn(message: string, metadata?: Record<string, any>): void {
    console.warn(`[ContentOrchestrator WARN] ${message}`, metadata || '')
  }
  
  error(message: string, error?: Error, metadata?: Record<string, any>): void {
    console.error(`[ContentOrchestrator ERROR] ${message}`, error || '', metadata || '')
  }
}

export interface UnifiedContent {
  id: string
  source: 'WebsitePage' | 'WebsiteStructure'
  type: 'page' | 'folder'
  title: string
  contentTypeId: string
  content: any // The actual content/data
  metadata?: any
  mediaAssets?: UniversalMediaAsset[]
  url?: string // From WebsiteStructure
  parentId?: string // Parent page ID (resolved from structure)
  components?: ExtractedComponent[] // From JSON extraction
  publishedAt?: Date
  status: string
  templateKey?: string | null
  templateProps?: Record<string, unknown> | null
  websiteId: string
}


export interface ExtractedComponent {
  id: string
  type: string // Actual component type, not "_shared"
  parentId?: string | null
  position?: number
  properties: any
  isShared: boolean
  sharedId?: string
  hasOverrides?: boolean
}

export interface IContentOrchestrator {
  gatherAllContent(websiteId: string): Promise<UnifiedContent[]>
}

export class ContentOrchestrator implements IContentOrchestrator {
  private prisma: PrismaClient
  private logger: ILogger
  private mediaService?: UniversalMediaService
  // LRU cache for WebsiteStructure data (changes rarely)
  private structureCache: any = new SimpleLRUCache({ max: 1000 })
  private folderTypeIdCache = new Map<string, string | null>()

  constructor(prisma: PrismaClient, logger?: ILogger, options?: { mediaService?: UniversalMediaService }) {
    this.prisma = prisma
    this.logger = logger || new ConsoleLogger()
    this.mediaService = options?.mediaService
  }

  /**
   * Main orchestration method - gathers content from pages and site structure in parallel
   */
  async gatherAllContent(websiteId: string): Promise<UnifiedContent[]> {
    try {
      // CRITICAL: Use Promise.all for parallel fetching as per story requirements
      const [pages, structures] = await Promise.all([
        this.fetchPages(websiteId),
        this.fetchStructures(websiteId)
      ])

      this.logger.info(`Fetched ${pages.length} pages, ${structures.length} structures`, {
        pages: pages.length,
        structures: structures.length
      })

      // Attach URLs from structures to pages
      const pagesWithUrls = this.attachUrls(pages, structures)

      // Unify all content into single model
      const unifiedContent = this.unifyContent(pagesWithUrls)
      const folderContent = await this.createFolderUnifiedContent(structures, pagesWithUrls)
      const combinedContent = unifiedContent.concat(folderContent)

      // Sort content so parents come before children (topological order)
      const sortedContent = this.sortByHierarchy(combinedContent)
      const enrichedContent = await this.attachMediaAssets(sortedContent)

      this.logger.info(`Created ${enrichedContent.length} unified content items`, {
        totalItems: enrichedContent.length,
        folders: folderContent.length,
        itemsWithMedia: enrichedContent.filter(item => Array.isArray(item.mediaAssets) && item.mediaAssets.length > 0).length
      })
      return enrichedContent
    } catch (error) {
      this.logger.error('Error gathering content', error as Error, { websiteId })
      throw error
    }
  }

  /**
   * Fetch all pages from WebsitePage table
   * Note: WebsitePage contains actual pages - ContentItem table doesn't exist
   */
  private async fetchPages(websiteId: string): Promise<any[]> {
    const pages = await this.prisma.websitePage.findMany({
      where: { 
        websiteId,
        type: { in: ['page', 'folder'] } // Get both pages and folders
      }
    })
    return pages.filter((page: any) => !isHiddenImportContent(page.metadata))
  }

  /**
   * Fetch URL structures from WebsiteStructure table with caching
   */
  private async fetchStructures(websiteId: string): Promise<any[]> {
    const cacheKey = `structures_${websiteId}`
    
    // Check cache first
    const cached = this.structureCache.get(cacheKey)
    if (cached) {
      this.logger.info(`Using cached structures for website ${websiteId}`, { websiteId, cacheHit: true })
      return cached
    }

    // Fetch from database
    const structures = await this.prisma.websiteStructure.findMany({
      where: { websiteId },
      include: { websitePage: { select: { metadata: true } } },
      orderBy: [
        { pathDepth: 'asc' },
        { position: 'asc' }
      ]
    })

    // Cache the result
    const visibleStructures = structures.filter((structure: any) => !isHiddenImportContent(structure.websitePage?.metadata))
    this.structureCache.set(cacheKey, visibleStructures)
    
    return visibleStructures
  }

  /**
   * Attach URLs from WebsiteStructure to pages
   */
  private attachUrls(pages: any[], structures: any[]): any[] {
    // Build lookup maps:
    // - by websitePageId (page id -> structure)
    // - by structure id (structure id -> structure) so we can resolve parent structure reliably
    const structureByPageId = new Map<string, any>()
    const structureById = new Map<string, any>()

    structures.forEach(structure => {
      if (structure && structure.id) {
        structureById.set(structure.id, structure)
      }
      if (structure && structure.websitePageId) {
        structureByPageId.set(structure.websitePageId, structure)
      }
    })

    const rootStructure = structures.find(structure => {
      if (!structure) return false
      const depth = typeof structure.pathDepth === 'number' ? structure.pathDepth : Number(structure?.pathDepth ?? 0)
      if (depth !== 0) return false
      return Boolean(structure.websitePageId || structure.id)
    })

    // Attach URLs to pages
    return pages.map(page => {
      const structure = structureByPageId.get(page.id)
      const parentStructure = structure && structure.parentId ? structureById.get(structure.parentId) : undefined
      let parentId = parentStructure
        ? (parentStructure.websitePageId || parentStructure.id || null)
        : (page.parentId || null)
      const pathDepth = typeof structure?.pathDepth === 'number' ? structure.pathDepth : Number(structure?.pathDepth ?? 0)

      // Fallback to root if no parent found but page has depth > 0
      if (!parentStructure && !parentId && structure && pathDepth > 0 && rootStructure) {
        const fallbackParentId = rootStructure.websitePageId || rootStructure.id || null
        if (fallbackParentId && fallbackParentId !== page.id) {
          parentId = fallbackParentId
        }
      }

      return {
        ...page,
        url: structure?.fullPath || null,
        pathDepth: structure?.pathDepth || 0,
        position: structure?.position || 0,
        parentId: parentId ?? undefined
      }
    })
  }

  /**
   * Sort content so parents come before children (topological sort).
   * This ensures that when creating content in Optimizely, parent pages
   * are created first so their IDs are available for child pages.
   */
  private sortByHierarchy(content: UnifiedContent[]): UnifiedContent[] {
    const idSet = new Set(content.map(c => c.id))
    const result: UnifiedContent[] = []
    const visited = new Set<string>()

    // Build adjacency: parentId -> children
    const childrenOf = new Map<string | null, UnifiedContent[]>()
    for (const item of content) {
      const parentId = item.parentId ?? null
      if (!childrenOf.has(parentId)) {
        childrenOf.set(parentId, [])
      }
      childrenOf.get(parentId)!.push(item)
    }

    // DFS from roots (items with no parent or parent not in set)
    const visit = (item: UnifiedContent) => {
      if (visited.has(item.id)) return
      visited.add(item.id)
      result.push(item)
      // Visit children
      const children = childrenOf.get(item.id) || []
      for (const child of children) {
        visit(child)
      }
    }

    // Start with root items (no parent or parent not in content set)
    for (const item of content) {
      const parentId = item.parentId ?? null
      if (parentId === null || !idSet.has(parentId)) {
        visit(item)
      }
    }

    // Add any remaining unvisited items (orphans or cycles)
    for (const item of content) {
      if (!visited.has(item.id)) {
        visit(item)
      }
    }

    return result
  }

  /**
   * Unify page content into a single model
   */
  private unifyContent(pagesWithUrls: any[]): UnifiedContent[] {
    const unifiedContent: UnifiedContent[] = []

    // Process WebsitePage records
    pagesWithUrls.forEach(page => {
      const templateKey = typeof page.templateKey === 'string' ? page.templateKey : (page.templateKey ? String(page.templateKey) : null)
      const templateProps = this.normalizeJson(page.templateProps)
      unifiedContent.push({
        id: page.id,
        source: 'WebsitePage',
        type: page.type || 'page',
        title: page.title || 'Untitled',
        contentTypeId: page.contentTypeId || 'page',
        content: page.content || {},
        metadata: page.metadata || {},
        websiteId: page.websiteId,
        url: page.url,
        parentId: page.parentId || null,
        publishedAt: page.publishedAt || page.createdAt,
        status: page.status || 'published',
        templateKey,
        templateProps,
        // Components will be extracted separately by ComponentInstanceExtractor
        components: []
      })
    })

    return unifiedContent
  }

  private async createFolderUnifiedContent(structures: any[], pagesWithUrls: any[]): Promise<UnifiedContent[]> {
    const structureById = new Map<string, any>()
    for (const structure of structures) {
      if (structure && structure.id) {
        structureById.set(structure.id, structure)
      }
    }

    const websiteIdCandidate = (pagesWithUrls.find(page => page?.websiteId)?.websiteId
      ?? structures.find(structure => structure?.websiteId)?.websiteId) as string | undefined
    const resolvedTypeId = await this.resolveFolderContentTypeId(pagesWithUrls, structures)
    const folderTypeId = resolvedTypeId ?? 'folder'
    const requiresSyntheticFolders = structures.some(structure => structure && !structure.websitePageId)
    if (!resolvedTypeId && requiresSyntheticFolders) {
      this.logger.warn('Falling back to default folder content type id', { websiteId: websiteIdCandidate })
    }
    const folders: UnifiedContent[] = []

    for (const structure of structures) {
      if (!structure || structure.websitePageId) {
        continue
      }

      const parentStructure = structure.parentId ? structureById.get(structure.parentId) : undefined
      let parentId: string | null = null
      if (parentStructure) {
        parentId = parentStructure.websitePageId || parentStructure.id || null
      }

      const metadataTypeId = folderTypeId
      const metadata = {
        slug: structure.slug || null,
        fullPath: structure.fullPath || null,
        position: structure.position ?? 0,
        pathDepth: structure.pathDepth ?? 0,
        originalContentTypeId: metadataTypeId,
        isFolder: true
      }

      const folder: UnifiedContent = {
        id: structure.id,
        source: 'WebsiteStructure',
        type: 'folder',
        title: this.formatFolderTitle(structure.slug),
        contentTypeId: metadataTypeId,
        content: {},
        metadata,
        websiteId: structure.websiteId,
        url: structure.fullPath || null,
        parentId: parentId ?? undefined,
        publishedAt: structure.updatedAt ?? structure.createdAt ?? null,
        status: 'draft',
        templateKey: null,
        templateProps: null,
        components: []
      }

      folders.push(folder)
    }

    return folders
  }

  private async resolveFolderContentTypeId(pagesWithUrls: any[], structures: any[]): Promise<string | undefined> {
    const folderPage = pagesWithUrls.find(page => {
      const type = String(page?.type || '').toLowerCase()
      return type === 'folder' && page?.contentTypeId
    })
    if (folderPage?.contentTypeId) {
      const resolvedId = String(folderPage.contentTypeId)
      const siteIdRaw = folderPage.websiteId ?? pagesWithUrls.find(p => p?.websiteId)?.websiteId
      if (siteIdRaw) {
        const siteKey = String(siteIdRaw)
        this.folderTypeIdCache.set(siteKey, resolvedId)
      }
      return resolvedId
    }

    const websiteIdRaw = pagesWithUrls.find(page => page?.websiteId)?.websiteId
      ?? structures.find(structure => structure?.websiteId)?.websiteId

    if (!websiteIdRaw) {
      return undefined
    }

    const websiteId = String(websiteIdRaw)

    if (this.folderTypeIdCache.has(websiteId)) {
      const cached = this.folderTypeIdCache.get(websiteId)
      return cached === null ? undefined : cached
    }

    try {
      const folderType = await this.prisma.contentType.findFirst({
        where: {
          websiteId,
          category: ContentTypeCategory.folder
        },
        select: { id: true },
        orderBy: { updatedAt: 'desc' }
      })
      const resolvedId = folderType?.id ? String(folderType.id) : undefined
      this.folderTypeIdCache.set(websiteId, resolvedId ?? null)
      return resolvedId
    } catch (error) {
      this.logger.warn('Failed to resolve folder content type id', {
        websiteId,
        error: error instanceof Error ? error.message : String(error)
      })
      this.folderTypeIdCache.set(websiteId, null)
      return undefined
    }
  }


  private formatFolderTitle(slug?: string | null): string {
    if (!slug) return 'Folder'
    const cleaned = slug.replace(/[-_]+/g, ' ').trim()
    if (!cleaned) return 'Folder'
    return cleaned
      .split(' ')
      .filter(Boolean)
      .map(part => part[0].toUpperCase() + part.slice(1))
      .join(' ')
  }

  private async attachMediaAssets(unifiedContent: UnifiedContent[]): Promise<UnifiedContent[]> {
    if (unifiedContent.length === 0) {
      return unifiedContent
    }

    if (!isMediaResolutionEnabled()) {
      return unifiedContent
    }

    const mediaRefsByItem: Array<{ index: number; websiteId: string; refs: Map<string, { altText?: string | null }> }> = []
    const mediaIdsByWebsite = new Map<string, Set<string>>()
    const altTextByWebsite = new Map<string, Map<string, string | null>>()
    const clones = unifiedContent.map(item => ({ ...item }))

    clones.forEach((item, index) => {
      if (!item.websiteId) {
        return
      }

      const refs = new Map<string, { altText?: string | null }>()
      collectMediaReferences(item.content, refs)
      if (item.metadata) {
        collectMediaReferences(item.metadata, refs)
      }
      if (item.templateProps) {
        collectMediaReferences(item.templateProps, refs)
      }
      if (Array.isArray(item.components)) {
        item.components.forEach(component => {
          collectMediaReferences(component.properties, refs)
        })
      }

      if (refs.size === 0) {
        return
      }

      mediaRefsByItem.push({ index, websiteId: item.websiteId, refs })

      let idSet = mediaIdsByWebsite.get(item.websiteId)
      if (!idSet) {
        idSet = new Set<string>()
        mediaIdsByWebsite.set(item.websiteId, idSet)
      }

      let altMap = altTextByWebsite.get(item.websiteId)
      if (!altMap) {
        altMap = new Map<string, string | null>()
        altTextByWebsite.set(item.websiteId, altMap)
      }

      refs.forEach((value, mediaId) => {
        idSet!.add(mediaId)
        if (value.altText && (!altMap!.has(mediaId) || !altMap!.get(mediaId))) {
          altMap!.set(mediaId, value.altText)
        }
      })
    })

    if (mediaRefsByItem.length === 0) {
      return clones
    }

    const mediaService = await resolveUniversalMediaService(this.mediaService)
    if (!mediaService) {
      this.logger.warn('Media service unavailable; returning unified content without media attachments')
      return clones
    }

    this.mediaService = mediaService

    const assetsByWebsite = new Map<string, Map<string, UniversalMediaAsset>>()

    for (const [websiteId, mediaIds] of mediaIdsByWebsite.entries()) {
      if (mediaIds.size === 0) {
        continue
      }
      try {
        const altContext = altTextByWebsite.get(websiteId)
        const assets = await mediaService.getAssetsForWebsiteByIds(
          websiteId,
          mediaIds,
          altContext ? { altTextByMediaId: altContext } : undefined
        )
        assetsByWebsite.set(websiteId, assets)
      } catch (error) {
        this.logger.warn('Failed to load media assets for website', {
          websiteId,
          error: error instanceof Error ? error.message : String(error)
        })
      }
    }

    mediaRefsByItem.forEach(({ index, websiteId, refs }) => {
      const target = clones[index]
      const assets = assetsByWebsite.get(websiteId)
      if (!assets) {
        return
      }

      const collected: UniversalMediaAsset[] = []
      refs.forEach((value, mediaId) => {
        const asset = assets.get(mediaId)
        if (!asset) {
          return
        }
        const enriched: UniversalMediaAsset = { ...asset }
        if ((!enriched.altText || enriched.altText.length === 0) && value.altText) {
          enriched.altText = value.altText
        }
        collected.push(enriched)
      })

      if (collected.length > 0) {
        target.mediaAssets = collected
      }
    })

    return clones
  }
  private normalizeJson(value: unknown): Record<string, unknown> | null {
    if (value === null || value === undefined) {
      return null
    }
    if (typeof value === 'object') {
      try {
        return JSON.parse(JSON.stringify(value))
      } catch {
        return value as Record<string, unknown>
      }
    }
    return null
  }

  /**
   * Clear structure cache (useful for testing or when structures change)
   */
  clearCache(): void {
    this.structureCache.clear()
    this.folderTypeIdCache.clear()
  }
}

function isHiddenImportContent(metadata: unknown): boolean {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return false
  const record = metadata as Record<string, unknown>
  if (record.importVisibility === 'visible') return false
  return record.isImportDraft === true || record.importVisibility === 'draft' || record.importVisibility === 'cancelled' || record.importVisibility === 'failed'
}
