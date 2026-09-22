import { buildUniversalContentType } from '../content-type-builder'
import type { ContentTypeExport } from '../../types'

const makeContentType = (category: string): ContentTypeExport => ({
  id: 'ct-1',
  key: 'landing',
  name: 'Landing',
  pluralName: 'Landings',
  category,
  fields: [],
})

describe('buildUniversalContentType category handling', () => {
  it('marks a lowercase "page" category as a routable page', () => {
    const result = buildUniversalContentType(makeContentType('page'))

    expect(result.type).toBe('page')
    expect(result.isRoutable).toBe(true)
  })

  it('marks a "component" category as a non-routable component', () => {
    const result = buildUniversalContentType(makeContentType('component'))

    expect(result.type).toBe('component')
    expect(result.isRoutable).toBe(false)
  })

  // Regression: `type` used to lowercase the category while `isRoutable` did not,
  // so a 'Page' row produced type 'page' with isRoutable false - a page with no route.
  // Both now agree (strictly, matching the canonical isPage helper and the
  // lowercase-only ContentTypeCategory enum in the database).
  it.each(['Page', 'PAGE', 'pAgE'])(
    'keeps type and isRoutable consistent for a %s category',
    category => {
      const result = buildUniversalContentType(makeContentType(category))

      expect(result.isRoutable).toBe(result.type === 'page')
      expect(result.type).toBe('component')
      expect(result.isRoutable).toBe(false)
    }
  )
})
