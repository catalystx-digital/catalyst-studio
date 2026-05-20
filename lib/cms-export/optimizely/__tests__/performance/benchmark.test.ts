import { OptimizelyProvider } from '../../provider'

describe('OptimizelyProvider Performance Benchmarks', () => {
  let provider: OptimizelyProvider

  beforeEach(() => {
    provider = new OptimizelyProvider()
  })

  it('compiles 200 content types quickly', () => {
    const support = provider.getCompiledTypeSupport()!
    const contentTypes = Array.from({ length: 200 }, (_, i) => ({
      id: `t${i}`,
      key: `type_${i}`,
      name: `Type ${i}`,
      pluralName: `Types ${i}`,
      category: i % 2 === 0 ? 'page' : 'component',
      fields: []
    })) as any
    const start = performance.now()
    const compiled = support.compile(contentTypes)
    const duration = performance.now() - start
    expect(compiled.all.length).toBe(200)
    // keep generous threshold for CI
    expect(duration).toBeLessThan(500)
  })
})

