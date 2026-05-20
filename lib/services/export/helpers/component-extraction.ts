import type { ComponentInstanceExtractor } from '../component-instance-extractor'
import type { UnifiedContent } from '../content-orchestrator'
import type { ComponentExport } from '../types'

type ComponentExtractionResult = {
  components: ComponentExport[]
  usage: Set<string>
}

const inferComponentCategory = (type: string): string => {
  const categoryMap: Record<string, string> = {
    header: 'navigation',
    nav: 'navigation',
    navigation: 'navigation',
    footer: 'navigation',
    hero: 'heroes',
    banner: 'heroes',
    text: 'content',
    content: 'content',
    image: 'media',
    gallery: 'media',
    form: 'forms',
    button: 'interactive'
  }
  return categoryMap[type.toLowerCase()] || 'content'
}

/**
 * Recursively collect all nested component types from properties.
 * This ensures content types are created for nested components like nav-menu-item
 * inside navbar's menuItems property, or card-item inside card-grid's cards.
 */
function collectNestedComponentTypes(
  value: unknown,
  usage: Set<string>,
  visited = new Set<unknown>()
): void {
  if (!value || typeof value !== 'object' || visited.has(value)) return
  visited.add(value)

  if (Array.isArray(value)) {
    for (const item of value) {
      collectNestedComponentTypes(item, usage, visited)
    }
    return
  }

  const obj = value as Record<string, unknown>

  // Check if this object is a nested component (has type field)
  const typeVal = obj.type || obj.contentType || obj._type
  if (typeof typeVal === 'string' && typeVal.trim()) {
    // Skip primitive types AND content reference types (not components)
    // Reference types use 'type' field for discrimination but are NOT components
    const lowerType = typeVal.toLowerCase()
    const primitiveTypes = ['string', 'number', 'boolean', 'object', 'array', 'content', 'content[]']
    const referenceTypes = ['mediareference', 'pagereference', 'internal', 'external', 'email', 'phone', 'anchor']
    if (!primitiveTypes.includes(lowerType) &&
        !referenceTypes.includes(lowerType) &&
        !lowerType.startsWith('array<') &&
        !lowerType.includes('{')) {
      usage.add(typeVal.trim())
    }
  }

  // Recursively process all properties
  for (const val of Object.values(obj)) {
    collectNestedComponentTypes(val, usage, visited)
  }
}

export async function extractComponentsFromUnifiedContent(params: {
  unifiedContent: UnifiedContent[]
  websiteId: string
  extractor: ComponentInstanceExtractor
}): Promise<ComponentExtractionResult> {
  const { unifiedContent, websiteId, extractor } = params

  const allComponents: ComponentExport[] = []
  const usage = new Set<string>()

  const recordUsage = (type?: string) => {
    if (type === undefined || type === null) return
    const raw = String(type).trim()
    if (!raw) return
    usage.add(raw)
  }

  const pagesWithComponents = unifiedContent.filter(item =>
    item.source === 'WebsitePage' &&
    item.type === 'page' &&
    item.content
  )

  for (const page of pagesWithComponents) {
    try {
      const extractedComponents = await extractor.extractAndResolveComponents(
        page.content,
        websiteId,
        usage
      )

      const exportComponents = extractedComponents.map(comp => {
        recordUsage(comp.type)
        return {
          id: comp.id,
          type: comp.type,
          category: inferComponentCategory(comp.type),
          props: comp.properties,
          content: comp.properties,
          metadata: {
            pageId: page.id,
            isShared: comp.isShared,
            sharedId: comp.sharedId,
            hasOverrides: Boolean((comp as any)?.hasOverrides),
            parentId: comp.parentId,
            position: comp.position
          }
        } satisfies ComponentExport
      })

      allComponents.push(...exportComponents)
    } catch (error) {
      console.error(`Error extracting components from page ${page.id}:`, error)
    }
  }

  // Recursively collect nested component types from all component properties
  // This ensures we create content types for nested components like nav-menu-item
  for (const comp of allComponents) {
    collectNestedComponentTypes(comp.props, usage)
    collectNestedComponentTypes(comp.content, usage)
  }

  console.log(`BundleExporter: Extracted ${allComponents.length} component instances (usage=${usage.size}, nested types included)`)
  return { components: allComponents, usage }
}
