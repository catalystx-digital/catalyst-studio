import {
  buildFillBatches,
  buildPageMap,
  buildScopedSourcePackets,
  parseComponentPlanResponse,
  parseFillBatchResponse
} from '../page-map-harness'
import type { ComponentPattern } from '../types'
import type { DetectionSectionTask } from '../section-plan'

const components: ComponentPattern[] = [
  { type: 'hero-with-image', confidence: 0.9 },
  { type: 'card-grid', confidence: 0.8 },
  { type: 'logo-cloud', confidence: 0.8 },
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
            bgColor: '#6f8434',
            bgImage: 'url(/hero.jpg)',
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
        bgColor: '#6f8434',
        bgImage: 'url(/hero.jpg)',
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
      evidenceSiblingWindow: 1,
      estimateTokens: () => 1
    })

    expect(batches.map(batch => batch.sectionKeys)).toEqual([['main:0-99'], ['main:100-199']])
    expect(batches[0].splitReason).toBe('section_limit')
    expect(batches[1].splitReason).toBe('end')
    expect(batches[0].scopedPacketBytes).toBeLessThanOrEqual(batches[0].originalPacketBytes)
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
      evidenceSiblingWindow: 1,
      estimateTokens: () => 1
    })

    expect(batches.map(batch => batch.sectionKeys)).toEqual([['main:0-99'], ['main:100-199']])
    expect(batches[0].splitReason).toBe('component_limit')
    expect(batches[1].splitReason).toBe('end')
  })

  it('fails fill batching when one section exceeds component or token limits', async () => {
    const pageMap = await buildPageMap({
      url: 'https://example.com',
      tasks: [tasks[0]],
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
          }
        ]
      }),
      pageMap,
      plannedSectionKeys: ['main:0-99'],
      availableComponents: components
    })

    expect(() =>
      buildFillBatches({
        pageMap,
        plan,
        maxPromptTokens: 100000,
        maxSections: 4,
        maxComponents: 1,
        evidenceSiblingWindow: 1,
        estimateTokens: () => 1
      })
    ).toThrow('exceeding maxComponents')

    expect(() =>
      buildFillBatches({
        pageMap,
        plan,
        maxPromptTokens: 1,
        maxSections: 4,
        maxComponents: 10,
        evidenceSiblingWindow: 1,
        estimateTokens: () => 2
      })
    ).toThrow('exceeding maxPromptTokens')
  })

  it('builds scoped source packets from evidence refs, ancestors, children, and sibling window', () => {
    const section = {
      sectionKey: 'main:0-99',
      sectionOrder: 0,
      role: 'main' as const,
      required: false,
      candidateTypes: ['card-grid'],
      stats: { nodeCount: 5, approxBytes: 500 },
      sourceHash: 'hash',
      packets: [
        { id: 's0#0', pathId: 'before', tag: 'p', text: 'Before' },
        {
          id: 's0#1',
          pathId: 'card-list',
          tag: 'section',
          text: 'Cards',
          children: [
            { id: 's0#1.0', pathId: 'card-a', tag: 'a', attrs: { href: '/a' }, text: 'Card A' },
            { id: 's0#1.1', pathId: 'card-b', tag: 'a', attrs: { href: '/b' }, text: 'Card B' }
          ]
        },
        { id: 's0#2', pathId: 'after', tag: 'p', text: 'After' },
        { id: 's0#3', pathId: 'unrelated', tag: 'p', text: 'Unrelated' }
      ]
    }

    const scoped = buildScopedSourcePackets({
      section,
      plannedComponents: [{ plannedComponentId: 'cards', component: 'card-grid', confidence: 0.9, evidenceRefs: ['card-a'] }],
      siblingWindow: 1
    })

    expect(scoped.map(packet => packet.pathId)).toEqual(['before', 'card-list', 'after'])
    expect(scoped[1].children?.map(packet => packet.pathId)).toEqual(['card-a', 'card-b'])
    expect(JSON.stringify(scoped)).not.toContain('Unrelated')
  })

  it('fails scoped source packet construction when planned evidence cannot be resolved', () => {
    expect(() =>
      buildScopedSourcePackets({
        section: {
          sectionKey: 'main:0-99',
          sectionOrder: 0,
          role: 'main',
          required: false,
          candidateTypes: ['text-block'],
          stats: { nodeCount: 1, approxBytes: 100 },
          sourceHash: 'hash',
          packets: [{ id: 's0#0', pathId: 'known', tag: 'p', text: 'Known' }]
        },
        plannedComponents: [{ plannedComponentId: 'copy', component: 'text-block', confidence: 0.9, evidenceRefs: ['missing'] }],
        siblingWindow: 1
      })
    ).toThrow('no usable scoped evidence')
  })

  it('does not include unrelated descendants just because an ancestor is needed', () => {
    const section = {
      sectionKey: 'main:0-99',
      sectionOrder: 0,
      role: 'main' as const,
      required: false,
      candidateTypes: ['text-block'],
      stats: { nodeCount: 5, approxBytes: 500 },
      sourceHash: 'hash',
      packets: [
        {
          id: 's0#0',
          pathId: 'container',
          tag: 'section',
          text: 'Container',
          children: [
            { id: 's0#0.0', pathId: 'target', tag: 'p', text: 'Target' },
            { id: 's0#0.1', pathId: 'unrelated-child', tag: 'p', text: 'Unrelated child' }
          ]
        }
      ]
    }

    const scoped = buildScopedSourcePackets({
      section,
      plannedComponents: [{ plannedComponentId: 'copy', component: 'text-block', confidence: 0.9, evidenceRefs: ['target'] }],
      siblingWindow: 0
    })

    expect(scoped[0].children?.map(packet => packet.pathId)).toEqual(['target'])
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
      evidenceSiblingWindow: 1,
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
    expect(() =>
      parseFillBatchResponse({
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
    ).toThrow('plannedComponentId is not planned')
    expect(() =>
      parseFillBatchResponse({
        rawResponse: JSON.stringify({
          sections: [
            {
              sectionKey: 'main:0-99',
              components: [
                { plannedComponentId: 'main:0-99:0', component: 'hero-with-image', confidence: 0.9, content: { heading: 'Hero' } }
              ]
            },
            {
              sectionKey: 'main:0-99',
              components: []
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
    ).toThrow('duplicated')
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

  it('parses logo-cloud content during fill parsing', async () => {
    const pageMap = await buildPageMap({
      url: 'https://example.com',
      tasks: [{ ...tasks[0], candidateTypes: ['logo-cloud'] }],
      getSection: async () => ({
        handle: 'h',
        key: 'main:0-99',
        slice: [
          {
            tag: 'section',
            pathId: 'logos',
            text: 'Trusted by',
            children: [
              { tag: 'img', pathId: 'logo-a', attrs: { src: 'https://example.com/a.svg', alt: 'Company A' } }
            ]
          }
        ],
        stats: { nodeCount: 2, approxBytes: 200 }
      })
    })
    const plan = parseComponentPlanResponse({
      rawResponse: JSON.stringify({
        sections: [
          {
            sectionKey: 'main:0-99',
            plannedComponents: [{ plannedComponentId: 'main:0-99:logos', component: 'logo-cloud', confidence: 0.9, evidenceRefs: ['logos'] }]
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
      maxSections: 1,
      maxComponents: 6,
      evidenceSiblingWindow: 1,
      estimateTokens: () => 1
    })[0]

    const valid = parseFillBatchResponse({
      rawResponse: JSON.stringify({
        sections: [
          {
            sectionKey: 'main:0-99',
            components: [
              {
                plannedComponentId: 'main:0-99:logos',
                component: 'logo-cloud',
                confidence: 0.9,
                content: {
                  logos: [
                    {
                      id: 'company-a',
                      src: { mediaId: 'detected:company-a', mediaType: 'image', url: 'https://example.com/a.svg' },
                      alt: 'Company A',
                      originalUrl: 'https://example.com/a.svg'
                    }
                  ]
                }
              }
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

    expect(valid.artifacts[0].components[0].type).toBe('logo-cloud')
    expect(valid.artifacts[0].components[0].content.logos).toEqual([
      expect.objectContaining({ id: 'company-a', alt: 'Company A' })
    ])
  })
})
