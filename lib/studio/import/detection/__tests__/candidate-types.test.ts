import { filterPageContentCandidateTypes, isPageContentCandidateType } from '../candidate-types'

describe('page content candidate types', () => {
  it('keeps page-level component types and removes sub-components', () => {
    expect(filterPageContentCandidateTypes(['card-item', 'card-grid', 'promo-item', 'hero-with-image'])).toEqual([
      'card-grid',
      'hero-with-image'
    ])
  })

  it('does not allow sub-components as page content candidates', () => {
    expect(isPageContentCandidateType('card-item')).toBe(false)
    expect(isPageContentCandidateType('promo-item')).toBe(false)
    expect(isPageContentCandidateType('card-grid')).toBe(true)
  })
})
