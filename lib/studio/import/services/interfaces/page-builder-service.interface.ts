import { WebsitePage } from '@/lib/generated/prisma'
import {
  ComponentType as ImportComponentType,
  DetectionResult
} from './component-type-extractor.interface'
import { ComponentType as CmsComponentType } from '@/lib/studio/components/cms/_core/types'

export interface ComponentInstance {
  id: string
  type: string
  typeId: string
  componentType?: CmsComponentType
  componentTypeId?: string
  parentId: string | null
  position: number
  props: Record<string, any>
  content?: unknown
  children?: ComponentInstance[]
}

export interface PageTemplateSelection {
  templateKey: string
  confidence?: number
  reason?: string
  source?: 'model' | 'fallback' | 'home-enforced'
  requestedKey?: string
  props?: Record<string, unknown>
}

export interface PageData {
  title: string
  url: string
  screenshot?: string
  detectedComponents: DetectionResult[]
  metadata?: {
    description?: string
    keywords?: string[]
    openGraph?: Record<string, any>
  }
  templateProps?: Record<string, unknown>
  pageTemplate?: PageTemplateSelection
}

export interface ComponentTree {
  components: ComponentInstance[]
  metadata: {
    totalComponents: number
    maxDepth: number
    componentTypes: string[]
  }
}

export interface IPageBuilderService {
  configureContentTypes(options: {
    defaultContentTypeId: string
    templateContentTypes: Map<string, string>
  }): void

  /**
   * Build hierarchical component tree from flat detection results
   */
  buildComponentTree(components: DetectionResult[]): ComponentTree

  /**
   * Create a single WebsitePage record based on detected components
   */
  createPage(
    pageData: PageData,
    componentTypes: ImportComponentType[],
    websiteId: string,
    contentTypeId: string
  ): Promise<WebsitePage>

  /**
   * Map detected components to component instances using identified types
   */
  mapToComponentInstances(
    detected: DetectionResult[],
    types: ImportComponentType[]
  ): ComponentInstance[]

  /**
   * Generate unique IDs for component instances
   */
  generateComponentId(type: string, index: number): string

  /**
   * Validate component tree structure
   */
  validateComponentTree(tree: ComponentTree): boolean

  /**
   * Calculate component positions based on layout
   */
  calculatePositions(components: ComponentInstance[]): ComponentInstance[]

  /**
   * Extract page metadata from detection results
   */
  extractPageMetadata(detectionResults: DetectionResult[]): PageData['metadata']

  /**
   * Optimize component tree for performance
   */
  optimizeComponentTree(tree: ComponentTree): ComponentTree

  /**
   * Convert component tree to WebsitePage content format
   */
  formatPageContent(tree: ComponentTree, primaryFieldName: string): Record<string, any>
}
