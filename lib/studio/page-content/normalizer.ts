import { ComponentType } from '@/lib/studio/components/cms/_core/types'
import type { ComponentInstance } from '@/lib/studio/types/site-builder/component-instance'
import {
  PAGE_CONTENT_VERSION,
  type NormalizePageContentOptions,
  type NormalizePageContentResult,
  type PageContentDiagnostic,
  type PageContentRegionSummary,
  type PageContentV1,
} from './types'

type AnyRecord = Record<string, unknown>
type StrictDiagnosticsOptions = Required<NormalizePageContentOptions>

export class PageContentNormalizationError extends Error {
  readonly diagnostics: PageContentDiagnostic[]

  constructor(diagnostics: PageContentDiagnostic[]) {
    super('Page content failed strict normalization.')
    this.name = 'PageContentNormalizationError'
    this.diagnostics = diagnostics
  }
}

function resolveOptions(options?: NormalizePageContentOptions): StrictDiagnosticsOptions {
  return {
    mode: options?.mode ?? 'legacy-read',
  }
}

function isStrictWrite(options: StrictDiagnosticsOptions): boolean {
  return options.mode === 'strict-write'
}

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

function addStrictDiagnostic(
  diagnostics: PageContentDiagnostic[],
  diagnostic: Omit<PageContentDiagnostic, 'continued' | 'severity'> & { severity?: PageContentDiagnostic['severity'] }
): void {
  addDiagnostic(diagnostics, {
    severity: 'error',
    ...diagnostic,
  })
}

function throwOnStrictErrors(options: StrictDiagnosticsOptions, diagnostics: PageContentDiagnostic[]): void {
  if (isStrictWrite(options) && diagnostics.some(diagnostic => diagnostic.severity === 'error')) {
    throw new PageContentNormalizationError(diagnostics)
  }
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

function normalizeBlogListContent(
  value: unknown,
  diagnostics: PageContentDiagnostic[],
  options: StrictDiagnosticsOptions,
  path: string
): unknown {
  if (!isRecord(value) || !Array.isArray(value.blogs)) {
    return value
  }

  const existingPosts = Array.isArray(value.posts) ? value.posts : []
  if (existingPosts.length > 0) {
    return value
  }

  const posts = value.blogs.map((entry, index) => {
    const entryPath = `${path}.blogs[${index}]`
    if (!isRecord(entry)) {
      if (isStrictWrite(options)) {
        addStrictDiagnostic(diagnostics, {
          code: 'PAGE_CONTENT_BLOG_ENTRY_INVALID',
          message: 'Blog-list entry is not an object and would require fabricated id/title/slug fields.',
          path: entryPath,
        })
      }
      return {
        id: `post-${index + 1}`,
        title: String(entry ?? ''),
      }
    }

    if (isStrictWrite(options)) {
      if (typeof entry.title !== 'string' || entry.title.trim().length === 0) {
        addStrictDiagnostic(diagnostics, {
          code: 'PAGE_CONTENT_BLOG_ENTRY_TITLE_MISSING',
          message: 'Blog-list entry title is missing; strict writes do not fabricate titles.',
          path: `${entryPath}.title`,
          context: { index },
        })
      }

      const hasExplicitId = typeof entry.id === 'string' && entry.id.trim().length > 0
      const hasExplicitSlug = typeof entry.slug === 'string' && entry.slug.trim().length > 0
      const hasExplicitLink = typeof entry.link === 'string' && entry.link.trim().length > 0

      if (!hasExplicitId && !hasExplicitSlug) {
        addStrictDiagnostic(diagnostics, {
          code: 'PAGE_CONTENT_BLOG_ENTRY_ID_MISSING',
          message: 'Blog-list entry id is missing; strict writes do not fabricate ids.',
          path: `${entryPath}.id`,
          context: { index },
        })
      }

      if (!hasExplicitSlug && !hasExplicitLink) {
        addStrictDiagnostic(diagnostics, {
          code: 'PAGE_CONTENT_BLOG_ENTRY_SLUG_MISSING',
          message: 'Blog-list entry slug is missing; strict writes do not fabricate slugs.',
          path: `${entryPath}.slug`,
          context: { index },
        })
      }
    }

    const id = typeof entry.id === 'string' && entry.id.trim().length > 0
      ? entry.id
      : typeof entry.slug === 'string' && entry.slug.trim().length > 0
        ? entry.slug
        : `post-${index + 1}`

    const normalizedPost: Record<string, unknown> = {
      ...entry,
      id,
    }

    if (normalizedPost.publishDate === undefined && entry.date !== undefined) {
      normalizedPost.publishDate = entry.date
    }

    if (normalizedPost.categories === undefined && typeof entry.topic === 'string' && entry.topic.trim().length > 0) {
      normalizedPost.categories = [entry.topic]
    }

    if (normalizedPost.slug === undefined) {
      if (typeof entry.slug === 'string' && entry.slug.trim().length > 0) {
        normalizedPost.slug = entry.slug
      } else if (typeof entry.link === 'string' && entry.link.trim().length > 0) {
        normalizedPost.slug = entry.link
      } else {
        normalizedPost.slug = id
      }
    }

    if (normalizedPost.thumbnail === undefined && entry.image !== undefined) {
      normalizedPost.thumbnail = entry.image
    }

    return normalizedPost
  })

  return {
    ...value,
    title: typeof value.title === 'string' ? value.title : value.heading,
    posts,
  }
}

function normalizeContentForComponentType(
  type: string,
  value: unknown,
  diagnostics: PageContentDiagnostic[],
  options: StrictDiagnosticsOptions,
  path: string
): Record<string, unknown> {
  const normalized = type === 'blog-list'
    ? normalizeBlogListContent(value, diagnostics, options, path)
    : value
  return isRecord(normalized) ? normalized : {}
}

function hasContent(value: unknown): value is Record<string, unknown> {
  return isRecord(value) && Object.keys(value).length > 0
}

function hasOwn(value: AnyRecord, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key)
}

function strictPayloadDiagnostics(
  instance: AnyRecord,
  diagnostics: PageContentDiagnostic[],
  path: string,
  options: StrictDiagnosticsOptions
): void {
  if (!isStrictWrite(options)) {
    return
  }

  if (hasOwn(instance, 'props') && !isRecord(instance.props)) {
    addStrictDiagnostic(diagnostics, {
      code: 'PAGE_CONTENT_COMPONENT_PROPS_INVALID',
      message: 'Component props must be an object for strict writes.',
      path: `${path}.props`,
    })
  }

  if (hasOwn(instance, 'data') && !isRecord(instance.data)) {
    addStrictDiagnostic(diagnostics, {
      code: 'PAGE_CONTENT_COMPONENT_DATA_INVALID',
      message: 'Component data must be an object when used as a props source for strict writes.',
      path: `${path}.data`,
    })
  }

  const propsSource = isRecord(instance.props) ? instance.props : isRecord(instance.data) ? instance.data : undefined
  if (propsSource) {
    if (typeof propsSource.content === 'string') {
      addStrictDiagnostic(diagnostics, {
        code: 'PAGE_CONTENT_COMPONENT_PROPS_CONTENT_STRING',
        message: 'Component props.content must be an object for strict writes; string payloads are not accepted.',
        path: `${path}.${isRecord(instance.props) ? 'props' : 'data'}.content`,
      })
    }

    if (typeof propsSource.text === 'string' && isRecord(parseJsonString(propsSource.text))) {
      addStrictDiagnostic(diagnostics, {
        code: 'PAGE_CONTENT_COMPONENT_PROPS_TEXT_LEGACY_JSON',
        message: 'Component props.text legacy JSON payloads are not accepted for strict writes.',
        path: `${path}.${isRecord(instance.props) ? 'props' : 'data'}.text`,
      })
    }
  }

  if (hasOwn(instance, 'content') && !isRecord(instance.content)) {
    addStrictDiagnostic(diagnostics, {
      code: 'PAGE_CONTENT_COMPONENT_CONTENT_INVALID',
      message: 'Component content must be an object for strict writes.',
      path: `${path}.content`,
    })
  }

  if (hasOwn(instance, 'styles') && !isRecord(instance.styles)) {
    addStrictDiagnostic(diagnostics, {
      code: 'PAGE_CONTENT_COMPONENT_STYLES_INVALID',
      message: 'Component styles must be an object for strict writes.',
      path: `${path}.styles`,
    })
  }

  if (hasOwn(instance, 'metadata') && !isRecord(instance.metadata)) {
    addStrictDiagnostic(diagnostics, {
      code: 'PAGE_CONTENT_COMPONENT_METADATA_INVALID',
      message: 'Component metadata must be an object for strict writes.',
      path: `${path}.metadata`,
    })
  }
}

function omitKeys(value: AnyRecord, keys: Set<string>): AnyRecord {
  return Object.fromEntries(Object.entries(value).filter(([key]) => !keys.has(key)))
}

const STRICT_COMPONENT_SOURCE_KEYS = new Set([
  'componentType',
  'data',
])

const STRICT_PAGE_SOURCE_KEYS = new Set([
  'components',
  'sections',
])

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
  path = `components[${fallbackPosition}]`,
  optionsInput?: NormalizePageContentOptions
): ComponentInstance | null {
  const options = resolveOptions(optionsInput)
  if (!isRecord(instance)) {
    const diagnostic = {
      code: 'PAGE_CONTENT_COMPONENT_INVALID',
      severity: isStrictWrite(options) ? 'error' as const : 'warn' as const,
      message: 'Component entry is not an object and was skipped.',
      path,
    }
    addDiagnostic(diagnostics, diagnostic)
    return null
  }

  strictPayloadDiagnostics(instance, diagnostics, path, options)

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
  const propsContent = isRecord(props.content) ? props.content : {}
  const usesPropsContent = !hasContent(rawContent)
  const content = normalizeContentForComponentType(
    type,
    usesPropsContent ? propsContent : rawContent,
    diagnostics,
    options,
    usesPropsContent ? `${path}.props.content` : `${path}.content`
  )
  if (isRecord(props.content) && usesPropsContent) {
    props.content = content
  } else if (isRecord(props.content)) {
    props.content = normalizeContentForComponentType(
      type,
      props.content,
      diagnostics,
      options,
      `${path}.props.content`
    )
  } else if (hasContent(content)) {
    props.content = content
  }
  const styles = isRecord(instance.styles) ? instance.styles : {}
  const rawMetadata = parseJsonString(instance.metadata)
  const metadata = isRecord(rawMetadata) ? rawMetadata : {}
  const globalComponentId = typeof instance.globalComponentId === 'string' ? instance.globalComponentId : undefined
  const sharedComponentId = typeof instance.sharedComponentId === 'string' ? instance.sharedComponentId : undefined
  const passthrough = isStrictWrite(options)
    ? omitKeys(instance, STRICT_COMPONENT_SOURCE_KEYS)
    : instance

  if (type === 'unknown') {
    addDiagnostic(diagnostics, {
      code: 'PAGE_CONTENT_COMPONENT_TYPE_MISSING',
      severity: isStrictWrite(options) ? 'error' : 'warn',
      message: isStrictWrite(options)
        ? 'Component type is missing; strict writes require an explicit type.'
        : 'Component type is missing; normalized to unknown.',
      componentId: id,
      path,
    })
  }

  if (typeof instance.id !== 'string' || instance.id.trim().length === 0) {
    addDiagnostic(diagnostics, {
      code: 'PAGE_CONTENT_COMPONENT_ID_MISSING',
      severity: isStrictWrite(options) ? 'error' : 'warn',
      message: isStrictWrite(options)
        ? 'Component id is missing; strict writes require an explicit id.'
        : `Component id is missing; generated ${id}.`,
      componentId: id,
      path,
    })
  }

  return {
    ...passthrough,
    id,
    type,
    ...(componentType && !isStrictWrite(options) ? { componentType } : {}),
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
  diagnostics: PageContentDiagnostic[] = [],
  optionsInput?: NormalizePageContentOptions
): ComponentInstance[] {
  const options = resolveOptions(optionsInput)
  if (!Array.isArray(value)) {
    if (value !== undefined && value !== null) {
      addDiagnostic(diagnostics, {
        code: 'PAGE_CONTENT_COMPONENTS_INVALID',
        severity: isStrictWrite(options) ? 'error' : 'warn',
        message: isStrictWrite(options)
          ? 'Components value is not an array; strict writes require a components array.'
          : 'Components value is not an array; using an empty component list.',
        path: 'components',
      })
    }
    return []
  }

  return value
    .map((node, index) => normalizeComponent(node, index, diagnostics, `components[${index}]`, options))
    .filter((component): component is ComponentInstance => component !== null)
}

export function normalizeTemplateProps(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {}
}

export function normalizeMetadata(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {}
}

function extractComponentCandidates(
  content: unknown,
  diagnostics: PageContentDiagnostic[],
  options: StrictDiagnosticsOptions
): unknown[] {
  if (Array.isArray(content)) {
    addDiagnostic(diagnostics, {
      code: 'PAGE_CONTENT_LEGACY_ARRAY',
      severity: isStrictWrite(options) ? 'error' : 'info',
      message: isStrictWrite(options)
        ? 'Legacy array page content is not valid for strict writes.'
        : 'Legacy array page content was adapted to PageContentV1.',
      path: '$',
    })
    return content
  }

  if (!isRecord(content)) {
    if (content !== undefined && content !== null) {
      addDiagnostic(diagnostics, {
        code: 'PAGE_CONTENT_INVALID',
        severity: isStrictWrite(options) ? 'error' : 'warn',
        message: isStrictWrite(options)
          ? 'Page content is not an object; strict writes require PageContentV1-compatible content.'
          : 'Page content is not an object or array; using empty PageContentV1.',
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
      severity: isStrictWrite(options) ? 'error' : 'info',
      message: isStrictWrite(options)
        ? 'Legacy sections page content is not valid for strict writes.'
        : 'Legacy sections page content was adapted to PageContentV1 components.',
      path: 'sections',
    })
    return content.sections
  }

  if (typeof content.type === 'string' || typeof content.componentType === 'string') {
    addDiagnostic(diagnostics, {
      code: 'PAGE_CONTENT_LEGACY_SINGLE_COMPONENT',
      severity: isStrictWrite(options) ? 'error' : 'info',
      message: isStrictWrite(options)
        ? 'Single component page content is not valid for strict writes.'
        : 'Single component page content was adapted to PageContentV1 components.',
      path: '$',
    })
    return [content]
  }

  if (isStrictWrite(options) && 'components' in content) {
    addStrictDiagnostic(diagnostics, {
      code: 'PAGE_CONTENT_COMPONENTS_INVALID',
      message: 'Components value is not an array; strict writes require a components array.',
      path: 'components',
    })
  }

  return []
}

export function normalizePageContent(
  content: unknown,
  optionsInput?: NormalizePageContentOptions
): NormalizePageContentResult {
  const options = resolveOptions(optionsInput)
  const diagnostics: PageContentDiagnostic[] = []
  const parsedContent = parseJsonString(content)
  if (typeof content === 'string' && parsedContent !== content) {
    addDiagnostic(diagnostics, {
      code: 'PAGE_CONTENT_JSON_STRING',
      severity: isStrictWrite(options) ? 'error' : 'info',
      message: isStrictWrite(options)
        ? 'JSON string page content is not valid for strict writes.'
        : 'JSON string page content was parsed before normalization.',
      path: '$',
    })
  }

  const source = isRecord(parsedContent) ? parsedContent : {}

  if (isStrictWrite(options) && hasOwn(source, 'metadata') && !isRecord(source.metadata)) {
    addStrictDiagnostic(diagnostics, {
      code: 'PAGE_CONTENT_METADATA_INVALID',
      message: 'Page metadata must be an object for strict writes.',
      path: 'metadata',
    })
  }

  const componentCandidates = extractComponentCandidates(parsedContent, diagnostics, options)
  const pageContent: PageContentV1 = {
    version: PAGE_CONTENT_VERSION,
    components: normalizeComponents(componentCandidates, diagnostics, options),
  }

  const regions = normalizeRegionSummary(source.regions)
  if (regions.length > 0) {
    pageContent.regions = regions
  }

  const metadata = normalizeMetadata(source.metadata)
  if (Object.keys(metadata).length > 0) {
    pageContent.metadata = metadata
  }

  throwOnStrictErrors(options, diagnostics)

  return { pageContent, diagnostics }
}

export function toCanonicalPageContent(
  content: unknown,
  componentsOverride?: unknown,
  optionsInput?: NormalizePageContentOptions
): Record<string, unknown> {
  const options = resolveOptions(optionsInput)
  const diagnostics: PageContentDiagnostic[] = []
  if (isStrictWrite(options) && !isRecord(content)) {
    addStrictDiagnostic(diagnostics, {
      code: 'PAGE_CONTENT_INVALID',
      message: 'Page content is not an object; strict writes require PageContentV1-compatible content.',
      path: '$',
    })
    throwOnStrictErrors(options, diagnostics)
  }

  if (isStrictWrite(options) && isRecord(content) && 'components' in content && !Array.isArray(content.components)) {
    addStrictDiagnostic(diagnostics, {
      code: 'PAGE_CONTENT_COMPONENTS_INVALID',
      message: 'Components value is not an array; strict writes require a components array.',
      path: 'components',
    })
    throwOnStrictErrors(options, diagnostics)
  }

  const pageContent = componentsOverride === undefined
    ? normalizePageContent(content, options).pageContent
    : {
        components: [],
        regions: normalizeRegionSummary(isRecord(content) ? content.regions : undefined),
        metadata: normalizeMetadata(isRecord(content) ? content.metadata : undefined),
      }
  const source = isRecord(content) ? content : {}
  if (isStrictWrite(options) && hasOwn(source, 'metadata') && !isRecord(source.metadata)) {
    addStrictDiagnostic(diagnostics, {
      code: 'PAGE_CONTENT_METADATA_INVALID',
      message: 'Page metadata must be an object for strict writes.',
      path: 'metadata',
    })
    throwOnStrictErrors(options, diagnostics)
  }

  const components = componentsOverride === undefined
    ? pageContent.components
    : normalizeComponents(componentsOverride, diagnostics, options)
  throwOnStrictErrors(options, diagnostics)
  const outputSource = isStrictWrite(options) ? omitKeys(source, STRICT_PAGE_SOURCE_KEYS) : source

  return {
    ...outputSource,
    version: PAGE_CONTENT_VERSION,
    components,
    ...(pageContent.regions && pageContent.regions.length > 0 ? { regions: pageContent.regions } : {}),
    ...(pageContent.metadata && Object.keys(pageContent.metadata).length > 0 ? { metadata: pageContent.metadata } : {}),
  }
}
