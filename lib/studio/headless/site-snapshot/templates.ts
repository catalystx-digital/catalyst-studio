import type { SiteSnapshot } from './types'
import { DEFAULT_TEMPLATE_KEY } from './constants'

export function resolveTemplateKey(original: string | null | undefined, override?: string): string {
  return override ?? original ?? DEFAULT_TEMPLATE_KEY
}

export function applyTemplateOverrides(snapshot: SiteSnapshot, override?: string): SiteSnapshot {
  return {
    ...snapshot,
    pages: snapshot.pages.map(page => ({
      ...page,
      templateKey: resolveTemplateKey(page.templateKey, override)
    }))
  }
}
