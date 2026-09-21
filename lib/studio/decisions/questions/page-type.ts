/**
 * Which page template should this page be imported as?
 *
 * Today selectPageTemplate (web-detection.ts) answers this by keyword-scoring
 * the URL path. It never reads the page, yet returns source:'model' and
 * confidence:0.8. Measured on ten live pages it scored 9/10; the failure was
 * instructive — /directory scored against "folder" keywords and became
 * core/folder, a non-routable container, so the page would have vanished from
 * the site. The same ten pages judged on content scored 10/10.
 *
 * @module decisions/questions/page-type
 */
import { defineQuestion } from '../registry'
import type { ChoiceQuestion, DecisionContext, DecisionState } from '../types'

/** What selectPageTemplate already worked out, handed in as the fallback. */
export interface PageTypeInput {
  /** The template key the deterministic scorer chose. */
  deterministicTemplateKey: string
}

function isPageTypeInput(value: unknown): value is PageTypeInput {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as PageTypeInput).deterministicTemplateKey === 'string'
  )
}

export const pageType: ChoiceQuestion = defineQuestion<ChoiceQuestion>({
  id: 'page.type',
  version: 1,
  owner: 'import',
  shape: 'choice',
  // Content, not just the path — the point of the question is that the current
  // scorer never looks at the page.
  facets: ['url', 'counts', 'headings', 'text'],

  instructions:
    'Given everything this page actually contains, which page template should ' +
    'it be imported as? Judge by the page content and purpose, not by its URL.',

  // Options come from the page catalogue. Hardcoding them here would make this
  // one more copy of a table the codebase already keeps in several places.
  criteria: async () => {
    const { getPageCatalogSummary } = await import('@/lib/studio/ai/page-catalog')
    const summary = await getPageCatalogSummary()
    const criteria: Record<string, string> = {}
    for (const template of summary.templates) {
      criteria[template.templateKey] =
        (template.description || template.name || template.templateKey)
          .replace(/\s+/g, ' ')
          .trim()
    }
    return criteria
  },

  // Above this, take the model's answer; below it, keep the scorer's.
  // Provisional until derived from shadow observations — see the threshold
  // procedure in the registry spec. Recorded here so it is re-derived, not
  // forgotten.
  threshold: 0.5,

  failSafe: null,

  // The deterministic scorer's own answer, handed in by the call site. It
  // depends on the page catalogue and the detected components, neither of
  // which the page's text can carry.
  fallback: (_state: DecisionState, context: DecisionContext): string | null => {
    return isPageTypeInput(context.input) ? context.input.deterministicTemplateKey : null
  }
})
