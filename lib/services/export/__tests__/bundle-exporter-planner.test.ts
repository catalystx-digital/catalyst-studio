import { BundleExporter } from '../bundle-exporter'

describe('BundleExporter TypeDependency planning (Story 40.3)', () => {
  let service: BundleExporter

  beforeEach(() => {
    jest.clearAllMocks()
    service = new BundleExporter()
    delete process.env.EXPORT_DETECTION_MODE
    delete process.env.EXPORT_DETECTION_MIN_CONFIDENCE
    delete process.env.OPTIMIZELY_MAX_NESTED_DEPTH
  })

  it('skips planner when mode=off', async () => {
    process.env.EXPORT_DETECTION_MODE = 'off'
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {})
    const items = [
      { id: 'A', contentTypeId: 'page', title: 'Page', slug: 'page', content: { blocks: [{ id: 'B' }] }, metadata: {} },
      { id: 'B', contentTypeId: 'hero', title: 'Hero', slug: 'hero', content: {}, metadata: {} },
    ] as any
    const types = [
      { id: 'page', key: 'page', name: 'Page', category: 'page', fields: [] },
      { id: 'hero', key: 'hero', name: 'Hero', category: 'component', fields: [] },
    ] as any
    await (service as any).maybeEmitTypeDependencyPlan(items, types)
    expect(logSpy).not.toHaveBeenCalled()
    logSpy.mockRestore()
  })

  it('emits structured plan logs in dry-run mode', async () => {
    process.env.EXPORT_DETECTION_MODE = 'dry-run'
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {})
    const items = [
      { id: 'A', contentTypeId: 'page', title: 'Page', slug: 'page', content: { blocks: [{ id: 'B' }, { id: 'C' }] }, metadata: {} },
      { id: 'B', contentTypeId: 'hero', title: 'Hero', slug: 'hero', content: {}, metadata: {} },
      { id: 'C', contentTypeId: 'cta', title: 'CTA', slug: 'cta', content: {}, metadata: {} },
    ] as any
    const types = [
      { id: 'page', key: 'page', name: 'Page', category: 'page', fields: [] },
      { id: 'hero', key: 'hero', name: 'Hero', category: 'component', fields: [] },
      { id: 'cta', key: 'cta', name: 'CTA', category: 'component', fields: [] },
    ] as any

    await (service as any).maybeEmitTypeDependencyPlan(items, types)

    const planLogs = logSpy.mock.calls
      .map(c => String(c[0]))
      .filter(s => s.includes('[PLAN] TypeDependency'))
    expect(planLogs.length).toBeGreaterThan(0)
    // Ensure parent A appears after children B and C in emitted sequence
    const idsInOrder = planLogs.map(s => /id=([^\s]+)/.exec(s)?.[1]).filter(Boolean) as string[]
    const posA = idsInOrder.indexOf('A')
    const posB = idsInOrder.indexOf('B')
    const posC = idsInOrder.indexOf('C')
    expect(posB).toBeGreaterThanOrEqual(0)
    expect(posC).toBeGreaterThanOrEqual(0)
    expect(posB).toBeLessThan(posA)
    expect(posC).toBeLessThan(posA)
    logSpy.mockRestore()
  })

  it('emits structured plan logs in conservative mode', async () => {
    process.env.EXPORT_DETECTION_MODE = 'conservative'
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {})
    const items = [
      { id: 'A', contentTypeId: 'page', title: 'Page', slug: 'page', content: { blocks: [{ id: 'B' }] }, metadata: {} },
      { id: 'B', contentTypeId: 'hero', title: 'Hero', slug: 'hero', content: {}, metadata: {} },
    ] as any
    const types = [
      { id: 'page', key: 'page', name: 'Page', category: 'page', fields: [] },
      { id: 'hero', key: 'hero', name: 'Hero', category: 'component', fields: [] },
    ] as any

    await (service as any).maybeEmitTypeDependencyPlan(items, types)

    const planLogs = logSpy.mock.calls
      .map(c => String(c[0]))
      .filter(s => s.includes('[PLAN] TypeDependency'))
    expect(planLogs.length).toBeGreaterThan(0)
    logSpy.mockRestore()
  })
})
