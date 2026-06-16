import { ComponentType } from '@/lib/studio/components/cms/_core/types'
import { clearPageCatalogCache, getPageCatalogSummary } from '@/lib/studio/pages/catalog'
import { PageTemplateCategory, PageTemplateRegistration } from '@/lib/studio/pages/_core/types'
import { pageTemplateFactory } from '@/lib/studio/pages/_factory/page-factory'
import { resetPageTemplateInitialization } from '@/lib/studio/pages/_factory/initialize'

describe('PageTemplateFactory', () => {
  const createRegistration = (templateKey: string): PageTemplateRegistration => ({
    templateKey,
    name: 'Test Template',
    category: PageTemplateCategory.Marketing,
    isHomeEligible: false,
    description: 'Test-only template for verifying factory behaviour.',
    requiredRegions: [
      {
        region: 'header',
        allowedComponents: [ComponentType.NavBar],
        min: 1
      },
      {
        region: 'main',
        allowedComponents: [ComponentType.FeatureGrid],
        min: 1
      }
    ],
    optionalRegions: [
      {
        region: 'footer',
        allowedComponents: [ComponentType.Footer]
      }
    ],
    propsMeta: {
      optionalNote: {
        type: 'string',
        required: false,
        description: 'Optional note used during testing.'
      }
    },
    aiMetadata: {
      keywords: ['test', 'automation'],
      layoutGuidelines: ['Render navigation before main content.'],
      contentGuidelines: ['Keep generated copy short for tests.'],
      recommendedComponents: [ComponentType.FeatureGrid],
      routeHints: ['/test']
    }
  })

  beforeEach(() => {
    pageTemplateFactory.clearRegistry()
    clearPageCatalogCache()
    resetPageTemplateInitialization()
  })

  afterEach(() => {
    pageTemplateFactory.clearRegistry()
    clearPageCatalogCache()
    resetPageTemplateInitialization()
  })

  it('registers and retrieves templates', () => {
    const registration = createRegistration('test/template')
    pageTemplateFactory.registerTemplate(registration)

    const stored = pageTemplateFactory.getTemplate('test/template')
    expect(stored).toBeDefined()
    expect(stored?.name).toBe('Test Template')
    expect(pageTemplateFactory.listTemplates()).toHaveLength(1)
  })

  it('prevents duplicate registrations for the same key', () => {
    const registration = createRegistration('test/template-dupe')
    pageTemplateFactory.registerTemplate(registration)

    expect(() => pageTemplateFactory.registerTemplate(registration)).toThrow(
      '[PageTemplateFactory] Template with key "test/template-dupe" is already registered'
    )
  })

  it('unregisters templates cleanly', () => {
    const registration = createRegistration('test/unregister')
    pageTemplateFactory.registerTemplate(registration)

    const removed = pageTemplateFactory.unregisterTemplate('test/unregister')
    expect(removed).toBe(true)
    expect(pageTemplateFactory.getTemplate('test/unregister')).toBeUndefined()
    expect(pageTemplateFactory.listTemplates()).toHaveLength(0)
  })

})

describe('getPageCatalogSummary', () => {
  beforeEach(() => {
    pageTemplateFactory.clearRegistry()
    clearPageCatalogCache()
    resetPageTemplateInitialization()
  })

  afterEach(() => {
    pageTemplateFactory.clearRegistry()
    clearPageCatalogCache()
    resetPageTemplateInitialization()
  })

  it('initializes built-in templates and caches the summary', async () => {
    const initial = await getPageCatalogSummary(true)
    expect(initial.total).toBeGreaterThanOrEqual(5)
    expect(initial.homeEligibleTemplates).toEqual(
      expect.arrayContaining(['marketing/home-default'])
    )

    const customKey = 'test/custom-cache'
    const customTemplate: PageTemplateRegistration = {
      templateKey: customKey,
      name: 'Cached Template',
      category: PageTemplateCategory.Marketing,
      isHomeEligible: false,
      description: 'Template added to verify cache refresh.',
      requiredRegions: [
        {
          region: 'header',
          allowedComponents: [ComponentType.NavBar],
          min: 1
        },
        {
          region: 'main',
          allowedComponents: [ComponentType.FeatureGrid],
          min: 1
        }
      ],
      optionalRegions: [],
      propsMeta: undefined,
      aiMetadata: {
        keywords: ['cache', 'test'],
        layoutGuidelines: ['Behaviour verified via tests.'],
        recommendedComponents: [ComponentType.FeatureGrid]
      }
    }

    pageTemplateFactory.registerTemplate(customTemplate)
    const refreshed = await getPageCatalogSummary(true)
    expect(refreshed.total).toBe(initial.total + 1)
    expect(refreshed.templates.find(template => template.templateKey === customKey)).toBeDefined()

    const cached = await getPageCatalogSummary()
    expect(cached.total).toBe(refreshed.total)

    pageTemplateFactory.unregisterTemplate(customKey)
  })

  it('includes importable marketing components in marketing home main region', async () => {
    const summary = await getPageCatalogSummary(true)
    const template = summary.templates.find(template => template.templateKey === 'marketing/home-default')
    expect(template).toBeDefined()

    const mainRegion = template?.optionalRegions?.find(region => region.region === 'main')
    expect(mainRegion).toBeDefined()
    expect(mainRegion?.allowedComponents).toEqual(
      expect.arrayContaining([
        ComponentType.ContactForm,
        ComponentType.SimpleForm,
        ComponentType.ContactInfo,
        ComponentType.LocationMap,
        ComponentType.Statistics,
        ComponentType.Accordion
      ])
    )
  })

})
