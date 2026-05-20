import { buildPromptContractBundle, clearPromptContractBundleCache } from '@/lib/studio/ai/prompt-contract-builder'
import type { ComponentRegistryEntry } from '@/lib/studio/components/cms/_core/types'

jest.mock('@/lib/studio/components/cms/_factory/initialize', () => ({
  initializeCMSComponents: jest.fn().mockResolvedValue(undefined)
}))

const registry = new Map<string, ComponentRegistryEntry>()

jest.mock('@/lib/studio/components/cms/_factory/factory', () => {
  const categoryMap: Record<string, string> = {
    'nav-bar': 'navigation',
    'nav-menu-item': 'navigation',
    'card-grid': 'content',
    'card-item': 'content',
    'legacy-hero': 'heroes'
  }

  const factory = {
    getComponentCatalog: jest.fn(() => registry),
    getRegistry: jest.fn(() => registry),
    getRegisteredTypes: jest.fn(() => Array.from(registry.keys())),
    getComponentMetadata: jest.fn(),
    getComponentCategory: jest.fn((type: string) => categoryMap[type] ?? 'content'),
    clearCache: jest.fn(),
    __setRegistry(entries: Array<[string, ComponentRegistryEntry]>) {
      registry.clear()
      entries.forEach(([type, entry]) => registry.set(type, entry))
    },
    __resetRegistry() {
      registry.clear()
    }
  }

  return {
    cmsComponentFactory: factory
  }
})

const { cmsComponentFactory } = require('@/lib/studio/components/cms/_factory/factory') as {
  cmsComponentFactory: {
    __setRegistry: (entries: Array<[string, ComponentRegistryEntry]>) => void
    __resetRegistry: () => void
  }
}

function createEntry(options: {
  description?: string
  metadata: ComponentRegistryEntry['metadata']
  propsMeta?: ComponentRegistryEntry['propsMeta']
  subOnly?: boolean
}): ComponentRegistryEntry {
  return {
    component: jest.fn() as unknown as ComponentRegistryEntry['component'],
    metadata: options.metadata!,
    preload: false,
    description: options.description,
    propsMeta: options.propsMeta,
    ...(options.subOnly ? { subOnly: true } : {})
  }
}

describe('prompt-contract-builder', () => {
  beforeEach(() => {
    clearPromptContractBundleCache()
    cmsComponentFactory.__resetRegistry()

    cmsComponentFactory.__setRegistry([
        [
          'card-grid',
          createEntry({
            description: 'Grid of cards with nested card-item children.',
            metadata: {
              keywords: ['cards'],
              patterns: ['card'],
              commonNames: [],
              pageLocation: ['main'],
              confidence: 0.92,
              description: 'Grid of cards with nested card-item children.'
            },
            propsMeta: {
              cards: {
                type: 'content[]',
                required: true,
                description: 'Nested card entries.',
                allowedTypes: ['card-item']
              },
              columns: {
                type: 'number',
                required: false,
                description: 'Column count.'
              }
            }
          })
        ],
        [
          'nav-bar',
          createEntry({
            description: 'Primary navigation bar.',
            metadata: {
              keywords: ['nav'],
              patterns: ['nav'],
              commonNames: [],
              pageLocation: ['header'],
              confidence: 0.95,
              description: 'Primary navigation bar.'
            },
            propsMeta: {
              menuItems: {
                type: 'content[]',
                required: true,
                description: 'Navigation entries.',
                allowedTypes: ['nav-menu-item']
              },
              logo: {
                type: 'object',
                required: false,
                description: 'Logo configuration.'
              }
            }
          })
        ],
        [
          'legacy-hero',
          createEntry({
            description: undefined,
            metadata: {
              keywords: ['hero'],
              patterns: ['hero'],
              commonNames: [],
              pageLocation: ['hero'],
              confidence: 0.8,
              description: undefined,
              properties: [
                { name: 'heading', type: 'string', required: true, description: 'Primary heading.' },
                { name: 'summary', type: 'string', required: false }
              ]
            }
          })
        ],
        [
          'card-item',
          createEntry({
            description: 'Card subcomponent.',
            metadata: {
              keywords: ['card'],
              patterns: ['card'],
              commonNames: [],
              pageLocation: ['main'],
              confidence: 0.88,
              description: 'Card subcomponent.'
            },
            propsMeta: {
              title: { type: 'string', required: true },
              description: { type: 'string', required: false }
            },
            subOnly: true
          })
        ],
        [
          'nav-menu-item',
          createEntry({
            description: 'Nested navigation entry.',
            metadata: {
              keywords: ['nav'],
              patterns: ['nav'],
              commonNames: [],
              pageLocation: ['header'],
              confidence: 0.85,
              description: 'Nested navigation entry.'
            },
            propsMeta: {
              label: { type: 'string', required: true },
              children: {
                type: 'content[]',
                required: false,
                description: 'Nested children.',
                allowedTypes: ['nav-menu-item']
              }
            },
            subOnly: true
          })
        ]
      ])
  })

  afterEach(() => {
    clearPromptContractBundleCache()
    cmsComponentFactory.__resetRegistry()
  })

  it('builds bundle with component and subcomponent contracts', async () => {
    const bundle = await buildPromptContractBundle({ forceRefresh: true })

    const cardGrid = bundle.components.find(component => component.type === 'card-grid')
    expect(cardGrid).toBeDefined()
    expect(cardGrid?.fields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'cards',
          type: 'content[]',
          required: true,
          allowedTypes: ['card-item']
        })
      ])
    )

    const subcomponent = bundle.subcomponents.find(component => component.type === 'card-item')
    expect(subcomponent).toBeDefined()
    expect(subcomponent?.fields).toEqual(
      expect.arrayContaining([expect.objectContaining({ name: 'title', required: true })])
    )
  })

  it('surfaces warnings when props meta is missing', async () => {
    const bundle = await buildPromptContractBundle({ forceRefresh: true })
    expect(bundle.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'MISSING_PROPS_META',
          componentType: 'legacy-hero'
        })
      ])
    )
  })

  it('tracks allowedTypes usage for subcomponents', async () => {
    const bundle = await buildPromptContractBundle({ forceRefresh: true })
    expect(bundle.subcomponentUsage['card-item']).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          component: 'card-grid',
          fields: expect.arrayContaining(['cards'])
        })
      ])
    )
    expect(bundle.subcomponentUsage['nav-menu-item']).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          component: 'nav-bar',
          fields: expect.arrayContaining(['menuItems'])
        })
      ])
    )
  })
})
