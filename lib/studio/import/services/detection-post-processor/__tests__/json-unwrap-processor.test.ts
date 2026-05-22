import { unwrapJsonContent } from '../json-unwrap-processor'
import { ComponentType } from '@/lib/studio/components/cms/_core/types'
import type { DetectedComponent } from '@/lib/studio/import/detection/types'

describe('unwrapJsonContent', () => {
  it('unwraps canonical bodyHtml JSON from component.content', () => {
    const components = [
      {
        component: ComponentType.TextBlock,
        type: ComponentType.TextBlock,
        confidence: 0.95,
        content: {
          body: JSON.stringify({
            title: 'Overview',
            bodyHtml: '<p>Canonical body</p>',
          }),
        },
      },
    ] as DetectedComponent[]

    unwrapJsonContent(components)

    expect(components[0].content).toEqual({
      body: '<p>Canonical body</p>',
      bodyHtml: '<p>Canonical body</p>',
      heading: 'Overview',
    })
  })

  it('does not unwrap old props.text JSON into props or content', () => {
    const components = [
      {
        component: ComponentType.Breadcrumbs,
        type: ComponentType.Breadcrumbs,
        confidence: 0.95,
        props: {
          text: JSON.stringify({ heading: 'Old props text', items: [{ label: 'Home' }] }),
        },
        content: {},
      },
    ] as unknown as DetectedComponent[]

    unwrapJsonContent(components)

    expect((components[0] as any).props).toEqual({
      text: JSON.stringify({ heading: 'Old props text', items: [{ label: 'Home' }] }),
    })
    expect((components[0] as any).props).not.toHaveProperty('heading')
    expect((components[0] as any).props).not.toHaveProperty('items')
    expect(components[0].content).toEqual({})
  })

  it('unwraps nested two-column lightweight children with type and content', () => {
    const components = [
      {
        component: ComponentType.TwoColumn,
        type: ComponentType.TwoColumn,
        confidence: 0.95,
        content: {
          leftColumn: [
            {
              type: ComponentType.TextBlock,
              content: {
                body: JSON.stringify({
                  title: 'Nested Overview',
                  bodyHtml: '<p>Nested body</p>',
                }),
              },
            },
          ],
          rightColumn: [],
        },
      },
    ] as unknown as DetectedComponent[]

    unwrapJsonContent(components)

    expect((components[0].content.leftColumn as any[])[0].content).toEqual({
      body: '<p>Nested body</p>',
      bodyHtml: '<p>Nested body</p>',
      heading: 'Nested Overview',
    })
  })
})
