/**
 * Template Resolution Service
 *
 * Provides template resolution logic for page imports.
 * This is the single source of truth for template matching and selection.
 *
 * @module template-resolver
 */

import { GENERIC_PAGE_TEMPLATE_KEY, FOLDER_TEMPLATE_KEY } from '@/lib/studio/pages/_core/constants'
import { normalizePath, normalizePathname, isHomePath } from '../../utils/path-utils'
import { PageData } from '../interfaces'
import {
  getPageCatalogSummary,
  type PageCatalogSummary,
  type PageCatalogTemplateSummary
} from '@/lib/studio/pages/catalog'
import { PageTemplateCategory } from '@/lib/studio/pages/_core/types'

export interface ResolvedTemplateMetadata {
  template: PageCatalogTemplateSummary
  templateKey: string
  templateName: string
  category: string
  isHomeEligible: boolean
  source: 'model' | 'fallback' | 'home-enforced'
  confidence?: number
  reason?: string
  requestedKey?: string
  enforcedHome: boolean
}

/**
 * Clamps confidence value to valid range [0, 1].
 */
export function clampConfidence(value: unknown): number | undefined {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return undefined
  }
  if (value < 0) return 0
  if (value > 1) return 1
  return value
}

/**
 * Matches a template by route hints from the catalog.
 * Returns the template key if found, undefined otherwise.
 */
export function matchTemplateByRouteHints(
  path: string,
  summary: PageCatalogSummary
): string | undefined {
  for (const template of summary.templates) {
    const hints = template.aiMetadata.routeHints || []
    for (const hint of hints) {
      const trimmed = (hint || '').trim()
      if (!trimmed) continue
      const preferPrefix = trimmed.endsWith('/') && trimmed !== '/'
      const normalizedHint = normalizePathname(trimmed)
      if (normalizedHint === '/' && isHomePath(path)) {
        return template.templateKey
      }
      if (preferPrefix) {
        if (normalizedHint === '/') {
          if (!isHomePath(path)) {
            return template.templateKey
          }
        } else if (path === normalizedHint || path.startsWith(`${normalizedHint}/`)) {
          return template.templateKey
        }
      } else {
        if (path === normalizedHint) {
          return template.templateKey
        }
      }
    }
  }
  return undefined
}

/**
 * Picks a home-eligible template from the catalog.
 * Returns the template key if found, undefined otherwise.
 */
export function pickHomeTemplateKey(summary: PageCatalogSummary): string | undefined {
  if (summary.homeEligibleTemplates.length > 0) {
    return summary.homeEligibleTemplates[0]
  }
  const fallback = summary.templates.find(template => template.isHomeEligible)
  return fallback?.templateKey
}

/**
 * Picks the fallback template from the catalog.
 * Returns the template key if found, undefined otherwise.
 */
export function pickFallbackTemplateKey(summary: PageCatalogSummary): string | undefined {
  const preferredGeneric = summary.templates.find(template => template.templateKey === GENERIC_PAGE_TEMPLATE_KEY)
  if (preferredGeneric) {
    return preferredGeneric.templateKey
  }

  const coreNonFolder = summary.templates.find(
    template => template.category === PageTemplateCategory.Core && template.templateKey !== FOLDER_TEMPLATE_KEY
  )
  if (coreNonFolder) {
    return coreNonFolder.templateKey
  }

  return summary.templates[0]?.templateKey
}

/**
 * Finds a template by category with optional predicate.
 */
export function findTemplateByCategory(
  summary: PageCatalogSummary,
  category: PageTemplateCategory,
  predicate?: (templateKey: string) => boolean
): string | undefined {
  for (const template of summary.templates) {
    if (template.category !== category) continue
    if (!predicate || predicate(template.templateKey)) {
      return template.templateKey
    }
  }
  return undefined
}

/**
 * Infers template key from URL path patterns.
 * This is used as a fallback when no explicit template is specified.
 */
export function inferTemplateKeyFromUrl(path: string, summary: PageCatalogSummary): string {
  const normalizedPath = normalizePath(path)

  // Try route hints first
  const byRouteHint = matchTemplateByRouteHints(normalizedPath, summary)
  if (byRouteHint) {
    return byRouteHint
  }

  // Home page
  if (isHomePath(normalizedPath)) {
    return pickHomeTemplateKey(summary) ?? pickFallbackTemplateKey(summary) ?? 'marketing/home-default'
  }

  // Blog/content paths
  if (/(blog|insights|resources)(\/|$)/i.test(normalizedPath)) {
    const isIndex =
      normalizedPath === '/blog' ||
      normalizedPath === '/insights' ||
      normalizedPath === '/resources'
    if (isIndex) {
      return (
        findTemplateByCategory(summary, PageTemplateCategory.Blog, key => key.includes('index')) ??
        findTemplateByCategory(summary, PageTemplateCategory.Blog) ??
        pickFallbackTemplateKey(summary) ??
        'marketing/home-default'
      )
    }
    return (
      findTemplateByCategory(summary, PageTemplateCategory.Blog, key => key.includes('post')) ??
      findTemplateByCategory(summary, PageTemplateCategory.Blog) ??
      pickFallbackTemplateKey(summary) ??
      'marketing/home-default'
    )
  }

  // Commerce paths
  if (/(product|products|pricing|plans)(\/|$)/i.test(normalizedPath)) {
    const commerce = findTemplateByCategory(summary, PageTemplateCategory.Commerce)
    if (commerce) {
      return commerce
    }
  }

  // Default fallback
  return pickFallbackTemplateKey(summary) ?? 'marketing/home-default'
}

/**
 * Ensures a template is home-eligible if the path is a home path.
 * Returns the adjusted template key.
 */
export function ensureHomeEligible(
  templateKey: string,
  path: string,
  summary: PageCatalogSummary
): string {
  if (!isHomePath(path)) {
    return templateKey
  }
  const registry = new Map(summary.templates.map(template => [template.templateKey, template]))
  const template = registry.get(templateKey)
  if (template?.isHomeEligible) {
    return templateKey
  }
  return pickHomeTemplateKey(summary) ?? templateKey
}

/**
 * Sanitizes a reason string for storage.
 */
export function sanitizeReason(value?: string): string | undefined {
  if (!value) return undefined
  const trimmed = value.replace(/\s+/g, ' ').trim()
  return trimmed.length > 0 ? trimmed.slice(0, 240) : undefined
}

/**
 * Main template resolver class.
 * Provides the high-level resolve() method for page imports.
 */
export class TemplateResolver {
  constructor(private readonly loadSummary = getPageCatalogSummary) {}

  async resolve(pageData: PageData): Promise<ResolvedTemplateMetadata | undefined> {
    try {
      const summary = await this.loadSummary()
      if (!summary.templates || summary.templates.length === 0) {
        return undefined
      }

      const path = normalizePath(pageData.url)
      const registry = new Map(summary.templates.map(template => [template.templateKey, template]))

      const candidate = pageData.pageTemplate
      const requestedKey = candidate?.templateKey?.trim() || undefined
      let template = requestedKey ? registry.get(requestedKey) : undefined
      let source: 'model' | 'fallback' | 'home-enforced' = candidate?.source === 'home-enforced'
        ? 'home-enforced'
        : candidate?.source === 'fallback'
          ? 'fallback'
          : candidate
            ? 'model'
            : 'fallback'
      let reason = candidate?.reason
      let enforcedHome = false

      if (requestedKey && !template) {
        source = 'fallback'
        const note = `Template ${requestedKey} is not registered; applying fallback.`
        reason = reason ? `${reason} | ${note}` : note
      }

      if (!template) {
        const hinted = this.matchTemplateByRouteHintsInternal(path, summary)
        if (hinted) {
          template = hinted
          if (source !== 'home-enforced') {
            source = 'fallback'
          }
        }
      }

      if (!template && isHomePath(path)) {
        template = this.pickHomeTemplate(summary)
        if (template) {
          source = 'fallback'
        }
      }

      if (!template) {
        template = this.pickFallbackTemplate(summary)
        if (template) {
          source = 'fallback'
        }
      }

      if (!template) {
        return undefined
      }

      if (isHomePath(path) && !template.isHomeEligible) {
        const homeTemplate = this.pickHomeTemplate(summary)
        if (homeTemplate && homeTemplate.templateKey !== template.templateKey) {
          template = homeTemplate
          source = 'home-enforced'
          enforcedHome = true
          const note = `Home path requires a home-eligible template; enforced ${homeTemplate.templateKey}.`
          reason = reason ? `${reason} | ${note}` : note
        }
      }

      let confidence = clampConfidence(candidate?.confidence)
      const templateChanged = Boolean(requestedKey && template.templateKey !== requestedKey)
      if (templateChanged && source !== 'home-enforced') {
        confidence = 0
        const note = `Confidence reset after falling back to ${template.templateKey}.`
        if (!reason) {
          reason = note
        } else if (!reason.includes(note)) {
          reason = `${reason} | ${note}`
        }
      }

      return {
        template,
        templateKey: template.templateKey,
        templateName: template.name,
        category: template.category,
        isHomeEligible: template.isHomeEligible,
        source,
        confidence,
        reason,
        requestedKey,
        enforcedHome
      }
    } catch (error) {
      console.warn('Failed to resolve page template metadata:', error)
      return undefined
    }
  }

  private matchTemplateByRouteHintsInternal(
    path: string,
    summary: PageCatalogSummary
  ): PageCatalogTemplateSummary | undefined {
    const key = matchTemplateByRouteHints(path, summary)
    if (!key) return undefined
    return summary.templates.find(template => template.templateKey === key)
  }

  private pickHomeTemplate(summary: PageCatalogSummary): PageCatalogTemplateSummary | undefined {
    const key = pickHomeTemplateKey(summary)
    if (!key) return undefined
    return summary.templates.find(template => template.templateKey === key)
  }

  private pickFallbackTemplate(summary: PageCatalogSummary): PageCatalogTemplateSummary | undefined {
    const key = pickFallbackTemplateKey(summary)
    if (!key) return undefined
    return summary.templates.find(template => template.templateKey === key)
  }
}
