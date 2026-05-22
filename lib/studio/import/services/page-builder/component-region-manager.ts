import type {
  ComponentInstance,
  ComponentTree,
  ComponentType as ImportComponentType,
  PageData
} from '../interfaces'
import {
  canonicalizeComponentType,
} from './component-helpers'
import {
  buildComponentTypeIndex,
  calculateInstanceMaxDepth,
  calculatePositions,
  collectComponentInstanceTypes,
  countComponentInstances
} from './component-tree-utils'
import { ComponentType as CmsComponentType } from '@/lib/studio/components/cms/_core/types'
import { PageTemplateRegionConfig } from '@/lib/studio/pages/_core/types'
import { type PageCatalogTemplateSummary } from '@/lib/studio/pages/catalog'

function normalizeRegionValue(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined
  }
  const normalized = value.trim().toLowerCase()
  if (normalized === 'header' || normalized === 'hero' || normalized === 'main' || normalized === 'footer') {
    return normalized
  }
  return undefined
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

interface RegionSanitizeResult {
  components: ComponentInstance[]
  modified: boolean
}

export class RequiredRegionCoverageError extends Error {
  readonly pageUrl: string
  readonly templateKey: string
  readonly region: string
  readonly currentCount: number
  readonly minRequired: number
  readonly allowedComponents?: unknown[]

  constructor({
    pageUrl,
    templateKey,
    region,
    currentCount,
    minRequired,
    allowedComponents
  }: {
    pageUrl: string
    templateKey: string
    region: string
    currentCount: number
    minRequired: number
    allowedComponents?: unknown[]
  }) {
    super(
      `[ComponentRegionManager] Required region "${region}" for template "${templateKey}" has ${currentCount} component(s), expected at least ${minRequired}. Allowed components: ${JSON.stringify(allowedComponents ?? [])}. Page: ${pageUrl}`
    )
    this.name = 'RequiredRegionCoverageError'
    this.pageUrl = pageUrl
    this.templateKey = templateKey
    this.region = region
    this.currentCount = currentCount
    this.minRequired = minRequired
    this.allowedComponents = allowedComponents
  }
}

export class ComponentRegionValidationError extends Error {
  constructor(message: string) {
    super(`[ComponentRegionManager] ${message}`)
    this.name = 'ComponentRegionValidationError'
  }
}

export class ComponentRegionManager {
  ensureRequiredRegionCoverage({
    tree,
    template,
    componentTypes,
    pageData
  }: {
    tree: ComponentTree
    template: PageCatalogTemplateSummary
    componentTypes: ImportComponentType[]
    pageData: PageData
  }): ComponentTree {
    const sanitized = this.sanitizeComponentRegions({
      components: tree.components,
      template,
      componentTypes,
      pageUrl: pageData.url
    })

    const requiredRegions = template.requiredRegions || []
    if (requiredRegions.length === 0 && !sanitized.modified) {
      return tree
    }

    const components = [...sanitized.components]
    const modified = sanitized.modified

    for (const regionConfig of requiredRegions) {
      const minRequired = typeof regionConfig.min === 'number' ? regionConfig.min : 0
      if (minRequired <= 0) {
        continue
      }

      const currentCount = this.countComponentsInRegion(components, regionConfig.region)
      if (currentCount < minRequired) {
        throw new RequiredRegionCoverageError({
          pageUrl: pageData.url,
          templateKey: template.templateKey,
          region: regionConfig.region,
          currentCount,
          minRequired,
          allowedComponents: regionConfig.allowedComponents
        })
      }
    }

    if (!modified) {
      return tree
    }

    const positioned = calculatePositions(components)
    const updatedMetadata = {
      ...tree.metadata,
      totalComponents: countComponentInstances(positioned),
      componentTypes: collectComponentInstanceTypes(positioned),
      maxDepth: calculateInstanceMaxDepth(positioned)
    }

    return {
      components: positioned,
      metadata: updatedMetadata
    }
  }

  sanitizeComponentRegions({
    components,
    template,
    componentTypes,
    pageUrl
  }: {
    components: ComponentInstance[]
    template: PageCatalogTemplateSummary
    componentTypes: ImportComponentType[]
    pageUrl: string
  }): RegionSanitizeResult {
    const allowedMap = this.buildTemplateRegionAllowedMap(template)
    const typeIndex = buildComponentTypeIndex(componentTypes)
    const typeRegionIndex = new Map<string, Set<string>>()
    for (const [region, allowed] of allowedMap.entries()) {
      if (!allowed) {
        continue
      }
      for (const type of allowed) {
        if (!typeRegionIndex.has(type)) {
          typeRegionIndex.set(type, new Set<string>())
        }
        typeRegionIndex.get(type)!.add(region)
      }
    }

    const validateNodes = (nodes: ComponentInstance[]): RegionSanitizeResult => {
      for (const node of nodes) {
        if (node.children) {
          validateNodes(node.children)
        }

        const canonicalType = this.resolveComponentCanonicalType(node, typeIndex)
        const regionAssignment = this.getComponentRegionAssignment(node)
        const currentRegion = regionAssignment.region

        const content = isRecord(node.content) ? node.content : undefined
        const contentRegion =
          typeof content?.region === 'string'
            ? normalizeRegionValue(content.region)
            : undefined
        const contentMetadata = isRecord(content?.metadata) ? content.metadata : undefined
        const contentMetadataRegion =
          typeof contentMetadata?.region === 'string'
            ? normalizeRegionValue(contentMetadata.region)
            : undefined
        if (contentRegion && regionAssignment.rootRegion && contentRegion !== regionAssignment.rootRegion) {
          throw new ComponentRegionValidationError(
            `Component "${node.id}" has conflicting region assignments: component.content.region "${contentRegion}" conflicts with props.region "${regionAssignment.rootRegion}". Page: ${pageUrl}`
          )
        }
        if (contentRegion && regionAssignment.metadataRegion && contentRegion !== regionAssignment.metadataRegion) {
          throw new ComponentRegionValidationError(
            `Component "${node.id}" has conflicting region assignments: component.content.region "${contentRegion}" conflicts with metadata.region "${regionAssignment.metadataRegion}". Page: ${pageUrl}`
          )
        }
        if (contentRegion && contentMetadataRegion && contentRegion !== contentMetadataRegion) {
          throw new ComponentRegionValidationError(
            `Component "${node.id}" has conflicting region assignments: component.content.region "${contentRegion}" conflicts with component.content.metadata.region "${contentMetadataRegion}". Page: ${pageUrl}`
          )
        }
        if (
          contentMetadataRegion &&
          regionAssignment.rootRegion &&
          contentMetadataRegion !== regionAssignment.rootRegion
        ) {
          throw new ComponentRegionValidationError(
            `Component "${node.id}" has conflicting region assignments: component.content.metadata.region "${contentMetadataRegion}" conflicts with props.region "${regionAssignment.rootRegion}". Page: ${pageUrl}`
          )
        }
        if (
          contentMetadataRegion &&
          regionAssignment.metadataRegion &&
          contentMetadataRegion !== regionAssignment.metadataRegion
        ) {
          throw new ComponentRegionValidationError(
            `Component "${node.id}" has conflicting region assignments: component.content.metadata.region "${contentMetadataRegion}" conflicts with metadata.region "${regionAssignment.metadataRegion}". Page: ${pageUrl}`
          )
        }
        if (
          regionAssignment.rootRegion &&
          regionAssignment.metadataRegion &&
          regionAssignment.rootRegion !== regionAssignment.metadataRegion
        ) {
          throw new ComponentRegionValidationError(
            `Component "${node.id}" has conflicting region assignments: props.region "${regionAssignment.rootRegion}" conflicts with metadata.region "${regionAssignment.metadataRegion}". Page: ${pageUrl}`
          )
        }

        if (currentRegion) {
          const allowed = allowedMap.get(currentRegion)
          const constrainedRegions = canonicalType ? typeRegionIndex.get(canonicalType) : undefined
          const constrainedToOtherRegions = constrainedRegions && !constrainedRegions.has(currentRegion)
          if (
            canonicalType &&
            ((allowed !== undefined && allowed !== null && !allowed.has(canonicalType)) ||
              (allowed === undefined && constrainedToOtherRegions))
          ) {
            throw new ComponentRegionValidationError(
              `Component "${node.id}" of canonical type "${canonicalType}" is assigned to disallowed region "${currentRegion}" for template "${template.templateKey}". Allowed regions: ${JSON.stringify(Array.from(constrainedRegions ?? []))}. Page: ${pageUrl}`
            )
          }
        }

        const constrainedRegions = canonicalType ? typeRegionIndex.get(canonicalType) : undefined
        if (!currentRegion && constrainedRegions && constrainedRegions.size > 0) {
          throw new ComponentRegionValidationError(
            `Component "${node.id}" of canonical type "${canonicalType}" has no valid assigned region for template "${template.templateKey}". Required/allowed regions: ${JSON.stringify(Array.from(constrainedRegions))}. Page: ${pageUrl}`
          )
        }
      }

      return { components: nodes, modified: false }
    }

    return validateNodes(components)
  }

  private buildTemplateRegionAllowedMap(template: PageCatalogTemplateSummary): Map<string, Set<string> | null> {
    const regionMap = new Map<string, Set<string> | null>()
    const addConfig = (config: PageTemplateRegionConfig) => {
      const allowedValues = config.allowedComponents || []
      if (allowedValues.length === 0) {
        if (!regionMap.has(config.region)) {
          regionMap.set(config.region, null)
        }
        return
      }

      const allowedSet = regionMap.get(config.region) ?? new Set<string>()
      for (const value of allowedValues) {
        const canonical = canonicalizeComponentType(String(value))
        if (canonical) {
          allowedSet.add(canonical)
        }
      }
      regionMap.set(config.region, allowedSet)
    }

    for (const config of template.requiredRegions || []) {
      addConfig(config)
    }
    if (template.optionalRegions) {
      for (const config of template.optionalRegions) {
        addConfig(config)
      }
    }

    const mainAllowed = regionMap.get('main')
    if (mainAllowed instanceof Set) {
      mainAllowed.add(canonicalizeComponentType(CmsComponentType.ContentFeed) ?? CmsComponentType.ContentFeed)
    }

    return regionMap
  }

  private resolveComponentCanonicalType(
    component: ComponentInstance,
    index: Map<string, string>
  ): string | undefined {
    if (component.typeId && index.has(component.typeId)) {
      return index.get(component.typeId)
    }
    return canonicalizeComponentType(component.type)
  }

  private countComponentsInRegion(components: ComponentInstance[], region: string): number {
    return components.reduce((acc, component) => {
      const componentRegion = this.getComponentRegion(component)
      const ownCount = componentRegion === region ? 1 : 0
      const childCount = component.children ? this.countComponentsInRegion(component.children, region) : 0
      return acc + ownCount + childCount
    }, 0)
  }

  private getComponentRegion(component: ComponentInstance): string | undefined {
    return this.getComponentRegionAssignment(component).region
  }

  private getComponentRegionAssignment(component: ComponentInstance): {
    region?: string
    rootRegion?: string
    metadataRegion?: string
  } {
    const rootRegion = normalizeRegionValue(component.props?.region)
    const metadataRegion = normalizeRegionValue((component.props?.metadata as any)?.region)
    return {
      region: rootRegion ?? metadataRegion,
      rootRegion,
      metadataRegion
    }
  }
}
