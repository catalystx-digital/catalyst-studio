import { detectionParserInternals, parseDetectionResponse } from '../response-parser'
import { PageTemplateCategory } from '@/lib/studio/pages/_core/types'
import type { PageCatalogSummary, PageCatalogTemplateSummary } from '@/lib/studio/pages/catalog'
import type { ComponentPattern } from '../types'

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
    routeHints: undefined
  },
  canonical: undefined,
  detectionGuidance: undefined,
  regionPolicies: undefined
})

const summary: PageCatalogSummary = {
  total: 2,
  generatedAt: new Date().toISOString(),
  templates: [
    buildTemplate('marketing/home-default', PageTemplateCategory.Marketing),
    buildTemplate('blog/post-standard', PageTemplateCategory.Blog)
  ],
  categories: [],
  homeEligibleTemplates: ['marketing/home-default']
}

const patterns: ComponentPattern[] = [
  { type: 'navbar', category: 'navigation', confidence: 0.9, keywords: [], patterns: [] },
  { type: 'blog-post', category: 'blog', confidence: 0.9, keywords: [], patterns: [] }
]

describe('resolvePageTemplate strict contract', () => {
  it('retains registered model template predictions', () => {
    const result = detectionParserInternals.resolvePageTemplate(
      { templateKey: 'blog/post-standard', confidence: 0.9, reason: 'Model selected blog post' },
      summary,
      'https://example.com/blog/foo'
    )

    expect(result).toEqual({
      templateKey: 'blog/post-standard',
      confidence: 0.9,
      reason: 'Model selected blog post',
      source: 'model'
    })
  })

  it('rejects omitted template predictions instead of selecting a fallback', () => {
    expect(() =>
      detectionParserInternals.resolvePageTemplate(
        {},
        summary,
        'https://example.com/articles/foo'
      )
    ).toThrow('pageTemplate.templateKey is required')
  })

  it('rejects unknown template predictions instead of selecting a fallback', () => {
    expect(() =>
      detectionParserInternals.resolvePageTemplate(
        { templateKey: 'unknown-template', confidence: 0.6 },
        summary,
        'https://example.com/articles/foo'
      )
    ).toThrow('is not registered')
  })
})

describe('parseComponentsArray strict contract', () => {
  it('parses contract-shaped component objects', () => {
    const components = detectionParserInternals.parseComponentsArray(
      [
        { component: 'navbar', confidence: 0.9, content: { region: 'header' } },
        { component: 'blog-post', confidence: 0.95, content: { region: 'main', bodyHtml: '<p>Hello</p>' } }
      ],
      patterns,
      0.25,
      'https://example.com/test'
    )

    expect(components).toHaveLength(2)
    expect(components[0].component).toBe('navbar')
    expect(components[1].component).toBe('blog-post')
    expect((components[1].content as any)?.region).toBe('main')
  })

  it('rejects tuple-shaped legacy component output', () => {
    expect(() =>
      detectionParserInternals.parseComponentsArray(
        [
          ['navbar', 0.9, { region: 'header' }]
        ] as any,
        patterns,
        0.25,
        'https://example.com/test'
      )
    ).toThrow('components[0] must be an object')
  })

  it('rejects component types missing from the catalog', () => {
    expect(() =>
      detectionParserInternals.parseComponentsArray(
        [
          { component: 'hero-carousel', confidence: 0.88, content: { region: 'hero', slides: [] } }
        ],
        [patterns[0]],
        0.25,
        'https://example.com/home'
      )
    ).toThrow('is not registered')
  })
})

describe('parseDetectionResponse strict contract', () => {
  it('parses valid JSON object responses end-to-end', () => {
    const rawResponse = JSON.stringify({
      components: [
        { component: 'navbar', confidence: 0.9, content: { region: 'header' } },
        { component: 'blog-post', confidence: 0.95, content: { region: 'main', bodyHtml: '<p>Hello</p>' } }
      ],
      pageTemplate: { templateKey: 'blog/post-standard', confidence: 0.95, reason: 'LLM classified page as blog post' }
    })

    const result = parseDetectionResponse({
      rawResponse,
      availableComponents: patterns,
      pageSummary: summary,
      url: 'https://example.com/recipes/hashbrown-egg-cups',
      confidenceThreshold: 0.25
    })

    expect(result.components.find(component => component.component === 'blog-post')).toBeDefined()
    expect(result.pageTemplate.templateKey).toBe('blog/post-standard')
  })

  it('rejects fenced or otherwise non-JSON responses', () => {
    expect(() =>
      parseDetectionResponse({
        rawResponse: '```json\n{"components":[],"pageTemplate":{"templateKey":"blog/post-standard"}}\n```',
        availableComponents: patterns,
        pageSummary: summary,
        url: 'https://example.com/blog/post',
        confidenceThreshold: 0.25
      })
    ).toThrow()
  })
})
