/** @jest-environment node */
import { DetectionService } from '@/lib/studio/import/web-detection'
import { DetectionConfig } from '@/lib/studio/import/config'
import { setDecisionClient } from '@/lib/studio/decisions'
import { getWebFetchTools } from '@/lib/studio/import/services/web-tools'
import { createLLMClient } from '@/lib/studio/import/services/llm-client'
import { launchHeadlessChromium } from '@/lib/studio/design-system/dom-probe/launch-headless-chromium'
import { buildDetectionPromptFromCatalog } from '../prompt-builder'
import { GlobalSectionArtifactCache } from '../global-section-cache'
import type { Geometry } from './block-cutter'
import type { ImportDetectionOptions } from '../types'

jest.mock('@/lib/studio/design-system/dom-probe/launch-headless-chromium', () => ({ launchHeadlessChromium: jest.fn() }))
jest.mock('@/lib/studio/decisions/shadow-log', () => ({ recordDecision: jest.fn() }))
jest.mock('@/lib/studio/components/cms/_factory/initialize', () => ({ initializeCMSComponents: jest.fn() }))
jest.mock('@/lib/studio/components/cms/_import/detection-api', () => ({ detectionAPI: { getRegistryStats: () => ({ componentCount: 50 }) } }))
jest.mock('@/lib/studio/import/openrouter-models', () => ({
  getModelMaxCompletionTokens: jest.fn(async () => 8000),
  getReasoningConfig: jest.fn(async () => undefined),
  calculateCost: jest.fn(async () => 0)
}))
jest.mock('@/lib/studio/import/services/llm-client', () => ({
  ...jest.requireActual('@/lib/studio/import/services/llm-client'),
  createLLMClient: jest.fn()
}))
jest.mock('../prompt-builder', () => ({
  buildDetectionPromptFromCatalog: jest.fn(async ({ candidateTypes }: { candidateTypes?: string[] }) => ({
    prompt: 'Fixture contracts: ' + (candidateTypes || []).join(', '),
    components: (candidateTypes || ['text-block']).map(type => ({ type, confidence: 0.9 })),
    pageSummary: {
      templates: [{ templateKey: 'core/generic-default', name: 'Generic', category: 'core', requiredRegions: [{ region: 'main', allowedComponents: ['text-block'] }], optionalRegions: [{ region: 'header', allowedComponents: ['navbar'] }, { region: 'footer', allowedComponents: ['footer'] }] }],
      homeEligibleTemplates: []
    }
  }))
}))

const html = '<html><head><title>Fixture page</title><meta name="description" content="Fixture description">' +
  '<style>body{color:#123456}</style></head><body>' +
  '<header><nav><a href="/">Home</a></nav></header><header><p>Notice</p></header>' +
  '<main><section><h1>First</h1><p>First body</p></section><section><h2>Second</h2><p>Second body</p></section></main>' +
  '<footer><p>Copyright Example</p></footer></body></html>'
const url = 'https://example.com/workshop'
const originalEnv = { ...process.env }
const originalConfig = { ...DetectionConfig }
const originalFetch = global.fetch
let fill: jest.Mock
let decision: jest.Mock
let close: jest.Mock
let checkpoints: Map<string, any>
let checkpointService: any
let failureMode: 'none' | 'recover' | 'drop' | 'all' | 'empty' | 'decision' = 'none'
let attempts: Map<string, number>

function geometry(tag: string, anchorKey: string, y: number, height: number, children: Geometry[] = []): Geometry {
  return {
    key: anchorKey, tag, anchorKey, region: 'main',
    box: { x: 0, y, width: 1440, height }, visible: true, meaningful: true,
    ownTextLength: children.length ? 0 : 20, children
  }
}

function browser(styling = { declared: 1, applied: 1 }) {
  const tree = geometry('body', 'body', 0, 2200, [
    geometry('header', '0', 0, 150),
    geometry('header', '1', 180, 150),
    geometry('main', '2', 400, 1600, [geometry('section', '2.0', 400, 800), geometry('section', '2.1', 1200, 800)]),
    geometry('footer', '3', 2000, 200)
  ])
  const page = {
    on: jest.fn(), route: jest.fn(), goto: jest.fn(), waitForTimeout: jest.fn(),
    evaluate: jest.fn(async (fn: Function) => {
      if (fn.toString().includes('ownTextLength')) return { tree, ...styling }
      if (fn.toString().includes('scrollHeight')) return 1000
    })
  }
  close = jest.fn()
  jest.mocked(launchHeadlessChromium).mockResolvedValue({
    newContext: async () => ({ newPage: async () => page }), close
  } as any)
}

function response(key: string, component: string, content: object) {
  return {
    choices: [{ finish_reason: 'stop', message: { content: JSON.stringify({ sectionKey: key, components: [{ component, confidence: 0.95, content }] }) } }],
    usage: { total_tokens: 15, prompt_tokens: 10, completion_tokens: 5, total_cost: 0.001 }
  }
}

beforeEach(() => {
  jest.clearAllMocks()
  process.env.DECISION_MODEL_ENABLED = 'true'
  process.env.DECISION_MODEL_SHADOW = 'false'
  process.env.DECISION_MODEL_API_KEY = 'fake'
  delete process.env.DECISION_MODEL_WEBSITE_ALLOWLIST
  DetectionConfig.detectionHarness = 'blocks'
  DetectionConfig.blockConcurrency = 2
  failureMode = 'none'
  attempts = new Map()
  checkpoints = new Map()
  checkpointService = {
    loadSectionResult: jest.fn(async (_session, _url, key) => checkpoints.get(key)),
    saveSectionResult: jest.fn(async (_session, pageUrl, key, order, components, durationMs, pageMetadata, llmDebug) => {
      checkpoints.set(key, { url: pageUrl, sectionKey: key, sectionOrder: order, components, durationMs, pageMetadata, llmDebug })
    }),
    loadSectionError: jest.fn(async () => null),
    saveSectionError: jest.fn(async () => undefined),
    savePagePlan: jest.fn(async () => undefined),
    saveAssembledPage: jest.fn(async () => undefined),
    loadSitemap: jest.fn(async () => null)
  }
  global.fetch = jest.fn(async () => new Response(html, { headers: { 'content-type': 'text/html' } }))
  let now = 0
  jest.spyOn(Date, 'now').mockImplementation(() => now += 1000)
  browser()
  decision = jest.fn(async (state, questions) => {
    if (questions[0].id !== 'import.block.component') throw new Error('Use existing page-question fallback')
    if (failureMode === 'decision' && state.startsWith('Block 3;')) throw new Error('Decision timeout')
    const order = Number(state.match(/^Block (\d+)/)[1])
    const picked = order === 1 ? 'navbar' : order === 5 ? 'footer' : 'text-block'
    const distribution = Object.fromEntries(Object.keys(questions[0].criteria).map(type => [type, type === picked ? 1 : 0]))
    return {
      answers: {
        'import.block.component': { value: picked, probability: 1, confidence: 1, distribution },
        'import.block.multiple': { value: 0.1, probability: 0.1, confidence: null }
      },
      usage: { inputTokens: 10, outputTokens: 5, cost: 0, latencyMs: 1 }
    }
  })
  setDecisionClient({ askRaw: decision })
  fill = jest.fn(async payload => {
    const user = payload.messages.find((message: any) => message.role === 'user').content
    const input = JSON.parse(user.slice(user.indexOf('\n{') + 1))
    const key = input.sectionKey
    const attempt = (attempts.get(key) || 0) + 1
    attempts.set(key, attempt)
    if (failureMode === 'all' || (failureMode === 'drop' && key === 'block:3') ||
      (failureMode === 'recover' && key === 'block:3' && attempt === 1)) {
      throw Object.assign(new Error('Fixture timeout'), { name: 'APIConnectionTimeoutError' })
    }
    if (failureMode === 'recover' && key === 'block:4' && attempt === 1) {
      return { choices: [{ finish_reason: 'length', message: { content: '{"sectionKey":"block:4","components":[' } }] }
    }
    if (failureMode === 'empty') {
      return { choices: [{ finish_reason: 'stop', message: { content: JSON.stringify({ sectionKey: key, components: [] }) } }] }
    }
    return key === 'block:1'
      ? response(key, 'navbar', { menuItems: [{ label: 'Home', href: '/' }] })
      : key === 'block:5'
        ? response(key, 'footer', { copyright: 'Copyright Example' })
        : response(key, 'text-block', { text: input.nodes.map((node: any) => node.text || '').join(' ') })
  })
  jest.mocked(createLLMClient).mockReturnValue({ chat: { completions: { create: fill } } } as any)
})

afterEach(() => {
  process.env = { ...originalEnv }
  Object.assign(DetectionConfig, originalConfig)
  global.fetch = originalFetch
  setDecisionClient(null)
  getWebFetchTools().clearCache()
  jest.restoreAllMocks()
})

function detect(extra: ImportDetectionOptions = {}, pageUrl = url) {
  return new DetectionService().detectComponentsFromUrl(pageUrl, { checkpointSession: {} as any, checkpointService, ...extra })
}

test('fixture imports in block order with regional header roles and head metadata', async () => {
  const onProgress = jest.fn()
  const result = await detect({ onProgress })
  expect(result.detectionHarness).toBe('blocks')
  expect(result.components.map(component => component.type)).toEqual(['navbar', 'text-block', 'text-block', 'text-block', 'footer'])
  expect(result.pageMetadata).toMatchObject({ title: 'Fixture page', description: 'Fixture description' })
  expect(result.pageTemplate?.templateKey).toBe('core/generic-default')
  expect(result.modelUsed).toBe('inception/mercury-2.5')
  expect(result.tokenUsage).toBe(75)
  expect(checkpointService.savePagePlan.mock.calls[0][2].sections.map((task: any) => [task.sectionKey, task.role])).toEqual([
    ['block:1', 'header'], ['block:2', 'header'], ['block:3', 'main'], ['block:4', 'main'], ['block:5', 'footer']
  ])
  expect(checkpointService.saveSectionResult).toHaveBeenCalledTimes(5)
  expect(checkpoints.get('block:2').llmDebug.requiredSectionEmpty).toBeUndefined()
  expect(checkpoints.get('block:2').llmDebug.blockPick).toEqual({
    allowedTypes: ['text-block'], source: 'model',
    topChoices: { component: 'text-block', multiple: false }, issues: []
  })
  expect(fill.mock.calls[0][0].messages[2].content).toContain('Page outline: 1 header navbar; 2 header text-block; 3 main text-block; 4 main text-block; 5 footer footer')
  expect(buildDetectionPromptFromCatalog).toHaveBeenCalledWith(expect.objectContaining({ candidateTypes: ['text-block'] }))
  expect(onProgress).toHaveBeenCalledWith(expect.objectContaining({ message: 'Processed block 5 of 5' }))
  expect(close).toHaveBeenCalledTimes(1)
})

test('one timed-out call and one cut-off reply are retried unchanged and recover', async () => {
  failureMode = 'recover'
  const result = await detect()
  expect(result.components).toHaveLength(5)
  for (const key of ['block:3', 'block:4']) {
    const calls = fill.mock.calls.filter(([payload]) => payload.messages[2].content.includes('"sectionKey":"' + key + '"'))
    expect(calls).toHaveLength(2)
    expect(calls[0][0]).toEqual(calls[1][0])
    expect(calls[0][1]).toMatchObject({ maxRetries: 0, signal: expect.any(AbortSignal) })
  }
})

test('exhausted block is checkpointed as an error and dropped with a page diagnostic', async () => {
  failureMode = 'drop'
  const result = await detect()
  expect(result.components).toHaveLength(4)
  expect(attempts.get('block:3')).toBe(3)
  expect(checkpointService.saveSectionError.mock.calls[0][2]).toBe('block:3')
  expect(result.diagnostics).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'SECTION_EXTRACTION_DROPPED', context: { sections: [expect.objectContaining({ sectionKey: 'block:3', reason: 'Fixture timeout' })] } })]))
})

test.each(['all', 'empty'] as const)('zero surviving components fails: %s', async mode => {
  failureMode = mode
  await expect(detect()).rejects.toThrow(mode === 'all' ? 'Fixture timeout' : 'produced no components')
  expect(checkpointService.saveAssembledPage).not.toHaveBeenCalled()
})

test('decision failure offers production candidates and persists its source', async () => {
  failureMode = 'decision'
  await detect()
  const pick = checkpoints.get('block:3').llmDebug.blockPick
  expect(pick.source).toBe('error')
  expect(pick.allowedTypes).toContain('text-block')
  expect(pick.allowedTypes.length).toBeGreaterThan(3)
  expect(pick.issues).toContain('Production candidate selection used: Decision timeout')
  expect(pick).not.toHaveProperty('answer')
  for (const [payload] of fill.mock.calls) {
    expect(payload.messages[2].content).toContain('3 main unavailable; 4 main text-block')
  }
})

test.each([['false', 'false'], ['true', 'true']])('disabled/shadow decisions fail before work: %s / %s', async (enabled, shadow) => {
  process.env.DECISION_MODEL_ENABLED = enabled
  process.env.DECISION_MODEL_SHADOW = shadow
  await expect(detect()).rejects.toThrow('DECISION_MODEL_ENABLED=true and DECISION_MODEL_SHADOW=false')
  expect(global.fetch).not.toHaveBeenCalled()
  expect(launchHeadlessChromium).not.toHaveBeenCalled()
  expect(fill).not.toHaveBeenCalled()
})

test.each(['launch', 'unstyled'])('cut failure fails the page with the cutter diagnostic: %s', async mode => {
  if (mode === 'launch') jest.mocked(launchHeadlessChromium).mockRejectedValue(new Error('Executable unavailable'))
  else browser({ declared: 1, applied: 0 })
  await expect(detect()).rejects.toMatchObject({
    message: expect.stringContaining(mode === 'launch' ? 'Chromium could not start. Executable unavailable' : 'no styling was applied'),
    debug: expect.objectContaining({ stage: 'fetch', validationPath: 'blocks.render' })
  })
  expect(fill).not.toHaveBeenCalled()
  if (mode === 'unstyled') expect(close).toHaveBeenCalledTimes(1)
})

test('resume skips both pick and fill for checkpointed blocks after interruption', async () => {
  DetectionConfig.blockConcurrency = 1
  await expect(detect({ onProgress: progress => {
    if (progress.message === 'Processed block 2 of 5') throw new Error('Interrupted fixture')
  } })).rejects.toThrow('Interrupted fixture')
  expect([...checkpoints.keys()]).toEqual(['block:1', 'block:2'])
  fill.mockClear()
  decision.mockClear()
  const result = await detect()
  expect(result.components).toHaveLength(5)
  expect(fill).toHaveBeenCalledTimes(3)
  expect(fill.mock.calls[0][0].messages[2].content).toContain('1 header navbar; 2 header text-block')
  expect(checkpointService.saveSectionResult).toHaveBeenCalledTimes(5)
  expect(decision.mock.calls.filter(([, questions]) => questions[0].id === 'import.block.component')).toHaveLength(3)
})

test('header and footer use the same per-import reuse cache across pages', async () => {
  const globalSectionCache = new GlobalSectionArtifactCache()
  await detect({ globalSectionCache })
  checkpoints.clear()
  fill.mockClear()
  const result = await detect({ globalSectionCache }, 'https://example.com/another')
  expect(result.components).toHaveLength(5)
  expect(attempts.get('block:1')).toBe(1)
  expect(attempts.get('block:5')).toBe(1)
  expect(fill).toHaveBeenCalledTimes(3)
})


test('finishes picking before filling and limits concurrent block extractions', async () => {
  const perform = fill.getMockImplementation()!
  let active = 0
  let peak = 0
  fill.mockImplementation(async (...args) => {
    expect(decision.mock.calls.filter(([, questions]) => questions[0].id === 'import.block.component')).toHaveLength(5)
    active++
    peak = Math.max(peak, active)
    try {
      await new Promise(resolve => setTimeout(resolve, 0))
      return await perform(...args)
    } finally {
      active--
    }
  })
  await detect()
  expect(peak).toBe(2)
  expect(active).toBe(0)
})


test('rejects block counts over the section task cap before any model calls', async () => {
  DetectionConfig.maxSectionTasks = 4
  await expect(detect()).rejects.toMatchObject({
    message: expect.stringContaining('Detection outline returned 5 blocks, exceeding the per-page limit of 4'),
    debug: { stage: 'budget', validationPath: 'outline.blocks', requestCount: 0, skippedSectionsDueToBudget: ['block:5'] }
  })
  expect(decision).not.toHaveBeenCalled()
  expect(fill).not.toHaveBeenCalled()
  expect(checkpointService.savePagePlan).not.toHaveBeenCalled()
  expect(checkpointService.saveSectionResult).not.toHaveBeenCalled()
})

test('allows exactly the section task cap', async () => {
  DetectionConfig.maxSectionTasks = 5
  expect((await detect()).components).toHaveLength(5)
})
