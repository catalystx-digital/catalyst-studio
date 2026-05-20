import type { ComponentPattern, DetectedComponent, DetectedPageTemplate, PageMetadata } from './types'
import type { PageCatalogSummary, PageCatalogTemplateSummary } from '@/lib/studio/ai/page-catalog'
import {
  canonicalizeComponentType,
  ensureCanonicalComponentsRegistered,
  getCanonicalComponent,
  type CanonicalSynthesizeParams,
  type CanonicalSynthesisResult,
  type CanonicalSynthesizer
} from '@/lib/studio/import/detection/canonical'
import { getComponentContractByCanonicalType } from '@/lib/studio/components/catalog/component-contracts'

interface CanonicalizationParams {
  components: DetectedComponent[]
  template: DetectedPageTemplate
  pageSummary: PageCatalogSummary
  availableComponents: ComponentPattern[]
  pageUrl?: string
  pageMetadata?: PageMetadata
}

interface CanonicalRequirement {
  canonicalType: string
  region: string
  min: number
  allowedCanonicalTypes: string[]
  hints?: string[]
  metadata?: Record<string, unknown>
  source: 'manifest' | 'catalog'
}

type SynthesizeParams = CanonicalSynthesizeParams
type SynthesisResult = CanonicalSynthesisResult

export function applyTemplateCanonicalization({
  components,
  template,
  pageSummary,
  availableComponents,
  pageUrl,
  pageMetadata
}: CanonicalizationParams): DetectedComponent[] {
  ensureCanonicalComponentsRegistered()

  const templateSummary = findTemplateSummary(template.templateKey, pageSummary)
  if (!templateSummary) {
    console.warn('[DetectionCanonicalizer] template-missing', {
      templateKey: template.templateKey,
      pageUrl
    })
    return components
  }

  const requirements = deriveCanonicalRequirements(templateSummary)
  if (requirements.length === 0) {
    return components
  }

  const mutable = [...components]

  for (const requirement of requirements) {
    const satisfiedCount = countCanonicalInstancesForTypes(mutable, requirement.allowedCanonicalTypes)
    if (satisfiedCount >= requirement.min) {
      console.info('[DetectionCanonicalizer] canonical-present', {
        templateKey: template.templateKey,
        canonicalType: requirement.canonicalType,
        count: satisfiedCount,
        pageUrl,
        source: requirement.source
      })
      continue
    }

    const pattern = findPatternForCanonicalType(requirement.canonicalType, availableComponents)
    if (!pattern) {
      console.warn('[DetectionCanonicalizer] canonical-pattern-missing', {
        templateKey: template.templateKey,
        canonicalType: requirement.canonicalType,
        source: requirement.source,
        message: 'Call ensureCoreComponentTypes before detection so canonical components are registered.',
        pageUrl
      })
      continue
    }

    const result = synthesizeCanonicalComponent({
      canonicalType: requirement.canonicalType,
      region: requirement.region,
      components: mutable,
      pattern,
      pageUrl,
      templateKey: template.templateKey,
      pageMetadata,
      hints: requirement.hints,
      requirementMetadata: requirement.metadata
    })

    if (!result) {
      console.warn('[DetectionCanonicalizer] canonical-synthesis-failed', {
        templateKey: template.templateKey,
        canonicalType: requirement.canonicalType,
        source: requirement.source,
        pageUrl
      })
      continue
    }

    const synthesizedComponent = {
      ...result.component,
      content: ensureRegionOnContent(result.component.content, requirement.region),
      metadata: {
        ...(result.component.metadata || {}),
        region: requirement.region
      }
    }

    mutable.splice(result.insertIndex, 0, synthesizedComponent)
    console.info('[DetectionCanonicalizer] canonical-synthesized', {
      templateKey: template.templateKey,
      canonicalType: requirement.canonicalType,
      region: requirement.region,
      pageUrl,
      source: requirement.source
    })
  }

  return enforceCanonicalContentInvariants(mutable)
}


function enforceCanonicalContentInvariants(components: DetectedComponent[]): DetectedComponent[] {
  return components.map(component => {
    const canonicalType = canonicalizeComponentType(component.component ?? component.type ?? '')
    if (canonicalType === 'blog-post') {
      return normalizeBlogPostComponent(component)
    }
    return component
  })
}

function normalizeBlogPostComponent(component: DetectedComponent): DetectedComponent {
  const rawContent = component.content
  if (!rawContent || typeof rawContent !== 'object') {
    return component
  }

  const normalized = normalizeBlogPostContent(rawContent as Record<string, any>)
  if (normalized === rawContent) {
    return component
  }

  return {
    ...component,
    content: normalized
  }
}

function normalizeBlogPostContent(content: Record<string, any>): Record<string, any> {
  const next = { ...content }
  let changed = false

  const pickString = (value: unknown): string | undefined =>
    typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined
  const existingHtml = pickString(next.bodyHtml) ?? ''
  const fallback =
    pickString(next.body) ??
    pickString(next.bodyText) ??
    pickString(next.text)
  const excerpt = pickString(next.excerpt)

  if (!existingHtml && (fallback || excerpt)) {
    const generated = convertPlainTextToHtml(fallback || excerpt!)
    if (generated) {
      next.bodyHtml = generated
      changed = true
    }
  } else if (existingHtml && next.bodyHtml !== existingHtml) {
    next.bodyHtml = existingHtml
    changed = true
  }

  if ('body' in next) {
    delete next.body
    changed = true
  }

  if (!pickString(next.bodyText) && fallback) {
    next.bodyText = fallback
    changed = true
  }

  const deriveTitleFromText = (value: string | undefined): string | undefined => {
    if (!value) {
      return undefined
    }
    const normalized = value.replace(/\s+/g, ' ').trim()
    if (!normalized) {
      return undefined
    }
    const match = /(.+?[.!?])(\s|$)/.exec(normalized)
    return (match && match[1]) || normalized
  }

  const resolvedTitle =
    pickString(next.title) ??
    pickString(next.heading) ??
    pickString(next.name) ??
    pickString((next.metadata as Record<string, any> | undefined)?.title) ??
    pickString(next.subtitle) ??
    deriveTitleFromText(excerpt || fallback)
  if (!pickString(next.title) && resolvedTitle) {
    next.title = resolvedTitle
    changed = true
  }
  if (!pickString(next.title) && !resolvedTitle) {
    console.warn('[canonicalization] No title found for blog post, using fallback "Article"')
    next.title = 'Article'
    changed = true
  }

  return changed ? next : content
}

function convertPlainTextToHtml(value: string): string {
  const trimmed = value.trim()
  if (!trimmed) {
    return ''
  }
  if (/<[a-z][\s\S]*>/i.test(trimmed)) {
    return trimmed
  }

  const paragraphs = trimmed
    .split(/\n\s*\n+/)
    .map(part => part.trim())
    .filter(Boolean)
    .map(part => `<p>${escapeHtml(part)}</p>`)

  if (paragraphs.length > 0) {
    return paragraphs.join('\n\n')
  }

  return `<p>${escapeHtml(trimmed)}</p>`
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function findTemplateSummary(templateKey: string, summary: PageCatalogSummary): PageCatalogTemplateSummary | undefined {
  return summary.templates.find(template => template.templateKey === templateKey)
}

function deriveCanonicalRequirements(template: PageCatalogTemplateSummary): CanonicalRequirement[] {
  const requirements: CanonicalRequirement[] = []
  const seen = new Set<string>()

  const manifestRules = template.canonical || []
  for (const rule of manifestRules) {
    if (!rule || !rule.enforce) {
      continue
    }
    const canonicalType = canonicalizeComponentType(rule.preferredCanonical)
    if (!canonicalType) {
      continue
    }
    const region = String(rule.region)
    const key = `${region}:${canonicalType}`
    if (seen.has(key)) {
      continue
    }

    const allowedCanonicalsRaw =
      rule.allowedCanonicals && rule.allowedCanonicals.length > 0
        ? rule.allowedCanonicals
        : [rule.preferredCanonical]
    const allowedCanonicals = allowedCanonicalsRaw
      .map(value => canonicalizeComponentType(value))
      .filter((value): value is string => Boolean(value))

    if (allowedCanonicals.length === 0) {
      continue
    }

    requirements.push({
      canonicalType,
      region,
      min: typeof rule.min === 'number' && rule.min > 0 ? rule.min : 1,
      allowedCanonicalTypes: allowedCanonicals,
      hints: rule.hints ? [...rule.hints] : undefined,
      metadata: rule.metadata ? { ...rule.metadata } : undefined,
      source: 'manifest'
    })
    seen.add(key)
  }

  for (const region of template.requiredRegions || []) {
    const allowedValues = region.allowedComponents || []
    if (allowedValues.length === 0) {
      continue
    }

    const definitions: Array<{ canonicalType: string; synthesizer?: CanonicalSynthesizer | undefined }> = []
    const missing: string[] = []
    for (const value of allowedValues) {
      const rawType = typeof value === 'string' ? value : String(value)
      const canonicalType = canonicalizeComponentType(rawType)
      if (!canonicalType) {
        continue
      }
      const contract = getComponentContractByCanonicalType(canonicalType)
      if (contract && !definitions.some(def => def.canonicalType === contract.canonicalType)) {
        definitions.push({ canonicalType: contract.canonicalType, synthesizer: contract.synthesizer })
        continue
      }
      const definition = getCanonicalComponent(canonicalType)
      if (definition && !definitions.some(def => def.canonicalType === definition.canonicalType)) {
        definitions.push({ canonicalType: definition.canonicalType, synthesizer: definition.synthesizer })
      } else {
        missing.push(canonicalType)
      }
    }

    if (definitions.length === 0) {
      continue
    }

    const unresolved = Array.from(new Set(missing))
    if (unresolved.length > 0) {
      console.warn('[DetectionCanonicalizer] canonical-contract-missing', {
        templateKey: template.templateKey,
        region: region.region,
        canonicalTypes: unresolved
      })
    }

    const hasSynthesizer = definitions.some(def => Boolean(def.synthesizer))
    const shouldEnforce = allowedValues.length === 1 || definitions.length === 1 || hasSynthesizer
    if (!shouldEnforce) {
      continue
    }

    const preferred = definitions.find(def => Boolean(def.synthesizer)) ?? definitions[0]
    if (!preferred) {
      continue
    }

    const requirementKey = `${String(region.region)}:${preferred.canonicalType}`
    if (seen.has(requirementKey)) {
      continue
    }

    const min = typeof region.min === 'number' && region.min > 0 ? region.min : 1
    requirements.push({
      canonicalType: preferred.canonicalType,
      region: String(region.region),
      min,
      allowedCanonicalTypes: definitions.map(def => def.canonicalType),
      source: 'catalog'
    })
    seen.add(requirementKey)
  }

  return requirements
}

function ensureRegionOnContent(content: any, region: string): any {
  if (!content || typeof content !== 'object') {
    return content
  }

  let next = content
  if (typeof content.region !== 'string' || content.region.trim().length === 0 || content.region !== region) {
    next = { ...next, region }
  }

  const metadata = next.metadata && typeof next.metadata === 'object' ? next.metadata : {}
  if ((metadata as Record<string, unknown>).region !== region) {
    next = { ...next, metadata: { ...metadata, region } }
  }

  return next
}

function countCanonicalInstances(components: DetectedComponent[], canonicalType: string): number {
  const normalized = canonicalizeComponentType(canonicalType)
  if (!normalized) {
    return 0
  }
  return components.filter(component => {
    const componentType =
      canonicalizeComponentType(component.component) || canonicalizeComponentType(component.type)
    return componentType === normalized
  }).length
}

function countCanonicalInstancesForTypes(components: DetectedComponent[], canonicalTypes: string[]): number {
  if (canonicalTypes.length === 0) {
    return 0
  }
  const allowed = new Set(
    canonicalTypes
      .map(type => canonicalizeComponentType(type))
      .filter((type): type is string => Boolean(type))
  )
  if (allowed.size === 0) {
    return 0
  }
  return components.filter(component => {
    const componentType =
      canonicalizeComponentType(component.component) || canonicalizeComponentType(component.type)
    return componentType !== undefined && allowed.has(componentType)
  }).length
}

function findPatternForCanonicalType(canonicalType: string, patterns: ComponentPattern[]): ComponentPattern | undefined {
  const normalized = canonicalizeComponentType(canonicalType)
  if (!normalized) {
    return undefined
  }
  for (const pattern of patterns) {
    const patternType = canonicalizeComponentType(pattern.type)
    if (patternType === normalized) {
      return pattern
    }
  }
  return undefined
}

function synthesizeCanonicalComponent(params: SynthesizeParams): SynthesisResult | null {
  const synthesizer = resolveSynthesizer(params.canonicalType)
  if (!synthesizer) {
    console.warn('[DetectionCanonicalizer] canonical-synthesizer-missing', {
      canonicalType: params.canonicalType,
      templateKey: params.templateKey,
      pageUrl: params.pageUrl
    })
    return null
  }

  try {
    return synthesizer(params)
  } catch (error) {
    console.error('[DetectionCanonicalizer] canonical-synthesizer-error', {
      canonicalType: params.canonicalType,
      templateKey: params.templateKey,
      pageUrl: params.pageUrl,
      error
    })
    return null
  }
}

function resolveSynthesizer(canonicalType: string): CanonicalSynthesizer | undefined {
  const contract = getComponentContractByCanonicalType(canonicalType)
  if (contract?.synthesizer) {
    return contract.synthesizer
  }
  const definition = getCanonicalComponent(canonicalType)
  return definition?.synthesizer
}
