import { ComponentType } from '@/lib/studio/components/cms/_core/types'
import { pageTemplateFactory } from '../../_factory/page-factory'
import { PageTemplateCategory } from '../../_core/types'
import type { TemplateManifest } from '../../_core/manifest'
import { definePageContentSchema } from '../../_core/content-schema'
import { getCTAComponentTypes } from '@/lib/studio/components/cms/_core/definition-loader'

const HERO_COMPONENTS: ComponentType[] = [
  ComponentType.HeroWithImage,
  ComponentType.HeroSplit,
  ComponentType.HeroCarousel,
  ComponentType.HeroVideo
]

const CORE_MAIN_COMPONENTS: ComponentType[] = [
  ComponentType.FeatureGrid,
  ComponentType.FeatureList,
  ComponentType.FeatureComparison,
  ComponentType.CardGrid,
  ComponentType.PricingTable,
  ComponentType.PricingCard,
  ComponentType.Testimonials,
  ComponentType.LogoCloud,
  ComponentType.Reviews,
  ComponentType.Accordion,
  ComponentType.Tabs,
  ComponentType.DataTable
]

const OPTIONAL_CTA_COMPONENTS: ComponentType[] = Array.from(getCTAComponentTypes()) as ComponentType[]

const ALL_PAGE_COMPONENTS: ComponentType[] = Array.from(
  new Set<ComponentType>([
    ComponentType.NavBar,
    ComponentType.Footer,
    ...HERO_COMPONENTS,
    ...CORE_MAIN_COMPONENTS,
    ...OPTIONAL_CTA_COMPONENTS
  ])
)

const manifest: TemplateManifest = {
  registration: {
    templateKey: 'commerce/product-detail',
    name: 'Product Detail',
    category: PageTemplateCategory.Commerce,
    isHomeEligible: false,
    description: 'Product detail layout featuring hero media, feature highlights, pricing, and social proof.',
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
        description: 'Commerce-friendly navigation with product categories and search. Supports pre-header utility components like hotline CTAs, quick-exit banners, and quick links.'
      },
      {
        region: 'hero',
        allowedComponents: HERO_COMPONENTS,
        min: 1,
        description: 'High-impact hero showcasing the product imagery and key selling point.'
      },
      {
        region: 'main',
        allowedComponents: CORE_MAIN_COMPONENTS,
        min: 1,
        description: 'Core product information such as features, specs, pricing, and social proof.'
      }
    ],
    optionalRegions: [
      {
        region: 'main',
        allowedComponents: OPTIONAL_CTA_COMPONENTS,
        description: 'Conversion-oriented CTAs for trial, purchase, or contact.'
      },
      {
        region: 'footer',
        allowedComponents: [ComponentType.Footer],
        max: 1,
        description: 'Footer with trust signals, support links, and legal information.'
      }
    ],
    propsMeta: {
      productSku: {
        type: 'string',
        required: false,
        description: 'Primary SKU or identifier for the product represented on the page.'
      },
      mediaGallery: {
        type: 'content-reference[]',
        required: false,
        description: 'Ordered media assets displayed in the hero gallery.',
        allowedComponentTypes: [ComponentType.ImageGallery, ComponentType.VideoPlayer, ComponentType.VideoEmbed]
      },
      specifications: {
        type: 'content-reference',
        required: false,
        description: 'Structured specification block or comparison table to render in main region.',
        allowedComponentTypes: [ComponentType.DataTable, ComponentType.Accordion, ComponentType.Tabs]
      },
      relatedTestimonials: {
        type: 'content-reference',
        required: false,
        description: 'Customer quotes or reviews relevant to this product.',
        allowedComponentTypes: [ComponentType.Testimonials, ComponentType.Reviews]
      }
    },
    contentSchema: definePageContentSchema({
      components: {
        type: 'content[]',
        required: true,
        description: 'Ordered component instances covering hero, product details, CTAs, and footer.',
        allowedComponentTypes: ALL_PAGE_COMPONENTS
      }
    }),
    aiMetadata: {
      keywords: ['product detail', 'commerce', 'sku', 'variant selector', 'pricing page'],
      layoutGuidelines: [
        'Hero should showcase the product name, imagery, and a primary call to action.',
        'Surface variant selectors or key configuration options before deeper content.',
        'Position pricing, purchase CTAs, and availability messaging above supporting sections.',
        'Organize specifications into scannable tables, accordions, or comparison blocks to reduce cognitive load.'
      ],
      contentGuidelines: [
        'Map detected pricing, SKU, or plan data into structured components rather than plain text.',
        'Highlight differentiators and proof points that help a buyer choose between variants.',
        'Reference reviews or social proof when available to reinforce purchase decisions.'
      ],
      recommendedComponents: [
        ComponentType.FeatureGrid,
        ComponentType.PricingTable,
        ComponentType.Testimonials,
        ComponentType.Accordion,
        ComponentType.CTAWithForm
      ],
      discouragedComponents: [ComponentType.BlogList],
      exampleUseCases: ['Software product detail', 'Hardware spec sheet', 'Subscription pricing page', 'Service offering breakdown'],
      routeHints: []
    }
  },
  canonical: [
    {
      region: 'hero',
      enforce: true,
      preferredCanonical: ComponentType.HeroWithImage,
      allowedCanonicals: [
        ComponentType.HeroWithImage,
        ComponentType.HeroSplit,
        ComponentType.HeroCarousel,
        ComponentType.HeroVideo
      ],
      hints: ['Summarize the store name and primary value props in the hero before main content.'],
      metadata: { variant: 'commerce-store' }
    },
    {
      region: 'main',
      enforce: true,
      preferredCanonical: ComponentType.FeatureList,
      allowedCanonicals: [
        ComponentType.FeatureList,
        ComponentType.FeatureGrid,
        ComponentType.FeatureComparison,
        ComponentType.CardGrid,
        ComponentType.PricingTable,
        ComponentType.PricingCard,
        ComponentType.Testimonials,
        ComponentType.LogoCloud,
        ComponentType.Reviews,
        ComponentType.Accordion,
        ComponentType.Tabs,
        ComponentType.DataTable
      ],
      hints: ['Convert detected store details (address, hours, contact) into feature-list items.'],
      metadata: { variant: 'commerce-store' }
    }
  ],
  detectionGuidance: [
    'Prioritize this template when the page contains purchasable products, plans, or clearly defined SKUs.',
    'Always include a hero summarizing the product value proposition even if only pricing or CTA fragments are present.',
    'Normalize specification, pricing, or plan data into structured feature-list or comparison components instead of raw prose.'
  ]
}

export function registerTemplate(): void {
  if (pageTemplateFactory.getTemplate('commerce/product-detail')) {
    return
  }

  pageTemplateFactory.registerManifest(manifest)
}
