import {
  buildFillBatches,
  buildPageMap,
  parseComponentPlanResponse,
  parseFillBatchResponse
} from '../page-map-harness'
import type { ComponentPattern } from '../types'
import type { DetectionSectionTask } from '../section-plan'

const components: ComponentPattern[] = [
  { type: 'hero-with-image', confidence: 0.9 },
  { type: 'card-grid', confidence: 0.8 },
  { type: 'text-block', confidence: 0.8 }
]

const tasks: DetectionSectionTask[] = [
  {
    sectionKey: 'main:0-99',
    sectionOrder: 0,
    role: 'hero',
    required: false,
    candidateTypes: ['hero-with-image', 'text-block']
  },
  {
    sectionKey: 'main:100-199',
    sectionOrder: 1,
    role: 'main',
    required: false,
    candidateTypes: ['card-grid', 'text-block']
  }
]

describe('page-map harness', () => {
  it('builds compact source packets while preserving extraction evidence', async () => {
    const pageMap = await buildPageMap({
      url: 'https://example.com',
      tasks: [tasks[0]],
      getSection: async () => ({
        handle: 'h',
        key: 'main:0-99',
        slice: [
          {
            tag: 'article',
            pathId: 'n1',
            class: 'decorative '.repeat(40),
            attrs: { href: '/story', title: 'Story', 'data-track': 'discard '.repeat(40) },
            text: '  Story heading  ',
            children: [
              { tag: 'img', pathId: 'n2', attrs: { src: '/image.jpg', alt: 'Story image', width: '1200' } }
            ]
          }
        ],
        stats: { nodeCount: 1, approxBytes: 300 }
      })
    })

    expect(pageMap.sections[0].packets).toEqual([
      expect.objectContaining({
        id: 's0#0',
        pathId: 'n1',
        tag: 'article',
        text: 'Story heading',
        attrs: { href: '/story', title: 'Story' },
        children: [
          expect.objectContaining({
            id: 's0#0.0',
            pathId: 'n2',
            attrs: { src: '/image.jpg', alt: 'Story image' }
          })
        ]
      })
    ])
    expect(pageMap.packetBytes).toBeLessThan(pageMap.originalBytes)
  })

  it('strictly parses component plans with exact sections and evidence refs', async () => {
    const pageMap = await buildPageMap({
      url: 'https://example.com',
      tasks: [tasks[0]],
      getSection: async () => ({
        handle: 'h',
        key: 'main:0-99',
        slice: [{ tag: 'h1', pathId: 'n1', text: 'Hero' }],
        stats: { nodeCount: 1, approxBytes: 100 }
      })
    })

    const plan = parseComponentPlanResponse({
      rawResponse: JSON.stringify({
        sections: [
          {
            sectionKey: 'main:0-99',
            plannedComponents: [
              {
                plannedComponentId: 'main:0-99:0',
                component: 'hero-with-image',
                confidence: 0.9,
                evidenceRefs: ['s0#0', 'n1']
              }
            ]
          }
        ]
      }),
      pageMap,
      plannedSectionKeys: ['main:0-99'],
      availableComponents: components
    })

    expect(plan.sections[0].plannedComponents[0].plannedComponentId).toBe('main:0-99:0')
    const planWithExtraEvidence = parseComponentPlanResponse({
      rawResponse: JSON.stringify({
        sections: [
          {
            sectionKey: 'main:0-99',
            plannedComponents: [
              {
                plannedComponentId: 'main:0-99:0',
                component: 'hero-with-image',
                confidence: 0.9,
                evidenceRefs: ['s0#0', 's1#0']
              }
            ]
          }
        ]
      }),
      pageMap,
      plannedSectionKeys: ['main:0-99'],
      availableComponents: components
    })

    expect(planWithExtraEvidence.sections[0].plannedComponents[0].evidenceRefs).toEqual(['s0#0'])
    expect(() =>
      parseComponentPlanResponse({
        rawResponse: JSON.stringify({
          sections: [
            {
              sectionKey: 'main:0-99',
              plannedComponents: [
                {
                  plannedComponentId: 'main:0-99:0',
                  component: 'hero-with-image',
                  confidence: 0.9,
                  evidenceRefs: ['missing']
                }
              ]
            }
          ]
        }),
        pageMap,
        plannedSectionKeys: ['main:0-99'],
        availableComponents: components
      })
    ).toThrow('no supported evidence refs')
  })

  it('plans fill batches by order, section count, and token budget', async () => {
    const pageMap = await buildPageMap({
      url: 'https://example.com',
      tasks,
      getSection: async task => ({
        handle: 'h',
        key: task.sectionKey,
        slice: [{ tag: 'p', pathId: task.sectionKey, text: task.sectionKey }],
        stats: { nodeCount: 1, approxBytes: 100 }
      })
    })
    const plan = parseComponentPlanResponse({
      rawResponse: JSON.stringify({
        sections: [
          {
            sectionKey: 'main:0-99',
            plannedComponents: [{ plannedComponentId: 'a', component: 'hero-with-image', confidence: 0.9, evidenceRefs: ['s0#0'] }]
          },
          {
            sectionKey: 'main:100-199',
            plannedComponents: [{ plannedComponentId: 'b', component: 'card-grid', confidence: 0.9, evidenceRefs: ['s1#0'] }]
          }
        ]
      }),
      pageMap,
      plannedSectionKeys: ['main:0-99', 'main:100-199'],
      availableComponents: components
    })

    const batches = buildFillBatches({
      pageMap,
      plan,
      maxPromptTokens: 100000,
      maxSections: 1,
      maxComponents: 10,
      estimateTokens: () => 1
    })

    expect(batches.map(batch => batch.sectionKeys)).toEqual([['main:0-99'], ['main:100-199']])
  })

  it('splits fill batches by planned component count', async () => {
    const pageMap = await buildPageMap({
      url: 'https://example.com',
      tasks,
      getSection: async task => ({
        handle: 'h',
        key: task.sectionKey,
        slice: [{ tag: 'p', pathId: task.sectionKey, text: task.sectionKey }],
        stats: { nodeCount: 1, approxBytes: 100 }
      })
    })
    const plan = parseComponentPlanResponse({
      rawResponse: JSON.stringify({
        sections: [
          {
            sectionKey: 'main:0-99',
            plannedComponents: [
              { plannedComponentId: 'a', component: 'hero-with-image', confidence: 0.9, evidenceRefs: ['s0#0'] },
              { plannedComponentId: 'b', component: 'text-block', confidence: 0.9, evidenceRefs: ['s0#0'] }
            ]
          },
          {
            sectionKey: 'main:100-199',
            plannedComponents: [
              { plannedComponentId: 'c', component: 'card-grid', confidence: 0.9, evidenceRefs: ['s1#0'] },
              { plannedComponentId: 'd', component: 'text-block', confidence: 0.9, evidenceRefs: ['s1#0'] }
            ]
          }
        ]
      }),
      pageMap,
      plannedSectionKeys: ['main:0-99', 'main:100-199'],
      availableComponents: components
    })

    const batches = buildFillBatches({
      pageMap,
      plan,
      maxPromptTokens: 100000,
      maxSections: 4,
      maxComponents: 3,
      estimateTokens: () => 1
    })

    expect(batches.map(batch => batch.sectionKeys)).toEqual([['main:0-99'], ['main:100-199']])
  })

  it('strictly parses fill batches by planned component id and component type', async () => {
    const pageMap = await buildPageMap({
      url: 'https://example.com',
      tasks: [tasks[0]],
      getSection: async () => ({
        handle: 'h',
        key: 'main:0-99',
        slice: [{ tag: 'h1', pathId: 'n1', text: 'Hero' }],
        stats: { nodeCount: 1, approxBytes: 100 }
      })
    })
    const plan = parseComponentPlanResponse({
      rawResponse: JSON.stringify({
        sections: [
          {
            sectionKey: 'main:0-99',
            plannedComponents: [{ plannedComponentId: 'main:0-99:0', component: 'hero-with-image', confidence: 0.9, evidenceRefs: ['s0#0'] }]
          }
        ]
      }),
      pageMap,
      plannedSectionKeys: ['main:0-99'],
      availableComponents: components
    })
    const batch = buildFillBatches({
      pageMap,
      plan,
      maxPromptTokens: 100000,
      maxSections: 4,
      maxComponents: 10,
      estimateTokens: () => 1
    })[0]

    const parsed = parseFillBatchResponse({
      rawResponse: JSON.stringify({
        sections: [
          {
            sectionKey: 'main:0-99',
            components: [
              { plannedComponentId: 'main:0-99:0', component: 'hero-with-image', confidence: 0.9, content: { heading: 'Hero' } }
            ]
          }
        ]
      }),
      batch,
      plan,
      pageMap,
      availableComponents: components,
      url: 'https://example.com',
      confidenceThreshold: 0.1
    })

    expect(parsed.artifacts[0].components[0].type).toBe('hero-with-image')
    const withoutIds = parseFillBatchResponse({
      rawResponse: JSON.stringify({
        sections: [
          {
            sectionKey: 'main:0-99',
            components: [
              { component: 'hero-with-image', confidence: 0.9, content: { heading: 'Hero' } }
            ]
          }
        ]
      }),
      batch,
      plan,
      pageMap,
      availableComponents: components,
      url: 'https://example.com',
      confidenceThreshold: 0.1
    })

    expect(withoutIds.artifacts[0].components[0].type).toBe('hero-with-image')
    expect(() =>
      parseFillBatchResponse({
        rawResponse: JSON.stringify({
          sections: [
            {
              sectionKey: 'fill:0',
              components: [
                { plannedComponentId: 'main:0-99:0', component: 'hero-with-image', confidence: 0.9, content: { heading: 'Hero' } }
              ]
            }
          ]
        }),
        batch,
        plan,
        pageMap,
        availableComponents: components,
        url: 'https://example.com',
        confidenceThreshold: 0.1
      })
    ).toThrow('not planned for this batch')
    expect(() =>
      parseFillBatchResponse({
        rawResponse: JSON.stringify({
          sections: [
            { sectionKey: 'unexpected', components: [] },
            {
              sectionKey: 'main:0-99',
              components: [
                { plannedComponentId: 'main:0-99:0', component: 'hero-with-image', confidence: 0.9, content: { heading: 'Hero' } }
              ]
            }
          ]
        }),
        batch,
        plan,
        pageMap,
        availableComponents: components,
        url: 'https://example.com',
        confidenceThreshold: 0.1
      })
    ).toThrow('not planned for this batch')
    expect(() =>
      parseFillBatchResponse({
        rawResponse: JSON.stringify({
          sections: [
            {
              sectionKey: 'main:0-99',
              components: [
                { plannedComponentId: 'main:0-99:0', component: 'card-grid', confidence: 0.9, content: { cards: [] } }
              ]
            }
          ]
        }),
        batch,
        plan,
        pageMap,
        availableComponents: components,
        url: 'https://example.com',
        confidenceThreshold: 0.1
      })
    ).toThrow('changed component type')
  })
})
