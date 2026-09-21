/**
 * Is the user asking us to clone an existing site, or build a new one?
 *
 * Today an LLM answers this by returning an enum plus a `reasoning` string and
 * a `confidence` number it invents. The enum is the only part that changes what
 * happens: `reasoning` is debug logging, and `confidence` is not a measurement.
 *
 * Getting it wrong is expensive in one direction. "Build me a bakery site,
 * something like stripe.com" read as an import launches a full crawl of a third
 * party's website.
 *
 * @module decisions/questions/workflow
 */
import { defineQuestion } from '../registry'
import type { BooleanQuestion, DecisionContext, DecisionState } from '../types'

/** What the existing router already decided, handed in as the fallback. */
export interface WorkflowInput {
  workflow: 'import' | 'greenfield'
}

function isWorkflowInput(value: unknown): value is WorkflowInput {
  const workflow = (value as WorkflowInput | undefined)?.workflow
  return workflow === 'import' || workflow === 'greenfield'
}

export const workflowIsImport: BooleanQuestion = defineQuestion<BooleanQuestion>({
  id: 'workflow.isImport',
  version: 1,
  owner: 'studio',
  shape: 'boolean',
  facets: ['text'],
  // This runs before a website exists — it is what decides whether to create
  // one — so there is no websiteId to match against the allowlist.
  tenantScoped: false,

  instructions:
    'Is the user asking us to copy, clone or rebuild an existing website, ' +
    'rather than to build a new one from their description?',

  criteria: {
    true:
      'They are pointing at a site that already exists and asking for it to be ' +
      'imported, cloned, copied, migrated or rebuilt — theirs or one they name.',
    false:
      'They are describing a site they want created. A URL may appear as a style ' +
      'reference ("something like stripe.com", "inspired by…"), which is not a ' +
      'request to copy that site.'
  },

  // Asymmetric on purpose, like page.isInternal. Wrongly choosing greenfield
  // costs the user a retry; wrongly choosing import crawls a third party's
  // website. The undecided band sends genuinely ambiguous prompts — the ones
  // that mention a URL without saying what to do with it — to the fallback.
  threshold: 0.65,
  undecidedBand: 0.15,
  failSafe: false,

  // Whatever the existing router decided. Not recomputed here: the router
  // already ran, and duplicating its logic would add the kind of second
  // implementation this module exists to remove.
  fallback: (_state: DecisionState, context: DecisionContext): boolean => {
    return isWorkflowInput(context.input) ? context.input.workflow === 'import' : false
  }
})
