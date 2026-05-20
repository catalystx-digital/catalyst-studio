import { WebsiteSharedComponent, WebsitePage } from '@/lib/generated/prisma'
import { ComponentInstance } from './page-builder-service.interface'
import { ComponentPattern } from './component-type-extractor.interface'

export interface SharedComponentCandidate {
  pattern: ComponentPattern
  instances: ComponentInstance[]
  pages: string[]
  similarity: number
  name: string
  category: string
}

export interface SharedComponentConfig {
  minOccurrences?: number
  similarityThreshold?: number
  categories?: string[]
}

export interface ISharedComponentDetector {
  /**
   * Detect components that appear across multiple pages
   */
  detectShared(
    pages: WebsitePage[],
    config?: SharedComponentConfig
  ): Promise<SharedComponentCandidate[]>

  /**
   * Calculate similarity between two component instances
   */
  calculateSimilarity(
    comp1: ComponentInstance,
    comp2: ComponentInstance
  ): number

  /**
   * Create WebsiteSharedComponent from pattern
   */
  createSharedComponent(
    candidate: SharedComponentCandidate,
    websiteId: string,
    componentTypeId: string
  ): Promise<WebsiteSharedComponent>

  /**
   * Identify component category (header, footer, navigation, etc.)
   */
  identifyComponentCategory(component: ComponentInstance): string

  /**
   * Generate name for shared component
   */
  generateComponentName(
    category: string,
    index: number
  ): string

  /**
   * Check if component is likely to be shared (header/footer patterns)
   */
  isLikelyShared(component: ComponentInstance): boolean

  /**
   * Group similar components across pages
   */
  groupSimilarComponents(
    components: ComponentInstance[],
    threshold?: number
  ): ComponentInstance[][]

  /**
   * Update page content to reference shared components
   */
  updatePageReferences(
    page: WebsitePage,
    sharedComponents: WebsiteSharedComponent[]
  ): Promise<WebsitePage>

  /**
   * Calculate usage count for shared component
   */
  calculateUsageCount(
    sharedComponentId: string,
    pages: WebsitePage[]
  ): number

  /**
   * Validate shared component configuration
   */
  validateSharedComponent(component: SharedComponentCandidate): boolean
}