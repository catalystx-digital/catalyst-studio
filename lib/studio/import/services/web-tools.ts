import crypto from 'crypto'
import { performanceMonitor } from '@/lib/studio/components/cms/_import/performance'
import { WebToolsConfig } from '../config'

type Dict<T = any> = Record<string, T>

export interface FetchOutlineArgs {
  url: string
  UserAgent?: string
  timeoutMs?: number
  maxSizeBytes?: number
  stripScriptsStyles?: boolean
  collapseWhitespace?: boolean
}

export interface SectionInfo {
  key: string
  approxBytes: number
  hash: string
  nodeCount: number
}

export interface HeadMeta {
  title?: string
  canonical?: string
  language?: string
  robots?: string
  viewport?: string
  meta?: Array<Dict<string>>
  links?: Array<Dict<string>>
  openGraph?: Dict<string>
  twitter?: Dict<string>
}

export interface ResourcesSummary {
  anchors: Array<{ href?: string; textPreview?: string; pathId: string }>
  images: Array<{ src?: string; srcset?: string; alt?: string; pathId: string }>
  videos: Array<{ poster?: string; sources: Array<{ src?: string; type?: string }>; pathId: string }>
  forms: Array<{
    pathId: string
    method?: string
    action?: string
    inputs: Array<{ name?: string; type?: string; placeholder?: string; required?: boolean; pattern?: string }>
    textareas: Array<{ name?: string; placeholder?: string; required?: boolean }>
    selects: Array<{ name?: string; multiple?: boolean }>
  }>
  links: Array<{ rel?: string; href?: string; as?: string; type?: string; sizes?: string; crossorigin?: string }>
}

/**
 * Detected redirect information from page fetching.
 * Used to identify external redirect pages during import.
 */
export interface RedirectInfo {
  /** Type of redirect detected */
  type: 'http' | 'meta-refresh' | 'javascript' | 'canonical'
  /** Target URL of the redirect */
  targetUrl: string
  /** Whether the target URL is external to the source website */
  isExternal: boolean
  /** HTTP status code (for HTTP redirects) */
  statusCode?: number
  /** Delay in seconds (for meta refresh) */
  delay?: number
  /** Description of how the redirect was detected */
  description?: string
}

export interface FetchOutlineResult {
  handle: string
  finalUrl?: string
  status?: number
  contentLength?: number
  hash?: string
  headMeta?: HeadMeta
  sections?: SectionInfo[]
  resourcesSummary?: ResourcesSummary
  limits?: { maxSectionBytes: number }
  nonHtml?: boolean
  notes?: string[]
  error?: boolean
  code?: number
  message?: string
  retriable?: boolean
  timeout?: boolean
  fromCache?: boolean
  contentType?: string
  /** Redirect information if this page redirects to another URL */
  redirectInfo?: RedirectInfo
}

export interface GetSectionArgs {
  handle: string
  key: string
}

export interface GetSectionResult {
  handle: string
  key: string
  slice: Array<DomNode>
  stats: { nodeCount: number; approxBytes: number; truncated?: boolean }
}

export interface DomNode {
  tag: string
  pathId: string
  id?: string
  class?: string
  role?: string
  aria?: Dict<string>
  attrs?: Dict<string>
  text?: string
  /** CSS background-image URL extracted from stylesheets */
  bgImage?: string
  /** CSS background-color extracted from stylesheets (hex format) */
  bgColor?: string
}

// Internal representation
const MIN_SECTION_MAX_BYTES = 1024

function resolveSectionMaxBytes(): number {
  const configured = WebToolsConfig.sectionMaxBytes
  return configured >= MIN_SECTION_MAX_BYTES ? configured : MIN_SECTION_MAX_BYTES
}

interface CachedPage {
  url: string
  finalUrl?: string
  status?: number
  rawHtml: string
  headMeta: HeadMeta
  sections: Map<string, DomNode[]>
  resources: ResourcesSummary
  limits: { maxSectionBytes: number }
}

export interface WebToolsCacheStats {
  entries: number
  totalRawBytes: number
  totalSectionCount: number
  totalSectionBytes: number
  totalApproxNodes: number
  resources: {
    anchors: number
    images: number
    videos: number
    forms: number
    links: number
  }
}

// Simple UUID
function uuid(): string {
  return ([1e7] as any+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g, (c: any) =>
    (c ^ (crypto.randomBytes(1)[0] & (15 >> (c / 4)))).toString(16)
  )
}

// Byte length helper
function byteLength(str: string): number {
  return Buffer.byteLength(str, 'utf8')
}

// Collapse whitespace in text
function normalizeText(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}

// Safely get attribute map
function attrsToMap(attrs?: Array<{ name: string; value: string }>): Dict<string> {
  const map: Dict<string> = {}
  if (!attrs) return map
  for (const a of attrs) {
    map[a.name] = a.value
  }
  return map
}

const responsiveVisibilityClasses = new Set([
  'hidden-xs',
  'hidden-sm',
  'hidden-md',
  'hidden-lg',
  'hidden-xl',
  'visible-xs',
  'visible-sm',
  'visible-md',
  'visible-lg',
  'visible-xl'
])

function inlineStyleHidesElement(style?: string): boolean {
  if (!style) return false
  return /(?:^|;)\s*display\s*:\s*none\s*(?:!important)?\s*(?:;|$)/i.test(style) ||
    /(?:^|;)\s*visibility\s*:\s*hidden\s*(?:!important)?\s*(?:;|$)/i.test(style) ||
    /(?:^|;)\s*content-visibility\s*:\s*hidden\s*(?:!important)?\s*(?:;|$)/i.test(style)
}

function classListContainsHiddenSelector(className: string | undefined, hiddenByClass?: Set<string>): boolean {
  if (!className || !hiddenByClass) return false

  for (const cls of className.split(/\s+/)) {
    if (!cls || responsiveVisibilityClasses.has(cls)) continue
    if (hiddenByClass.has(cls)) return true
  }

  return false
}

function isExplicitlyHiddenDomNode(params: {
  tag: string
  attrs: Dict<string>
  id?: string
  className?: string
  role?: string
  style?: string
  bgImageMap?: BackgroundImageMap
  preserveClassHiddenNavigationRoot?: boolean
}): boolean {
  const { tag, attrs, id, className, role, style, bgImageMap, preserveClassHiddenNavigationRoot } = params
  if (Object.prototype.hasOwnProperty.call(attrs, 'hidden')) {
    return true
  }
  if (inlineStyleHidesElement(style)) {
    return true
  }
  if (id && bgImageMap?.hiddenById.has(id)) {
    return true
  }
  if (preserveClassHiddenNavigationRoot && isNavigationEvidenceRoot({ tag, id, className, role })) {
    return false
  }
  return classListContainsHiddenSelector(className, bgImageMap?.hiddenByClass)
}

// HTML parsing via parse5 (already available via deps)
// We import lazily to avoid bundling if unused.
async function parseHtml(html: string): Promise<any> {
  const parse5 = await import('parse5')
  return parse5.parse(html, { sourceCodeLocationInfo: false })
}

// Traverse parse5 AST and build DomNode[] for a given root element
function traverseToNodes(
  root: any,
  opts: {
    maxTextPerNode: number
    bgImageMap?: BackgroundImageMap
    skipTags?: Set<string>
    skipNode?: (node: { tag: string; id?: string; className?: string; role?: string }) => boolean
    preserveClassHiddenRoot?: boolean
  }
): DomNode[] {
  const nodes: DomNode[] = []
  let counter = 0
  const bgImageMap = opts.bgImageMap
  const skipTags = opts.skipTags

  function walk(node: any, path: string) {
    // Remove comments and script/style handled at preprocess step
    if (!node) return
    if (node.nodeName === '#text') {
      return // text handled as part of parent text aggregation below
    }
    if (!node.tagName) {
      // likely document, documentFragment, etc.
      if (Array.isArray(node.childNodes)) {
        node.childNodes.forEach((c: any, idx: number) => walk(c, path + '/' + idx))
      }
      return
    }

    const tag = String(node.tagName).toLowerCase()
    const attrs = attrsToMap(node.attrs)
    const idRaw = attrs.id
    const clsRaw = attrs.class
    const styleRaw = attrs.style // Capture inline style for bgImage extraction
    const role = attrs.role
    const nodeId = typeof idRaw === 'string' ? idRaw : undefined
    const nodeClassName = typeof clsRaw === 'string' ? clsRaw : undefined
    const style = typeof styleRaw === 'string' ? styleRaw : undefined

    const nodeRole = typeof role === 'string' ? role : undefined

    if (isExplicitlyHiddenDomNode({
      tag,
      attrs,
      id: nodeId,
      className: nodeClassName,
      role: nodeRole,
      style,
      bgImageMap,
      preserveClassHiddenNavigationRoot: opts.preserveClassHiddenRoot === true && path === ''
    })) {
      return
    }

    // Skip specified tags/nodes (used to exclude navigation chrome when falling back to body for main content)
    if (skipTags && skipTags.has(tag)) {
      return
    }
    if (opts.skipNode && opts.skipNode({
      tag,
      id: nodeId,
      className: nodeClassName,
      role: nodeRole
    })) {
      return
    }

    delete attrs.id
    delete attrs.class
    delete attrs.style
    delete attrs.role

    const aria: Dict<string> = {}
    for (const [k, v] of Object.entries(attrs)) {
      if (k.startsWith('aria-')) {
        aria[k] = v as string
      }
    }

    const allowedAttrKeys = new Set<string>([
      'href',
      'src',
      'srcset',
      'alt',
      'action',
      'method',
      'type',
      'value',
      'name',
      'target',
      'rel',
      'title',
      'data-component',
      'data-section',
      'data-region',
      'data-element'
    ])
    const urlAttrKeys = new Set<string>([
      'href',
      'src',
      'srcset',
      'action'
    ])
    const filteredAttrs: Dict<string> = {}
    for (const [key, value] of Object.entries(attrs)) {
      const lower = key.toLowerCase()
      if (lower.startsWith('aria-')) {
        continue
      }
      if (!allowedAttrKeys.has(lower) && !lower.startsWith('data-cms') && !lower.startsWith('data-import')) {
        continue
      }
      if (typeof value === "string") {
        filteredAttrs[key] = serializeAttrValue(lower, value, urlAttrKeys)
      } else {
        filteredAttrs[key] = String(value)
      }
    }
    const attrsOut = Object.keys(filteredAttrs).length ? filteredAttrs : undefined

    let id = idRaw
    let cls = clsRaw
    if (typeof cls === "string") {
      const tokens = cls.split(/\s+/).slice(0, 12)
      cls = tokens.join(' ')
      if (cls.length > 160) {
        cls = cls.slice(0, 160)
      }
    }
    if (typeof id === "string" && id.length > 80) {
      id = id.slice(0, 80)
    }

    // Aggregate immediate text children only
    let text = ''
    if (Array.isArray(node.childNodes)) {
      for (const c of node.childNodes) {
        if (c.nodeName === '#text' && typeof c.value === 'string') {
          text += c.value
        }
      }
    }
    text = normalizeText(text)
    if (text.length > opts.maxTextPerNode) {
      text = text.slice(0, opts.maxTextPerNode)
    }

    // Look up background-image from CSS or inline style
    let bgImage: string | undefined
    let bgColor: string | undefined
    if (bgImageMap) {
      // Check by ID first (more specific)
      if (typeof idRaw === 'string' && bgImageMap.byId.has(idRaw)) {
        bgImage = bgImageMap.byId.get(idRaw)
      }
      // Then check by class names
      if (!bgImage && typeof clsRaw === 'string') {
        const classNames = clsRaw.split(/\s+/)
        for (const className of classNames) {
          if (bgImageMap.byClass.has(className)) {
            bgImage = bgImageMap.byClass.get(className)
            break
          }
        }
      }

      // Look up background-color from CSS
      if (typeof idRaw === 'string' && bgImageMap.bgColorById.has(idRaw)) {
        bgColor = bgImageMap.bgColorById.get(idRaw)
      }
      if (!bgColor && typeof clsRaw === 'string') {
        const classNames = clsRaw.split(/\s+/)
        for (const className of classNames) {
          if (bgImageMap.bgColorByClass.has(className)) {
            bgColor = bgImageMap.bgColorByClass.get(className)
            break
          }
        }
      }
    }
    // Also check inline style attribute for background-image
    if (!bgImage && typeof styleRaw === 'string') {
      const inlineMatch = styleRaw.match(/background(?:-image)?\s*:\s*[^;]*url\s*\(\s*["']?([^"')]+)["']?\s*\)/i)
      if (inlineMatch && inlineMatch[1] && !inlineMatch[1].startsWith('data:')) {
        bgImage = inlineMatch[1].trim()
      }
    }
    // Also check inline style for background-color
    if (!bgColor && typeof styleRaw === 'string') {
      const colorMatch = styleRaw.match(/background-color\s*:\s*(#[0-9a-fA-F]{3,8}|rgb[a]?\([^)]+\))/i)
      if (colorMatch && colorMatch[1]) {
        bgColor = colorMatch[1].trim()
        // Normalize to hex if needed
        if (bgColor.startsWith('rgb')) {
          const rgbMatch = bgColor.match(/rgba?\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i)
          if (rgbMatch) {
            const r = parseInt(rgbMatch[1], 10)
            const g = parseInt(rgbMatch[2], 10)
            const b = parseInt(rgbMatch[3], 10)
            bgColor = '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('')
          }
        }
      }
    }

    counter += 1
    const pathId = 'n' + String(counter).padStart(6, '0')

    const nodeOut: DomNode = {
      tag,
      pathId,
      id: (typeof id === "string" ? id : undefined),
      class: (typeof cls === "string" ? cls : undefined),
      role,
      aria: Object.keys(aria).length ? aria : undefined,
      attrs: attrsOut,
      text: text || undefined,
      bgImage,
      bgColor
    }
    nodes.push(nodeOut)

    if (Array.isArray(node.childNodes)) {
      node.childNodes.forEach((c: any, idx: number) => walk(c, path + '/' + idx))
    }
  }

  walk(root, '')
  return nodes
}

function serializeAttrValue(lowerKey: string, value: string, urlAttrKeys: Set<string>): string {
  if (!urlAttrKeys.has(lowerKey)) {
    return value.length > 160 ? value.slice(0, 160) : value
  }

  if (lowerKey === 'srcset') {
    return sanitizeResourceSrcset(value) ?? value.slice(0, 160)
  }

  if (value.trimStart().toLowerCase().startsWith('data:')) {
    return value.slice(0, 160)
  }

  const maxUrlAttrLength = lowerKey === 'srcset' ? 2048 : 1024
  return value.length > maxUrlAttrLength ? value.slice(0, maxUrlAttrLength) : value
}

function sanitizeResourceUrl(value: string | undefined): string | undefined {
  if (!value) return undefined
  if (value.trimStart().toLowerCase().startsWith('data:')) return undefined
  return value.length > 1024 ? value.slice(0, 1024) : value
}

function sanitizeResourceSrcset(value: string | undefined): string | undefined {
  if (!value) return undefined

  const withoutDataEntries = value.replace(/\bdata:[^\s,]+,[^\s]+(?:\s+\d+(?:w|x))?/gi, '')
  const entries = withoutDataEntries
    .split(',')
    .map(entry => entry.trim())
    .filter(entry => {
      if (!entry || entry.toLowerCase().startsWith('data:')) return false
      const candidateUrl = entry.split(/\s+/, 1)[0]
      return Boolean(candidateUrl) && !/^\d+(?:w|x)$/i.test(candidateUrl)
    })
  if (entries.length === 0) return undefined
  const srcset = entries.join(', ')
  return srcset.length > 2048 ? srcset.slice(0, 2048) : srcset
}

function shouldSkipBodyFallbackMainNode(node: { tag: string; id?: string; className?: string; role?: string }): boolean {
  if (node.role === 'navigation') {
    return true
  }

  const haystack = `${node.id ?? ''} ${node.className ?? ''}`.toLowerCase()
  if (!haystack.trim()) {
    return false
  }

  return [
    'desktop-header',
    'dropdown-navigation',
    'global-header',
    'main-header',
    'main-navigation',
    'main-nav',
    'mobile-header',
    'mobile-menu',
    'navigation-cta',
    'primary-navigation',
    'primary-nav',
    'site-header',
    'nav-menu'
  ].some(token => haystack.includes(token))
}

function isHeaderLikeNode(node: { tag: string; id?: string; className?: string; role?: string }): boolean {
  if (node.tag === 'header' || node.role === 'banner') {
    return true
  }

  const haystack = `${node.id ?? ''} ${node.className ?? ''}`.toLowerCase()
  if (!haystack.trim()) {
    return false
  }

  return [
    'desktop-header',
    'site-header',
    'global-header',
    'main-header',
    'mobile-header',
    'main-navigation',
    'primary-navigation',
    'primary-nav',
    'nav-menu'
  ].some(token => haystack.includes(token))
}

function isNavigationEvidenceRoot(node: { tag: string; id?: string; className?: string; role?: string }): boolean {
  return node.tag === 'nav' || node.role === 'navigation' || isHeaderLikeNode(node)
}

function findHeaderLikeDescendant(node: any): any | undefined {
  if (!node) return undefined
  if (node.tagName) {
    const tag = String(node.tagName).toLowerCase()
    if (tag === 'main' || tag === 'footer') {
      return undefined
    }
    const attrs = attrsToMap(node.attrs)
    if (isHeaderLikeNode({
      tag,
      id: typeof attrs.id === 'string' ? attrs.id : undefined,
      className: typeof attrs.class === 'string' ? attrs.class : undefined,
      role: typeof attrs.role === 'string' ? attrs.role : undefined
    })) {
      return node
    }
  }
  if (Array.isArray(node.childNodes)) {
    for (const c of node.childNodes) {
      const found = findHeaderLikeDescendant(c)
      if (found) return found
    }
  }
  return undefined
}

function findFirstHeaderLikeNode(bodyNode: any): any | undefined {
  if (!bodyNode || !Array.isArray(bodyNode.childNodes)) {
    return undefined
  }

  let inspectedElementCount = 0
  for (const child of bodyNode.childNodes) {
    if (!child?.tagName) {
      continue
    }

    const tag = String(child.tagName).toLowerCase()
    if (tag === 'main' || tag === 'footer') {
      return undefined
    }

    inspectedElementCount += 1
    if (inspectedElementCount > 6) {
      return undefined
    }

    const found = findHeaderLikeDescendant(child)
    if (found) {
      return found
    }
  }

  return undefined
}

function computeSha256(data: string): string {
  return crypto.createHash('sha256').update(data).digest('hex')
}

function sliceByApproxBytes(nodes: DomNode[], maxBytes: number): { slices: DomNode[][]; sections: SectionInfo[] } {
  const slices: DomNode[][] = []
  const sections: SectionInfo[] = []
  let start = 0
  let cursor = 0
  let accBytes = 0
  let byteOffset = 0

  const pushSlice = (part: DomNode[]): void => {
    if (!part.length) return
    const json = JSON.stringify(part)
    const approx = byteLength(json)
    if (approx > maxBytes && part.length > 1) {
      const mid = Math.ceil(part.length / 2)
      pushSlice(part.slice(0, mid))
      pushSlice(part.slice(mid))
      return
    }
    const hash = computeSha256(json)
    const startByte = byteOffset
    const endByte = startByte + Math.max(approx, 1) - 1
    slices.push(part)
    sections.push({ key: `main:${startByte}-${endByte}`, approxBytes: approx, hash, nodeCount: part.length })
    byteOffset = endByte + 1
  }

  while (cursor < nodes.length) {
    const n = nodes[cursor]
    const approx = byteLength(JSON.stringify(n))
    if (accBytes + approx > maxBytes && cursor > start) {
      const part = nodes.slice(start, cursor)
      pushSlice(part)
      start = cursor
      accBytes = 0
    } else {
      accBytes += approx
      cursor += 1
    }
  }

  if (start < nodes.length) {
    pushSlice(nodes.slice(start))
  }

  return { slices, sections }
}

function collectResources(allNodes: DomNode[], headNodes: DomNode[]): ResourcesSummary {
  const anchors: ResourcesSummary['anchors'] = []
  const images: ResourcesSummary['images'] = []
  const videos: ResourcesSummary['videos'] = []
  const forms: ResourcesSummary['forms'] = []
  const links: ResourcesSummary['links'] = []

  for (const n of allNodes) {
    const a = n.attrs || {}
    if (n.tag === 'a') {
      anchors.push({ href: a.href, textPreview: n.text, pathId: n.pathId })
    } else if (n.tag === 'img') {
      const src = sanitizeResourceUrl(a.src)
      const srcset = sanitizeResourceSrcset(a.srcset)
      if (src || srcset || a.alt) {
        images.push({ src, srcset, alt: a.alt, pathId: n.pathId })
      }
    } else if (n.tag === 'video') {
      // video sources are separate nodes; we collect minimal data
      const poster = a.poster
      videos.push({ poster, sources: [], pathId: n.pathId })
    } else if (n.tag === 'source') {
      // ignored at this level; handled during video grouping could be implemented later
    } else if (n.tag === 'form') {
      forms.push({
        pathId: n.pathId,
        method: a.method,
        action: a.action,
        inputs: [],
        textareas: [],
        selects: []
      })
    } else if (n.tag === 'input') {
      const parent = forms[forms.length - 1]
      if (parent) parent.inputs.push({ name: a.name, type: a.type, placeholder: a.placeholder, required: a.required !== undefined, pattern: a.pattern })
    } else if (n.tag === 'textarea') {
      const parent = forms[forms.length - 1]
      if (parent) parent.textareas.push({ name: a.name, placeholder: a.placeholder, required: a.required !== undefined })
    } else if (n.tag === 'select') {
      const parent = forms[forms.length - 1]
      if (parent) parent.selects.push({ name: a.name, multiple: a.multiple !== undefined })
    }
  }

  for (const n of headNodes) {
    const a = n.attrs || {}
    if (n.tag === 'link') {
      links.push({ rel: a.rel, href: a.href, as: a.as, type: a.type, sizes: a.sizes, crossorigin: a.crossorigin })
    }
  }

  return { anchors, images, videos, forms, links }
}

async function buildHeadMeta(document: any, htmlNode: any): Promise<HeadMeta> {
  // parse5 AST nodes: document.childNodes -> html -> head/body
  const headMeta: HeadMeta = { meta: [], links: [], openGraph: {}, twitter: {} }
  try {
    const html = (document.childNodes || []).find((n: any) => n.tagName === 'html')
    const head = html?.childNodes?.find((n: any) => n.tagName === 'head')
    const body = html?.childNodes?.find((n: any) => n.tagName === 'body')

    // Language from <html lang>
    const htmlAttrs = attrsToMap(html?.attrs)
    if (htmlAttrs.lang) headMeta.language = htmlAttrs.lang

    if (head) {
      const headNodes = traverseToNodes(head, { maxTextPerNode: 0 })
      for (const n of headNodes) {
        const a = n.attrs || {}
        if (n.tag === 'title' && n.text) headMeta.title = n.text
        if (n.tag === 'meta') {
          headMeta.meta!.push(a)
          const name = (a.name || a.property || '').toLowerCase()
          if (name === 'robots') headMeta.robots = a.content
          if (name === 'viewport') headMeta.viewport = a.content
          if (name.startsWith('og:')) (headMeta.openGraph as any)[name] = a.content
          if (name.startsWith('twitter:')) (headMeta.twitter as any)[name] = a.content
        }
        if (n.tag === 'link') {
          headMeta.links!.push(a)
          const rel = (a.rel || '').toLowerCase()
          if (rel === 'canonical' && a.href) headMeta.canonical = a.href
        }
      }
    }
  } catch {}
  return headMeta
}

function removeScriptsStylesAndComments(html: string): string {
  // Remove comments first
  let s = html.replace(/<!--([\s\S]*?)-->/g, '')
  // Remove <script>...</script> and <style>...</style>
  s = s.replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
  s = s.replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, '')
  return s
}

/**
 * CSS background-image selector map.
 * Maps CSS selectors (class names, IDs) to background-image URLs.
 */
export interface BackgroundImageMap {
  /** Map of class name (without dot) to image URL */
  byClass: Map<string, string>
  /** Map of ID (without hash) to image URL */
  byId: Map<string, string>
  /** Map of class name (without dot) to background-color (hex) */
  bgColorByClass: Map<string, string>
  /** Map of ID (without hash) to background-color (hex) */
  bgColorById: Map<string, string>
  /** Class names whose own selector is deterministically hidden */
  hiddenByClass: Set<string>
  /** IDs whose own selector is deterministically hidden */
  hiddenById: Set<string>
}

/**
 * Extracts background-image URLs and background-colors from CSS in HTML.
 * Parses <style> blocks and inline styles to find background declarations.
 * Returns a map for quick lookup during DOM traversal.
 *
 * @param html - Raw HTML string
 * @returns BackgroundImageMap for selector-based lookup
 */
function extractBackgroundImages(html: string): BackgroundImageMap {
  const byClass = new Map<string, string>()
  const byId = new Map<string, string>()
  const bgColorByClass = new Map<string, string>()
  const bgColorById = new Map<string, string>()
  const hiddenByClass = new Set<string>()
  const hiddenById = new Set<string>()

  // Extract all <style> block contents
  const styleBlockRegex = /<style[^>]*>([\s\S]*?)<\/style>/gi
  let styleMatch: RegExpExecArray | null

  while ((styleMatch = styleBlockRegex.exec(html)) !== null) {
    const cssContent = styleMatch[1]

    // Match CSS rules with background-image
    // Pattern: selector { ... background-image: url(...) ... }
    // Handles both background-image and background shorthand with url()
    const ruleRegex = /([^{}]+)\{[^}]*(?:background(?:-image)?)\s*:\s*[^;]*url\s*\(\s*["']?([^"')]+)["']?\s*\)[^}]*\}/gi
    let ruleMatch: RegExpExecArray | null

    while ((ruleMatch = ruleRegex.exec(cssContent)) !== null) {
      const selectorPart = ruleMatch[1].trim()
      const imageUrl = ruleMatch[2].trim()

      if (!imageUrl || imageUrl.startsWith('data:')) {
        continue // Skip data URIs
      }

      // Parse selectors (handle comma-separated)
      const selectors = selectorPart.split(',').map(s => s.trim())

      for (const selector of selectors) {
        // Extract class names (.classname)
        const classMatches = selector.match(/\.([a-zA-Z_-][a-zA-Z0-9_-]*)/g)
        if (classMatches) {
          for (const cls of classMatches) {
            const className = cls.slice(1) // Remove leading dot
            if (!byClass.has(className)) {
              byClass.set(className, imageUrl)
            }
          }
        }

        // Extract IDs (#idname)
        const idMatches = selector.match(/#([a-zA-Z_-][a-zA-Z0-9_-]*)/g)
        if (idMatches) {
          for (const id of idMatches) {
            const idName = id.slice(1) // Remove leading hash
            if (!byId.has(idName)) {
              byId.set(idName, imageUrl)
            }
          }
        }
      }
    }

    // Also extract background-color rules
    parseCssForBackgroundColors(cssContent, bgColorByClass, bgColorById)
    parseCssForHiddenSelectors(cssContent, hiddenByClass, hiddenById)
  }

  // Note: inline styles are handled per-element in traverseToNodes

  return { byClass, byId, bgColorByClass, bgColorById, hiddenByClass, hiddenById }
}

/**
 * Parses CSS content for background-color rules.
 */
function parseCssForBackgroundColors(
  cssContent: string,
  bgColorByClass: Map<string, string>,
  bgColorById: Map<string, string>
): void {
  // Match CSS rules with background-color
  // Pattern: selector { ... background-color: #hex or rgb(...) ... }
  const colorRegex = /([^{}]+)\{[^}]*background-color\s*:\s*(#[0-9a-fA-F]{3,8}|rgb[a]?\([^)]+\))[^}]*\}/gi
  let colorMatch: RegExpExecArray | null

  while ((colorMatch = colorRegex.exec(cssContent)) !== null) {
    const selectorPart = colorMatch[1].trim()
    let colorValue = colorMatch[2].trim()

    // Normalize to hex if possible
    if (colorValue.startsWith('rgb')) {
      // Convert rgba(r, g, b) or rgb(r, g, b) to hex
      const rgbMatch = colorValue.match(/rgba?\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i)
      if (rgbMatch) {
        const r = parseInt(rgbMatch[1], 10)
        const g = parseInt(rgbMatch[2], 10)
        const b = parseInt(rgbMatch[3], 10)
        colorValue = '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('')
      }
    }

    // Parse selectors (handle comma-separated)
    const selectors = selectorPart.split(',').map(s => s.trim())

    for (const selector of selectors) {
      // Extract class names (.classname)
      const classMatches = selector.match(/\.([a-zA-Z_-][a-zA-Z0-9_-]*)/g)
      if (classMatches) {
        for (const cls of classMatches) {
          const className = cls.slice(1)
          if (!bgColorByClass.has(className)) {
            bgColorByClass.set(className, colorValue)
          }
        }
      }

      // Extract IDs (#idname)
      const idMatches = selector.match(/#([a-zA-Z_-][a-zA-Z0-9_-]*)/g)
      if (idMatches) {
        for (const id of idMatches) {
          const idName = id.slice(1)
          if (!bgColorById.has(idName)) {
            bgColorById.set(idName, colorValue)
          }
        }
      }
    }
  }
}

function parseCssForHiddenSelectors(
  cssContent: string,
  hiddenByClass: Set<string>,
  hiddenById: Set<string>
): void {
  const hiddenRuleRegex = /([^{}]+)\{[^}]*(?:display\s*:\s*none|visibility\s*:\s*hidden|content-visibility\s*:\s*hidden)[^}]*\}/gi
  let hiddenMatch: RegExpExecArray | null

  while ((hiddenMatch = hiddenRuleRegex.exec(cssContent)) !== null) {
    const selectors = hiddenMatch[1].split(',').map(s => s.trim())

    for (const selector of selectors) {
      if (selector.includes('@media')) {
        continue
      }

      const classMatch = selector.match(/^\.([a-zA-Z_-][a-zA-Z0-9_-]*)$/)
      if (classMatch) {
        const className = classMatch[1]
        if (!responsiveVisibilityClasses.has(className)) {
          hiddenByClass.add(className)
        }
        continue
      }

      const idMatch = selector.match(/^#([a-zA-Z_-][a-zA-Z0-9_-]*)$/)
      if (idMatch) {
        hiddenById.add(idMatch[1])
      }
    }
  }
}

/**
 * Parses CSS content for background-image rules.
 * Helper function used by both inline styles and external CSS.
 */
function parseCssForBackgroundImages(
  cssContent: string,
  byClass: Map<string, string>,
  byId: Map<string, string>,
  baseUrl?: string
): void {
  const ruleRegex = /([^{}]+)\{[^}]*(?:background(?:-image)?)\s*:\s*[^;]*url\s*\(\s*["']?([^"')]+)["']?\s*\)[^}]*\}/gi
  let ruleMatch: RegExpExecArray | null

  while ((ruleMatch = ruleRegex.exec(cssContent)) !== null) {
    const selectorPart = ruleMatch[1].trim()
    let imageUrl = ruleMatch[2].trim()

    if (!imageUrl || imageUrl.startsWith('data:')) {
      continue
    }

    // Resolve relative URLs
    if (baseUrl && !imageUrl.startsWith('http') && !imageUrl.startsWith('//')) {
      try {
        imageUrl = new URL(imageUrl, baseUrl).href
      } catch {
        // Keep original URL if resolution fails
      }
    }

    const selectors = selectorPart.split(',').map(s => s.trim())

    // Generic CSS framework classes to skip - these are too common and would incorrectly match many elements
    const genericClassBlocklist = new Set([
      // Bootstrap grid
      'row', 'col', 'col-xs', 'col-sm', 'col-md', 'col-lg', 'col-xl', 'col-xxl',
      'col-1', 'col-2', 'col-3', 'col-4', 'col-5', 'col-6', 'col-7', 'col-8', 'col-9', 'col-10', 'col-11', 'col-12',
      'col-xs-1', 'col-xs-2', 'col-xs-3', 'col-xs-4', 'col-xs-5', 'col-xs-6', 'col-xs-7', 'col-xs-8', 'col-xs-9', 'col-xs-10', 'col-xs-11', 'col-xs-12',
      'col-sm-1', 'col-sm-2', 'col-sm-3', 'col-sm-4', 'col-sm-5', 'col-sm-6', 'col-sm-7', 'col-sm-8', 'col-sm-9', 'col-sm-10', 'col-sm-11', 'col-sm-12',
      'col-md-1', 'col-md-2', 'col-md-3', 'col-md-4', 'col-md-5', 'col-md-6', 'col-md-7', 'col-md-8', 'col-md-9', 'col-md-10', 'col-md-11', 'col-md-12',
      'col-lg-1', 'col-lg-2', 'col-lg-3', 'col-lg-4', 'col-lg-5', 'col-lg-6', 'col-lg-7', 'col-lg-8', 'col-lg-9', 'col-lg-10', 'col-lg-11', 'col-lg-12',
      'container', 'container-fluid', 'container-sm', 'container-md', 'container-lg', 'container-xl',
      // Bootstrap visibility
      'hidden', 'hidden-xs', 'hidden-sm', 'hidden-md', 'hidden-lg', 'hidden-xl',
      'visible', 'visible-xs', 'visible-sm', 'visible-md', 'visible-lg', 'visible-xl',
      'd-none', 'd-block', 'd-inline', 'd-inline-block', 'd-flex', 'd-grid',
      // Bootstrap utilities
      'btn', 'btn-primary', 'btn-secondary', 'btn-success', 'btn-danger', 'btn-warning', 'btn-info', 'btn-light', 'btn-dark',
      'text-center', 'text-left', 'text-right', 'text-start', 'text-end',
      'flex', 'flex-row', 'flex-column', 'justify-content-center', 'align-items-center',
      // jQuery UI
      'ui-widget', 'ui-widget-content', 'ui-widget-header', 'ui-state-default', 'ui-state-hover',
      'ui-state-focus', 'ui-state-active', 'ui-state-highlight', 'ui-state-error', 'ui-icon',
      'ui-progressbar', 'ui-progressbar-overlay', 'ui-state-error-text', 'ui-widget-overlay', 'ui-widget-shadow',
      // Ektron CMS
      'ektronModalStandard', 'ektronModalHeader', 'ektronModalClose',
      // Generic
      'button', 'input', 'less', 'more', 'active', 'disabled', 'show', 'hide'
    ])

    for (const selector of selectors) {
      const classMatches = selector.match(/\.([a-zA-Z_-][a-zA-Z0-9_-]*)/g)
      if (classMatches) {
        for (const cls of classMatches) {
          const className = cls.slice(1)
          // Skip generic CSS framework classes
          if (genericClassBlocklist.has(className)) {
            continue
          }
          if (!byClass.has(className)) {
            byClass.set(className, imageUrl)
          }
        }
      }

      const idMatches = selector.match(/#([a-zA-Z_-][a-zA-Z0-9_-]*)/g)
      if (idMatches) {
        for (const id of idMatches) {
          const idName = id.slice(1)
          if (!byId.has(idName)) {
            byId.set(idName, imageUrl)
          }
        }
      }
    }
  }
}

/**
 * Extracts external stylesheet URLs from HTML.
 */
function extractExternalStylesheetUrls(html: string, baseUrl: string): string[] {
  const urls: string[] = []
  const linkRegex = /<link[^>]+rel=["']stylesheet["'][^>]*>/gi
  let linkMatch: RegExpExecArray | null

  while ((linkMatch = linkRegex.exec(html)) !== null) {
    const mediaMatch = linkMatch[0].match(/\bmedia=["']([^"']+)["']/i)
    if (isPrintOnlyStylesheetMedia(mediaMatch?.[1])) {
      continue
    }

    const hrefMatch = linkMatch[0].match(/href=["']([^"']+)["']/i)
    if (hrefMatch && hrefMatch[1]) {
      let href = hrefMatch[1]
      // Resolve relative URLs
      if (!href.startsWith('http') && !href.startsWith('//')) {
        try {
          href = new URL(href, baseUrl).href
        } catch {
          continue // Skip invalid URLs
        }
      } else if (href.startsWith('//')) {
        href = 'https:' + href
      }
      urls.push(href)
    }
  }

  return urls
}

function isPrintOnlyStylesheetMedia(media: string | undefined): boolean {
  if (!media) return false
  const normalized = media.trim().toLowerCase()
  if (!normalized) return false
  return normalized
    .split(',')
    .map(part => part.trim())
    .filter(Boolean)
    .every(part => part === 'print' || /^\(?\s*print\s*\)?$/.test(part))
}

function normalizeImportHostname(hostname: string): string {
  return hostname.toLowerCase().replace(/^www\./, '')
}

/**
 * Checks if a URL is external to the source website.
 * Canonical redirects between apex and www hostnames are treated as same-site
 * so imports continue against the fetched final URL instead of becoming
 * redirect-only imports.
 */
export function isExternalUrl(targetUrl: string, sourceUrl: string): boolean {
  try {
    const target = new URL(targetUrl, sourceUrl)
    const source = new URL(sourceUrl)
    return normalizeImportHostname(target.hostname) !== normalizeImportHostname(source.hostname)
  } catch {
    // If we can't parse, assume it's not external (relative URL)
    return false
  }
}

/**
 * Detects meta refresh redirect from HTML content.
 * Looks for patterns like: <meta http-equiv="refresh" content="0;url=...">
 */
function detectMetaRefreshRedirect(html: string, sourceUrl: string): RedirectInfo | null {
  // Match meta refresh tag with various formats
  const metaRefreshPatterns = [
    // Standard format: <meta http-equiv="refresh" content="0;url=...">
    /<meta[^>]+http-equiv\s*=\s*["']refresh["'][^>]+content\s*=\s*["'](\d+)\s*;\s*url\s*=\s*["']?([^"'>\s]+)["']?["'][^>]*>/i,
    // Alternative format with content first
    /<meta[^>]+content\s*=\s*["'](\d+)\s*;\s*url\s*=\s*["']?([^"'>\s]+)["']?["'][^>]+http-equiv\s*=\s*["']refresh["'][^>]*>/i,
    // SharePoint format: <meta http-equiv="refresh" content="0; url=...">
    /<meta[^>]+http-equiv\s*=\s*["']refresh["'][^>]+content\s*=\s*["'](\d+)\s*;\s*url\s*=\s*([^"'>\s]+)["'][^>]*>/i,
  ]

  for (const pattern of metaRefreshPatterns) {
    const match = html.match(pattern)
    if (match) {
      const delay = parseInt(match[1], 10)
      let targetUrl = match[2].trim()

      // Fix malformed protocol URLs (e.g., "https:/" -> "https://")
      // This prevents treating them as relative URLs
      targetUrl = targetUrl.replace(/^(https?):\/([^/])/i, '$1://$2')

      // Handle relative URLs
      try {
        targetUrl = new URL(targetUrl, sourceUrl).href
      } catch {
        // Keep original if parsing fails
      }

      return {
        type: 'meta-refresh',
        targetUrl,
        isExternal: isExternalUrl(targetUrl, sourceUrl),
        delay,
        description: `Meta refresh redirect with ${delay}s delay`
      }
    }
  }

  return null
}

/**
 * Detects JavaScript-based redirects from HTML content.
 * Looks for common patterns like window.location, location.href, etc.
 */
function detectJavaScriptRedirect(html: string, sourceUrl: string): RedirectInfo | null {
  // Common JavaScript redirect patterns
  const jsRedirectPatterns = [
    // window.location = "url"
    /window\.location\s*=\s*["']([^"']+)["']/i,
    // window.location.href = "url"
    /window\.location\.href\s*=\s*["']([^"']+)["']/i,
    // location.href = "url"
    /location\.href\s*=\s*["']([^"']+)["']/i,
    // window.location.replace("url")
    /window\.location\.replace\s*\(\s*["']([^"']+)["']\s*\)/i,
    // location.replace("url")
    /location\.replace\s*\(\s*["']([^"']+)["']\s*\)/i,
    // document.location = "url"
    /document\.location\s*=\s*["']([^"']+)["']/i,
    // document.location.href = "url"
    /document\.location\.href\s*=\s*["']([^"']+)["']/i,
  ]

  // Only search within <script> tags to avoid false positives in text content
  const scriptBlocks = html.match(/<script[^>]*>[\s\S]*?<\/script>/gi) || []

  for (const script of scriptBlocks) {
    for (const pattern of jsRedirectPatterns) {
      const match = script.match(pattern)
      if (match) {
        let targetUrl = match[1].trim()

        // Fix malformed protocol URLs (e.g., "https:/" -> "https://")
        // This prevents treating them as relative URLs
        targetUrl = targetUrl.replace(/^(https?):\/([^/])/i, '$1://$2')

        // Handle relative URLs
        try {
          targetUrl = new URL(targetUrl, sourceUrl).href
        } catch {
          // Keep original if parsing fails
        }

        return {
          type: 'javascript',
          targetUrl,
          isExternal: isExternalUrl(targetUrl, sourceUrl),
          description: 'JavaScript redirect detected'
        }
      }
    }
  }

  return null
}

/**
 * Detects if page has minimal content suggesting it's just a redirect page.
 * Used to identify pages that only contain a redirect mechanism with no real content.
 */
function isMinimalRedirectPage(bodyNode: any): boolean {
  if (!bodyNode) return true

  // Count meaningful content nodes (excluding script, style, nav, header, footer)
  let contentNodeCount = 0
  let textLength = 0

  function walk(node: any): void {
    if (!node) return

    if (node.nodeName === '#text' && node.value) {
      const text = node.value.trim()
      if (text.length > 0) {
        textLength += text.length
      }
      return
    }

    const tag = String(node.tagName || '').toLowerCase()
    // Skip non-content elements
    if (['script', 'style', 'noscript', 'iframe', 'meta', 'link'].includes(tag)) {
      return
    }

    // Count content elements
    if (['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'article', 'section', 'main', 'div', 'span', 'li', 'td'].includes(tag)) {
      contentNodeCount++
    }

    if (Array.isArray(node.childNodes)) {
      for (const child of node.childNodes) {
        walk(child)
      }
    }
  }

  walk(bodyNode)

  // Consider it a minimal redirect page if:
  // - Very few content nodes (< 10) AND
  // - Very little text content (< 200 characters)
  return contentNodeCount < 10 && textLength < 200
}

/**
 * Detects all types of redirects from HTML content and HTTP response.
 * Returns redirect info if a redirect is detected, null otherwise.
 */
function detectRedirects(
  html: string,
  sourceUrl: string,
  finalUrl: string | undefined,
  httpStatus: number,
  bodyNode: any
): RedirectInfo | null {
  // 1. Check for HTTP redirect (3xx status or different final URL)
  if (finalUrl && finalUrl !== sourceUrl) {
    const isExternal = isExternalUrl(finalUrl, sourceUrl)
    // Only report as redirect if it's to a different path, not just protocol normalization
    try {
      const source = new URL(sourceUrl)
      const final = new URL(finalUrl)
      if (source.pathname !== final.pathname || isExternal) {
        return {
          type: 'http',
          targetUrl: finalUrl,
          isExternal,
          statusCode: httpStatus,
          description: `HTTP redirect (${httpStatus}) from ${sourceUrl} to ${finalUrl}`
        }
      }
    } catch {
      // Parsing failed, report as redirect if URLs differ
      return {
        type: 'http',
        targetUrl: finalUrl,
        isExternal,
        statusCode: httpStatus,
        description: `HTTP redirect from ${sourceUrl} to ${finalUrl}`
      }
    }
  }

  // 2. Check for meta refresh redirect
  const metaRedirect = detectMetaRefreshRedirect(html, sourceUrl)
  if (metaRedirect) {
    return metaRedirect
  }

  // 3. Check for JavaScript redirect (only if page has minimal content)
  if (isMinimalRedirectPage(bodyNode)) {
    const jsRedirect = detectJavaScriptRedirect(html, sourceUrl)
    if (jsRedirect) {
      return jsRedirect
    }
  }

  return null
}

/**
 * Fetches external CSS files and extracts background images.
 * Limited to same-origin CSS files to avoid CORS issues.
 */
async function fetchExternalCssBackgroundImages(
  html: string,
  baseUrl: string,
  bgImageMap: BackgroundImageMap
): Promise<{ cssFilesFetched: number; imagesFound: number }> {
  const cssUrls = extractExternalStylesheetUrls(html, baseUrl)
  const stats = { cssFilesFetched: 0, imagesFound: 0 }

  // Only fetch CSS from same origin to avoid CORS/cross-domain issues
  const baseOrigin = new URL(baseUrl).origin
  const sameOriginUrls = cssUrls.filter(url => {
    try {
      return new URL(url).origin === baseOrigin
    } catch {
      return false
    }
  })

  // Limit to first 5 CSS files to avoid excessive requests
  const urlsToFetch = sameOriginUrls.slice(0, 5)

  const fetchPromises = urlsToFetch.map(async (cssUrl) => {
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 5000)

      const res = await fetch(cssUrl, {
        headers: { 'User-Agent': 'CatalystStudioSemanticFetcher/1.0' },
        signal: controller.signal
      })

      clearTimeout(timeout)

      if (!res.ok) return

      const cssContent = await res.text()
      const beforeCount = bgImageMap.byClass.size + bgImageMap.byId.size
      parseCssForBackgroundImages(cssContent, bgImageMap.byClass, bgImageMap.byId, cssUrl)
      // Also extract background-colors from external CSS
      parseCssForBackgroundColors(cssContent, bgImageMap.bgColorByClass, bgImageMap.bgColorById)
      parseCssForHiddenSelectors(cssContent, bgImageMap.hiddenByClass, bgImageMap.hiddenById)
      const afterCount = bgImageMap.byClass.size + bgImageMap.byId.size

      stats.cssFilesFetched++
      stats.imagesFound += afterCount - beforeCount
    } catch {
      // Silently ignore CSS fetch failures
    }
  })

  await Promise.all(fetchPromises)
  return stats
}

export class WebFetchTools {
  private cache: Map<string, CachedPage> = new Map()
  private baseUrl?: string

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl
  }

  getBaseUrl(): string {
    return this.baseUrl || ''
  }

  setBaseUrl(url: string): void {
    this.baseUrl = url
  }

  getCacheStats(): WebToolsCacheStats {
    let totalRawBytes = 0
    let totalSectionBytes = 0
    let totalSectionCount = 0
    let totalApproxNodes = 0
    let anchors = 0
    let images = 0
    let videos = 0
    let forms = 0
    let links = 0

    for (const cached of this.cache.values()) {
      totalRawBytes += Buffer.byteLength(cached.rawHtml || '', 'utf8')
      totalSectionCount += cached.sections.size
      for (const slice of cached.sections.values()) {
        const serialized = JSON.stringify(slice)
        totalSectionBytes += Buffer.byteLength(serialized, 'utf8')
        totalApproxNodes += slice.length
      }

      anchors += cached.resources.anchors.length
      images += cached.resources.images.length
      videos += cached.resources.videos.length
      forms += cached.resources.forms.length
      links += cached.resources.links.length
    }

    return {
      entries: this.cache.size,
      totalRawBytes,
      totalSectionCount,
      totalSectionBytes,
      totalApproxNodes,
      resources: { anchors, images, videos, forms, links }
    }
  }

  clearCache(): void {
    this.cache.clear()
  }

  release(handle: string): void {
    this.cache.delete(handle)
  }

  async fetchOutline(args: FetchOutlineArgs): Promise<FetchOutlineResult> {
    return await performanceMonitor.measure('webtools.fetch_outline', async () => {
      const {
        url,
        UserAgent,
        timeoutMs = 20000,
        maxSizeBytes: rawMaxSizeBytes,
        stripScriptsStyles = true,
        collapseWhitespace = true
      } = args
      // LLM sometimes passes maxSizeBytes: 0 which would truncate after first chunk.
      // Treat 0 or undefined as "use default 5MB limit".
      const maxSizeBytes = rawMaxSizeBytes && rawMaxSizeBytes > 0 ? rawMaxSizeBytes : 5 * 1024 * 1024

      // Simple deterministic mode for debugging/tool-call isolation.
      // When enabled, we bypass network and return a tiny, static outline
      // with header/main/footer. This helps validate model finalization
      // without large HTML and repeated section fetching.
      if (WebToolsConfig.simpleMode) {
        // Build minimal DOM slices directly (no parse)
        let counter = 0
        const makeId = () => 'n' + String(++counter).padStart(6, '0')
        const headerSlice: DomNode[] = [
          { tag: 'header', pathId: makeId(), attrs: { role: 'banner' } },
          { tag: 'nav', pathId: makeId(), attrs: { class: 'site-nav' } },
          { tag: 'a', pathId: makeId(), attrs: { href: '/' }, text: 'Home' },
          { tag: 'a', pathId: makeId(), attrs: { href: '/about' }, text: 'About' }
        ]
        const mainSlice: DomNode[] = [
          { tag: 'main', pathId: makeId(), attrs: { id: 'content' } },
          { tag: 'section', pathId: makeId(), attrs: { class: 'hero' } },
          { tag: 'h1', pathId: makeId(), text: 'Welcome to Example' },
          { tag: 'p', pathId: makeId(), text: 'This is a simple mock page.' },
          { tag: 'a', pathId: makeId(), attrs: { href: '/contact' }, text: 'Contact us' }
        ]
        const footerSlice: DomNode[] = [
          { tag: 'footer', pathId: makeId(), attrs: { role: 'contentinfo' } },
          { tag: 'p', pathId: makeId(), text: '© 2025 Example Co.' }
        ]

        const sectionMap = new Map<string, DomNode[]>()
        sectionMap.set('header', headerSlice)
        // single main slice to minimize further tool calls
        const mainKey = 'main:0-1023'
        sectionMap.set(mainKey, mainSlice)
        sectionMap.set('footer', footerSlice)

        const sectionInfos: SectionInfo[] = [
          { key: 'header', approxBytes: byteLength(JSON.stringify(headerSlice)), hash: computeSha256(JSON.stringify(headerSlice)), nodeCount: headerSlice.length },
          { key: mainKey, approxBytes: byteLength(JSON.stringify(mainSlice)), hash: computeSha256(JSON.stringify(mainSlice)), nodeCount: mainSlice.length },
          { key: 'footer', approxBytes: byteLength(JSON.stringify(footerSlice)), hash: computeSha256(JSON.stringify(footerSlice)), nodeCount: footerSlice.length }
        ]

        const headMeta: HeadMeta = {
          title: 'Mock Page',
          canonical: url,
          language: 'en',
          robots: 'index,follow',
          viewport: 'width=device-width, initial-scale=1.0',
          meta: [],
          links: [],
          openGraph: { 'og:title': 'Mock Page' },
          twitter: { 'twitter:card': 'summary' }
        }

        const resources = collectResources([...headerSlice, ...mainSlice, ...footerSlice], [])
        const handle = uuid()

        this.cache.set(handle, {
          url,
          finalUrl: url,
          status: 200,
          rawHtml: '<!doctype html><html><head><title>Mock Page</title></head><body><header>…</header><main>…</main><footer>…</footer></body></html>',
          headMeta,
          sections: sectionMap,
          resources,
          limits: { maxSectionBytes: 32768 }
        })

        return {
          handle,
          finalUrl: url,
          status: 200,
          contentLength: 256,
          hash: computeSha256('mock'),
          headMeta,
          sections: sectionInfos,
          resourcesSummary: resources,
          limits: { maxSectionBytes: 32768 },
          notes: ['simple-mode']
        }
      }

      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), timeoutMs)
      let res: Response
      let finalUrl: string | undefined
      let status = 0
      try {
        res = await fetch(url, {
          method: 'GET',
          headers: { 'User-Agent': UserAgent || 'CatalystStudioSemanticFetcher/1.0' },
          redirect: 'follow',
          signal: controller.signal
        } as any)
        clearTimeout(timeout)
        status = res.status
        finalUrl = (res as any).url || url
      } catch (e: any) {
        clearTimeout(timeout)
        const err: FetchOutlineResult = { handle: '', error: true, code: 0, message: e?.message || 'fetch error', retriable: true }
        if (e?.name === 'AbortError') { err.timeout = true; err.message = 'timeout' }
        return err
      }

      const contentType = res.headers.get('content-type') || ''
      if (!contentType.includes('text/html')) {
        const data = await res.arrayBuffer().then(b => Buffer.from(b))
        const handle = uuid()
        this.cache.set(handle, {
          url,
          finalUrl,
          status,
          rawHtml: '',
          headMeta: {},
          sections: new Map(),
          resources: { anchors: [], images: [], videos: [], forms: [], links: [] },
          limits: { maxSectionBytes: 32768 }
        })
        return { handle, finalUrl, status, contentLength: data.length, contentType, nonHtml: true, notes: ['non-html content'] }
      }

      const reader = res.body?.getReader?.()
      let raw = ''
      if (reader) {
        // Stream and enforce max size
        let received = 0
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          const chunk = Buffer.from(value).toString('utf8')
          received += Buffer.byteLength(chunk, 'utf8')
          if (received > maxSizeBytes) {
            raw += chunk
            break
          }
          raw += chunk
        }
      } else {
        raw = await res.text()
      }

      const contentLength = Buffer.byteLength(raw, 'utf8')
      const hash = computeSha256(raw)
      let html = raw
      const notes: string[] = []

      // Extract CSS background-images BEFORE stripping styles
      const bgImageMap = extractBackgroundImages(raw)
      if (bgImageMap.byClass.size > 0 || bgImageMap.byId.size > 0) {
        const count = bgImageMap.byClass.size + bgImageMap.byId.size
        notes.push(`extracted ${count} background-images from inline CSS`)
        console.log(`[WebTools] Extracted ${count} background-images from inline CSS:`,
          [...bgImageMap.byClass.entries()].slice(0, 5).map(([k, v]) => `${k}: ${v}`))
      }

      // Also fetch external CSS files for background images
      const externalCssStats = await fetchExternalCssBackgroundImages(raw, finalUrl || url, bgImageMap)
      if (externalCssStats.imagesFound > 0) {
        notes.push(`extracted ${externalCssStats.imagesFound} background-images from ${externalCssStats.cssFilesFetched} external CSS files`)
        console.log(`[WebTools] Extracted ${externalCssStats.imagesFound} background-images from ${externalCssStats.cssFilesFetched} external CSS files`)
      }

      // Log total background images found (compact logging)
      const totalBgImages = bgImageMap.byClass.size + bgImageMap.byId.size
      if (totalBgImages > 0) {
        console.log(`[WebTools] bgImage map: ${totalBgImages} entries (${bgImageMap.byClass.size} classes, ${bgImageMap.byId.size} IDs)`)
      }

      // Log background colors found
      const totalBgColors = bgImageMap.bgColorByClass.size + bgImageMap.bgColorById.size
      if (totalBgColors > 0) {
        notes.push(`extracted ${totalBgColors} background-colors`)
        console.log(`[WebTools] bgColor map: ${totalBgColors} entries (${bgImageMap.bgColorByClass.size} classes, ${bgImageMap.bgColorById.size} IDs)`)
        console.log(`[WebTools] Sample bgColors:`, [...bgImageMap.bgColorByClass.entries()].slice(0, 8).map(([k, v]) => `${k}: ${v}`))
      }

      if (stripScriptsStyles) {
        html = removeScriptsStylesAndComments(html)
        notes.push('stripped scripts/styles/comments')
      }
      if (collapseWhitespace) {
        html = html.replace(/\s+/g, ' ')
        notes.push('collapsed whitespace')
      }

      // Build semantic outline
      const document = await parseHtml(html)
      const htmlNode = (document.childNodes || []).find((n: any) => n.tagName === 'html')
      const headNode = htmlNode?.childNodes?.find((n: any) => n.tagName === 'head')
      const bodyNode = htmlNode?.childNodes?.find((n: any) => n.tagName === 'body')

      const headMeta = await buildHeadMeta(document, htmlNode)

      const headerNode = findFirstByTag(bodyNode, 'header') || findFirstHeaderLikeNode(bodyNode)
      const actualMainNode = findFirstByTag(bodyNode, 'main')
      const mainNode = actualMainNode || bodyNode
      const footerNode = findFirstByTag(bodyNode, 'footer')

      // When falling back to body (no <main> element), skip header and footer tags
      // to avoid duplicating navigation and footer content in main slices
      const mainSkipTags = actualMainNode ? undefined : new Set(['header', 'footer', 'nav'])
      const mainSkipNode = actualMainNode ? undefined : shouldSkipBodyFallbackMainNode

      const maxSectionBytes = resolveSectionMaxBytes()
      const headerSlice = headerNode ? traverseToNodes(headerNode, { maxTextPerNode: 1500, bgImageMap, preserveClassHiddenRoot: true }) : []
      const mainNodes = mainNode ? traverseToNodes(mainNode, { maxTextPerNode: 1500, bgImageMap, skipTags: mainSkipTags, skipNode: mainSkipNode }) : []
      const footerSlice = footerNode ? traverseToNodes(footerNode, { maxTextPerNode: 1500, bgImageMap }) : []

      const { slices: mainSlices, sections } = sliceByApproxBytes(mainNodes, maxSectionBytes)

      // Build sections map
      const sectionMap = new Map<string, DomNode[]>()
      const sectionInfos: SectionInfo[] = []
      if (headerSlice.length) {
        const h = computeSha256(JSON.stringify(headerSlice))
        sectionMap.set('header', headerSlice)
        sectionInfos.push({ key: 'header', approxBytes: byteLength(JSON.stringify(headerSlice)), hash: h, nodeCount: headerSlice.length })
      }
      for (let i = 0; i < mainSlices.length; i++) {
        sectionMap.set(sections[i].key, mainSlices[i])
        sectionInfos.push(sections[i])
      }
      if (footerSlice.length) {
        const f = computeSha256(JSON.stringify(footerSlice))
        sectionMap.set('footer', footerSlice)
        sectionInfos.push({ key: 'footer', approxBytes: byteLength(JSON.stringify(footerSlice)), hash: f, nodeCount: footerSlice.length })
      }

      // Collect resources
      const headNodes = headNode ? traverseToNodes(headNode, { maxTextPerNode: 0 }) : []
      const resources = collectResources([...headerSlice, ...mainNodes, ...footerSlice], headNodes)

      // Detect redirects (use raw HTML before stripping for meta/JS detection)
      const redirectInfo = detectRedirects(raw, url, finalUrl, status, bodyNode)
      if (redirectInfo) {
        notes.push(`redirect detected: ${redirectInfo.type} → ${redirectInfo.targetUrl} (external: ${redirectInfo.isExternal})`)
        console.log(`[WebTools] Redirect detected:`, redirectInfo)
      }

      const handle = uuid()
      this.cache.set(handle, {
        url,
        finalUrl,
        status,
        rawHtml: raw,
        headMeta,
        sections: sectionMap,
        resources,
        limits: { maxSectionBytes }
      })

      return {
        handle,
        finalUrl,
        status,
        contentLength,
        hash,
        headMeta,
        sections: sectionInfos,
        resourcesSummary: resources,
        limits: { maxSectionBytes },
        notes,
        redirectInfo: redirectInfo || undefined
      }
    })
  }

  async getSection(args: GetSectionArgs): Promise<GetSectionResult> {
    return await performanceMonitor.measure('webtools.get_section', async () => {
      const { handle, key } = args
      const cached = this.cache.get(handle)
      if (!cached) throw new Error('Invalid handle')
      const slice = cached.sections.get(key) || []
      const approxBytes = byteLength(JSON.stringify(slice))
      const limit = cached.limits?.maxSectionBytes ?? resolveSectionMaxBytes()
      const truncated = approxBytes > limit
      if (truncated) {
        console.warn(`[WebTools] Section ${key} returned ${approxBytes} bytes (limit ${limit}); consider reducing section size.`)
      }
      return {
        handle,
        key,
        slice,
        stats: { nodeCount: slice.length, approxBytes, truncated }
      }
    })
  }

  /**
   * Get the last fetch outline result from cache
   * Used by design system extractor to get base URL for relative CSS URLs
   */
  getLastFetchOutline(): FetchOutlineResult | null {
    // Return the most recent cached result, if available
    const cacheEntries = Array.from(this.cache.entries())
    if (cacheEntries.length === 0) return null

    // Get the most recent entry (based on array order, could be improved with timestamps)
    const [handle, cachedPage] = cacheEntries[cacheEntries.length - 1]

    return {
      handle,
      finalUrl: cachedPage.finalUrl,
      status: cachedPage.status,
      contentLength: Buffer.byteLength(cachedPage.rawHtml || '', 'utf8'),
      hash: crypto.createHash('sha256').update(cachedPage.rawHtml || '').digest('hex'),
      headMeta: cachedPage.headMeta,
      sections: Array.from(cachedPage.sections.entries()).map(([key, nodes]) => ({
        key,
        approxBytes: Buffer.byteLength(JSON.stringify(nodes), 'utf8'),
        hash: crypto.createHash('sha256').update(JSON.stringify(nodes)).digest('hex'),
        nodeCount: nodes.length
      })),
      resourcesSummary: cachedPage.resources,
      limits: cachedPage.limits
    }
  }
}

function findFirstByTag(node: any, tag: string): any | undefined {
  if (!node) return undefined
  if (String(node.tagName).toLowerCase() === tag) return node
  if (Array.isArray(node.childNodes)) {
    for (const c of node.childNodes) {
      const found = findFirstByTag(c, tag)
      if (found) return found
    }
  }
  return undefined
}

// Singleton
let _webFetchTools: WebFetchTools | null = null
export function getWebFetchTools(baseUrl?: string): WebFetchTools {
  if (!_webFetchTools) _webFetchTools = new WebFetchTools(baseUrl)
  else if (baseUrl) _webFetchTools.setBaseUrl(baseUrl)
  return _webFetchTools
}
