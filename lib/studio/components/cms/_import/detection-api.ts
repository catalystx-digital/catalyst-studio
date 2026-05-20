import { z } from 'zod'
import { ComponentType, ComponentCategory } from '../_core/types'
import { CMSComponentFactory } from '../_factory/factory'
import { initializeCMSComponents } from '../_factory/initialize'
import { AIComponentMetadata } from '../_core/types'
import { performanceMonitor } from './performance'
import { zodSchemaToTypeString } from '../_core/component-definition'

export interface ComponentPattern {
  type: ComponentType
  category: ComponentCategory
  metadata: AIComponentMetadata
  confidence: number
  keywords: string[]
  patterns: string[]
  // Enriched from registry when available
  description?: string
  properties?: Array<{ name: string; type: string; required: boolean; description?: string; allowedTypes?: string[] }>
}

export interface DetectionFilter {
  category?: ComponentCategory
  minConfidence?: number
  types?: ComponentType[]
}

export interface DetectionRegistryStats {
  componentCount: number
  patternCacheEntries: number
  catalogCached: boolean
  cacheAgeMs: number | null
}

export class DetectionAPI {
  private factory: CMSComponentFactory
  private patternsCache: Map<string, ComponentPattern[]> = new Map()
  private catalogCache: ComponentPattern[] | null = null
  private cacheTimestamp: number = 0
  private readonly CACHE_TTL = 60000 // 60 seconds cache TTL

  constructor() {
    const anyFactory: any = CMSComponentFactory as any
    const instance = typeof anyFactory?.getInstance === 'function' ? anyFactory.getInstance() : anyFactory
    this.factory = instance as CMSComponentFactory
  }

  /**
   * Ensure the CMS component registry is initialized via the factory initializer.
   * This avoids DetectionAPI doing its own ad-hoc registrations.
   */
  private async ensureRegistryReady(): Promise<void> {
    try {
      const registry = this.factory.getRegistry()
      if (!registry || registry.size === 0) {
        await initializeCMSComponents()
      }
    } catch (e) {
      if (process.env.NODE_ENV === 'development') {
      console.warn('[DetectionAPI] Failed to initialize CMS components:', e)
      }
    }
  }

  /**
   * Detect component patterns and expose all registered components with their AI metadata
   */
  public detectComponentPatterns(filter?: DetectionFilter): ComponentPattern[] {
    return performanceMonitor.measureSync(
      'detectComponentPatterns',
      () => this._detectComponentPatterns(filter),
      { filter }
    )
  }

  /**
   * Async variant that ensures registry initialization before reading patterns.
   */
  public async detectComponentPatternsAsync(filter?: DetectionFilter): Promise<ComponentPattern[]> {
    await this.ensureRegistryReady()
    return this._detectComponentPatterns(filter)
  }
  
  private _detectComponentPatterns(filter?: DetectionFilter): ComponentPattern[] {
    const cacheKey = JSON.stringify(filter || {})
    
    // Check cache first with TTL
    if (this.patternsCache.has(cacheKey)) {
      const cached = this.patternsCache.get(cacheKey)!
      if (Date.now() - this.cacheTimestamp < this.CACHE_TTL) {
        return cached
      }
    }
    
    // Use catalog cache for unfiltered requests
    if (!filter && this.catalogCache && Date.now() - this.cacheTimestamp < this.CACHE_TTL) {
      return this.catalogCache
    }

    const patterns: ComponentPattern[] = []
    // Always read a fresh snapshot of the registry to avoid stale references
    const registry = this.factory.getRegistry()
    if (!registry || registry.size === 0) {
      if (process.env.NODE_ENV === 'development') {
      console.warn('[DetectionAPI] Component registry is empty. Ensure initializeCMSComponents() is called before detection.')
      }
    }

    for (const [type, registration] of registry.entries()) {
      // Exclude sub-only types from detection catalog for page-level proposals
      if ((registration as any)?.subOnly) {
        continue;
      }
      // Apply type filter
      if (filter?.types && !filter.types.includes(type)) {
        continue
      }

      // Get AI metadata
      const metadata = { ...registration.metadata } as any
      if (!metadata) continue

      // Apply confidence filter
      const confidence = metadata.confidence || 0.7
      if (filter?.minConfidence && confidence < filter.minConfidence) {
        continue
      }

      // Apply category filter
      const category = this.getCategoryForType(type)
      if (filter?.category && category !== filter.category) {
        continue
      }

      // Enrich metadata with optional description and props
      if (registration.description && !metadata.description) {
        metadata.description = registration.description
      }
      // Derive properties from Zod schema
      let properties: Array<{ name: string; type: string; required: boolean; description?: string }> | undefined
      if (registration.schema) {
        properties = Object.entries(registration.schema.shape).map(([name, zodType]: [string, any]) => {
          const typeString = zodSchemaToTypeString(zodType)
          const isRequired = !(zodType.isOptional() || zodType instanceof z.ZodOptional)
          const description = zodType._def?.description || undefined
          const allowedTypes = zodType._def?.allowedTypes as string[] | undefined
          return {
            name,
            type: typeString,
            required: isRequired,
            description,
            ...(allowedTypes ? { allowedTypes } : {})
          }
        })
        if (!metadata.properties) {
          metadata.properties = properties
        }
      }
      // Lightweight warnings to encourage completeness (non-fatal)
      if (!registration.schema) {
        if (process.env.NODE_ENV === 'development') {
          console.warn(`[DetectionAPI] Missing schema for component type: ${type}`)
        }
      }
      if (!registration.description && !(metadata as any).description) {
        if (process.env.NODE_ENV === 'development') {
          console.warn(`[DetectionAPI] Missing description for component type: ${type}`)
        }
      }

      patterns.push({
        type,
        category,
        metadata,
        confidence,
        keywords: metadata.keywords || [],
        patterns: metadata.patterns || [],
        description: registration.description,
        properties
      })
    }

    // Sort by confidence descending
    patterns.sort((a, b) => b.confidence - a.confidence)

    // Cache the results
    this.patternsCache.set(cacheKey, patterns)
    if (!filter) {
      this.catalogCache = patterns
    }
    this.cacheTimestamp = Date.now()

    return patterns
  }

  /**
   * Get all component patterns grouped by category
   */
  public getPatternsByCategory(): Map<ComponentCategory, ComponentPattern[]> {
    const patternsByCategory = new Map<ComponentCategory, ComponentPattern[]>()
    const allPatterns = this.detectComponentPatterns()

    for (const pattern of allPatterns) {
      const categoryPatterns = patternsByCategory.get(pattern.category) || []
      categoryPatterns.push(pattern)
      patternsByCategory.set(pattern.category, categoryPatterns)
    }

    return patternsByCategory
  }

  public getRegistryStats(): DetectionRegistryStats {
    const registry = this.factory.getRegistry()
    const componentCount = registry.size
    const now = Date.now()
    const cacheAgeMs = this.cacheTimestamp ? now - this.cacheTimestamp : null
    return {
      componentCount,
      patternCacheEntries: this.patternsCache.size,
      catalogCached: Boolean(this.catalogCache),
      cacheAgeMs
    }
  }

  /**
   * Get detection patterns for a specific component type
   */
  public getComponentPatterns(type: ComponentType): ComponentPattern | null {
    const patterns = this.detectComponentPatterns({ types: [type] })
    return patterns.length > 0 ? patterns[0] : null
  }

  /**
   * Get aggregated detection patterns for improved accuracy
   */
  public getAggregatedPatterns(): {
    keywords: Set<string>
    patterns: Set<string>
    domSelectors: Set<string>
  } {
    const allPatterns = this.detectComponentPatterns()
    const aggregated = {
      keywords: new Set<string>(),
      patterns: new Set<string>(),
      domSelectors: new Set<string>()
    }

    for (const pattern of allPatterns) {
      pattern.keywords.forEach(k => aggregated.keywords.add(k))
      pattern.patterns.forEach(p => aggregated.patterns.add(p))
      
      // Extract DOM selectors from patterns
      if ((pattern.metadata as any).domPatterns) {
        (pattern.metadata as any).domPatterns.forEach((selector: string) => {
          aggregated.domSelectors.add(selector)
        })
      }
    }

    return aggregated
  }

  /**
   * Clear pattern cache
   */
  public clearCache(): void {
    this.patternsCache.clear()
    this.catalogCache = null
    this.cacheTimestamp = 0
  }
  
  /**
   * Warm up cache by pre-loading all patterns
   */
  public async warmupCache(): Promise<void> {
    // Pre-load unfiltered catalog
    this.detectComponentPatterns()
    
    // Pre-load patterns for each category
    const categories = Object.values(ComponentCategory)
    for (const category of categories) {
      this.detectComponentPatterns({ category })
    }
  }

  /**
   * Helper to determine category from component type
   */
  private getCategoryForType(type: ComponentType): ComponentCategory {
    // Map component types to categories
    const typeToCategory: Partial<Record<ComponentType, ComponentCategory>> = {
      [ComponentType.HeroMinimal]: ComponentCategory.Heroes,
      [ComponentType.HeroSimple]: ComponentCategory.Heroes,
      [ComponentType.HeroWithImage]: ComponentCategory.Heroes,
      [ComponentType.HeroSplit]: ComponentCategory.Heroes,
      [ComponentType.HeroVideo]: ComponentCategory.Heroes,
      
      [ComponentType.NavBar]: ComponentCategory.Navigation,
      [ComponentType.Footer]: ComponentCategory.Navigation,
      [ComponentType.MobileMenu]: ComponentCategory.Navigation,
      [ComponentType.SideMenu]: ComponentCategory.Navigation,
      [ComponentType.MegaMenu]: ComponentCategory.Navigation,
      
      [ComponentType.TextBlock]: ComponentCategory.Content,
      [ComponentType.TwoColumn]: ComponentCategory.Content,
      [ComponentType.CardGrid]: ComponentCategory.Content,
      [ComponentType.Accordion]: ComponentCategory.Content,
      [ComponentType.Tabs]: ComponentCategory.Content,
      
      [ComponentType.PricingTable]: ComponentCategory.Pricing,
      [ComponentType.PricingCard]: ComponentCategory.Pricing,
      [ComponentType.PricingComparison]: ComponentCategory.Pricing,
      
      [ComponentType.DataTable]: ComponentCategory.Data,
      [ComponentType.Chart]: ComponentCategory.Data,
      [ComponentType.Statistics]: ComponentCategory.Data,
      
      [ComponentType.FeatureGrid]: ComponentCategory.Features,
      [ComponentType.FeatureList]: ComponentCategory.Features,
      [ComponentType.FeatureComparison]: ComponentCategory.Features,
      
      [ComponentType.Testimonials]: ComponentCategory.SocialProof,
      [ComponentType.LogoCloud]: ComponentCategory.SocialProof,
      [ComponentType.Reviews]: ComponentCategory.SocialProof,
      [ComponentType.CaseStudy]: ComponentCategory.SocialProof,
      
      [ComponentType.ContactForm]: ComponentCategory.Contact,
      [ComponentType.ContactInfo]: ComponentCategory.Contact,
      [ComponentType.LocationMap]: ComponentCategory.Contact,
      
      [ComponentType.TeamGrid]: ComponentCategory.About,
      [ComponentType.TeamMember]: ComponentCategory.About,
      [ComponentType.Timeline]: ComponentCategory.About,
      [ComponentType.Mission]: ComponentCategory.About,
      
      [ComponentType.BlogPost]: ComponentCategory.Blog,
      [ComponentType.BlogList]: ComponentCategory.Blog,
      [ComponentType.BlogCard]: ComponentCategory.Blog,
      
      [ComponentType.CTASimple]: ComponentCategory.CTA,
      [ComponentType.CTAWithForm]: ComponentCategory.CTA,
      [ComponentType.CTABanner]: ComponentCategory.CTA,
      [ComponentType.CTAButtonGroup]: ComponentCategory.CTA
    }

    return typeToCategory[type] || ComponentCategory.Content
  }
}

// Export singleton instance
export const detectionAPI = new DetectionAPI()
