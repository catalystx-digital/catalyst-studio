import { unwrapJsonContent } from '../json-unwrap-processor'
import type { DetectedComponent } from '@/lib/studio/import/detection/types'

describe('unwrapJsonContent', () => {
  it('unwraps canonical bodyHtml JSON from component.content', () => {
    const components = [
      {
        componentType: 'text-block',
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
        componentType: 'breadcrumbs',
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
})
