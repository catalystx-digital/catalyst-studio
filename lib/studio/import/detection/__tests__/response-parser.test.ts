import { detectionParserInternals, parseDetectionResponse } from '../response-parser'
import { PageTemplateCategory } from '@/lib/studio/pages/_core/types'
import type { PageCatalogSummary, PageCatalogTemplateSummary } from '@/lib/studio/pages/catalog'
import type { ComponentPattern } from '../types'
import { initializeCMSComponents } from '@/lib/studio/components/cms/_factory/initialize'
import { refreshComponentContracts } from '@/lib/studio/components/catalog/component-contracts'

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
  { type: 'blog-post', category: 'blog', confidence: 0.9, keywords: [], patterns: [] },
  { type: 'cta-banner', category: 'cta', confidence: 0.9, keywords: [], patterns: [] },
  { type: 'cta-simple', category: 'cta', confidence: 0.9, keywords: [], patterns: [] },
  { type: 'hero-banner', category: 'hero', confidence: 0.9, keywords: [], patterns: [] }
]

beforeAll(async () => {
  await initializeCMSComponents()
  refreshComponentContracts()
})

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
        { component: 'navbar', confidence: 0.9, content: { menuItems: [{ label: 'Home', href: { type: 'external', url: 'https://example.com/' } }] } },
        { component: 'blog-post', confidence: 0.95, content: { bodyHtml: '<p>Hello</p>' } }
      ],
      patterns,
      0.25,
      'https://example.com/test'
    )

    expect(components).toHaveLength(2)
    expect(components[0].component).toBe('navbar')
    expect(components[1].component).toBe('blog-post')
    expect((components[1].content as any)?.bodyHtml).toBe('<p>Hello</p>')
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

  it('rejects unsupported component content fields before persistence', () => {
    expect(() =>
      detectionParserInternals.parseComponentsArray(
        [
          {
            component: 'cta-banner',
            confidence: 0.9,
            content: {
              heading: 'Build faster',
              body: 'Unsupported field from model output'
            }
          }
        ],
        patterns,
        0.25,
        'https://example.com/'
      )
    ).toThrow('body:unknown-field')
  })

  it('accepts heading-only cta-banner section-title payloads', () => {
    const components = detectionParserInternals.parseComponentsArray(
      [
        {
          component: 'cta-banner',
          confidence: 0.9,
          content: {
            heading: 'Advance Care Planning',
            alignment: 'left'
          }
        }
      ],
      patterns,
      0.25,
      'https://example.com/services'
    )

    expect(components[0].content).toEqual({
      heading: 'Advance Care Planning',
      alignment: 'left'
    })
  })

  it('rejects nested cta-banner button alias fields', () => {
    expect(() =>
      detectionParserInternals.parseComponentsArray(
        [
          {
            component: 'cta-banner',
            confidence: 0.9,
            content: {
              heading: 'Support the Hospital',
              primaryButton: {
                text: 'Donate Now',
                url: '/donate',
                variant: 'primary'
              }
            }
          }
        ],
        patterns,
        0.25,
        'https://example.com/support'
      )
    ).toThrow('primaryButton.label:invalid_type')
  })

  it('rejects model bookkeeping fields inside component content', () => {
    expect(() =>
      detectionParserInternals.parseComponentsArray(
        [
          {
            component: 'hero-banner',
            confidence: 0.92,
            content: {
              heading: 'Blog',
              backgroundImage: 'https://example.com/blog.jpg',
              region: 'hero',
              metadata: { source: 'model' }
            }
          }
        ],
        patterns,
        0.25,
        'https://example.com/blog'
      )
    ).toThrow('region:unknown-field')
  })

  it('rejects unknown top-level fields even when a custom normalizer exists', () => {
    expect(() =>
      detectionParserInternals.parseComponentsArray(
        [
          {
            component: 'cta-simple',
            confidence: 0.91,
            content: {
              heading: 'Talk to us',
              primaryButton: { text: 'Contact', url: '/contact' },
              unexpectedModelField: 'legacy passthrough'
            }
          }
        ],
        patterns,
        0.25,
        'https://example.com/contact'
      )
    ).toThrow('unexpectedModelField:unknown-field')
  })
})

describe('parseDetectionResponse strict contract', () => {
  it('parses valid JSON object responses end-to-end', () => {
    const rawResponse = JSON.stringify({
      components: [
        { component: 'navbar', confidence: 0.9, content: { menuItems: [{ label: 'Home', href: { type: 'external', url: 'https://example.com/' } }] } },
        { component: 'blog-post', confidence: 0.95, content: { bodyHtml: '<p>Hello</p>' } }
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
