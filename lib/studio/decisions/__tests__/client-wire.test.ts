/**
 * @jest-environment node
 *
 * The wire format, tested at the HTTP boundary.
 *
 * createFakeDecisionClient deliberately skips this file, so nothing else in the
 * suite exercises `noul`, `probabilities`, `legend`, `input_tokens` or the
 * /alpha/decisions path. The three answer shapes disagree with each other on
 * purpose, which makes this the easiest place in the module to be quietly
 * wrong. Only fetch is mocked: the request is built and the response parsed by
 * the real client.
 */
import { createDecisionClient } from '../client'
import type { BooleanQuestion, ChoiceQuestion, Question, ScoreQuestion } from '../types'

const BOOLEAN: BooleanQuestion = {
  id: 'wire.flag',
  version: 1,
  owner: 'test',
  shape: 'boolean',
  facets: ['text'],
  instructions: 'Is this an about page?',
  criteria: { true: 'It describes the organisation.', false: 'It does not.' },
  threshold: 0.5,
  failSafe: false,
  fallback: () => false
}

const CHOICE: ChoiceQuestion = {
  id: 'wire.kind',
  version: 1,
  owner: 'test',
  shape: 'choice',
  facets: ['text'],
  instructions: 'What kind of page is this?',
  criteria: { about: 'About the organisation.', contact: 'How to get in touch.' },
  threshold: 0.5,
  failSafe: null,
  fallback: () => null
}

const SCORE: ScoreQuestion = {
  id: 'wire.quality',
  version: 1,
  owner: 'test',
  shape: 'score',
  facets: ['text'],
  instructions: 'How complete is this page?',
  // Zero-indexed on the wire: criteria[0] is level 0.
  criteria: ['Empty.', 'Thin.', 'Adequate.', 'Rich.'],
  failSafe: 0,
  fallback: () => 0
}

const STATE = 'Counts: 4 nodes'

interface Captured {
  url: string
  body: any
}

const captured: Captured[] = []
let originalFetch: typeof globalThis.fetch

/** Mocks the HTTP boundary only; the client builds and parses for real. */
function respondWith(payload: unknown, status = 200): void {
  globalThis.fetch = (async (input: any, init: any = {}) => {
    const request = typeof input === 'string' || input instanceof URL ? null : input
    const url = request ? request.url : String(input)
    const rawBody = request ? await request.clone().text() : init?.body
    captured.push({
      url,
      body: typeof rawBody === 'string' && rawBody ? JSON.parse(rawBody) : rawBody
    })
    return new Response(JSON.stringify(payload), {
      status,
      headers: { 'content-type': 'application/json' }
    })
  }) as typeof globalThis.fetch
}

function usageEnvelope() {
  return { input_tokens: 1840, output_tokens: 26, cost: 0.00042 }
}

async function askOne(question: Question, answer: Record<string, unknown>) {
  respondWith({ answers: { [question.id]: answer }, usage: usageEnvelope() })
  return createDecisionClient().askRaw(STATE, [question])
}

beforeEach(() => {
  captured.length = 0
  originalFetch = globalThis.fetch
  process.env.DECISION_MODEL_API_KEY = 'test-key'
  process.env.DECISION_MODEL_BASE_URL = 'https://decisions.test/api'
  process.env.DECISION_MODEL_ID = 'typesafe/jev-1.13'
})

afterEach(() => {
  globalThis.fetch = originalFetch
  delete process.env.DECISION_MODEL_BASE_URL
  delete process.env.DECISION_MODEL_ID
})

describe('the request', () => {
  it('posts every question to /alpha/decisions as an object keyed by id', async () => {
    respondWith({
      answers: { [BOOLEAN.id]: { noul: 0.9 }, [CHOICE.id]: { choice: 'about', probabilities: { about: 0.9, contact: 0.1 } } },
      usage: usageEnvelope()
    })

    await createDecisionClient().askRaw(STATE, [BOOLEAN, CHOICE])

    expect(captured).toHaveLength(1)
    expect(captured[0].url).toBe('https://decisions.test/api/alpha/decisions')
    expect(captured[0].body.state).toBe(STATE)
    expect(captured[0].body.model).toBe('typesafe/jev-1.13')
    // An object, not an array: the endpoint keys answers back by the same ids.
    expect(Array.isArray(captured[0].body.questions)).toBe(false)
    expect(Object.keys(captured[0].body.questions)).toEqual([BOOLEAN.id, CHOICE.id])
  })

  it('sends a boolean as type "noul" and a score as an ordered criteria array', async () => {
    respondWith({
      answers: { [BOOLEAN.id]: { noul: 0.4 }, [SCORE.id]: { score: 1, legend: { 0: 0.1, 1: 0.9 } } },
      usage: usageEnvelope()
    })

    await createDecisionClient().askRaw(STATE, [BOOLEAN, SCORE])

    const sent = captured[0].body.questions
    expect(sent[BOOLEAN.id].type).toBe('noul')
    expect(sent[BOOLEAN.id].criteria).toEqual({ true: expect.any(String), false: expect.any(String) })
    expect(sent[SCORE.id].type).toBe('score')
    expect(sent[SCORE.id].criteria).toEqual(['Empty.', 'Thin.', 'Adequate.', 'Rich.'])
    expect(sent[SCORE.id].instructions).toBe(SCORE.instructions)
  })
})

describe('boolean answers', () => {
  it('reads the probability of true from "noul" and carries no confidence', async () => {
    const response = await askOne(BOOLEAN, { noul: 0.03, confidence: 0.81 })

    const answer = response.answers[BOOLEAN.id]
    // RawAnswer keeps the wire's meaning: value IS P(true), not a boolean.
    expect(answer.value).toBeCloseTo(0.03)
    expect(answer.probability).toBeCloseTo(0.03)
    // A noul answer has no confidence, whatever else the body happens to carry.
    expect(answer.confidence).toBeNull()
    expect(answer.distribution).toBeUndefined()
  })

  it('accepts "probability" as the key when "noul" is absent', async () => {
    const response = await askOne(BOOLEAN, { probability: 0.72 })

    expect(response.answers[BOOLEAN.id].probability).toBeCloseTo(0.72)
  })

  it('reads a confident no as a low P(true), not as a missing answer', async () => {
    const response = await askOne(BOOLEAN, { noul: 0 })

    expect(response.answers[BOOLEAN.id].value).toBe(0)
    expect(response.answers[BOOLEAN.id].probability).toBe(0)
  })

  it('reports no answer, not P(true) = 0, when the boolean field is not a number', async () => {
    // Every one of these used to become probability 0, which ask() then read
    // as a decided "false" and handed to the caller as source 'model' with a
    // complemented probability of 1.0 -- maximum stated confidence, invented
    // from a field that never arrived. For page.isInternal, false means
    // "public, publish it".
    const unreadable = [
      { noul: true },          // answered as a real boolean
      { noul: false },         // and the other one
      { noul: '0.9' },         // a stringified number
      { verdict: 0.9 },        // the key renamed
      { noul: null },          // present and empty
      {}                       // nothing at all
    ]

    for (const body of unreadable) {
      const response = await askOne(BOOLEAN, body)
      const answer = response.answers[BOOLEAN.id]

      expect(answer.value).toBeNull()
      expect(answer.probability).toBeNull()
      expect(answer.confidence).toBeNull()
    }
  })

  it('still reads a genuine zero, which is a confident no and not a missing field', async () => {
    // The guard above must not swallow the one legitimate falsy answer.
    const response = await askOne(BOOLEAN, { probability: 0 })

    expect(response.answers[BOOLEAN.id].value).toBe(0)
    expect(response.answers[BOOLEAN.id].probability).toBe(0)
  })
})

describe('choice answers', () => {
  it('takes the winning key from "choice" and its mass from "probabilities"', async () => {
    const response = await askOne(CHOICE, {
      choice: 'about',
      probabilities: { about: 0.72, contact: 0.28 },
      confidence: 0.66
    })

    const answer = response.answers[CHOICE.id]
    expect(answer.value).toBe('about')
    expect(answer.probability).toBeCloseTo(0.72)
    expect(answer.confidence).toBeCloseTo(0.66)
    expect(answer.distribution).toEqual({ about: 0.72, contact: 0.28 })
  })

  it('reports a null probability rather than 0 when the winner is not in the distribution', async () => {
    const response = await askOne(CHOICE, { choice: 'about', probabilities: { contact: 0.28 } })

    // Null, so ask() falls back instead of reading an invented 0.
    expect(response.answers[CHOICE.id].probability).toBeNull()
  })
})

describe('score answers', () => {
  it('reads the distribution from the zero-indexed legend, not from "probabilities"', async () => {
    const response = await askOne(SCORE, {
      score: 2.4,
      legend: { 0: 0.05, 1: 0.15, 2: 0.6, 3: 0.2 },
      confidence: 0.7
    })

    const answer = response.answers[SCORE.id]
    expect(answer.value).toBeCloseTo(2.4)
    // Zero-indexed: key '0' is the mass on criteria[0], 'Empty.'.
    expect(answer.distribution).toEqual({ '0': 0.05, '1': 0.15, '2': 0.6, '3': 0.2 })
    expect(Object.keys(answer.distribution ?? {})).toHaveLength(SCORE.criteria.length)
    // 2.4 rounds to level 2, so the answer's probability is that level's mass.
    expect(answer.probability).toBeCloseTo(0.6)
    expect(answer.confidence).toBeCloseTo(0.7)
  })

  it('accepts a legend sent as an array, keyed by index', async () => {
    const response = await askOne(SCORE, { score: 0.6, legend: [0.3, 0.55, 0.1, 0.05] })

    expect(response.answers[SCORE.id].distribution).toEqual({ '0': 0.3, '1': 0.55, '2': 0.1, '3': 0.05 })
    // 0.6 rounds to level 1.
    expect(response.answers[SCORE.id].probability).toBeCloseTo(0.55)
  })

  it('gives a probability, not null, so a score can ever reach threshold derivation', async () => {
    const response = await askOne(SCORE, { score: 3, legend: { 0: 0.01, 1: 0.04, 2: 0.25, 3: 0.7 } })

    expect(response.answers[SCORE.id].probability).toBeCloseTo(0.7)
  })

  it('reports null rather than an invented number when no legend arrives', async () => {
    const response = await askOne(SCORE, { score: 2 })

    expect(response.answers[SCORE.id].probability).toBeNull()
    expect(response.answers[SCORE.id].distribution).toEqual({})
  })
})

describe('the usage envelope', () => {
  it('maps input_tokens / output_tokens / cost onto the internal names', async () => {
    const response = await askOne(BOOLEAN, { noul: 0.5 })

    expect(response.usage.inputTokens).toBe(1840)
    expect(response.usage.outputTokens).toBe(26)
    expect(response.usage.cost).toBeCloseTo(0.00042)
    expect(response.usage.latencyMs).toBeGreaterThanOrEqual(0)
  })

  it('reports zeros rather than NaN when the endpoint omits usage', async () => {
    respondWith({ answers: { [BOOLEAN.id]: { noul: 0.5 } } })

    const response = await createDecisionClient().askRaw(STATE, [BOOLEAN])

    expect(response.usage).toMatchObject({ inputTokens: 0, outputTokens: 0, cost: 0 })
  })
})

describe('malformed responses', () => {
  it('throws when the body carries no answers', async () => {
    respondWith({ usage: usageEnvelope() })

    await expect(createDecisionClient().askRaw(STATE, [BOOLEAN])).rejects.toThrow(/no answers/)
  })

  it('throws naming the question the endpoint skipped', async () => {
    respondWith({ answers: { [BOOLEAN.id]: { noul: 0.5 } }, usage: usageEnvelope() })

    await expect(createDecisionClient().askRaw(STATE, [BOOLEAN, CHOICE])).rejects.toThrow(/wire\.kind/)
  })
})
