import { cmsComponentFactory } from '@/lib/studio/components/cms/_factory/factory'
import { ComponentType } from '@/lib/studio/components/cms/_core/types'
import { MobileMenuDef } from '@/lib/studio/components/cms/navigation/mobile-menu/mobile-menu.def'
import { TextBlockDef } from '@/lib/studio/components/cms/content/text-block/text-block.def'
import { CTABannerDef } from '@/lib/studio/components/cms/cta/cta-banner/cta-banner.def'
import { CTASimpleDef } from '@/lib/studio/components/cms/cta/cta-simple/cta-simple.def'
import { HeroWithImageDef } from '@/lib/studio/components/cms/heroes/hero-with-image/hero-with-image.def'
import {
  getComponentContractByCanonicalType,
  listComponentContracts,
  refreshComponentContracts
} from '@/lib/studio/components/catalog/component-contracts'

const STUB_COMPONENT = (() => null) as any

function makeMetadata(pageLocation: 'header' | 'main' | 'hero' | 'sidebar' | 'footer') {
  return {
    keywords: ['test'],
    patterns: ['test'],
    commonNames: ['test'],
    pageLocation: [pageLocation],
    confidence: 0.6
  }
}

describe('component-contracts universal adapter', () => {
  beforeAll(() => {
    cmsComponentFactory.unregisterComponent(ComponentType.MobileMenu)
    cmsComponentFactory.unregisterComponent(ComponentType.TextBlock)
    cmsComponentFactory.unregisterComponent(ComponentType.CTABanner)
    cmsComponentFactory.unregisterComponent(ComponentType.CTASimple)
    cmsComponentFactory.unregisterComponent(ComponentType.HeroWithImage)

    cmsComponentFactory.registerComponent(
      ComponentType.MobileMenu,
      STUB_COMPONENT,
      makeMetadata('header'),
      { description: MobileMenuDef.description, schema: MobileMenuDef.schema }
    )

    cmsComponentFactory.registerComponent(
      ComponentType.TextBlock,
      STUB_COMPONENT,
      makeMetadata('main'),
      { description: TextBlockDef.description, schema: TextBlockDef.schema }
    )

    cmsComponentFactory.registerComponent(
      ComponentType.CTABanner,
      STUB_COMPONENT,
      makeMetadata('main'),
      { description: CTABannerDef.description, schema: CTABannerDef.schema }
    )

    cmsComponentFactory.registerComponent(
      ComponentType.CTASimple,
      STUB_COMPONENT,
      makeMetadata('main'),
      { description: CTASimpleDef.description, schema: CTASimpleDef.schema }
    )

    cmsComponentFactory.registerComponent(
      ComponentType.HeroWithImage,
      STUB_COMPONENT,
      makeMetadata('hero'),
      { description: HeroWithImageDef.description, schema: HeroWithImageDef.schema }
    )

    refreshComponentContracts()
  })

  it('includes canonical coverage for the expanded component set', () => {
    const canonicalTypes = listComponentContracts().map(contract => contract.canonicalType)
    expect(canonicalTypes).toEqual(
      expect.arrayContaining([
        'mobile-menu',
        'text-block',
        'cta-simple',
        'cta-with-form',
        'simple-form',
        'team-grid',
        'pricing-comparison',
        'chart'
      ])
    )
  })

  it('hydrates text-block with registry metadata and default region', () => {
    const contract = getComponentContractByCanonicalType('text-block')
    expect(contract).toBeDefined()
    expect(contract?.defaultRegion).toBe('main')
    expect(contract?.propsMeta?.body?.required).toBe(true)
    expect(contract?.sources.hasComponentRegistry).toBe(true)
  })

  it('provides CTA banner guidance backed by the registered component', () => {
    const contract = getComponentContractByCanonicalType('cta-banner')
    expect(contract).toBeDefined()
    expect(contract?.summary).toContain('Full-width call-to-action')
    expect(contract?.sources.hasComponentRegistry).toBe(true)
  })

  it('hydrates cta-simple from the registry adapter', () => {
    const contract = getComponentContractByCanonicalType('cta-simple')
    expect(contract).toBeDefined()
    expect(contract?.propsMeta?.primaryButton?.required).toBe(true)
    expect(contract?.sources.hasComponentRegistry).toBe(true)
  })

  it('surfaces hero-with-image with factory metadata', () => {
    const contract = getComponentContractByCanonicalType('hero-with-image')
    expect(contract).toBeDefined()
    expect(contract?.sources.hasComponentRegistry).toBe(true)
    expect(contract?.defaultRegion).toBe('hero')
    expect(contract?.propsMeta?.heading?.required).toBe(true)
  })

  it('exposes region for blog-post without synthesis hooks', () => {
    const contract = getComponentContractByCanonicalType('blog-post')
    expect(contract).toBeDefined()
    expect(contract).not.toHaveProperty('synthesizer')
    expect(contract?.defaultRegion).toBe('main')
  })

  it('derives navigation defaults from canonical sample content', () => {
    const contract = getComponentContractByCanonicalType('mobile-menu')
    expect(contract).toBeDefined()
    expect(contract?.defaultRegion).toBe('header')
    expect(contract?.sources.hasComponentRegistry).toBe(true)
  })
})
