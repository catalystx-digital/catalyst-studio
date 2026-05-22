import {
  ComponentInstance,
  ComponentTree,
  ComponentType as ImportComponentType,
  DetectionResult
} from '../interfaces'
import {
  canonicalizeComponentType,
  escapeHtml,
  extractComponentPayload,
  generateComponentId,
  toCmsComponentType
} from './component-helpers'
import {
  buildComponentTreeMetadata,
  buildHierarchicalTree,
  calculateDetectionMaxDepth,
  calculateInstanceMaxDepth,
  calculatePositions,
  collectComponentInstanceTypes,
  countComponentInstances,
  deduplicateComponents
} from './component-tree-utils'
type NormalizedRegion = 'header' | 'hero' | 'main' | 'footer'

function normalizeRegionValue(value: unknown): NormalizedRegion | undefined {
  if (typeof value !== 'string') {
    return undefined
  }
  const normalized = value.trim().toLowerCase()
  if (normalized === 'header' || normalized === 'hero' || normalized === 'main' || normalized === 'footer') {
    return normalized
  }
  return undefined
}

function resolveRegion(detection: DetectionResult): NormalizedRegion | undefined {
  return normalizeRegionValue((detection as any)?.metadata?.region)
}
export class ComponentBuilder {
  buildComponentTree(components: DetectionResult[]): ComponentTree {
    return buildComponentTreeMetadata(components)
  }

  buildHierarchicalTree(components: ComponentInstance[]): ComponentInstance[] {
    return buildHierarchicalTree(components)
  }

  buildTreeFromDetections(
    detected: DetectionResult[],
    types: ImportComponentType[]
  ): ComponentTree {
    const baseTree = this.buildComponentTree(detected)
    const componentInstances = this.mapToComponentInstances(detected, types)
    const hierarchicalTree = this.buildHierarchicalTree(componentInstances)
    return this.optimizeComponentTree({
      components: hierarchicalTree,
      metadata: baseTree.metadata
    })
  }

  mapToComponentInstances(
    detected: DetectionResult[],
    types: ImportComponentType[]
  ): ComponentInstance[] {
    if (!detected || detected.length === 0) {
      return []
    }

    if (!types || types.length === 0) {
      throw new Error('No component types provided for mapping')
    }

    const typeMap = new Map<string, ImportComponentType>()

    types.forEach(type => {
      typeMap.set(type.type, type)
      const canonical = canonicalizeComponentType(type.type)
      if (canonical && !typeMap.has(canonical)) {
        typeMap.set(canonical, type)
      }
    })

    types.forEach(type => {
      const baseType = type.type.replace(/-v\d+$/, '')
      if (baseType !== type.type && !typeMap.has(baseType)) {
        typeMap.set(baseType, type)
      }
    })

    const normalizedDetected: DetectionResult[] = []
    const isPageContainer = (d: DetectionResult) => /^(page)(?:-v\d+)?$/.test(d.type)
    for (const detection of detected) {
      if (isPageContainer(detection) && detection.children && detection.children.length > 0) {
        normalizedDetected.push(...detection.children)
      } else {
        normalizedDetected.push(detection)
      }
    }

    const normalizeType = (type: string): string => {
      const lowered = (type || '').toLowerCase()
      if (/^(nav|navbar|menu|navigation)/.test(lowered)) return 'navbar'
      if (/^(subscribe|newsletter)/.test(lowered)) return 'subscribe'
      return type
    }

    const total = normalizedDetected.length || 1

    const mappedComponents = normalizedDetected
      .map((detection, index) => {
        const rawNormalized = normalizeType(detection.type)
        const canonicalNormalized = canonicalizeComponentType(rawNormalized)
        const normalizedType = canonicalNormalized ?? rawNormalized
        const canonicalDetection = canonicalizeComponentType(detection.type)
        let resolvedType =
          typeMap.get(normalizedType) ||
          (canonicalDetection ? typeMap.get(canonicalDetection) : undefined) ||
          typeMap.get(detection.type)

        if (!resolvedType) {
          const detectionBase = canonicalDetection || detection.type
          resolvedType = types.find(type =>
            type.type.startsWith(detectionBase) ||
            type.type.startsWith(`${detectionBase}-`)
          )
        }

        if (!resolvedType) {
          const canonicalMissing = canonicalizeComponentType(detection.type)
          throw new Error(
            `[ComponentBuilder] Unresolved detection component type. Raw type: "${detection.type}". Canonical type: "${canonicalMissing ?? 'unresolved'}".`
          )
        }

        if (!resolvedType.id) {
          throw new Error(`Component type ${resolvedType.type} is missing database ID. This indicates a data integrity issue.`)
        }

        const instanceId = generateComponentId(normalizedType, index)
        const { props, content } = extractComponentPayload(detection, resolvedType)
        const region = resolveRegion(detection)
        const placementBucket = (() => {
          if (region === 'header') return 'top'
          if (region === 'footer') return 'bottom'
          const pct = total > 0 ? index / total : 0
          if (pct <= 0.15) return 'top'
          if (pct >= 0.85) return 'bottom'
          return 'middle'
        })()

        if (region) {
          const existingRegion = normalizeRegionValue((props as any).region)
          const existingContentRegion =
            isRecord(content) && 'region' in (content as Record<string, any>)
              ? normalizeRegionValue((content as Record<string, any>).region)
              : undefined
          if (!existingRegion || (existingContentRegion && existingContentRegion !== region)) {
            ;(props as any).region = region
            if (props.metadata && typeof props.metadata === 'object') {
              props.metadata = { ...props.metadata, region }
            } else {
              props.metadata = { region }
            }
          }
        }

        const contentRegion =
          isRecord(content) && 'region' in (content as Record<string, any>)
            ? normalizeRegionValue((content as Record<string, any>).region)
            : undefined
        const assignedRegion = normalizeRegionValue((props as any).region)
        const metadataRegion = normalizeRegionValue((props as any).metadata?.region)
        if (contentRegion && !assignedRegion && !metadataRegion) {
          ;(props as any).region = contentRegion
          if (props.metadata && typeof props.metadata === 'object') {
            props.metadata = { ...props.metadata, region: contentRegion }
          } else {
            props.metadata = { region: contentRegion }
          }
        }
        ;(props as any).placementBucket = placementBucket

        const canonicalComponentType = canonicalizeComponentType(resolvedType.type) ?? resolvedType.type
        const cmsComponentType =
          toCmsComponentType(canonicalComponentType) ?? toCmsComponentType(resolvedType.type)

        if (cmsComponentType) {
          (props as Record<string, unknown>).type = cmsComponentType
        }

        const instance: ComponentInstance = {
          id: instanceId,
          type: normalizedType,
          typeId: resolvedType.id,
          componentType: cmsComponentType,
          componentTypeId: resolvedType.id,
          parentId: null,
          position: index,
          props,
          ...(content === undefined ? {} : { content }),
          children: detection.children
            ? this.mapToComponentInstances(detection.children, types)
            : undefined
        }

        return instance
      })
      .filter((component): component is ComponentInstance => component !== null)

    const timelineMerged = mergeTimelineProcessCtas(mappedComponents)
    const mergedComponents = mergeTwoColumnInlineCtas(timelineMerged)

    return mergedComponents.map((component, index) => ({
      ...component,
      position: index
    }))
  }

  optimizeComponentTree(tree: ComponentTree): ComponentTree {
    const optimizedComponents = deduplicateComponents(tree.components)
    const repositionedComponents = calculatePositions(optimizedComponents)

    const metadata = {
      totalComponents: countComponentInstances(repositionedComponents),
      maxDepth: calculateInstanceMaxDepth(repositionedComponents),
      componentTypes: collectComponentInstanceTypes(repositionedComponents)
    }

    return {
      ...tree,
      components: repositionedComponents,
      metadata
    }
  }

  validateComponentTree(tree: ComponentTree): boolean {
    try {
      if (!tree || !tree.components) {
        return false
      }

      const visited = new Set<string>()
      const checkCircular = (component: ComponentInstance, ancestors: Set<string> = new Set()): boolean => {
        if (ancestors.has(component.id)) {
          console.error(`Circular dependency detected for component ${component.id}`)
          return false
        }

        visited.add(component.id)
        const newAncestors = new Set(ancestors).add(component.id)

        if (component.children) {
          for (const child of component.children) {
            if (!checkCircular(child, newAncestors)) {
              return false
            }
          }
        }
        return true
      }

      const allIds = new Set<string>()
      const parentIds = new Set<string>()

      const collectIds = (components: ComponentInstance[]) => {
        components.forEach(component => {
          allIds.add(component.id)
          if (component.parentId) {
            parentIds.add(component.parentId)
          }
          if (component.children) {
            collectIds(component.children)
          }
        })
      }

      collectIds(tree.components)

      for (const parentId of parentIds) {
        if (!allIds.has(parentId)) {
          console.error(`Orphaned component found with parentId: ${parentId}`)
          return false
        }
      }

      for (const component of tree.components) {
        if (!checkCircular(component)) {
          return false
        }
      }

      return true
    } catch (error) {
      console.error('Error validating component tree:', error)
      return false
    }
  }

  calculateMaxDepth(components: DetectionResult[]): number {
    return calculateDetectionMaxDepth(components)
  }
}

function mergeTimelineProcessCtas(components: ComponentInstance[]): ComponentInstance[] {
  if (!Array.isArray(components) || components.length === 0) {
    return components
  }

  const merged: ComponentInstance[] = []
  for (let index = 0; index < components.length; index += 1) {
    const current = components[index]
    const canonicalCurrent = canonicalizeComponentType(current.type)

    if (canonicalCurrent === 'timeline') {
      const next = components[index + 1]
      const canonicalNext = next ? canonicalizeComponentType(next.type) : undefined
      if (next && canonicalNext === 'cta-simple' && shouldFoldProcessCtaIntoTimeline(next.props, current.props, next.content, current.content)) {
        const action = extractPrimaryActionFromCta(next.props, next.content)
        if (action) {
          attachFooterCta(current, action)
          merged.push(current)
          index += 1
          continue
        }
      }
    }

    merged.push(current)
  }

  return merged
}

function mergeTwoColumnInlineCtas(components: ComponentInstance[]): ComponentInstance[] {
  if (!Array.isArray(components) || components.length === 0) {
    return components
  }

  const merged: ComponentInstance[] = []
  for (let index = 0; index < components.length; index += 1) {
    const current = components[index]
    const canonicalCurrent = canonicalizeComponentType(current.type)

    if (canonicalCurrent === 'cta-simple') {
      const previous = merged.length > 0 ? merged[merged.length - 1] : undefined
      if (previous && canonicalizeComponentType(previous.type) === 'two-column' && mergeInlineCtaIntoTwoColumn(current, previous)) {
        continue
      }
      const next = components[index + 1]
      if (next && canonicalizeComponentType(next.type) === 'two-column' && mergeInlineCtaIntoTwoColumn(current, next)) {
        continue
      }
    }

    if (canonicalCurrent === 'two-column' && merged.length > 0) {
      const previous = merged[merged.length - 1]
      if (previous && canonicalizeComponentType(previous.type) === 'cta-simple' && mergeInlineCtaIntoTwoColumn(previous, current)) {
        merged.pop()
      }
    }

    merged.push(current)
  }

  return merged
}

type InlineColumn = 'left' | 'right'

function mergeInlineCtaIntoTwoColumn(cta: ComponentInstance, target: ComponentInstance): boolean {
  const action = extractPrimaryActionFromCta(cta.props, cta.content)
  if (!action) {
    return false
  }

  const targetContent = isRecord(target.content) ? (target.content as Record<string, any>) : undefined
  if (!targetContent) {
    return false
  }

  const markup = buildInlineCtaMarkup(action)
  if (!markup) {
    return false
  }

  const leftEntries = getColumnEntries(targetContent, 'left')
  const rightEntries = getColumnEntries(targetContent, 'right')
  const targetEntry = findTextBlockEntry(leftEntries) ?? findTextBlockEntry(rightEntries)

  if (targetEntry) {
    appendInlineMarkup(targetEntry, markup)
    return true
  }

  const fallback =
    ensureColumnArray(targetContent, 'left') ??
    ensureColumnArray(targetContent, 'right')

  if (!fallback) {
    return false
  }

  fallback.push(buildInlineTextBlock(target.id, fallback.length, markup))
  return true
}

function getColumnEntries(content: Record<string, any>, column: InlineColumn): Record<string, any>[] | undefined {
  const directKey = column === 'left' ? 'leftColumn' : 'rightColumn'
  const direct = content[directKey]
  if (Array.isArray(direct)) {
    return direct as Record<string, any>[]
  }

  if (isRecord(content.areas) && Array.isArray((content.areas as Record<string, any>)[column])) {
    return (content.areas as Record<string, any>)[column] as Record<string, any>[]
  }

  return undefined
}

function ensureColumnArray(content: Record<string, any>, column: InlineColumn): Record<string, any>[] | undefined {
  const existing = getColumnEntries(content, column)
  if (existing) {
    return existing
  }

  if (!isRecord(content.areas)) {
    content.areas = {}
  }

  const areas = content.areas as Record<string, any>
  if (!Array.isArray(areas[column])) {
    areas[column] = []
  }

  return areas[column] as Record<string, any>[]
}

function findTextBlockEntry(
  entries: Record<string, any>[] | undefined
): { entry: Record<string, any>; content: Record<string, any> } | null {
  if (!Array.isArray(entries)) {
    return null
  }

  for (const entry of entries) {
    if (!isRecord(entry)) {
      continue
    }
    const canonicalChild = canonicalizeComponentType(entry.type ?? entry.componentType ?? entry.kind)
    if (canonicalChild === 'text-block') {
      if (!isRecord(entry.content)) {
        entry.content = {}
      }
      return {
        entry,
        content: entry.content as Record<string, any>
      }
    }
  }

  return null
}

function appendInlineMarkup(
  target: { entry: Record<string, any>; content: Record<string, any> },
  markup: string
): void {
  const existingBody = typeof target.content.body === 'string' ? target.content.body : ''
  const mergedBody = existingBody ? `${existingBody}${markup}` : markup
  target.content.body = mergedBody

  const existingBodyHtml = typeof target.content.bodyHtml === 'string' ? target.content.bodyHtml : ''
  target.content.bodyHtml = existingBodyHtml ? `${existingBodyHtml}${markup}` : mergedBody
}

function buildInlineTextBlock(parentId: string, index: number, body: string): Record<string, any> {
  return {
    id: `${parentId}:inline-cta:${index}`,
    type: 'text-block',
    category: 'content',
    theme: 'auto',
    content: {
      body,
      bodyHtml: body
    }
  }
}

/**
 * shadcn-aligned button variants for inline CTA generation
 * Uses pure Tailwind utilities with shadcn CSS variable references
 */
type InlineButtonVariant = 'default' | 'secondary' | 'outline' | 'ghost' | 'link' | 'destructive'

const INLINE_BUTTON_BASE_CLASS =
  'cms-inline-cta__button inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg font-medium transition-colors duration-200 min-h-[44px] min-w-[44px] px-5 text-sm tracking-tight focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0'

const INLINE_BUTTON_VARIANTS: Record<InlineButtonVariant, string> = {
  default: 'bg-primary text-primary-foreground shadow hover:bg-primary/90',
  secondary: 'bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80',
  outline: 'border border-input bg-background text-foreground shadow-sm hover:bg-accent hover:text-accent-foreground',
  ghost: 'bg-transparent text-foreground hover:bg-accent hover:text-accent-foreground',
  link: 'bg-transparent px-0 text-primary underline-offset-4 hover:underline min-h-0',
  destructive: 'bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90',
}

/**
 * Maps input variant to shadcn-standard variant
 * Provides backward compatibility for legacy variant names
 */
function resolveInlineVariant(value?: string): InlineButtonVariant {
  const normalized = normalizeString(value)
  if (!normalized) {
    return 'default'
  }
  switch (normalized) {
    // Legacy names map to shadcn equivalents
    case 'primary':
    case 'accent':
      return 'default'
    case 'neutral':
      return 'secondary'
    // shadcn-standard names pass through
    case 'default':
      return 'default'
    case 'secondary':
      return 'secondary'
    case 'outline':
      return 'outline'
    case 'ghost':
      return 'ghost'
    case 'link':
      return 'link'
    case 'destructive':
    case 'danger':
      return 'destructive'
    default:
      return 'default'
  }
}

function buildInlineCtaMarkup(action: { text: string; url: string; variant?: string; external?: boolean }): string {
  const variant = resolveInlineVariant(action.variant)
  const className = `${INLINE_BUTTON_BASE_CLASS} ${INLINE_BUTTON_VARIANTS[variant]}`.trim()
  const wrapperClass = 'cms-inline-cta flex justify-start'
  const escapedUrl = escapeHtml(action.url)
  const escapedLabel = escapeHtml(action.text)
  const isExternal = Boolean(action.external)
  const attributes = isExternal ? ' target="_blank" rel="noopener noreferrer"' : ''
  return `<div class="${wrapperClass}"><a class="${className}" href="${escapedUrl}"${attributes}>${escapedLabel}</a></div>`
}

function shouldFoldProcessCtaIntoTimeline(
  ctaProps: Record<string, any> | undefined,
  timelineProps: Record<string, any> | undefined,
  ctaContent: unknown,
  timelineContent: unknown
): boolean {
  if (!ctaProps || !timelineProps) {
    return false
  }

  const tokens = normalizeTokenArray(ctaProps.semanticTokens ?? ctaProps.metadata?.semanticTokens)
  const hasProcessToken = tokens.some(token => token.includes('process') || token.includes('journey') || token.includes('steps'))
  if (hasProcessToken) {
    return true
  }

  const heading = normalizeString(ctaProps.heading ?? ctaProps.title ?? ctaProps.eyebrow ?? ctaProps.body)
  if (heading && heading.toLowerCase().includes('process')) {
    return true
  }

  if (isRecord(ctaContent)) {
    const contentHeading = normalizeString(
      (ctaContent as Record<string, any>).heading ??
        (ctaContent as Record<string, any>).title ??
        (ctaContent as Record<string, any>).eyebrow
    )
    if (contentHeading && contentHeading.toLowerCase().includes('process')) {
      return true
    }
  }

  if (isRecord(timelineContent) && isRecord((timelineContent as Record<string, any>).footerCta)) {
    return false
  }

  return false
}

function extractPrimaryActionFromCta(
  props: Record<string, any> | undefined,
  content: unknown
): { text: string; url: string; variant?: string; external?: boolean } | null {
  if (!props) {
    return null
  }
  const contentRecord = isRecord(content) ? content as Record<string, any> : undefined

  const primary =
    props.primaryButton ??
    contentRecord?.primaryButton ??
    (Array.isArray(props.ctaButtons) && props.ctaButtons.length > 0 ? props.ctaButtons[0] : undefined)

  if (!isRecord(primary)) {
    return null
  }

  const text = normalizeString(primary.text ?? primary.label ?? primary.title)
  const url = normalizeString(primary.url ?? primary.href ?? primary.link)
  const variant = normalizeString(primary.variant ?? primary.style ?? primary.theme)
  const external =
    typeof primary.external === 'boolean'
      ? primary.external
      : typeof primary.target === 'string'
        ? primary.target.toLowerCase() === '_blank'
        : undefined

  if (!text || !url) {
    return null
  }

  const action: { text: string; url: string; variant?: string; external?: boolean } = { text, url }
  if (variant) {
    action.variant = variant
  }
  if (external !== undefined) {
    action.external = external
  }
  return action
}

function attachFooterCta(
  timelineComponent: ComponentInstance,
  action: { text: string; url: string; variant?: string }
): void {
  if (!timelineComponent.props) {
    timelineComponent.props = {}
  }
  const props = timelineComponent.props
  const content = isRecord(timelineComponent.content) ? (timelineComponent.content as Record<string, any>) : {}

  if (isRecord(content.footerCta) && Object.keys(content.footerCta).length > 0) {
    return
  }

  content.footerCta = {
    type: 'timeline-action',
    text: action.text,
    url: action.url,
    ...(action.variant ? { variant: action.variant } : {})
  }

  timelineComponent.content = content
}

function normalizeTokenArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return []
  }
  return value
    .map(entry => (typeof entry === 'string' ? entry.toLowerCase().trim() : ''))
    .filter(entry => entry.length > 0)
}

function normalizeString(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined
  }
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

function isRecord(value: unknown): value is Record<string, any> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}
