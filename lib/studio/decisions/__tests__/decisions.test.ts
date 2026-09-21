/**
 * @jest-environment node
 */
import fs from 'node:fs'
import path from 'node:path'

import { ask, setDecisionClient } from '../ask'
import { createFakeDecisionClient } from '../client'
import { defineQuestion, __resetRegistryForTests } from '../registry'
import { buildState } from '../state'
import type { BooleanQuestion, ChoiceQuestion, DecisionClient, EvidenceSource, RawAnswer } from '../index'

const SOURCE: EvidenceSource = {
  url: 'https://example.org/about',
  nodes: [
    { tag: 'h1', text: 'About us' },
    { tag: 'p', text: 'We have been serving the community since 1974 and continue to grow.' },
    { tag: 'img', src: 'https://cdn.example.org/team.jpg', alt: 'The team' },
    { tag: 'a', text: 'Contact us', href: '/contact' }
  ]
}

function booleanQuestion(overrides: Partial<BooleanQuestion> = {}): BooleanQuestion {
  return defineQuestion<BooleanQuestion>({
    id: 'test.flag',
    version: 1,
    owner: 'test',
    shape: 'boolean',
    facets: ['url', 'headings', 'text'],
    instructions: 'Is this an about page?',
    criteria: { true: 'It describes the organisation.', false: 'It does not.' },
    threshold: 0.5,
    failSafe: false,
    fallback: () => false,
    ...overrides
  } as BooleanQuestion)
}

beforeEach(() => {
  __resetRegistryForTests()
  setDecisionClient(null)
  process.env.DECISION_MODEL_ENABLED = 'true'
  process.env.DECISION_MODEL_SHADOW = 'false'
  process.env.DECISION_MODEL_API_KEY = 'test-key'
  process.env.DECISION_MODEL_LOG_DIR = 'reports/decisions-test'
  delete process.env.DECISION_MODEL_WEBSITE_ALLOWLIST
})

afterEach(() => {
  setDecisionClient(null)
})

describe('config independence', () => {
  it('imports with no IMPORT_MODEL_CHAIN set', async () => {
    const saved = process.env.IMPORT_MODEL_CHAIN
    delete process.env.IMPORT_MODEL_CHAIN
    try {
      jest.resetModules()
      await expect(import('../index')).resolves.toBeDefined()
    } finally {
      if (saved !== undefined) process.env.IMPORT_MODEL_CHAIN = saved
    }
  })
})

describe('ask() resolution order', () => {
  it('returns the fallback with source "disabled" when the model is off', async () => {
    process.env.DECISION_MODEL_ENABLED = 'false'
    booleanQuestion({ fallback: () => true })

    const answer = await ask<boolean>('test.flag', SOURCE)

    expect(answer.value).toBe(true)
    expect(answer.source).toBe('disabled')
    expect(answer.probability).toBeNull()
  })

  it('returns the fallback with source "disabled" when the website is not allowlisted', async () => {
    process.env.DECISION_MODEL_WEBSITE_ALLOWLIST = 'site-a,site-b'
    booleanQuestion({ fallback: () => true })
    setDecisionClient(createFakeDecisionClient({ 'test.flag': 0.99 }))

    const answer = await ask<boolean>('test.flag', SOURCE, { websiteId: 'site-c' })

    expect(answer.source).toBe('disabled')
    expect(answer.value).toBe(true)
  })

  it('falls back with source "error" when the transport throws, and does not rethrow', async () => {
    booleanQuestion({ fallback: () => true })
    setDecisionClient(createFakeDecisionClient({}, { failWith: new Error('network down') }))

    const answer = await ask<boolean>('test.flag', SOURCE)

    expect(answer.source).toBe('error')
    expect(answer.value).toBe(true)
    expect(answer.error).toContain('network down')
  })

  it('falls back when the model answers below threshold', async () => {
    booleanQuestion({ threshold: 0.8, undecidedBand: 0.2, fallback: () => true })
    setDecisionClient(createFakeDecisionClient({ 'test.flag': 0.75 }))

    const answer = await ask<boolean>('test.flag', SOURCE)

    expect(answer.source).toBe('fallback')
    expect(answer.value).toBe(true)
    expect(answer.probability).toBeNull()
  })

  it('returns the fallback value with source "shadow" when shadow mode is on', async () => {
    process.env.DECISION_MODEL_SHADOW = 'true'
    booleanQuestion({ fallback: () => false })
    setDecisionClient(createFakeDecisionClient({ 'test.flag': 0.99 }))

    const answer = await ask<boolean>('test.flag', SOURCE)

    expect(answer.source).toBe('shadow')
    // The model said true; shadow mode still returns the old path's answer.
    expect(answer.value).toBe(false)
  })

  it('uses the model answer when enabled, above threshold and not shadowing', async () => {
    booleanQuestion({ fallback: () => false })
    setDecisionClient(createFakeDecisionClient({ 'test.flag': 0.91 }))

    const answer = await ask<boolean>('test.flag', SOURCE)

    expect(answer.source).toBe('model')
    expect(answer.value).toBe(true)
    expect(answer.probability).toBeCloseTo(0.91)
  })

  it('returns failSafe with source "error" when the fallback itself throws', async () => {
    process.env.DECISION_MODEL_ENABLED = 'false'
    booleanQuestion({
      failSafe: true,
      fallback: () => { throw new Error('fallback exploded') }
    })

    const answer = await ask<boolean>('test.flag', SOURCE)

    expect(answer.source).toBe('error')
    expect(answer.value).toBe(true)
  })

  it('reports source "error", not "shadow", when the fallback throws in shadow mode', async () => {
    process.env.DECISION_MODEL_SHADOW = 'true'
    booleanQuestion({
      failSafe: true,
      fallback: () => { throw new Error('fallback exploded') }
    })
    setDecisionClient(createFakeDecisionClient({ 'test.flag': 0.99 }))

    const answer = await ask<boolean>('test.flag', SOURCE)

    // The value returned is the failSafe, not the old path's answer.
    expect(answer.source).toBe('error')
    expect(answer.value).toBe(true)
    expect(answer.error).toContain('fallback threw')
  })

  it('never throws for an unregistered question', async () => {
    const answer = await ask('does.notExist', SOURCE)

    expect(answer.source).toBe('error')
    expect(answer.error).toContain('does.notExist')
  })
})

describe('an answer the client could not read', () => {
  /**
   * A transport that reaches the endpoint and comes back with a boolean answer
   * nobody can read -- answered as a real boolean, under a renamed key, or as
   * a string. client.ts reports all of those as a null value rather than
   * coercing them to zero.
   */
  function unreadableClient(): DecisionClient {
    return {
      async askRaw(_state, questions) {
        const answers: Record<string, RawAnswer> = {}
        for (const question of questions) {
          answers[question.id] = { value: null, probability: null, confidence: null }
        }
        return { answers, usage: { inputTokens: 0, outputTokens: 0, cost: 0, latencyMs: 0 } }
      }
    }
  }

  it('does not turn a missing probability into a confident answer', async () => {
    booleanQuestion({ threshold: 0.84, fallback: () => false })
    setDecisionClient(unreadableClient())

    const answer = await ask<boolean>('test.flag', SOURCE)

    // Before: value false, source 'model', probability 1.0. Nothing threw and
    // nothing logged an error; the shadow log recorded it as an observation.
    expect(answer.source).not.toBe('model')
    expect(answer.source).toBe('error')
    expect(answer.probability).toBeNull()
    expect(answer.error).toContain('probability of true')
  })

  it('is a failure, not an answer below threshold, so a fail-safe question excludes', async () => {
    booleanQuestion({
      threshold: 0.84,
      failSafe: true,
      whenUnanswered: 'failSafe',
      fallback: () => false
    })
    setDecisionClient(unreadableClient())

    const answer = await ask<boolean>('test.flag', SOURCE)

    expect(answer.value).toBe(true)
  })

  it('still does not throw', async () => {
    booleanQuestion({ fallback: () => false })
    setDecisionClient(unreadableClient())

    await expect(ask<boolean>('test.flag', SOURCE)).resolves.toBeDefined()
  })
})

describe('what happens when the model was asked and did not answer', () => {
  /** A transport that answers, but not for the question that was asked. */
  function omittingClient(): DecisionClient {
    return {
      async askRaw() {
        return {
          answers: {},
          usage: { inputTokens: 0, outputTokens: 0, cost: 0, latencyMs: 0 }
        }
      }
    }
  }

  it('returns the failSafe, not the permissive fallback, when the transport fails', async () => {
    booleanQuestion({ failSafe: true, whenUnanswered: 'failSafe', fallback: () => false })
    setDecisionClient(createFakeDecisionClient({}, { failWith: new Error('ECONNRESET') }))

    const answer = await ask<boolean>('test.flag', SOURCE)

    expect(answer.source).toBe('error')
    expect(answer.value).toBe(true)
    expect(answer.error).toContain('ECONNRESET')
  })

  it('returns the failSafe when the response omits this question', async () => {
    booleanQuestion({ failSafe: true, whenUnanswered: 'failSafe', fallback: () => false })
    setDecisionClient(omittingClient())

    const answer = await ask<boolean>('test.flag', SOURCE)

    expect(answer.source).toBe('error')
    expect(answer.value).toBe(true)
  })

  it('keeps the fallback on a failure for a question that does not ask to fail safe', async () => {
    // page.type's deterministic scorer and workflow.isImport's router are both
    // perfectly good incumbent answers. A failed network call is no reason to
    // discard one, so the default is unchanged.
    booleanQuestion({ failSafe: true, fallback: () => false })
    setDecisionClient(createFakeDecisionClient({}, { failWith: new Error('network down') }))

    const answer = await ask<boolean>('test.flag', SOURCE)

    expect(answer.source).toBe('error')
    expect(answer.value).toBe(false)
  })

  it('does NOT fail safe when the model answered inside the undecided band', async () => {
    // An uncertain answer is an ordinary designed outcome, not a failure.
    booleanQuestion({
      threshold: 0.8,
      undecidedBand: 0.2,
      failSafe: true,
      whenUnanswered: 'failSafe',
      fallback: () => false
    })
    setDecisionClient(createFakeDecisionClient({ 'test.flag': 0.75 }))

    const answer = await ask<boolean>('test.flag', SOURCE)

    expect(answer.source).toBe('fallback')
    expect(answer.value).toBe(false)
  })

  it('does NOT fail safe when the model answered below threshold', async () => {
    // A boolean below its threshold is a decided "no", answered by the model.
    booleanQuestion({ threshold: 0.84, failSafe: true, whenUnanswered: 'failSafe', fallback: () => true })
    setDecisionClient(createFakeDecisionClient({ 'test.flag': 0.1 }))

    const answer = await ask<boolean>('test.flag', SOURCE)

    expect(answer.source).toBe('model')
    expect(answer.value).toBe(false)
  })

  it('does NOT fail safe while the model is disabled', async () => {
    // With the module off, the fallback IS the system's answer, byte for byte.
    process.env.DECISION_MODEL_ENABLED = 'false'
    booleanQuestion({ failSafe: true, whenUnanswered: 'failSafe', fallback: () => false })

    const answer = await ask<boolean>('test.flag', SOURCE)

    expect(answer.source).toBe('disabled')
    expect(answer.value).toBe(false)
  })

  it('does NOT fail safe in shadow mode', async () => {
    process.env.DECISION_MODEL_SHADOW = 'true'
    booleanQuestion({ failSafe: true, whenUnanswered: 'failSafe', fallback: () => false })
    setDecisionClient(createFakeDecisionClient({ 'test.flag': 0.99 }))

    const answer = await ask<boolean>('test.flag', SOURCE)

    expect(answer.source).toBe('shadow')
    expect(answer.value).toBe(false)
  })

  it('does NOT fail safe when the transport fails in shadow mode', async () => {
    // Shadow mode is the default, and its whole promise is that turning the
    // module on changes nothing. An answer that was never going to be used
    // cannot have a failure worth excluding a page over.
    process.env.DECISION_MODEL_SHADOW = 'true'
    booleanQuestion({ failSafe: true, whenUnanswered: 'failSafe', fallback: () => false })
    setDecisionClient(createFakeDecisionClient({}, { failWith: new Error('ECONNRESET') }))

    const answer = await ask<boolean>('test.flag', SOURCE)

    expect(answer.source).toBe('error')
    expect(answer.value).toBe(false)
  })

  it('returns the failSafe when the state could not even be built', async () => {
    booleanQuestion({ failSafe: true, whenUnanswered: 'failSafe', fallback: () => false })
    setDecisionClient(createFakeDecisionClient({ 'test.flag': 0.99 }))

    // buildState throws before anything can be asked. sitemap-discovery reads
    // `answer.value === true`, so the previous `undefined` published the page.
    const answer = await ask<boolean>('test.flag', { url: 'https://x.org/a', nodes: undefined as any })

    expect(answer.source).toBe('error')
    expect(answer.value).toBe(true)
  })

  it('has no value to give for a question that is not registered', async () => {
    // No question, no failSafe, and nothing honest to return.
    const answer = await ask('does.notExist', SOURCE)

    expect(answer.source).toBe('error')
    expect(answer.value).toBeUndefined()
  })
})

describe('probability of the returned value', () => {
  /** The last row the shadow log wrote for a question. */
  function lastShadowRow(questionId: string): any {
    const file = path.join(process.env.DECISION_MODEL_LOG_DIR as string, `${questionId}.jsonl`)
    const lines = fs.readFileSync(file, 'utf8').trim().split('\n')
    return JSON.parse(lines[lines.length - 1])
  }

  it('reports a confident no at its own probability, not at P(true)', async () => {
    booleanQuestion({ threshold: 0.65, fallback: () => true })
    setDecisionClient(createFakeDecisionClient({ 'test.flag': 0.03 }))

    const answer = await ask<boolean>('test.flag', SOURCE)

    expect(answer.source).toBe('model')
    expect(answer.value).toBe(false)
    // The model was 97% sure this is not an about page. Publishing 0.03 for
    // that reads as no confidence at all to anything gating on the number.
    expect(answer.probability).toBeCloseTo(0.97)
  })

  it('leaves the shadow log on the raw P(true) scale, which derives thresholds', async () => {
    booleanQuestion({ threshold: 0.65, fallback: () => true })
    setDecisionClient(createFakeDecisionClient({ 'test.flag': 0.03 }))

    await ask<boolean>('test.flag', SOURCE)

    // Not 0.97: the gap search only works on one consistent scale.
    expect(lastShadowRow('test.flag').p).toBeCloseTo(0.03)
  })

  it('records no agreement at all when the model did not decide', async () => {
    booleanQuestion({ threshold: 0.65, undecidedBand: 0.15, fallback: () => false })
    setDecisionClient(createFakeDecisionClient({ 'test.flag': 0.6 }))

    const answer = await ask<boolean>('test.flag', SOURCE)
    expect(answer.source).toBe('fallback')

    const row = lastShadowRow('test.flag')
    // Null, not false: an undecided answer is not a disagreement, and counting
    // it as one fills the derive-thresholds report with rows to read that say
    // nothing.
    expect(row.agreed).toBeNull()
    expect(row.p).toBeCloseTo(0.6)
  })
})

describe('source honesty', () => {
  it('reports probability only when the answer came from the model', async () => {
    booleanQuestion({ fallback: () => true })
    setDecisionClient(createFakeDecisionClient({ 'test.flag': 0.97 }))

    const used = await ask<boolean>('test.flag', SOURCE)
    expect(used.source).toBe('model')
    expect(used.probability).not.toBeNull()

    process.env.DECISION_MODEL_ENABLED = 'false'
    const notUsed = await ask<boolean>('test.flag', SOURCE)
    expect(notUsed.source).toBe('disabled')
    expect(notUsed.probability).toBeNull()
    expect(notUsed.confidence).toBeNull()
  })
})

describe('choice questions', () => {
  it('returns the winning option above threshold', async () => {
    defineQuestion<ChoiceQuestion>({
      id: 'test.kind',
      version: 1,
      owner: 'test',
      shape: 'choice',
      facets: ['url', 'text'],
      instructions: 'What kind of page is this?',
      criteria: { about: 'About the organisation.', contact: 'How to get in touch.' },
      threshold: 0.5,
      failSafe: null,
      fallback: () => 'contact'
    })
    setDecisionClient(createFakeDecisionClient({
      'test.kind': { value: 'about', probability: 0.88, confidence: 0.85 }
    }))

    const answer = await ask<string>('test.kind', SOURCE)

    expect(answer.value).toBe('about')
    expect(answer.source).toBe('model')
  })

  it('rejects a choice with more than 255 options at registration', () => {
    const criteria: Record<string, string> = {}
    for (let i = 0; i < 256; i++) criteria[`option${i}`] = 'x'

    expect(() => defineQuestion<ChoiceQuestion>({
      id: 'test.tooMany',
      version: 1,
      owner: 'test',
      shape: 'choice',
      facets: ['text'],
      instructions: 'Too many.',
      criteria,
      threshold: 0.5,
      failSafe: null,
      fallback: () => null
    })).toThrow(/caps at 255/)
  })
})

describe('the shadow log sink', () => {
  it('does not write to the shared log from a test run', async () => {
    const fs = await import('node:fs')
    const saved = process.env.DECISION_MODEL_LOG_DIR
    delete process.env.DECISION_MODEL_LOG_DIR
    const shared = 'reports/decisions'
    const before = fs.existsSync(shared) ? fs.readdirSync(shared).length : -1

    try {
      const { appendShadowRow } = await import('../shadow-log')
      appendShadowRow({
        ts: new Date().toISOString(),
        q: 'test.sinkGuard',
        v: 1,
        source: 'shadow',
        p: 0.5,
        model: true,
        fallback: true,
        agreed: true
      })

      const after = fs.existsSync(shared) ? fs.readdirSync(shared).length : -1
      expect(after).toBe(before)
      expect(fs.existsSync(`${shared}/test.sinkGuard.jsonl`)).toBe(false)
    } finally {
      if (saved === undefined) delete process.env.DECISION_MODEL_LOG_DIR
      else process.env.DECISION_MODEL_LOG_DIR = saved
    }
  })
})

describe('the allowlist', () => {
  it('disables a tenant-scoped question when the website is not listed', async () => {
    process.env.DECISION_MODEL_WEBSITE_ALLOWLIST = 'site-a'
    booleanQuestion({ fallback: () => true })
    setDecisionClient(createFakeDecisionClient({ 'test.flag': 0.99 }))

    const answer = await ask<boolean>('test.flag', SOURCE, { websiteId: 'site-b' })

    expect(answer.source).toBe('disabled')
  })

  it('does not disable a question that runs before any website exists', async () => {
    // workflow.isImport decides whether to create a website, so it has no
    // websiteId to match. The allowlist is a rollout control, not a second
    // kill switch, and must not silence it.
    process.env.DECISION_MODEL_WEBSITE_ALLOWLIST = 'site-a'
    booleanQuestion({ tenantScoped: false, fallback: () => false })
    setDecisionClient(createFakeDecisionClient({ 'test.flag': 0.99 }))

    const answer = await ask<boolean>('test.flag', SOURCE)

    expect(answer.source).toBe('model')
    expect(answer.value).toBe(true)
  })

  it('the shipped workflow question declares itself unscopable', async () => {
    const { workflowIsImport } = await import('../questions/workflow')
    expect(workflowIsImport.tenantScoped).toBe(false)
  })
})

describe('lazy criteria', () => {
  it('resolves options at ask time, for registry-driven option sets', async () => {
    let resolved = 0
    defineQuestion<ChoiceQuestion>({
      id: 'test.lazy',
      version: 1,
      owner: 'test',
      shape: 'choice',
      facets: ['url'],
      instructions: 'Which one?',
      criteria: () => {
        resolved++
        return { alpha: 'The first.', beta: 'The second.' }
      },
      threshold: 0.5,
      failSafe: null,
      fallback: () => 'beta'
    })
    setDecisionClient(createFakeDecisionClient({
      'test.lazy': { value: 'alpha', probability: 0.9 }
    }))

    const answer = await ask<string>('test.lazy', SOURCE)

    expect(resolved).toBe(1)
    expect(answer.value).toBe('alpha')
    expect(answer.source).toBe('model')
  })

  it('falls back rather than throwing when a resolver yields too few options', async () => {
    defineQuestion<ChoiceQuestion>({
      id: 'test.lazyEmpty',
      version: 1,
      owner: 'test',
      shape: 'choice',
      facets: ['url'],
      instructions: 'Which one?',
      criteria: () => ({ only: 'The only one.' }),
      threshold: 0.5,
      failSafe: null,
      fallback: () => 'safe'
    })
    setDecisionClient(createFakeDecisionClient({ 'test.lazyEmpty': 'only' }))

    const answer = await ask<string>('test.lazyEmpty', SOURCE)

    expect(answer.source).toBe('error')
    expect(answer.value).toBe('safe')
  })
})

describe('call-site input for fallbacks', () => {
  it('hands the fallback data the state cannot carry', async () => {
    const { pageType } = await import('../questions/page-type')

    expect(pageType.fallback('', { input: { deterministicTemplateKey: 'blog/index-standard' } }))
      .toBe('blog/index-standard')
    // No input, no guess.
    expect(pageType.fallback('', {})).toBeNull()
    expect(pageType.fallback('', { input: { wrong: 'shape' } })).toBeNull()
  })
})

describe('the shipped questions', () => {
  it('workflow.isImport reads the router answer as its fallback, and guesses nothing without one', async () => {
    const { workflowIsImport } = await import('../questions/workflow')

    expect(workflowIsImport.fallback('', { input: { workflow: 'import' } })).toBe(true)
    expect(workflowIsImport.fallback('', { input: { workflow: 'greenfield' } })).toBe(false)
    expect(workflowIsImport.fallback('', {})).toBe(false)
  })

  it('workflow.isImport errs towards building rather than crawling', async () => {
    const { workflowIsImport } = await import('../questions/workflow')

    // Wrongly building costs a retry; wrongly importing crawls someone's site.
    expect(workflowIsImport.failSafe).toBe(false)
    expect(workflowIsImport.undecidedBand).toBeGreaterThan(0)
  })
})

describe('state building', () => {
  it('is deterministic for the same source and facets', () => {
    const facets = ['counts', 'headings', 'text', 'media'] as const
    expect(buildState(SOURCE, [...facets])).toBe(buildState(SOURCE, [...facets]))
  })

  it('puts counts first regardless of declared facet order', () => {
    const state = buildState(SOURCE, ['text', 'headings', 'counts'])
    expect(state.startsWith('Counts:')).toBe(true)
  })

  it('reports real image counts rather than leaving them to be inferred', () => {
    const state = buildState(SOURCE, ['counts'])
    expect(state).toContain('1 images')
    expect(state).toContain('0 background images')
  })

  it('marks truncation visibly', () => {
    const long: EvidenceSource = {
      url: 'https://example.org',
      nodes: Array.from({ length: 400 }, (_, i) => ({ tag: 'p', text: `Paragraph number ${i} `.repeat(12) }))
    }
    const state = buildState(long, ['counts', 'text'], 500)
    expect(state).toContain('[truncated at 500 characters]')
  })

  it('omits facets a question did not ask for', () => {
    const state = buildState(SOURCE, ['counts'])
    expect(state).not.toContain('About us')
  })
})

describe('the shipped question', () => {
  it('only calls a page internal when the model is confident', async () => {
    const { pageIsInternal } = await import('../questions/page')

    // v2. The threshold was 0.35 until 79 real observations showed that a
    // low cut would have excluded a hospital site's clinical guidance,
    // family support service and adolescent care department —
    // all public. With only a URL to go on the model separates reliably at
    // the top of the range and nowhere else.
    expect(pageIsInternal.version).toBe(2)
    expect(pageIsInternal.threshold).toBeGreaterThanOrEqual(0.8)
    // Still excludes when everything fails, which is the rare total-failure
    // path rather than the ordinary uncertain one.
    expect(pageIsInternal.failSafe).toBe(true)
  })

  it('keeps the old rule working as the fallback', async () => {
    const { pageIsInternal } = await import('../questions/page')

    expect(pageIsInternal.fallback('', { url: 'https://x.org/intranet/policies' })).toBe(true)
    expect(pageIsInternal.fallback('', { url: 'https://x.org/about' })).toBe(false)
    // The gap the question exists to close.
    expect(pageIsInternal.fallback('', { url: 'https://x.org/staff-portal' })).toBe(false)
  })

  it('excludes the page when the model fails, instead of publishing it', async () => {
    const { pageIsInternal } = await import('../questions/page')
    // The registry is cleared before each test; re-register the real question.
    defineQuestion(pageIsInternal)
    setDecisionClient(createFakeDecisionClient({}, { failWith: new Error('ETIMEDOUT') }))

    const url = 'https://x.org/about'
    const answer = await ask<boolean>('page.isInternal', { url, nodes: [] }, { url })

    // The fallback says false for this path, and sitemap-discovery reads
    // `answer.value === true` as "do not import". Before this, every timeout
    // and every dropped connection published the page -- including a staff
    // intranet -- while both this question and sitemap-discovery.service.ts
    // documented the opposite.
    expect(pageIsInternal.fallback('', { url })).toBe(false)
    expect(answer.source).toBe('error')
    expect(answer.value).toBe(true)
  })

  it('declares the fail-safe rather than only describing it in a comment', async () => {
    const { pageIsInternal } = await import('../questions/page')

    expect(pageIsInternal.whenUnanswered).toBe('failSafe')
  })

  it('keeps publishing an uncertain page, which is not a failure', async () => {
    const { pageIsInternal } = await import('../questions/page')
    defineQuestion(pageIsInternal)
    // Under 0.84. Most pages are, on purpose: the threshold comment above
    // records the twelve public pages a low cut would have dropped.
    setDecisionClient(createFakeDecisionClient({ 'page.isInternal': 0.4 }))

    const url = 'https://example.com/public-guidance/'
    const answer = await ask<boolean>('page.isInternal', { url, nodes: [] }, { url })

    expect(answer.value).toBe(false)
  })
})

describe('the same question asked after the page is fetched', () => {
  it('falls back to the identical rule its URL-only sibling falls back to', async () => {
    const { pageIsInternal, pageIsInternalFromContent } = await import('../questions/page')

    // The two hardcoded substrings today's isLikelyPrivate matches on, plus a
    // public path. Asserted on both questions together: the point is not that
    // the values are right, it is that they are the SAME values, so the shadow
    // log compares both questions against one baseline.
    for (const url of [
      'https://x.org/intranet/policies',
      'https://example.com/picu_intranet/handover',
      'https://example.com/public-guidance/'
    ]) {
      expect(pageIsInternalFromContent.fallback('', { url })).toBe(
        pageIsInternal.fallback('', { url })
      )
    }

    expect(pageIsInternalFromContent.fallback('', { url: 'https://x.org/intranet/policies' })).toBe(true)
    expect(pageIsInternalFromContent.fallback('', { url: 'https://example.com/picu_intranet/handover' })).toBe(true)
    expect(pageIsInternalFromContent.fallback('', { url: 'https://example.com/public-guidance/' })).toBe(false)
  })

  it('declares that it takes no action, and no call site branches on it', async () => {
    const { pageIsInternalFromContent } = await import('../questions/page')

    // The declaration. Removing it is the deliberate act of promoting the
    // question from evidence-gathering to behaviour.
    expect(pageIsInternalFromContent.effect).toBe('record-only')

    // And the call site honours it: the answer is never assigned, so there is
    // no variable to branch on. A future `const x = await ask('page.isInternal…`
    // fails here.
    const source = fs.readFileSync(
      path.join(process.cwd(), 'lib/studio/import/web-detection.ts'),
      'utf8'
    )
    const calls = source.match(/^.*'page\.isInternalFromContent'.*$/gm) ?? []
    expect(calls).toHaveLength(1)
    expect(calls[0].trim().startsWith('await ask<boolean>(')).toBe(true)
  })

  it('asks for the page content it can actually supply, and claims no more', async () => {
    const { pageIsInternalFromContent } = await import('../questions/page')

    expect(pageIsInternalFromContent.facets).toEqual(['url', 'headings', 'text'])
    // The call site has no links, images or DOM outline to hand at this point.
    for (const unsupplied of ['counts', 'links', 'media', 'structure', 'nodes']) {
      expect(pageIsInternalFromContent.facets).not.toContain(unsupplied)
    }
  })

  it('does not inherit the threshold derived for its URL-only sibling', async () => {
    const { pageIsInternal, pageIsInternalFromContent } = await import('../questions/page')

    // 0.84 was derived from 199 URL-only observations of a different question.
    // This one has none, so it must not wear that number.
    expect(pageIsInternalFromContent.threshold).not.toBe(pageIsInternal.threshold)
    expect(pageIsInternalFromContent.version).toBe(1)
  })
})
