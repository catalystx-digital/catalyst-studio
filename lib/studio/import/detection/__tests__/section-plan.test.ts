import { buildDetectionSectionPlan } from '../section-plan'

describe('buildDetectionSectionPlan', () => {
  it('creates ordered section tasks with role-specific candidates', () => {
    const tasks = buildDetectionSectionPlan({
      pageUrl: 'https://example.com/our-work',
      sections: [
        { key: 'header', approxBytes: 100, hash: 'a', nodeCount: 2 },
        { key: 'main:0-999', approxBytes: 900, hash: 'b', nodeCount: 20 },
        { key: 'footer', approxBytes: 100, hash: 'c', nodeCount: 3 }
      ]
    })

    expect(tasks.map(task => task.sectionKey)).toEqual(['header', 'main:0-999', 'footer'])
    expect(tasks[0].required).toBe(true)
    expect(tasks[1].required).toBe(false)
    expect(tasks[2].required).toBe(true)
    expect(tasks[0].candidateTypes).toContain('navbar')
    expect(tasks[1].candidateTypes).toContain('card-grid')
    expect(tasks[1].candidateTypes).not.toContain('content-feed')
    expect(tasks[2].candidateTypes).toContain('footer')
  })

  it('allows content feeds in generic homepage main sections', () => {
    const tasks = buildDetectionSectionPlan({
      pageUrl: 'https://example.com/',
      sections: [
        { key: 'main:0-999', approxBytes: 900, hash: 'a', nodeCount: 20 },
        { key: 'main:1000-1999', approxBytes: 900, hash: 'b', nodeCount: 20 }
      ]
    })

    expect(tasks[1].candidateTypes).toContain('content-feed')
  })
})
