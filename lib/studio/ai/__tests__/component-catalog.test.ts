import { buildDetectionPrompt } from '@/lib/studio/ai/component-catalog'
import type { ComponentCatalogComponent, ComponentCatalogSummary } from '@/lib/studio/ai/component-catalog'
import type { PromptSchemaSummary } from '@/lib/studio/ai/prompt-schema-builder'
import type { PageCatalogSummary, PageCatalogTemplateSummary } from '@/lib/studio/ai/page-catalog'
import { PageTemplateCategory } from '@/lib/studio/pages/_core/types'

describe('component detection prompt', () => {
  it('includes compact template compliance guidance', () => {
    const componentSummary: ComponentCatalogSummary = {
      total: 1,
      generatedAt: '2024-07-01T00:00:00.000Z',
      components: [
        {
          type: 'blog-post',
          category: 'blog',
          keywords: ['blog', 'article'],
          patterns: ['article'],
          confidence: 0.9,
          metadata: {},
          description: 'Blog post detail',
          properties: []
        }
      ],
      categories: [
        {
          name: 'blog',
          components: [
            {
              type: 'blog-post',
              category: 'blog',
              keywords: ['blog', 'article'],
              patterns: ['article'],
              confidence: 0.9,
              metadata: {},
              description: 'Blog post detail',
              properties: []
            }
          ]
        }
      ],
      topLevelTypes: ['blog-post'],
      subComponentTypes: [],
      subComponents: [],
      warnings: []
    }

    const folderTemplate: PageCatalogTemplateSummary = {
      templateKey: 'core/folder',
      name: 'Navigation Folder',
      category: PageTemplateCategory.Core,
      isHomeEligible: false,
      description: 'Navigation grouping container',
      requiredRegions: [],
      optionalRegions: [],
      propsMeta: undefined,
      contentSchema: {
        components: {
          type: 'component-list',
          required: false,
          allowedComponentTypes: []
        }
      },
      aiMetadata: {
        keywords: ['folder'],
        layoutGuidelines: ['Folders organize pages.'],
        contentGuidelines: [],
        recommendedComponents: [],
        discouragedComponents: [],
        exampleUseCases: [],
        routeHints: []
      }
    }

    const template: PageCatalogTemplateSummary = {
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
      contentSchema: {
        components: {
          type: 'component-list',
          required: true,
          allowedComponentTypes: ['blog-post']
        }
      },
      aiMetadata: {
        keywords: ['blog'],
        layoutGuidelines: ['Main region uses canonical blog-post component.'],
        contentGuidelines: ['Use canonical blog-post.'],
        recommendedComponents: ['blog-post'],
        discouragedComponents: [],
        exampleUseCases: ['blog detail'],
        routeHints: ['/blog/']
      }
    }

    const pageSummary: PageCatalogSummary = {
      total: 1,
      generatedAt: '2024-07-01T00:00:00.000Z',
      templates: [template],
      categories: [
        {
          category: PageTemplateCategory.Core,
          templates: [folderTemplate]
        },
        {
          category: PageTemplateCategory.Blog,
          templates: [template]
        }
      ],
      homeEligibleTemplates: []
    }

    const schemaSummary: PromptSchemaSummary = {
      schemaHash: 'schema-hash',
      generatedAt: '2024-07-01T00:00:00.000Z',
      components: [
        {
          type: 'blog-post',
          summary: 'Blog post detail',
          defaultRegion: 'main',
          fields: [
            { name: 'title', path: 'title', type: 'string', required: true, description: 'Primary headline.' },
            { name: 'body', path: 'body', type: 'richText', required: true, description: 'Article body markup.' },
            { name: 'author', path: 'author', type: 'string', required: false, description: 'Author name.' }
          ]
        }
      ],
      subcomponents: []
    }

    const contractBundle = {
      version: 1,
      generatedAt: '2024-07-01T00:00:00.000Z',
      hash: 'bundle-hash',
      registrySize: 1,
      components: [
        {
          type: 'testimonials',
          category: 'social-proof',
          summary: 'Testimonials carousel',
          description: 'Testimonials carousel',
          keywords: ['testimonial'],
          patterns: ['testimonial'],
          confidence: 0.9,
          metadata: {},
          fields: [
            {
              name: 'testimonials',
              type: 'content[]',
              required: true,
              allowedTypes: ['testimonial-item'],
              source: 'propsMeta' as const
            }
          ]
        }
      ],
      subcomponents: [
        {
          type: 'testimonial-item',
          category: 'social-proof',
          summary: 'Testimonial entry',
          description: 'Testimonial entry',
          keywords: ['testimonial'],
          patterns: ['testimonial'],
          confidence: 0.8,
          metadata: {},
          fields: [
            { name: 'id', type: 'string', required: true, source: 'propsMeta' as const },
            { name: 'quote', type: 'rich-text', required: true, source: 'propsMeta' as const },
            { name: 'author', type: 'string', required: true, source: 'propsMeta' as const },
            { name: 'avatar', type: 'string', required: false, source: 'propsMeta' as const }
          ]
        }
      ],
      warnings: [],
      subcomponentUsage: {
        'testimonial-item': [{ component: 'testimonials', fields: ['testimonials'] }]
      }
    }

    const prompt = buildDetectionPrompt(componentSummary, {
      schemaSummary,
      pagePrompt: 'PAGE TEMPLATE PROMPT',
      pageSummary,
      contractBundle: contractBundle as any
    })

    expect(prompt).toContain('TEMPLATE COMPLIANCE RULES')
    expect(prompt).toContain('blog-post')
    expect(prompt).toContain('COMPONENT CONTRACTS')
    expect(prompt).toContain('Component field contracts are listed in COMPONENT CONTRACTS')
    expect(prompt).toContain('main: blog-post')
    expect(prompt).toContain('Do not emit a "region" field; the importer assigns regions automatically.')
    expect(prompt).toContain('Stick strictly to documented schema fields; skip editorial summaries or filler fields that are not in the contract.')
    expect(prompt).toContain('Never invent generic wrappers such as "section", "container", "wrapper", "block", "group", or "layout".')
    expect(prompt).toContain('Do not emit raw HTML containers such as html-block unless html-block appears in COMPONENT CONTRACTS')
    expect(prompt).toContain('Button variant fields are enums, not CSS classes.')
    expect(prompt).toContain('Never invent a top-level component variant field.')
    expect(prompt).toContain('hero-simple: Do NOT emit "variant"')
    expect(prompt).toContain('Never emit null for optional fields.')
    expect(prompt).toContain('Image object fields wrap MediaReference under src')
    expect(prompt).toContain('put them under image.src')
    expect(prompt).toContain('hero-banner.backgroundImage')
  })

  it('teaches registered card/feed fields instead of generic section and legacy item fields', () => {
    const componentSummary: ComponentCatalogSummary = {
      total: 2,
      generatedAt: '2024-07-01T00:00:00.000Z',
      components: [],
      categories: [],
      topLevelTypes: ['card-grid', 'content-feed'],
      subComponentTypes: [],
      subComponents: [],
      warnings: []
    }

    const schemaSummary: PromptSchemaSummary = {
      schemaHash: 'schema-hash',
      generatedAt: '2024-07-01T00:00:00.000Z',
      components: [
        {
          type: 'card-grid',
          summary: 'Card grid',
          defaultRegion: 'main',
          fields: [
            { name: 'heading', path: 'heading', type: 'string', required: false },
            { name: 'cards', path: 'cards', type: 'object[]', required: true },
            { name: 'title', path: 'cards[].title', type: 'string', required: false },
            { name: 'href', path: 'cards[].href', type: 'json', required: false }
          ]
        },
        {
          type: 'content-feed',
          summary: 'Content feed',
          defaultRegion: 'main',
          fields: [
            { name: 'source', path: 'source', type: 'object', required: true },
            { name: 'pinned', path: 'pinned', type: 'object[]', required: false }
          ]
        }
      ],
      subcomponents: []
    }

    const pageSummary: PageCatalogSummary = {
      total: 0,
      generatedAt: '2024-07-01T00:00:00.000Z',
      templates: [],
      categories: [],
      homeEligibleTemplates: []
    }

    const prompt = buildDetectionPrompt(componentSummary, {
      schemaSummary,
      contractBundle: {
        version: 1,
        generatedAt: '2024-07-01T00:00:00.000Z',
        hash: 'bundle-hash',
        registrySize: 2,
        components: [
          {
            type: 'card-grid',
            category: 'content',
            summary: 'Card grid',
            description: 'Card grid',
            keywords: ['cards'],
            patterns: ['card'],
            confidence: 0.8,
            metadata: {},
            fields: [
              { name: 'cards', type: 'object[]', required: true, source: 'schema' as const }
            ]
          },
          {
            type: 'content-feed',
            category: 'content',
            summary: 'Content feed',
            description: 'Content feed',
            keywords: ['news'],
            patterns: ['news'],
            confidence: 0.8,
            metadata: {},
            fields: [
              { name: 'source', type: 'object', required: true, source: 'schema' as const },
              { name: 'pinned', type: 'object[]', required: false, source: 'schema' as const }
            ]
          }
        ],
        subcomponents: [],
        warnings: [],
        subcomponentUsage: {}
      } as any
    })

    expect(prompt).toContain('Never emit unregistered generic component names')
    expect(prompt).toContain('card-grid.cards[]')
    expect(prompt).toContain('content-feed.pinned[]')
    expect(prompt).toContain('Each card may only use the documented nested CardItem fields: title, description, image, href, and icon.')
    expect(prompt).toContain('never emit icon:null')
    expect(prompt).toContain('Populate pinned[] with every visible imported/static article/post')
    expect(prompt).not.toContain('Populate items[]')
  })

  it('does not include known legacy card, promo, or footer directive fields', () => {
    const componentSummary: ComponentCatalogSummary = {
      total: 4,
      generatedAt: '2024-07-01T00:00:00.000Z',
      components: [],
      categories: [],
      topLevelTypes: ['card-grid', 'card-item', 'promo-item', 'footer'],
      subComponentTypes: [],
      subComponents: [],
      warnings: []
    }

    const schemaSummary: PromptSchemaSummary = {
      schemaHash: 'schema-hash',
      generatedAt: '2024-07-01T00:00:00.000Z',
      components: [
        { type: 'card-grid', summary: 'Card grid', fields: [{ name: 'cards', path: 'cards', type: 'object[]', required: true }] },
        { type: 'card-item', summary: 'Card item', fields: [{ name: 'title', path: 'title', type: 'string', required: true }] },
        { type: 'promo-item', summary: 'Promo item', fields: [{ name: 'headline', path: 'headline', type: 'string', required: true }] },
        { type: 'footer', summary: 'Footer', fields: [{ name: 'columns', path: 'columns', type: 'object[]', required: false }] }
      ],
      subcomponents: []
    }

    const baseContract = {
      category: 'content',
      description: 'Component',
      keywords: [],
      patterns: [],
      confidence: 0.8,
      metadata: {},
      fields: []
    }

    const prompt = buildDetectionPrompt(componentSummary, {
      schemaSummary,
      contractBundle: {
        version: 1,
        generatedAt: '2024-07-01T00:00:00.000Z',
        hash: 'bundle-hash',
        registrySize: 4,
        components: [
          { ...baseContract, type: 'card-grid', summary: 'Card grid', fields: [{ name: 'cards', type: 'object[]', required: true, source: 'schema' as const }] },
          { ...baseContract, type: 'card-item', summary: 'Card item', fields: [{ name: 'title', type: 'string', required: true, source: 'schema' as const }] },
          { ...baseContract, type: 'promo-item', summary: 'Promo item', fields: [{ name: 'headline', type: 'string', required: true, source: 'schema' as const }] },
          { ...baseContract, type: 'footer', category: 'navigation', summary: 'Footer', fields: [{ name: 'columns', type: 'object[]', required: false, source: 'schema' as const }] }
        ],
        subcomponents: [],
        warnings: [],
        subcomponentUsage: {}
      } as any
    })

    expect(prompt).toContain('href as a structured SmartLink object')
    expect(prompt).toContain('Do not emit id, type, link, url, or arbitrary wrapper fields on card-item content.')
    expect(prompt).toContain('Do not emit id, metadata, actions, ctaUrl, ctaLabel, link, or url fields on promo-item content.')
    expect(prompt).toContain('Do not emit type or id on footer columns or links')
    expect(prompt).toContain('platform must be lowercase enum values only')
    expect(prompt).toContain('Each filter may only include label and value.')
    expect(prompt).toContain('Do not add id, type, link, url, linkText, badge, metadata, actions, date, category, backgroundColor, or arbitrary wrapper fields to card-grid.cards[]')
    expect(prompt).not.toContain('Represent them exactly as { "link": "/path"')
    expect(prompt).not.toContain('Generate stable ids by slugifying')
    expect(prompt).not.toContain('actions[]. Avoid legacy')
    expect(prompt).not.toContain('"type": "columnItem"')
  })

  it('instructs testimonials to include stable ids and avatar strings', () => {
    const testimonialsComponent: ComponentCatalogComponent = {
      type: 'testimonials',
      category: 'social-proof',
      keywords: ['testimonial'],
      patterns: ['testimonial'],
      confidence: 0.9,
      metadata: {},
      description: 'Testimonials carousel',
      properties: [
        {
          name: 'testimonials',
          type: 'content[]',
          required: true,
          allowedTypes: ['testimonial-item']
        }
      ]
    }

    const componentSummary: ComponentCatalogSummary = {
      total: 1,
      generatedAt: '2024-07-01T00:00:00.000Z',
      components: [testimonialsComponent],
      categories: [{ name: 'social-proof', components: [testimonialsComponent] }],
      topLevelTypes: ['testimonials'],
      subComponentTypes: ['testimonial-item'],
      subComponents: [
        {
          type: 'testimonial-item',
          metadata: {},
          properties: [
            { name: 'id', type: 'string', required: true },
            { name: 'quote', type: 'rich-text', required: true },
            { name: 'author', type: 'string', required: true },
            { name: 'avatar', type: 'string', required: false }
          ]
        }
      ],
      warnings: []
    }

    const schemaSummary: PromptSchemaSummary = {
      schemaHash: 'schema-hash',
      generatedAt: '2024-07-01T00:00:00.000Z',
      components: [
        {
          type: 'testimonials',
          summary: 'Testimonials carousel',
          defaultRegion: 'main',
          fields: [
            {
              name: 'testimonials',
              path: 'testimonials',
              type: 'content[]',
              required: true,
              allowedTypes: ['testimonial-item'],
              description: 'Ordered testimonial entries.'
            }
          ]
        }
      ],
      subcomponents: [
        {
          type: 'testimonial-item',
          summary: 'Testimonial entry',
          fields: [
            { name: 'id', path: 'id', type: 'string', required: true },
            { name: 'quote', path: 'quote', type: 'rich-text', required: true },
            { name: 'author', path: 'author', type: 'string', required: true },
            { name: 'avatar', path: 'avatar', type: 'string', required: false }
          ]
        }
      ]
    }

    const pageSummary: PageCatalogSummary = {
      total: 0,
      generatedAt: '2024-07-01T00:00:00.000Z',
      templates: [],
      categories: [],
      homeEligibleTemplates: []
    }

    const contractBundle = {
      version: 1,
      generatedAt: '2024-07-01T00:00:00.000Z',
      hash: 'bundle-hash',
      registrySize: 1,
      components: [
        {
          type: 'testimonials',
          category: 'social-proof',
          summary: 'Testimonials carousel',
          description: 'Testimonials carousel',
          keywords: ['testimonial'],
          patterns: ['testimonial'],
          confidence: 0.9,
          metadata: {},
          fields: [
            {
              name: 'testimonials',
              type: 'content[]',
              required: true,
              allowedTypes: ['testimonial-item'],
              source: 'propsMeta' as const
            }
          ]
        }
      ],
      subcomponents: [
        {
          type: 'testimonial-item',
          category: 'social-proof',
          summary: 'Testimonial entry',
          description: 'Testimonial entry',
          keywords: ['testimonial'],
          patterns: ['testimonial'],
          confidence: 0.8,
          metadata: {},
          fields: [
            { name: 'id', type: 'string', required: true, source: 'propsMeta' as const },
            { name: 'quote', type: 'rich-text', required: true, source: 'propsMeta' as const },
            { name: 'author', type: 'string', required: true, source: 'propsMeta' as const },
            { name: 'avatar', type: 'string', required: false, source: 'propsMeta' as const }
          ]
        }
      ],
      warnings: [],
      subcomponentUsage: {
        'testimonial-item': [{ component: 'testimonials', fields: ['testimonials'] }]
      }
    }

    const prompt = buildDetectionPrompt(componentSummary, {
      schemaSummary,
      pagePrompt: 'PAGE TEMPLATE PROMPT',
      pageSummary,
      contractBundle: contractBundle as any
    })

    expect(prompt).toContain('testimonial-item')
    expect(prompt).toMatch(/MUST include a stable/i)
    expect(prompt).toContain('testimonial-item-')
    expect(prompt).toMatch(/Flatten slide imagery into avatar/i)
  })

  it('instructs navbar to include search detection with placeholder, suggestions, and enabled flag', () => {
    const navbarComponent: ComponentCatalogComponent = {
      type: 'navbar',
      category: 'navigation',
      keywords: ['navigation', 'header', 'menu'],
      patterns: ['nav', 'navbar', 'header'],
      confidence: 0.95,
      metadata: {},
      description: 'Responsive navigation bar with mobile support and integrated search.',
      properties: [
        { name: 'logo', type: 'object', required: false },
        { name: 'menuItems', type: 'array', required: false },
        { name: 'search', type: 'object', required: false },
        { name: 'cta', type: 'object', required: false }
      ]
    }

    const componentSummary: ComponentCatalogSummary = {
      total: 1,
      generatedAt: '2024-07-01T00:00:00.000Z',
      components: [navbarComponent],
      categories: [{ name: 'navigation', components: [navbarComponent] }],
      topLevelTypes: ['navbar'],
      subComponentTypes: [],
      subComponents: [],
      warnings: []
    }

    const schemaSummary: PromptSchemaSummary = {
      schemaHash: 'schema-hash',
      generatedAt: '2024-07-01T00:00:00.000Z',
      components: [
        {
          type: 'navbar',
          summary: 'Navigation bar with search',
          defaultRegion: 'header',
          fields: [
            { name: 'logo', path: 'logo', type: 'object', required: false },
            { name: 'menuItems', path: 'menuItems', type: 'array', required: false },
            {
              name: 'search',
              path: 'search',
              type: 'object',
              required: false,
              children: [
                { name: 'enabled', path: 'search.enabled', type: 'boolean', required: false },
                { name: 'placeholder', path: 'search.placeholder', type: 'string', required: false },
                { name: 'showSuggestions', path: 'search.showSuggestions', type: 'boolean', required: false },
                { name: 'suggestions', path: 'search.suggestions', type: 'array', required: false }
              ]
            }
          ]
        }
      ],
      subcomponents: []
    }

    const pageSummary: PageCatalogSummary = {
      total: 0,
      generatedAt: '2024-07-01T00:00:00.000Z',
      templates: [],
      categories: [],
      homeEligibleTemplates: []
    }

    const contractBundle = {
      version: 1,
      generatedAt: '2024-07-01T00:00:00.000Z',
      hash: 'bundle-hash',
      registrySize: 1,
      components: [
        {
          type: 'navbar',
          category: 'navigation',
          summary: 'Navigation bar with search',
          description: 'Responsive navigation with integrated search.',
          keywords: ['nav', 'header'],
          patterns: ['navbar'],
          confidence: 0.95,
          metadata: {},
          fields: [
            { name: 'logo', type: 'object', required: false, source: 'propsMeta' as const },
            { name: 'menuItems', type: 'array', required: false, source: 'propsMeta' as const },
            { name: 'search', type: 'object', required: false, source: 'propsMeta' as const }
          ]
        }
      ],
      subcomponents: [],
      warnings: [],
      subcomponentUsage: {}
    }

    const prompt = buildDetectionPrompt(componentSummary, {
      schemaSummary,
      pagePrompt: 'PAGE TEMPLATE PROMPT',
      pageSummary,
      contractBundle: contractBundle as any
    })

    // Verify navbar search detection instructions are included
    expect(prompt).toMatch(/navbar/i)
    expect(prompt).toMatch(/search\.enabled/i)
    expect(prompt).toMatch(/search\.placeholder/i)
    expect(prompt).toMatch(/Do NOT emit a separate search-bar component/i)
  })

  it('teaches structured SmartLink and MediaReference shapes instead of legacy strings', () => {
    const navbarComponent: ComponentCatalogComponent = {
      type: 'navbar',
      category: 'navigation',
      keywords: ['navigation'],
      patterns: ['navbar'],
      confidence: 0.95,
      metadata: {},
      description: 'Navigation bar.',
      properties: []
    }

    const componentSummary: ComponentCatalogSummary = {
      total: 1,
      generatedAt: '2024-07-01T00:00:00.000Z',
      components: [navbarComponent],
      categories: [{ name: 'navigation', components: [navbarComponent] }],
      topLevelTypes: ['navbar'],
      subComponentTypes: [],
      subComponents: [],
      warnings: []
    }

    const schemaSummary: PromptSchemaSummary = {
      schemaHash: 'schema-hash',
      generatedAt: '2024-07-01T00:00:00.000Z',
      components: [
        {
          type: 'navbar',
          summary: 'Navigation bar',
          defaultRegion: 'header',
          fields: [
            {
              name: 'logo',
              path: 'logo',
              type: 'object',
              required: false,
              children: [
                {
                  name: 'src',
                  path: 'logo.src',
                  type: 'object',
                  required: false,
                  children: [
                    { name: 'mediaId', path: 'logo.src.mediaId', type: 'string', required: true },
                    { name: 'mediaType', path: 'logo.src.mediaType', type: 'string', required: true },
                    { name: 'url', path: 'logo.src.url', type: 'string', required: false }
                  ]
                },
                {
                  name: 'href',
                  path: 'logo.href',
                  type: 'string',
                  required: false
                }
              ]
            },
            {
              name: 'menuItems',
              path: 'menuItems',
              type: 'object[]',
              required: true,
              children: [
                { name: 'label', path: 'menuItems[].label', type: 'string', required: true },
                { name: 'href', path: 'menuItems[].href', type: 'json', required: false, description: 'Discriminated union - edit as JSON' }
              ]
            }
          ]
        }
      ],
      subcomponents: []
    }

    const pageSummary: PageCatalogSummary = {
      total: 0,
      generatedAt: '2024-07-01T00:00:00.000Z',
      templates: [],
      categories: [],
      homeEligibleTemplates: []
    }

    const prompt = buildDetectionPrompt(componentSummary, {
      schemaSummary,
      pagePrompt: 'PAGE TEMPLATE PROMPT',
      pageSummary,
      contractBundle: {
        version: 1,
        generatedAt: '2024-07-01T00:00:00.000Z',
        hash: 'bundle-hash',
        registrySize: 1,
        components: [
          {
            type: 'navbar',
            category: 'navigation',
            summary: 'Navigation bar',
            description: 'Navigation bar.',
            keywords: ['navigation'],
            patterns: ['navbar'],
            confidence: 0.95,
            metadata: {},
            fields: [
              { name: 'logo', type: 'object', required: false, source: 'propsMeta' as const },
              { name: 'menuItems', type: 'array', required: true, source: 'propsMeta' as const }
            ]
          }
        ],
        subcomponents: [],
        warnings: [],
        subcomponentUsage: {}
      } as any
    })

    expect(prompt).toContain('SmartLink fields MUST be objects, never raw strings.')
    expect(prompt).toContain('logo.href remains a string URL/path')
    expect(prompt).toContain('"type": "internal"')
    expect(prompt).toContain('"mediaId": "detected:<stable-kebab-id>"')
    expect(prompt).toContain('logo.src.mediaId')
    expect(prompt).toContain('menuItems[].href')
    expect(prompt).not.toContain('"href": "/solutions"')
    expect(prompt).not.toContain('"src": "https://cdn.example.com/brand/logo-light.svg"')
  })
})
