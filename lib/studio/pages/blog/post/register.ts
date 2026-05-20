import { ComponentType } from '@/lib/studio/components/cms/_core/types'
import { pageTemplateFactory } from '../../_factory/page-factory'
import { PageTemplateCategory } from '../../_core/types'
import type { TemplateManifest } from '../../_core/manifest'
import { definePageContentSchema } from '../../_core/content-schema'
import { getDetailComponentTypes } from '@/lib/studio/components/cms/_core/definition-loader'

const HERO_COMPONENTS: ComponentType[] = [ComponentType.ArticleHeader]

const REQUIRED_MAIN_COMPONENTS: ComponentType[] = [ComponentType.BlogPost]

const OPTIONAL_MAIN_COMPONENTS: ComponentType[] = [
  ComponentType.AuthorBio,
  ComponentType.RelatedPosts,
  ComponentType.ContentFeed,
  ComponentType.CTASimple,
  ComponentType.CTAWithForm,
  ComponentType.CTAButtonGroup,
  ComponentType.LogoCloud,
  ComponentType.TextBlock,
  ComponentType.ContactInfo,
  ComponentType.SimpleForm
]

const HEADER_UTILITY_COMPONENTS: ComponentType[] = [
  ComponentType.CTASimple,
  ComponentType.TextBlock,
  ComponentType.FeatureList
]

const ALL_PAGE_COMPONENTS: ComponentType[] = Array.from(
  new Set<ComponentType>([
    ComponentType.NavBar,
    ComponentType.Footer,
    ...HERO_COMPONENTS,
    ...REQUIRED_MAIN_COMPONENTS,
    ...OPTIONAL_MAIN_COMPONENTS,
    ...HEADER_UTILITY_COMPONENTS
  ])
)

const manifest: TemplateManifest = {
  registration: {
    templateKey: 'blog/post-standard',
    name: 'Blog Post',
    category: PageTemplateCategory.Blog,
    isHomeEligible: false,
    description: 'Long-form article layout with hero header, rich body content, and related resources.',
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
        description: 'Global navigation for the blog experience. Includes support for pre-header utility components like hotline CTAs, quick-exit banners, and quick links that appear above the main navigation.'
      },
      {
        region: 'main',
        allowedComponents: REQUIRED_MAIN_COMPONENTS,
        min: 1,
        max: 1,
        description: 'Primary article body rendered via canonical BlogPost component.'
      }
    ],
    optionalRegions: [
      {
        region: 'hero',
        allowedComponents: HERO_COMPONENTS,
        max: 1,
        description: 'Article header with title, publish details, and hero media.'
      },
      {
        region: 'main',
        allowedComponents: OPTIONAL_MAIN_COMPONENTS,
        description: 'Post supporting sections such as author details, related articles, or CTAs.'
      },
      {
        region: 'footer',
        allowedComponents: [ComponentType.Footer],
        max: 1,
        description: 'Footer replicating site-wide navigation and legal content.'
      }
    ],
    propsMeta: {
      readingTime: {
        type: 'string',
        required: false,
        description: 'Estimated reading time label displayed near the article header.'
      },
      canonicalUrl: {
        type: 'string',
        required: false,
        description: 'Canonical URL override to support syndication or mirrored posts.'
      },
      heroImage: {
        type: 'image',
        required: false,
        description: 'Hero image asset used in the article header when present.'
      },
      recommendedPosts: {
        type: 'content-reference',
        required: false,
        description: 'Curated related posts to prioritize in the related section.',
        allowedComponentTypes: [ComponentType.RelatedPosts]
      }
    },
    contentSchema: definePageContentSchema({
      components: {
        type: 'content[]',
        required: true,
        description: 'Ordered component layout for hero, article body, and supporting sections.',
        allowedComponentTypes: ALL_PAGE_COMPONENTS
      }
    }),
    aiMetadata: {
      keywords: ['blog post', 'article', 'long form content', 'thought leadership'],
      layoutGuidelines: [
        'Keep the article body contiguous; supporting components should follow the main content.',
        'Hero header should include publish date and author when available.',
        'Ensure author bio or related posts appear after the primary article content.',
        'Footer may be omitted when the page inherits a global layout wrapper.'
      ],
      contentGuidelines: [
        'Preserve heading hierarchy (h1 -> h2 -> h3) as represented in the source content.',
        'Inline images should remain within the BlogPost component content tree.',
        'Call-to-actions should align with article topic and appear after the conclusion section.'
      ],
      recommendedComponents: [ComponentType.ArticleHeader, ComponentType.AuthorBio, ComponentType.RelatedPosts],
      discouragedComponents: [ComponentType.PricingTable, ComponentType.FeatureComparison],
      exampleUseCases: ['Case study write-up', 'Product announcement', 'Editorial thought leadership'],
      routeHints: ['/blog/', '/resources/', '/insights/']
    }
  }
}

export function registerTemplate(): void {
  if (pageTemplateFactory.getTemplate('blog/post-standard')) {
    return
  }

  pageTemplateFactory.registerManifest(manifest)
}
