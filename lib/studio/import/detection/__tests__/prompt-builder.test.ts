import { buildDetectionPrompt } from '@/lib/studio/ai/component-catalog'
import type { ComponentCatalogSummary } from '@/lib/studio/ai/component-catalog'
import type { PromptSchemaSummary } from '@/lib/studio/ai/prompt-schema-builder'
import type { PromptContractBundle } from '@/lib/studio/ai/prompt-contract-builder'
import { ComponentCategory } from '@/lib/studio/components/cms/_core/types'

describe('detection prompt sub-component coverage', () => {
  it('includes SUBCOMPONENTS section with card-item schema', () => {
    const summary: ComponentCatalogSummary = {
      total: 1,
      generatedAt: new Date().toISOString(),
      components: [
        {
          type: 'card-grid',
          category: 'content',
          description: 'Grid of promotional cards with nested card-item children.',
          keywords: ['cards', 'grid', 'promo'],
          patterns: ['card', 'grid', 'promo'],
          confidence: 0.9,
          metadata: {},
          properties: [
            {
              name: 'cards',
              type: 'content[]',
              required: true,
              allowedTypes: ['card-item', 'promo-item'],
              description: 'List of nested card components.'
            },
            {
              name: 'columns',
              type: 'number',
              required: false,
              description: 'Number of columns to render.'
            }
          ]
        }
      ],
      categories: [
        {
          name: 'content',
          components: [
            {
              type: 'card-grid',
              category: 'content',
              description: 'Grid of promotional cards with nested card-item children.',
              keywords: ['cards', 'grid', 'promo'],
              patterns: ['card', 'grid', 'promo'],
              confidence: 0.9,
              metadata: {},
              properties: [
                {
                  name: 'cards',
                  type: 'content[]',
                  required: true,
                  allowedTypes: ['card-item', 'promo-item'],
                  description: 'List of nested card components.'
                },
                {
                  name: 'columns',
                  type: 'number',
                  required: false,
                  description: 'Number of columns to render.'
                }
              ]
            }
          ]
        }
      ],
      topLevelTypes: ['card-grid'],
      subComponentTypes: ['card-item', 'promo-item'],
      subComponents: [
        {
          type: 'card-item',
          description: 'Card item with title, description, metadata, and optional image/link.',
          properties: [
            { name: 'title', type: 'string', required: true, description: 'Card headline.' },
            { name: 'description', type: 'string', required: false, description: 'Supporting copy.' },
            { name: 'link', type: 'string', required: false, description: 'Destination URL.' },
            { name: 'linkText', type: 'string', required: false, description: 'Label for the link or action.' },
            { name: 'image', type: 'object', required: false, description: 'Image asset with src/alt.' },
            { name: 'imageAlt', type: 'string', required: false, description: 'Accessible image description.' },
            { name: 'metadata', type: 'object', required: false, description: 'Card metadata including category/date/tags.' },
            {
              name: 'actions',
              type: 'content[]',
              required: false,
              allowedTypes: ['cta-button'],
              description: 'Optional action buttons.'
            }
          ]
        },
        {
          type: 'promo-item',
          description: 'Promotional variation of card-item.',
          properties: [
            { name: 'title', type: 'string', required: true },
            { name: 'description', type: 'string', required: false }
          ]
        }
      ],
      warnings: []
    }

    const schemaSummary: PromptSchemaSummary = {
      schemaHash: 'test-hash',
      generatedAt: new Date().toISOString(),
      components: [
        {
          type: 'card-grid',
          summary: 'Grid of promotional cards with nested card-item children.',
          defaultRegion: 'main',
          fields: [
            {
              name: 'cards',
              path: 'cards',
              type: 'content[]',
              required: true,
              allowedTypes: ['card-item', 'promo-item'],
              description: 'List of nested card components.'
            },
            {
              name: 'columns',
              path: 'columns',
              type: 'number',
              required: false,
              description: 'Number of columns to render.'
            }
          ]
        }
      ],
      subcomponents: [
        {
          type: 'card-item',
          summary: 'Card item with title, description, metadata, and optional image/link.',
          fields: [
            { name: 'title', path: 'title', type: 'string', required: true, description: 'Card headline.' },
            { name: 'description', path: 'description', type: 'string', required: false, description: 'Supporting copy.' },
            { name: 'link', path: 'link', type: 'string', required: false, description: 'Destination URL.' },
            { name: 'linkText', path: 'linkText', type: 'string', required: false, description: 'Label for the link or action.' },
            { name: 'image', path: 'image', type: 'object', required: false, description: 'Image asset with src/alt.' },
            { name: 'imageAlt', path: 'imageAlt', type: 'string', required: false, description: 'Accessible image description.' },
            { name: 'metadata', path: 'metadata', type: 'object', required: false, description: 'Card metadata including category/date/tags.' },
            {
              name: 'actions',
              path: 'actions',
              type: 'content[]',
              required: false,
              allowedTypes: ['cta-button'],
              description: 'Optional action buttons.'
            }
          ]
        },
        {
          type: 'promo-item',
          summary: 'Promotional variation of card-item.',
          fields: [
            { name: 'title', path: 'title', type: 'string', required: true },
            { name: 'description', path: 'description', type: 'string', required: false }
          ]
        }
      ]
    }

    expect(schemaSummary.components).toHaveLength(1)
    expect(schemaSummary.subcomponents).toHaveLength(2)

    const contractBundle: PromptContractBundle = {
      version: 1,
      generatedAt: new Date().toISOString(),
      hash: 'bundle-hash',
      registrySize: 4,
      components: [
        {
          type: 'card-grid',
          category: ComponentCategory.Content,
          description: 'Grid of promotional cards with nested card-item children.',
          summary: 'Grid of promotional cards with nested card-item children.',
          keywords: ['cards', 'grid', 'promo'],
          patterns: ['card', 'grid', 'promo'],
          confidence: 0.9,
          metadata: {
            keywords: ['cards'],
            patterns: ['card'],
            commonNames: [],
            pageLocation: ['main'],
            confidence: 0.9,
            description: 'Grid of promotional cards with nested card-item children.'
          },
          fields: [
            {
              name: 'cards',
              type: 'content[]',
              required: true,
              description: 'List of nested card components.',
              allowedTypes: ['card-item', 'promo-item'],
              source: 'propsMeta'
            },
            {
              name: 'columns',
              type: 'number',
              required: false,
              description: 'Number of columns to render.',
              source: 'propsMeta'
            }
          ]
        }
      ],
      subcomponents: [
        {
          type: 'card-item',
          category: ComponentCategory.Content,
          description: 'Card item with title, description, metadata, and optional image/link.',
          summary: 'Card item with title, description, metadata, and optional image/link.',
          keywords: ['card'],
          patterns: ['card'],
          confidence: 0.8,
          metadata: {
            keywords: ['card'],
            patterns: ['card'],
            commonNames: [],
            pageLocation: ['main'],
            confidence: 0.8,
            description: 'Card item with title, description, metadata, and optional image/link.'
          },
          fields: [
            { name: 'title', type: 'string', required: true, description: 'Card headline.', source: 'propsMeta' },
            { name: 'description', type: 'string', required: false, description: 'Supporting copy.', source: 'propsMeta' }
          ],
          subOnly: true
        },
        {
          type: 'promo-item',
          category: ComponentCategory.Content,
          description: 'Promotional variation of card-item.',
          summary: 'Promotional variation of card-item.',
          keywords: ['promo'],
          patterns: ['promo'],
          confidence: 0.8,
          metadata: {
            keywords: ['promo'],
            patterns: ['promo'],
            commonNames: [],
            pageLocation: ['main'],
            confidence: 0.8,
            description: 'Promotional variation of card-item.'
          },
          fields: [
            { name: 'title', type: 'string', required: true, source: 'propsMeta' },
            { name: 'description', type: 'string', required: false, source: 'propsMeta' }
          ],
          subOnly: true
        }
      ],
      warnings: [],
      subcomponentUsage: {
        'card-item': [{ component: 'card-grid', fields: ['cards'] }],
        'promo-item': [{ component: 'card-grid', fields: ['cards'] }]
      }
    }

    const prompt = buildDetectionPrompt(summary, { schemaSummary, contractBundle })

    expect(prompt).toContain('=== COMPONENT CONTRACTS (1) ===')
    expect(prompt).toContain('card-grid [default region: main] — Grid of promotional cards with nested card-item children.')
    expect(prompt).toContain('cards: content[] (required) — allowedTypes: card-item, promo-item')
    expect(prompt).toContain('=== CONTENT REFERENCE RULES')
    expect(prompt).toContain('SUBCOMPONENT CONTRACTS (2)')
    expect(prompt).toContain('card-item — Card item with title, description, metadata, and optional image/link.')
    expect(prompt).toContain('Allowed in: card-grid.cards')
    expect(prompt).toContain('title: string (required)')
  })
})
