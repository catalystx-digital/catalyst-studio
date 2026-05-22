jest.mock('@/lib/db/client', () => ({
  getClient: jest.fn(),
}))

jest.mock('@/lib/studio/preview/access', () => ({
  assertStudioWebsiteAccess: jest.fn(),
  previewAccessErrorResponse: jest.fn(),
}))

import { extractComponents } from '@/app/api/studio/preview/data/route'

describe('preview data component extraction', () => {
  it('emits props.content from canonical component.content over stale props.content', () => {
    const [component] = extractComponents({
      components: [
        {
          id: 'component-1',
          type: 'hero-banner',
          parentId: null,
          position: 0,
          props: {
            content: { heading: 'Stale props.content heading' },
          },
          content: { heading: 'Canonical heading' },
          styles: {},
          metadata: {},
        },
      ],
    })

    expect(component.content).toEqual({ heading: 'Canonical heading' })
    expect(component.props.content).toEqual({ heading: 'Canonical heading' })
  })
})
