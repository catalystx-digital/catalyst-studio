import type { Page } from 'playwright-core'

import type { DomAnalysisOptions, DomAnalysisResult } from './dom-analysis.cjs'

const {
  analyzeDomDocument,
  __INTERNAL_ANALYSIS_IMPLEMENTATION
} = require('./dom-analysis.cjs.js') as typeof import('./dom-analysis.cjs.js')

export { analyzeDomDocument }
export type { DomAnalysisOptions, DomAnalysisResult }

export async function extractDesignSystemFromDom(page: Page, options?: DomAnalysisOptions): Promise<DomAnalysisResult> {
  const implementationSource = __INTERNAL_ANALYSIS_IMPLEMENTATION.toString()
  return page.evaluate(
    ({ source, opts }) => {
      const globalAny = globalThis as { __name?: (fn: any, value?: string) => any }
      if (typeof globalAny.__name !== 'function') {
        globalAny.__name = (fn: any) => fn
      }
      // eslint-disable-next-line no-new-func
      const implementation = new Function(`return (${source});`)() as (
        documentRef: Document,
        windowRef: Window,
        innerOptions?: DomAnalysisOptions
      ) => DomAnalysisResult
      return implementation(document, window, opts ?? undefined)
    },
    { source: implementationSource, opts: options ?? null }
  )
}
