/**
 * The shadow log.
 *
 * Not a telemetry system — a file. Shadow mode has to put its answers somewhere
 * or it does nothing but cost money and return the old value, but that
 * somewhere needs no database, schema migration or owner. The repo already
 * writes .import-cache/ and reports/eval/detection/*.json; this follows suit.
 *
 * Two rules keep it a file: append-only and never read at request time, and it
 * is developer evidence rather than product data — gitignored, disposable, and
 * nothing in the product may read it.
 *
 * @module decisions/shadow-log
 */
import fs from 'node:fs'
import path from 'node:path'

import { getDecisionConfig } from './config'
import type { Answer, DecisionUsage } from './types'

export interface ShadowRow {
  ts: string
  q: string
  v: number
  url?: string
  websiteId?: string
  source: string
  /** The model's probability for its own answer. Feeds threshold derivation. */
  p: number | null
  model: unknown
  fallback: unknown
  agreed: boolean | null
  ms?: number
  cost?: number
  error?: string
}

function safeFileName(questionId: string): string {
  return questionId.replace(/[^a-zA-Z0-9._-]/g, '_')
}

/**
 * Appends one JSONL line. Failures here must never affect a decision, so every
 * error is swallowed — a full disk should not break an import.
 */
export function appendShadowRow(row: ShadowRow): void {
  try {
    // Never write to the shared log from a test run. A fake client answering
    // the same probability to every url will otherwise bury the real rows:
    // one jest run put 145 example.com fixtures into a log holding 10 genuine
    // observations, and derive-thresholds then recommended a cut from them.
    // Tests that deliberately exercise logging opt back in by setting
    // DECISION_MODEL_LOG_DIR explicitly.
    if (process.env.NODE_ENV === 'test' && !process.env.DECISION_MODEL_LOG_DIR) {
      return
    }
    const { logDir } = getDecisionConfig()
    fs.mkdirSync(logDir, { recursive: true })
    fs.appendFileSync(
      path.join(logDir, `${safeFileName(row.q)}.jsonl`),
      `${JSON.stringify(row)}\n`,
      'utf8'
    )
  } catch {
    // Intentionally silent. See above.
  }
}

export function recordDecision(input: {
  answer: Answer<unknown>
  modelValue?: unknown
  fallbackValue?: unknown
  usage?: DecisionUsage
  url?: string
  websiteId?: string
}): void {
  const { answer, modelValue, fallbackValue, usage } = input
  // A null model value means the model did not decide — the undecided band, or
  // a choice below threshold. There is no model answer to agree or disagree
  // with, so `agreed` stays null; recording false would report every
  // undecided answer as a disagreement for a human to read through.
  const comparable =
    modelValue !== undefined && modelValue !== null && fallbackValue !== undefined

  appendShadowRow({
    ts: new Date().toISOString(),
    q: answer.questionId,
    v: answer.questionVersion,
    url: input.url,
    websiteId: input.websiteId,
    source: answer.source,
    p: answer.probability,
    model: modelValue,
    fallback: fallbackValue,
    agreed: comparable ? modelValue === fallbackValue : null,
    ms: usage?.latencyMs,
    cost: usage?.cost,
    error: answer.error
  })
}
