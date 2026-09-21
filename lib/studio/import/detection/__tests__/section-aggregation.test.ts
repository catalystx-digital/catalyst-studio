import { aggregateSectionArtifacts } from '../section-aggregation'
import type { SectionExtractionArtifact } from '../section-aggregation'
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

  it('allows an empty required footer only when another section already has a valid footer', () => {
    const footerTasks: DetectionSectionTask[] = [
      { sectionKey: 'main:0-99', sectionOrder: 0, role: 'main', required: false, candidateTypes: ['text-block', 'footer'] },
      { sectionKey: 'footer', sectionOrder: 1, role: 'footer', required: true, candidateTypes: ['footer'] }
    ]
    const emptyFooterArtifact: SectionExtractionArtifact = {
      sectionKey: 'footer',
      sectionOrder: 1,
      components: [],
      requiredSectionEmpty: true
    }

    const components = aggregateSectionArtifacts(footerTasks, [
      {
        sectionKey: 'main:0-99',
        sectionOrder: 0,
        components: [
          { component: 'footer', type: 'footer' as any, confidence: 0.95, content: { columns: [] } }
        ]
      },
      emptyFooterArtifact
    ])

    expect(components.map(component => component.component)).toEqual(['footer'])
    expect(emptyFooterArtifact.satisfiedBySectionKey).toBe('main:0-99')
  })

  it('fails an empty required footer when no validated footer exists elsewhere on the page', () => {
    const footerTasks: DetectionSectionTask[] = [
      { sectionKey: 'main:0-99', sectionOrder: 0, role: 'main', required: false, candidateTypes: ['text-block'] },
      { sectionKey: 'footer', sectionOrder: 1, role: 'footer', required: true, candidateTypes: ['footer'] }
    ]

    expect(() =>
      aggregateSectionArtifacts(footerTasks, [
        {
          sectionKey: 'main:0-99',
          sectionOrder: 0,
          components: [{ component: 'text-block', type: 'text-block' as any, confidence: 0.9, content: { text: 'Body' } }]
        },
        {
          sectionKey: 'footer',
          sectionOrder: 1,
          components: [],
          requiredSectionEmpty: true
        }
      ])
    ).toThrow('Required section footer produced no components')
  })

  it('keeps the rest of the page when a required section failed to extract', () => {
    // On one site, the footer reply came back cut off and the header request
    // timed out, while the other sections had already produced components.
    // Losing those was the real defect — a page without its footer still imports.
    const footerTasks: DetectionSectionTask[] = [
      { sectionKey: 'main:0-99', sectionOrder: 0, role: 'main', required: false, candidateTypes: ['text-block'] },
      { sectionKey: 'footer', sectionOrder: 1, role: 'footer', required: true, candidateTypes: ['footer'] }
    ]

    const components = aggregateSectionArtifacts(footerTasks, [
      {
        sectionKey: 'main:0-99',
        sectionOrder: 0,
        components: [{ component: 'text-block', type: 'text-block' as any, confidence: 0.9, content: { text: 'Body' } }]
      },
      {
        sectionKey: 'footer',
        sectionOrder: 1,
        components: [],
        extractionFailed: true
      }
    ])

    expect(components.map(component => component.component)).toEqual(['text-block'])
  })
})


describe('block region requirements', () => {
  const blockTasks: DetectionSectionTask[] = [
    { sectionKey: 'block:1', sectionOrder: 0, role: 'header', required: true, candidateTypes: ['navbar'] },
    { sectionKey: 'block:2', sectionOrder: 1, role: 'header', required: true, candidateTypes: ['text-block'] },
    { sectionKey: 'block:3', sectionOrder: 2, role: 'main', required: false, candidateTypes: ['text-block'] },
    { sectionKey: 'block:4', sectionOrder: 3, role: 'footer', required: true, candidateTypes: ['text-block'] },
    { sectionKey: 'block:5', sectionOrder: 4, role: 'footer', required: true, candidateTypes: ['footer'] }
  ]
  const artifact = (order: number, type: string): SectionExtractionArtifact => ({
    sectionKey: 'block:' + order,
    sectionOrder: order - 1,
    components: [{ component: type, type: type as any, confidence: 0.9, content: {} }]
  })

  it('satisfies header and footer once per region while preserving every block', () => {
    const artifacts = [artifact(1, 'navbar'), artifact(2, 'text-block'), artifact(3, 'text-block'), artifact(4, 'text-block'), artifact(5, 'footer')]
    expect(aggregateSectionArtifacts(blockTasks, artifacts).map(component => component.type)).toEqual(['navbar', 'text-block', 'text-block', 'text-block', 'footer'])
    expect(artifacts[1].satisfiedBySectionKey).toBe('block:1')
    expect(artifacts[3].satisfiedBySectionKey).toBe('block:5')
    expect(artifacts[1].requiredSectionEmpty).toBeUndefined()
    expect(artifacts[3].requiredSectionEmpty).toBeUndefined()
  })

  it('still marks an empty block satisfied by another block in its region', () => {
    const empty = { ...artifact(2, 'text-block'), components: [] }
    aggregateSectionArtifacts(blockTasks, [artifact(1, 'navbar'), empty, artifact(3, 'text-block'), artifact(4, 'text-block'), artifact(5, 'footer')])
    expect(empty.requiredSectionEmpty).toBe(true)
    expect(empty.satisfiedBySectionKey).toBe('block:1')
  })

  it('does not satisfy a block region with components from a different region', () => {
    expect(() => aggregateSectionArtifacts(blockTasks, [
      artifact(1, 'text-block'), artifact(2, 'text-block'), artifact(3, 'navbar'), artifact(4, 'text-block'), artifact(5, 'footer')
    ])).toThrow('Required section block:1')
  })

  it('keeps surviving blocks when the required role extraction failed', () => {
    const failed = { sectionKey: 'block:1', sectionOrder: 0, components: [], extractionFailed: true }
    expect(aggregateSectionArtifacts(blockTasks, [failed, artifact(2, 'text-block'), artifact(3, 'text-block'), artifact(4, 'text-block'), artifact(5, 'footer')])).toHaveLength(4)
  })
})
