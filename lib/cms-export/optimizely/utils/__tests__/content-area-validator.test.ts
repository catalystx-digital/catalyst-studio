import { validateContentAreas } from '@/lib/cms-export/optimizely/utils/content-area-validator'

jest.mock('@/lib/services/universal-types/type-guidance', () => ({
  getTopLevelComponentTypes: jest.fn(async () => ['hero-banner', 'card-grid', 'team-grid'])
}))

describe('validateContentAreas (import-time)', () => {
  const compiled = {
    byKey: {
      page: {
        key: 'page',
        baseType: 'page',
        fields: [ { name: 'components', valueType: 'array<contentReference>' } ]
      },
      'card-grid': {
        key: 'card-grid', baseType: 'component',
        fields: [ { name: 'cards', valueType: 'array<contentReference>', allowedTypes: ['card-item'] } ]
      },
      'card-item': { key: 'card-item', baseType: 'component', fields: [] }
    }
  } as any

  it('flags missing type', async () => {
    const issues = await validateContentAreas(compiled, 'card-grid', { cards: [{}] })
    expect(issues.some(i => i.error === 'missing_type')).toBe(true)
  })

  it('flags disallowed type', async () => {
    const issues = await validateContentAreas(compiled, 'card-grid', { cards: [{ type: 'promo-item' }] })
    expect(issues.some(i => i.error === 'disallowed_type')).toBe(true)
  })

  it('disallows sub-components at page level', async () => {
    const issues = await validateContentAreas(compiled, 'page', { components: [{ type: 'card-item' }] })
    expect(issues.some(i => i.details && i.details.includes('not top-level'))).toBe(true)
  })
})

