import TypeDependencyPlanner, { type DetectionInput } from '../type-dependency-planner'

describe('TypeDependencyPlanner', () => {
  it('orders children before parents for simple references', () => {
    const detections: DetectionInput[] = [
      { itemId: 'A', itemType: 'page', path: 'content.blocks', classification: 'array_content_reference', refIds: ['B', 'C'] },
      { itemId: 'B', itemType: 'component', path: 'content', classification: 'object', refIds: [] },
      { itemId: 'C', itemType: 'component', path: 'content', classification: 'object', refIds: [] },
    ]
    const planner = new TypeDependencyPlanner()
    const res = planner.planDependencies(detections, { byKey: {}, all: [] })
    expect(res.kind).toBe('ok')
    if (res.kind === 'ok') {
      const order = res.nodes.map(n => n.id)
      // Children B/C must appear before parent A
      const posA = order.indexOf('A')
      const posB = order.indexOf('B')
      const posC = order.indexOf('C')
      expect(posB).toBeGreaterThanOrEqual(0)
      expect(posC).toBeGreaterThanOrEqual(0)
      expect(posB).toBeLessThan(posA)
      expect(posC).toBeLessThan(posA)
    }
  })

  it('detects cycles and reports error', () => {
    const detections: DetectionInput[] = [
      { itemId: 'A', itemType: 'page', path: 'content.a', classification: 'content_reference', refIds: ['B'] },
      { itemId: 'B', itemType: 'component', path: 'content.b', classification: 'content_reference', refIds: ['A'] },
    ]
    const planner = new TypeDependencyPlanner()
    const res = planner.planDependencies(detections, { byKey: {}, all: [] })
    expect(res.kind).toBe('error')
    if (res.kind === 'error') {
      expect(res.error.type).toBe('CycleDetected')
      expect(res.error.cycles.length).toBeGreaterThan(0)
    }
  })
})

