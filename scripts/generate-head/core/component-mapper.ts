import { ComponentType, COMPONENT_TYPE_ALIASES } from '@/lib/studio/components/cms/_core/types'
import type { ComponentInstance } from '@/lib/studio/types/site-builder/component-instance'
import type {
  PageTemplateRegistration,
  PageTemplateRegionConfig,
  PageTemplateRegionKey
} from '@/lib/studio/pages/_core/types'
import { getTemplate, isComponentRegistered, getAllRegisteredComponentTypes } from './registry'
import { DEFAULT_TEMPLATE_KEY } from './constants'
import type {
  GeneratorDiagnostic,
  MappedComponentDefinition,
  MappedPageDefinition,
  SiteSnapshot
} from './types'
import { toComponentExportName } from '../utils/strings'

export interface ComponentMappingSummary {
  pages: MappedPageDefinition[]
  diagnostics: GeneratorDiagnostic[]
  componentImports: Map<ComponentType, string>
}

// Static lookup table built from ComponentType enum and aliases
const normalizedComponentTypeMap = new Map<string, ComponentType>()
const componentTypeValues = Object.values(ComponentType) as string[]

function normalizeComponentKey(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
}

// Build static lookup from enum values
componentTypeValues.forEach(value => {
  normalizedComponentTypeMap.set(normalizeComponentKey(value), value as ComponentType)
})

// Add aliases from central registry
Object.entries(COMPONENT_TYPE_ALIASES).forEach(([alias, target]) => {
  normalizedComponentTypeMap.set(normalizeComponentKey(alias), target)
})

export function coerceComponentType(type: string): ComponentType | undefined {
  if (!type) {
    return undefined
  }

  return normalizedComponentTypeMap.get(normalizeComponentKey(type))
}

function resolveComponentType(instance: ComponentInstance): ComponentType | undefined {
  if (instance.componentType) {
    return instance.componentType
  }

  return coerceComponentType(instance.type)
}

function normalizeRegionValue(value: unknown): PageTemplateRegionKey | undefined {
  if (typeof value === 'string') {
    const normalized = value.trim()
    if (normalized.length > 0) {
      return normalized as PageTemplateRegionKey
    }
  }
  if (typeof value === 'object' && value !== null) {
    const record = value as Record<string, unknown>
    if (typeof record['value'] === 'string') {
      const normalized = record['value'].trim()
      if (normalized.length > 0) {
        return normalized as PageTemplateRegionKey
      }
    }
    if (typeof record['name'] === 'string') {
      const normalized = record['name'].trim()
      if (normalized.length > 0) {
        return normalized as PageTemplateRegionKey
      }
    }
  }
  return undefined
}

function extractRegion(props: Record<string, unknown>): {
  region?: PageTemplateRegionKey
  props: Record<string, unknown>
} {
  if (!props) {
    return { props: {} }
  }

  const { region, ...rest } = props
  const resolvedRegion = normalizeRegionValue(region)
  return {
    region: resolvedRegion,
    props: rest
  }
}

interface RegionRule {
  configs: PageTemplateRegionConfig[]
  allowed: Set<ComponentType> | null
}

function buildTemplateRegionRules(
  template: PageTemplateRegistration | undefined
): Map<PageTemplateRegionKey, RegionRule> {
  const rules = new Map<PageTemplateRegionKey, RegionRule>()
  if (!template) {
    return rules
  }

  const registerConfig = (config: PageTemplateRegionConfig): void => {
    const existing = rules.get(config.region)
    const hasWildcard = !config.allowedComponents || config.allowedComponents.length === 0

    if (!existing) {
      rules.set(config.region, {
        configs: [config],
        allowed: hasWildcard ? null : new Set<ComponentType>(config.allowedComponents)
      })
      return
    }

    existing.configs.push(config)

    if (existing.allowed === null) {
      return
    }
    if (hasWildcard) {
      existing.allowed = null
      return
    }

    for (const value of config.allowedComponents) {
      existing.allowed.add(value)
    }
  }

  for (const config of template.requiredRegions) {
    registerConfig(config)
  }
  for (const config of template.optionalRegions ?? []) {
    registerConfig(config)
  }

  return rules
}

function validateComponentAgainstRegion(
  componentType: ComponentType | undefined,
  rule: RegionRule | undefined
): { allowed: boolean; allowedComponents?: ComponentType[] } {
  if (!componentType || !rule) {
    return { allowed: true }
  }

  if (rule.allowed === null) {
    return { allowed: true }
  }

  const allowed = rule.allowed.has(componentType)
  return {
    allowed,
    allowedComponents: Array.from(rule.allowed)
  }
}

function cloneProps(props: Record<string, unknown>): Record<string, unknown> {
  return JSON.parse(JSON.stringify(props ?? {}))
}


function normalizeLoaderKey(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null
  }

  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function resolveLoaderKeyFromRecord(record: Record<string, unknown> | undefined): string | null {
  if (!record) {
    return null
  }

  const direct = normalizeLoaderKey(record['loaderKey'])
  if (direct) {
    return direct
  }

  const loaderField = record['loader']
  if (typeof loaderField === 'string') {
    const key = normalizeLoaderKey(loaderField)
    if (key) {
      return key
    }
  } else if (loaderField && typeof loaderField === 'object') {
    const nestedKey = normalizeLoaderKey((loaderField as Record<string, unknown>)['key'])
    if (nestedKey) {
      return nestedKey
    }
  }

  return null
}

function resolveLoaderKey(instance: ComponentInstance): string | null {
  if (!instance) {
    return null
  }

  const propsLoader = resolveLoaderKeyFromRecord(instance.props as Record<string, unknown>)
  if (propsLoader) {
    return propsLoader
  }

  const metadataRecord = instance.metadata
    ? (instance.metadata as unknown as Record<string, unknown>)
    : undefined
  if (metadataRecord) {
    const metadataLoader = resolveLoaderKeyFromRecord(metadataRecord)
    if (metadataLoader) {
      return metadataLoader
    }
  }

  return null
}

export interface MapSnapshotComponentsOptions {
  /**
   * When true, all component types will be included in componentImports
   * regardless of what components exist in the snapshot pages.
   * This is required for runtime providers (Optimizely, UCS GraphQL)
   * where pages are fetched at runtime and can contain any component type.
   */
  includeAllComponentTypes?: boolean
}

export function mapSnapshotComponents(
  snapshot: SiteSnapshot,
  options: MapSnapshotComponentsOptions = {}
): ComponentMappingSummary {
  const diagnostics: GeneratorDiagnostic[] = []
  const componentImports = new Map<ComponentType, string>()

  // For runtime providers (UCS GraphQL, Optimizely), include ALL component types
  // This ensures component renderers are available at runtime for any page content
  // (No tree-shaking optimization - runtime pages can use any component type)
  // Also include all types when pages are empty (backward compatibility)
  if (options.includeAllComponentTypes || snapshot.pages.length === 0) {
    getAllRegisteredComponentTypes().forEach(componentType => {
      const importName = toComponentExportName(componentType)
      componentImports.set(componentType, importName)
    })
  }

  const pages: MappedPageDefinition[] = snapshot.pages.map(page => {
    let template = getTemplate(page.templateKey)
    let resolvedTemplateKey = page.templateKey ?? null

    if (!template) {
      if (page.templateKey) {
        diagnostics.push({
          code: 'TEMPLATE_NOT_FOUND',
          level: 'warn',
          message: `Template "${page.templateKey}" was not found for page ${page.fullPath}`,
          context: { templateKey: page.templateKey, pageId: page.id }
        })
      }

      const fallbackTemplate = getTemplate(DEFAULT_TEMPLATE_KEY)
      if (fallbackTemplate) {
        template = fallbackTemplate
        resolvedTemplateKey = fallbackTemplate.templateKey
        diagnostics.push({
          code: 'TEMPLATE_FALLBACK_APPLIED',
          level: 'info',
          message: `Using fallback template "${fallbackTemplate.templateKey}" for page ${page.fullPath}`,
          context: { pageId: page.id, fallbackTemplateKey: fallbackTemplate.templateKey }
        })
      } else {
        diagnostics.push({
          code: 'TEMPLATE_FALLBACK_FAILED',
          level: 'error',
          message: `Fallback template "${DEFAULT_TEMPLATE_KEY}" could not be loaded`,
          context: { pageId: page.id }
        })
      }
    }

    const regionRules = template ? buildTemplateRegionRules(template) : new Map<PageTemplateRegionKey, RegionRule>()

    const mappedComponents: MappedComponentDefinition[] = page.components
      .slice()
      .sort((a, b) => a.position - b.position)
      .map(instance => {
        const componentDiagnostics: GeneratorDiagnostic[] = []
        const componentType = resolveComponentType(instance)

        if (!componentType) {
          componentDiagnostics.push({
            code: 'UNKNOWN_COMPONENT_TYPE',
            level: 'error',
            message: `Component "${instance.type}" is not registered in CMS factory`,
            context: { componentId: instance.id, componentType: instance.type }
          })
        }

        if (!instance.componentType && componentType) {
          componentDiagnostics.push({
            code: 'CANONICAL_TYPE_FALLBACK',
            level: 'warn',
            message: `Component "${instance.id}" resolved to ${componentType} using heuristic fallback`,
            context: {
              componentId: instance.id,
              originalType: instance.type,
              resolvedType: componentType
            }
          })
        }

        const { region, props } = extractRegion(instance.props)
        const loaderKey = resolveLoaderKey(instance)
        const regionRule = region ? regionRules.get(region) : undefined

        if (template && region && !regionRule) {
          componentDiagnostics.push({
            code: 'UNKNOWN_TEMPLATE_REGION',
            level: 'warn',
            message: `Region "${region}" does not exist on template "${template.templateKey}"`,
            context: { componentId: instance.id, region, template: template.templateKey }
          })
        }

        const allowance = validateComponentAgainstRegion(componentType, regionRule)
        if (template && regionRule && !allowance.allowed && componentType) {
          componentDiagnostics.push({
            code: 'REGION_COMPONENT_VIOLATION',
            level: 'warn',
            message: `Component ${componentType} is not allowed in region "${region}"`,
            context: {
              componentId: instance.id,
              componentType,
              region,
              allowedComponents: allowance.allowedComponents ?? []
            }
          })
        }

        let importName: string | undefined
        if (componentType) {
          if (!isComponentRegistered(componentType)) {
            componentDiagnostics.push({
              code: 'COMPONENT_NOT_REGISTERED',
              level: 'error',
              message: `Component type ${componentType} is not available in the registry`,
              context: { componentId: instance.id, componentType }
            })
          } else {
            importName = toComponentExportName(componentType)
            componentImports.set(componentType, importName)
          }
        }

        componentDiagnostics.forEach(diag => diagnostics.push(diag))

        const normalizedProps = cloneProps(props)

        return {
          id: instance.id,
          componentType,
          importName,
          props: normalizedProps,
          region,
          loaderKey,
          original: instance,
          diagnostics: componentDiagnostics
        }
      })

    return {
      pageId: page.id,
      fullPath: page.fullPath,
      templateKey: resolvedTemplateKey,
      template,
      components: mappedComponents
    }
  })

  return { pages, diagnostics, componentImports }
}
