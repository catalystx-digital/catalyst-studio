import { ComponentType } from '@/lib/studio/components/cms/_core/types'
import { pageTemplateFactory } from '../../_factory/page-factory'
import { PageTemplateCategory } from '../../_core/types'
import type { TemplateManifest } from '../../_core/manifest'
import { definePageContentSchema } from '../../_core/content-schema'
import { GENERIC_PAGE_TEMPLATE_KEY } from '../../_core/constants'
import {
  getSubComponentTypes,
  getMainRegionComponentTypes,
  getHeroComponentTypes,
  getHeaderEligibleComponentTypes
} from '@/lib/studio/components/cms/_core/definition-loader'

const SUB_COMPONENT_TYPES = getSubComponentTypes()
const ALL_COMPONENT_TYPES = Object.values(ComponentType) as ComponentType[]
const HIGH_LEVEL_COMPONENTS = ALL_COMPONENT_TYPES.filter(type => !SUB_COMPONENT_TYPES.has(type))

const HERO_COMPONENTS: ComponentType[] = Array.from(getHeroComponentTypes()) as ComponentType[]

const HEADER_COMPONENTS: ComponentType[] = [
  ComponentType.NavBar,
  ComponentType.CTASimple,
  ComponentType.TextBlock,
  ComponentType.FeatureList,
  ComponentType.Breadcrumbs,
  ComponentType.Breadcrumb,
  ComponentType.SideMenu
]

const FOOTER_COMPONENTS: ComponentType[] = [ComponentType.Footer]

const ALL_PAGE_COMPONENTS: ComponentType[] = Array.from(
  new Set<ComponentType>([
    ...HIGH_LEVEL_COMPONENTS,
    ...HEADER_COMPONENTS,
    ...HERO_COMPONENTS,
    ...FOOTER_COMPONENTS
  ])
)

const manifest: TemplateManifest = {
  registration: {
    templateKey: GENERIC_PAGE_TEMPLATE_KEY,
    name: 'Generic Content Page',
    category: PageTemplateCategory.Core,
    isHomeEligible: false,
    description:
      'Flexible fallback layout that supports any top-level component mix when no specialized template is available.',
    requiredRegions: [
      {
        region: 'main',
        allowedComponents: HIGH_LEVEL_COMPONENTS,
        min: 1,
        description: 'Primary content stream that accepts any high-level CMS component.'
      }
    ],
    optionalRegions: [
      {
        region: 'header',
        allowedComponents: HEADER_COMPONENTS,
        description: 'Optional navigation, breadcrumb, or search context. Supports pre-header utility components like hotline CTAs, quick-exit banners, and quick links.'
      },
      {
        region: 'hero',
        allowedComponents: HERO_COMPONENTS,
        description: 'Optional hero/intro sequence to frame the page.'
      },
      {
        region: 'footer',
        allowedComponents: FOOTER_COMPONENTS,
        description: 'Footer/footer-like utilities and compliance information.'
      }
    ],
    propsMeta: {
      components: {
        type: 'content-reference[]',
        required: false,
        description:
          'Ordered list of components to seed into the main region when scaffolding this page.',
        allowedComponentTypes: HIGH_LEVEL_COMPONENTS
      },
      layoutIntent: {
        type: 'enum',
        required: false,
        description: 'Guidance for AI on how to organize the main region content.',
        allowedValues: ['informational', 'marketing', 'product', 'support']
      },
      primaryAudience: {
        type: 'string',
        required: false,
        description: 'Human-readable audience segment (e.g., ?existing customers?).'
      }
    },
    contentSchema: definePageContentSchema({
      components: {
        type: 'content[]',
        required: true,
        description: 'Ordered component instances grouped by regions for this page.',
        allowedComponentTypes: ALL_PAGE_COMPONENTS
      }
    }),
    aiMetadata: {
      keywords: ['generic', 'fallback', 'content page', 'flexible layout', 'store detail', 'event overview', 'location profile'],
      layoutGuidelines: [
        'Populate the main region with components in the order they appear on the source page.',
        'Prefer adding navigation/header elements only when clearly present.',
        'If a hero-like section exists, map it to one of the supported hero components.',
        'Keep location, hours, and contact blocks intact when present so editors can refine details later.',
        'When uncertain, balance text-led sections with supporting media (galleries, videos, feature highlights).'
      ],
      contentGuidelines: [
        'Retain original headings and hierarchy; do not synthesize new sections.',
        'Group related content into feature or card patterns instead of leaving raw text blocks.',
        'Preserve structured store or event details (hours, address, contacts) in dedicated components when available.'
      ],
      recommendedComponents: [
        ComponentType.TextBlock,
        ComponentType.HeroWithImage,
        ComponentType.FeatureList,
        ComponentType.CardGrid,
        ComponentType.LocationMap,
        ComponentType.ContactInfo,
        ComponentType.CTASimple,
        ComponentType.SimpleForm
      ],
      exampleUseCases: ['Sparse marketing landing', 'Store or venue overview', 'Event information page', 'Fallback informational page', 'Vendor documentation landing'],
      routeHints: ['/generic', '/page', '/fallback']
    }
  }
}

export function registerTemplate(): void {
  if (pageTemplateFactory.getTemplate(GENERIC_PAGE_TEMPLATE_KEY)) {
    return
  }

  pageTemplateFactory.registerManifest(manifest)
}

