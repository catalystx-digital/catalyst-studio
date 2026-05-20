import { GENERIC_PAGE_TEMPLATE_KEY, FOLDER_TEMPLATE_KEY } from '../../../lib/studio/pages/_core/constants'
import { PrismaClient, WebsitePage, Prisma, ContentType, WebsiteSharedComponent } from '../../../lib/generated/prisma'
import { ComponentType } from '../../../lib/studio/components/cms/_core/types'
import type { PageTemplateRegionKey } from '../../../lib/studio/pages/_core/types'
import { ensureTemplatePageTypes } from '../../../lib/studio/import/services/template-page-type-seeder'

const FALLBACK_TEMPLATE_KEY = GENERIC_PAGE_TEMPLATE_KEY


type SeedRegion = PageTemplateRegionKey

type PageStatus = 'published' | 'draft' | 'archived'

interface ComponentInput {
  id: string
  type: ComponentType
  position: number
  region?: SeedRegion
  parentId?: string | null
  props?: Record<string, unknown>
  children?: ComponentInput[]
}

interface PageDefinition {
  title: string
  status: PageStatus
  templateKey: string
  templateProps?: Record<string, unknown>
  metadata: {
    seoTitle: string
    seoDescription: string
    keywords: string[]
    ogImage?: string
  }
  components: ComponentInput[]
  publishedAt?: Date
}

interface SeedComponentNode {
  id: string
  type: string
  parentId: string | null
  position: number
  props: Record<string, unknown>
  children?: SeedComponentNode[]
}

type RegionSummary = Record<string, string[]>

interface SeedSharedRefs {
  mainNav?: string
  footer?: string
  ctaBanner?: string
  sidebarNav?: string
}

function cleanProps(props: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(props).filter(([, value]) => value !== undefined))
}

function buildComponent(input: ComponentInput, parentId: string | null = null): SeedComponentNode {
  const { id, type, position, props, region, children, parentId: explicitParentId } = input
  const nodeParentId = explicitParentId ?? parentId ?? null
  const mergedProps = props ? { ...props } : {}

  if (region) {
    mergedProps.region = region
  }

  const node: SeedComponentNode = {
    id,
    type,
    parentId: nodeParentId,
    position,
    props: cleanProps(mergedProps)
  }

  if (children && children.length > 0) {
    node.children = children.map(child => buildComponent(child, id))
  }

  return node
}

function sortComponentTree(nodes: SeedComponentNode[]): SeedComponentNode[] {
  return nodes
    .slice()
    .sort((a, b) => a.position - b.position)
    .map(node => ({
      ...node,
      children: node.children ? sortComponentTree(node.children) : undefined
    }))
}

function summarizeRegions(nodes: SeedComponentNode[]): RegionSummary {
  return nodes.reduce<RegionSummary>((acc, node) => {
    const region = (node.props as Record<string, unknown>).region as string | undefined
    if (region) {
      if (!acc[region]) {
        acc[region] = []
      }
      acc[region].push(node.type)
    }
    return acc
  }, {})
}

function toTemplateProps(value?: Record<string, unknown>): Prisma.InputJsonValue {
  if (!value || Object.keys(value).length === 0) {
    return Prisma.JsonNull as unknown as Prisma.InputJsonValue
  }
  return value as Prisma.JsonObject
}

function resolveSharedRefs(sharedComponents: WebsiteSharedComponent[]): SeedSharedRefs {
  const lookup = new Map(sharedComponents.map(component => [component.name, component]))
  return {
    mainNav: lookup.get('Main Navigation')?.id,
    footer: lookup.get('Footer')?.id,
    ctaBanner: lookup.get('Call-to-Action Banner')?.id,
    sidebarNav: lookup.get('Sidebar Navigation')?.id
  }
}

export async function createWebsitePages(
  prisma: PrismaClient,
  websiteId: string,
  _contentTypes: ContentType[],
  sharedComponents: WebsiteSharedComponent[]
): Promise<WebsitePage[]> {
  const pages: WebsitePage[] = []

  try {
    const templateContentTypes = await ensureTemplatePageTypes({ prisma, websiteId })
    const fallbackContentTypeId = templateContentTypes.get(FALLBACK_TEMPLATE_KEY)

    if (!fallbackContentTypeId) {
      throw new Error(
        `[Seed] Missing fallback template content type for key "${FALLBACK_TEMPLATE_KEY}" (websiteId=${websiteId})`
      )
    }

    const folderContentTypeId = templateContentTypes.get(FOLDER_TEMPLATE_KEY)
    if (!folderContentTypeId) {
      throw new Error(
        `[Seed] Missing folder template content type for key "${FOLDER_TEMPLATE_KEY}" (websiteId=${websiteId})`
      )
    }

    const sharedRefs = resolveSharedRefs(sharedComponents)

    if (!sharedRefs.mainNav || !sharedRefs.footer) {
      console.warn('⚠️ Shared navigation/footer components missing; seeding will fall back to inline props.')
    }

    const pageDefinitions: PageDefinition[] = [
      {
        title: 'Home',
        status: 'published',
        templateKey: 'marketing/home-default',
        templateProps: {
          primaryHeroVariant: ComponentType.HeroBanner,
          featuredHighlights: ['home-feature-grid'],
          supportingSocialProof: 'home-social-proof',
          primaryCallToAction: 'Start your trial'
        },
        metadata: {
          seoTitle: 'Home - Catalyst Studio',
          seoDescription: 'Discover the studio template registry with aligned seeds, demos, and tooling.',
          keywords: ['home', 'template registry', 'ai alignment'],
          ogImage: '/images/og-home.jpg'
        },
        components: [
          {
            id: 'home-nav',
            type: ComponentType.NavBar,
            region: 'header',
            position: 0,
            props: {
              variant: 'sticky',
              sharedComponentId: sharedRefs.mainNav,
              menuAlignment: 'center'
            }
          },
          {
            id: 'home-hero',
            type: ComponentType.HeroBanner,
            region: 'hero',
            position: 1,
            props: {
              headline: 'Your AI-powered site builder',
              subheadline: 'Launch studio web experiences in minutes with structured templates.',
              primaryCta: { label: 'Start your trial', href: '/signup' },
              secondaryCta: { label: 'Learn more', href: '/about' },
              backgroundImage: '/images/hero-home.jpg'
            }
          },
          {
            id: 'home-feature-grid',
            type: ComponentType.FeatureGrid,
            region: 'main',
            position: 2,
            props: {
              layout: 'three-column',
              features: [
                { title: 'Template Registry', description: 'Structured layouts keep imports consistent.' },
                { title: 'LLM Alignment', description: 'Detection prompts stay in sync with template metadata.' },
                { title: 'Faster Delivery', description: 'Seeds, demos, and tooling share one source of truth.' }
              ]
            }
          },
          {
            id: 'home-social-proof',
            type: ComponentType.Testimonials,
            region: 'main',
            position: 3,
            props: {
              layout: 'carousel',
              testimonials: [
                { name: 'Product Lead', quote: 'Templates made our QA sign-off five times faster.', role: 'Enterprise SaaS' },
                { name: 'Head of Delivery', quote: 'Our migration accuracy jumped to 92% after the alignment.', role: 'Agency Partner' }
              ]
            }
          },
          {
            id: 'home-pricing',
            type: ComponentType.PricingTable,
            region: 'main',
            position: 4,
            props: {
              plans: [
                { name: 'Starter', price: '$49', cadence: 'mo', features: ['3 templates', 'Basic analytics'] },
                { name: 'Growth', price: '$149', cadence: 'mo', features: ['All templates', 'AI assist', 'Priority support'] }
              ],
              highlightPlan: 'Growth'
            }
          },
          {
            id: 'home-cta',
            type: ComponentType.CTABanner,
            region: 'main',
            position: 5,
            props: {
              sharedComponentId: sharedRefs.ctaBanner,
              title: 'Ready to ship production pages?',
              message: 'Use the template-aware seeds to demo the full workflow.',
              primaryAction: { label: 'Get started', href: '/signup' }
            }
          },
          {
            id: 'home-footer',
            type: ComponentType.Footer,
            region: 'footer',
            position: 6,
            props: {
              sharedComponentId: sharedRefs.footer,
              layout: 'three-column'
            }
          }
        ]
      },
      {
        title: 'Product Detail',
        status: 'published',
        templateKey: 'commerce/product-detail',
        templateProps: {
          productSku: 'SKU-ACME-001',
          specifications: 'product-specs',
          relatedTestimonials: 'product-testimonials'
        },
        metadata: {
          seoTitle: 'Product Detail - Catalyst Studio',
          seoDescription: 'See how product detail templates combine hero media, feature highlights, and pricing.',
          keywords: ['product detail', 'pricing', 'testimonials'],
          ogImage: '/images/og-product.jpg'
        },
        components: [
          {
            id: 'product-nav',
            type: ComponentType.NavBar,
            region: 'header',
            position: 0,
            props: {
              sharedComponentId: sharedRefs.mainNav,
              showSearch: true,
              variant: 'commerce'
            }
          },
          {
            id: 'product-hero',
            type: ComponentType.HeroWithImage,
            region: 'hero',
            position: 1,
            props: {
              headline: 'Catalyst Studio',
              subheadline: 'Bring AI-aligned pages to production with zero guesswork.',
              image: {
                src: '/images/product-hero.png',
                alt: 'Product hero showcasing aligned templates'
              },
              primaryCta: { label: 'Request a demo', href: '/contact' },
              secondaryCta: { label: 'View pricing', href: '/pricing' }
            }
          },
          {
            id: 'product-feature-list',
            type: ComponentType.FeatureList,
            region: 'main',
            position: 2,
            props: {
              orientation: 'vertical',
              features: [
                { title: 'Template-aware seeds', description: 'Seeds align content regions with registry rules.' },
                { title: 'LLM prompt sync', description: 'Detection service includes page template metadata.' },
                { title: 'Validation harness', description: 'Runtime guards ensure props match allowed components.' }
              ]
            }
          },
          {
            id: 'product-pricing',
            type: ComponentType.PricingCard,
            region: 'main',
            position: 3,
            props: {
              name: 'Studio Workspace',
              price: '$199',
              cadence: 'mo',
              badge: 'Most popular',
              features: ['Unlimited templates', 'Advanced analytics', 'Priority support']
            }
          },
          {
            id: 'product-testimonials',
            type: ComponentType.Testimonials,
            region: 'main',
            position: 4,
            props: {
              layout: 'grid',
              testimonials: [
                { name: 'Director of Engineering', quote: 'Structured templates removed 80% of manual cleanup.', role: 'Fintech' }
              ]
            }
          },
          {
            id: 'product-specs',
            type: ComponentType.DataTable,
            region: 'main',
            position: 5,
            props: {
              columns: ['Capability', 'Description'],
              rows: [
                ['Template Registry', 'Central catalogue with region + props metadata'],
                ['Validation', 'Runtime guards for component placements and props'],
                ['Tooling', 'CLI + demos surface template context']
              ]
            }
          },
          {
            id: 'product-cta',
            type: ComponentType.CTASimple,
            region: 'main',
            position: 6,
            props: {
              heading: 'Accelerate your rollout',
              body: 'Enable the feature flag when telemetry shows template adoption is healthy.',
              primaryAction: { label: 'Talk to sales', href: '/contact' }
            }
          },
          {
            id: 'product-footer',
            type: ComponentType.Footer,
            region: 'footer',
            position: 7,
            props: {
              sharedComponentId: sharedRefs.footer
            }
          }
        ]
      },
      {
        title: 'Blog',
        status: 'draft',
        templateKey: 'blog/index-standard',
        templateProps: {
          defaultCategoryFilter: 'Engineering',
          featuredPosts: ['blog-featured-card'],
          subscribeCta: 'blog-subscribe'
        },
        metadata: {
          seoTitle: 'Blog - Template Insights',
          seoDescription: 'Latest updates on the page template registry and AI detection alignment.',
          keywords: ['blog', 'templates', 'ai detection'],
          ogImage: '/images/og-blog.jpg'
        },
        components: [
          {
            id: 'blog-nav',
            type: ComponentType.NavBar,
            region: 'header',
            position: 0,
            props: {
              sharedComponentId: sharedRefs.mainNav,
              announcement: { label: 'Now GA', href: '/docs/page-template-registry' }
            }
          },
          {
            id: 'blog-hero',
            type: ComponentType.HeroMinimal,
            region: 'hero',
            position: 1,
            props: {
              headline: 'Template Registry Updates',
              subheadline: 'Changelog and deep dives for squads adopting the new workflow.'
            }
          },
          {
            id: 'blog-list',
            type: ComponentType.BlogList,
            region: 'main',
            position: 2,
            props: {
              layout: 'two-column',
              posts: [
                {
                  id: 'post-templating-rollout',
                  title: 'How we aligned seeds with the registry',
                  summary: 'Step-by-step breakdown of the Story 5 implementation.',
                  author: 'Platform Team',
                  publishedAt: new Date().toISOString()
                }
              ]
            }
          },
          {
            id: 'blog-featured-grid',
            type: ComponentType.CardGrid,
            region: 'main',
            position: 3,
            props: {
              headline: 'Featured deep dives',
              columns: 2
            },
            children: [
              {
                id: 'blog-featured-card',
                type: ComponentType.BlogCard,
                position: 0,
                props: {
                  title: 'Prompt alignment checklist',
                  summary: 'Ensure detection prompts include template metadata before launch.',
                  author: 'AI Squad'
                }
              }
            ]
          },
          {
            id: 'blog-subscribe',
            type: ComponentType.CTAWithForm,
            region: 'main',
            position: 4,
            props: {
              headline: 'Subscribe for rollout alerts',
              description: 'Get notified when new templates or validation rules land.',
              submitLabel: 'Notify me'
            }
          },
          {
            id: 'blog-footer',
            type: ComponentType.Footer,
            region: 'footer',
            position: 5,
            props: {
              sharedComponentId: sharedRefs.footer
            }
          }
        ]
      },
      {
        title: 'AI Alignment Deep Dive',
        status: 'archived',
        templateKey: 'blog/post-standard',
        templateProps: {
          readingTime: '7 min read',
          canonicalUrl: 'https://example.com/blog/ai-alignment',
          heroImage: 'https://images.example.com/ai-alignment.png',
          recommendedPosts: 'blog-related'
        },
        metadata: {
          seoTitle: 'AI Alignment Deep Dive - Blog Post',
          seoDescription: 'Detailed walkthrough of detection, validation, and tooling updates.',
          keywords: ['blog post', 'ai alignment', 'templates'],
          ogImage: '/images/og-blog-post.jpg'
        },
        components: [
          {
            id: 'post-nav',
            type: ComponentType.NavBar,
            region: 'header',
            position: 0,
            props: {
              sharedComponentId: sharedRefs.mainNav
            }
          },
          {
            id: 'post-hero',
            type: ComponentType.ArticleHeader,
            region: 'hero',
            position: 1,
            props: {
              title: 'AI Alignment Deep Dive',
              subtitle: 'Ensuring imports and seeds stay in sync with the template registry.',
              author: 'Core Platform Team',
              publishedAt: new Date().toISOString()
            }
          },
          {
            id: 'post-body',
            type: ComponentType.TextBlock,
            region: 'main',
            position: 2,
            props: {
              heading: 'Alignment rollout summary',
              body: '<p>Story 5 ensures every seed references registered templates.</p><p>LLM prompts now load the catalog summary before component listings.</p>'
            }
          },
          {
            id: 'post-author',
            type: ComponentType.AuthorBio,
            region: 'main',
            position: 3,
            props: {
              name: 'Jordan Chen',
              role: 'Staff Engineer',
              bio: 'Leads template validation and tooling alignment efforts.'
            }
          },
          {
            id: 'blog-related',
            type: ComponentType.RelatedPosts,
            region: 'main',
            position: 4,
            props: {
              posts: [
                { title: 'Telemetry checklist for templates', href: '/blog/telemetry-checklist' },
                { title: 'Feature flagging strategy', href: '/blog/rollout-strategy' }
              ]
            }
          },
          {
            id: 'post-cta',
            type: ComponentType.CTASimple,
            region: 'main',
            position: 5,
            props: {
              heading: 'Try it now',
              body: 'Experience template-driven content management.',
              primaryAction: { label: 'Get started', href: '/signup' }
            }
          },
          {
            id: 'post-footer',
            type: ComponentType.Footer,
            region: 'footer',
            position: 6,
            props: {
              sharedComponentId: sharedRefs.footer
            }
          }
        ]
      },
      {
        title: 'Developer Documentation',
        status: 'published',
        templateKey: 'core/generic-default',
        templateProps: {
          components: ['docs-overview', 'docs-guides'],
          layoutIntent: 'informational',
          primaryAudience: 'Developers'
        },
        metadata: {
          seoTitle: 'Developer Docs - Template Registry',
          seoDescription: 'Reference documentation covering validation, prompts, and QA workflows & tooling alignment.',
          keywords: ['documentation', 'templates', 'developers'],
          ogImage: '/images/og-docs.jpg'
        },
        components: [
          {
            id: 'docs-nav',
            type: ComponentType.NavBar,
            region: 'header',
            position: 0,
            props: {
              sharedComponentId: sharedRefs.mainNav,
              variant: 'minimal'
            }
          },
          {
            id: 'docs-sidebar',
            type: ComponentType.SideMenu,
            region: 'header',
            position: 1,
            props: {
              sharedComponentId: sharedRefs.sidebarNav,
              sections: [
                { title: 'Overview', href: '#overview' },
                { title: 'Validation', href: '#validation' },
                { title: 'Tooling', href: '#tooling' }
              ]
            }
          },
          {
            id: 'docs-hero',
            type: ComponentType.HeroMinimal,
            region: 'hero',
            position: 2,
            props: {
              headline: 'Template Registry Developer Guide',
              subheadline: 'How to seed, validate, and surface template metadata across tooling.'
            }
          },
          {
            id: 'docs-overview',
            type: ComponentType.TextBlock,
            region: 'main',
            position: 3,
            props: {
              heading: 'Overview',
              body: 'Seeds now map each page to a registered template and expose props metadata for demos and CLIs.'
            }
          },
          {
            id: 'docs-guides',
            type: ComponentType.Accordion,
            region: 'main',
            position: 4,
            props: {
              items: [
                { id: 'validation', title: 'Validation Checklist', content: 'Run template validation tests before rollout.' },
                { id: 'tooling', title: 'Tooling Updates', content: 'CLI now includes template summaries by default.' }
              ]
            }
          },
          {
            id: 'docs-footer',
            type: ComponentType.Footer,
            region: 'footer',
            position: 5,
            props: {
              sharedComponentId: sharedRefs.footer
            }
          }
        ]
      },
      {
        title: 'International Launch',
        status: 'published',
        templateKey: 'core/generic-default',
        templateProps: {
          components: ['intl-overview', 'intl-stats'],
          layoutIntent: 'marketing',
          primaryAudience: 'Global teams'
        },
        metadata: {
          seoTitle: 'International Launch - Template Registry',
          seoDescription: 'Showcase localized components and content alignment for global launches.',
          keywords: ['international', 'localization', 'templates'],
          ogImage: '/images/og-international.jpg'
        },
        components: [
          {
            id: 'intl-nav',
            type: ComponentType.NavBar,
            region: 'header',
            position: 0,
            props: {
              sharedComponentId: sharedRefs.mainNav,
              localeSwitcher: true
            }
          },
          {
            id: 'intl-hero',
            type: ComponentType.HeroSplit,
            region: 'hero',
            position: 1,
            props: {
              headline: 'Global launch readiness 🌍',
              subheadline: 'Templates capture localization rules for every region.',
              image: { src: '/images/international.jpg', alt: 'International skyline' }
            }
          },
          {
            id: 'intl-overview',
            type: ComponentType.CardGrid,
            region: 'main',
            position: 2,
            props: {
              columns: 3,
              cards: [
                { title: 'Locale aware', description: 'Props capture localized CTA labels and currencies (こんにちは / مرحبا / ¡Hola!).' },
                { title: 'Shared components', description: 'Navigation + footer reuse global shared components.' },
                { title: 'Telemetry ready', description: 'Events fire when template enforcement toggles.' }
              ]
            }
          },
          {
            id: 'intl-stats',
            type: ComponentType.Statistics,
            region: 'main',
            position: 3,
            props: {
              metrics: [
                { label: 'Markets supported', value: 18 },
                { label: 'Localized templates', value: 6 },
                { label: 'Translation coverage 多言語', value: '98%' }
              ]
            }
          },
          {
            id: 'intl-footer',
            type: ComponentType.Footer,
            region: 'footer',
            position: 4,
            props: {
              sharedComponentId: sharedRefs.footer,
              locales: ['en-US', 'fr-FR', 'ja-JP']
            }
          }
        ]
      }
    ]

    for (const definition of pageDefinitions) {
      const templateContentTypeId = templateContentTypes.get(definition.templateKey) ?? fallbackContentTypeId
      const componentTree = sortComponentTree(definition.components.map(component => buildComponent(component)))
      const regionSummary = summarizeRegions(componentTree)
      const contentData = {
        templateKey: definition.templateKey,
        regions: regionSummary,
        components: componentTree
      }
      const content = contentData as unknown as Prisma.InputJsonValue

      const publishedAt = definition.status === 'published' ? definition.publishedAt ?? new Date() : null

      const page = await prisma.websitePage.create({
        data: {
          websiteId,
          type: 'page',
          title: definition.title,
        contentTypeId: templateContentTypeId,
          status: definition.status,
          publishedAt,
          content,
          templateKey: definition.templateKey,
          templateProps: toTemplateProps(definition.templateProps),
          metadata: definition.metadata
        }
      })

      pages.push(page)
    }

    const resourcesFolder = await prisma.websitePage.create({
      data: {
        websiteId,
        type: 'folder',
        title: 'Resources',
        contentTypeId: folderContentTypeId,
        status: 'published',
        publishedAt: new Date(),
        content: ({
          templateKey: FOLDER_TEMPLATE_KEY,
          components: []
        }) as unknown as Prisma.InputJsonValue,
        templateKey: FOLDER_TEMPLATE_KEY,
        templateProps: Prisma.JsonNull,
        metadata: {
          seoTitle: 'Resources',
          seoDescription: 'Container for resource guides and localized content.',
          keywords: ['resources', 'folder']
        }
      }
    })

    pages.push(resourcesFolder)

    console.log(`✅ Created ${pages.length} WebsitePages with registered templates`)
    return pages
  } catch (error) {
    console.error('❌ Failed to create WebsitePages:', error)
    throw error
  }
}

