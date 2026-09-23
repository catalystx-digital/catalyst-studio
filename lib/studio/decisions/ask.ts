/**
 * ask() and askPanel() — threshold, fallback and shadow handling.
 *
 * The one rule this file exists to enforce: `source` is honest. It is set here
 * and nowhere else, and `probability` is null whenever the answer did not come
 * from the model. This is a direct response to selectPageTemplate returning
 * source:'model', confidence:0.8 for a URL keyword match, and to
 * hero-recovery-processor stamping 0.9 on a hero it fabricated — downstream
 * gates then read those numbers as though they meant something.
 *
 * ask() never throws.
 *
 * @module decisions/ask
 */
import { createDecisionClient } from './client'
import { isDecisionModelEnabledFor, getDecisionConfig } from './config'
import { assertChoiceOptions, getQuestion, hasQuestion } from './registry'
import { recordDecision } from './shadow-log'
import { buildState, type EvidenceSource } from './state'
import type {
  Answer,
  DecisionClient,
  DecisionContext,
  DecisionUsage,
  Question,
  RawAnswer
} from './types'

let defaultClient: DecisionClient | null = null

/** Swap the transport, for tests. Pass null to restore the real one. */
export function setDecisionClient(client: DecisionClient | null): void {
  defaultClient = client
}

function getClient(): DecisionClient {
  if (!defaultClient) defaultClient = createDecisionClient()
  return defaultClient
}

/**
 * Turns a question with a criteria resolver into one with concrete criteria.
 * Returns the question unchanged when its criteria are already literal.
 */
async function resolveCriteria(question: Question): Promise<Question> {
  if (question.shape !== 'choice' || typeof question.criteria !== 'function') return question
  const criteria = await question.criteria()
  const options = Object.keys(criteria)
  if (options.length < 2) {
    throw new Error(`Choice ${question.id} resolved to ${options.length} option(s)`)
  }
  assertChoiceOptions(question.id, options)
  return { ...question, criteria }
}

function runFallback(question: Question, state: string, context: DecisionContext): {
  value: unknown
  threw: boolean
} {
  try {
    return { value: question.fallback(state, context), threw: false }
  } catch {
    return { value: question.failSafe, threw: true }
  }
}

function answerOf(
  question: Question,
  value: unknown,
  source: Answer<unknown>['source'],
  extra: Partial<Answer<unknown>> = {}
): Answer<unknown> {
  return {
    value,
    source,
    // Never a plausible-looking number for a non-model answer.
    probability: source === 'model' ? extra.probability ?? null : null,
    confidence: source === 'model' ? extra.confidence ?? null : null,
    distribution: source === 'model' ? extra.distribution : undefined,
    questionId: question.id,
    questionVersion: question.version,
    error: extra.error
  }
}

/**
 * The probability OF THE RETURNED VALUE, which is not always the raw wire
 * number.
 *
 * A boolean question's raw probability is P(true), so a confident "no" arrives
 * as 0.03. Returning that as the answer's probability publishes 0.03 for a
 * decision the model was 97% sure of — and callers such as the workflow router
 * copy it straight into a user-visible confidence. So it is complemented here
 * when the returned value is false.
 *
 * Choice and score already report the probability of what they returned: the
 * winning option's mass, and the mass on the nearest level (see client.ts).
 *
 * THE SHADOW LOG IS DIFFERENT ON PURPOSE. scripts/decisions/derive-thresholds
 * looks for a gap in the distribution of raw P(true), which only exists on one
 * consistent scale, so every recordDecision call below writes the raw wire
 * probability and only the returned Answer carries the corrected one.
 */
function probabilityOfValue(question: Question, raw: RawAnswer, value: unknown): number | null {
  if (question.shape !== 'boolean') return raw.probability
  if (typeof raw.probability !== 'number') return null
  return value === true ? raw.probability : 1 - raw.probability
}

/**
 * What became of one raw answer.
 *
 * 'undecided' and 'unreadable' are NOT the same thing and must not be merged.
 * Undecided is the model speaking: it answered, and the answer sits below the
 * threshold or inside the undecided band, which is an ordinary designed
 * outcome and belongs to the fallback. Unreadable is the model failing to
 * speak in a shape we understand, which is a failure like a dropped
 * connection: nothing was learned, and treating it as a quiet "no" is how a
 * missing field became a confident answer.
 */
type Interpretation =
  | { status: 'decided'; value: unknown }
  | { status: 'undecided'; value: null }
  | { status: 'unreadable'; reason: string }

/** The value when it is a real, finite number, and null for anything else. */
function finiteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

/** Turns a raw model answer into the question's value type. */
function interpret(question: Question, raw: RawAnswer): Interpretation {
  if (question.shape === 'boolean') {
    // A boolean answer IS its probability of true, so without a number there
    // is no answer here - not a false one. client.ts reports that as a null
    // value rather than a coerced 0, and this is where it becomes a failure
    // instead of a decision.
    const probability = finiteNumber(raw.value) ?? finiteNumber(raw.probability)
    if (probability === null) {
      return {
        status: 'unreadable',
        reason: `boolean answer for ${question.id} carried no probability of true`
      }
    }
    const band = question.undecidedBand ?? 0
    if (band > 0 && Math.abs(probability - question.threshold) < band) {
      return { status: 'undecided', value: null }
    }
    return { status: 'decided', value: probability >= question.threshold }
  }

  if (question.shape === 'choice') {
    const probability = raw.probability ?? 0
    if (probability < question.threshold) return { status: 'undecided', value: null }
    return { status: 'decided', value: String(raw.value) }
  }

  // Scores are banded by the caller, so every score is taken as decided.
  return { status: 'decided', value: Number(raw.value) }
}

/**
 * The answer for a question the model WAS asked and did not usably answer: the
 * transport failed or timed out, the response omitted this question, or its
 * answer arrived in a shape this module cannot read.
 *
 * This is the only route by which failSafe reaches a caller other than through
 * a throwing fallback, and which of the two is returned is the question's own
 * declaration - see `whenUnanswered` in types.ts. The default stays the
 * fallback, because for most questions the fallback is a perfectly good
 * incumbent answer and a failed network call is no reason to throw it away.
 * page.isInternal declares otherwise, because its fallback is the two-substring
 * rule the question exists to replace, and answering "not internal" on a
 * failure publishes a client's staff area.
 *
 * The fallback is run either way: the shadow log's whole value is the
 * comparison against what the old path would have said, and a failure is
 * exactly when that is worth recording.
 *
 * Not in shadow mode, though. Shadow mode's entire promise is that turning the
 * module on changes nothing, and it is the default; if a failed request could
 * exclude a page while shadowing, every endpoint hiccup would silently start
 * dropping pages from imports that had not opted in to anything. A question
 * the model's answer would not have been used for has no failure to be safe
 * about. A fallback that THREW is still a failSafe even here, because there
 * is then no old-path answer to return - that rule predates this one.
 */
function recordUnanswered(
  question: Question,
  state: string,
  context: DecisionContext,
  usage: DecisionUsage | undefined,
  error: string,
  shadow: boolean
): Answer<unknown> {
  const fallback = runFallback(question, state, context)
  const useFailSafe = fallback.threw || (!shadow && question.whenUnanswered === 'failSafe')
  const answer = answerOf(
    question,
    useFailSafe ? question.failSafe : fallback.value,
    'error',
    { error: fallback.threw ? `${error}; fallback threw` : error }
  )
  recordDecision({ answer, fallbackValue: fallback.value, usage, ...context })
  return answer
}

/**
 * The answer for a question that never reached the model at all: an id that is
 * not registered, or a state builder that threw before anything could be asked.
 *
 * There is no fallback to run here - running one needs the state that could not
 * be built - so a registered question gets its failSafe regardless of
 * `whenUnanswered`, which chooses between two things only one of which exists
 * on this path. An unregistered id has neither a failSafe nor a version, and
 * `undefined` is the honest answer there: nothing was asked, so nothing can be
 * said.
 *
 * Callers that gate on `source` never see this value, and the workflow router
 * and the page-template selector both do. sitemap-discovery does not: it reads
 * `answer.value === true` directly, and `undefined` read as "publish it".
 */
function unaskedAnswer<TValue>(questionId: string, message: string): Answer<TValue> {
  const question = hasQuestion(questionId) ? getQuestion(questionId) : null
  return {
    value: (question ? question.failSafe : undefined) as TValue,
    source: 'error',
    probability: null,
    confidence: null,
    questionId,
    questionVersion: question?.version ?? 0,
    error: message
  }
}

async function resolve(
  questionIds: string[],
  source: EvidenceSource,
  context: DecisionContext
): Promise<Record<string, Answer<unknown>>> {
  const questions = questionIds.map(getQuestion)
  const out: Record<string, Answer<unknown>> = {}

  // A panel shares one state, so every question in it must agree on facets.
  const facets = [...new Set(questions.flatMap(question => question.facets))]
  const maxChars = Math.min(...questions.map(question => question.maxChars ?? Infinity))
  const state = buildState(source, facets, Number.isFinite(maxChars) ? maxChars : undefined)

  // A panel is enabled only if every member can run. Questions differ on
  // whether the allowlist applies to them, so the strictest member decides.
  const tenantScoped = questions.every(question => question.tenantScoped !== false)
  if (!isDecisionModelEnabledFor(questionIds, context.websiteId, { tenantScoped })) {
    for (const question of questions) {
      const fallback = runFallback(question, state, context)
      out[question.id] = answerOf(
        question,
        fallback.value,
        fallback.threw ? 'error' : 'disabled',
        fallback.threw ? { error: 'fallback threw' } : {}
      )
    }
    return out
  }

  let raw: Record<string, RawAnswer> | null = null
  let usage: DecisionUsage | undefined
  let transportError: string | undefined
  try {
    const prepared = await Promise.all(questions.map(resolveCriteria))
    const response = await getClient().askRaw(state, prepared)
    raw = response.answers
    usage = response.usage
  } catch (error) {
    transportError = error instanceof Error ? error.message : String(error)
  }

  const shadow = getDecisionConfig().shadow

  for (const question of questions) {
    const rawAnswer = raw?.[question.id]

    if (!rawAnswer) {
      out[question.id] = recordUnanswered(
        question,
        state,
        context,
        usage,
        transportError ?? `no answer for ${question.id}`,
        shadow
      )
      continue
    }

    const interpreted = interpret(question, rawAnswer)

    if (interpreted.status === 'unreadable') {
      // An answer arrived and we could not read it. That is a failure, not a
      // quiet "no", and it gets the same treatment as no answer at all.
      out[question.id] = recordUnanswered(question, state, context, usage, interpreted.reason, shadow)
      continue
    }

    if (interpreted.status === 'undecided') {
      const fallback = runFallback(question, state, context)
      const answer = answerOf(question, fallback.value, fallback.threw ? 'error' : 'fallback')
      out[question.id] = answer
      recordDecision({
        answer: { ...answer, probability: rawAnswer.probability },
        modelValue: interpreted.value,
        fallbackValue: fallback.value,
        usage,
        ...context
      })
      continue
    }

    if (shadow) {
      // Ask, record, but keep using the old path. A fallback that threw is an
      // error even in shadow mode: the value returned is the failSafe, not the
      // old path's answer, and saying 'shadow' would hide that.
      const fallback = runFallback(question, state, context)
      const answer = answerOf(
        question,
        fallback.value,
        fallback.threw ? 'error' : 'shadow',
        fallback.threw ? { error: 'fallback threw' } : {}
      )
      out[question.id] = answer
      recordDecision({
        answer: { ...answer, probability: rawAnswer.probability },
        modelValue: interpreted.value,
        fallbackValue: fallback.value,
        usage,
        ...context
      })
      continue
    }

    const answer = answerOf(question, interpreted.value, 'model', {
      probability: probabilityOfValue(question, rawAnswer, interpreted.value),
      confidence: rawAnswer.confidence,
      distribution: rawAnswer.distribution
    })
    out[question.id] = answer
    // The caller gets the probability of the value it was handed; the log keeps
    // the raw wire probability, which is what derive-thresholds reads.
    recordDecision({
      answer: { ...answer, probability: rawAnswer.probability },
      modelValue: interpreted.value,
      usage,
      ...context
    })
  }

  return out
}

export async function ask<TValue>(
  questionId: string,
  source: EvidenceSource,
  context: DecisionContext = {}
): Promise<Answer<TValue>> {
  try {
    const answers = await resolve([questionId], source, { url: source.url, ...context })
    return answers[questionId] as Answer<TValue>
  } catch (error) {
    // Last resort: a question that is not registered, or a state builder that
    // threw. ask() never throws, so callers need no try/catch.
    const message = error instanceof Error ? error.message : String(error)
    return unaskedAnswer<TValue>(questionId, message)
  }
}

/**
 * One request, many questions, one state. Fourteen questions cost about as much
 * as one.
 *
 * A panel is a versioned unit, not a bag: the model evaluates it jointly, and
 * adding a question measurably shifted other questions' probabilities across
 * thresholds. Changing a panel's membership means bumping every member's
 * version and re-deriving all their thresholds.
 */
export async function askPanel(
  questionIds: string[],
  source: EvidenceSource,
  context: DecisionContext = {}
): Promise<Record<string, Answer<unknown>>> {
  try {
    return await resolve(questionIds, source, { url: source.url, ...context })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const out: Record<string, Answer<unknown>> = {}
    for (const id of questionIds) {
      out[id] = unaskedAnswer<unknown>(id, message)
    }
    return out
  }
}
