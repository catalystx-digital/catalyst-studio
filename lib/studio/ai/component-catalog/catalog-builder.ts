import type {
  PromptContractBundle,
  PromptContractComponent,
  PromptContractField
} from '@/lib/studio/ai/prompt-contract-builder'
import { buildPromptContractBundle } from '@/lib/studio/ai/prompt-contract-builder'
import { ensureCanonicalComponentsRegistered } from '@/lib/studio/import/detection/canonical'
import type {
  ComponentCatalogComponent,
  ComponentCatalogCategory,
  ComponentCatalogSummary,
  SubComponentCatalogEntry,
  ComponentPropertyInfo,
  ComponentCatalogOptions
} from './types'
import { getCachedSummary, getCachedSummaryHash, setCachedSummary } from './cache'

function mapContractFields(fields: PromptContractField[] | undefined): ComponentPropertyInfo[] | undefined {
  if (!fields || fields.length === 0) {
    return undefined
  }

  return fields.map(field => ({
    name: String(field.name),
    type: String(field.type),
    required: Boolean(field.required),
    ...(field.description ? { description: String(field.description) } : {}),
    ...(field.allowedTypes && field.allowedTypes.length > 0
      ? { allowedTypes: field.allowedTypes.map(value => String(value)) }
      : {}),
    source: field.source
  }))
}

function toCatalogComponent(component: PromptContractComponent): ComponentCatalogComponent {
  return {
    type: component.type,
    category: component.category,
    summary: component.summary || undefined,
    description: component.description,
    keywords: [...component.keywords],
    patterns: [...component.patterns],
    confidence: component.confidence,
    metadata: component.metadata ? { ...component.metadata } : undefined,
    directives: component.directives?.length ? [...component.directives] : undefined,
    properties: mapContractFields(component.fields)
  }
}

function toSubcomponentEntry(component: PromptContractComponent): SubComponentCatalogEntry {
  return {
    type: component.type,
    summary: component.summary || undefined,
    description: component.description,
    metadata: component.metadata ? { ...component.metadata } : undefined,
    directives: component.directives?.length ? [...component.directives] : undefined,
    properties: mapContractFields(component.fields)
  }
}

function computeCategories(components: ComponentCatalogComponent[]): ComponentCatalogCategory[] {
  const map = new Map<string, ComponentCatalogComponent[]>()
  for (const component of components) {
    const existing = map.get(component.category) || []
    existing.push(component)
    map.set(component.category, existing)
  }
  return Array.from(map.entries()).map(([name, comps]) => ({ name, components: comps }))
}

function computeSubComponentTypes(
  components: ComponentCatalogComponent[],
  subComponents: SubComponentCatalogEntry[]
): string[] {
  const subs = new Set<string>()
  for (const component of components) {
    const props = component.properties || []
    for (const prop of props) {
      if (Array.isArray(prop.allowedTypes)) {
        for (const type of prop.allowedTypes) {
          subs.add(String(type))
        }
      }
    }
  }
  for (const entry of subComponents) {
    subs.add(entry.type)
  }
  return Array.from(subs).sort()
}

export async function getComponentCatalogSummary(options: ComponentCatalogOptions = {}): Promise<ComponentCatalogSummary> {
  ensureCanonicalComponentsRegistered()
  const bundle = await buildPromptContractBundle({ forceRefresh: options.forceRefresh })

  const cachedSummary = getCachedSummary()
  const cachedHash = getCachedSummaryHash()

  if (!options.forceRefresh && cachedSummary && cachedHash === bundle.hash) {
    return cachedSummary
  }

  const components: ComponentCatalogComponent[] = bundle.components.map(toCatalogComponent)
  const subComponents: SubComponentCatalogEntry[] = bundle.subcomponents.map(toSubcomponentEntry)

  const summary: ComponentCatalogSummary = {
    total: components.length,
    generatedAt: bundle.generatedAt,
    components,
    categories: computeCategories(components),
    topLevelTypes: components.map(component => component.type),
    subComponentTypes: computeSubComponentTypes(components, subComponents),
    subComponents,
    warnings: bundle.warnings
  }

  setCachedSummary(summary, bundle.hash)
  return summary
}
