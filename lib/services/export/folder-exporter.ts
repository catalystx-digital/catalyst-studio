import { prisma } from '@/lib/prisma'
import { ContentTypeCategory } from '@/lib/generated/prisma'

// Interfaces for folder operations
export interface FolderMetadata {
  id: string
  name: string
  order: number
  settings?: Record<string, any>
  contentTypeId?: string
  createdAt: Date
  updatedAt: Date
  parentType?: 'root' | 'folder' | 'page' | 'unknown'
}

export interface FolderNode {
  id: string
  name: string
  path: string
  parentId?: string
  children: FolderNode[]
  websitePages: string[] // IDs of content items in this folder
  metadata: FolderMetadata
  order: number
}

export interface FolderHierarchy {
  root: FolderNode[]
  totalFolders: number
  maxDepth: number
  pathMappings: Record<string, string> // folderId -> fullPath
}

export enum ExportErrorCode {
  MISSING_DEPENDENCIES = 'EXPORT_001',
  CIRCULAR_REFERENCE = 'EXPORT_002',
  INVALID_STRUCTURE = 'EXPORT_003',
  MEMORY_LIMIT_EXCEEDED = 'EXPORT_004'
}

export class FolderExportError extends Error {
  constructor(
    message: string,
    public code: ExportErrorCode,
    public details?: any
  ) {
    super(message)
    this.name = 'FolderExportError'
  }
}

export class FolderExporter {
  // Cache for performance optimization
  private folderCache = new Map<string, FolderNode>()
  private hierarchyCache = new Map<string, FolderHierarchy>()
  private readonly CACHE_TTL = 5 * 60 * 1000 // 5 minutes
  private cacheTimestamps = new Map<string, number>()
  
  // Batch processing configuration
  private readonly BATCH_SIZE = 100
  private readonly MAX_MEMORY_MB = 100
  
  /**
   * Export all folders for a website
   */
  async exportFolders(websiteId: string): Promise<FolderHierarchy> {
    const startTime = Date.now()
    
    try {
      // Check cache first
      const cacheKey = `${websiteId}_full`
      if (this.isValidCache(cacheKey)) {
        const cached = this.hierarchyCache.get(cacheKey)
        if (cached) return cached
      }
      
      // Fetch all folder structures
      const folderStructures = await this.fetchFolderStructures(websiteId)
      
      // Build hierarchy
      const hierarchy = await this.buildFolderHierarchy(folderStructures, websiteId)
      
      // Cache the result
      this.hierarchyCache.set(cacheKey, hierarchy)
      this.cacheTimestamps.set(cacheKey, Date.now())
      
      // Check memory usage
      this.checkMemoryUsage()
      
      return hierarchy
    } catch (error) {
      if (error instanceof FolderExportError) {
        throw error
      }
      throw new FolderExportError(
        `Failed to export folders: ${error instanceof Error ? error.message : 'Unknown error'}`,
        ExportErrorCode.INVALID_STRUCTURE,
        { websiteId, error }
      )
    }
  }
  
  /**
   * Export selected folders with optional children
   */
  async exportSelectedFolders(
    websiteId: string,
    folderIds: string[],
    includeChildren: boolean = true
  ): Promise<FolderHierarchy> {
    try {
      const allFolders: FolderNode[] = []
      const pathMappings: Record<string, string> = {}
      
      for (const folderId of folderIds) {
        const folderNode = await this.fetchFolderWithChildren(
          websiteId,
          folderId,
          includeChildren
        )
        
        if (folderNode) {
          allFolders.push(folderNode)
          this.collectPathMappings(folderNode, pathMappings)
        }
      }
      
      // Calculate hierarchy statistics
      const stats = this.calculateHierarchyStats(allFolders)
      
      return {
        root: allFolders,
        totalFolders: stats.totalFolders,
        maxDepth: stats.maxDepth,
        pathMappings
      }
    } catch (error) {
      throw new FolderExportError(
        `Failed to export selected folders: ${error instanceof Error ? error.message : 'Unknown error'}`,
        ExportErrorCode.INVALID_STRUCTURE,
        { websiteId, folderIds, error }
      )
    }
  }
  
  /**
   * Build complete folder hierarchy from structures
   */
  async buildFolderHierarchy(
    structures: any[],
    websiteId: string
  ): Promise<FolderHierarchy> {
    const nodeMap = new Map<string, FolderNode>()
    const rootNodes: FolderNode[] = []
    const pathMappings: Record<string, string> = {}

    // First pass: Create all nodes
    for (const structure of structures) {
      const node = await this.createFolderNode(structure, websiteId)
      nodeMap.set(node.id, node)
      pathMappings[node.id] = node.path
    }

    const structureIds = new Set<string>(structures.map((s: any) => s.id).filter(Boolean))
    const candidateParentIds = new Set<string>()
    for (const structure of structures) {
      if (structure?.parentId && !structureIds.has(structure.parentId)) {
        candidateParentIds.add(structure.parentId)
      }
    }

    let externalParentIds = new Set<string>()
    if (candidateParentIds.size > 0) {
      const existingParents = await prisma.websiteStructure.findMany({
        where: {
          id: { in: Array.from(candidateParentIds) }
        },
        select: { id: true }
      })
      externalParentIds = new Set(existingParents.map((parent: { id: string }) => parent.id))
    }

    // Second pass: Build hierarchy
    for (const structure of structures) {
      const node = nodeMap.get(structure.id)
      if (!node) continue

      if (structure.parentId) {
        const parent = nodeMap.get(structure.parentId)
        if (parent) {
          node.metadata.parentType = 'folder'
          if (!parent.children.some(child => child.id === node.id)) {
            parent.children.push(node)
          }
          parent.children.sort((a, b) => a.order - b.order)
        } else {
          const parentExists = externalParentIds.has(structure.parentId)
          node.metadata.parentType = parentExists ? 'page' : 'unknown'
          if (!parentExists) {
            console.warn(`Orphaned folder detected: ${node.id}`)
          }
          if (!rootNodes.some(root => root.id === node.id)) {
            rootNodes.push(node)
          }
        }
      } else {
        node.metadata.parentType = 'root'
        if (!rootNodes.some(root => root.id === node.id)) {
          rootNodes.push(node)
        }
      }
    }

    // Sort root nodes by order
    rootNodes.sort((a, b) => a.order - b.order)

    // Check for circular references
    this.detectCircularReferences(rootNodes)

    // Calculate statistics
    const stats = this.calculateHierarchyStats(rootNodes)

    return {
      root: rootNodes,
      totalFolders: nodeMap.size,
      maxDepth: stats.maxDepth,
      pathMappings
    }
  }
  /**
   * Preserve folder metadata
   */
  preserveFolderMetadata(structure: any): FolderMetadata {
    return {
      id: structure.id,
      name: structure.slug || 'Unnamed Folder',
      order: structure.position || 0,
      settings: structure.metadata || {},
      contentTypeId: structure.websitePage?.contentTypeId,
      createdAt: structure.createdAt,
      updatedAt: structure.updatedAt,
      parentType: 'unknown'
    }
  }
  
  /**
   * Associate content items with their folders
   */
  async associateContentWithFolders(
    websiteId: string,
    folderNode: FolderNode
  ): Promise<void> {
    // Fetch content items for this folder
    const websitePages = await prisma.websiteStructure.findMany({
      where: {
        websiteId,
        parentId: folderNode.id,
        websitePageId: { not: null }
      },
      select: {
        websitePageId: true
      }
    })
    
    folderNode.websitePages = websitePages
      .map(item => item.websitePageId)
      .filter((id): id is string => id !== null)
  }
  
  // Private helper methods
  
  private async fetchFolderStructures(websiteId: string): Promise<any[]> {
    // Fetch folder-type content types first
    const folderContentTypes = await prisma.contentType.findMany({
      where: {
        websiteId,
        category: ContentTypeCategory.folder
      },
      select: {
        id: true
      }
    })
    
    const folderContentTypeIds = folderContentTypes.map(ct => ct.id)
    
    // Fetch all site structures that represent folders
    const structures = await prisma.websiteStructure.findMany({
      where: {
        websiteId,
        OR: [
          // Structures without content items are folders
          { websitePageId: null },
          // Or structures with folder-type content
          {
            websitePage: {
              contentTypeId: {
                in: folderContentTypeIds
              }
            }
          }
        ]
      },
      include: {
        websitePage: {
          select: {
            id: true,
            title: true,
            contentTypeId: true,
            metadata: true
          }
        }
      },
      orderBy: [
        { pathDepth: 'asc' },
        { position: 'asc' }
      ],
      take: this.BATCH_SIZE
    })
    
    // Process in batches if needed
    if (structures.length === this.BATCH_SIZE) {
      return this.fetchFolderStructuresBatched(websiteId, folderContentTypeIds)
    }
    
    return structures
  }
  
  private async fetchFolderStructuresBatched(
    websiteId: string,
    folderContentTypeIds: string[]
  ): Promise<any[]> {
    const allStructures: any[] = []
    let skip = 0
    let hasMore = true
    
    while (hasMore) {
      const batch = await prisma.websiteStructure.findMany({
        where: {
          websiteId,
          OR: [
            { websitePageId: null },
            {
              websitePage: {
                contentTypeId: {
                  in: folderContentTypeIds
                }
              }
            }
          ]
        },
        include: {
          websitePage: {
            select: {
              id: true,
              title: true,
              contentTypeId: true,
              metadata: true
            }
          }
        },
        orderBy: [
          { pathDepth: 'asc' },
          { position: 'asc' }
        ],
        skip,
        take: this.BATCH_SIZE
      })
      
      allStructures.push(...batch)
      
      if (batch.length < this.BATCH_SIZE) {
        hasMore = false
      } else {
        skip += this.BATCH_SIZE
      }
      
      // Check memory usage
      this.checkMemoryUsage()
    }
    
    return allStructures
  }
  
  private async fetchFolderWithChildren(
    websiteId: string,
    folderId: string,
    includeChildren: boolean
  ): Promise<FolderNode | null> {
    // Check cache first
    if (this.folderCache.has(folderId)) {
      return this.folderCache.get(folderId)!
    }
    
    const structure = await prisma.websiteStructure.findFirst({
      where: {
        websiteId,
        id: folderId
      },
      include: {
        websitePage: {
          select: {
            id: true,
            title: true,
            contentTypeId: true,
            metadata: true
          }
        }
      }
    })
    
    if (!structure) {
      return null
    }
    
    const node = await this.createFolderNode(structure, websiteId)
    
    if (includeChildren) {
      await this.fetchChildrenRecursive(websiteId, node)
    }
    
    // Cache the result
    this.folderCache.set(folderId, node)
    
    return node
  }
  
  private async fetchChildrenRecursive(
    websiteId: string,
    parentNode: FolderNode
  ): Promise<void> {
    const children = await prisma.websiteStructure.findMany({
      where: {
        websiteId,
        parentId: parentNode.id
      },
      include: {
        websitePage: {
          select: {
            id: true,
            title: true,
            contentTypeId: true,
            metadata: true
          }
        }
      },
      orderBy: {
        position: 'asc'
      }
    })
    
    for (const child of children) {
      const childNode = await this.createFolderNode(child, websiteId)
      parentNode.children.push(childNode)
      
      // Recursively fetch children
      await this.fetchChildrenRecursive(websiteId, childNode)
    }
  }
  
  private async createFolderNode(structure: any, websiteId: string): Promise<FolderNode> {
    const metadata = this.preserveFolderMetadata(structure)
    
    const node: FolderNode = {
      id: structure.id,
      name: structure.websitePage?.title || structure.slug || 'Unnamed Folder',
      path: structure.fullPath || '',
      parentId: structure.parentId || undefined,
      children: [],
      websitePages: [],
      metadata,
      order: structure.position || 0
    }
    
    // Associate content items
    await this.associateContentWithFolders(websiteId, node)
    
    return node
  }
  
  private detectCircularReferences(nodes: FolderNode[]): void {
    const visited = new Set<string>()
    const stack = new Set<string>()
    
    const detect = (node: FolderNode): void => {
      if (stack.has(node.id)) {
        throw new FolderExportError(
          `Circular reference detected for folder: ${node.id}`,
          ExportErrorCode.CIRCULAR_REFERENCE,
          { folderId: node.id, path: node.path }
        )
      }
      
      if (visited.has(node.id)) {
        return
      }
      
      visited.add(node.id)
      stack.add(node.id)
      
      for (const child of node.children) {
        detect(child)
      }
      
      stack.delete(node.id)
    }
    
    for (const node of nodes) {
      detect(node)
    }
  }
  
  private calculateHierarchyStats(nodes: FolderNode[]): {
    totalFolders: number
    maxDepth: number
  } {
    let totalFolders = 0
    let maxDepth = 0
    
    const calculate = (node: FolderNode, depth: number): void => {
      totalFolders++
      maxDepth = Math.max(maxDepth, depth)
      
      for (const child of node.children) {
        calculate(child, depth + 1)
      }
    }
    
    for (const node of nodes) {
      calculate(node, 1)
    }
    
    return { totalFolders, maxDepth }
  }
  
  private collectPathMappings(
    node: FolderNode,
    mappings: Record<string, string>
  ): void {
    mappings[node.id] = node.path
    
    for (const child of node.children) {
      this.collectPathMappings(child, mappings)
    }
  }
  
  private isValidCache(key: string): boolean {
    const timestamp = this.cacheTimestamps.get(key)
    if (!timestamp) return false
    
    return Date.now() - timestamp < this.CACHE_TTL
  }
  
  private checkMemoryUsage(): void {
    const used = process.memoryUsage()
    const usedMB = Math.round(used.heapUsed / 1024 / 1024)
    
    if (usedMB > this.MAX_MEMORY_MB) {
      // Clear caches to free memory
      this.folderCache.clear()
      this.hierarchyCache.clear()
      this.cacheTimestamps.clear()
      
      console.warn(`Memory usage exceeded ${this.MAX_MEMORY_MB}MB, clearing caches`)
    }
  }
  
  /**
   * Clear all caches
   */
  clearCache(): void {
    this.folderCache.clear()
    this.hierarchyCache.clear()
    this.cacheTimestamps.clear()
  }
}





