/**
 * CTA Processor
 *
 * Handles CTA component processing including:
 * - Removal of inline CTAs that duplicate content in adjacent components (delegated to ProcessingEngine)
 *
 * @module cta-processor
 */

import { executeDeduplication } from './processing-engine'
import { CTASimpleDef } from '@/lib/studio/components/cms/cta/cta-simple/cta-simple.def'
import type { DetectedComponent } from '@/lib/studio/import/detection/types'

/**
 * Removes CTA components that are duplicated inline in adjacent two-column or timeline components.
 * Delegates to ProcessingEngine.executeDeduplication using declarative rules.
 */
export function removeInlineCtas(components: DetectedComponent[]): void {
  const rules = CTASimpleDef.processing?.deduplication
  if (!rules) {
    return
  }

  executeDeduplication(components, rules)
}
