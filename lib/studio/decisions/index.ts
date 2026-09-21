/**
 * Decision model — public surface.
 *
 * A decision model answers pre-declared, typed questions and returns a
 * calibrated probability. It cannot generate text, so it replaces judgements
 * ("which component is this?", "is this page internal?") and never copy.
 *
 * Importing this module registers every question exactly once. It must stay
 * free of any dependency on lib/studio/import/config, which throws at module
 * load unless IMPORT_MODEL_CHAIN is set.
 *
 * @module decisions
 */

// Registration side effects. Keep these first.
import './questions/page'
import './questions/page-type'
import './questions/workflow'
import './questions/import-block'

export { ask, askPanel, setDecisionClient } from './ask'
export { createDecisionClient, createFakeDecisionClient } from './client'
export { getDecisionConfig, isDecisionModelEnabledFor } from './config'
export { defineQuestion, getQuestion, hasQuestion, listQuestions } from './registry'
export { buildState, enumerateNodes, DEFAULT_MAX_CHARS, MAX_ENUMERATED_NODES } from './state'
export type { EvidenceNode, EvidenceSource } from './state'
export { recordDecision } from './shadow-log'
export type {
  Answer,
  BooleanQuestion,
  ChoiceQuestion,
  DecisionClient,
  DecisionContext,
  DecisionSource,
  DecisionState,
  Facet,
  Question,
  RawAnswer,
  ScoreQuestion
} from './types'

export { pageIsInternal, pageIsInternalFromContent, matchesHardcodedInternalPath } from './questions/page'
export { pageType } from './questions/page-type'
export type { PageTypeInput } from './questions/page-type'
export { workflowIsImport } from './questions/workflow'
export type { WorkflowInput } from './questions/workflow'
