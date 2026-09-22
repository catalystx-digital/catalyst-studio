/**
 * Decision model — question and answer types.
 *
 * A decision model answers pre-declared, typed questions and returns a
 * calibrated probability. It cannot generate text. Three answer shapes exist
 * because the model supports three, and their wire formats are not symmetrical
 * (see client.ts).
 *
 * This file has no runtime imports on purpose: it must be safe to import from
 * anywhere, including modules that must not pull in chat-model configuration.
 *
 * @module decisions/types
 */

/** Where an answer actually came from. Set by ask(), never by a caller. */
export type DecisionSource =
  /** The model answered and its answer was used. */
  | 'model'
  /** The model answered but below threshold, so the fallback was used. */
  | 'fallback'
  /** Shadow mode: the model was asked, the fallback's answer was returned. */
  | 'shadow'
  /** The model is off, or this website is not in the allowlist. */
  | 'disabled'
  /** The call failed, or the fallback threw. */
  | 'error'

/** The evidence a question is asked against. Built by state.ts. */
export type DecisionState = string

/** Which projections of the source a question wants rendered into its state. */
export type Facet =
  | 'counts'
  | 'headings'
  | 'text'
  | 'links'
  | 'media'
  | 'structure'
  | 'nodes'
  | 'url'

export interface QuestionBase<TValue> {
  /** Namespaced, stable, never reused. For example 'page.isHome'. */
  id: string
  /**
   * Bump on ANY change to instructions, criteria, threshold or facets.
   * Shadow-log rows and cached answers are grouped by (id, version), so a
   * change that does not bump this silently mixes old and new evidence.
   */
  version: number
  /** The question, phrased as a person would ask it. */
  instructions: string
  /** Team or person accountable for re-deriving the threshold. */
  owner: string
  /** Which projections of the source get rendered into the state. */
  facets: Facet[]
  /** State budget in characters. Truncation is explicit and marked. */
  maxChars?: number
  /**
   * Whether the per-website allowlist applies to this question. Defaults true.
   *
   * Set false only when the question is genuinely asked before any website
   * exists — workflow.isImport decides whether to create one. Such a question
   * cannot be scoped to a tenant, and without this flag an allowlisted rollout
   * would disable it permanently and silently rather than scoping it.
   */
  tenantScoped?: boolean
  /**
   * Declares that this question exists ONLY to put rows in the shadow log.
   *
   * A question marked 'record-only' has no derived threshold and no evidence
   * behind it yet, so no call site may branch on its answer: not to skip, drop,
   * flag, reorder or annotate anything. The declaration is here rather than in
   * a comment so a test can assert it, and so anyone reading the question sees
   * the constraint before they read the criteria.
   *
   * Removing this field is the deliberate act of promoting a question from
   * evidence-gathering to behaviour, and must come with the observations and a
   * derived threshold that justify it.
   */
  effect?: 'record-only'
  /**
   * Today's heuristic. Never deleted — it runs whenever the model is off,
   * unavailable, or answers below threshold, which is its state on day one
   * and after any incident.
   */
  fallback: (state: DecisionState, context: DecisionContext) => TValue
  /**
   * Returned when the fallback cannot be trusted to answer: it threw, or the
   * model was asked, gave nothing usable, and this question declares
   * `whenUnanswered: 'failSafe'`. Choose the direction in which being wrong is
   * cheapest.
   */
  failSafe: TValue
  /**
   * What to return when the model WAS asked and no usable answer came back —
   * the request failed or timed out, the response omitted this question, or
   * its answer arrived in a shape this module cannot read.
   *
   * 'fallback', the default, keeps today's heuristic running. That is right
   * wherever the fallback is an adequate incumbent answer that happens to be
   * getting a second opinion: page.type's deterministic scorer and
   * workflow.isImport's router both are, and discarding them because a network
   * call failed would lose a good answer for no safety gain.
   *
   * 'failSafe' returns `failSafe` instead. It belongs to a question whose
   * fallback is known to be inadequate and whose errors are expensive in one
   * direction. page.isInternal is exactly that: its fallback matches two
   * hardcoded substrings, so answering "not internal" on a failure publishes a
   * client's staff area, which is the very thing the question was added to
   * stop.
   *
   * THIS IS NOT THE UNCERTAIN PATH, and wiring it to one would be a serious
   * mistake. A model answer below threshold, or inside the undecided band, is
   * an ordinary designed outcome and always runs the fallback:
   * page.isInternal's threshold of 0.84 puts most pages there on purpose, and
   * fail-safing them would exclude nearly every page from every import. A
   * disabled model is not a failure either — with the module off the fallback
   * IS the system's answer, unchanged from the day before this module existed.
   */
  whenUnanswered?: 'fallback' | 'failSafe'
}

export interface BooleanQuestion extends QuestionBase<boolean> {
  shape: 'boolean'
  criteria: { true: string; false: string }
  /** probability >= threshold means true. */
  threshold: number
  /**
   * Half-width of a band around the threshold treated as "cannot decide",
   * which falls back rather than guessing. Omit or set 0 to take every answer.
   */
  undecidedBand?: number
}

/**
 * Options may come from a runtime registry — page templates, the component
 * catalogue — in which case hardcoding them here would create exactly the kind
 * of duplicate table this module exists to remove. A resolver is called once
 * per ask and its result validated then.
 */
export type CriteriaResolver<TOption extends string = string> =
  () => Promise<Record<TOption, string>> | Record<TOption, string>

export interface ChoiceQuestion<TOption extends string = string>
  extends QuestionBase<TOption | null> {
  shape: 'choice'
  /** Option key to what that option means. At most 255 keys, however resolved. */
  criteria: Record<TOption, string> | CriteriaResolver<TOption>
  /** The winning option's probability must reach this, or the fallback runs. */
  threshold: number
}

export interface ScoreQuestion extends QuestionBase<number> {
  shape: 'score'
  /** ORDERED level descriptions, 2 to 10 of them. An array, not an object. */
  criteria: string[]
}

export type Question = BooleanQuestion | ChoiceQuestion | ScoreQuestion

/** Anything the state builder or a fallback needs beyond the state itself. */
export interface DecisionContext {
  url?: string
  websiteId?: string
  traceId?: string
  /**
   * Call-site data the fallback needs and the state cannot carry — for example
   * the page-template scorer's existing answer, which depends on the page
   * catalogue and the detected components rather than on the page's text.
   *
   * Questions narrow this themselves. Without it, only questions whose
   * fallback depends solely on the URL could be expressed.
   */
  input?: unknown
}

export interface Answer<TValue> {
  value: TValue
  source: DecisionSource
  /**
   * The model's probability for THE VALUE IN `value`, not for the wire's
   * reference outcome. A boolean question is answered on the wire as P(true),
   * so an answer of false carries 1 - P(true): a confident "no" reads 0.97,
   * not 0.03. Choice carries the winning option's mass and score the mass on
   * the nearest level.
   *
   * Null whenever source is not 'model' — deliberately not a
   * plausible-looking number, because downstream gates read these as if they
   * mean something.
   *
   * The shadow log records the raw wire probability instead; threshold
   * derivation needs one consistent scale. See ask.ts.
   */
  probability: number | null
  /** Choice and score only. Boolean answers carry no confidence. */
  confidence: number | null
  /** Full distribution when the model answered, for threshold derivation. */
  distribution?: Record<string, number>
  questionId: string
  questionVersion: number
  /** Populated when source is 'error', for the shadow log. */
  error?: string
}

/** What client.ts returns, before thresholds or fallbacks are applied. */
export interface RawAnswer {
  /**
   * Boolean: probability of true. Choice: the winning key. Score: the value.
   *
   * Null when the endpoint's answer could not be read at all. A boolean is the
   * shape that needs this: its value carries the whole answer, so coercing an
   * unreadable one to a number invents a confident decision. See client.ts.
   */
  value: boolean | string | number | null
  probability: number | null
  confidence: number | null
  distribution?: Record<string, number>
}

export interface DecisionUsage {
  inputTokens: number
  outputTokens: number
  cost: number
  latencyMs: number
}

export interface DecisionResponse {
  answers: Record<string, RawAnswer>
  usage: DecisionUsage
}

/** The transport. Swapped for a fake in tests; see client.ts. */
export interface DecisionClient {
  askRaw(
    state: DecisionState,
    questions: Question[]
  ): Promise<DecisionResponse>
}
