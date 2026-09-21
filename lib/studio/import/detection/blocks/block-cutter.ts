import { createHash } from 'node:crypto'
import * as parse5 from 'parse5'
import type { Browser, Page, Request } from 'playwright-core'
import { isPrintOnlyStylesheetMedia, type Stylesheet } from '@/lib/studio/import/services/web-tools'
import { launchHeadlessChromium } from '@/lib/studio/design-system/dom-probe/launch-headless-chromium'

export type Region = 'header' | 'main' | 'footer'

export interface Anchor {
  path: number[]
  tag: string
  id: string
  classes: string[]
}

export interface Box {
  x: number
  y: number
  width: number
  height: number
}

export interface Block {
  id: string
  order: number
  region: Region
  anchor: Anchor | null
  anchorResolved: boolean
  sourceAnchors?: Anchor[]
  box: Box
  children: Block[]
  repeatedChildren?: Array<{ signature: string; count: number }>
  oversized: boolean
}

export interface CutResult {
  blocks: Block[]
  anchorResolutionShare: number
  javascriptEnabled: boolean
  issues: string[]
}

const digest = (value: string) => createHash('sha256').update(value).digest('hex')

const { parse, serialize } = parse5

type Node = {
  tagName?: string
  attrs?: Array<{
    name: string
    value: string
  }>
  childNodes?: Node[]
}

const elements = (node: Node) => (node.childNodes || []).filter(n => n.tagName)

const attribute = (node: Node, name: string) => node.attrs?.find(a => a.name === name)?.value || ''

export function instrumentHtml(html: string) {
  const doc = parse(html) as Node
  const top = elements(doc).find(n => n.tagName === 'html')!
  const body = elements(top).find(n => n.tagName === 'body')!
  const marker = 'data-import-block-' + digest(html).slice(0, 12)
  const anchors: Record<string, Anchor> = {}
  const visit = (node: Node, indices: number[]) => {
    const key = indices.join('.') || 'body'
    anchors[key] = { path: indices, tag: node.tagName!, id: attribute(node, 'id'), classes: attribute(node, 'class').split(/\s+/).filter(Boolean) }
    node.attrs!.push({ name: marker, value: key })
    elements(node).forEach((child, index) => visit(child, [...indices, index]))
  }
  visit(body, [])
  const serialized = serialize(doc as any)
  const stylesheetCount = (node: Node, externalOnly = false): number => Number((!externalOnly && node.tagName === 'style') || (node.tagName === 'link' && !isPrintOnlyStylesheetMedia(attribute(node, 'media')) && attribute(node, 'rel').toLowerCase().split(/\s+/).includes('stylesheet'))) + (node.childNodes || []).reduce((sum, child) => sum + stylesheetCount(child, externalOnly), 0)
  return { html: serialized, marker, anchors, declaredStylesheets: stylesheetCount(doc), declaredExternalStylesheets: stylesheetCount(doc, true) }
}

export interface Geometry {
  key: string
  tag: string
  region: Region
  box: Box
  visible: boolean
  meaningful: boolean
  id?: string
  classes?: string[]
  role?: string
  anchorKey?: string | null
  ownTextLength?: number
  children: Geometry[]
  repeatedChildren?: Array<{ signature: string; count: number }>
  anchor?: Anchor | null
  // Synthetic rows retain disjoint source nodes, so merged blocks keep all anchors and evidence.
  members?: Geometry[]
  grouping?: 'columns' | 'attached' | 'grid'
  headerRequiresNavigation?: boolean
}

const COLUMN_LAYOUT_TOLERANCE = 0.05
// Pixel thresholds refer to rendered CSS geometry, independent of viewport or container width.

const MIN_BAND_HEIGHT = 48 // Short content joins its neighbouring band; empty spacers never veto a cut.

export const TALL_BLOCK = 700 // Only larger containers are automatically divided into rows.

const ROW_OVERLAP = 0.5 // Strictly more than half of the shorter vertical range defines one row.

const WIDE_COLUMN_RATIO = 2 // A dominant main column may be cut independently of its sidebar.

const HEADING_ROW_HEIGHT = 120 // Short headings belong with the content they introduce.

const HEADING_OTHER_TEXT = 40 // Allow a small label alongside a heading, but not a prose section.

const NAVIGATION_SHARE = 0.5 // Most visible text/media must be links or logo imagery for an unmarked header.

const MAX_HEADER_HEIGHT = 300 // Navigation rows may merge only up to this height.

const HEADER_ZONE = 300 // Unmarked link/logo navigation is inferred only at the top of the page.

const UNDER_CUT_HEIGHT = 1500 // Keep indivisible content, but make suspiciously tall blocks reviewable.

const atomicTags = new Set(['img', 'picture', 'svg', 'video', 'canvas', 'iframe', 'input', 'ul', 'ol', 'p', 'pre', 'table'])

const meaningfulChildren = (node: Geometry) => node.children.filter(eligible)

const hasOwnText = (node: Geometry) => Boolean(node.ownTextLength)

function eligible(node: Geometry): boolean {
  return node.visible && node.box.height > 0 && node.box.width > 0 &&
    (node.meaningful || hasOwnText(node) || node.children.some(eligible))
}

const byPosition = (a: Geometry, b: Geometry) => a.box.y - b.box.y || a.box.x - b.box.x

function combine(nodes: Geometry[], grouping: 'columns' | 'attached' | 'grid'): Geometry {
  if (nodes.length === 1) {
    return nodes[0]
  }
  const x = Math.min(...nodes.map(n => n.box.x))
  const y = Math.min(...nodes.map(n => n.box.y))
  return {
    key: 'row-' + digest(nodes.map(n => n.key).join('|')).slice(0, 16),
    tag: 'div',
    region: nodes.every(n => n.region === nodes[0].region) ? nodes[0].region : 'main',
    headerRequiresNavigation: nodes.some(n => n.headerRequiresNavigation),
    box: { x, y, width: Math.max(...nodes.map(n => n.box.x + n.box.width)) - x, height: Math.max(...nodes.map(n => n.box.y + n.box.height)) - y },
    visible: true,
    meaningful: true,
    children: nodes,
    members: nodes,
    grouping
  }
}

function overlaps(a: Geometry, b: Geometry): boolean {
  return Math.min(a.box.y + a.box.height, b.box.y + b.box.height) - Math.max(a.box.y, b.box.y) > Math.min(a.box.height, b.box.height) * ROW_OVERLAP
}

function headingOnly(node: Geometry): boolean {
  if (node.box.height >= HEADING_ROW_HEIGHT) {
    return false
  }
  let headings = 0, otherText = 0, otherContent = false
  const visit = (n: Geometry) => {
    if (!eligible(n)) {
      return
    }
    if (/^h[1-6]$/.test(n.tag)) {
      headings++
      return
    }
    otherText += n.ownTextLength ?? 0
    if (atomicTags.has(n.tag) && n.tag !== 'p') {
      otherContent = true
    }
    n.children.forEach(visit)
  }
  visit(node)
  return headings > 0 && otherText <= HEADING_OTHER_TEXT && !otherContent
}

const attaches = (node: Geometry) => node.box.height < MIN_BAND_HEIGHT || headingOnly(node)

export function groupRows(children: Geometry[], mergeGrid = false): Geometry[] {
  const groups: Geometry[][] = []
  for (const child of children.filter(eligible).sort(byPosition)) {
    const matching = groups.filter(group => group.some(n => n.region === child.region && overlaps(n, child)))
    const joined = [child, ...matching.flat()].sort(byPosition)
    for (const group of matching) {
      groups.splice(groups.indexOf(group), 1)
    }
    groups.push(joined)
  }
  const rows = groups.map(group => combine(group, 'columns')).sort(byPosition)
  const bands: Geometry[] = [], pending: Geometry[] = []
  for (const row of rows) {
    if (pending.length && pending[0].region !== row.region) {
      bands.push(combine(pending.splice(0), 'attached'))
    }
    if (attaches(row)) {
      pending.push(row)
      continue
    }
    bands.push(combine([...pending.splice(0), row], 'attached'))
  }
  if (pending.length) {
    const previous = bands[bands.length - 1]?.region === pending[0].region ? bands.pop() : undefined
    bands.push(combine([...(previous ? [previous] : []), ...pending], 'attached'))
  }
  return mergeGrid ? mergeGridRows(bands) : bands
}

function columnsOf(row: Geometry): Geometry[] {
  if (row.grouping === 'grid') {
    return columnsOf(row.members![0])
  }
  if (row.grouping === 'attached') {
    const content = row.members!.filter(n => !attaches(n))
    return content.length === 1 ? columnsOf(content[0]) : []
  }
  if (row.grouping === 'columns') {
    return [...row.members!].sort((a, b) => a.box.x - b.box.x)
  }
  // Only columns grouped from this parent's children share a grid; separate containers do not.
  return []
}

function mergeGridRows(rows: Geometry[]): Geometry[] {
  const merged: Geometry[] = []
  for (const row of rows) {
    const previous = merged[merged.length - 1], a = previous ? columnsOf(previous) : [], b = columnsOf(row)
    const sameColumns = a.length >= 2 && a.length === b.length && a.every((column, i) => Math.abs(column.box.x - b[i].box.x) <= column.box.width * COLUMN_LAYOUT_TOLERANCE && Math.abs(column.box.width - b[i].box.width) <= column.box.width * COLUMN_LAYOUT_TOLERANCE)
    if (previous && previous.region === row.region && row.grouping !== 'attached' && !headingOnly(row) && sameColumns &&
      row.box.y >= previous.box.y + previous.box.height && row.box.y + row.box.height - previous.box.y <= UNDER_CUT_HEIGHT) {
      merged[merged.length - 1] = combine([...(previous.grouping === 'grid' ? previous.members! : [previous]), row], 'grid')
    }
    else {
      merged.push(row)
    }
  }
  return merged
}

function articleSection(node: Geometry): boolean {
  let heading = false, article = false
  const visit = (n: Geometry) => {
    if (!eligible(n)) {
      return
    }
    if (/^h[1-6]$/.test(n.tag)) {
      heading = true
    }
    if (n.tag === 'article' || (['p', 'a'].includes(n.tag) && (n.ownTextLength || 0) > HEADING_OTHER_TEXT)) {
      article = true
    }
    n.children.forEach(visit)
  }
  visit(node)
  return heading && article
}

function mainRegion(node: Geometry): Geometry {
  return { ...node, region: 'main', children: node.children.map(mainRegion), ...(node.members ? { members: node.members.map(mainRegion) } : {}) }
}

function cutRow(row: Geometry): Geometry[] {
  if (row.grouping === 'grid') {
    return [row]
  }
  if (row.grouping === 'attached') {
    const members = row.members!, index = members.findIndex(n => !attaches(n))
    if (index < 0) {
      return [row]
    }
    const bands = cutRow(members[index])
    const first = bands[0]
    if (first.grouping === 'grid') {
      bands.splice(0, 1, ...mergeGridRows([combine([...members.slice(0, index), first.members![0]], 'attached'), ...first.members!.slice(1)]))
    }
    else {
      bands[0] = combine([...members.slice(0, index), first], 'attached')
    }
    bands[bands.length - 1] = combine([bands[bands.length - 1], ...members.slice(index + 1)], 'attached')
    return bands
  }
  if (row.grouping === 'columns') {
    if (row.box.height <= (row.region === 'header' ? MAX_HEADER_HEIGHT : TALL_BLOCK)) {
      return [row]
    }
    const columns = row.members!, widest = [...columns].sort((a, b) => b.box.width - a.box.width)[0]
    if (columns.every(n => n === widest || widest.box.width >= n.box.width * WIDE_COLUMN_RATIO)) {
      return columns.flatMap(n => n === widest ? proposeGeometry(n) : [n]).sort(byPosition)
    }
    return [row]
  }
  return proposeGeometry(row)
}

export function proposeGeometry(root: Geometry): Geometry[] {
  if (!eligible(root)) {
    return []
  }
  if (hasOwnText(root) || atomicTags.has(root.tag)) {
    return [root]
  }
  const children = meaningfulChildren(root)
  if (children.length === 1) {
    return proposeGeometry(children[0])
  }
  if (root.box.height <= (root.region === 'header' ? MAX_HEADER_HEIGHT : TALL_BLOCK) || children.length < 2) {
    return [root]
  }
  let rows = groupRows(children, true)
  if (root.region === 'footer') {
    let leading = true
    rows = rows.map(row => {
      if (leading && articleSection(row)) {
        return mainRegion(row)
      }
      leading = false
      return row
    })
  }
  if (rows.length === 1 && !rows[0].members) {
    return proposeGeometry(rows[0])
  }
  return rows.flatMap(cutRow)
}

export function childCandidates(node: Geometry): Geometry[] {
  if (node.grouping === 'grid') {
    return node.members!
  }
  if (hasOwnText(node) || atomicTags.has(node.tag)) {
    return []
  }
  let children = meaningfulChildren(node)
  while (children.length === 1 && !hasOwnText(children[0]) && !atomicTags.has(children[0].tag)) {
    children = meaningfulChildren(children[0])
  }
  const rows = groupRows(children)
  return rows.length >= 2 ? rows : []
}

function regionHints(root: Geometry, semantic: boolean): Geometry {
  const visit = (node: Geometry, region: Region, inMain: boolean, headerRequiresNavigation = false): Geometry => {
    const identity = [node.id, ...(node.classes || [])].join(' ')
    if (!inMain && (node.tag === 'header' || node.role === 'banner' || (!semantic && /header|nav|masthead/i.test(identity)))) {
      region = 'header'
      headerRequiresNavigation = headerRequiresNavigation || node.box.height > MAX_HEADER_HEIGHT
    }
    if (!inMain && (node.tag === 'footer' || node.role === 'contentinfo' || /footer/i.test(identity))) {
      region = 'footer'
    }
    if (node.tag === 'main' || node.role === 'main') {
      region = 'main'
      inMain = true
    }
    return { ...node, region, headerRequiresNavigation, children: node.children.map(n => visit(n, region, inMain, headerRequiresNavigation)) }
  }
  return visit(root, 'main', false)
}

function navigationLike(node: Geometry): boolean {
  let total = 0, navigation = 0
  const visit = (n: Geometry, inLink = false) => {
    if (!eligible(n)) {
      return
    }
    const linked = inLink || n.tag === 'a' || n.tag === 'nav'
    const text = n.ownTextLength ?? 0
    total += text
    if (linked) {
      navigation += text
    }
    if (n.tag === 'img' || n.tag === 'svg') {
      total++
      navigation++
    }
    n.children.forEach(c => visit(c, linked))
  }
  visit(node)
  return total > 0 && navigation / total > NAVIGATION_SHARE
}

export function cutRenderedPage(geometry: Geometry): Block[] {
  const hasSemantic = (n: Geometry): boolean => ['header', 'main', 'footer'].includes(n.tag) || n.children.some(hasSemantic)
  const semantic = hasSemantic(geometry), tree = regionHints(geometry, semantic)
  // Semantic roots are disjoint; section headers inside main remain part of main.
  const roots = (node: Geometry): Geometry[] => {
    if (['header', 'main', 'footer'].includes(node.tag) || hasOwnText(node)) {
      return [node]
    }
    return node.children.flatMap(child => hasSemantic(child) ? roots(child) : [child])
  }
  let selected = (semantic ? roots(tree).flatMap(proposeGeometry) : proposeGeometry(tree)).sort(byPosition)
  let leading = true
  selected = selected.map(node => {
    const header = leading && node.box.height <= MAX_HEADER_HEIGHT &&
      (node.region === 'header' ? !node.headerRequiresNavigation || navigationLike(node) : !semantic && node.box.y < HEADER_ZONE && navigationLike(node))
    if (!header) {
      leading = false
    }
    if (node.region === 'header' && !header) {
      return mainRegion(node)
    }
    return { ...node, region: header ? 'header' : node.region === 'footer' ? 'footer' : 'main' }
  })
  if (!semantic) {
    let trailing = true
    for (let i = selected.length - 1; i >= 0; i--) {
      if (selected[i].region !== 'footer') {
        trailing = false
      }
      if (!trailing && selected[i].region === 'footer') {
        selected[i] = { ...selected[i], region: 'main' }
      }
    }
  }
  const build = (node: Geometry, children = true): Block => {
    let block: Block
    if (node.members) {
      block = node.members.map(n => build(n, false)).reduce(mergeBlocks)
    }
    else {
      const anchor = node.anchor ?? null
      block = {
        anchor,
        anchorResolved: !!anchor,
        oversized: node.box.height > UNDER_CUT_HEIGHT,
        id: 'block-' + (anchor ? anchor.path.join('-') || 'body' : 'dynamic-' + node.key),
        order: 0,
        region: node.region,
        box: node.box,
        children: [],
        repeatedChildren: node.repeatedChildren || []
      }
    }
    return {
      ...block,
      region: node.region,
      box: node.box,
      oversized: node.box.height > UNDER_CUT_HEIGHT,
      children: children ? childCandidates(node).map((n, i) => ({ ...build(n, false), order: i + 1 })) : []
    }
  }
  const blocks: Block[] = []
  for (const node of selected) {
    const block = build(node)
    const last = blocks[blocks.length - 1]
    if (last && block.region !== 'main' && last.region === block.region &&
      (block.region !== 'header' || Math.max(last.box.y + last.box.height, block.box.y + block.box.height) - Math.min(last.box.y, block.box.y) <= MAX_HEADER_HEIGHT)) {
      const merged = mergeBlocks(last, block)
      // One candidate level only; the same row groups remain available to Split.
      merged.children = [...(last.children.length ? last.children : [last]), ...(block.children.length ? block.children : [block])].map(b => ({ ...b, children: [] }))
      blocks[blocks.length - 1] = merged
    }
    else {
      blocks.push(block)
    }
  }
  return blocks.map((block, index) => ({ ...block, order: index + 1 }))
}

function mergeBlocks(a: Block, b: Block): Block {
  const x = Math.min(a.box.x, b.box.x), y = Math.min(a.box.y, b.box.y)
  return {
    ...a, id: 'merge-' + digest(a.id + '|' + b.id).slice(0, 16), anchor: null, anchorResolved: a.anchorResolved && b.anchorResolved,
    repeatedChildren: [...(a.repeatedChildren || []), ...(b.repeatedChildren || [])],
    sourceAnchors: [...(a.sourceAnchors || (a.anchor ? [a.anchor] : [])), ...(b.sourceAnchors || (b.anchor ? [b.anchor] : []))],
    box: { x, y, width: Math.max(a.box.x + a.box.width, b.box.x + b.box.width) - x, height: Math.max(a.box.y + a.box.height, b.box.y + b.box.height) - y },
    oversized: Math.max(a.box.y + a.box.height, b.box.y + b.box.height) - y > UNDER_CUT_HEIGHT, children: [a, b]
  }
}

const VIEWPORT_WIDTH = 1440

const VIEWPORT_HEIGHT = 1000

const SCROLL_BUDGET_MS = 10000

const MIN_ANCHOR_RESOLUTION_SHARE = 0.8

export class BlockCutError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'BlockCutError'
  }
}

// tsx preserves inner function names with __name; define it inside the browser closure.
function evaluateLocal<Arg, Result>(page: Page, fn: (arg: Arg) => Result, arg: Arg): Promise<Awaited<Result>> {
  return page.evaluate<Awaited<Result>>('(()=>{const __name=(value)=>value;return (' + fn.toString() + ')(' + JSON.stringify(arg) + ');})()')
}

async function renderPage(html: string, finalUrl: string, javascriptEnabled: boolean, stylesheets: Stylesheet[]): Promise<CutResult> {
  const prepared = instrumentHtml(html)
  const issues: string[] = []
  let browser: Browser | undefined
  try {
    try {
      browser = await launchHeadlessChromium()
    }
    catch (error) {
      throw new BlockCutError('Cannot cut page into blocks: Chromium could not start. ' + (error instanceof Error ? error.message : String(error)))
    }
    const context = await browser.newContext({
      viewport: { width: VIEWPORT_WIDTH, height: VIEWPORT_HEIGHT },
      deviceScaleFactor: 1,
      javaScriptEnabled: javascriptEnabled,
      serviceWorkers: 'block',
      bypassCSP: true
    })
    const page = await context.newPage()
    const pending = new Set<Request>()
    const stylesheetResponses = new Set<Request>()
    let loadedExternal = 0
    let lastActivity = Date.now()
    page.on('pageerror', error => issues.push('Page script error: ' + error.message))
    page.on('request', request => { pending.add(request); lastActivity = Date.now() })
    page.on('requestfinished', request => {
      pending.delete(request)
      lastActivity = Date.now()
      if (stylesheetResponses.delete(request)) loadedExternal++
    })
    page.on('requestfailed', request => {
      pending.delete(request)
      stylesheetResponses.delete(request)
      lastActivity = Date.now()
      issues.push('Resource failed: ' + request.url() + ' ' + (request.failure()?.errorText || 'unknown request failure'))
    })
    page.on('response', response => {
      if (response.status() >= 200 && response.status() < 300 && response.request().resourceType() === 'stylesheet' && response.request().frame() === page.mainFrame()) {
        stylesheetResponses.add(response.request())
      }
      if (response.status() >= 400) {
        issues.push('Resource HTTP ' + response.status() + ': ' + response.url())
      }
    })
    const documentUrl = new URL(finalUrl)
    documentUrl.hash = ''
    let fulfilled = false
    await page.route(url => url.href === documentUrl.href, async (route) => {
      if (!fulfilled && route.request().isNavigationRequest() && route.request().frame() === page.mainFrame()) {
        fulfilled = true
        await route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: prepared.html })
      }
      else {
        await route.fallback()
      }
    })
    const savedStylesheets = new Map(stylesheets.map(sheet => [sheet.url, sheet.text]))
    await page.route(url => savedStylesheets.has(url.href), async route => {
      if (route.request().resourceType() === 'stylesheet') {
        await route.fulfill({ status: 200, contentType: 'text/css; charset=utf-8', body: savedStylesheets.get(route.request().url())! })
      }
      else {
        await route.fallback()
      }
    })
    await page.goto(finalUrl, { waitUntil: 'load', timeout: 30000 })
    await page.evaluate(async () => {
      await Promise.race([document.fonts.ready, new Promise(resolve => setTimeout(resolve, 1000))])
    })
    const deadline = Date.now() + SCROLL_BUDGET_MS
    let y = 0, settled = false
    while (Date.now() < deadline) {
      const height = await page.evaluate(() => document.documentElement.scrollHeight)
      y = Math.min(y, Math.max(0, height - VIEWPORT_HEIGHT))
      await page.evaluate(top => scrollTo({ top, behavior: 'instant' }), y)
      await page.waitForTimeout(Math.min(100, Math.max(1, deadline - Date.now())))
      if (y + VIEWPORT_HEIGHT >= height) {
        while (Date.now() < deadline && (pending.size > 0 || Date.now() - lastActivity < 500)) {
          await page.waitForTimeout(Math.min(100, Math.max(1, deadline - Date.now())))
        }
        const current = await page.evaluate(() => document.documentElement.scrollHeight)
        if (current <= y + VIEWPORT_HEIGHT) {
          settled = Date.now() < deadline
          break
        }
      }
      y += VIEWPORT_HEIGHT
    }
    await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }))
    await page.waitForTimeout(100)
    if (!settled) {
      issues.push('Lazy-content sweep reached its ' + SCROLL_BUDGET_MS + 'ms limit')
    }
    if (prepared.declaredExternalStylesheets > 0 && loadedExternal === 0) {
      throw new BlockCutError('Cannot cut page into blocks: ' + prepared.declaredExternalStylesheets + ' external stylesheets were declared but none loaded.')
    }
    const rendered = await evaluateLocal(page, ({ marker }) => {
      let applied = 0
      for (const sheet of Array.from(document.styleSheets)) {
        if (sheet.disabled || (sheet.media.mediaText && !matchMedia(sheet.media.mediaText).matches)) {
          continue
        }
        try {
          if (sheet.cssRules.length > 0) {
            applied++
          }
        }
        catch { /* Cross-origin rules are unavailable. */ }
      }
      const declared = Array.from(document.querySelectorAll('link[rel~="stylesheet"],style')).filter(el => !el.getAttribute('media') || matchMedia(el.getAttribute('media')!).matches).length
      const freeze = document.createElement('style')
      freeze.textContent = '*,*::before,*::after{animation-play-state:paused!important;transition:none!important;caret-color:transparent!important}'
      document.head.append(freeze)
      const seen: Record<string, number> = {}
      document.querySelectorAll('[' + marker + ']').forEach(el => {
        const key = el.getAttribute(marker)!
        seen[key] = (seen[key] || 0) + 1
      })
      const isVisible = (el: Element) => {
        const style = getComputedStyle(el)
        const rect = el.getBoundingClientRect()
        return style.display !== 'none' && style.visibility !== 'hidden' &&
          style.contentVisibility !== 'hidden' && Number(style.opacity) !== 0 && rect.width > 0 && rect.height > 0
      }
      let serial = 0
      const walk = (el: Element, parentVisible = true): Geometry => {
        const tag = el.tagName.toLowerCase(), style = getComputedStyle(el), rect = el.getBoundingClientRect()
        const visible = parentVisible && style.display !== 'none' && style.visibility !== 'hidden' &&
          style.contentVisibility !== 'hidden' && Number(style.opacity) !== 0 && rect.width > 0 && rect.height > 0 &&
          !['script', 'style', 'template', 'noscript'].includes(tag)
        const ownTextLength = Array.from(el.childNodes).filter(n => n.nodeType === 3)
          .map(n => n.textContent?.trim() || '').join('').length
        const key = String(++serial), anchorKey = el.getAttribute(marker)
        const children = Array.from(el.children).map(child => walk(child, visible))
        const counts = new Map<string, number>()
        for (const child of Array.from(el.children).filter(isVisible)) {
          const signature = child.tagName.toLowerCase() + '>' + Array.from(child.children)
            .map(grandchild => grandchild.tagName.toLowerCase()).join(',')
          counts.set(signature, (counts.get(signature) || 0) + 1)
        }
        const repeatedChildren = [...counts].filter(([, count]) => count > 1).map(([signature, count]) => ({
          signature: tag + (el.id ? '#' + el.id : '') + ' / ' + signature,
          count
        }))
        return {
          key, tag, id: el.id, classes: Array.from(el.classList), role: el.getAttribute('role') || '',
          anchorKey: anchorKey && seen[anchorKey] === 1 ? anchorKey : null,
          ownTextLength, region: 'main',
          box: { x: rect.x + scrollX, y: rect.y + scrollY, width: rect.width, height: rect.height },
          visible,
          meaningful: Boolean((el as HTMLElement).innerText?.trim() || el.querySelector('img,picture,video,svg,input') ||
            ['img', 'svg', 'video', 'input'].includes(tag) || style.backgroundImage !== 'none'),
          children,
          repeatedChildren: [...repeatedChildren, ...children.flatMap(child => child.repeatedChildren || [])]
        }
      }
      return { tree: walk(document.body), declared, applied }
    }, { marker: prepared.marker })
    if (Math.max(prepared.declaredStylesheets, rendered.declared) > 0 && rendered.applied === 0) {
      throw new BlockCutError('Cannot cut page into blocks: stylesheets were declared but no styling was applied.')
    }
    const attachAnchors = (node: Geometry): Geometry => {
      const anchor = node.anchorKey ? prepared.anchors[node.anchorKey] || null : null
      return { ...node, anchor, children: node.children.map(attachAnchors) }
    }
    const blocks = cutRenderedPage(attachAnchors(rendered.tree))
    for (const block of blocks) {
      if (block.oversized) {
        issues.push('probably under-cut: ' + block.id + ' is ' + block.box.height + 'px tall')
      }
    }
    const resolved = blocks.filter(block => block.anchorResolved).length
    if (!blocks.length) {
      issues.push('No meaningful blocks found')
    }
    if (resolved < blocks.length) {
      issues.push((blocks.length - resolved) + ' of ' + blocks.length + ' block anchors unresolved')
    }
    return { blocks, issues, javascriptEnabled, anchorResolutionShare: blocks.length ? resolved / blocks.length : 0 }
  }
  finally {
    await browser?.close()
  }
}

export async function renderAndCut({ html, finalUrl, javascript = true, stylesheets = [] }: {
  html: string
  finalUrl: string
  javascript?: boolean
  stylesheets?: Stylesheet[]
}): Promise<CutResult> {
  const result = await renderPage(html, finalUrl, javascript, stylesheets)
  if (!javascript || result.anchorResolutionShare >= MIN_ANCHOR_RESOLUTION_SHARE) {
    return result
  }
  const withoutJavaScript = await renderPage(html, finalUrl, false, stylesheets)
  return {
    ...withoutJavaScript,
    issues: [...result.issues, 'Fewer than 80% of block anchors resolved with JavaScript on; used JavaScript-off render.', ...withoutJavaScript.issues]
  }
}
