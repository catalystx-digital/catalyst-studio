import { StrapiProvider } from '../provider'

describe('StrapiProvider dynamic zones', () => {
  it('maps content[] fields to dynamic zones and schedules component creation', () => {
    const provider: any = new StrapiProvider()
    const collector = new Map<string, any>()

    const attr = provider.mapFieldToStrapiAttribute(
      { name: 'components', type: 'content[]', allowedTypes: ['HeroBanner'] },
      collector,
      'page'
    )

    expect(attr).not.toBeNull()
    expect(attr?.properties?.type).toBe('dynamiczone')
    expect(Array.isArray(attr?.properties?.components)).toBe(true)
    expect(attr?.properties?.components?.length).toBe(1)
    expect(collector.size).toBe(1)

    const op = Array.from(collector.values())[0]
    const hasRelation = Array.isArray(op?.attributes) && op.attributes.some((f: any) => f.name === 'component' && f.properties?.type === 'relation')
    expect(hasRelation).toBe(true)

    const zones: Map<string, any> | undefined = provider.dynamicZoneRegistry.get('page')
    const zoneConfig = zones?.get('components')
    expect(zoneConfig?.components?.get('herobanner')?.targetSingular).toBe('herobanner')
  })

  it('transforms component arrays into relation-based dynamic zone entries', async () => {
    const provider: any = new StrapiProvider()
    provider.loadComponents = jest.fn().mockResolvedValue(undefined)
    provider.ensureComponentEntry = jest.fn().mockResolvedValue('cmp-1')

    const config = {
      components: new Map<string, { uid: string; typeKey: string; targetSingular?: string; relationField?: string }>([
        ['hero-banner', { uid: 'catalyst.hero-banner-fragment', typeKey: 'hero-banner', targetSingular: 'hero-banner', relationField: 'component' }]
      ])
    }
    const mapping = { dynamicZones: new Map([[ 'components', config ]]) }
    const pruned: any = {}

    await provider.transformDynamicZones(
      pruned,
      mapping,
      { components: [{ type: 'hero-banner', properties: { heading: 'Welcome' } }] },
      new Map()
    )

    expect(provider.ensureComponentEntry).toHaveBeenCalled()
    expect(Array.isArray(pruned.components)).toBe(true)
    expect(pruned.components[0].__component).toBe('catalyst.hero-banner-fragment')
    expect(pruned.components[0].componentType).toBe('hero-banner')
    expect(pruned.components[0].component.connect[0]).toBe('cmp-1')
  })
})
