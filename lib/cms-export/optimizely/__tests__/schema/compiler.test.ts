import { compileFromContentTypeExports } from '../../schema/compiler'

describe('compileFromContentTypeExports', () => {
  it('preserves wildcard containment lists', () => {
    const index = compileFromContentTypeExports([
      {
        id: 'page_1',
        key: 'blog_page',
        name: 'Blog Page',
        category: 'page',
        fields: [],
        mayContainTypes: ['*', 'blog_post']
      },
    ])

    const compiled = index.byKey['blog_page']
    expect(compiled?.mayContainTypes).toEqual(['*'])
  })

  it('respects explicit empty arrays', () => {
    const index = compileFromContentTypeExports([
      {
        id: 'page_2',
        key: 'minimal_page',
        name: 'Minimal Page',
        category: 'page',
        fields: [],
        mayContainTypes: []
      },
    ])

    const compiled = index.byKey['minimal_page']
    expect(compiled?.mayContainTypes).toEqual([])
  })

  it('applies fallback containment when unspecified', () => {
    const index = compileFromContentTypeExports([
      {
        id: 'page_3',
        key: 'home_page',
        name: 'Home Page',
        category: 'page',
        fields: []
      },
    ])

    const compiled = index.byKey['home_page']
    expect(compiled?.mayContainTypes).toEqual(['*'])
  })
})
