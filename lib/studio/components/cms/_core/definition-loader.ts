/**
 * Component Definition Loader
 *
 * Loads current *.def.ts component definitions using defineComponent().
 */

import { ComponentDefinition } from './component-definition'
import { ComponentType } from './types'
import { z } from 'zod'

/**
 * Registry of loaded component definitions
 * Maps ComponentType -> ComponentDefinition
 */
const definitionRegistry = new Map<ComponentType, ComponentDefinition<z.ZodObject<any>>>()

/**
 * Load status tracking
 */
let isInitialized = false

/**
 * Register a component definition from a .def.ts file
 *
 * @param definition - Component definition created with defineComponent()
 */
export function registerDefinition<T extends z.ZodObject<any>>(
  definition: ComponentDefinition<T>
): void {
  definitionRegistry.set(definition.type, definition)
}

/**
 * Get a registered component definition
 *
 * @param type - Component type
 * @returns Component definition or undefined if not found
 */
export function getDefinition(
  type: ComponentType
): ComponentDefinition<z.ZodObject<any>> | undefined {
  return definitionRegistry.get(type)
}

/**
 * Check if a component has a .def.ts file registered
 *
 * @param type - Component type
 * @returns true if component has a definition file
 */
export function hasDefinition(type: ComponentType): boolean {
  return definitionRegistry.has(type)
}

/**
 * Get all registered component definitions
 *
 * @returns Array of all component definitions
 */
export function getAllDefinitions(): ComponentDefinition<z.ZodObject<any>>[] {
  return Array.from(definitionRegistry.values())
}

/**
 * Get all registered component types
 *
 * @returns Array of component types that have definitions
 */
export function getDefinedTypes(): ComponentType[] {
  return Array.from(definitionRegistry.keys())
}

/**
 * Clear all registered definitions (useful for testing)
 */
export function clearDefinitions(): void {
  definitionRegistry.clear()
  isInitialized = false
}

/**
 * Load all component definitions from *.def.ts files
 *
 * This function dynamically imports all definition files and registers them.
 * It should be called during application initialization.
 */
export async function loadAllDefinitions(): Promise<void> {
  if (isInitialized) {
    return
  }

  // Import all .def.ts files and register them
  const definitions = await Promise.all([
    // About (3)
    import('../about/about-section/about-section.def'),
    import('../about/team-grid/team-grid.def'),
    import('../about/team-member/team-member.def'),

    // Blog (6)
    import('../blog/article-header/article-header.def'),
    import('../blog/author-bio/author-bio.def'),
    import('../blog/blog-card/blog-card.def'),
    import('../blog/blog-list/blog-list.def'),
    import('../blog/blog-post/blog-post.def'),
    import('../blog/related-posts/related-posts.def'),

    // Contact (4)
    import('../contact/contact-form/contact-form.def'),
    import('../contact/contact-info/contact-info.def'),
    import('../contact/location-map/location-map.def'),
    import('../contact/simple-form/simple-form.def'),

    // Content (14)
    import('../content/accordion/accordion.def'),
    import('../content/card-grid/card-grid.def'),
    import('../content/card-item/card-item.def'),
    import('../content/content-feed/content-feed.def'),
    import('../content/html-block/html-block.def'),
    import('../content/image-gallery/image-gallery.def'),
    import('../content/promo-item/promo-item.def'),
    import('../content/quote-block/quote-block.def'),
    import('../content/tabs/tabs.def'),
    import('../content/text-block/text-block.def'),
    import('../content/two-column/two-column.def'),
    import('../content/video-embed/video-embed.def'),
    import('../content/video-player/video-player.def'),

    // CTA (4)
    import('../cta/cta-banner/cta-banner.def'),
    import('../cta/cta-button-group/cta-button-group.def'),
    import('../cta/cta-newsletter/cta-newsletter.def'),
    import('../cta/cta-simple/cta-simple.def'),

    // Data (4)
    import('../data/chart/chart.def'),
    import('../data/data-table/data-table.def'),
    import('../data/statistics/statistics.def'),
    import('../data/timeline/timeline.def'),

    // Features (5)
    import('../features/feature-comparison/feature-comparison.def'),
    import('../features/feature-grid/feature-grid.def'),
    import('../features/feature-item/feature-item.def'),
    import('../features/feature-list/feature-list.def'),
    import('../features/feature-showcase/feature-showcase.def'),

    // Heroes (7)
    import('../heroes/hero-banner/hero-banner.def'),
    import('../heroes/hero-carousel/hero-carousel.def'),
    import('../heroes/hero-minimal/hero-minimal.def'),
    import('../heroes/hero-simple/hero-simple.def'),
    import('../heroes/hero-split/hero-split.def'),
    import('../heroes/hero-video/hero-video.def'),
    import('../heroes/hero-with-image/hero-with-image.def'),

    // Navigation (7)
    import('../navigation/breadcrumbs/breadcrumbs.def'),
    import('../navigation/footer/footer.def'),
    import('../navigation/mobile-menu/mobile-menu.def'),
    import('../navigation/nav-bar/nav-bar.def'),
    import('../navigation/nav-menu-item/nav-menu-item.def'),
    import('../navigation/sidebar-nav/sidebar-nav.def'),
    import('../navigation/sidemenu/sidemenu.def'),

    // Pricing (2)
    import('../pricing/pricing-card/pricing-card.def'),
    import('../pricing/pricing-table/pricing-table.def'),

    // Social Proof (4)
    import('../social-proof/logo-strip/logo-strip.def'),
    import('../social-proof/review-card/review-card.def'),
    import('../social-proof/testimonial-grid/testimonial-grid.def'),
    import('../social-proof/testimonial-item/testimonial-item.def'),
    import('../social-proof/testimonial-slider/testimonial-slider.def'),
  ])

  // Register each definition
  definitions.forEach(module => {
    // Convention: export should be named {ComponentName}Def
    const definitionExport = Object.values(module).find(
      (value): value is ComponentDefinition<z.ZodObject<any>> =>
        typeof value === 'object' &&
        value !== null &&
        'type' in value &&
        'category' in value &&
        'schema' in value
    )

    if (definitionExport) {
      registerDefinition(definitionExport)
    }
  })

  isInitialized = true
}

/**
 * Get component metadata from the registered .def.ts definition.
 *
 * @param type - Component type
 * @returns Object with definition metadata or null if not found
 */
export function getComponentMetadataSources(type: ComponentType): {
  source: 'definition'
  definition: ComponentDefinition<z.ZodObject<any>>
} | null {
  const definition = getDefinition(type)
  if (definition) {
    return {
      source: 'definition',
      definition
    }
  }

  return null
}

/**
 * Get statistics about the definition registry
 */
export function getDefinitionStats(): {
  totalDefined: number
  definedTypes: ComponentType[]
  isInitialized: boolean
} {
  return {
    totalDefined: definitionRegistry.size,
    definedTypes: Array.from(definitionRegistry.keys()),
    isInitialized
  }
}

/**
 * Get all component types that belong to a specific category
 *
 * @param category - Component category to filter by
 * @returns Array of component types in that category
 */
export function getComponentsByCategory(category: string): ComponentType[] {
  const results: ComponentType[] = []

  for (const [type, definition] of definitionRegistry.entries()) {
    if (definition.category === category) {
      results.push(type)
    }
  }

  return results
}

/**
 * Get all component types that match a specific prefix pattern
 * Useful for grouping like hero-*, cta-*, etc.
 *
 * @param prefix - Prefix to match (e.g., 'hero-', 'cta-')
 * @returns Array of component types matching the prefix
 */
export function getComponentsByPrefix(prefix: string): ComponentType[] {
  const results: ComponentType[] = []

  for (const type of definitionRegistry.keys()) {
    if (type.startsWith(prefix)) {
      results.push(type)
    }
  }

  return results
}

/**
 * Get all component types that are suitable for a specific region
 * Based on aiMetadata.pageLocation
 *
 * @param region - Page region (header, hero, main, footer)
 * @returns Array of component types suitable for that region
 */
export function getComponentsForRegion(region: string): ComponentType[] {
  const results: ComponentType[] = []

  for (const [type, definition] of definitionRegistry.entries()) {
    if (definition.detection?.pageLocation?.includes(region as any)) {
      results.push(type)
    }
  }

  return results
}

/**
 * Get all hero component types
 * Returns all ComponentType values that start with 'hero-'
 *
 * @returns Set of hero component types
 */
export function getHeroComponentTypes(): Set<string> {
  return new Set([
    ComponentType.HeroSimple,
    ComponentType.HeroWithImage,
    ComponentType.HeroVideo,
    ComponentType.HeroCarousel,
    ComponentType.HeroBanner,
    ComponentType.HeroSplit,
    ComponentType.HeroMinimal
  ])
}

/**
 * Get all CTA component types suitable for header region
 * Used by region assignment to determine header-eligible components
 *
 * @returns Set of header-eligible CTA/text components
 */
export function getHeaderEligibleComponentTypes(): Set<string> {
  return new Set([
    ComponentType.CTASimple,
    ComponentType.CTABanner,
    ComponentType.CTAButtonGroup,
    ComponentType.TextBlock
  ])
}

/**
 * Get all component types that can be used for fallback creation
 * These are simple, stable components that can be safely auto-generated
 *
 * @returns Set of fallback-eligible component types
 */
export function getFallbackComponentTypes(): Set<string> {
  return new Set([
    ComponentType.TextBlock,
    ComponentType.BlogPost,
    ComponentType.NavBar,
    ComponentType.Footer
  ])
}

/**
 * Get all component types that indicate detail/single-item pages
 * Used for content type detection
 *
 * @returns Set of detail component types
 */
export function getDetailComponentTypes(): Set<string> {
  return new Set([
    ComponentType.BlogPost,
    ComponentType.ArticleHeader,
    ComponentType.AuthorBio
  ])
}

/**
 * Get all sub-component types
 * These are components used inside other components (not top-level)
 *
 * @returns Set of sub-component types
 */
export function getSubComponentTypes(): Set<string> {
  return new Set([
    // Content sub-components (used inside parent components)
    ComponentType.AccordionItem,
    ComponentType.TabItem,
    ComponentType.CardItem,
    ComponentType.PromoItem,
    ComponentType.FeatureItem,
    ComponentType.ShowcaseSection,
    ComponentType.TestimonialItem,
    ComponentType.TeamMember,
    ComponentType.TimelineEvent,
    ComponentType.TimelineAction,
    ComponentType.BlogCard,
    // Navigation sub-components (used inside navbar, footer, sidemenu)
    ComponentType.NavMenuItem,
    ComponentType.ColumnItem,
    ComponentType.SocialLinkItem,
    ComponentType.MobileMenu,
    ComponentType.MegaMenu,
    ComponentType.Breadcrumb,
    ComponentType.SidebarNav
  ])
}

/**
 * Get all component types suitable for main content region
 * Filters out sub-components to get only top-level components
 *
 * @returns Set of main region component types
 */
export function getMainRegionComponentTypes(): Set<string> {
  const allTypes = Object.values(ComponentType) as ComponentType[]
  const subComponents = getSubComponentTypes()

  return new Set(
    allTypes.filter(type => !subComponents.has(type))
  )
}

/**
 * Get all CTA component types
 * Returns all ComponentType values in the CTA category
 *
 * @returns Set of CTA component types
 */
export function getCTAComponentTypes(): Set<string> {
  return new Set([
    ComponentType.CTASimple,
    ComponentType.CTAWithForm,
    ComponentType.CTABanner,
    ComponentType.CTAButtonGroup
  ])
}

/**
 * Get all listing component types
 * Components that display lists of items (blog lists, card grids, etc.)
 *
 * @returns Set of listing component types
 */
export function getListingComponentTypes(): Set<string> {
  return new Set([
    ComponentType.CardGrid,
    ComponentType.BlogList,
    ComponentType.FeatureGrid
  ])
}

/**
 * Get LLM directives for a specific component type
 * Directives are extraction instructions used by the import pipeline
 *
 * @param componentType - Component type (string, e.g., 'card-grid')
 * @returns Array of directive strings, or empty array if none found
 */
export function getDirectives(componentType: string): string[] {
  // Normalize the component type to handle both kebab-case and enum values
  const normalizedType = componentType.toLowerCase().replace(/_/g, '-')

  // Try to find by direct match first
  for (const [type, definition] of definitionRegistry.entries()) {
    if (type === componentType || type === normalizedType) {
      return definition.directives ?? []
    }
  }

  // Try by lowercase comparison
  for (const [type, definition] of definitionRegistry.entries()) {
    if (type.toLowerCase() === normalizedType) {
      return definition.directives ?? []
    }
  }

  return []
}

/**
 * Get all component types that have directives defined
 * Useful for debugging and validation
 *
 * @returns Map of component type to directives array
 */
export function getAllDirectives(): Map<string, string[]> {
  const result = new Map<string, string[]>()

  for (const [type, definition] of definitionRegistry.entries()) {
    if (definition.directives && definition.directives.length > 0) {
      result.set(type, definition.directives)
    }
  }

  return result
}
