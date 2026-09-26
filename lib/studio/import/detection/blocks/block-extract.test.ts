/** @jest-environment node */
import { APIError } from 'openai'
import { extractBlock } from './block-extract'
import { buildBlockInput } from './block-input'
import { selectBlockCandidates } from './block-pick'
import { extractBackgroundImages } from '@/lib/studio/import/services/web-tools'
import { createDetectionTelemetry } from '@/lib/studio/import/telemetry/detection-telemetry'

jest.mock('@/lib/studio/components/cms/_factory/initialize', () => ({ initializeCMSComponents: jest.fn() }))
jest.mock('@/lib/studio/import/openrouter-models', () => ({ getReasoningConfig: jest.fn(async () => undefined) }))
jest.mock('../prompt-builder', () => ({
  buildDetectionPromptFromCatalog: jest.fn(async ({ candidateTypes }) => ({
    prompt: 'Fixture contracts',
    components: (candidateTypes || []).map((type: string) => ({ type, confidence: 0.9 })),
    pageSummary: { templates: [], homeEligibleTemplates: [] }
  }))
}))

function args(create: jest.Mock) {
  const html = '<section><p>Fixture copy</p></section>'
  const blockInput = {
    ...buildBlockInput({
      html,
      bgImageMap: extractBackgroundImages(html),
      block: {
        id: 'fixture', order: 1, region: 'main', anchorResolved: true,
        anchor: { path: [0], tag: 'section', id: '', classes: [] },
        box: { x: 0, y: 0, width: 1000, height: 300 }, children: [], oversized: false
      }
    }),
    sectionKey: 'block:1',
    url: 'https://example.com/workshop'
  }
  return {
    blockInput,
    selection: selectBlockCandidates(blockInput, blockInput.url),
    allowedTypes: ['text-block'],
    pageOutline: '1 main text-block',
    client: { chat: { completions: { create } } } as any,
    endpointModel: 'inception/mercury-2.5',
    effectiveMaxTokens: 8000,
    telemetry: createDetectionTelemetry({ url: 'https://example.com/workshop', model: 'inception/mercury-2.5' })
  }
}

const valid = JSON.stringify({ sectionKey: 'block:1', components: [{ component: 'text-block', confidence: 0.95, content: { text: 'Fixture copy' } }] })
const invalid = JSON.stringify({ sectionKey: 'block:1', components: 'invalid' })
const response = (content: string, finish_reason = 'stop') => ({
  choices: [{ finish_reason, message: { content } }],
  usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15, cost: 0.001 }
})

test('family override accepts an uppercase type in one call using the shared parser', async () => {
  const create = jest.fn().mockResolvedValue(response(JSON.stringify({
    sectionKey: 'block:1', pageMetadata: 'bogus', components: [
      { component: 'CUSTOM-FAMILY', confidence: 0.95, content: { heading: 'Fixture copy' } },
      { component: 'unknown', confidence: 0.1, content: {} }
    ]
  }) + ' trailing text'))
  const input = args(create)
  input.allowedTypes = ['custom-family']
  const result = await extractBlock({ ...input, catalogueOverride: {
    types: { 'custom-family': 'A custom family' }, contract: 'Fixture family contract', omitRules: [],
    validateContent: (_type, content) => content,
    location: () => 'main', templateEquivalent: () => 'text-block'
  } })
  expect(create).toHaveBeenCalledTimes(1)
  expect(result.artifact.components).toMatchObject([{ type: 'custom-family', content: { heading: 'Fixture copy' } }])
  expect(result.artifact.pageMetadata).toBeUndefined()
  expect(result.artifact.parserRepairs).toEqual(expect.arrayContaining([expect.objectContaining({ action: 'drop_trailing_characters' })]))
})

test('family override rejects an unpicked family through the production repair path', async () => {
  const create = jest.fn().mockResolvedValue(response(JSON.stringify({
    sectionKey: 'block:1', components: [{ component: 'hero', confidence: 0.95, content: { heading: 'Fixture copy' } }]
  })))
  const input = args(create)
  input.allowedTypes = ['content']
  await expect(extractBlock({ ...input, catalogueOverride: {
    types: { content: 'Editorial text', hero: 'Page introduction' },
    contract: 'Fixture family contract', omitRules: [],
    validateContent: (_type, content) => content,
    location: () => 'main', templateEquivalent: () => 'text-block'
  } })).rejects.toMatchObject({ debug: { requestCount: 2, stage: 'validation' } })
  expect(create).toHaveBeenCalledTimes(2)
  expect(create.mock.calls[1][0].messages[3].content).toContain('Allowed component types: content')
})

afterEach(() => jest.useRealTimers())

test('a silent call aborts at 120 seconds and resends the identical request', async () => {
  jest.useFakeTimers()
  const create = jest.fn().mockImplementationOnce(() => new Promise(() => {})).mockResolvedValueOnce(response(valid))
  const pending = extractBlock(args(create))
  await jest.advanceTimersByTimeAsync(119999)
  expect(create).toHaveBeenCalledTimes(1)
  expect(create.mock.calls[0][1].signal.aborted).toBe(false)
  await jest.advanceTimersByTimeAsync(1)
  const result = await pending
  expect(result.artifact.components).toHaveLength(1)
  expect(create.mock.calls[0][1].signal.aborted).toBe(true)
  expect(create.mock.calls[0][0]).toEqual(create.mock.calls[1][0])
  expect(result.requestCount).toBe(2)
  expect(jest.getTimerCount()).toBe(0)
})

test('validation repair adds the existing repair wording and accumulates usage', async () => {
  const create = jest.fn().mockResolvedValueOnce(response(invalid)).mockResolvedValueOnce(response(valid))
  const result = await extractBlock(args(create))
  expect(create).toHaveBeenCalledTimes(2)
  expect(create.mock.calls[1][0].messages[3].content).toContain('Your previous JSON failed strict validation.')
  expect(create.mock.calls[1][0].messages[3].content).toContain('Allowed component types: text-block')
  expect(result.usage).toMatchObject({ total_tokens: 30, total_cost: 0.002 })
})

test('validation failure gets exactly one repair attempt', async () => {
  const create = jest.fn().mockResolvedValue(response(invalid))
  await expect(extractBlock(args(create))).rejects.toMatchObject({ debug: { requestCount: 2, stage: 'validation' } })
  expect(create).toHaveBeenCalledTimes(2)
})

test('cut-off replies exhaust exactly two infrastructure retries without validation repair', async () => {
  const create = jest.fn().mockResolvedValue(response('{"sectionKey":"block:1","components":[', 'length'))
  await expect(extractBlock(args(create))).rejects.toMatchObject({ debug: { requestCount: 3, stage: 'output_limit' } })
  expect(create).toHaveBeenCalledTimes(3)
  expect(create.mock.calls.every(([request]) => request.messages.length === 3)).toBe(true)
})

test('incomplete JSON with a stop finish reason also retries unchanged', async () => {
  const create = jest.fn().mockResolvedValueOnce(response('{"components":[')).mockResolvedValueOnce(response(valid))
  await expect(extractBlock(args(create))).resolves.toMatchObject({ requestCount: 2 })
  expect(create.mock.calls[0][0]).toEqual(create.mock.calls[1][0])
})

test('non-string provider content fails at llm_call without a truncation retry', async () => {
  const create = jest.fn().mockResolvedValue({
    choices: [{ finish_reason: 'stop', message: { content: [] } }]
  })
  await expect(extractBlock(args(create))).rejects.toMatchObject({
    message: 'jsonStr.trim is not a function',
    debug: { requestCount: 1, stage: 'llm_call' }
  })
  expect(create).toHaveBeenCalledTimes(1)
})

test('a valid reply after non-string provider content is never requested', async () => {
  const create = jest.fn()
    .mockResolvedValueOnce({ choices: [{ finish_reason: 'stop', message: { content: [] } }] })
    .mockResolvedValueOnce(response(valid))
  await expect(extractBlock(args(create))).rejects.toMatchObject({
    message: 'jsonStr.trim is not a function',
    debug: { requestCount: 1, stage: 'llm_call' }
  })
  expect(create).toHaveBeenCalledTimes(1)
})

const providerError = {
  id: 'fixture-response',
  error: { message: 'Upstream server error', code: 502, metadata: { error_type: 'provider_unavailable' } }
}

test('a provider error body retries and succeeds', async () => {
  jest.useFakeTimers()
  const create = jest.fn().mockResolvedValueOnce(providerError).mockResolvedValueOnce(response(valid))
  const pending = extractBlock(args(create))
  await jest.advanceTimersByTimeAsync(1000)
  const result = await pending
  expect(result.artifact.components).toHaveLength(1)
  expect(result.requestCount).toBe(2)
  expect(create).toHaveBeenCalledTimes(2)
  expect(jest.getTimerCount()).toBe(0)
})

test.each([400, 401, '400', '401'])('an embedded provider error code %s fails without retrying', async code => {
  jest.useFakeTimers()
  const create = jest.fn().mockResolvedValue({ error: { code, message: 'Permanent failure' } })
  const failure = expect(extractBlock(args(create))).rejects.toMatchObject({
    message: `Block extraction provider error (${code}): Permanent failure`,
    debug: { requestCount: 1, stage: 'llm_call' }
  })
  await jest.advanceTimersByTimeAsync(15000)
  await failure
  expect(create).toHaveBeenCalledTimes(1)
})

test.each([429, '429', '502', undefined])('an embedded provider error code %s retries', async code => {
  jest.useFakeTimers()
  const create = jest.fn()
    .mockResolvedValueOnce({ error: { code, message: 'Temporary failure' } })
    .mockResolvedValueOnce(response(valid))
  const pending = extractBlock(args(create))
  await jest.advanceTimersByTimeAsync(1000)
  await expect(pending).resolves.toMatchObject({ requestCount: 2 })
  expect(create).toHaveBeenCalledTimes(2)
})

test('provider error bodies exhaust four retries and preserve provider details', async () => {
  jest.useFakeTimers()
  const create = jest.fn().mockResolvedValue(providerError)
  const pending = extractBlock(args(create))
  const failure = expect(pending).rejects.toMatchObject({
    message: 'Block extraction provider error (502): Upstream server error',
    debug: { requestCount: 5, stage: 'llm_call' }
  })
  await jest.advanceTimersByTimeAsync(0)
  for (const delay of [1000, 2000, 4000, 8000]) {
    const calls = create.mock.calls.length
    await jest.advanceTimersByTimeAsync(delay - 1)
    expect(create).toHaveBeenCalledTimes(calls)
    await jest.advanceTimersByTimeAsync(1)
    expect(create).toHaveBeenCalledTimes(calls + 1)
  }
  await failure
  expect(create).toHaveBeenCalledTimes(5)
  expect(jest.getTimerCount()).toBe(0)
})

test('a response without choices or provider error keeps the existing error wording', async () => {
  jest.useFakeTimers()
  const create = jest.fn().mockResolvedValue({ choices: [] })
  const failure = expect(extractBlock(args(create))).rejects.toMatchObject({
    message: 'Block extraction response must include choices[0]',
    debug: { requestCount: 5, stage: 'llm_call' }
  })
  await jest.advanceTimersByTimeAsync(15000)
  await failure
  expect(create).toHaveBeenCalledTimes(5)
})

test.each([429, 503])('a thrown HTTP %s APIError retries and succeeds', async status => {
  jest.useFakeTimers()
  const create = jest.fn()
    .mockRejectedValueOnce(new APIError(status, { message: 'Service unavailable' }, 'Service unavailable', new Headers()))
    .mockResolvedValueOnce(response(valid))
  const pending = extractBlock(args(create))
  await jest.advanceTimersByTimeAsync(1000)
  await expect(pending).resolves.toMatchObject({ requestCount: 2 })
  expect(create).toHaveBeenCalledTimes(2)
  expect(jest.getTimerCount()).toBe(0)
})

test.each([' trailing text', ' {"unfinished":', ' "]}'])('accepts a complete block reply followed by %s without retrying', async tail => {
  const create = jest.fn().mockResolvedValue(response(valid + tail))
  const result = await extractBlock(args(create))
  expect(result.artifact.components).toHaveLength(1)
  expect(result.requestCount).toBe(1)
  expect(create).toHaveBeenCalledTimes(1)
})

test('malformed JSON before the completed root still fails validation', async () => {
  const create = jest.fn().mockResolvedValue(response('{"sectionKey":"block:1","components":[],} trailing'))
  await expect(extractBlock(args(create))).rejects.toMatchObject({
    debug: { requestCount: 2, stage: 'validation' }
  })
})
