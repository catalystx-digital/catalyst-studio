import type { ComponentPattern, DetectedComponent, DetectedPageTemplate, PageMetadata } from './types'
import type { PageCatalogSummary, PageCatalogTemplateSummary } from '@/lib/studio/ai/page-catalog'
import {
  canonicalizeComponentType,
  ensureCanonicalComponentsRegistered,
  getCanonicalComponent
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

export function applyTemplateCanonicalization({
  components,
  template,
  pageSummary,
  pageUrl
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
  validateTemplateCanonicalRequirements({
    components: mutable,
    template,
    pageSummary,
    pageUrl,
    requirements
  })

  return enforceCanonicalContentInvariants(mutable)
}

export function validateTemplateCanonicalRequirements({
  components,
  template,
  pageSummary,
  pageUrl,
  requirements: providedRequirements
}: {
  components: DetectedComponent[]
  template: DetectedPageTemplate
  pageSummary: PageCatalogSummary
  pageUrl?: string
  requirements?: CanonicalRequirement[]
}): void {
  ensureCanonicalComponentsRegistered()

  const templateSummary = findTemplateSummary(template.templateKey, pageSummary)
  if (!templateSummary) {
    throw new Error(`Detection output selected unregistered template "${template.templateKey}"`)
  }

  const requirements = providedRequirements ?? deriveCanonicalRequirements(templateSummary)
  if (requirements.length === 0) {
    return
  }

  const missingRequirements: CanonicalRequirement[] = []

  for (const requirement of requirements) {
    const satisfiedCount = countCanonicalInstancesForTypes(components, requirement.allowedCanonicalTypes)
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

    console.warn('[DetectionCanonicalizer] canonical-required-missing', {
      templateKey: template.templateKey,
      canonicalType: requirement.canonicalType,
      region: requirement.region,
      pageUrl,
      source: requirement.source,
      message: 'Detection output omitted a required canonical component; strict import will not synthesize it.'
    })
    missingRequirements.push(requirement)
  }

  if (missingRequirements.length > 0) {
    const summary = missingRequirements
      .map(requirement => `${requirement.region}:${requirement.canonicalType} min=${requirement.min}`)
      .join(', ')
    throw new Error(
      `Detection output omitted required canonical component(s) for template "${template.templateKey}": ${summary}`
    )
  }
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

  if (existingHtml && next.bodyHtml !== existingHtml) {
    next.bodyHtml = existingHtml
    changed = true
  }

  if ('body' in next) {
    delete next.body
    changed = true
  }

  const resolvedTitle =
    pickString(next.title) ??
    pickString(next.heading) ??
    pickString(next.name) ??
    pickString((next.metadata as Record<string, any> | undefined)?.title)
  if (!pickString(next.title) && resolvedTitle) {
    next.title = resolvedTitle
    changed = true
  }

  return changed ? next : content
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

    const definitions: Array<{ canonicalType: string }> = []
    const missing: string[] = []
    for (const value of allowedValues) {
      const rawType = typeof value === 'string' ? value : String(value)
      const canonicalType = canonicalizeComponentType(rawType)
      if (!canonicalType) {
        continue
      }
      const contract = getComponentContractByCanonicalType(canonicalType)
      if (contract && !definitions.some(def => def.canonicalType === contract.canonicalType)) {
        definitions.push({ canonicalType: contract.canonicalType })
        continue
      }
      const definition = getCanonicalComponent(canonicalType)
      if (definition && !definitions.some(def => def.canonicalType === definition.canonicalType)) {
        definitions.push({ canonicalType: definition.canonicalType })
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

    const shouldEnforce = allowedValues.length === 1 || definitions.length === 1
    if (!shouldEnforce) {
      continue
    }

    const preferred = definitions[0]
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
