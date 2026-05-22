import { ComponentInstanceExtractor, IComponentInstanceExtractor } from '../component-instance-extractor'
import { ExtractedComponent } from '../content-orchestrator'
import { PrismaClient } from '@/lib/generated/prisma'
import { ComponentType } from '@/lib/studio/components/cms/_core/types'

// Mock PrismaClient
const mockPrisma = {
  websiteSharedComponent: {
    findMany: jest.fn()
  }
} as unknown as PrismaClient

describe('ComponentInstanceExtractor', () => {
  let extractor: ComponentInstanceExtractor
  const websiteId = 'test-website-id'

  beforeEach(() => {
    extractor = new ComponentInstanceExtractor(mockPrisma)
    jest.clearAllMocks()
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('extractFromPageContent', () => {
    it('should extract components from page content JSON', () => {
      const pageContent = {
        components: [
          {
            id: 'comp-1',
            type: 'hero',
            parentId: null,
            position: 0,
            properties: { title: 'Welcome', subtitle: 'Hero subtitle' }
          },
          {
            id: 'comp-2',
            type: 'text-block',
            parentId: 'comp-1',
            position: 1,
            properties: { content: 'Some text content' }
          }
        ]
      }

      const result = extractor.extractFromPageContent(pageContent)

      expect(result).toHaveLength(2)
      
      const hero = result[0]
      expect(hero.id).toBe('comp-1')
      expect(hero.type).toBe('hero')
      expect(hero.parentId).toBeNull()
      expect(hero.position).toBe(0)
      expect(hero.properties).toEqual({ title: 'Welcome', subtitle: 'Hero subtitle' })
      expect(hero.isShared).toBe(false)

      const textBlock = result[1]
      expect(textBlock.id).toBe('comp-2')
      expect(textBlock.type).toBe('text-block')
      expect(textBlock.parentId).toBe('comp-1')
      expect(textBlock.position).toBe(1)
      expect(textBlock.isShared).toBe(false)
    })

    it('should handle shared component references with "_shared" type', () => {
      const pageContent = {
        components: [
          {
            id: 'comp-shared-1',
            type: '_shared',
            sharedId: 'shared-comp-123',
            position: 0,
            properties: { customProp: 'value' }
          }
        ]
      }

      const result = extractor.extractFromPageContent(pageContent)

      expect(result).toHaveLength(1)
      
      const sharedComp = result[0]
      expect(sharedComp.id).toBe('comp-shared-1')
      expect(sharedComp.type).toBe('_shared')
      expect(sharedComp.isShared).toBe(true)
      expect(sharedComp.sharedId).toBe('shared-comp-123')
      expect(sharedComp.properties).toEqual({ customProp: 'value' })
    })

    it('should handle shared components flagged by isShared + sharedComponentId (no "_shared" type)', () => {
      const pageContent = {
        components: [
          {
            id: 'comp-shared-2',
            type: 'header', // not '_shared'
            isShared: true,
            sharedComponentId: 'shared-comp-456',
            position: 0,
            properties: { customProp: 'from-import' }
          }
        ]
      }

      const result = extractor.extractFromPageContent(pageContent)

      expect(result).toHaveLength(1)
      const sharedComp = result[0]
      expect(sharedComp.id).toBe('comp-shared-2')
      // Type remains as given; extractor defers replacement to resolveSharedComponents
      expect(sharedComp.type).toBe('header')
      expect(sharedComp.isShared).toBe(true)
      expect(sharedComp.sharedId).toBe('shared-comp-456')
      expect(sharedComp.properties).toEqual({ customProp: 'from-import' })
    })

    it('should handle components with alternative property names', () => {
      const pageContent = {
        components: [
          {
            id: 'comp-1',
            type: 'button',
            props: { text: 'Click me', color: 'blue' } // Using "props" instead of "properties"
          }
        ]
      }

      const result = extractor.extractFromPageContent(pageContent)

      expect(result).toHaveLength(1)
      expect(result[0].properties).toEqual({ text: 'Click me', color: 'blue' })
    })

    it('should generate IDs for components without IDs', () => {
      const pageContent = {
        components: [
          {
            type: 'nav',
            properties: {}
          }
        ]
      }

      const result = extractor.extractFromPageContent(pageContent)

      expect(result).toHaveLength(1)
      expect(result[0].id).toMatch(/^comp-\d+-0$/) // Generated ID pattern
      expect(result[0].position).toBe(0) // Uses array index as position
    })

    it('should handle empty or invalid content gracefully', () => {
      expect(extractor.extractFromPageContent(null)).toEqual([])
      expect(extractor.extractFromPageContent(undefined)).toEqual([])
      expect(extractor.extractFromPageContent({})).toEqual([])
      expect(extractor.extractFromPageContent({ components: null })).toEqual([])
      expect(extractor.extractFromPageContent({ components: 'invalid' })).toEqual([])
    })

    it('should handle empty components array', () => {
      const pageContent = { components: [] }
      const result = extractor.extractFromPageContent(pageContent)
      expect(result).toEqual([])
    })

    it('normalizes CTA alias without form into cta-simple', () => {
      const pageContent = {
        components: [
          {
            id: 'cta-1',
            type: 'cta',
            properties: {
              heading: 'Join us',
              primaryButton: { text: 'Sign up', url: '/signup' }
            }
          },
        ],
      }

      const result = extractor.extractFromPageContent(pageContent)
      expect(result[0].type).toBe(ComponentType.CTASimple)
    })

    it('normalizes CTA alias with form-like fields into cta-with-form', () => {
      const pageContent = {
        components: [
          {
            id: 'cta-2',
            type: 'cta',
            properties: {
              heading: 'Stay updated',
              form: { action: '/subscribe' },
              fields: [{ id: 'email', label: 'Email' }],
            }
          },
        ],
      }

      const result = extractor.extractFromPageContent(pageContent)
      expect(result[0].type).toBe(ComponentType.CTAWithForm)
    })

    it('extracts nested content[] sub-components using schema metadata', () => {
      const pageContent = {
        components: [
          {
            id: 'card-grid-1',
            type: 'card-grid',
            properties: {
              cards: [
                {
                  id: 'card-a',
                  type: 'card-item',
                  title: 'Card A',
                  description: 'First card'
                },
                {
                  type: 'card-item',
                  title: 'Card B'
                }
              ]
            }
          }
        ]
      }

      const mockMeta = {
        cards: { type: 'content[]', allowedTypes: ['card-item'] }
      }

      // @ts-expect-error accessing private helper for test stubbing
      jest.spyOn(extractor as any, 'getPropsMetaForType').mockReturnValue(mockMeta)

      const result = extractor.extractFromPageContent(pageContent)
      const cardGrid = result.find(comp => comp.id === 'card-grid-1')
      expect(cardGrid).toBeDefined()

      const children = result.filter(comp => comp.parentId === 'card-grid-1')
      expect(children).toHaveLength(2)
      expect(children.map(c => c.type)).toEqual(['card-item', 'card-item'])
      expect(children[0].properties.title).toBe('Card A')
      expect(children[1].properties.title).toBe('Card B')
    })

    it('coerces child type to allowed schema type when raw type differs', () => {
      const pageContent = {
        components: [
          {
            id: 'card-grid-mixed',
            type: 'card-grid',
            properties: {
              cards: [
                {
                  id: 'content-1',
                  type: 'Article',
                  title: 'Article slot'
                }
              ]
            }
          }
        ]
      }

      const mockMeta = {
        cards: { type: 'content[]', allowedTypes: ['card-item', 'promo-item'] }
      }

      // @ts-expect-error accessing private helper for test stubbing
      jest.spyOn(extractor as any, 'getPropsMetaForType').mockReturnValue(mockMeta)

      const result = extractor.extractFromPageContent(pageContent)
      const children = result.filter(comp => comp.parentId === 'card-grid-mixed')
      expect(children).toHaveLength(1)
      expect(children[0].type).toBe('card-item')
      expect(children[0].properties.title).toBe('Article slot')
    })

    it('warns and skips nested items without type metadata', () => {
      const pageContent = {
        components: [
          {
            id: 'card-grid-2',
            type: 'card-grid',
            properties: {
              cards: [
                { title: 'No type present' }
              ]
            }
          }
        ]
      }

      const mockMeta = {
        cards: { type: 'content[]', allowedTypes: ['card-item'] }
      }

      // @ts-expect-error accessing private helper for test stubbing
      jest.spyOn(extractor as any, 'getPropsMetaForType').mockReturnValue(mockMeta)

      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {})
      const result = extractor.extractFromPageContent(pageContent)

      const children = result.filter(comp => comp.parentId === 'card-grid-2')
      expect(children).toHaveLength(0)
      expect(warnSpy).toHaveBeenCalledWith(
        'ComponentInstanceExtractor: Skipping nested component without type',
        expect.objectContaining({ parentType: 'card-grid', field: 'cards', index: 0 })
      )
      warnSpy.mockRestore()
    })

    it('derives nested content[] sub-components from inline metadata when registry meta is unavailable', () => {
      const pageContent = {
        components: [
          {
            id: 'card-grid-inline',
            type: 'card-grid',
            properties: {
              content: {
                cards: [
                  {
                    id: 'inline-card-1',
                    type: 'card-item',
                    title: 'Inline Card One'
                  }
                ]
              },
              metadata: {
                properties: [
                  { name: 'cards', type: 'content[]', required: true }
                ]
              }
            }
          }
        ]
      }

      // @ts-expect-error accessing private helper for test stubbing
      jest.spyOn(extractor as any, 'getPropsMetaForType').mockReturnValue(undefined)

      const result = extractor.extractFromPageContent(pageContent)
      const cardGrid = result.find(comp => comp.id === 'card-grid-inline')
      expect(cardGrid).toBeDefined()

      const children = result.filter(comp => comp.parentId === 'card-grid-inline')
      expect(children).toHaveLength(1)
      expect(children[0].type).toBe('card-item')
      expect(children[0].properties.title).toBe('Inline Card One')
    })

  })

  describe('resolveSharedComponents', () => {
    it('should resolve importer-shaped shared refs (type!=_shared, isShared=true, sharedComponentId) using content/defaultProps + deep-merge', async () => {
      const components: ExtractedComponent[] = [
        {
          id: 'comp-imp-1',
          type: 'header', // not '_shared'
          parentId: null,
          position: 0,
          properties: { overrides: { subtitle: 'Local Sub' }, hasOverrides: true },
          isShared: true,
          sharedId: 'shared-imp-123'
        }
      ]

      const mockSharedData = [
        {
          id: 'shared-imp-123',
          name: 'Site Header',
          content: { title: 'Global Header', subtitle: 'Global Sub', theme: 'light' },
          config: { defaultProps: { title: 'Legacy Header' }, extra: 'ignored?' },
          websiteComponentType: {
            type: 'header',
            category: 'navigation'
          }
        }
      ]

      ;(mockPrisma.websiteSharedComponent.findMany as jest.Mock).mockResolvedValue(mockSharedData)

      const result = await extractor.resolveSharedComponents(components, websiteId)

      expect(result).toHaveLength(1)
      const resolved = result[0]
      // Type should be replaced with actual component type from WebsiteComponentType
      expect(resolved.type).toBe('header')
      // Use content and apply overrides; ignore non-prop config metadata
      expect(resolved.properties).toEqual({ title: 'Global Header', subtitle: 'Local Sub', theme: 'light' })
      expect(resolved.hasOverrides).toBe(true)
    })

    it('detects shared refs when only props.sharedComponentId is present (type not _shared, no top-level flags)', () => {
      const pageContent = {
        components: [
          {
            id: 'inst-x',
            type: 'hero',
            // No isShared flag, no top-level sharedComponentId
            properties: {},
            props: { sharedComponentId: 'shared-z9' },
            position: 0,
          }
        ]
      }

      const result = extractor.extractFromPageContent(pageContent)
      expect(result).toHaveLength(1)
      const comp = result[0]
      expect(comp.isShared).toBe(true)
      expect(comp.sharedId).toBe('shared-z9')
    })
    it('should resolve shared component references to actual types', async () => {
      const components: ExtractedComponent[] = [
        {
          id: 'comp-1',
          type: '_shared',
          parentId: null,
          position: 0,
          properties: { customProp: 'value' },
          isShared: true,
          sharedId: 'shared-123'
        },
        {
          id: 'comp-2',
          type: 'regular',
          parentId: null,
          position: 1,
          properties: {},
          isShared: false
        }
      ]

      const mockSharedData = [
        {
          id: 'shared-123',
          name: 'Global Navigation',
          content: { links: ['home', 'about'] },
          config: { defaultProps: { links: ['fallback'] } },
          websiteComponentType: {
            type: 'navigation',
            category: 'layout'
          }
        }
      ]

      ;(mockPrisma.websiteSharedComponent.findMany as jest.Mock).mockResolvedValue(mockSharedData)

      const result = await extractor.resolveSharedComponents(components, websiteId)

      expect(result).toHaveLength(2)
      
      // Shared component should be resolved
      const resolved = result[0]
      expect(resolved.type).toBe('navigation') // Should replace "_shared" with actual type
      expect(resolved.properties).toEqual({
        links: ['home', 'about'] // Resolved from content only
      })
      
      // Regular component should be unchanged
      const regular = result[1]
      expect(regular.type).toBe('regular')
      expect(regular.isShared).toBe(false)
    })

    it('records resolved shared component types in usage tracking', async () => {
      const components: ExtractedComponent[] = [
        {
          id: 'shared-instance',
          type: '_shared',
          parentId: null,
          position: 0,
          properties: {},
          isShared: true,
          sharedId: 'shared-usage-1'
        },
        {
          id: 'regular-instance',
          type: 'promo-card',
          parentId: null,
          position: 1,
          properties: {},
          isShared: false
        }
      ]

      ;(mockPrisma.websiteSharedComponent.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'shared-usage-1',
          content: { headline: 'Hello' },
          config: { defaultProps: { headline: 'Fallback' } },
          websiteComponentType: { type: 'feature-hero' }
        }
      ])

      const usage = new Set<string>()
      const result = await extractor.resolveSharedComponents(components, websiteId, usage)

      expect(result[0].type).toBe('feature-hero')
      expect(usage.has('feature-hero')).toBe(true)
      expect(usage.has('promo-card')).toBe(true)
    })

    it('applies defaultProps fallback when content is missing', async () => {
      const components: ExtractedComponent[] = [
        {
          id: 'comp-1',
          type: '_shared',
          parentId: null,
          position: 0,
          properties: {},
          isShared: true,
          sharedId: 'shared-999'
        }
      ]

      const mockSharedData = [
        {
          id: 'shared-999',
          name: 'Global Footer',
          // no content
          config: { defaultProps: { copyright: '2025' } },
          websiteComponentType: { type: 'footer', category: 'layout' }
        }
      ]

      ;(mockPrisma.websiteSharedComponent.findMany as jest.Mock).mockResolvedValue(mockSharedData)

      const result = await extractor.resolveSharedComponents(components, websiteId)
      expect(result).toHaveLength(1)
      expect(result[0].type).toBe('footer')
      expect(result[0].properties).toEqual({ copyright: '2025' })
    })

    it('deep-merges overrides with object/array/null semantics', async () => {
      const components: ExtractedComponent[] = [
        {
          id: 'comp-1',
          type: '_shared',
          parentId: null,
          position: 0,
          properties: { overrides: { style: { color: 'red' }, items: ['b'], title: null } },
          isShared: true,
          sharedId: 'shared-merge-1'
        }
      ]

      const mockSharedData = [
        {
          id: 'shared-merge-1',
          name: 'Hero',
          content: { title: 'Global', style: { color: 'blue', size: 'lg' }, items: ['a'] },
          websiteComponentType: { type: 'hero', category: 'content' }
        }
      ]

      ;(mockPrisma.websiteSharedComponent.findMany as jest.Mock).mockResolvedValue(mockSharedData)

      const result = await extractor.resolveSharedComponents(components, websiteId)
      expect(result).toHaveLength(1)
      const props = result[0].properties as any
      expect(props).toEqual({ style: { color: 'red', size: 'lg' }, items: ['b'] })
      expect((props as any).title).toBeUndefined()
      expect(result[0].hasOverrides).toBe(true)
    })

    it('strips linkage/metadata keys from resolved properties', async () => {
      const components: ExtractedComponent[] = [
        {
          id: 'comp-1',
          type: '_shared',
          parentId: null,
          position: 0,
          properties: { overrides: { title: 'Local' }, hasOverrides: true, sharedComponentId: 'shared-abc', stray: 'ignore-me' },
          isShared: true,
          sharedId: 'shared-abc'
        }
      ]

      const mockSharedData = [
        {
          id: 'shared-abc',
          name: 'Header',
          content: { title: 'Global', theme: 'light' },
          config: { defaultProps: { title: 'Legacy' } },
          websiteComponentType: { type: 'header', category: 'content' }
        }
      ]

      ;(mockPrisma.websiteSharedComponent.findMany as jest.Mock).mockResolvedValue(mockSharedData)

      const result = await extractor.resolveSharedComponents(components, websiteId)
      expect(result).toHaveLength(1)
      const props = result[0].properties as any
      expect(props).toEqual({ title: 'Local', theme: 'light' })
      // Explicit negative assertions
      expect('overrides' in props).toBe(false)
      expect('hasOverrides' in props).toBe(false)
      expect('sharedComponentId' in props).toBe(false)
    })

    it('ignores full local shared props unless explicit overrides are present', async () => {
      const components: ExtractedComponent[] = [
        {
          id: 'comp-1',
          type: '_shared',
          parentId: null,
          position: 0,
          properties: { title: 'Local', theme: 'light' },
          isShared: true,
          sharedId: 'shared-1'
        }
      ]

      const mockSharedData = [
        {
          id: 'shared-1',
          name: 'Header',
          content: { title: 'Global', theme: 'dark' },
          websiteComponentType: { type: 'header', category: 'content' }
        }
      ]

      ;(mockPrisma.websiteSharedComponent.findMany as jest.Mock).mockResolvedValue(mockSharedData)

      const result = await extractor.resolveSharedComponents(components, websiteId)

      expect(result[0].properties).toEqual({ title: 'Global', theme: 'dark' })
      expect((result[0] as any).hasOverrides).toBe(false)
    })

    it('should handle missing shared component references gracefully', async () => {
      const components: ExtractedComponent[] = [
        {
          id: 'comp-1',
          type: '_shared',
          parentId: null,
          position: 0,
          properties: {},
          isShared: true,
          sharedId: 'missing-shared-comp'
        }
      ]

      ;(mockPrisma.websiteSharedComponent.findMany as jest.Mock).mockResolvedValue([])

      const result = await extractor.resolveSharedComponents(components, websiteId)

      expect(result).toHaveLength(1)
      // Should return original component unchanged if shared component not found
      expect(result[0].type).toBe('_shared')
      expect(result[0].isShared).toBe(true)
    })

    it('should batch fetch shared components to minimize database calls', async () => {
      const components: ExtractedComponent[] = [
        {
          id: 'comp-1',
          type: '_shared',
          parentId: null,
          position: 0,
          properties: {},
          isShared: true,
          sharedId: 'shared-1'
        },
        {
          id: 'comp-2',
          type: '_shared',
          parentId: null,
          position: 1,
          properties: {},
          isShared: true,
          sharedId: 'shared-1' // Same shared ID
        },
        {
          id: 'comp-3',
          type: '_shared',
          parentId: null,
          position: 2,
          properties: {},
          isShared: true,
          sharedId: 'shared-2' // Different shared ID
        }
      ]

      const mockSharedData = [
        {
          id: 'shared-1',
          config: {},
          websiteComponentType: { type: 'header' }
        },
        {
          id: 'shared-2',
          config: {},
          websiteComponentType: { type: 'footer' }
        }
      ]

      ;(mockPrisma.websiteSharedComponent.findMany as jest.Mock).mockResolvedValue(mockSharedData)

      await extractor.resolveSharedComponents(components, websiteId)

      // Should only call database once with unique IDs
      expect(mockPrisma.websiteSharedComponent.findMany).toHaveBeenCalledTimes(1)
      expect(mockPrisma.websiteSharedComponent.findMany).toHaveBeenCalledWith({
        where: {
          id: { in: ['shared-1', 'shared-2'] }, // Only unique IDs
          websiteId: websiteId
        },
        include: {
          websiteComponentType: true
        }
      })
    })

    it('expands nested components defined in shared content schema', async () => {
      const components: ExtractedComponent[] = [
        {
          id: 'nav-instance-1',
          type: '_shared',
          parentId: null,
          position: 0,
          properties: { sharedComponentId: 'shared-nav-1' },
          isShared: true,
          sharedId: 'shared-nav-1'
        }
      ]

      const sharedContent = [
        {
          id: 'shared-nav-1',
          content: {
            logo: { src: '/logo.svg', href: '/' },
            menuItems: [
              { id: 'menu-a', type: 'nav-menu-item', content: { label: 'Home', href: '/' } },
              { type: 'nav-menu-item', content: { label: 'Shop', href: '/shop' } }
            ]
          },
          config: {},
          websiteComponentType: {
            type: 'nav-bar',
            category: 'navigation'
          }
        }
      ]

      ;(mockPrisma.websiteSharedComponent.findMany as jest.Mock).mockResolvedValue(sharedContent)

      const result = await extractor.resolveSharedComponents(components, websiteId)

      expect(result.length).toBeGreaterThan(1)

      const parent = result.find(comp => comp.id === 'nav-instance-1')
      expect(parent).toBeDefined()
      expect(parent?.type).toBe('nav-bar')
      expect(Array.isArray(parent?.properties.menuItems)).toBe(true)

      const children = result.filter(comp => comp.parentId === 'nav-instance-1')
      expect(children).toHaveLength(2)
      expect(children.map(c => c.type)).toEqual(['nav-menu-item', 'nav-menu-item'])
      expect(children[0].properties.label ?? children[0].properties.content?.label).toBe('Home')
      expect(children[1].properties.label ?? children[1].properties.content?.label).toBe('Shop')
    })

    it('should handle components without shared components', async () => {
      const components: ExtractedComponent[] = [
        {
          id: 'comp-1',
          type: 'regular',
          parentId: null,
          position: 0,
          properties: {},
          isShared: false
        }
      ]

      const result = await extractor.resolveSharedComponents(components, websiteId)

      expect(result).toEqual(components)
      expect(mockPrisma.websiteSharedComponent.findMany).not.toHaveBeenCalled()
    })

    it('should handle database errors gracefully', async () => {
      const components: ExtractedComponent[] = [
        {
          id: 'comp-1',
          type: '_shared',
          parentId: null,
          position: 0,
          properties: {},
          isShared: true,
          sharedId: 'shared-1'
        }
      ]

      ;(mockPrisma.websiteSharedComponent.findMany as jest.Mock).mockRejectedValue(new Error('DB Error'))

      const result = await extractor.resolveSharedComponents(components, websiteId)

      expect(result).toEqual(components) // Should return original components on error
    })
  })

  describe('extractAndResolveComponents', () => {
    it('should extract and resolve components in one operation', async () => {
      const pageContent = {
        components: [
          {
            id: 'comp-1',
            type: '_shared',
            sharedId: 'shared-123',
            properties: {}
          }
        ]
      }

      const mockSharedData = [
        {
          id: 'shared-123',
          content: { title: 'Global Header' },
          config: { defaultProps: { title: 'Legacy Fallback' } },
          websiteComponentType: { type: 'header' }
        }
      ]

      ;(mockPrisma.websiteSharedComponent.findMany as jest.Mock).mockResolvedValue(mockSharedData)

      const result = await extractor.extractAndResolveComponents(pageContent, websiteId)

      expect(result).toHaveLength(1)
      expect(result[0].type).toBe('header')
      expect(result[0].properties.title).toBe('Global Header')
    })
  })

  describe('caching', () => {
    it('should cache shared component data', async () => {
      const components: ExtractedComponent[] = [
        {
          id: 'comp-1',
          type: '_shared',
          parentId: null,
          position: 0,
          properties: {},
          isShared: true,
          sharedId: 'shared-1'
        }
      ]

      const mockSharedData = [
        {
          id: 'shared-1',
          config: {},
          websiteComponentType: { type: 'header' }
        }
      ]

      ;(mockPrisma.websiteSharedComponent.findMany as jest.Mock).mockResolvedValue(mockSharedData)

      // First call
      await extractor.resolveSharedComponents(components, websiteId)
      expect(mockPrisma.websiteSharedComponent.findMany).toHaveBeenCalledTimes(1)

      // Second call with same data should use cache
      await extractor.resolveSharedComponents(components, websiteId)
      expect(mockPrisma.websiteSharedComponent.findMany).toHaveBeenCalledTimes(1) // Still only called once
    })

    it('should clear cache when clearCache is called', async () => {
      const components: ExtractedComponent[] = [
        {
          id: 'comp-1',
          type: '_shared',
          parentId: null,
          position: 0,
          properties: {},
          isShared: true,
          sharedId: 'shared-1'
        }
      ]

      ;(mockPrisma.websiteSharedComponent.findMany as jest.Mock).mockResolvedValue([])

      // First call
      await extractor.resolveSharedComponents(components, websiteId)
      expect(mockPrisma.websiteSharedComponent.findMany).toHaveBeenCalledTimes(1)

      // Clear cache
      extractor.clearCache()

      // Second call should hit database again
      await extractor.resolveSharedComponents(components, websiteId)
      expect(mockPrisma.websiteSharedComponent.findMany).toHaveBeenCalledTimes(2)
    })
  })
})
