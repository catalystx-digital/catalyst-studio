/**
 * Decision model transport. The only file that knows the wire format.
 *
 * Reached through the OpenAI SDK's generic post(), so this inherits the same
 * auth, headers and timeout handling the rest of the repo uses, without a
 * second HTTP stack. Verified working against the live endpoint.
 *
 * It constructs its own OpenAI instance rather than importing createLLMClient
 * from import/services/llm-client, which pulls in import/config and throws at
 * module load without IMPORT_MODEL_CHAIN.
 *
 * @module decisions/client
 */
import OpenAI from 'openai'

import { getDecisionConfig } from './config'
import type {
  DecisionClient,
  DecisionResponse,
  DecisionState,
  Question,
  RawAnswer
} from './types'

/** Our shape names to the endpoint's. 'noul' is its word for a boolean. */
const WIRE_TYPE: Record<Question['shape'], string> = {
  boolean: 'noul',
  choice: 'choice',
  score: 'score'
}

function toWireQuestion(question: Question): Record<string, unknown> {
  return {
    type: WIRE_TYPE[question.shape],
    instructions: question.instructions,
    // Boolean takes { true, false }, choice takes { option: description },
    // score takes an ORDERED ARRAY. They are not interchangeable.
    criteria: question.criteria
  }
}

/**
 * Normalises the three answer shapes, which disagree with each other:
 * boolean arrives under the key `noul` and carries no confidence; choice has
 * `choice` plus `probabilities`; score has a continuous `score` plus a
 * zero-indexed `legend`, which is where a score's distribution lives — there
 * is no `probabilities` on a score answer.
 */
function fromWireAnswer(question: Question, raw: Record<string, any>): RawAnswer {
  if (question.shape === 'boolean') {
    // A boolean's whole answer is this one number, so there is nothing to
    // degrade to when it is missing. Coercing used to make one up: Number() of
    // an absent key is 0, and an endpoint answering { noul: true }, renaming
    // the key, or sending "0.9" as a string all landed on P(true) = 0 — which
    // ask() reads as a decided "false" and then publishes as a complemented
    // probability of 1.0. Maximum stated confidence, manufactured from a field
    // that never arrived. An unreadable answer is reported as no answer
    // instead, which routes it to the failure path in ask.ts.
    const probability = finiteNumber(raw?.noul) ?? finiteNumber(raw?.probability)
    if (probability === null) return { value: null, probability: null, confidence: null }
    return { value: probability, probability, confidence: null }
  }

  if (question.shape === 'choice') {
    const choice = String(raw?.choice ?? '')
    const distribution = (raw?.probabilities ?? {}) as Record<string, number>
    return {
      value: choice,
      probability: typeof distribution[choice] === 'number' ? distribution[choice] : null,
      confidence: typeof raw?.confidence === 'number' ? raw.confidence : null,
      distribution
    }
  }

  // Score. The distribution arrives as `legend`, keyed by ZERO-BASED level
  // index — legend['0'] is the mass on criteria[0] — and nothing arrives under
  // `probabilities`, which is the choice shape's key. Reading `probabilities`
  // here left every score answer with an empty distribution and a null
  // probability, which the shadow log then recorded as no observation at all.
  // `probabilities` is still read as a fallback so an endpoint that does send
  // that key is not ignored.
  const score = typeof raw?.score === 'number' ? raw.score : 0
  const distribution = numericMap(raw?.legend) ?? numericMap(raw?.probabilities) ?? {}

  // A continuous score has no single "probability of this value": the model
  // spreads mass across ordered levels. The mass on the level the score rounds
  // to is the closest honest reading — it is the probability of the level a
  // caller banding this score would land on — and it degrades sensibly: a
  // score sitting between two levels reports the lower mass of the two, which
  // is what a confidence gate should see. Null when the legend is absent
  // rather than a number invented from the score itself.
  const nearestLevel = String(Math.round(score))
  const probability = typeof distribution[nearestLevel] === 'number'
    ? distribution[nearestLevel]
    : null

  return {
    value: score,
    probability,
    confidence: typeof raw?.confidence === 'number' ? raw.confidence : null,
    distribution
  }
}

/** The value when it is a real, finite number, and null for anything else. */
function finiteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

/**
 * A wire map of key to number, or null when it is missing or holds no numbers.
 * An array is accepted and keyed by its indices, because a zero-indexed legend
 * may arrive either way and both mean the same thing.
 */
function numericMap(value: unknown): Record<string, number> | null {
  if (!value || typeof value !== 'object') return null
  const entries = Object.entries(value as Record<string, unknown>)
    .filter((entry): entry is [string, number] => typeof entry[1] === 'number')
  return entries.length > 0 ? Object.fromEntries(entries) : null
}

export function createDecisionClient(): DecisionClient {
  const config = getDecisionConfig()
  const client = new OpenAI({
    apiKey: config.apiKey ?? '',
    baseURL: config.baseUrl,
    timeout: config.timeoutMs,
    defaultHeaders: { 'X-Title': 'Catalyst Decision Model' }
  })

  return {
    async askRaw(state: DecisionState, questions: Question[]): Promise<DecisionResponse> {
      // questions is an OBJECT keyed by id on the wire, not an array.
      const wireQuestions: Record<string, unknown> = {}
      for (const question of questions) {
        wireQuestions[question.id] = toWireQuestion(question)
      }

      const startedAt = Date.now()
      const body = (await (client as any).post('/alpha/decisions', {
        body: { model: config.modelId, state, questions: wireQuestions }
      })) as Record<string, any>
      const latencyMs = Date.now() - startedAt

      if (!body || typeof body !== 'object' || !body.answers) {
        throw new Error('Decision model returned no answers')
      }

      const answers: Record<string, RawAnswer> = {}
      for (const question of questions) {
        const raw = body.answers[question.id]
        if (!raw) throw new Error(`Decision model omitted an answer for ${question.id}`)
        answers[question.id] = fromWireAnswer(question, raw)
      }

      // The usage envelope uses different field names from the chat endpoint:
      // input_tokens / output_tokens / cost, not prompt_tokens / completion_tokens
      // / total_cost. Map it here, once.
      return {
        answers,
        usage: {
          inputTokens: Number(body.usage?.input_tokens ?? 0),
          outputTokens: Number(body.usage?.output_tokens ?? 0),
          cost: Number(body.usage?.cost ?? 0),
          latencyMs
        }
      }
    }
  }
}

/**
 * Test double. Ships with the module so no test hand-rolls an openai mock —
 * four separate files in this repo already do that, and this is not the fifth.
 *
 * Values follow the RawAnswer convention: a boolean question's value is the
 * probability of true, a choice's is the winning key, a score's is the number.
 */
export function createFakeDecisionClient(
  answers: Record<string, number | string | Partial<RawAnswer>>,
  options: { failWith?: Error } = {}
): DecisionClient {
  return {
    async askRaw(_state: DecisionState, questions: Question[]): Promise<DecisionResponse> {
      if (options.failWith) throw options.failWith

      const resolved: Record<string, RawAnswer> = {}
      for (const question of questions) {
        const canned = answers[question.id]
        if (canned === undefined) {
          throw new Error(`Fake decision client has no answer for ${question.id}`)
        }
        if (typeof canned === 'number' || typeof canned === 'string') {
          resolved[question.id] = {
            value: canned,
            probability: typeof canned === 'number' ? canned : 1,
            confidence: null
          }
        } else {
          resolved[question.id] = {
            value: canned.value ?? 0,
            probability: canned.probability ?? null,
            confidence: canned.confidence ?? null,
            distribution: canned.distribution
          }
        }
      }

      return {
        answers: resolved,
        usage: { inputTokens: 0, outputTokens: 0, cost: 0, latencyMs: 0 }
      }
    }
  }
}
