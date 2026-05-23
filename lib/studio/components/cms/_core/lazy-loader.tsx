import { lazy, Suspense, ComponentType as ReactComponentType, createElement } from 'react'

import { ComponentType, ComponentCategory, CMSComponentProps } from './types'



// Performance tracking wrapper

const withPerformanceTracking = (

  Component: ReactComponentType<any>,

  componentName: string

) => {

  return (props: any) => {

    const startTime = performance.now()

    

    // Track render time in development

    if (process.env.NODE_ENV === 'development') {

      const renderTime = performance.now() - startTime

      if (renderTime > 50) {

        if (process.env.NODE_ENV === 'development') {
        console.warn(`[Performance] ${componentName} rendered in ${renderTime.toFixed(2)}ms`)
        }

      }

    }

    

    return createElement(Component, props)

  }

}



// Category-based loading skeletons

const getCategorySkeleton = (category: ComponentCategory) => {

  switch (category) {

    case ComponentCategory.Navigation:

      return <div className="h-16 animate-pulse bg-muted/70" />

    case ComponentCategory.Heroes:

      return <div className="h-96 animate-pulse bg-muted/70" />

    case ComponentCategory.Content:

      return <div className="h-64 animate-pulse rounded-lg bg-muted/70" />

    case ComponentCategory.Features:

      return <div className="grid grid-cols-3 gap-4">

        {[1, 2, 3].map(i => (

          <div key={i} className="h-32 animate-pulse rounded bg-muted/70" />

        ))}

      </div>

    case ComponentCategory.CTA:

      return <div className="h-32 animate-pulse rounded-lg bg-primary/20" />

    case ComponentCategory.SocialProof:

      return <div className="h-48 animate-pulse bg-muted/70" />

    case ComponentCategory.Contact:

      return <div className="h-96 animate-pulse rounded-lg bg-muted/70" />

    case ComponentCategory.About:

      return <div className="h-64 animate-pulse bg-muted/70" />

    case ComponentCategory.Blog:

      return <div className="space-y-4">

        {[1, 2].map(i => (

          <div key={i} className="h-32 animate-pulse rounded bg-muted/70" />

        ))}

      </div>

    case ComponentCategory.Pricing:

      return <div className="h-96 animate-pulse rounded-lg bg-muted/70" />

    case ComponentCategory.Data:

      return <div className="h-64 animate-pulse bg-muted/70" />

    default:

      return <div className="flex h-32 items-center justify-center">

        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-border"></div>

      </div>

  }

}



// Component manifest for dynamic imports.
const componentManifest: Partial<Record<ComponentType, () => Promise<any>>> = {
  // Navigation Components

  [ComponentType.NavBar]: () => import('../navigation/nav-bar').then(m => ({ default: m.NavBar })),

  [ComponentType.Footer]: () => import('../navigation/footer').then(m => ({ default: m.Footer })),

  [ComponentType.MobileMenu]: () => import('../navigation/mobile-menu').then(m => ({ default: m.MobileMenu })),

  [ComponentType.Breadcrumbs]: () => import('../navigation/breadcrumbs').then(m => ({ default: m.Breadcrumbs })),

  

  // Hero Components

  [ComponentType.HeroBanner]: () => import('../heroes/hero-banner'),

  [ComponentType.HeroSplit]: () => import('../heroes/hero-split'),

  [ComponentType.HeroMinimal]: () => import('../heroes/hero-minimal'),

  [ComponentType.HeroVideo]: () => import('../heroes/hero-video'),

  [ComponentType.HeroCarousel]: () => import('../heroes/hero-carousel'),

  

  // Content Components

  [ComponentType.TextBlock]: () => import('../content/text-block'),

  [ComponentType.TwoColumn]: () => import('../content/two-column'),

  [ComponentType.ImageGallery]: () => import('../content/image-gallery'),

  [ComponentType.VideoPlayer]: () => import('../content/video-player'),

  [ComponentType.Accordion]: () => import('../content/accordion'),

  [ComponentType.Tabs]: () => import('../content/tabs'),

  [ComponentType.CardGrid]: () => import('../content/card-grid'),

  [ComponentType.QuoteBlock]: () => import('../content/quote-block'),

  

  // Feature Components

  [ComponentType.FeatureGrid]: () => import('../features/feature-grid'),

  [ComponentType.FeatureList]: () => import('../features/feature-list'),

  [ComponentType.FeatureComparison]: () => import('../features/feature-comparison'),

  

  // CTA Components

  [ComponentType.CTABanner]: () => import('../cta/cta-banner'),

  [ComponentType.CTAButtonGroup]: () => import('../cta/cta-button-group'),

  [ComponentType.CTAWithForm]: () => import('../cta/cta-newsletter'),

  

  // Social Proof Components - Using adapters for now

  [ComponentType.Testimonials]: () => import('../social-proof/testimonial-grid'),

  [ComponentType.LogoCloud]: () => import('../social-proof/logo-strip'),

  [ComponentType.Reviews]: () => import('../social-proof/review-card'),

  

  // Contact Components

  [ComponentType.ContactForm]: () => import('../contact/contact-form'),

  [ComponentType.ContactInfo]: () => import('../contact/contact-info'),

  [ComponentType.LocationMap]: () => import('../contact/location-map'),

  [ComponentType.SimpleForm]: () => import('../contact/simple-form'),

  

  // About Components

  [ComponentType.TeamGrid]: () => import('../about/team-grid'),

  [ComponentType.TeamMember]: () => import('../about/team-member'),

  [ComponentType.AboutSection]: () => import('../about/about-section'),

  [ComponentType.Mission]: () => import('../about/mission-statement'),

  

  // Blog Components

  [ComponentType.BlogPost]: () => import('../blog/blog-post'),

  [ComponentType.BlogList]: () => import('../blog/blog-list'),

  [ComponentType.BlogCard]: () => import('../blog/blog-card'),

  [ComponentType.ArticleHeader]: () => import('../blog/article-header'),

  [ComponentType.AuthorBio]: () => import('../blog/author-bio'),

  [ComponentType.RelatedPosts]: () => import('../blog/related-posts'),

  

  // Pricing Components

  [ComponentType.PricingTable]: () => import('../pricing/pricing-table'),

  [ComponentType.PricingCard]: () => import('../pricing/pricing-card'),

  

  // Data Components

  [ComponentType.Timeline]: () => import('../data/timeline'),

  [ComponentType.DataTable]: () => import('../data/data-table'),

  [ComponentType.Chart]: () => import('../data/chart'),

  [ComponentType.Statistics]: () => import('../data/statistics'),

  

  [ComponentType.HeroSimple]: () => import('../heroes/hero-simple'),

  [ComponentType.HeroWithImage]: () => import('../heroes/hero-with-image'),

  [ComponentType.VideoEmbed]: () => import('../content/video-embed'),

  [ComponentType.CTASimple]: () => import('../cta/cta-simple')

}



// Category bundles for preloading

const categoryBundles: Record<ComponentCategory, ComponentType[]> = {

  [ComponentCategory.Navigation]: [

    ComponentType.NavBar,

    ComponentType.Footer,

    ComponentType.MobileMenu,

    ComponentType.Breadcrumbs

  ],

  [ComponentCategory.Heroes]: [

    ComponentType.HeroBanner,

    ComponentType.HeroSplit,

    ComponentType.HeroMinimal,

    ComponentType.HeroVideo,

    ComponentType.HeroCarousel

  ],

  [ComponentCategory.Content]: [

    ComponentType.TextBlock,

    ComponentType.TwoColumn,

    ComponentType.ImageGallery,

    ComponentType.VideoPlayer,

    ComponentType.Accordion,

    ComponentType.Tabs,

    ComponentType.CardGrid,

    ComponentType.QuoteBlock

  ],

  [ComponentCategory.Features]: [

    ComponentType.FeatureGrid,

    ComponentType.FeatureList,

    ComponentType.FeatureComparison

  ],

  [ComponentCategory.CTA]: [

    ComponentType.CTABanner,

    ComponentType.CTAButtonGroup,

    ComponentType.CTAWithForm

  ],

  [ComponentCategory.SocialProof]: [

    ComponentType.Testimonials,

    ComponentType.LogoCloud,

    ComponentType.Reviews

  ],

  [ComponentCategory.Contact]: [

    ComponentType.ContactForm,

    ComponentType.ContactInfo,

    ComponentType.LocationMap

  ],

  [ComponentCategory.About]: [

    ComponentType.TeamGrid,

    ComponentType.TeamMember,

    ComponentType.AboutSection,

    ComponentType.Timeline,

    ComponentType.Mission

  ],

  [ComponentCategory.Blog]: [

    ComponentType.BlogPost,

    ComponentType.BlogList,

    ComponentType.BlogCard,

    ComponentType.ArticleHeader,

    ComponentType.AuthorBio,

    ComponentType.RelatedPosts

  ],

  [ComponentCategory.Pricing]: [

    ComponentType.PricingTable,

    ComponentType.PricingCard

  ],

  [ComponentCategory.Data]: [

    ComponentType.DataTable,

    ComponentType.Chart,

    ComponentType.Statistics

  ]

}



// Cache for loaded components

const componentCache = new Map<ComponentType, ReactComponentType<CMSComponentProps>>()

const loadingPromises = new Map<ComponentType, Promise<ReactComponentType<CMSComponentProps>>>()



/**

 * Lazy load a component with performance tracking

 */

export function lazyLoadComponent(

  type: ComponentType,

  category: ComponentCategory

): ReactComponentType<CMSComponentProps> {

  // Check cache first

  if (componentCache.has(type)) {

    return componentCache.get(type)!

  }



  const LazyComponent = lazy(async () => {

    const loader = componentManifest[type]

    if (!loader) {

      if (process.env.NODE_ENV === 'development') {
      console.warn(`No loader found for component type: ${type}`)
      }

      throw new Error(`No loader found for component type: ${type}`)

    }



    try {

      const module = await loader()

      const Component = module.default || module[Object.keys(module)[0]]

      

      // Wrap with performance tracking

      const TrackedComponent = withPerformanceTracking(Component, type)

      

      return { default: TrackedComponent }

    } catch (error) {

      if (process.env.NODE_ENV === 'development') {
      console.error(`Failed to load component ${type}:`, error)
      }

      throw error

    }

  })



  // Create wrapper component with Suspense

  const WrappedComponent = (props: CMSComponentProps) => (

    <Suspense fallback={getCategorySkeleton(category)}>

      <LazyComponent {...props} />

    </Suspense>

  )



  // Cache the wrapped component

  componentCache.set(type, WrappedComponent)

  

  return WrappedComponent

}



/**

 * Preload components by category for better performance

 */

export async function preloadCategory(category: ComponentCategory): Promise<void> {

  const components = categoryBundles[category] || []

  

  await Promise.all(

    components.map(async type => {

      if (componentCache.has(type)) {

        return // Already loaded

      }



      const loader = componentManifest[type]

      if (!loader) {

        throw new Error(`No loader found for component type: ${type}`)

      }



      try {

        // Preload the component module

        await loader()

      } catch (error) {

        if (process.env.NODE_ENV === 'development') {
        console.error(`Failed to preload component ${type}:`, error)
        }

        throw error

      }

    })

  )

}



/**

 * Preload specific components

 */

export async function preloadComponents(types: ComponentType[]): Promise<void> {

  await Promise.all(

    types.map(async type => {

      const loader = componentManifest[type]

      if (!loader) {

        throw new Error(`No loader found for component type: ${type}`)

      }



      try {

        await loader()

      } catch (error) {

        if (process.env.NODE_ENV === 'development') {
        console.error(`Failed to preload component ${type}:`, error)
        }

        throw error

      }

    })

  )

}



/**

 * Get component category from type

 */

export function getComponentCategory(type: ComponentType): ComponentCategory {

  for (const [category, types] of Object.entries(categoryBundles)) {

    if (types.includes(type)) {

      return category as ComponentCategory

    }

  }

  return ComponentCategory.Content // Default fallback

}



/**

 * Clear component cache (useful for hot reloading in development)

 */

export function clearComponentCache(): void {

  componentCache.clear()

  loadingPromises.clear()

}



// Export for use in factory

export const lazyLoader = {

  loadComponent: lazyLoadComponent,

  preloadCategory,

  preloadComponents,

  getComponentCategory,

  clearCache: clearComponentCache

}
