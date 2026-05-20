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

describe('two-column legacy entry upgrades', () => {
  it('converts image-gallery entries with nested URL objects', () => {
    const component = createTwoColumnComponent({
      leftColumn: [
        {
          type: 'image-gallery',
          images: [
            {
              url: {
                mediaId: 'asset-123',
                originalUrl: 'https://example.com/image.jpg'
              },
              alt: 'Sample image'
            }
          ]
        }
      ]
    })

    const enriched = enrichComponentFromShared(component, undefined, { assetOrigin: undefined })
    const areas = (enriched.content as Record<string, any>).areas
    expect(areas).toBeDefined()
    expect(Array.isArray(areas.left)).toBe(true)
    expect(areas.left).toHaveLength(1)

    const gallery = areas.left[0]
    expect(gallery.type).toBe(ComponentType.ImageGallery)
    expect(gallery.category).toBe(ComponentCategory.Content)
    expect(gallery.content.images).toHaveLength(1)
    expect(gallery.content.images[0]?.url).toBe('https://example.com/image.jpg')
    expect(gallery.content.images[0]?.mediaId).toBe('asset-123')
    expect(gallery.content.images[0]?.alt).toBe('Sample image')
  })

  it('converts cta-simple entries with nested URL objects', () => {
    const component = createTwoColumnComponent({
      rightColumn: [
        {
          type: 'cta-simple',
          heading: 'View career opportunities',
          primaryButton: {
            text: 'Explore roles',
            url: {
              mediaId: 'link-42',
              originalUrl: 'https://careers.example.com'
            }
          }
        }
      ]
    })

    const enriched = enrichComponentFromShared(component, undefined, { assetOrigin: undefined })
    const areas = (enriched.content as Record<string, any>).areas
    expect(areas).toBeDefined()
    expect(Array.isArray(areas.right)).toBe(true)
    expect(areas.right).toHaveLength(1)

    const cta = areas.right[0]
    expect(cta.type).toBe(ComponentType.CTASimple)
    expect(cta.category).toBe(ComponentCategory.CTA)
    expect(cta.content.heading).toBe('View career opportunities')
    expect(cta.content.primaryButton.url).toBe('https://careers.example.com')
    expect(cta.content.primaryButton.text).toBe('Explore roles')
  })
})
