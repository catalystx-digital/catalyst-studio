import { WebsiteStructure, WebsitePage } from '@/lib/generated/prisma'

export interface StructureTree {
  id: string
  slug: string
  fullPath: string
  websitePageId?: string
  parentId?: string
  children: StructureTree[]
  position: number
  pathDepth: number
}

export interface StructureOptions {
  preserveOriginalUrls?: boolean
  generateSlugsFromTitle?: boolean
  maxSlugLength?: number
  slugSeparator?: string
}

export interface StructureImportDiagnostic {
  code: string
  level: 'info' | 'warn' | 'error'
  message: string
  context?: Record<string, unknown>
}

export interface IStructureService {
  /**
   * Create WebsiteStructure entry for a page
   * @param page - The WebsitePage to create structure for
   * @param websiteId - The website ID
   * @param parentId - Optional parent structure ID
   * @param url - Optional URL for the page (can be extracted from metadata if not provided)
   */
  createStructure(
    page: WebsitePage,
    websiteId: string,
    parentId?: string,
    url?: string
  ): Promise<WebsiteStructure>

  /**
   * Generate URL-safe slug from page title and original URL
   */
  generateSlug(pageTitle: string, url: string, options?: StructureOptions): string

  /**
   * Build hierarchical structure tree from pages
   * @param pages - Array of WebsitePages to build hierarchy from
   * @param websiteId - The website ID
   * @param pageUrls - Optional map of page IDs to URLs
   */
  buildHierarchy(pages: WebsitePage[], websiteId: string, pageUrls?: Map<string, string>): Promise<StructureTree>

  /**
   * Calculate path depth for nested structures
   */
  calculatePathDepth(fullPath: string): number

  /**
   * Generate full path from parent path and slug
   */
  generateFullPath(parentPath: string | null, slug: string): string

  /**
   * Validate structure uniqueness within website
   */
  validateStructureUniqueness(
    websiteId: string,
    fullPath: string,
    excludeId?: string
  ): Promise<boolean>

  /**
   * Update positions for sibling structures
   */
  updateSiblingPositions(
    parentId: string | null,
    websiteId: string
  ): Promise<void>

  /**
   * Find parent structure by URL pattern
   */
  findParentByUrl(url: string, websiteId: string): Promise<WebsiteStructure | null>

  /**
   * Batch create structures for multiple pages
   * @param pages - Array of WebsitePages to create structures for
   * @param websiteId - The website ID
   * @param pageUrls - Optional map of page IDs to URLs
   */
  createBatchStructures(
    pages: WebsitePage[],
    websiteId: string,
    pageUrls?: Map<string, string>
  ): Promise<WebsiteStructure[]>

  /**
   * Retrieve diagnostics recorded during structure operations
   */
  getDiagnostics(): StructureImportDiagnostic[]

  /**
   * Clear accumulated diagnostics
   */
  clearDiagnostics(): void

  /**
   * Repair broken structure relationships
   */
  repairStructureIntegrity(websiteId: string): Promise<void>
}
