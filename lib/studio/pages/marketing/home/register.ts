import { ComponentType } from '@/lib/studio/components/cms/_core/types'
import { pageTemplateFactory } from '../../_factory/page-factory'
import { PageTemplateCategory } from '../../_core/types'
import type { TemplateManifest } from '../../_core/manifest'
import { definePageContentSchema } from '../../_core/content-schema'
import { getHeroComponentTypes } from '@/lib/studio/components/cms/_core/definition-loader'

const HERO_COMPONENTS: ComponentType[] = Array.from(getHeroComponentTypes()) as ComponentType[]

const MAIN_REGION_COMPONENTS: ComponentType[] = [
  ComponentType.AboutSection,
  ComponentType.FeatureGrid,
  ComponentType.FeatureList,
  ComponentType.FeatureShowcase,
  ComponentType.FeatureComparison,
  ComponentType.CardGrid,
  ComponentType.ContentFeed,
  ComponentType.Testimonials,
  ComponentType.LogoCloud,
  ComponentType.Reviews,
  ComponentType.Statistics,
  ComponentType.PricingTable,
  ComponentType.PricingCard,
  ComponentType.PricingComparison,
  ComponentType.CTASimple,
  ComponentType.CTAWithForm,
  ComponentType.CTABanner,
  ComponentType.CTAButtonGroup,
  ComponentType.BlogList,
  ComponentType.Breadcrumbs,
  ComponentType.Breadcrumb,
  ComponentType.SideMenu,
  ComponentType.TwoColumn,
  ComponentType.ImageGallery,
  ComponentType.TextBlock,
  ComponentType.Accordion,
  ComponentType.ContactForm,
  ComponentType.SimpleForm,
  ComponentType.ContactInfo,
  ComponentType.LocationMap,
  ComponentType.VideoEmbed
]

const ALL_PAGE_COMPONENTS: ComponentType[] = Array.from(
  new Set<ComponentType>([
    ComponentType.NavBar,
    ComponentType.Footer,
    ...HERO_COMPONENTS,
    ...MAIN_REGION_COMPONENTS
  ])
)

const manifest: TemplateManifest = {
  registration: {
    templateKey: 'marketing/home-default',
    name: 'Marketing Home',
    category: PageTemplateCategory.Marketing,
    isHomeEligible: true,
    childContainment: ['*'],
    description: 'Standard marketing homepage with hero, highlights, social proof, and footer.',
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
        description:
          'Primary navigation with branding and top-level links. Capture pre-header utility announcements (e.g., quick exit banners or hotline CTAs) using CTA/text components before the nav, use feature-list for icon-based quick links so the trading-hours strip → quick links → navbar order matches the live header. Search functionality is integrated into the navbar component via the search property.'
      },
    ],
    optionalRegions: [
      {
        region: 'hero',
        allowedComponents: HERO_COMPONENTS,
        min: 0, // Explicitly make hero optional for imports
        description: 'Above-the-fold hero introducing the value proposition. Optional for imported pages.'
      },
      {
        region: 'main',
        allowedComponents: MAIN_REGION_COMPONENTS,
        description:
          'Primary marketing sections mixing feature highlights, pricing, social proof, and supporting content.'
      },
      {
        region: 'footer',
        allowedComponents: [ComponentType.Footer],
        min: 0,
        description: 'Footer with contact details, navigation, and compliance links when present in the source.'
      }
    ],
    propsMeta: {
      primaryHeroVariant: {
        type: 'enum',
        required: false,
        description: 'Preferred hero implementation for auto-generated content.',
        allowedValues: HERO_COMPONENTS
      },
      featuredHighlights: {
        type: 'content-reference[]',
        required: false,
        description: 'Ordered list of highlight sections to feature below the hero.',
        allowedComponentTypes: [
          ComponentType.FeatureGrid,
          ComponentType.FeatureList,
          ComponentType.FeatureShowcase,
          ComponentType.FeatureComparison,
          ComponentType.CardGrid
        ]
      },
      supportingSocialProof: {
        type: 'content-reference',
        required: false,
        description: 'Social proof block to reinforce credibility in the main region.',
        allowedComponentTypes: [
          ComponentType.Testimonials,
          ComponentType.LogoCloud,
          ComponentType.Reviews
        ]
      },
      primaryCallToAction: {
        type: 'string',
        required: false,
        description: 'Default CTA label used when generating hero or footer actions.'
      }
    },
    contentSchema: definePageContentSchema({
      components: {
        type: 'content[]',
        required: true,
        description: 'Complete ordered component stream for this homepage.',
        allowedComponentTypes: ALL_PAGE_COMPONENTS
      }
    }),
    aiMetadata: {
      keywords: ['home', 'landing page', 'marketing', 'saas', 'product overview'],
      layoutGuidelines: [
        'Always render navigation before the hero to anchor the brand.',
        'Hero should include headline, supporting text, and a clear primary CTA.',
        'Main region should showcase 2-4 highlight sections or pricing summaries.',
        'Include social proof before the final CTA whenever available.',
        'Finish with a footer that repeats key navigation and contact options.'
      ],
      contentGuidelines: [
        'Use benefit-led copy with concise paragraphs and scannable bullet points.',
        'Reference customer outcomes and metrics when available for credibility.',
        'Maintain consistent tone between hero messaging and highlighted features.'
      ],
      recommendedComponents: [
        ComponentType.FeatureGrid,
        ComponentType.Testimonials,
        ComponentType.PricingTable,
        ComponentType.CTABanner
      ],
      exampleUseCases: ['SaaS marketing home', 'Agency landing page', 'Product launch overview'],
      routeHints: ['/', '/home']
    }
  },
  canonical: [
    {
      region: 'header',
      enforce: true,
      preferredCanonical: ComponentType.NavBar,
        allowedCanonicals: [
          ComponentType.NavBar,
          ComponentType.CTASimple,
          ComponentType.TextBlock,
          ComponentType.FeatureList
        ],
      hints: [
        'Serialize header utility CTAs first, follow with feature-list quick links, then place the navbar last so the Bathurst-style multi-row header exports faithfully. Search functionality is integrated into the navbar via the search property.'
      ]
    }
  ]
}

export function registerTemplate(): void {
  if (pageTemplateFactory.getTemplate('marketing/home-default')) {
    return
  }

  pageTemplateFactory.registerManifest(manifest)
}
