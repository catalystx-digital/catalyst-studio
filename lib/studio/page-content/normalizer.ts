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
interface ParseJsonDiagnosticOptions {
  diagnostics: PageContentDiagnostic[]
  options: StrictDiagnosticsOptions
  path: string
  code: string
  message: string
}

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
    mode: options?.mode ?? 'canonical-read',
  }
}

function isStrictWrite(options: StrictDiagnosticsOptions): boolean {
  return options.mode === 'strict-write'
}

function isStrictRead(options: StrictDiagnosticsOptions): boolean {
  return options.mode === 'strict-read'
}

function isStrictMode(options: StrictDiagnosticsOptions): boolean {
  return isStrictRead(options) || isStrictWrite(options)
}

function isCanonicalRead(options: StrictDiagnosticsOptions): boolean {
  return options.mode === 'canonical-read'
}

function shouldStripLegacyPropMirrors(options: StrictDiagnosticsOptions): boolean {
  return isCanonicalRead(options) || isStrictRead(options)
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

function isJsonIntentString(value: string): boolean {
  const trimmed = value.trim()
  if (!trimmed) {
    return false
  }

  const firstChar = trimmed[0]
  const secondToken = trimmed.slice(1).trimStart()[0]

  if (firstChar === '{') {
    return secondToken === '"' || secondToken === '}'
  }

  if (firstChar === '[') {
    return (
      secondToken === '{'
      || secondToken === '['
      || secondToken === '"'
      || secondToken === ']'
    )
  }

  return false
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

function parseJsonStringWithDiagnostics(
  value: unknown,
  parseOptions: ParseJsonDiagnosticOptions
): unknown {
  if (typeof value !== 'string') {
    return value
  }

  const trimmed = value.trim()
  if (!trimmed || !isJsonIntentString(trimmed)) {
    return value
  }

  try {
    return JSON.parse(trimmed)
  } catch (error) {
    addDiagnostic(parseOptions.diagnostics, {
      code: parseOptions.code,
      severity: isStrictWrite(parseOptions.options) ? 'error' : 'warn',
      message: parseOptions.message,
      path: parseOptions.path,
      context: {
        error: error instanceof Error ? error.message : String(error),
      },
    })
    return value
  }
}

function jsonParseFailureCodeForProp(key: string): string {
  if (key === 'text') {
    return 'PAGE_CONTENT_COMPONENT_PROPS_TEXT_JSON_PARSE_FAILED'
  }

  if (key === 'content') {
    return 'PAGE_CONTENT_COMPONENT_PROPS_CONTENT_JSON_PARSE_FAILED'
  }

  if (key === 'data') {
    return 'PAGE_CONTENT_COMPONENT_PROPS_DATA_JSON_PARSE_FAILED'
  }

  return 'PAGE_CONTENT_COMPONENT_PROPS_JSON_PARSE_FAILED'
}

export function normalizeProps(
  value: unknown,
  diagnostics: PageContentDiagnostic[] = [],
  path = 'props',
  optionsInput?: NormalizePageContentOptions
): Record<string, unknown> {
  const options = resolveOptions(optionsInput)
  if (!isRecord(value)) {
    return {}
  }

  const normalized: Record<string, unknown> = {}
  Object.entries(value).forEach(([key, entry]) => {
    if (shouldStripLegacyPropMirrors(options) && (key === 'content' || key === 'text')) {
      return
    }

    if (key === 'content' || key === 'data' || key.endsWith('Json')) {
      normalized[key] = parseJsonStringWithDiagnostics(entry, {
        diagnostics,
        options,
        path: `${path}.${key}`,
        code: jsonParseFailureCodeForProp(key),
        message: `Component props.${key} contains malformed JSON-like text and was left unchanged.`,
      })
      return
    }

    if (key === 'text' && typeof entry === 'string') {
      normalized[key] = entry
      parseJsonStringWithDiagnostics(entry, {
        diagnostics,
        options,
        path: `${path}.text`,
        code: jsonParseFailureCodeForProp(key),
        message: 'Component props.text contains malformed JSON-like text and was left unchanged.',
      })
      return
    }

    normalized[key] = entry
  })

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

  const propsRecord = isRecord(instance.props) ? instance.props : undefined
  const dataRecord = isRecord(instance.data) ? instance.data : undefined
  const propsSource = propsRecord ?? dataRecord
  if (propsSource) {
    if (propsRecord && hasOwn(propsRecord, 'content')) {
      const code = typeof propsRecord.content === 'string'
        ? 'PAGE_CONTENT_COMPONENT_PROPS_CONTENT_STRING'
        : 'PAGE_CONTENT_COMPONENT_PROPS_CONTENT_LEGACY'
      addStrictDiagnostic(diagnostics, {
        code,
        message: typeof propsRecord.content === 'string'
          ? 'Component props.content is a legacy content source and is not accepted for strict writes; use component.content.'
          : 'Component props.content is a legacy content mirror and is not accepted for strict writes; use component.content.',
        path: `${path}.props.content`,
      })
    }

    if (dataRecord && hasOwn(dataRecord, 'content')) {
      const code = typeof dataRecord.content === 'string'
        ? 'PAGE_CONTENT_COMPONENT_DATA_CONTENT_STRING'
        : 'PAGE_CONTENT_COMPONENT_DATA_CONTENT_LEGACY'
      addStrictDiagnostic(diagnostics, {
        code,
        message: 'Component data.content is a legacy content source and is not accepted for strict writes; use component.content.',
        path: `${path}.data.content`,
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

function validateStrictReadComponentIdentity(
  instance: AnyRecord,
  diagnostics: PageContentDiagnostic[],
  path: string
): boolean {
  let isValid = true

  if (typeof instance.id !== 'string' || instance.id.trim().length === 0) {
    addDiagnostic(diagnostics, {
      code: 'PAGE_CONTENT_COMPONENT_ID_MISSING',
      severity: 'warn',
      message: 'Component id is missing; strict reads omit components that would require generated ids.',
      path,
    })
    isValid = false
  }

  if (
    !(typeof instance.type === 'string' && instance.type.trim().length > 0)
    && !(typeof instance.componentType === 'string' && instance.componentType.trim().length > 0)
  ) {
    addDiagnostic(diagnostics, {
      code: 'PAGE_CONTENT_COMPONENT_TYPE_MISSING',
      severity: 'warn',
      message: 'Component type is missing; strict reads omit components that would require an unknown type.',
      componentId: typeof instance.id === 'string' && instance.id.trim().length > 0 ? instance.id : undefined,
      path,
    })
    isValid = false
  }

  if (typeof instance.position !== 'number' || !Number.isFinite(instance.position)) {
    addDiagnostic(diagnostics, {
      code: 'PAGE_CONTENT_COMPONENT_POSITION_MISSING',
      severity: 'warn',
      message: 'Component position is missing; strict reads omit components that would require generated positions.',
      componentId: typeof instance.id === 'string' && instance.id.trim().length > 0 ? instance.id : undefined,
      path: `${path}.position`,
    })
    isValid = false
  }

  if (typeof instance.content === 'string') {
    addDiagnostic(diagnostics, {
      code: 'PAGE_CONTENT_COMPONENT_CONTENT_STRING',
      severity: 'warn',
      message: 'Component content must be an object; strict reads omit components with string content.',
      componentId: typeof instance.id === 'string' && instance.id.trim().length > 0 ? instance.id : undefined,
      path: `${path}.content`,
    })
    isValid = false
  }

  return isValid
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

  if (isStrictRead(options) && !validateStrictReadComponentIdentity(instance, diagnostics, path)) {
    return null
  }

  strictPayloadDiagnostics(instance, diagnostics, path, options)

  const rawTypeId = typeof instance.typeId === 'string' ? instance.typeId : undefined
  const rawComponentTypeId =
    typeof instance.componentTypeId === 'string' ? instance.componentTypeId : rawTypeId
  const id = typeof instance.id === 'string' && instance.id.trim().length > 0
    ? instance.id
    : `component-${fallbackPosition}`
  const type = readComponentType(instance)
  const parentId = instance.parentId === null || typeof instance.parentId === 'string'
    ? instance.parentId
    : null
  const position = typeof instance.position === 'number' ? instance.position : fallbackPosition
  const propsSourcePath = isRecord(instance.props) || hasOwn(instance, 'props') ? `${path}.props` : `${path}.data`
  const props = normalizeProps(instance.props ?? instance.data, diagnostics, propsSourcePath, options)
  let rawContent = instance.content
  if (typeof rawContent === 'string') {
    addDiagnostic(diagnostics, {
      code: 'PAGE_CONTENT_COMPONENT_CONTENT_STRING',
      severity: isStrictWrite(options) ? 'error' : 'warn',
      message: isStrictWrite(options)
        ? 'Component content must be an object for strict writes; string content is not accepted.'
        : 'Component content must be an object; string content is not accepted.',
      path: `${path}.content`,
      componentId: id,
    })
    rawContent = {}
  }
  const content = normalizeContentForComponentType(
    type,
    rawContent,
    diagnostics,
    options,
    `${path}.content`
  )
  if (isStrictWrite(options)) {
    delete props.content
  }
  if (shouldStripLegacyPropMirrors(options)) {
    delete props.content
    delete props.text
  }
  const styles = isRecord(instance.styles) ? instance.styles : {}
  const rawMetadata = parseJsonStringWithDiagnostics(instance.metadata, {
    diagnostics,
    options,
    path: `${path}.metadata`,
    code: 'PAGE_CONTENT_COMPONENT_METADATA_JSON_PARSE_FAILED',
    message: 'Component metadata contains malformed JSON-like text and was left unchanged.',
  })
  const metadata = isRecord(rawMetadata) ? rawMetadata : {}
  const globalComponentId = typeof instance.globalComponentId === 'string' ? instance.globalComponentId : undefined
  const sharedComponentId = typeof instance.sharedComponentId === 'string' ? instance.sharedComponentId : undefined
  const passthrough = omitKeys(instance, STRICT_COMPONENT_SOURCE_KEYS)

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
        message: isStrictMode(options)
          ? 'Components value is not an array; strict modes require a components array.'
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
): unknown {
  if (Array.isArray(content)) {
    addDiagnostic(diagnostics, {
      code: 'PAGE_CONTENT_LEGACY_ARRAY',
      severity: isStrictWrite(options) ? 'error' : 'warn',
      message: isStrictMode(options)
        ? 'Legacy array page content is not valid for strict modes.'
        : 'Legacy array page content is not valid PageContentV1 content.',
      path: '$',
    })
    return []
  }

  if (!isRecord(content)) {
    if (content !== undefined && content !== null) {
      addDiagnostic(diagnostics, {
        code: 'PAGE_CONTENT_INVALID',
        severity: isStrictWrite(options) ? 'error' : 'warn',
        message: isStrictMode(options)
          ? 'Page content is not an object; strict modes require PageContentV1-compatible content.'
          : 'Page content is not an object or array; using empty PageContentV1.',
        path: '$',
      })
    }
    return []
  }

  if (hasOwn(content, 'components')) {
    if (content.components === undefined || content.components === null) {
      addDiagnostic(diagnostics, {
        code: 'PAGE_CONTENT_COMPONENTS_INVALID',
        severity: isStrictWrite(options) ? 'error' : 'warn',
        message: isStrictMode(options)
          ? 'Components value is not an array; strict modes require a components array.'
          : 'Components value is not an array; using an empty component list.',
        path: 'components',
      })
      return []
    }

    return content.components
  }

  if (Array.isArray(content.sections)) {
    addDiagnostic(diagnostics, {
      code: 'PAGE_CONTENT_LEGACY_SECTIONS',
      severity: isStrictWrite(options) ? 'error' : 'warn',
      message: isStrictMode(options)
        ? 'Legacy sections page content is not valid for strict modes.'
        : 'Legacy sections page content is not valid PageContentV1 content.',
      path: 'sections',
    })
    return []
  }

  if (typeof content.type === 'string' || typeof content.componentType === 'string') {
    addDiagnostic(diagnostics, {
      code: 'PAGE_CONTENT_LEGACY_SINGLE_COMPONENT',
      severity: isStrictWrite(options) ? 'error' : 'warn',
      message: isStrictMode(options)
        ? 'Single component page content is not valid for strict modes.'
        : 'Single component page content is not valid PageContentV1 content.',
      path: '$',
    })
    return []
  }

  return []
}

export function normalizePageContent(
  content: unknown,
  optionsInput?: NormalizePageContentOptions
): NormalizePageContentResult {
  const options = resolveOptions(optionsInput)
  const diagnostics: PageContentDiagnostic[] = []
  let parsedContent = content
  if (typeof content === 'string') {
    const trimmed = content.trim()
    if (isJsonIntentString(trimmed)) {
      try {
        JSON.parse(trimmed)
        addDiagnostic(diagnostics, {
          code: 'PAGE_CONTENT_JSON_STRING',
          severity: isStrictWrite(options) ? 'error' : 'warn',
          message: isStrictMode(options)
            ? 'JSON string page content is not valid for strict modes; use PageContentV1 object content.'
            : 'JSON string page content is not valid; use PageContentV1 object content.',
          path: '$',
        })
      } catch (error) {
        addDiagnostic(diagnostics, {
          code: 'PAGE_CONTENT_JSON_PARSE_FAILED',
          severity: isStrictWrite(options) ? 'error' : 'warn',
          message: 'Page content contains malformed JSON-like text and was left unchanged.',
          path: '$',
          context: {
            error: error instanceof Error ? error.message : String(error),
          },
        })
      }
    }
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

  if (isStrictWrite(options) && isRecord(content) && Array.isArray(content.sections)) {
    addStrictDiagnostic(diagnostics, {
      code: 'PAGE_CONTENT_LEGACY_SECTIONS',
      message: 'Legacy sections page content is not valid for strict writes.',
      path: 'sections',
    })
    throwOnStrictErrors(options, diagnostics)
  }

  if (
    isStrictWrite(options)
    && isRecord(content)
    && !hasOwn(content, 'components')
    && (typeof content.type === 'string' || typeof content.componentType === 'string')
  ) {
    addStrictDiagnostic(diagnostics, {
      code: 'PAGE_CONTENT_LEGACY_SINGLE_COMPONENT',
      message: 'Single component page content is not valid for strict writes.',
      path: '$',
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
