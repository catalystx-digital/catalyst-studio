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

/**
 * Maps component types to their preferred regions.
 * Used when a component doesn't have an explicit region assignment.
 */
const COMPONENT_PREFERRED_REGIONS: Record<string, string> = {
  // Hero components → hero region
  'hero-carousel': 'hero',
  'hero-banner': 'hero',
  'hero-simple': 'hero',
  'hero-with-image': 'hero',
  'hero-video': 'hero',
  'hero-split': 'hero',
  'hero-minimal': 'hero',

  // Navigation components → header region
  'navbar': 'header',
  'nav-bar': 'header',
  'breadcrumbs': 'header',
  'breadcrumb': 'header',

  // Footer components → footer region
  'footer': 'footer'

  // Everything else defaults to 'main' (handled in logic below)
}

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

interface RegionSanitizeResult {
  components: ComponentInstance[]
  modified: boolean
}

export class RequiredRegionCoverageError extends Error {
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

    const sanitizeNodes = (nodes: ComponentInstance[]): RegionSanitizeResult => {
      let modified = false

      const sanitizedNodes = nodes.map(node => {
        const childResult = node.children ? sanitizeNodes(node.children) : { components: undefined, modified: false }
        if (childResult.modified) {
          modified = true
        }

        const canonicalType = this.resolveComponentCanonicalType(node, typeIndex)
        const currentRegion = this.getComponentRegion(node)
        const props = { ...(node.props ?? {}) }
        let propsModified = false
        let metadata = props.metadata && typeof props.metadata === 'object'
          ? { ...(props.metadata as Record<string, unknown>) }
          : undefined

        const contentRegion =
          props.content && typeof (props.content as Record<string, any>)?.region === 'string'
            ? normalizeRegionValue((props.content as Record<string, any>).region)
            : undefined
        const rootRegion = normalizeRegionValue(props.region)
        if (contentRegion && contentRegion !== rootRegion) {
          props.region = contentRegion
          if (metadata) {
            metadata.region = contentRegion
          } else {
            metadata = { region: contentRegion }
          }
          propsModified = true
        }

        if (metadata) {
          props.metadata = metadata
        }

        if (currentRegion) {
          const allowed = allowedMap.get(currentRegion)
          if (allowed !== undefined && allowed !== null && canonicalType && !allowed.has(canonicalType)) {
            propsModified = true
            if ('region' in props) {
              delete props.region
            }
            if (metadata && 'region' in metadata) {
              delete (metadata as Record<string, unknown>).region
              if (Object.keys(metadata).length === 0) {
                delete props.metadata
                metadata = undefined
              }
            }

            const allowableRegions = canonicalType ? typeRegionIndex.get(canonicalType) : undefined
            let reassigned = false
            if (allowableRegions && allowableRegions.size > 0) {
              const fallbackRegion = this.selectPreferredRegion(Array.from(allowableRegions))
              if (fallbackRegion) {
                props.region = fallbackRegion
                props.placementBucket = this.derivePlacementBucket(fallbackRegion)
                if (metadata) {
                  metadata.region = fallbackRegion
                } else {
                  metadata = {
                    region: fallbackRegion,
                    source: 'region-reassigned',
                    addedBy: 'PageBuilderService.ensureRequiredRegionCoverage'
                  }
                }
                props.metadata = metadata
                reassigned = true
                console.info('[PageBuilderService] Reassigned component to allowed region', {
                  url: pageUrl,
                  componentId: node.id,
                  componentType: canonicalType,
                  fromRegion: currentRegion,
                  toRegion: fallbackRegion
                })
              }
            }

            if (!reassigned) {
              if ('placementBucket' in props) {
                props.placementBucket = 'middle'
              }
              console.warn('[PageBuilderService] Removed disallowed region assignment from component', {
                url: pageUrl,
                componentId: node.id,
                componentType: canonicalType,
                region: currentRegion
              })
            }
          } else if (allowed !== undefined && allowed !== null) {
            const desiredPlacement = this.derivePlacementBucket(currentRegion)
            if (props.placementBucket !== desiredPlacement) {
              props.placementBucket = desiredPlacement
              propsModified = true
            }
            if (metadata && metadata.region !== currentRegion) {
              metadata.region = currentRegion
              propsModified = true
            }
            if (!('region' in props) || props.region !== currentRegion) {
              props.region = currentRegion
              propsModified = true
            }
          }
        } else if (canonicalType) {
          const regions = typeRegionIndex.get(canonicalType)
          if (regions && regions.size === 1) {
            // Single region inference - component type only allowed in one region
            const [targetRegion] = Array.from(regions)
            props.region = targetRegion
            props.placementBucket = this.derivePlacementBucket(targetRegion)
            if (metadata) {
              metadata.region = targetRegion
              if ((metadata as Record<string, unknown>).source == null) {
                (metadata as Record<string, unknown>).source = 'inferred'
              }
              if ((metadata as Record<string, unknown>).addedBy == null) {
                (metadata as Record<string, unknown>).addedBy = 'PageBuilderService.ensureRequiredRegionCoverage'
              }
              props.metadata = metadata
            } else {
              metadata = {
                region: targetRegion,
                source: 'inferred',
                addedBy: 'PageBuilderService.ensureRequiredRegionCoverage'
              }
              props.metadata = metadata
            }
            propsModified = true
          } else {
            // No region assigned and component type allows multiple regions or is unknown
            // Use preferred region mapping
            const preferredRegion = COMPONENT_PREFERRED_REGIONS[canonicalType]
            if (preferredRegion) {
              const allowedInPreferred = allowedMap.get(preferredRegion)
              // Check if component is allowed in preferred region (null means any component allowed)
              if (allowedInPreferred === null || allowedInPreferred?.has(canonicalType)) {
                props.region = preferredRegion
                props.placementBucket = this.derivePlacementBucket(preferredRegion)
                metadata = metadata ?? {}
                metadata.region = preferredRegion
                ;(metadata as Record<string, unknown>).source = 'preferred-mapping'
                ;(metadata as Record<string, unknown>).addedBy = 'ComponentRegionManager.sanitizeComponentRegions'
                props.metadata = metadata
                propsModified = true

                console.info('[ComponentRegionManager] Assigned preferred region to component', {
                  url: pageUrl,
                  componentId: node.id,
                  componentType: canonicalType,
                  assignedRegion: preferredRegion
                })
              }
            } else {
              // Default to 'main' region for unrecognized components without preferred mapping
              const mainAllowed = allowedMap.get('main')
              if (mainAllowed === null || mainAllowed?.has(canonicalType)) {
                props.region = 'main'
                props.placementBucket = 'middle'
                metadata = metadata ?? {}
                metadata.region = 'main'
                ;(metadata as Record<string, unknown>).source = 'default-main'
                ;(metadata as Record<string, unknown>).addedBy = 'ComponentRegionManager.sanitizeComponentRegions'
                props.metadata = metadata
                propsModified = true
              }
            }
          }
        }

        const updatedNode: ComponentInstance = {
          ...node,
          props,
          children: childResult.components ?? node.children
        }

        if (propsModified) {
          modified = true
        }

        return updatedNode
      })

      return { components: sanitizedNodes, modified }
    }

    return sanitizeNodes(components)
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
    const region = (component.props?.region ?? (component.props?.metadata as any)?.region) as string | undefined
    if (typeof region === 'string') {
      const trimmed = region.trim()
      return trimmed.length > 0 ? trimmed : undefined
    }
    return undefined
  }

  private derivePlacementBucket(region: string): string {
    if (region === 'header') {
      return 'top'
    }
    if (region === 'footer') {
      return 'bottom'
    }
    return 'middle'
  }

  private selectPreferredRegion(regions: string[]): string | undefined {
    if (regions.length === 0) {
      return undefined
    }
    const priority: string[] = ['hero', 'main', 'header', 'sidebar', 'footer']
    for (const preferred of priority) {
      if (regions.includes(preferred)) {
        return preferred
      }
    }
    return regions[0]
  }


}
