/**
 * Hero Processor
 *
 * Handles hero component processing including:
 * - Background image promotion from DOM snapshot (delegated to ProcessingEngine)
 * - Hero variant detection
 *
 * @module hero-processor
 */

import { executeBackgroundPromotion } from './processing-engine'
import { HeroSimpleDef } from '@/lib/studio/components/cms/heroes/hero-simple/hero-simple.def'
import type { DetectedComponent } from '@/lib/studio/import/detection/types'

interface HeroProcessorOptions {
  domSnapshot?: string | null
  pageUrl?: string
}

/**
 * Promotes hero-simple to hero-banner when background images are detected in DOM.
 * Delegates to ProcessingEngine.executeBackgroundPromotion using declarative rules.
 */
export function promoteHeroBackground(
  components: DetectedComponent[],
  options: HeroProcessorOptions
): void {
  const rules = HeroSimpleDef.processing?.backgroundPromotion
  if (!rules) {
    return
  }

  executeBackgroundPromotion(components, rules, {
    domSnapshot: options.domSnapshot,
    pageUrl: options.pageUrl,
  })
}
