import { aggregateSectionArtifacts } from '../section-aggregation'
import type { DetectionSectionTask } from '../section-plan'

const tasks: DetectionSectionTask[] = [
  { sectionKey: 'header', sectionOrder: 0, role: 'header', required: true, candidateTypes: ['navbar'] },
  { sectionKey: 'main:0-99', sectionOrder: 1, role: 'main', required: false, candidateTypes: ['text-block'] }
]

describe('aggregateSectionArtifacts', () => {
  it('preserves section order rather than artifact arrival order', () => {
    const components = aggregateSectionArtifacts(tasks, [
      {
        sectionKey: 'main:0-99',
        sectionOrder: 1,
        components: [{ component: 'text-block', type: 'text-block' as any, confidence: 0.9, content: { text: 'Body' } }]
      },
      {
        sectionKey: 'header',
        sectionOrder: 0,
        components: [{ component: 'navbar', type: 'navbar' as any, confidence: 0.9, content: { menuItems: [] } }]
      }
    ])

    expect(components.map(component => component.component)).toEqual(['navbar', 'text-block'])
  })

  it('fails when a required section artifact is missing', () => {
    expect(() => aggregateSectionArtifacts(tasks, [])).toThrow('Missing required section artifacts: header')
  })

  it('allows optional content slices to be empty or absent', () => {
    const components = aggregateSectionArtifacts(tasks, [
      {
        sectionKey: 'header',
        sectionOrder: 0,
        components: [{ component: 'navbar', type: 'navbar' as any, confidence: 0.9, content: { menuItems: [] } }]
      }
    ])

    expect(components.map(component => component.component)).toEqual(['navbar'])
  })
})
