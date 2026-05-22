import { PageBuilderService } from '../page-builder-service'
import { PrismaClient, WebsitePage, WebsiteSharedComponent } from '@/lib/generated/prisma'
import { PageContentNormalizationError } from '@/lib/studio/page-content'
import { getPageCatalogSummary } from '@/lib/studio/pages/catalog'
import { TemplateValidationError } from '@/lib/studio/pages/validation/template-validation'
import { mockDeep, DeepMockProxy } from 'jest-mock-extended'
import {
  ComponentType,
  DetectionResult,
  PageData,
  ComponentInstance,
  ComponentTree
} from '../interfaces'
import { CanonicalSignatureSharedComponentDetector } from '../shared-component-detectors/canonical-signature-detector'

jest.mock('@/lib/studio/pages/catalog', () => ({
  getPageCatalogSummary: jest.fn()
}))

// Mock Prisma client
const mockPrisma = mockDeep<PrismaClient>()
type MockPrisma = DeepMockProxy<PrismaClient>

const buildCatalogSummary = () => {
  const templates = [
    {
      templateKey: 'core/folder',
      name: 'Navigation Folder',
      category: 'core',
      isHomeEligible: false,
      description: 'Folder used for organizing site navigation.',
      requiredRegions: [],
      optionalRegions: [],
      contentSchema: {
        components: {
          type: 'component-list',
          required: false,
          allowedComponentTypes: []
        }
      },
      propsMeta: undefined,
      aiMetadata: {
        keywords: ['folder'],
        layoutGuidelines: [],
        contentGuidelines: [],
        recommendedComponents: [],
        discouragedComponents: [],
        exampleUseCases: [],
        routeHints: []
      }
    },
    {
      templateKey: 'core/generic-default',
      name: 'Generic Content Page',
      category: 'core',
      isHomeEligible: false,
      description: 'Generic fallback template',
      requiredRegions: [],
      optionalRegions: [
        { region: 'hero', allowedComponents: ['hero-banner'] },
        { region: 'main', allowedComponents: ['text-block', 'feature-grid'] }
      ],
      contentSchema: {
        components: {
          type: 'component-list',
          required: true,
          allowedComponentTypes: ['hero-banner', 'text-block', 'feature-grid']
        }
      },
      propsMeta: undefined,
      aiMetadata: {
        keywords: ['generic'],
        layoutGuidelines: [],
        contentGuidelines: [],
        recommendedComponents: [],
        discouragedComponents: [],
        exampleUseCases: [],
        routeHints: ['/generic']
      }
    },
    {
      templateKey: 'marketing/home-default',
      name: 'Marketing Home',
      category: 'marketing',
      isHomeEligible: true,
      description: 'Default marketing home template',
      requiredRegions: [],
      optionalRegions: [],
      contentSchema: {
        components: {
          type: 'component-list',
          required: true,
          allowedComponentTypes: ['navbar', 'hero-banner', 'feature-grid', 'footer']
        }
      },
      propsMeta: undefined,
      aiMetadata: {
        keywords: ['home'],
        layoutGuidelines: [],
        contentGuidelines: [],
        recommendedComponents: [],
        discouragedComponents: [],
        exampleUseCases: [],
        routeHints: ['/']
      }
    },
    {
      templateKey: 'blog/index-standard',
      name: 'Blog Index',
      category: 'blog',
      isHomeEligible: false,
      description: 'Blog listing template',
      requiredRegions: [],
      optionalRegions: [],
      contentSchema: {
        components: {
          type: 'component-list',
          required: true,
          allowedComponentTypes: ['blog-list', 'hero-banner']
        }
      },
      propsMeta: undefined,
      aiMetadata: {
        keywords: ['blog'],
        layoutGuidelines: [],
        contentGuidelines: [],
        recommendedComponents: [],
        discouragedComponents: [],
        exampleUseCases: [],
        routeHints: ['/blog']
      }
    }
  ]

  return {
    total: templates.length,
    generatedAt: new Date().toISOString(),
    templates,
    categories: [
      { category: 'core', templates: [templates[0], templates[1]] },
      { category: 'marketing', templates: [templates[2]] },
      { category: 'blog', templates: [templates[3]] }
    ],
    homeEligibleTemplates: ['marketing/home-default']
  }
}

describe('PageBuilderService', () => {
  let service: PageBuilderService
  let prisma: MockPrisma

  beforeEach(() => {
    prisma = mockDeep<PrismaClient>()
    service = new PageBuilderService(prisma)
    service.configureContentTypes({
      defaultContentTypeId: 'content-type-1',
      templateContentTypes: new Map()
    })
    jest.clearAllMocks()
    ;(getPageCatalogSummary as jest.Mock).mockResolvedValue(buildCatalogSummary())
  })

  describe('createPage', () => {
    const mockPageData: PageData = {
      title: 'Test Page',
      url: 'https://example.com/test',
      screenshot: 'screenshot.png',
      detectedComponents: [
        {
          id: 'detection-1',
          type: 'hero-banner',
          bounds: { x: 0, y: 0, width: 1920, height: 600 },
          content: 'Welcome to Our Site',
          styles: { backgroundColor: '#ffffff' },
          confidence: 0.95,
          metadata: { importance: 'high', region: 'hero' }
        }
      ],
      metadata: {
        description: 'Test page description',
        keywords: ['test', 'page'],
        openGraph: { title: 'Test Page' }
      }
    }

    const mockComponentTypes: ComponentType[] = [
      {
        id: 'hero-type-1',
        type: 'hero-banner',
        category: 'layout',
        name: 'Hero Banner',
        description: 'A hero banner component',
        defaultConfig: {
          props: { title: 'Default Title' },
          styles: { backgroundColor: '#f0f0f0' },
          responsive: {}
        },
        placeholderData: { title: 'Hero Title', subtitle: 'Hero Subtitle' },
        aiMetadata: {
          confidence: 0.95,
          modelVersion: 'openai/gpt-4o-mini',
          detectionTimestamp: '2025-01-02T10:00:00Z',
          patternCount: 5
        },
        patterns: []
      }
    ]

    const mockWebsitePage = {
      id: 'page-1',
      websiteId: 'website-1',
      type: 'page',
      title: 'Test Page',
      content: { components: [], metadata: {} },
      metadata: {},
      templateKey: 'core/generic-default',
      templateProps: {},
      contentTypeId: 'content-type-1',
      status: 'draft',
      publishedAt: null,
      createdAt: new Date(),
      updatedAt: new Date()
    }

    beforeEach(() => {
      prisma.websitePage.update.mockReset()
      prisma.$transaction.mockImplementation(async (callback: any) => {
        return await callback(prisma)
      })
      prisma.websitePage.create.mockResolvedValue(mockWebsitePage)
      prisma.websitePage.findFirst.mockResolvedValue(null)
    })

    it('should create a page successfully', async () => {
      const result = await service.createPage(
        mockPageData,
        mockComponentTypes,
        'website-1',
        'content-type-1'
      )

      expect(result).toEqual(mockWebsitePage)
      expect(prisma.$transaction).toHaveBeenCalled()
      expect(prisma.websitePage.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          websiteId: 'website-1',
          type: 'page',
          title: 'Test Page',
          contentTypeId: 'content-type-1',
          status: 'draft',
          templateKey: 'core/generic-default',
          templateProps: expect.any(Object)
        })
      })
    })

    it('uses mapped content type when template key is configured', async () => {
      service.configureContentTypes({
        defaultContentTypeId: 'fallback-content-type',
        templateContentTypes: new Map([
          ['core/generic-default', 'template-specific-type']
        ])
      })

      await service.createPage(
        mockPageData,
        mockComponentTypes,
        'website-1',
        'content-type-1'
      )

      const createArgs = prisma.websitePage.create.mock.calls[0][0]
      expect(createArgs.data.contentTypeId).toBe('template-specific-type')
    })

    it('should handle invalid page data', async () => {
      const invalidPageData = { ...mockPageData, title: '' }

      await expect(service.createPage(
        invalidPageData,
        mockComponentTypes,
        'website-1',
        'content-type-1'
      )).rejects.toThrow()
    })

    it('throws when a required main region is missing instead of injecting a fallback component', async () => {
      const summaryWithRequirement = buildCatalogSummary()
      const marketingTemplate = summaryWithRequirement.templates.find(
        template => template.templateKey === 'marketing/home-default'
      )
      if (marketingTemplate) {
        marketingTemplate.requiredRegions = [
          {
            region: 'main',
            allowedComponents: ['text-block'],
            min: 1,
            description: 'Primary content area'
          }
        ]
        marketingTemplate.optionalRegions = [
          {
            region: 'hero',
            allowedComponents: ['hero-banner'],
            description: 'Optional hero section'
          }
        ]
      }

      ;(getPageCatalogSummary as jest.Mock).mockResolvedValueOnce(summaryWithRequirement)

      const fallbackComponentTypes: ComponentType[] = [
        ...mockComponentTypes,
        {
          id: 'text-type-1',
          type: 'text-block',
          category: 'content',
          name: 'Text Block',
          description: 'Rich text block',
          defaultConfig: { props: {} },
          placeholderData: {},
          aiMetadata: {
            confidence: 0.9,
            modelVersion: 'fallback-test',
            detectionTimestamp: new Date().toISOString(),
            patternCount: 1
          },
          patterns: []
        }
      ]

      prisma.websitePage.create.mockResolvedValue(mockWebsitePage)

      const pageData: PageData = {
        ...mockPageData,
        detectedComponents: [
          {
            id: 'hero-detection',
            type: 'hero-banner',
            bounds: { x: 0, y: 0, width: 1920, height: 600 },
            content: JSON.stringify({
              heading: 'Welcome',
              body: '<p>Intro content</p>',
              region: 'hero'
            }),
            metadata: { region: 'hero' }
          }
        ],
        pageTemplate: {
          templateKey: 'marketing/home-default'
        }
      }

      let thrown: unknown
      try {
        await service.createPage(pageData, fallbackComponentTypes, 'website-1', 'content-type-1')
      } catch (error) {
        thrown = error
      }

      expect(thrown).toBeInstanceOf(TemplateValidationError)
      expect((thrown as TemplateValidationError).templateKey).toBe('marketing/home-default')
      expect((thrown as TemplateValidationError).pageUrl).toBe(pageData.url)
      expect((thrown as TemplateValidationError).issues).toEqual([
        expect.objectContaining({
          type: 'region',
          code: 'region.min',
          message: 'Region "main" requires at least 1 component(s); found 0.',
          severity: 'error',
          details: expect.objectContaining({
            region: 'main',
            currentCount: 0,
            minRequired: 1,
            allowedComponents: ['text-block']
          })
        })
      ])
      expect((thrown as Error).message).toContain('region.min:')
      expect(prisma.websitePage.create).not.toHaveBeenCalled()
    })

    it('throws when an article template requires a missing blog-post instead of injecting fallback content', async () => {
      const summaryWithRequirement = buildCatalogSummary()
      const articleTemplate = summaryWithRequirement.templates.find(
        template => template.templateKey === 'core/generic-default'
      )
      if (articleTemplate) {
        articleTemplate.requiredRegions = [
          {
            region: 'main',
            allowedComponents: ['blog-post'],
            min: 1,
            description: 'Primary article content'
          }
        ]
      }

      ;(getPageCatalogSummary as jest.Mock).mockResolvedValueOnce(summaryWithRequirement)

      const blogComponentType: ComponentType = {
        id: 'blog-type-1',
        type: 'blog-post',
        category: 'blog',
        name: 'Blog Post',
        description: 'Article detail component',
        defaultConfig: {
          props: {
            content: {
              title: 'Fallback Article',
              bodyHtml: '<p>Fallback content</p>'
            }
          }
        },
        placeholderData: {},
        aiMetadata: {
          confidence: 0.9,
          modelVersion: 'fallback-test',
          detectionTimestamp: new Date().toISOString(),
          patternCount: 1
        },
        patterns: []
      }

      const componentTypes: ComponentType[] = [
        ...mockComponentTypes,
        blogComponentType
      ]

      prisma.websitePage.create.mockResolvedValue(mockWebsitePage)

      const pageData: PageData = {
        ...mockPageData,
        metadata: {
          description: 'Imported description for blog article fallback.',
          openGraph: {
            image: 'https://example.com/images/article-hero.jpg',
            author: 'Fallback Author',
            publishedTime: '2024-09-10'
          }
        },
        pageTemplate: {
          templateKey: 'core/generic-default'
        }
      }

      await expect(service.createPage(pageData, componentTypes, 'website-1', 'content-type-1'))
        .rejects
        .toThrow(TemplateValidationError)
      expect(prisma.websitePage.create).not.toHaveBeenCalled()
    })

    it('throws TemplateValidationError for required region validation errors and does not persist the page', async () => {
      const summaryWithRegionValidation = buildCatalogSummary()
      const targetTemplate = summaryWithRegionValidation.templates.find(
        template => template.templateKey === 'core/generic-default'
      )
      if (targetTemplate) {
        targetTemplate.requiredRegions = [
          {
            region: 'main',
            allowedComponents: [],
            min: 1
          }
        ]
      }

      ;(getPageCatalogSummary as jest.Mock).mockResolvedValueOnce(summaryWithRegionValidation)

      const pageData: PageData = {
        ...mockPageData,
        detectedComponents: [
          {
            id: 'hero-detection',
            type: 'hero-banner',
            bounds: { x: 0, y: 0, width: 1920, height: 600 },
            content: JSON.stringify({ heading: 'Welcome' }),
            metadata: { region: 'hero' }
          }
        ],
        pageTemplate: {
          templateKey: 'core/generic-default'
        }
      }

      let thrown: unknown
      try {
        await service.createPage(pageData, mockComponentTypes, 'website-1', 'content-type-1')
      } catch (error) {
        thrown = error
      }

      expect(thrown).toBeInstanceOf(TemplateValidationError)
      expect((thrown as TemplateValidationError).templateKey).toBe('core/generic-default')
      expect((thrown as TemplateValidationError).pageUrl).toBe(pageData.url)
      expect((thrown as TemplateValidationError).issues).toEqual([
        expect.objectContaining({
          code: 'region.min',
          severity: 'error'
        })
      ])
      expect((thrown as Error).message).toContain('region.min:')
      expect(prisma.websitePage.create).not.toHaveBeenCalled()
    })

    it('persists warning-only template validation as a valid draft without warning downgrade status', async () => {
      const summaryWithWarning = buildCatalogSummary()
      const targetTemplate = summaryWithWarning.templates.find(
        template => template.templateKey === 'core/generic-default'
      )
      if (targetTemplate) {
        targetTemplate.optionalRegions = [
          {
            region: 'hero',
            allowedComponents: ['hero-banner'],
            max: 1
          }
        ]
      }

      ;(getPageCatalogSummary as jest.Mock).mockResolvedValueOnce(summaryWithWarning)

      const pageData: PageData = {
        ...mockPageData,
        detectedComponents: [
          {
            id: 'hero-detection-1',
            type: 'hero-banner',
            bounds: { x: 0, y: 0, width: 1920, height: 400 },
            content: JSON.stringify({ heading: 'Welcome' }),
            metadata: { region: 'hero' }
          },
          {
            id: 'hero-detection-2',
            type: 'hero-banner',
            bounds: { x: 0, y: 400, width: 1920, height: 300 },
            content: JSON.stringify({ heading: 'More detail' }),
            metadata: { region: 'hero' }
          }
        ],
        pageTemplate: {
          templateKey: 'core/generic-default'
        }
      }

      await service.createPage(pageData, mockComponentTypes, 'website-1', 'content-type-1')

      const createArgs = prisma.websitePage.create.mock.calls[0][0]
      expect(createArgs.data.status).toBe('draft')
      expect(createArgs.data.metadata.validationStatus).toBe('valid')
      expect(createArgs.data.metadata.importStatus).not.toBe('ready-with-warnings')
      expect(createArgs.data.metadata.validationStatus).not.toBe('has-warnings')
      expect(createArgs.data.metadata.importIssueSummary).toEqual({
        errors: 0,
        warnings: 1
      })
      expect(createArgs.data.metadata.importIssues).toEqual([
        expect.objectContaining({
          code: 'region.max',
          severity: 'warning'
        })
      ])
    })

    it('throws when required header/footer regions are missing instead of injecting fallbacks', async () => {
      const summaryWithRegions = buildCatalogSummary()
      const targetTemplate = summaryWithRegions.templates[0]
      targetTemplate.requiredRegions = [
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
      ]
      targetTemplate.optionalRegions = [
        {
          region: 'main',
          allowedComponents: ['text-block']
        }
      ]

      ;(getPageCatalogSummary as jest.Mock).mockResolvedValueOnce(summaryWithRegions)

      const enrichedComponentTypes: ComponentType[] = [
        ...mockComponentTypes,
        {
          id: 'nav-type-1',
          type: 'navbar',
          category: 'navigation',
          name: 'Navigation Bar',
          description: 'Primary site navigation',
          defaultConfig: {
            props: {
              content: {
                logo: { text: 'Brand' },
                menuItems: []
              }
            }
          },
          placeholderData: {},
          aiMetadata: {
            confidence: 0.9,
            modelVersion: 'fallback-test',
            detectionTimestamp: new Date().toISOString(),
            patternCount: 1
          },
          patterns: []
        },
        {
          id: 'footer-type-1',
          type: 'footer',
          category: 'navigation',
          name: 'Footer',
          description: 'Site footer component',
          defaultConfig: {
            props: {
              copyright: '© 2024',
              columns: []
            }
          },
          placeholderData: {},
          aiMetadata: {
            confidence: 0.9,
            modelVersion: 'fallback-test',
            detectionTimestamp: new Date().toISOString(),
            patternCount: 1
          },
          patterns: []
        },
        {
          id: 'text-type-1',
          type: 'text-block',
          category: 'content',
          name: 'Text Block',
          description: 'Rich text block',
          defaultConfig: { props: {} },
          placeholderData: {},
          aiMetadata: {
            confidence: 0.9,
            modelVersion: 'fallback-test',
            detectionTimestamp: new Date().toISOString(),
            patternCount: 1
          },
          patterns: []
        },
        {
          id: 'quote-type-1',
          type: 'quote-block',
          category: 'social-proof',
          name: 'Quote Block',
          description: 'Testimonial quote block',
          defaultConfig: { props: {} },
          placeholderData: {},
          aiMetadata: {
            confidence: 0.9,
            modelVersion: 'fallback-test',
            detectionTimestamp: new Date().toISOString(),
            patternCount: 1
          },
          patterns: []
        }
      ]

      prisma.websitePage.create.mockResolvedValue(mockWebsitePage)

      const pageData: PageData = {
        ...mockPageData,
        pageTemplate: {
          templateKey: targetTemplate.templateKey
        },
        detectedComponents: [
          {
            id: 'quote-detection',
            type: 'text-block',
            bounds: { x: 0, y: 0, width: 800, height: 200 },
            content: JSON.stringify({ body: 'Great service!' }),
            metadata: { region: 'main' }
          }
        ]
      }

      await expect(service.createPage(pageData, enrichedComponentTypes, 'website-1', 'content-type-1'))
        .rejects
        .toThrow(TemplateValidationError)
      expect(prisma.websitePage.create).not.toHaveBeenCalled()
    })

    it('rehydrates shared navbar regions before region normalization', async () => {
      const detector = new CanonicalSignatureSharedComponentDetector(prisma as unknown as PrismaClient)

      const sharedComponents = [
        {
          id: 'shared-nav-1',
          websiteId: 'website-1',
          websiteComponentTypeId: 'nav-type-1',
          name: 'Shared Navbar',
          config: {
            type: 'nav-bar',
            defaultProps: {
              region: 'header',
              placementBucket: 'top',
              metadata: {
                region: 'header',
                source: 'canonical-signature'
              }
            }
          },
          usageCount: 2,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ] as unknown as WebsiteSharedComponent[]

      const initialComponents: ComponentInstance[] = [
        {
          id: 'navbar-1',
          type: 'nav-bar',
          typeId: 'nav-type-1',
          componentTypeId: 'nav-type-1',
          parentId: null,
          position: 0,
          props: {
            region: 'header',
            placementBucket: 'top',
            metadata: {
              region: 'header',
              source: 'detected'
            },
            className: 'site-navbar'
          }
        }
      ]

      const page: WebsitePage = {
        id: 'page-1',
        websiteId: 'website-1',
        type: 'page',
        title: 'Home',
        content: { components: initialComponents, metadata: {} },
        metadata: {},
        templateKey: 'marketing/home-default',
        templateProps: {},
        contentTypeId: 'content-type-1',
        status: 'draft',
        publishedAt: null,
        createdAt: new Date(),
        updatedAt: new Date()
      } as unknown as WebsitePage

      prisma.websitePage.update.mockImplementation(async ({ data }) => ({
        ...page,
        content: data.content
      }))

      await detector.updatePageReferences(page, sharedComponents)

      expect(prisma.websitePage.update).toHaveBeenCalled()
      const updateCall = prisma.websitePage.update.mock.calls[0][0]
      const rewrittenComponents = (updateCall.data.content as any)?.components as ComponentInstance[]

      expect(rewrittenComponents).toBeDefined()
      expect(rewrittenComponents[0].props.sharedComponentId).toBe('shared-nav-1')
      expect(rewrittenComponents[0].props.region).toBe('header')
      expect(rewrittenComponents[0].props.placementBucket).toBe('top')
      expect(rewrittenComponents[0].props.metadata?.region).toBe('header')

      const summary = buildCatalogSummary()
      const marketingTemplate = summary.templates.find(template => template.templateKey === 'marketing/home-default')
      expect(marketingTemplate).toBeDefined()

      const navComponentType: ComponentType = {
        id: 'nav-type-1',
        type: 'nav-bar',
        category: 'navigation',
        name: 'Navigation Bar',
        description: 'Shared navigation component',
        defaultConfig: {
          props: {},
          styles: {},
          responsive: {}
        },
        placeholderData: {},
        aiMetadata: {
          confidence: 0.9,
          modelVersion: 'shared-test',
          detectionTimestamp: new Date().toISOString(),
          patternCount: 1
        },
        patterns: []
      }

      const componentTypes: ComponentType[] = [
        ...mockComponentTypes,
        navComponentType
      ]

      const regionManager = (service as any).regionManager
      const normalized = regionManager.ensureRequiredRegionCoverage({
        tree: {
          components: rewrittenComponents,
          metadata: {
            totalComponents: rewrittenComponents.length,
            componentTypes: ['nav-bar'],
            maxDepth: 1
          }
        },
        template: marketingTemplate!,
        componentTypes,
        pageData: {
          title: 'Home',
          url: 'https://example.com',
          detectedComponents: []
        }
      })

      const navbarInstance = normalized.components.find(component => component.id === 'navbar-1')
      expect(navbarInstance?.props?.region).toBe('header')
      expect(navbarInstance?.props?.placementBucket).toBe('top')
    })

    it('throws when a constrained component has no assigned region instead of inferring one', async () => {
      const summaryWithRegions = buildCatalogSummary()
      const targetTemplate = summaryWithRegions.templates[0]
      targetTemplate.requiredRegions = [
        {
          region: 'header',
          allowedComponents: ['navbar'],
          min: 1
        }
      ]

      ;(getPageCatalogSummary as jest.Mock).mockResolvedValueOnce(summaryWithRegions)

      const navbarType: ComponentType = {
        id: 'nav-type-1',
        type: 'site-header',
        category: 'navigation',
        name: 'Header',
        description: 'Header component',
        defaultConfig: {
          props: {
            content: {
              logo: { text: 'Brand' },
              menuItems: []
            }
          }
        },
        placeholderData: {},
        aiMetadata: {
          confidence: 0.9,
          modelVersion: 'fallback-test',
          detectionTimestamp: new Date().toISOString(),
          patternCount: 1
        },
        patterns: []
      }

      const pageData: PageData = {
        ...mockPageData,
        pageTemplate: {
          templateKey: targetTemplate.templateKey
        },
        detectedComponents: [
          {
            id: 'nav-detection',
            type: 'navbar',
            bounds: { x: 0, y: 0, width: 1024, height: 120 },
            content: JSON.stringify({
              logo: { text: 'Brand' },
              menuItems: [{ label: 'Home', href: '/' }]
            })
          }
        ]
      }

      await expect(service.createPage(pageData, [navbarType], 'website-1', 'content-type-1'))
        .rejects.toThrow('has no valid assigned region')

      expect(prisma.websitePage.create).not.toHaveBeenCalled()
    })

    it('throws when a detected component type cannot be resolved', async () => {
      const pageDataWithUnknownComponent: PageData = {
        ...mockPageData,
        detectedComponents: [
          {
            id: 'detection-1',
            type: 'unknown-component',
            bounds: { x: 0, y: 0, width: 100, height: 100 },
            content: 'Test content'
          },
          {
            id: 'detection-2',
            type: 'hero-banner',  // This one exists in mockComponentTypes
            bounds: { x: 0, y: 0, width: 1920, height: 600 },
            content: 'Valid component'
          }
        ]
      }

      await expect(service.createPage(
        pageDataWithUnknownComponent,
        mockComponentTypes,
        'website-1',
        'content-type-1'
      )).rejects.toThrow('Raw type: "unknown-component". Canonical type: "unknown-component"')

      expect(prisma.websitePage.create).not.toHaveBeenCalled()
    })

    it('should handle transaction timeout (P2024 error)', async () => {
      const timeoutError = new Error('Transaction timeout')
      timeoutError.name = 'P2024'
      
      prisma.$transaction.mockRejectedValue(timeoutError)

      await expect(service.createPage(
        mockPageData,
        mockComponentTypes,
        'website-1',
        'content-type-1'
      )).rejects.toThrow('Transaction timeout')
    })

    it('should handle duplicate page slugs (P2002 error)', async () => {
      const uniqueConstraintError = new Error('Unique constraint violation')
      uniqueConstraintError.name = 'P2002'
      
      prisma.websitePage.create.mockRejectedValue(uniqueConstraintError)

      await expect(service.createPage(
        mockPageData,
        mockComponentTypes,
        'website-1',
        'content-type-1'
      )).rejects.toThrow('Unique constraint violation')
    })
  })

  describe('buildComponentTree', () => {
    it('should build tree with correct metadata', () => {
      const detectionResults: DetectionResult[] = [
        {
          id: 'detection-1',
          type: 'hero-banner',
          bounds: { x: 0, y: 0, width: 1920, height: 600 },
          children: [
            {
              id: 'detection-2',
              type: 'button',
              bounds: { x: 100, y: 100, width: 200, height: 50 }
            }
          ]
        },
        {
          id: 'detection-3',
          type: 'footer',
          bounds: { x: 0, y: 1000, width: 1920, height: 200 }
        }
      ]

      const result = service.buildComponentTree(detectionResults)

      expect(result.metadata.totalComponents).toBe(2)
      expect(result.metadata.componentTypes).toEqual(['hero-banner', 'footer'])
      expect(result.metadata.maxDepth).toBeGreaterThan(0)
    })

    it('should handle empty detection results', () => {
      const result = service.buildComponentTree([])

      expect(result.metadata.totalComponents).toBe(0)
      expect(result.metadata.componentTypes).toEqual([])
      expect(result.metadata.maxDepth).toBe(0)
    })
  })

  describe('mapToComponentInstances', () => {
    const mockDetectionResults: DetectionResult[] = [
      {
        id: 'detection-1',
        type: 'hero-banner',
        bounds: { x: 0, y: 0, width: 1920, height: 600 },
        content: 'Welcome to Our Site',
        styles: { backgroundColor: '#ffffff' },
        confidence: 0.95
      }
    ]

    const mockComponentTypes: ComponentType[] = [
      {
        id: 'hero-type-1',
        type: 'hero-banner',
        category: 'layout',
        name: 'Hero Banner',
        description: 'A hero banner component',
        defaultConfig: {
          props: { title: 'Default Title' },
          styles: { backgroundColor: '#f0f0f0' },
          responsive: {}
        },
        placeholderData: { title: 'Hero Title' },
        aiMetadata: {
          confidence: 0.95,
          modelVersion: 'openai/gpt-4o-mini',
          detectionTimestamp: '2025-01-02T10:00:00Z',
          patternCount: 5
        },
        patterns: []
      }
    ]

    it('should map detection results to component instances', () => {
      const result = service.mapToComponentInstances(mockDetectionResults, mockComponentTypes)

      expect(result).toHaveLength(1)
      expect(result[0]).toEqual(expect.objectContaining({
        type: 'hero-banner',
        typeId: 'hero-type-1',
        parentId: null,
        position: 0,
        props: expect.objectContaining({
          content: 'Welcome to Our Site',
          text: 'Welcome to Our Site',
          styles: { backgroundColor: '#ffffff' }
        })
      }))
      expect(result[0].id).toMatch(/^cms-hero-banner-0-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(?:-\d+)?$/i)
    })

    it('should handle nested components', () => {
      const nestedDetectionResults: DetectionResult[] = [
        {
          id: 'detection-1',
          type: 'hero-banner',
          bounds: { x: 0, y: 0, width: 1920, height: 600 },
          content: 'Hero Content',
          children: [
            {
              id: 'detection-2',
              type: 'hero-banner', // Reuse same type for simplicity
              bounds: { x: 100, y: 100, width: 200, height: 50 },
              content: 'Button Text'
            }
          ]
        }
      ]

      const result = service.mapToComponentInstances(nestedDetectionResults, mockComponentTypes)

      expect(result).toHaveLength(1)
      expect(result[0].children).toHaveLength(1)
      expect(result[0].children![0]).toEqual(expect.objectContaining({
        type: 'hero-banner',
        typeId: 'hero-type-1',
        props: expect.objectContaining({
          content: 'Button Text',
          text: 'Button Text'
        })
      }))
    })
  })

  describe('generateComponentId', () => {
    it('should generate unique IDs with correct format', async () => {
      const id1 = service.generateComponentId('hero-banner', 0)
      const id2 = service.generateComponentId('hero-banner', 0)
      const pattern = /^cms-hero-banner-0-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(?:-\d+)?$/i

      expect(id1).toMatch(pattern)
      expect(id2).toMatch(pattern)
      expect(id1).not.toBe(id2)
    })
  })

  describe('validateComponentTree', () => {
    it('should validate correct component tree', () => {
      const validTree: ComponentTree = {
        components: [
          {
            id: 'comp-1',
            type: 'hero-banner',
            typeId: 'type-1',
            parentId: null,
            position: 0,
            props: {}
          },
          {
            id: 'comp-2',
            type: 'button',
            typeId: 'type-2',
            parentId: 'comp-1',
            position: 0,
            props: {}
          }
        ],
        metadata: { totalComponents: 2, maxDepth: 1, componentTypes: ['hero-banner', 'button'] }
      }

      expect(service.validateComponentTree(validTree)).toBe(true)
    })

    it('should reject tree with orphaned components', () => {
      const invalidTree: ComponentTree = {
        components: [
          {
            id: 'comp-1',
            type: 'hero-banner',
            typeId: 'type-1',
            parentId: null,
            position: 0,
            props: {}
          },
          {
            id: 'comp-2',
            type: 'button',
            typeId: 'type-2',
            parentId: 'non-existent-parent',
            position: 0,
            props: {}
          }
        ],
        metadata: { totalComponents: 2, maxDepth: 1, componentTypes: ['hero-banner', 'button'] }
      }

      expect(service.validateComponentTree(invalidTree)).toBe(false)
    })

    it('should handle empty component tree', () => {
      const emptyTree: ComponentTree = {
        components: [],
        metadata: { totalComponents: 0, maxDepth: 0, componentTypes: [] }
      }

      expect(service.validateComponentTree(emptyTree)).toBe(true)
    })
  })

  describe('calculatePositions', () => {
    it('should calculate correct positions for components', () => {
      const components: ComponentInstance[] = [
        {
          id: 'comp-1',
          type: 'hero-banner',
          typeId: 'type-1',
          parentId: null,
          position: 99, // Should be overridden
          props: {},
          children: [
            {
              id: 'comp-2',
              type: 'button',
              typeId: 'type-2',
              parentId: 'comp-1',
              position: 88, // Should be overridden
              props: {}
            }
          ]
        },
        {
          id: 'comp-3',
          type: 'footer',
          typeId: 'type-3',
          parentId: null,
          position: 77, // Should be overridden
          props: {}
        }
      ]

      const result = service.calculatePositions(components)

      expect(result[0].position).toBe(0)
      expect(result[1].position).toBe(1)
      expect(result[0].children![0].position).toBe(0)
    })
  })

  describe('extractPageMetadata', () => {
    it('should extract metadata from detection results', () => {
      const detectionResults: DetectionResult[] = [
        {
          id: 'detection-1',
          type: 'title-heading',
          bounds: { x: 0, y: 0, width: 100, height: 50 },
          content: 'Main Page Title'
        },
        {
          id: 'detection-2',
          type: 'description-text',
          bounds: { x: 0, y: 60, width: 100, height: 30 },
          content: 'This is a page description'
        },
        {
          id: 'detection-3',
          type: 'content-text',
          bounds: { x: 0, y: 100, width: 100, height: 200 },
          content: 'some other content with keywords like technology innovation programming software development'
        }
      ]

      const result = service.extractPageMetadata(detectionResults)

      expect(result?.description).toBe('This is a page description')
      expect(result?.keywords).toContain('content')
      expect(result?.keywords).toContain('keywords')
      expect(result?.keywords?.length).toBeGreaterThan(0)
      expect(result?.openGraph?.title).toBe('Main Page Title')
      expect(result?.openGraph?.description).toBe('This is a page description')
    })

    it('should handle empty detection results', () => {
      const result = service.extractPageMetadata([])

      expect(result?.description).toBeUndefined()
      expect(result?.keywords).toEqual([])
      expect(result?.openGraph?.title).toBeUndefined()
    })
  })

  describe('optimizeComponentTree', () => {
    it('should optimize and reposition components', () => {
      const tree: ComponentTree = {
        components: [
          {
            id: 'comp-1',
            type: 'hero-banner',
            typeId: 'type-1',
            parentId: null,
            position: 99,
            props: { title: 'Hero' }
          },
          {
            id: 'comp-2',
            type: 'hero-banner',
            typeId: 'type-1',
            parentId: null,
            position: 88,
            props: { title: 'Hero' } // Duplicate content
          }
        ],
        metadata: { totalComponents: 2, maxDepth: 0, componentTypes: ['hero-banner'] }
      }

      const result = service.optimizeComponentTree(tree)

      expect(result.components).toHaveLength(1) // Duplicate removed
      expect(result.components[0].position).toBe(0) // Position recalculated
    })
  })

  describe('formatPageContent', () => {
    it('should format component tree for WebsitePage storage', () => {
      const tree: ComponentTree = {
        components: [
          {
            id: 'comp-1',
            type: 'hero-banner',
            typeId: 'type-1',
            parentId: null,
            position: 0,
            props: { title: 'Hero' }
          }
        ],
        metadata: { totalComponents: 1, maxDepth: 0, componentTypes: ['hero-banner'] }
      }

      const result = service.formatPageContent(tree, 'components')

      expect(result).toEqual({
        version: 1,
        components: [
          expect.objectContaining({
            id: 'comp-1',
            type: 'hero-banner',
            typeId: 'type-1',
            componentTypeId: 'type-1',
            parentId: null,
            position: 0,
            props: { title: 'Hero' },
            content: {},
            styles: {},
            metadata: {}
          })
        ],
        metadata: tree.metadata
      })
    })

    it('canonicalizes non-components primary content fields for WebsitePage storage', () => {
      const tree: ComponentTree = {
        components: [
          {
            id: 'section-1',
            type: 'text-block',
            typeId: 'type-1',
            parentId: null,
            position: 0,
            props: { content: { text: 'Hello' } }
          }
        ],
        metadata: { totalComponents: 1, maxDepth: 0, componentTypes: ['text-block'] }
      }

      const result = service.formatPageContent(tree, 'sections')

      expect(result).toMatchObject({
        version: 1,
        components: [
          expect.objectContaining({
            id: 'section-1',
            type: 'text-block',
            props: {},
            content: { text: 'Hello' }
          })
        ],
        metadata: tree.metadata
      })
      expect(result).not.toHaveProperty('sections')
      expect(result.components[0].props).not.toHaveProperty('content')
    })

    it('throws strict diagnostics for malformed JSON-like props.content strings', () => {
      const tree: ComponentTree = {
        components: [
          {
            id: 'text-1',
            type: 'text-block',
            typeId: 'type-1',
            parentId: null,
            position: 0,
            props: { content: '{"text": "Hello", }' }
          }
        ],
        metadata: { totalComponents: 1, maxDepth: 0, componentTypes: ['text-block'] }
      }

      expect(() => service.formatPageContent(tree, 'components')).toThrow(PageContentNormalizationError)

      try {
        service.formatPageContent(tree, 'components')
      } catch (error) {
        expect(error).toBeInstanceOf(PageContentNormalizationError)
        const codes = (error as PageContentNormalizationError).diagnostics.map(diagnostic => diagnostic.code)
        expect(codes).toEqual(expect.arrayContaining([
          'PAGE_CONTENT_COMPONENT_PROPS_CONTENT_STRING',
          'PAGE_CONTENT_COMPONENT_PROPS_CONTENT_JSON_PARSE_FAILED'
        ]))
      }
    })

    it('throws strict diagnostics for malformed JSON-like component.content strings', () => {
      const tree: ComponentTree = {
        components: [
          {
            id: 'text-1',
            type: 'text-block',
            typeId: 'type-1',
            parentId: null,
            position: 0,
            props: {},
            content: '[{"text": "Hello",]'
          }
        ],
        metadata: { totalComponents: 1, maxDepth: 0, componentTypes: ['text-block'] }
      }

      expect(() => service.formatPageContent(tree, 'components')).toThrow(PageContentNormalizationError)

      try {
        service.formatPageContent(tree, 'components')
      } catch (error) {
        expect(error).toBeInstanceOf(PageContentNormalizationError)
        const codes = (error as PageContentNormalizationError).diagnostics.map(diagnostic => diagnostic.code)
        expect(codes).toEqual(expect.arrayContaining([
          'PAGE_CONTENT_COMPONENT_CONTENT_INVALID',
          'PAGE_CONTENT_COMPONENT_CONTENT_JSON_PARSE_FAILED'
        ]))
      }
    })

    it('wraps plain non-JSON props.content and component.content strings as text content', () => {
      const tree: ComponentTree = {
        components: [
          {
            id: 'props-text-1',
            type: 'text-block',
            typeId: 'type-1',
            parentId: null,
            position: 0,
            props: { content: '[todo]' }
          },
          {
            id: 'content-text-1',
            type: 'text-block',
            typeId: 'type-1',
            parentId: null,
            position: 1,
            props: {},
            content: '{{name}}'
          }
        ],
        metadata: { totalComponents: 2, maxDepth: 0, componentTypes: ['text-block'] }
      }

      const result = service.formatPageContent(tree, 'components')

      expect(result.components).toEqual([
        expect.objectContaining({
          id: 'props-text-1',
          props: {},
          content: { text: '[todo]' }
        }),
        expect.objectContaining({
          id: 'content-text-1',
          props: {},
          content: { text: '{{name}}' }
        })
      ])
    })
  })

  describe('error handling scenarios', () => {
    it('should handle circular component dependencies', () => {
      const circularTree: ComponentTree = {
        components: [
          {
            id: 'comp-1',
            type: 'container',
            typeId: 'type-1',
            parentId: null,
            position: 0,
            props: {},
            children: [
              {
                id: 'comp-2',
                type: 'child',
                typeId: 'type-2',
                parentId: 'comp-1',
                position: 0,
                props: {},
                children: [
                  {
                    id: 'comp-1', // Circular reference
                    type: 'container',
                    typeId: 'type-1',
                    parentId: 'comp-2',
                    position: 0,
                    props: {}
                  }
                ]
              }
            ]
          }
        ],
        metadata: { totalComponents: 2, maxDepth: 2, componentTypes: ['container', 'child'] }
      }

      expect(service.validateComponentTree(circularTree)).toBe(false)
    })

    it('should handle missing required fields in PageData', async () => {
      const invalidPageData = {
        title: '',
        url: 'not-a-valid-url',
        detectedComponents: []
      }

      await expect(service.createPage(
        invalidPageData as PageData,
        [],
        'website-1',
        'content-type-1'
      )).rejects.toThrow()
    })

    it('should handle empty component types array', () => {
      const detectionResults: DetectionResult[] = [
        {
          id: 'detection-1',
          type: 'hero-banner',
          bounds: { x: 0, y: 0, width: 100, height: 100 }
        }
      ]

      expect(() => service.mapToComponentInstances(detectionResults, []))
        .toThrow('No component types provided for mapping')
    })

    it('should handle malformed URL in determinePageType', () => {
      const pageDataWithBadUrl: PageData = {
        title: 'Test',
        url: 'not-a-url',
        detectedComponents: []
      }

      // This should not throw, but default to 'page'
      const result = (service as any).determinePageType(pageDataWithBadUrl)
      expect(result).toBe('page')
    })

    it('should handle null page data in determinePageType', () => {
      const result = (service as any).determinePageType(null)
      expect(result).toBe('page')
    })

    it('should extract props with confidence score', () => {
      const detection: DetectionResult = {
        id: 'detection-1',
        type: 'hero-banner',
        bounds: { x: 0, y: 0, width: 100, height: 100 },
        content: 'Test content',
        confidence: 0.95,
        metadata: { test: 'value' }
      }

      const componentType: ComponentType = {
        id: 'type-1',
        type: 'hero-banner',
        category: 'layout',
        name: 'Hero',
        description: 'Hero component',
        defaultConfig: {
          props: { defaultProp: 'defaultValue' },
          styles: {},
          responsive: {}
        },
        placeholderData: {},
        aiMetadata: {
          confidence: 0.9,
          modelVersion: 'test',
          detectionTimestamp: '2025-01-01',
          patternCount: 1
        },
        patterns: []
      }

      const result = (service as any).extractComponentProps(detection, componentType)
      
      expect(result.confidence).toBe(0.95)
      expect(result.metadata).toEqual({ test: 'value', summary: 'Test content' })
      expect(result.defaultProp).toBe('defaultValue')
      expect(result.content).toBe('Test content')
    })

    it('should handle null values in resolveParentPage', async () => {
      const result = await (service as any).resolveParentPage(null, null)
      expect(result).toBeNull()
    })

    it('should handle empty URL in resolveParentPage', async () => {
      const result = await (service as any).resolveParentPage('', 'website-1')
      expect(result).toBeNull()
    })
  })

  describe('createPagesInBatch', () => {
    const mockPagesData = [
      {
        pageData: {
          title: 'Page 1',
          url: 'https://example.com/page1',
          detectedComponents: [
            {
              id: 'detection-1',
              type: 'hero-banner',
              bounds: { x: 0, y: 0, width: 1920, height: 600 },
              metadata: { region: 'hero' }
            }
          ]
        } as PageData,
        componentTypes: [
          {
            id: 'hero-type-1',
            type: 'hero-banner',
            category: 'layout',
            name: 'Hero Banner',
            description: 'A hero banner component',
            defaultConfig: { props: {}, styles: {}, responsive: {} },
            placeholderData: {},
            aiMetadata: {
              confidence: 0.95,
              modelVersion: 'openai/gpt-4o-mini',
              detectionTimestamp: '2025-01-02T10:00:00Z',
              patternCount: 1
            },
            patterns: []
          }
        ] as ComponentType[],
        websiteId: 'website-1',
        contentTypeId: 'content-type-1'
      }
    ]

    const mockWebsitePage = {
      id: 'page-1',
      websiteId: 'website-1',
      type: 'page',
      title: 'Page 1',
      content: { components: [], metadata: {} },
      metadata: {},
      contentTypeId: 'content-type-1',
      status: 'draft',
      publishedAt: null,
      createdAt: new Date(),
      updatedAt: new Date()
    }

    beforeEach(() => {
      prisma.$transaction.mockImplementation(async (callback: any) => {
        return await callback(prisma)
      })
      prisma.websitePage.create.mockResolvedValue(mockWebsitePage)
    })

    it('enforces home-eligible template for root pages and records selection metadata', async () => {
      ;(getPageCatalogSummary as jest.Mock).mockResolvedValue(buildCatalogSummary())

      const detection: DetectionResult = {
        id: 'page-1',
        type: 'page',
        bounds: { x: 0, y: 0, width: 1200, height: 900 },
        children: [
          {
            id: 'hero-1',
            type: 'hero-banner',
            bounds: { x: 0, y: 0, width: 1200, height: 500 },
            content: JSON.stringify({ heading: 'Welcome' }),
            metadata: { region: 'hero' }
          }
        ],
        metadata: {
          pageMetadata: { title: 'Home' }
        }
      }

      const componentTypes: ComponentType[] = [
        {
          id: 'hero-type-1',
          type: 'hero-banner',
          category: 'layout',
          name: 'Hero Banner',
          description: 'Hero section',
          defaultConfig: { props: {}, styles: {}, responsive: {} },
          placeholderData: {},
          aiMetadata: {
            confidence: 0.95,
            modelVersion: 'test',
            detectionTimestamp: '2025-01-01T00:00:00Z',
            patternCount: 1
          },
          patterns: []
        }
      ]

      await service.createPagesInBatch([
        {
          pageData: {
            title: 'Home',
            url: 'https://example.com/',
            detectedComponents: [detection],
            pageTemplate: {
              templateKey: 'blog/index-standard',
              confidence: 0.42,
              source: 'model',
              reason: 'LLM guessed blog structure'
            }
          },
          componentTypes,
          websiteId: 'website-1',
          contentTypeId: 'content-type-1'
        }
      ])

      const createArgs = prisma.websitePage.create.mock.calls[0][0]
      expect(createArgs.data.templateKey).toBe('marketing/home-default')
      expect(createArgs.data.templateProps).toEqual({})
      const templateMeta = createArgs.data.metadata.template
      expect(templateMeta).toBeDefined()
      expect(templateMeta.key).toBe('marketing/home-default')
      expect(templateMeta.source).toBe('home-enforced')
      expect(templateMeta.requestedKey).toBe('blog/index-standard')
      expect(templateMeta.enforcedHome).toBe(true)
      expect(templateMeta.reason).toContain('home-eligible')
      expect(templateMeta.confidence).toBeCloseTo(0.42)
    })

    it('preserves model-selected template for non-home paths', async () => {
      ;(getPageCatalogSummary as jest.Mock).mockResolvedValue(buildCatalogSummary())

      const detection: DetectionResult = {
        id: 'page-2',
        type: 'page',
        bounds: { x: 0, y: 0, width: 1200, height: 1200 },
        children: [
          {
            id: 'section-1',
            type: 'section-generic',
            bounds: { x: 0, y: 0, width: 1200, height: 600 },
            content: JSON.stringify({ heading: 'Latest Posts' })
          }
        ],
        metadata: {
          pageMetadata: { title: 'Blog' }
        }
      }

      const componentTypes: ComponentType[] = [
        {
          id: 'generic-type-1',
          type: 'section-generic',
          category: 'layout',
          name: 'Generic Section',
          description: 'Generic section',
          defaultConfig: { props: {}, styles: {}, responsive: {} },
          placeholderData: {},
          aiMetadata: {
            confidence: 0.9,
            modelVersion: 'test',
            detectionTimestamp: '2025-01-01T00:00:00Z',
            patternCount: 1
          },
          patterns: []
        }
      ]

      await service.createPagesInBatch([
        {
          pageData: {
            title: 'Blog',
            url: 'https://example.com/blog',
            detectedComponents: [detection],
            pageTemplate: {
              templateKey: 'blog/index-standard',
              confidence: 0.81,
              source: 'model',
              reason: 'URL indicates blog index'
            }
          },
          componentTypes,
          websiteId: 'website-1',
          contentTypeId: 'content-type-1'
        }
      ])

      const createArgs = prisma.websitePage.create.mock.calls[0][0]
      expect(createArgs.data.templateKey).toBe('blog/index-standard')
      expect(createArgs.data.templateProps).toEqual({})
      const templateMeta = createArgs.data.metadata.template
      expect(templateMeta).toBeDefined()
      expect(templateMeta.key).toBe('blog/index-standard')
      expect(templateMeta.source).toBe('model')
      expect(templateMeta.enforcedHome).toBe(false)
      expect(templateMeta.requestedKey).toBe('blog/index-standard')
    })

    it('should create multiple pages in a single transaction', async () => {
      const result = await service.createPagesInBatch(mockPagesData)

      expect(result).toHaveLength(1)
      expect(result[0]).toEqual(mockWebsitePage)
      expect(prisma.$transaction).toHaveBeenCalledWith(
        expect.any(Function),
        expect.objectContaining({
          maxWait: 10000,
          timeout: 14000,
          isolationLevel: expect.anything()
        })
      )
    })

    it('should rollback transaction if any page fails', async () => {
      const errorPagesData = [
        ...mockPagesData,
        {
          ...mockPagesData[0],
          pageData: { ...mockPagesData[0].pageData, title: '' } // Invalid title
        }
      ]

      await expect(service.createPagesInBatch(errorPagesData)).rejects.toThrow()
    })

    it('should handle empty batch', async () => {
      const result = await service.createPagesInBatch([])
      expect(result).toEqual([])
    })
  })

  describe('private helper methods', () => {
    it('should calculate max depth correctly for complex trees', () => {
      const deepTree: DetectionResult[] = [
        {
          id: 'd1',
          type: 'container',
          bounds: { x: 0, y: 0, width: 100, height: 100 },
          children: [
            {
              id: 'd2',
              type: 'section',
              bounds: { x: 0, y: 0, width: 100, height: 100 },
              children: [
                {
                  id: 'd3',
                  type: 'div',
                  bounds: { x: 0, y: 0, width: 100, height: 100 },
                  children: [
                    {
                      id: 'd4',
                      type: 'span',
                      bounds: { x: 0, y: 0, width: 100, height: 100 }
                    }
                  ]
                }
              ]
            }
          ]
        }
      ]

      const result = (service as any).calculateMaxDepth(deepTree)
      expect(result).toBe(3)
    })

    it('should format path segments correctly', () => {
      const result = (service as any).formatPathSegment('test-page_name')
      expect(result).toBe('Test Page Name')
    })

    it('should deduplicate components with identical props', () => {
      const components: ComponentInstance[] = [
        {
          id: 'comp-1',
          type: 'button',
          typeId: 'type-1',
          parentId: null,
          position: 0,
          props: { text: 'Click me' }
        },
        {
          id: 'comp-2',
          type: 'button',
          typeId: 'type-1',
          parentId: null,
          position: 1,
          props: { text: 'Click me' } // Duplicate
        },
        {
          id: 'comp-3',
          type: 'button',
          typeId: 'type-1',
          parentId: null,
          position: 2,
          props: { text: 'Different' } // Not duplicate
        }
      ]

      const result = (service as any).deduplicateComponents(components)
      expect(result).toHaveLength(2)
      expect(result[0].props.text).toBe('Click me')
      expect(result[1].props.text).toBe('Different')
    })

    it('should build hierarchical tree with proper parent-child relationships', () => {
      const components: ComponentInstance[] = [
        {
          id: 'root-1',
          type: 'container',
          typeId: 'type-1',
          parentId: null,
          position: 0,
          props: {}
        },
        {
          id: 'child-1',
          type: 'section',
          typeId: 'type-2',
          parentId: 'root-1',
          position: 0,
          props: {}
        },
        {
          id: 'child-2',
          type: 'section',
          typeId: 'type-2',
          parentId: 'root-1',
          position: 1,
          props: {}
        },
        {
          id: 'grandchild-1',
          type: 'div',
          typeId: 'type-3',
          parentId: 'child-1',
          position: 0,
          props: {}
        }
      ]

      const result = (service as any).buildHierarchicalTree(components)
      
      expect(result).toHaveLength(1)
      expect(result[0].id).toBe('root-1')
      expect(result[0].children).toHaveLength(2)
      expect(result[0].children[0].id).toBe('child-1')
      expect(result[0].children[0].children).toHaveLength(1)
      expect(result[0].children[0].children[0].id).toBe('grandchild-1')
    })

    it('should extract keywords from content correctly', () => {
      const detectionResults: DetectionResult[] = [
        {
          id: 'd1',
          type: 'text',
          bounds: { x: 0, y: 0, width: 100, height: 100 },
          content: 'This is a test page with important keywords like programming and development'
        },
        {
          id: 'd2',
          type: 'text',
          bounds: { x: 0, y: 0, width: 100, height: 100 },
          content: 'More text with technology and innovation'
        }
      ]

      const keywords = (service as any).extractKeywordsFromContent(detectionResults)
      
      expect(keywords).toContain('test')
      expect(keywords).toContain('page')
      expect(keywords).toContain('important')
      expect(keywords).toContain('keywords')
      expect(keywords).toContain('programming')
      expect(keywords.length).toBeLessThanOrEqual(10)
    })
  })
})
