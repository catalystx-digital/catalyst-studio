import { ComponentType } from '@/lib/studio/components/cms/_core/types'
import { pageTemplateFactory } from '../../_factory/page-factory'
import { PageTemplateCategory } from '../../_core/types'
import type { TemplateManifest } from '../../_core/manifest'
import { definePageContentSchema } from '../../_core/content-schema'
import { getHeroComponentTypes } from '@/lib/studio/components/cms/_core/definition-loader'

const HERO_COMPONENTS: ComponentType[] = [
  ComponentType.HeroSimple,
  ComponentType.HeroMinimal,
  ComponentType.HeroWithImage,
  ComponentType.HeroBanner
]

const REQUIRED_MAIN_COMPONENTS: ComponentType[] = [ComponentType.BlogList]

const OPTIONAL_MAIN_COMPONENTS: ComponentType[] = [
  ComponentType.CardGrid,
  ComponentType.FeatureList,
  ComponentType.FeatureGrid,
  ComponentType.TwoColumn,
  ComponentType.TextBlock,
  ComponentType.VideoPlayer,
  ComponentType.ImageGallery,
  ComponentType.Testimonials,
  ComponentType.LogoCloud,
  ComponentType.CTASimple,
  ComponentType.CTAWithForm,
  ComponentType.CTAButtonGroup,
  ComponentType.Tabs,
  ComponentType.SimpleForm
]

const ALL_PAGE_COMPONENTS: ComponentType[] = Array.from(
  new Set<ComponentType>([
    ComponentType.NavBar,
    ComponentType.Footer,
    ...HERO_COMPONENTS,
    ...REQUIRED_MAIN_COMPONENTS,
    ...OPTIONAL_MAIN_COMPONENTS
  ])
)

const manifest: TemplateManifest = {
  registration: {
    templateKey: 'blog/index-standard',
    name: 'Blog Index',
    category: PageTemplateCategory.Blog,
    isHomeEligible: false,
    description: 'Listing page for blog articles with category filters and subscription prompts.',
    requiredRegions: [
      {
        region: 'header',
        allowedComponents: [
          ComponentType.NavBar,
          ComponentType.CTASimple,
          ComponentType.TextBlock,
          ComponentType.FeatureList,
          ComponentType.Breadcrumbs,
          ComponentType.Breadcrumb,
          ComponentType.SideMenu
        ],
        min: 1,
        description: 'Primary navigation shared across marketing pages. Supports pre-header utility components like hotline CTAs, quick-exit banners, and quick links.'
      },
      {
        region: 'main',
        allowedComponents: REQUIRED_MAIN_COMPONENTS,
        min: 1,
        max: 1,
        description: 'Central list of blog articles grouped or filtered as needed.'
      }
    ],
    optionalRegions: [
      {
        region: 'hero',
        allowedComponents: HERO_COMPONENTS,
        max: 1,
        description: 'Introductory hero summarizing blog purpose or featured category.'
      },
      {
        region: 'main',
        allowedComponents: OPTIONAL_MAIN_COMPONENTS,
        description:
          'Supplementary sections such as featured categories, interviews, multimedia highlights, or CTAs.'
      },
      {
        region: 'footer',
        allowedComponents: [ComponentType.Footer],
        max: 1,
        description: 'Footer with newsletter signup or navigation.'
      }
    ],
    propsMeta: {
      defaultCategoryFilter: {
        type: 'string',
        required: false,
        description: 'Category or tag to emphasize in hero copy and list filtering.'
      },
      featuredPosts: {
        type: 'content-reference[]',
        required: false,
        description: 'Pinned posts that should be highlighted before the main list.',
        allowedComponentTypes: [ComponentType.BlogCard]
      },
      subscribeCta: {
        type: 'content-reference',
        required: false,
        description: 'Newsletter CTA placement associated with the blog list.',
        allowedComponentTypes: [ComponentType.CTASimple, ComponentType.CTAWithForm]
      }
    },
    contentSchema: definePageContentSchema({
      components: {
        type: 'content[]',
        required: true,
        description: 'Ordered component instances spanning header, hero, main, and footer regions.',
        allowedComponentTypes: ALL_PAGE_COMPONENTS
      }
    }),
    aiMetadata: {
      keywords: ['blog index', 'article list', 'content marketing', 'news hub'],
      layoutGuidelines: [
        'Ensure the blog list remains the primary focus of the main region.',
        'Optional hero should summarize topics or highlight a featured series.',
        'Supporting sections should not interrupt the continuity of the article list.',
        'Include a footer or CTA for newsletter subscriptions when available.'
      ],
      contentGuidelines: [
        'Surface publish date and author information within the list entries when possible.',
        'Keep teaser copy concise (1-2 sentences) to aid scanning.',
        'Avoid duplicating the same article across featured and main listings.'
      ],
      recommendedComponents: [ComponentType.BlogList, ComponentType.CardGrid, ComponentType.CTAWithForm],
      discouragedComponents: [ComponentType.PricingTable, ComponentType.PricingComparison],
      exampleUseCases: ['Thought leadership hub', 'Company news archive', 'Resource center index'],
      routeHints: ['/blog', '/resources']
    }
  }
}

export function registerTemplate(): void {
  if (pageTemplateFactory.getTemplate('blog/index-standard')) {
    return
  }

  pageTemplateFactory.registerManifest(manifest)
}
