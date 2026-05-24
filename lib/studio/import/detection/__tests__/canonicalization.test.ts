import { parseDetectionResponse } from '@/lib/studio/import/detection/response-parser'
import type { ComponentPattern } from '@/lib/studio/import/detection/types'
import type { PageCatalogSummary, PageCatalogTemplateSummary } from '@/lib/studio/ai/page-catalog'
import { PageTemplateCategory } from '@/lib/studio/pages/_core/types'

describe('detection canonicalization', () => {
  const blogTemplate: PageCatalogTemplateSummary = {
    templateKey: 'blog/post-standard',
    name: 'Blog Post',
    category: PageTemplateCategory.Blog,
    isHomeEligible: false,
    description: 'Blog article detail',
    requiredRegions: [
      {
        region: 'main',
        allowedComponents: ['blog-post'],
        min: 1,
        max: 1
      }
    ],
    optionalRegions: [],
    propsMeta: undefined,
    aiMetadata: {
      keywords: ['blog'],
      layoutGuidelines: [],
      contentGuidelines: [],
      recommendedComponents: [],
      discouragedComponents: [],
      exampleUseCases: [],
      routeHints: ['/blog/']
    }
  }

  const blogSummary: PageCatalogSummary = {
    total: 1,
    generatedAt: '2024-07-01T00:00:00.000Z',
    templates: [blogTemplate],
    categories: [
      {
        category: PageTemplateCategory.Blog,
        templates: [blogTemplate]
      }
    ],
    homeEligibleTemplates: []
  }

  const blogComponents: ComponentPattern[] = [
    { type: 'article-header', confidence: 0.9 },
    { type: 'text-block', confidence: 0.9 },
    { type: 'author-bio', confidence: 0.9 },
    { type: 'image-gallery', confidence: 0.9 },
    { type: 'blog-post', confidence: 0.95, metadata: { category: 'blog' } }
  ]

  it('rejects blog-post fragments when the selected template requires the canonical blog-post component', () => {
    const spyWarn = jest.spyOn(console, 'warn').mockImplementation(() => undefined)

    const rawResponse = JSON.stringify({
      pageTemplate: { templateKey: 'blog/post-standard', confidence: 0.62 },
      components: [
        {
          component: 'article-header',
          confidence: 0.82,
          content: {
            title: 'Barc x Farmgate Meats Launch New Market',
            subtitle: 'Regional butchers partner with the centre.',
            publishDate: '2024-07-12',
            author: { name: 'Jane Smith' },
            heroImage: { src: 'https://example.com/hero.jpg', alt: 'Farmgate storefront' }
          }
        },
        {
          component: 'text-block',
          confidence: 0.8,
          content: {
            html: '<p>Bathurst City Centre welcomes a farm-to-market collaboration bringing fresh produce downtown.</p>'
          }
        },
        {
          component: 'author-bio',
          confidence: 0.78,
          content: {
            name: 'Jane Smith',
            title: 'Food Editor'
          }
        }
      ]
    })

    expect(() =>
      parseDetectionResponse({
        rawResponse,
        availableComponents: blogComponents,
        pageSummary: blogSummary,
        url: 'https://bathurstcitycentre.qicre.com/articles/barc-x-farmgate-meats',
        confidenceThreshold: 0.1
      })
    ).toThrow(
      'Detection output omitted required canonical component(s) for template "blog/post-standard": main:blog-post min=1'
    )
    expect(spyWarn).toHaveBeenCalledWith(
      expect.stringContaining('canonical-required-missing'),
      expect.objectContaining({ canonicalType: 'blog-post' })
    )

    spyWarn.mockRestore()
  })

  it('does not synthesize when canonical component already exists', () => {
    const spyInfo = jest.spyOn(console, 'info').mockImplementation(() => undefined)

    const rawResponse = JSON.stringify({
      pageTemplate: { templateKey: 'blog/post-standard', confidence: 0.92 },
      components: [
        {
          component: 'blog-post',
          confidence: 0.94,
          content: {
            title: 'Existing Canonical Article',
            bodyHtml: '<p>Existing body</p>'
          }
        }
      ]
    })

    const result = parseDetectionResponse({
      rawResponse,
      availableComponents: blogComponents,
      pageSummary: blogSummary,
      url: 'https://example.com/blog/existing',
      confidenceThreshold: 0.1
    })

    const canonicalCount = result.components.filter(component => normalize(component.component) === 'blog-post').length
    expect(canonicalCount).toBe(1)
    const canonicalComponent = result.components.find(component => normalize(component.component) === 'blog-post')
    expect(canonicalComponent?.content?.bodyHtml).toBe('<p>Existing body</p>')
    expect((canonicalComponent?.content as any)?.body).toBeUndefined()
    expect(spyInfo).toHaveBeenCalledWith(expect.stringContaining('canonical-present'), expect.objectContaining({ canonicalType: 'blog-post' }))

    spyInfo.mockRestore()
  })

  it('rejects missing required navigation for marketing home', () => {
    const marketingTemplate: PageCatalogTemplateSummary = {
      templateKey: 'marketing/home-default',
      name: 'Marketing Home',
      category: PageTemplateCategory.Marketing,
      isHomeEligible: true,
      description: 'Marketing homepage with navigation and footer requirements.',
      requiredRegions: [
        {
          region: 'header',
          allowedComponents: ['navbar'],
          min: 1
        },
        {
          region: 'footer',
          allowedComponents: ['footer'],
          min: 1
        }
      ],
      optionalRegions: [],
      propsMeta: undefined,
      aiMetadata: {
        keywords: ['marketing home'],
        layoutGuidelines: [],
        contentGuidelines: [],
        recommendedComponents: [],
        discouragedComponents: [],
        exampleUseCases: [],
        routeHints: ['/']
      }
    }

    const marketingSummary: PageCatalogSummary = {
      total: 1,
      generatedAt: '2024-07-01T00:00:00.000Z',
      templates: [marketingTemplate],
      categories: [
        {
          category: PageTemplateCategory.Marketing,
          templates: [marketingTemplate]
        }
      ],
      homeEligibleTemplates: ['marketing/home-default']
    }

    const marketingPatterns: ComponentPattern[] = [
      { type: 'navbar', confidence: 0.9 },
      { type: 'footer', confidence: 0.9 },
      { type: 'feature-grid', confidence: 0.85 }
    ]

    const rawResponse = JSON.stringify({
      pageTemplate: { templateKey: 'marketing/home-default', confidence: 0.71 },
      components: [
        {
          component: 'feature-grid',
          confidence: 0.82,
          content: {
            heading: 'Why brands choose us',
            subheading: 'Outcomes powered by collaborative tooling.',
            features: [
              { icon: 'bolt', title: 'Speed', description: 'Launch campaigns in days.' },
              { icon: 'shield', title: 'Trust', description: 'Enterprise-grade security.' }
            ]
          }
        }
      ]
    })

    expect(() =>
      parseDetectionResponse({
        rawResponse,
        availableComponents: marketingPatterns,
        pageSummary: marketingSummary,
        url: 'https://example.com/',
        confidenceThreshold: 0.1
      })
    ).toThrow(
      'Detection output omitted required canonical component(s) for template "marketing/home-default": header:navbar min=1, footer:footer min=1'
    )
  })

  it('rejects missing required hero content for product detail', () => {
    const productTemplate: PageCatalogTemplateSummary = {
      templateKey: 'commerce/product-detail',
      name: 'Product Detail',
      category: PageTemplateCategory.Commerce,
      isHomeEligible: false,
      description: 'Product detail layout with required hero',
      requiredRegions: [
        { region: 'header', allowedComponents: ['navbar'], min: 1 },
        { region: 'hero', allowedComponents: ['hero-with-image', 'hero-split', 'hero-carousel', 'hero-video'], min: 1 }
      ],
      optionalRegions: [],
      propsMeta: undefined,
      aiMetadata: {
        keywords: ['product detail'],
        layoutGuidelines: [],
        contentGuidelines: [],
        recommendedComponents: [],
        discouragedComponents: [],
        exampleUseCases: [],
        routeHints: ['/products/']
      }
    }

    const productSummary: PageCatalogSummary = {
      total: 1,
      generatedAt: '2024-07-01T00:00:00.000Z',
      templates: [productTemplate],
      categories: [{ category: PageTemplateCategory.Commerce, templates: [productTemplate] }],
      homeEligibleTemplates: []
    }

    const productPatterns: ComponentPattern[] = [
      { type: 'navbar', confidence: 0.9 },
      { type: 'hero-with-image', confidence: 0.9 },
      { type: 'feature-grid', confidence: 0.85 }
    ]

    const rawResponse = JSON.stringify({
      pageTemplate: { templateKey: 'commerce/product-detail', confidence: 0.64 },
      pageMetadata: {
        title: 'Catalyst Pro X',
        description: 'All-in-one platform for omnichannel content delivery.',
        openGraph: { image: 'https://cdn.example.com/products/pro-x.jpg' }
      },
      components: [
        {
          component: 'feature-grid',
          confidence: 0.82,
          content: {
            heading: 'Platform capabilities',
            features: [
              { icon: 'bolt', title: 'Performance', description: 'Optimized global delivery.' },
              { icon: 'lock', title: 'Security', description: 'Enterprise-grade compliance.' }
            ]
          }
        }
      ]
    })

    expect(() =>
      parseDetectionResponse({
        rawResponse,
        availableComponents: productPatterns,
        pageSummary: productSummary,
        url: 'https://example.com/products/pro-x',
        confidenceThreshold: 0.1
      })
    ).toThrow(
      'Detection output omitted required canonical component(s) for template "commerce/product-detail": header:navbar min=1'
    )
  })
})

function normalize(value: string | undefined): string | undefined {
  if (!value) {
    return undefined
  }
  return value.trim().toLowerCase()
}
