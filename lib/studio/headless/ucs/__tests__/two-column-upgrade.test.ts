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
  it('keeps canonical content.areas when props.content.areas is stale', () => {
    const component = createTwoColumnComponent({
      areas: {
        left: [
          {
            id: 'canonical-left',
            type: ComponentType.TextBlock,
            category: ComponentCategory.Content,
            theme: 'auto',
            variant: 'default',
            content: { body: 'Canonical content' }
          }
        ]
      }
    })
    component.props = {
      content: {
        areas: {
          left: [
            {
              id: 'stale-left',
              type: ComponentType.TextBlock,
              category: ComponentCategory.Content,
              theme: 'auto',
              variant: 'default',
              content: { body: 'Stale content' }
            }
          ]
        }
      }
    }

    const enriched = enrichComponentFromShared(component, undefined, { assetOrigin: undefined })
    const areas = (enriched.content as Record<string, any>).areas

    expect(areas.left).toHaveLength(1)
    expect(areas.left[0].id).toBe('canonical-left')
    expect(areas.left[0].content.body).toBe('Canonical content')
    expect(enriched.props).not.toHaveProperty('content')
  })

  it('keeps canonical content.areas when props.text contains stale JSON columns', () => {
    const component = createTwoColumnComponent({
      areas: {
        right: [
          {
            id: 'canonical-right',
            type: ComponentType.TextBlock,
            category: ComponentCategory.Content,
            theme: 'auto',
            variant: 'default',
            content: { body: 'Canonical right' }
          }
        ]
      }
    })
    component.props = {
      text: JSON.stringify({
        rightColumn: [
          ['text-block', 0.9, { body: 'Stale JSON right' }]
        ]
      })
    }

    const enriched = enrichComponentFromShared(component, undefined, { assetOrigin: undefined })
    const areas = (enriched.content as Record<string, any>).areas

    expect(areas.right).toHaveLength(1)
    expect(areas.right[0].id).toBe('canonical-right')
    expect(areas.right[0].content.body).toBe('Canonical right')
    expect(enriched.props).not.toHaveProperty('text')
  })

  it('ignores malformed two-column props.text when canonical content wins', () => {
    const component = createTwoColumnComponent({
      areas: {
        left: [
          {
            id: 'canonical-left',
            type: ComponentType.TextBlock,
            category: ComponentCategory.Content,
            theme: 'auto',
            variant: 'default',
            content: { body: 'Canonical content' }
          }
        ]
      }
    })
    component.props = {
      text: '{"leftColumn":'
    }
    const diagnostics: any[] = []

    const enriched = enrichComponentFromShared(component, undefined, { assetOrigin: undefined, diagnostics })
    const areas = (enriched.content as Record<string, any>).areas

    expect(areas.left).toHaveLength(1)
    expect(areas.left[0].id).toBe('canonical-left')
    expect(diagnostics).toEqual([])
    expect(enriched.props).not.toHaveProperty('text')
  })

  it.each([
    ['empty areas', { areas: { left: [], right: [] } }],
    ['empty legacy column', { leftColumn: [] }],
    ['metadata only', { columnRatio: '30-70' }]
  ])('does not upgrade legacy props.content when canonical content has %s', (_label, content) => {
    const component = createTwoColumnComponent(content)
    component.props = {
      content: {
        rightColumn: [
          {
            type: 'text-block',
            body: 'Legacy fallback content'
          }
        ]
      }
    }

    const enriched = enrichComponentFromShared(component, undefined, { assetOrigin: undefined })
    const enrichedContent = enriched.content as Record<string, any>

    expect(enrichedContent).toEqual(content)
    expect(enriched.props).not.toHaveProperty('content')
    expect(JSON.stringify(enrichedContent)).not.toContain('Legacy fallback content')
  })

  it('keeps empty canonical content empty instead of falling back to legacy props.content', () => {
    const component = createTwoColumnComponent({})
    component.props = {
      content: {
        rightColumn: [
          {
            type: 'text-block',
            body: 'Legacy fallback content'
          }
        ]
      }
    }

    const enriched = enrichComponentFromShared(component, undefined, { assetOrigin: undefined })

    expect(enriched.content).toEqual({})
    expect(enriched.props).not.toHaveProperty('content')
  })

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

  it('converts html-block entries from canonical bodyHtml', () => {
    const component = createTwoColumnComponent({
      rightColumn: [
        {
          type: 'html-block',
          title: 'Canonical HTML',
          bodyHtml: '<p>Canonical content</p>'
        }
      ]
    })

    const enriched = enrichComponentFromShared(component, undefined, { assetOrigin: undefined })
    const areas = (enriched.content as Record<string, any>).areas

    expect(areas.right).toHaveLength(1)
    expect(areas.right[0].type).toBe(ComponentType.HtmlBlock)
    expect(areas.right[0].category).toBe(ComponentCategory.Content)
    expect(areas.right[0].content).toEqual({
      title: 'Canonical HTML',
      bodyHtml: '<p>Canonical content</p>'
    })
  })

  it.each([
    ['html', { html: '<p>Legacy HTML field</p>' }],
    ['body', { body: '<p>Legacy body field</p>' }]
  ])('does not synthesize html-block bodyHtml from legacy %s', (_field, legacyContent) => {
    const component = createTwoColumnComponent({
      rightColumn: [
        {
          type: 'html-block',
          title: 'Canonical title',
          ...legacyContent
        }
      ]
    })

    const enriched = enrichComponentFromShared(component, undefined, { assetOrigin: undefined })
    const areas = (enriched.content as Record<string, any>).areas

    expect(areas.right).toHaveLength(1)
    expect(areas.right[0].type).toBe(ComponentType.HtmlBlock)
    expect(areas.right[0].content).toEqual({
      title: 'Canonical title',
      bodyHtml: ''
    })
    expect(JSON.stringify(areas.right[0].content)).not.toContain('Legacy')
  })

  it.each([
    ['partial CMS shape', { content: { html: '<p>Legacy nested HTML</p>' } }],
    ['full CMS shape', {
      id: 'html-block-1',
      category: ComponentCategory.Content,
      theme: 'auto',
      variant: 'default',
      content: { body: '<p>Legacy nested body</p>' }
    }]
  ])('does not preserve html-block legacy fields from %s', (_label, entryShape) => {
    const component = createTwoColumnComponent({
      rightColumn: [
        {
          type: 'html-block',
          ...entryShape
        }
      ]
    })

    const enriched = enrichComponentFromShared(component, undefined, { assetOrigin: undefined })
    const areas = (enriched.content as Record<string, any>).areas

    expect(areas.right).toHaveLength(1)
    expect(areas.right[0].type).toBe(ComponentType.HtmlBlock)
    expect(areas.right[0].content).toEqual({
      bodyHtml: ''
    })
    expect(JSON.stringify(areas.right[0].content)).not.toContain('Legacy')
    expect(areas.right[0].content).not.toHaveProperty('html')
    expect(areas.right[0].content).not.toHaveProperty('body')
  })
})
