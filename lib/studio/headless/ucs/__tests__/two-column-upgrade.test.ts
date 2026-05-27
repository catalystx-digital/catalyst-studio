import { ComponentCategory, ComponentType } from '@/lib/studio/components/cms/_core/types'
import type { ComponentInstance } from '@/lib/studio/types/site-builder/component-instance'
import { enrichComponentFromShared } from '../snapshot-builder'

function createTwoColumnComponent(content: Record<string, unknown>): ComponentInstance {
  return {
    id: 'two-column-1',
    type: 'two-column',
    componentType: ComponentType.TwoColumn,
    parentId: null,
    position: 0,
    props: {},
    content,
    styles: {},
    metadata: {}
  }
}

describe('two-column canonical column normalization', () => {
  it('keeps canonical leftColumn and rightColumn renderable instead of moving them to areas', () => {
    const component = createTwoColumnComponent({
      leftColumn: [
        {
          id: 'left-cta',
          type: 'cta-simple',
          content: {
            heading: 'Emergency Department status',
            body: 'View the page for a real time guide to how busy we are.',
            primaryButton: {
              label: 'Emergency Department status',
              href: { path: '/emerg_rch/status/', type: 'internal' }
            }
          }
        }
      ],
      rightColumn: [
        {
          id: 'right-cta',
          type: 'cta-simple',
          content: {
            heading: 'Teen Health Info fact sheets',
            body: 'Health topics in simple language for young people aged 12 to 25.',
            primaryButton: {
              label: 'Health topics in simple language',
              href: { url: '/teeninfo/', type: 'external' }
            }
          }
        }
      ],
      columnRatio: '50-50'
    })

    const enriched = enrichComponentFromShared(component, undefined, { assetOrigin: undefined })
    const content = enriched.content as Record<string, any>

    expect(content).not.toHaveProperty('areas')
    expect(content.leftColumn).toHaveLength(1)
    expect(content.rightColumn).toHaveLength(1)
    expect(content.leftColumn[0]).toMatchObject({
      id: 'left-cta',
      type: ComponentType.CTASimple,
      category: ComponentCategory.CTA,
      theme: 'auto',
      variant: 'default',
      content: {
        heading: 'Emergency Department status'
      }
    })
    expect(content.rightColumn[0]).toMatchObject({
      id: 'right-cta',
      type: ComponentType.CTASimple,
      category: ComponentCategory.CTA,
      content: {
        heading: 'Teen Health Info fact sheets'
      }
    })
  })

  it('does not use stale props.content when canonical columns are present', () => {
    const component = createTwoColumnComponent({
      leftColumn: [
        {
          id: 'canonical-left',
          type: ComponentType.TextBlock,
          category: ComponentCategory.Content,
          theme: 'auto',
          variant: 'default',
          content: { body: 'Canonical content' }
        }
      ]
    })
    component.props = {
      content: {
        leftColumn: [
          {
            type: 'text-block',
            body: 'Stale fallback content'
          }
        ]
      }
    }

    const enriched = enrichComponentFromShared(component, undefined, { assetOrigin: undefined })
    const content = enriched.content as Record<string, any>

    expect(content.leftColumn).toHaveLength(1)
    expect(content.leftColumn[0].id).toBe('canonical-left')
    expect(content.leftColumn[0].content.body).toBe('Canonical content')
    expect(enriched.props).not.toHaveProperty('content')
    expect(JSON.stringify(content)).not.toContain('Stale fallback content')
  })

  it('keeps CMS-shaped image-gallery entries without legacy URL conversion', () => {
    const component = createTwoColumnComponent({
      leftColumn: [
        {
          id: 'gallery-1',
          type: 'image-gallery',
          content: {
            images: [
              {
                url: {
                  mediaId: 'asset-123',
                  originalUrl: 'https://example.com/image.jpg'
                },
                alt: 'Sample image'
              },
            ]
          }
        }
      ]
    })

    const enriched = enrichComponentFromShared(component, undefined, { assetOrigin: undefined })
    const content = enriched.content as Record<string, any>

    expect(content).not.toHaveProperty('areas')
    expect(content.leftColumn).toHaveLength(1)
    const gallery = content.leftColumn[0]
    expect(gallery.type).toBe(ComponentType.ImageGallery)
    expect(gallery.category).toBe(ComponentCategory.Content)
    expect(gallery.content.images[0]?.url).toEqual({
      mediaId: 'asset-123',
      originalUrl: 'https://example.com/image.jpg'
    })
    expect(gallery.content.images[0]?.alt).toBe('Sample image')
  })

  it('drops malformed legacy column entries instead of synthesizing components', () => {
    const component = createTwoColumnComponent({
      columnRatio: '50-50',
      leftColumn: [
        ['text-block', 0.9, { body: 'Tuple body' }],
        {
          type: 'text-block',
          body: 'Typed legacy body'
        },
        {
          heading: 'Legacy heading',
          body: 'Legacy body'
        }
      ],
      rightColumn: [
        {
          label: 'Legacy label',
          items: [{ type: 'nav-menu-item', label: 'Legacy nav item', url: '/legacy' }]
        }
      ]
    })

    const enriched = enrichComponentFromShared(component, undefined, { assetOrigin: undefined })
    const content = enriched.content as Record<string, any>

    expect(content).toEqual({ columnRatio: '50-50' })
    expect(JSON.stringify(content)).not.toContain('Tuple body')
    expect(JSON.stringify(content)).not.toContain('Typed legacy body')
    expect(JSON.stringify(content)).not.toContain('Legacy body')
    expect(JSON.stringify(content)).not.toContain('Legacy nav item')
  })

  it('leaves legacy areas-only content untouched and non-renderable by the current component contract', () => {
    const component = createTwoColumnComponent({
      areas: {
        left: [
          {
            id: 'legacy-left',
            type: ComponentType.TextBlock,
            category: ComponentCategory.Content,
            content: { body: 'Legacy area content' }
          }
        ]
      }
    })

    const enriched = enrichComponentFromShared(component, undefined, { assetOrigin: undefined })

    expect(enriched.content).toEqual(component.content)
  })
})
