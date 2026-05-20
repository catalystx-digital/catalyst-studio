import { detectionParserInternals, parseDetectionResponse } from '../response-parser'
import { PageTemplateCategory, type AIComponentMetadata } from '@/lib/studio/pages/_core/types'
import type { PageCatalogSummary, PageCatalogTemplateSummary } from '@/lib/studio/pages/catalog'
import type { ComponentPattern } from '@/lib/studio/components/cms/_import/detection-api'

import type { DetectedComponent, PageMetadata } from '../types'

const routeHintsFor = (templateKey: string): string[] | undefined => {
  if (templateKey === 'commerce/product-detail') {
    return ['/stores/']
  }
  if (templateKey === 'blog/post-standard') {
    return ['/articles/']
  }
  if (templateKey === 'blog/index-standard') {
    return ['/articles', '/articles/']
  }
  return undefined
}

describe('resolvePageTemplate content intent fallbacks', () => {
  const buildTemplate = (templateKey: string, category: PageTemplateCategory): PageCatalogTemplateSummary => ({
    templateKey,
    name: templateKey,
    category,
    isHomeEligible: category === PageTemplateCategory.Marketing && templateKey.includes('home'),
    description: `${templateKey} description`,
    requiredRegions: [],
    optionalRegions: [],
    propsMeta: undefined,
    aiMetadata: {
      keywords: [],
      layoutGuidelines: [],
      contentGuidelines: undefined,
      recommendedComponents: undefined,
      discouragedComponents: undefined,
      exampleUseCases: undefined,
      routeHints: routeHintsFor(templateKey)
    },
    canonical: undefined,
    detectionGuidance: undefined,
    regionPolicies: undefined
  })

  const summary: PageCatalogSummary = {
    total: 4,
    generatedAt: new Date().toISOString(),
    templates: [
      buildTemplate('core/generic-default', PageTemplateCategory.Core),
      buildTemplate('commerce/product-detail', PageTemplateCategory.Commerce),
      buildTemplate('blog/post-standard', PageTemplateCategory.Blog),
      buildTemplate('blog/index-standard', PageTemplateCategory.Blog)
    ],
    categories: [
      {
        category: PageTemplateCategory.Core,
        templates: [buildTemplate('core/generic-default', PageTemplateCategory.Core)]
      },
      {
        category: PageTemplateCategory.Commerce,
        templates: [buildTemplate('commerce/product-detail', PageTemplateCategory.Commerce)]
      },
      {
        category: PageTemplateCategory.Blog,
        templates: [
          buildTemplate('blog/post-standard', PageTemplateCategory.Blog),
          buildTemplate('blog/index-standard', PageTemplateCategory.Blog)
        ]
      }
    ],
    homeEligibleTemplates: []
  }

  const buildComponent = (type: string): DetectedComponent => ({
    component: type,
    type: type as DetectedComponent['type'],
    confidence: 0.9,
    content: {},
    location: 'main',
    metadata: undefined
  })

  it('falls back to commerce detail when store signals are present', () => {
    const components = [buildComponent('location-map'), buildComponent('contact-info')]
    const metadata: PageMetadata = { pageType: 'store-detail' }

    const result = detectionParserInternals.resolvePageTemplate(
      undefined,
      summary,
      'https://example.com/stores/retail/foo',
      components,
      metadata,
      { modelConfidenceThreshold: 0.6 }
    )

    expect(result.templateKey).toBe('commerce/product-detail')
    expect(result.source).toBe('fallback')
    expect(result.reason).toContain('heuristically selected')
    expect(result.reason).toContain('commerce/product-detail')
  })

  it('falls back to blog post when article components are detected', () => {
    const components = [buildComponent('blog-post')]

    const result = detectionParserInternals.resolvePageTemplate(
      undefined,
      summary,
      'https://example.com/articles/foo',
      components,
      undefined,
      { modelConfidenceThreshold: 0.6 }
    )

    expect(result.templateKey).toBe('blog/post-standard')
    expect(result.source).toBe('fallback')
    expect(result.reason).toContain('heuristically selected')
    expect(result.reason).toContain('blog/post-standard')
  })

  it('retains high-confidence model prediction', () => {
    const components = [buildComponent('location-map'), buildComponent('contact-info')]
    const candidate = {
      templateKey: 'blog/post-standard',
      confidence: 0.9,
      reason: 'Model selected blog post'
    }

    const result = detectionParserInternals.resolvePageTemplate(
      candidate,
      summary,
      'https://example.com/blog/foo',
      components,
      undefined,
      { modelConfidenceThreshold: 0.6 }
    )

    expect(result.templateKey).toBe('blog/post-standard')
    expect(result.source).toBe('model')
  })
})
describe('parseComponentsArray', () => {
  const buildPattern = (type: ComponentPattern['type'], category: ComponentPattern['category']): ComponentPattern => ({
    type,
    category,
    metadata: {
      keywords: [],
      patterns: [],
      commonNames: [],
      pageLocation: [],
      confidence: 0.9
    } as AIComponentMetadata,
    confidence: 0.9,
    keywords: [],
    patterns: []
  })

  const patterns: ComponentPattern[] = [
    buildPattern('navbar' as ComponentPattern['type'], 'navigation' as ComponentPattern['category']),
    buildPattern('blog-post' as ComponentPattern['type'], 'blog' as ComponentPattern['category'])
  ]

  it('parses normalized component tuples', () => {
    const parsed = [
      ['navbar', 0.9, { region: 'header' }],
      ['blog-post', 0.95, { region: 'main', bodyHtml: '<p>Hello</p>' }]
    ]

    const components = detectionParserInternals.parseComponentsArray(parsed, patterns, 0.25, 'https://example.com/test')

    expect(components).toHaveLength(2)
    expect(components[0].component).toBe('navbar')
    expect(components[1].component).toBe('blog-post')
    expect((components[1].content as any)?.region).toBe('main')
  })

  it('falls back to canonical patterns when catalog is missing a registered component', () => {
    const parsed = [
      ['hero-carousel', 0.88, { region: 'hero', slides: [] }]
    ]

    const components = detectionParserInternals.parseComponentsArray(
      parsed,
      [patterns[0]], // catalog lacks hero-carousel entry
      0.25,
      'https://example.com/home'
    )

    expect(components).toHaveLength(1)
    const hero = components[0]
    expect(hero.component).toBe('hero-carousel')
    expect(hero.type).toBe('hero-carousel')
    expect(hero.metadata).toBeDefined()
    expect((hero.metadata as any)?.source).toBe('canonical-fallback')
  })

  it('retains canonical components when parsing flattened triples end-to-end', () => {
    const rawResponse = JSON.stringify({
      components: [
        ['navbar', 0.9, { region: 'header' }],
        'blog-post',
        0.95,
        { region: 'main', bodyHtml: '<p>Hello</p>' }
      ],
      pageTemplate: { templateKey: 'blog/post-standard', confidence: 0.95, reason: 'LLM classified page as blog post' }
    })

    const pageSummary: PageCatalogSummary = {
      total: 1,
      generatedAt: new Date().toISOString(),
      templates: [
        {
          templateKey: 'blog/post-standard',
          name: 'Blog Post',
          category: PageTemplateCategory.Blog,
          isHomeEligible: false,
          description: 'Blog post template',
          requiredRegions: [
            { region: 'header', allowedComponents: ['navbar'], min: 1 },
            { region: 'main', allowedComponents: ['blog-post'], min: 1, max: 1 }
          ],
          optionalRegions: [],
          propsMeta: undefined,
          aiMetadata: {
            keywords: [],
            layoutGuidelines: [],
            contentGuidelines: undefined,
            recommendedComponents: undefined,
            discouragedComponents: undefined,
            exampleUseCases: undefined,
            routeHints: routeHintsFor('blog/post-standard')
          },
          canonical: undefined,
          detectionGuidance: undefined,
          regionPolicies: undefined
        }
      ],
      categories: [
        {
          category: PageTemplateCategory.Blog,
          templates: []
        }
      ],
      homeEligibleTemplates: []
    }

    // Ensure categories reference the template for completeness
    pageSummary.categories[0].templates = pageSummary.templates

    const result = parseDetectionResponse({
      rawResponse,
      availableComponents: patterns,
      pageSummary,
      url: 'https://example.com/recipes/hashbrown-egg-cups',
      confidenceThreshold: 0.25
    })

    expect(result.components.find(component => component.component === 'blog-post')).toBeDefined()
    expect(result.pageTemplate.templateKey).toBe('blog/post-standard')
  })
})
