import { GlobalSectionArtifactCache } from '../global-section-cache'
import type { SectionExtractionArtifact } from '../section-aggregation'

const headerArtifact = (): SectionExtractionArtifact => ({
  sectionKey: 'header:0-10',
  sectionOrder: 0,
  durationMs: 100,
  components: [
    {
      type: 'navbar',
      confidence: 0.95,
      content: { menuItems: [{ label: 'Home', href: { type: 'internal', pageId: 'home', path: '/' } }] },
      source: 'ai'
    }
  ],
  pageMetadata: { title: 'Source Page' }
})

describe('GlobalSectionArtifactCache', () => {
  it('reuses validated same-origin header artifacts and clones results', async () => {
    const cache = new GlobalSectionArtifactCache()
    const key = cache.createKey({
      role: 'header',
      origin: 'https://example.com',
      sectionSlice: [{ tag: 'nav', pathId: 'n1', className: 'site-nav active', text: 'Home' }],
      candidateTypes: ['navbar'],
      model: 'test-model'
    })
    const equivalentKey = cache.createKey({
      role: 'header',
      origin: 'https://example.com',
      sectionSlice: [{ tag: 'nav', pathId: 'n2', className: 'site-nav current', text: 'Home' }],
      candidateTypes: ['navbar'],
      model: 'test-model'
    })
    const produce = jest.fn(async () => headerArtifact())

    const first = await cache.getOrCreate(key, { url: 'https://example.com/', sectionKey: 'header:0-10' }, produce)
    first.artifact.components[0].content.menuItems[0].label = 'Mutated'
    const second = await cache.getOrCreate(equivalentKey, { url: 'https://example.com/about', sectionKey: 'header:0-10' }, produce)

    expect(produce).toHaveBeenCalledTimes(1)
    expect(first.provenance.extractionMode).toBe('fresh')
    expect(second.provenance.extractionMode).toBe('reused')
    expect(second.provenance.reusedFromUrl).toBe('https://example.com/')
    expect(second.artifact.components[0].content.menuItems[0].label).toBe('Home')
  })

  it('does not retry when fresh extraction fails', async () => {
    const cache = new GlobalSectionArtifactCache()
    const key = cache.createKey({
      role: 'header',
      origin: 'https://example.com',
      sectionSlice: [{ tag: 'nav', text: 'Home' }],
      candidateTypes: ['navbar'],
      model: 'test-model'
    })
    const produce = jest.fn(async () => {
      throw new Error('model failed')
    })

    await expect(cache.getOrCreate(key, { url: 'https://example.com/', sectionKey: 'header:0-10' }, produce)).rejects.toThrow('model failed')
    expect(produce).toHaveBeenCalledTimes(1)
  })

  it('does not share non-cacheable in-flight artifacts with waiters', async () => {
    const cache = new GlobalSectionArtifactCache()
    const key = cache.createKey({
      role: 'header',
      origin: 'https://example.com',
      sectionSlice: [{ tag: 'nav', text: 'Home' }],
      candidateTypes: ['navbar'],
      model: 'test-model'
    })
    let releaseFirst: (() => void) | undefined
    const firstProduce = jest.fn(async () => {
      await new Promise<void>(resolve => {
        releaseFirst = resolve
      })
      return { ...headerArtifact(), components: [] }
    })
    const secondProduce = jest.fn(async () => headerArtifact())

    const first = cache.getOrCreate(key, { url: 'https://example.com/', sectionKey: 'header:0-10' }, firstProduce)
    const second = cache.getOrCreate(key, { url: 'https://example.com/about', sectionKey: 'header:0-10' }, secondProduce)
    releaseFirst?.()

    await expect(first).resolves.toMatchObject({ provenance: { extractionMode: 'fresh', cacheHit: false } })
    await expect(second).resolves.toMatchObject({ provenance: { extractionMode: 'fresh', cacheHit: false } })
    expect(firstProduce).toHaveBeenCalledTimes(1)
    expect(secondProduce).toHaveBeenCalledTimes(1)
  })
})
