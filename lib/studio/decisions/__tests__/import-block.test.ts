/** @jest-environment node */
import { setDecisionClient } from '../index'
import type { DecisionClient } from '../types'
import { filterPageContentCandidateTypes } from '@/lib/studio/import/detection/candidate-types'
import { buildBlockInput } from '@/lib/studio/import/detection/blocks/block-input'
import { pickBlockTypes, selectBlockCandidates } from '@/lib/studio/import/detection/blocks/block-pick'
import { extractBackgroundImages } from '@/lib/studio/import/services/web-tools'
import manifest from '@/lib/studio/components/cms/_generated/component-manifest.json'

jest.mock('../shadow-log', () => ({ recordDecision: jest.fn() }))
jest.mock('@/lib/studio/components/cms/_factory/initialize', () => ({ initializeCMSComponents: jest.fn() }))

const originalEnv = { ...process.env }
const selected = ['text-block', 'hero-simple', 'card-grid']
let askRaw: jest.MockedFunction<DecisionClient['askRaw']>

function input(html = '<section><h2>Example heading</h2><p>Body copy</p></section>', repeatedChildren: Array<{ signature: string; count: number }> = []) {
  return {
    ...buildBlockInput({
      html,
      bgImageMap: extractBackgroundImages(html),
      block: {
        id: 'fixture', order: 1, region: 'main', anchorResolved: true, repeatedChildren,
        anchor: { path: [0], tag: 'section', id: '', classes: [] },
        box: { x: 0, y: 0, width: 1000, height: 500 }, children: [], oversized: false
      }
    }),
    url: 'https://example.com/workshop'
  }
}

function respond(probabilities: number[], multiple: number) {
  askRaw.mockImplementation(async (_state, questions) => {
    const component = questions[0]
    if (component.shape !== 'choice' || typeof component.criteria === 'function') throw new Error('Unresolved choice')
    const distribution = Object.fromEntries(Object.keys(component.criteria).map(type => [type, 0]))
    selected.forEach((type, index) => distribution[type] = probabilities[index])
    return {
      answers: {
        'import.block.component': { value: selected[0], probability: probabilities[0], confidence: 0.9, distribution },
        'import.block.multiple': { value: multiple, probability: multiple, confidence: null }
      },
      usage: { inputTokens: 100, outputTokens: 10, cost: 0, latencyMs: 1 }
    }
  })
}

beforeEach(() => {
  process.env.DECISION_MODEL_ENABLED = 'true'
  process.env.DECISION_MODEL_SHADOW = 'false'
  process.env.DECISION_MODEL_API_KEY = 'fake'
  delete process.env.DECISION_MODEL_WEBSITE_ALLOWLIST
  askRaw = jest.fn()
  setDecisionClient({ askRaw })
})
afterEach(() => {
  process.env = { ...originalEnv }
  setDecisionClient(null)
})

test.each([
  { probabilities: [0.6, 0.3, 0.1], multiple: 0.1, expected: selected.slice(0, 1) },
  { probabilities: [0.4, 0.35, 0.25], multiple: 0.1, expected: selected },
  { probabilities: [0.8, 0.15, 0.05], multiple: 0.5, expected: selected }
])('fixed allowed-types rule: $probabilities / multiple=$multiple', async ({ probabilities, multiple, expected }) => {
  respond(probabilities, multiple)
  const result = await pickBlockTypes(input())
  expect(result.allowedTypes).toEqual(expected)
  expect(result.source).toBe('model')
  expect(result.answer['import.block.component'].distribution?.['text-block']).toBe(probabilities[0])
  expect(askRaw).toHaveBeenCalledTimes(1)
  expect(askRaw.mock.calls[0][1].map(question => [question.id, question.version])).toEqual([
    ['import.block.component', 1], ['import.block.multiple', 1]
  ])
})

test('choice offers every page-level catalogue summary and no sub-components', async () => {
  respond([0.8, 0.15, 0.05], 0.1)
  await pickBlockTypes(input())
  const question = askRaw.mock.calls[0][1][0]
  const expected = filterPageContentCandidateTypes(manifest.components.map(component => component.type))
  expect(Object.keys(question.criteria)).toEqual(expected)
  expect(Object.keys(question.criteria)).not.toContain('card-item')
  for (const type of expected) {
    expect(question.criteria).toMatchObject({ [type]: [...new Set(manifest.components.filter(component => component.type === type).map(component => component.description))].join(' / ') })
  }
})

test('renders headings, counts, repetition, indentation and records truncation', async () => {
  respond([0.8, 0.15, 0.05], 0.1)
  const html = '<section><h2>Example heading</h2><img src="/photo.jpg" alt="Example"><a href="/visit">Visit</a><button>Go</button>' +
    '<div><p>First</p><p>Second</p></div><p>' + 'Long text '.repeat(30) + '</p>' +
    '<p>Repeated</p>'.repeat(1000) + '</section>'
  const result = await pickBlockTypes(input(html, [{ signature: 'div / p>', count: 2 }]))
  const state = askRaw.mock.calls[0][0]
  expect(state).toContain('1 images, 0 inline backgrounds, 1 links, 1 buttons, 1 headings.')
  expect(state).toContain('h2: Example heading')
  expect(state).toContain('Repeated child groups:')
  expect(state).toContain('"signature":"div / p>","count":2')
  expect(state).toContain('    p "First"')
  expect(state).toContain('[truncated]')
  expect(result.issues).toEqual(expect.arrayContaining([
    expect.stringContaining('Decision node text shortened'), expect.stringContaining('Decision evidence truncated')
  ]))
})

test('decision failure offers production candidates with an honest error source', async () => {
  askRaw.mockRejectedValue(new Error('Decision timeout'))
  const blockInput = input('<section><iframe src="https://www.youtube.com/embed/example"></iframe></section>')
  const result = await pickBlockTypes(blockInput)
  expect(result.allowedTypes).toEqual(selectBlockCandidates(blockInput, blockInput.url).allowedTypes)
  expect(result.allowedTypes).toContain('video-embed')
  expect(result.source).toBe('error')
  expect(result.answer['import.block.component']).toMatchObject({ source: 'error', probability: null, error: 'Decision timeout' })
  expect(result.issues).toContain('Production candidate selection used: Decision timeout')
})

test('shadow mode retains existing decisions behavior', async () => {
  process.env.DECISION_MODEL_SHADOW = 'true'
  respond([0.8, 0.15, 0.05], 0.1)
  const result = await pickBlockTypes(input())
  expect(result.source).toBe('shadow')
  expect(result.answer['import.block.component']).toMatchObject({ value: null, source: 'shadow', probability: null })
})


test('uses saved rendered repetition instead of counting static HTML', async () => {
  respond([0.8, 0.15, 0.05], 0.1)
  const repeated = [{ signature: 'section#grid / article>h3,p', count: 7 }]
  await pickBlockTypes(input('<section><p>Static copy</p><p>Another paragraph</p></section>', repeated))
  expect(askRaw.mock.calls[0][0]).toContain('Repeated child groups: ' + JSON.stringify(repeated))
  expect(askRaw.mock.calls[0][0]).not.toContain('section / p>')
})

test('records repeated truncation and indentation issues once', async () => {
  respond([0.8, 0.15, 0.05], 0.1)
  const html = '<section>' + '<div>'.repeat(10) + ('<p>' + 'x'.repeat(200) + '</p>').repeat(3) + '</div>'.repeat(10) + '</section>'
  const result = await pickBlockTypes(input(html))
  expect(result.issues.filter(issue => issue.includes('indentation capped'))).toHaveLength(1)
  expect(result.issues.filter(issue => issue.includes('node text shortened'))).toHaveLength(1)
  expect(result.issues.length).toBe(new Set(result.issues).size)
})
