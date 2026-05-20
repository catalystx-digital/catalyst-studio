import { buildDetectionPrompt } from '@/lib/studio/ai/component-catalog'
import type { ComponentCatalogComponent, ComponentCatalogSummary } from '@/lib/studio/ai/component-catalog'
import type { PromptSchemaSummary } from '@/lib/studio/ai/prompt-schema-builder'
import type { PageCatalogSummary, PageCatalogTemplateSummary } from '@/lib/studio/ai/page-catalog'
import { PageTemplateCategory } from '@/lib/studio/pages/_core/types'

describe('component detection prompt', () => {
  it('includes template compliance guidance and canonical example', () => {
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
    expect(prompt).toContain('Example canonical response:')
    expect(prompt).toContain('"components"')
    expect(prompt).toContain('Do not emit a "region" field; the importer assigns regions automatically.')
    expect(prompt).toContain('Stick strictly to documented schema fields; skip editorial summaries or filler fields that are not in the contract.')
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
    expect(prompt).toMatch(/Flatten imagery into the contract avatar field/i)
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
})




