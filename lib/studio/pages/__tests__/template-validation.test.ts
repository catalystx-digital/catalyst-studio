import { ComponentType as ComponentTypeEnum } from '@/lib/studio/components/cms/_core/types'
import type { PageCatalogTemplateSummary } from '../catalog'
import { validatePageTemplate } from '../validation/template-validation'

const baseTemplate: PageCatalogTemplateSummary = {
  templateKey: 'marketing/home-default',
  name: 'Marketing Home',
  category: 'marketing',
  isHomeEligible: true,
  description: 'Home template used in tests',
  requiredRegions: [
    {
      region: 'header',
      allowedComponents: [ComponentTypeEnum.NavBar],
      min: 1
    }
  ],
  optionalRegions: [],
  propsMeta: undefined,
  aiMetadata: {
    keywords: [],
    layoutGuidelines: []
  }
}

describe('validatePageTemplate', () => {
  it('accepts component trees that satisfy required regions', () => {
    const result = validatePageTemplate({
      template: baseTemplate,
      componentTree: [
        {
          id: 'nav-1',
          type: 'navbar',
          typeId: 'nav-type',
          parentId: null,
          position: 0,
          props: { region: 'header' }
        }
      ],
      componentTypes: [
        {
          id: 'nav-type',
          type: 'navbar-v2',
          category: 'navigation',
          name: 'Navbar',
          description: '',
          defaultConfig: {},
          placeholderData: {},
          aiMetadata: { confidence: 1, modelVersion: '', detectionTimestamp: '', patternCount: 0 },
          patterns: []
        } as any
      ]
    })

    expect(result.isValid).toBe(true)
    expect(result.issues).toHaveLength(0)
    expect(result.props).toEqual({})
  })

  it('reports missing required region components', () => {
    const result = validatePageTemplate({
      template: baseTemplate,
      componentTree: [
        {
          id: 'hero-1',
          type: 'hero-banner',
          typeId: 'hero-type',
          parentId: null,
          position: 0,
          props: { region: 'hero' }
        }
      ],
      componentTypes: []
    })

    expect(result.isValid).toBe(false)
    expect(result.issues.some(issue => issue.code === 'region.min')).toBe(true)
  })

  it('validates template props referencing allowed component types', () => {
    const template: PageCatalogTemplateSummary = {
      ...baseTemplate,
      requiredRegions: [],
      propsMeta: {
        featuredSection: {
          type: 'content-reference',
          required: true,
          allowedComponentTypes: [ComponentTypeEnum.FeatureGrid]
        }
      }
    }

    const componentTypes = [
      {
        id: 'feature-grid',
        type: 'feature-grid-v3',
        category: 'features',
        name: 'Feature Grid',
        description: '',
        defaultConfig: {},
        placeholderData: {},
        aiMetadata: { confidence: 1, modelVersion: '', detectionTimestamp: '', patternCount: 0 },
        patterns: []
      } as any
    ]

    const valid = validatePageTemplate({
      template,
      templateProps: { featuredSection: 'feature-1' },
      componentTree: [
        {
          id: 'feature-1',
          type: 'feature-grid-v3',
          typeId: 'feature-grid',
          parentId: null,
          position: 0,
          props: { region: 'main' }
        }
      ],
      componentTypes
    })

    expect(valid.isValid).toBe(true)
    expect(valid.issues).toHaveLength(0)
    expect(valid.props.featuredSection).toBe('feature-1')

    const invalid = validatePageTemplate({
      template,
      templateProps: { featuredSection: 'hero-1' },
      componentTree: [
        {
          id: 'hero-1',
          type: 'hero-banner',
          typeId: 'hero-type',
          parentId: null,
          position: 0,
          props: { region: 'hero' }
        }
      ],
      componentTypes: [
        ...componentTypes,
        {
          id: 'hero-type',
          type: ComponentTypeEnum.HeroBanner,
          category: 'heroes',
          name: 'Hero Banner',
          description: '',
          defaultConfig: {},
          placeholderData: {},
          aiMetadata: { confidence: 1, modelVersion: '', detectionTimestamp: '', patternCount: 0 },
          patterns: []
        } as any
      ]
    })

    expect(invalid.isValid).toBe(false)
    expect(invalid.issues.some(issue => issue.code === 'props.disallowedReference')).toBe(true)
  })
  it('allows optional components in shared regions when required quotas are met', () => {
    const template: PageCatalogTemplateSummary = {
      ...baseTemplate,
      requiredRegions: [
        {
          region: 'main',
          allowedComponents: [ComponentTypeEnum.BlogList],
          min: 1,
          max: 1
        }
      ],
      optionalRegions: [
        {
          region: 'main',
          allowedComponents: [ComponentTypeEnum.CardGrid, ComponentTypeEnum.FeatureGrid]
        }
      ]
    }

    const componentTypes = [
      {
        id: 'blog-list-type',
        type: 'blog-list-v2',
        category: 'blog',
        name: 'Blog List',
        description: '',
        defaultConfig: {},
        placeholderData: {},
        aiMetadata: { confidence: 1, modelVersion: '', detectionTimestamp: '', patternCount: 0 },
        patterns: []
      } as any,
      {
        id: 'card-grid-type',
        type: 'card-grid-v3',
        category: 'content',
        name: 'Card Grid',
        description: '',
        defaultConfig: {},
        placeholderData: {},
        aiMetadata: { confidence: 1, modelVersion: '', detectionTimestamp: '', patternCount: 0 },
        patterns: []
      } as any
    ]

    const result = validatePageTemplate({
      template,
      componentTree: [
        {
          id: 'blog-list-1',
          type: 'blog-list-v2',
          typeId: 'blog-list-type',
          parentId: null,
          position: 0,
          props: { region: 'main' }
        },
        {
          id: 'card-grid-1',
          type: 'card-grid-v3',
          typeId: 'card-grid-type',
          parentId: null,
          position: 1,
          props: { region: 'main' }
        }
      ],
      componentTypes
    })

    expect(result.isValid).toBe(true)
    expect(result.issues.filter(issue => issue.type === 'region')).toHaveLength(0)
  })

  it('flags components not covered by any allowed region config', () => {
    const template: PageCatalogTemplateSummary = {
      ...baseTemplate,
      requiredRegions: [
        {
          region: 'main',
          allowedComponents: [ComponentTypeEnum.BlogList],
          min: 1,
          max: 1
        }
      ],
      optionalRegions: [
        {
          region: 'main',
          allowedComponents: [ComponentTypeEnum.CardGrid]
        }
      ]
    }

    const componentTypes = [
      {
        id: 'blog-list-type',
        type: 'blog-list-v2',
        category: 'blog',
        name: 'Blog List',
        description: '',
        defaultConfig: {},
        placeholderData: {},
        aiMetadata: { confidence: 1, modelVersion: '', detectionTimestamp: '', patternCount: 0 },
        patterns: []
      } as any,
      {
        id: 'pricing-type',
        type: ComponentTypeEnum.PricingTable,
        category: 'pricing',
        name: 'Pricing Table',
        description: '',
        defaultConfig: {},
        placeholderData: {},
        aiMetadata: { confidence: 1, modelVersion: '', detectionTimestamp: '', patternCount: 0 },
        patterns: []
      } as any
    ]

    const result = validatePageTemplate({
      template,
      componentTree: [
        {
          id: 'blog-list-1',
          type: 'blog-list-v2',
          typeId: 'blog-list-type',
          parentId: null,
          position: 0,
          props: { region: 'main' }
        },
        {
          id: 'pricing-1',
          type: ComponentTypeEnum.PricingTable,
          typeId: 'pricing-type',
          parentId: null,
          position: 1,
          props: { region: 'main' }
        }
      ],
      componentTypes
    })

    const disallowed = result.issues.filter(issue => issue.code === 'region.disallowedComponent')
    expect(disallowed).toHaveLength(1)
    expect(disallowed[0]?.message).toContain('pricing-1')
  })

})




