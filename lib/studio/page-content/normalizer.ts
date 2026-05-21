import { ComponentType } from '@/lib/studio/components/cms/_core/types'
import type { ComponentInstance } from '@/lib/studio/types/site-builder/component-instance'
import {
  PAGE_CONTENT_VERSION,
  type NormalizePageContentResult,
  type PageContentDiagnostic,
  type PageContentRegionSummary,
  type PageContentV1,
} from './types'

type AnyRecord = Record<string, unknown>

function isRecord(value: unknown): value is AnyRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function addDiagnostic(
  diagnostics: PageContentDiagnostic[],
  diagnostic: Omit<PageContentDiagnostic, 'continued'>
    & Partial<Pick<PageContentDiagnostic, 'continued'>>
): void {
  diagnostics.push({
    continued: true,
    ...diagnostic,
  })
}

export function parseJsonString(value: unknown): unknown {
  if (typeof value !== 'string') {
    return value
  }

  const trimmed = value.trim()
  if (!trimmed) {
    return value
  }

  const firstChar = trimmed[0]
  const lastChar = trimmed[trimmed.length - 1]
  if ((firstChar === '{' && lastChar === '}') || (firstChar === '[' && lastChar === ']')) {
    try {
      return JSON.parse(trimmed)
    } catch {
      return value
    }
  }

  return value
}

export function normalizeProps(value: unknown): Record<string, unknown> {
  if (!isRecord(value)) {
    return {}
  }

  const normalized: Record<string, unknown> = {}
  let parsedTextContent: Record<string, unknown> | null = null

  Object.entries(value).forEach(([key, entry]) => {
    if (key === 'content' || key === 'data' || key.endsWith('Json')) {
      normalized[key] = parseJsonString(entry)
      return
    }

    if (key === 'text' && typeof entry === 'string') {
      normalized[key] = entry
      const parsed = parseJsonString(entry)
      if (isRecord(parsed)) {
        parsedTextContent = parsed
      }
      return
    }

    normalized[key] = entry
  })

  if (parsedTextContent) {
    const existingContent = normalized.content
    if (isRecord(existingContent)) {
      const merged: Record<string, unknown> = { ...existingContent }
      for (const [key, entry] of Object.entries(parsedTextContent)) {
        const existing = merged[key]
        const existingIsEmpty =
          existing === undefined ||
          existing === null ||
          (Array.isArray(existing) && existing.length === 0) ||
          (isRecord(existing) && Object.keys(existing).length === 0)
        if (existingIsEmpty) {
          merged[key] = entry
        }
      }
      normalized.content = merged
    } else {
      normalized.content = parsedTextContent
    }
  }

  return normalized
}

export function normalizeRegionSummary(value: unknown): PageContentRegionSummary[] {
  if (!isRecord(value)) {
    return []
  }

  return Object.entries(value).reduce<PageContentRegionSummary[]>((acc, [region, types]) => {
    if (typeof region !== 'string') {
      return acc
    }

    if (Array.isArray(types)) {
      const componentTypes = types.filter(type => typeof type === 'string') as ComponentType[]
      acc.push({ region: region as PageContentRegionSummary['region'], componentTypes })
    }

    return acc
  }, [])
}

function normalizeComponentTypeKey(value: string): string {
  return value
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
}

const COMPONENT_TYPE_LOOKUP = new Map<string, ComponentType>(
  (Object.values(ComponentType) as string[]).map(value => [
    normalizeComponentTypeKey(value),
    value as ComponentType,
  ])
)

export function resolveCmsComponentType(value: unknown): ComponentType | undefined {
  if (typeof value !== 'string') {
    return undefined
  }
  return COMPONENT_TYPE_LOOKUP.get(normalizeComponentTypeKey(value))
}

function readComponentType(instance: AnyRecord): string {
  if (typeof instance.type === 'string' && instance.type.trim().length > 0) {
    return instance.type
  }
  if (typeof instance.componentType === 'string' && instance.componentType.trim().length > 0) {
    return instance.componentType
  }
  return 'unknown'
}

export function normalizeComponent(
  instance: unknown,
  fallbackPosition: number,
  diagnostics: PageContentDiagnostic[] = [],
  path = `components[${fallbackPosition}]`
): ComponentInstance | null {
  if (!isRecord(instance)) {
    addDiagnostic(diagnostics, {
      code: 'PAGE_CONTENT_COMPONENT_INVALID',
      severity: 'warn',
      message: 'Component entry is not an object and was skipped.',
      path,
    })
    return null
  }

  const rawTypeId = typeof instance.typeId === 'string' ? instance.typeId : undefined
  const rawComponentTypeId =
    typeof instance.componentTypeId === 'string' ? instance.componentTypeId : rawTypeId
  const componentType = resolveCmsComponentType(instance.componentType)
  const id = typeof instance.id === 'string' && instance.id.trim().length > 0
    ? instance.id
    : `component-${fallbackPosition}`
  const type = readComponentType(instance)
  const parentId = instance.parentId === null || typeof instance.parentId === 'string'
    ? instance.parentId
    : null
  const position = typeof instance.position === 'number' ? instance.position : fallbackPosition
  const props = normalizeProps(instance.props ?? instance.data)
  const rawContent = parseJsonString(instance.content)
  const content = isRecord(rawContent) ? rawContent : {}
  const styles = isRecord(instance.styles) ? instance.styles : {}
  const rawMetadata = parseJsonString(instance.metadata)
  const metadata = isRecord(rawMetadata) ? rawMetadata : {}
  const globalComponentId = typeof instance.globalComponentId === 'string' ? instance.globalComponentId : undefined
  const sharedComponentId = typeof instance.sharedComponentId === 'string' ? instance.sharedComponentId : undefined

  if (type === 'unknown') {
    addDiagnostic(diagnostics, {
      code: 'PAGE_CONTENT_COMPONENT_TYPE_MISSING',
      severity: 'warn',
      message: 'Component type is missing; normalized to unknown.',
      componentId: id,
      path,
    })
  }

  if (typeof instance.id !== 'string' || instance.id.trim().length === 0) {
    addDiagnostic(diagnostics, {
      code: 'PAGE_CONTENT_COMPONENT_ID_MISSING',
      severity: 'warn',
      message: `Component id is missing; generated ${id}.`,
      componentId: id,
      path,
    })
  }

  return {
    ...instance,
    id,
    type,
    ...(componentType ? { componentType } : {}),
    ...(rawComponentTypeId ? { componentTypeId: rawComponentTypeId } : {}),
    ...(rawTypeId ? { typeId: rawTypeId } : {}),
    parentId,
    position,
    props,
    content,
    styles,
    metadata,
    ...(globalComponentId ? { globalComponentId } : {}),
    ...(sharedComponentId ? { sharedComponentId } : {}),
  }
}

export function normalizeComponents(
  value: unknown,
  diagnostics: PageContentDiagnostic[] = []
): ComponentInstance[] {
  if (!Array.isArray(value)) {
    if (value !== undefined && value !== null) {
      addDiagnostic(diagnostics, {
        code: 'PAGE_CONTENT_COMPONENTS_INVALID',
        severity: 'warn',
        message: 'Components value is not an array; using an empty component list.',
        path: 'components',
      })
    }
    return []
  }

  return value
    .map((node, index) => normalizeComponent(node, index, diagnostics))
    .filter((component): component is ComponentInstance => component !== null)
}

export function normalizeTemplateProps(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {}
}

export function normalizeMetadata(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {}
}

function extractComponentCandidates(content: unknown, diagnostics: PageContentDiagnostic[]): unknown[] {
  if (Array.isArray(content)) {
    addDiagnostic(diagnostics, {
      code: 'PAGE_CONTENT_LEGACY_ARRAY',
      severity: 'info',
      message: 'Legacy array page content was adapted to PageContentV1.',
      path: '$',
    })
    return content
  }

  if (!isRecord(content)) {
    if (content !== undefined && content !== null) {
      addDiagnostic(diagnostics, {
        code: 'PAGE_CONTENT_INVALID',
        severity: 'warn',
        message: 'Page content is not an object or array; using empty PageContentV1.',
        path: '$',
      })
    }
    return []
  }

  if (Array.isArray(content.components)) {
    return content.components
  }

  if (Array.isArray(content.sections)) {
    addDiagnostic(diagnostics, {
      code: 'PAGE_CONTENT_LEGACY_SECTIONS',
      severity: 'info',
      message: 'Legacy sections page content was adapted to PageContentV1 components.',
      path: 'sections',
    })
    return content.sections
  }

  if (typeof content.type === 'string' || typeof content.componentType === 'string') {
    addDiagnostic(diagnostics, {
      code: 'PAGE_CONTENT_LEGACY_SINGLE_COMPONENT',
      severity: 'info',
      message: 'Single component page content was adapted to PageContentV1 components.',
      path: '$',
    })
    return [content]
  }

  return []
}

export function normalizePageContent(content: unknown): NormalizePageContentResult {
  const diagnostics: PageContentDiagnostic[] = []
  const parsedContent = parseJsonString(content)
  if (typeof content === 'string' && parsedContent !== content) {
    addDiagnostic(diagnostics, {
      code: 'PAGE_CONTENT_JSON_STRING',
      severity: 'info',
      message: 'JSON string page content was parsed before normalization.',
      path: '$',
    })
  }

  const source = isRecord(parsedContent) ? parsedContent : {}
  const componentCandidates = extractComponentCandidates(parsedContent, diagnostics)
  const pageContent: PageContentV1 = {
    version: PAGE_CONTENT_VERSION,
    components: normalizeComponents(componentCandidates, diagnostics),
  }

  const regions = normalizeRegionSummary(source.regions)
  if (regions.length > 0) {
    pageContent.regions = regions
  }

  const metadata = normalizeMetadata(source.metadata)
  if (Object.keys(metadata).length > 0) {
    pageContent.metadata = metadata
  }

  return { pageContent, diagnostics }
}

export function toCanonicalPageContent(
  content: unknown,
  componentsOverride?: unknown
): Record<string, unknown> {
  const { pageContent } = normalizePageContent(content)
  const source = isRecord(content) ? content : {}
  const components = componentsOverride === undefined
    ? pageContent.components
    : normalizeComponents(componentsOverride)

  return {
    ...source,
    version: PAGE_CONTENT_VERSION,
    components,
    ...(pageContent.regions ? { regions: pageContent.regions } : {}),
    ...(pageContent.metadata ? { metadata: pageContent.metadata } : {}),
  }
}
