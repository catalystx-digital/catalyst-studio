import { createRequire } from 'node:module'
// Node 24 can require parse5's ESM build; native loading also works in Jest's CJS runtime.
const { parse, parseFragment } = createRequire(__filename)('parse5') as typeof import('parse5')

export type Region = 'header' | 'main' | 'footer'
const regions = ['overall', 'header', 'main', 'footer'] as const
type Scope = typeof regions[number]
export interface Component { type: string; component?: string; content?: unknown; props?: unknown; location?: string; metadata?: { region?: string }; [key: string]: unknown }
interface Piece { text: string; region: Region }
interface Resource { url: string; region: Region }
interface Evidence { text: Piece[]; allText: string[]; visibleText: string[]; attributeText: string[]; images: Resource[]; links: Resource[]; baseUrl: string }
export interface Field { value: string; path: string; componentType: string; componentIndex: number; region: Region }
interface Share { numerator: number; denominator: number; share: number | null }
interface Coverage { kept: Share; invented: Share; missing: string[]; extra: string[] }
export const TEXT_COVERAGE_THRESHOLD = 0.9
interface PieceScore extends Piece { kept: boolean; shingles: string[]; missingShingles: string[] }
interface SectionEvidence { text: Piece[]; fields: Field[]; sectionKeys: string[] }
interface ScopeMetrics {
  textKept: Share; textCharactersKept: Share; textShinglesKept: Share
  shownTextKept: Share; shownTextCharactersKept: Share; shownTextShinglesKept: Share
  textNotFound: Share; missingText: Piece[]; missingShownText: Piece[]; notFoundText: Field[]
  textScores: PieceScore[]; shownTextScores: PieceScore[]; textFields: Field[]
  duplicatesRemoved: number; shownDuplicatesRemoved: number
  visibleTextNotShown: Share; visibleShinglesNotShown: Share; missingFromModel: Piece[]
  images: Coverage; links: Coverage; outputResources: {images: Resource[]; links: Resource[]}
  shape: ReturnType<typeof measureShape>
}
type Measurement = Record<Scope, ScopeMetrics>

type HtmlNode = { nodeName?: string; tagName?: string; value?: string; attrs?: Array<{name: string; value: string}>; childNodes?: HtmlNode[]; content?: HtmlNode }
const rawText = (node: HtmlNode): string => node.nodeName === '#text' ? node.value || '' : (node.childNodes || []).map(rawText).join('')
const attrsOf = (node: HtmlNode) => Object.fromEntries((node.attrs || []).map(a => [a.name, a.value]))
const blockTags = new Set(['p','div','section','article','header','footer','main','nav','li','ul','ol','h1','h2','h3','h4','h5','h6','blockquote','td','th','tr','figcaption','figure','address','form','br'])
const excludedTags = new Set(['script','style','template','noscript'])

const normalizePlainText = (value: string) => value.replace(/[‘’‚‛]/g, "'").replace(/[“”„‟]/g, '"').replace(/[–—]/g, '-').replace(/…/g, '...').replace(/[\u200B\u200C\u200D\u2060\uFEFF]/g, '').replace(/\s+/gu, ' ').trim().toLocaleLowerCase('en')
const joinChildren = (node: HtmlNode, flatten: (child: HtmlNode) => string) => (node.childNodes || []).map((child, index, children) => (index && child.tagName && children[index - 1].tagName ? ' ' : '') + flatten(child)).join('')
export function normalizeText(value: string): string {
  const tree = parseFragment(value) as HtmlNode
  const flatten = (node: HtmlNode): string => excludedTags.has(node.tagName || '') ? '' : node.nodeName === '#text' ? node.value || '' : (blockTags.has(node.tagName || '') ? ' ' : '') + joinChildren(node, flatten) + (blockTags.has(node.tagName || '') ? ' ' : '')
  return normalizePlainText(flatten(tree))
}
export function absoluteUrl(value: string, base: string, kind: 'image' | 'link'): string | null {
  const clean = value.trim()
  if (!clean || /^(data|javascript|blob):/i.test(clean)) return null
  try {
    const url = new URL(clean, base)
    if (!['http:', 'https:', ...(kind === 'link' ? ['mailto:', 'tel:'] : [])].includes(url.protocol)) return null
    if (kind === 'link') { url.hash = ''; if (url.pathname !== '/') url.pathname = url.pathname.replace(/\/+$/, '') }
    return url.href
  } catch { return null }
}
export function componentRegion(component: Component): Region {
  const region = component.location || component.metadata?.region
  if (region === 'header' || region === 'footer') return region
  if (component.type === 'navbar' || component.type === 'footer') return component.type === 'navbar' ? 'header' : 'footer'
  return 'main'
}
export function componentStrings(components: Component[]): Field[] {
  const result: Field[] = []
  components.forEach((component, componentIndex) => {
    const walk = (value: unknown, path: string) => {
      if (typeof value === 'string') result.push({ value, path, componentType: component.type, componentIndex, region: componentRegion(component) })
      else if (Array.isArray(value)) value.forEach((item, i) => walk(item, path + '[' + i + ']'))
      else if (value && typeof value === 'object') Object.entries(value).forEach(([key, item]) => {
        if (!['metadata','type','component','id','location','region','confidence'].includes(key)) walk(item, path ? path + '.' + key : key)
      })
    }
    for (const key of ['content','props'] as const) walk(component[key], key)
  })
  return result
}
export function isHumanText(field: Field, minimumLength = 12): boolean {
  const text = normalizeText(field.value), key = field.path.split('.').pop()!.replace(/\[\d+\]/g, '')
  if (text.length < minimumLength) return false
  if (/^(?:id|.*Id|slug|type|component|componentType|variant|layout|size|align|alignment|position|region|location|class|className|classes|color|.*Color|style|theme|icon|font|fontFamily|weight|target|rel|mediaType|url|href|src|srcset|path|originalUrl|canonicalUrl)$/i.test(key)) return false
  if (/^(?:https?:|mailto:|tel:|data:|\/|#|rgb\(|rgba\(|hsl\(|var\(|[a-z]+:\/\/)/i.test(text)) return false
  if (/^[a-f0-9-]{12,}$/i.test(text) || /^\S+@\S+\.\S+$/.test(text)) return false
  if (/^(?:title|heading|subheading|description|text|body|bodyHtml|html|content|label|alt|caption|quote|name|placeholder|value|summary|copyright)$/i.test(key)) return true
  // Unknown fields need prose evidence; token-like identifiers and class lists are excluded.
  return /\s/u.test(text) && !text.split(/\s+/).every(word => /[_:]/.test(word) || /^[a-z]+-/.test(word)) && /\p{L}/u.test(text)
}
export function extractPageEvidence(html: string, pageUrl: string, stylesheets: string[] = []): Evidence {
  const document = parse(html) as HtmlNode
  const css: string[] = [...stylesheets]
  let baseUrl = pageUrl
  const scan = (node: HtmlNode) => {
    const attrs = attrsOf(node)
    if (node.tagName === 'style') css.push(rawText(node))
    if (node.tagName === 'base' && attrs.href && baseUrl === pageUrl) baseUrl = new URL(attrs.href, pageUrl).href
    node.childNodes?.forEach(scan)
  }
  scan(document)
  const hiddenClass = new Set<string>(), hiddenId = new Set<string>()
  const responsive = /^(?:hidden|visible)-(?:xs|sm|md|lg|xl)$/
  for (const stylesheet of css) {
    const rules = /([^{}]+)\{[^}]*(?:display\s*:\s*none|visibility\s*:\s*hidden|content-visibility\s*:\s*hidden)[^}]*\}/gi
    for (const rule of stylesheet.matchAll(rules)) for (const selector of rule[1].split(',').map(s => s.trim())) {
      if (selector.includes('@media')) continue
      const name = selector.match(/^([.#])([a-zA-Z_-][a-zA-Z0-9_-]*)$/)
      if (name && !responsive.test(name[2])) (name[1] === '.' ? hiddenClass : hiddenId).add(name[2])
    }
  }
  const result: Evidence = { text: [], allText: [], visibleText: [], attributeText: [], images: [], links: [], baseUrl }
  const headerLike = (tag: string, attrs: Record<string,string>) => tag === 'header' || attrs.role === 'banner' || ['desktop-header','site-header','global-header','main-header','mobile-header','main-navigation','primary-navigation','primary-nav','nav-menu'].some(token => ((attrs.id || '') + ' ' + (attrs.class || '')).toLowerCase().includes(token))
  const firstTag = (node: HtmlNode, tag: string): HtmlNode | undefined => node.tagName === tag ? node : (node.childNodes || []).map(child => firstTag(child,tag)).find(Boolean)
  const body = firstTag(document,'body')
  let selectedHeader = body ? firstTag(body,'header') : undefined
  const headerDescendant = (node: HtmlNode): HtmlNode | undefined => {
    if (node.tagName === 'main' || node.tagName === 'footer') return undefined
    return headerLike(node.tagName || '',attrsOf(node)) ? node : (node.childNodes || []).map(headerDescendant).find(Boolean)
  }
  if (!selectedHeader && body) {
    let inspected = 0
    for (const child of body.childNodes || []) {
      if (!child.tagName) continue
      if (child.tagName === 'main' || child.tagName === 'footer' || ++inspected > 6) break
      selectedHeader = headerDescendant(child)
      if (selectedHeader) break
    }
  }
  const hidden = (node: HtmlNode, a: Record<string,string>) => Object.hasOwn(a, 'hidden') || /(?:^|;)\s*(?:display\s*:\s*none|(?:content-)?visibility\s*:\s*hidden)\s*(?:!important)?\s*(?:;|$)/i.test(a.style || '') || hiddenId.has(a.id) || (node !== selectedHeader && (a.class || '').split(/\s+/).some(name => hiddenClass.has(name)))
  const add = (kind: 'images' | 'links', value: string | undefined, region: Region) => {
    if (!value) return
    const url = absoluteUrl(value, baseUrl, kind === 'images' ? 'image' : 'link')
    if (url && !result[kind].some(item => item.url === url && item.region === region)) result[kind].push({url, region})
  }
  const textRun: Record<Region,string> = {header:'', main:'', footer:''}
  const flush = (region: Region) => { const text = normalizeText(textRun[region]); if (text) result.visibleText.push(text); if (text.length >= 12) result.text.push({text, region}); textRun[region] = '' }
  const walk = (node: HtmlNode, region: Region, parentTag = '', tinyPicture = false) => {
    const tag = node.tagName || '', a = attrsOf(node)
    if (excludedTags.has(tag)) return
    if (hidden(node,a)) return
    if (tag === 'head') { node.childNodes?.forEach(child => walk(child, region, tag)); return }
    if (tag === 'title' || tag === 'meta') return
    const nextRegion: Region = tag === 'footer' || a.role === 'contentinfo' ? 'footer' : node === selectedHeader ? 'header' : tag === 'main' || a.role === 'main' ? 'main' : region
    if (nextRegion !== region) flush(region)
    region = nextRegion
    if (blockTags.has(tag)) flush(region)
    if (node.nodeName === '#text') textRun[region] += node.value || ''
    if (tag === 'picture') tinyPicture = (node.childNodes || []).some(child => child.tagName === 'img' && Number(attrsOf(child).width) === 1 && Number(attrsOf(child).height) === 1)
    const tiny = tinyPicture || (Number(a.width) === 1 && Number(a.height) === 1) || (/width\s*:\s*1px\b/i.test(a.style || '') && /height\s*:\s*1px\b/i.test(a.style || ''))
    if (!tiny) {
      if (tag === 'img' || (tag === 'source' && parentTag === 'picture')) {
        add('images', a.src, region)
        // Data candidates are removed before splitting, including their embedded comma.
        for (const candidate of (a.srcset || '').replace(/data:[^\s]+(?:\s+\S+)?/gi, '').split(',')) add('images', candidate.trim().split(/\s+/)[0], region)
      }
      for (const declaration of (a.style || '').matchAll(/background(?:-image)?\s*:\s*([^;]+)/gi)) for (const bg of declaration[1].matchAll(/url\(\s*['"]?([^'"\s)]+)['"]?\s*\)/gi)) add('images', bg[1], region)
    }
    if (tag === 'a') add('links', a.href, region)
    node.childNodes?.forEach((child, index, children) => {
      if (index && child.tagName && children[index - 1].tagName) textRun[region] += ' '
      walk(child, region, tag, tinyPicture)
    })
    if (blockTags.has(tag)) flush(region)
  }
  // Support evidence deliberately ignores visibility, including inert and executable text.
  const allText = (node: HtmlNode): string => {
    const a = attrsOf(node), tag = node.tagName || ''
    for (const name of ['alt','title','aria-label','placeholder','value', ...(tag === 'meta' ? ['content'] : [])]) if (a[name]) result.attributeText.push(normalizeText(a[name]))
    if (node.nodeName === '#text') return node.value || ''
    const content = tag === 'noscript' ? parseFragment(rawText(node), {scriptingEnabled: false}) as HtmlNode : node
    const text = joinChildren(content, allText) + (node.content ? allText(node.content) : '')
    return blockTags.has(tag) || ['title','script','style'].includes(tag) ? ' ' + text + ' ' : text
  }
  result.allText.push(normalizePlainText(allText(document)))
  walk(document, 'main'); for(const region of ['header','main','footer'] as const) flush(region)
  return result
}
export function componentResources(fields: Field[], evidence: Evidence): {images: Resource[]; links: Resource[]} {
  const result: {images: Resource[]; links: Resource[]} = {images:[],links:[]}
  for (const field of fields) {
    if (/<[a-z][\s\S]*>/i.test(field.value)) {
      const embedded = extractPageEvidence(field.value, evidence.baseUrl)
      for (const kind of ['images','links'] as const) result[kind].push(...embedded[kind].map(item => ({...item, region: field.region})))
      continue
    }
    const path = field.path.toLowerCase()
    const knownImage = evidence.images.some(item => item.url === absoluteUrl(field.value,evidence.baseUrl,'image'))
    const imagePath = /(?:image|photo|picture|logo|background|poster|thumbnail|media).*(?:url|src|originalurl)$|(?:^|\.)(?:image|src|imageurl|backgroundimage|thumbnail|poster)$/.test(path)
    const imageValue = /\.(?:png|jpe?g|gif|webp|svg|avif|ico)(?:[?#]|$)/i.test(field.value)
    const linkPath = /(?:^|\.)(?:href|path|link|action|canonicalurl)$/.test(path) || /(?:^|\.)(?:href|link|action)\.url$/.test(path)
    const videoValue = /\.(?:mp4|webm|mov|mp3|wav|ogg)(?:[?#]|$)/i.test(field.value)
    const kind = linkPath ? 'links' : !videoValue && (knownImage || imagePath || imageValue) ? 'images' : /(?:^|\.)(?:url)$/.test(path) && !videoValue ? 'links' : null
    if (kind) { const url = absoluteUrl(field.value,evidence.baseUrl,kind === 'images' ? 'image' : 'link'); if(url) result[kind].push({url,region:field.region}) }
  }
  return result
}
export function share(numerator: number, denominator: number): Share { return {numerator,denominator,share:denominator === 0 ? null : numerator / denominator} }
export function wordShingles(value: string): string[] {
  const words = normalizeText(value).split(/\s+/).filter(Boolean)
  return words.length < 5 ? (words.length ? [words.join(' ')] : []) : words.slice(0, -4).map((_, index) => words.slice(index, index + 5).join(' '))
}
const containsShingle = (text: string, shingle: string) => (' ' + text + ' ').includes(' ' + shingle + ' ')
function fieldCorpus(fields: Field[]): string[] {
  const groups = new Map<number, string[]>()
  for (const field of fields.filter(field => isHumanText(field, 1))) {
    const values = groups.get(field.componentIndex) || []
    values.push(normalizeText(field.value)); groups.set(field.componentIndex, values)
  }
  return [...groups.values()].flatMap(values => [...values, values.join(' ')])
}
export function extractSectionEvidence(sections: Record<string, {key: string; slice: Array<{text?: string; attrs?: Record<string,string>; aria?: Record<string,string>; tag?: string}>}>, shownKeys = Object.keys(sections)): SectionEvidence {
  const result: SectionEvidence = {text: [], fields: [], sectionKeys: [...new Set(shownKeys)]}
  result.sectionKeys.forEach((key, componentIndex) => {
    const section = sections[key]
    if (!section) throw new Error('Shown section is absent from snapshot: ' + key)
    const region: Region = key === 'header' ? 'header' : key === 'footer' ? 'footer' : 'main'
    const add = (value: string | undefined, path: string) => {
      if (!value) return
      const text = normalizeText(value)
      if (text.length >= 12) result.text.push({text, region})
      result.fields.push({value, path, region, componentIndex, componentType: 'section'})
    }
    for (const node of section.slice) {
      add(node.text, 'content.text')
      for (const name of ['alt','title','aria-label','placeholder','value', ...(node.tag === 'meta' ? ['content'] : [])]) {
        add(node.attrs?.[name], 'content.text'); add(node.aria?.[name], 'content.text')
      }
    }
  })
  return result
}
export function measureTextKept(pieces: Piece[], fields: Field[]) {
  const text = fieldCorpus(fields), unique = new Map<string, Piece>()
  for (const piece of pieces) {
    const normalized = {...piece, text: normalizeText(piece.text)}
    unique.set(normalized.region + '\0' + normalized.text, normalized)
  }
  const scores: PieceScore[] = [...unique.values()].map(piece => {
    const shingles = wordShingles(piece.text)
    const missingShingles = shingles.filter(shingle => !text.some(value => containsShingle(value, shingle)))
    return {...piece, shingles, missingShingles, kept: shingles.length > 0 && (shingles.length - missingShingles.length) / shingles.length >= TEXT_COVERAGE_THRESHOLD}
  })
  const missing = scores.filter(piece => !piece.kept).map(({text, region}) => ({text, region})).sort((a,b) => b.text.length-a.text.length)
  const totalCharacters = scores.reduce((n,piece) => n + piece.text.length, 0)
  const keptCharacters = scores.filter(piece => piece.kept).reduce((n,piece) => n + piece.text.length, 0)
  const totalShingles = scores.reduce((n,piece) => n + piece.shingles.length, 0)
  const missingShingles = scores.reduce((n,piece) => n + piece.missingShingles.length, 0)
  return {count: share(scores.length-missing.length,scores.length), characters: share(keptCharacters,totalCharacters), shingles: share(totalShingles-missingShingles,totalShingles), missing, scores, duplicatesRemoved: pieces.length-scores.length}
}
export function measureTextNotFound(fields: Field[], evidence: Evidence) {
  const human = fields.filter(field => isHumanText(field))
  const source = [...evidence.allText, ...evidence.attributeText].join(' ')
  const notFound = human.filter(field => {
    const shingles = wordShingles(field.value)
    return shingles.filter(shingle => containsShingle(source, shingle)).length / shingles.length < TEXT_COVERAGE_THRESHOLD
  })
  return {share: share(notFound.length,human.length), notFound}
}
export function measureResources(source: Resource[], output: Resource[]): Coverage {
  const expected = new Set(source.map(r => r.url)), actual = new Set(output.map(r => r.url))
  const missing = [...expected].filter(url => !actual.has(url)).sort(), extra = [...actual].filter(url => !expected.has(url)).sort()
  return { kept: share(expected.size-missing.length,expected.size), invented: share(extra.length,actual.size), missing, extra }
}
export function measureShape(components: Component[], droppedSections: unknown[] = [], diagnostics: unknown[] = []) {
  const types = components.map(component => component.type), counts: Record<string,number> = {}
  for(const type of types) counts[type] = (counts[type] || 0)+1
  return { count:components.length, types, counts, sectionsDropped:droppedSections.length, diagnosticsCount:diagnostics.length }
}
export function diagnosticEvidence(diagnostics: Array<{code?: string; context?: Record<string, any>; [key:string]:unknown}>, omitted: string[] = []) {
  const regionFor = (section: {sectionKey?: string; role?: string}): Region | undefined => {
    const key = section.role || section.sectionKey
    return key ? key.includes('header') ? 'header' : key.includes('footer') ? 'footer' : 'main' : undefined
  }
  return {
    dropped: [...diagnostics.filter(d => d.code === 'SECTION_EXTRACTION_DROPPED').flatMap(d => (d.context?.sections || []).map((section: any) => ({...section, region:regionFor(section)}))), ...omitted.map(sectionKey => ({sectionKey, reason:'max-sections', region:regionFor({sectionKey})}))],
    diagnostics: diagnostics.map(d => ({...d, regions:[...new Set((d.context?.sections || [d.context || {}]).map(regionFor).filter(Boolean))] as string[]}))
  }
}
export function measureArm(evidence: Evidence, components: Component[], dropped: Array<{region?: string}> = [], diagnostics: Array<{region?: string; regions?: string[]}> = [], shown: SectionEvidence = {text: [], fields: [], sectionKeys: []}): Measurement {
  const fields=componentStrings(components), resources=componentResources(fields,evidence)
  return Object.fromEntries(regions.map(scope => {
    const select = <T extends {region: Region}>(values:T[]) => scope === 'overall' ? values : values.filter(v => v.region === scope)
    // Kept content may occur anywhere; regional scores describe where the source originated.
    const kept = measureTextKept(select(evidence.text),fields), notFound=measureTextNotFound(select(fields),evidence)
    const shownKept = measureTextKept(select(shown.text), fields), reached = measureTextKept(select(evidence.text), shown.fields)
    const imageCoverage=measureResources(select(evidence.images),resources.images)
    imageCoverage.invented=measureResources(evidence.images,select(resources.images)).invented
    imageCoverage.extra=measureResources(evidence.images,select(resources.images)).extra
    const linkCoverage=measureResources(select(evidence.links),resources.links)
    linkCoverage.invented=measureResources(evidence.links,select(resources.links)).invented
    linkCoverage.extra=measureResources(evidence.links,select(resources.links)).extra
    return [scope,{textKept:kept.count,textCharactersKept:kept.characters,textShinglesKept:kept.shingles,
      shownTextKept:shownKept.count,shownTextCharactersKept:shownKept.characters,shownTextShinglesKept:shownKept.shingles,
      textNotFound:notFound.share,missingText:kept.missing,missingShownText:shownKept.missing,notFoundText:notFound.notFound,
      textScores:kept.scores,shownTextScores:shownKept.scores,textFields:select(fields).filter(field => isHumanText(field)),
      duplicatesRemoved:kept.duplicatesRemoved,shownDuplicatesRemoved:shownKept.duplicatesRemoved,
      visibleTextNotShown:share(reached.count.denominator-reached.count.numerator,reached.count.denominator),
      visibleShinglesNotShown:share(reached.shingles.denominator-reached.shingles.numerator,reached.shingles.denominator),missingFromModel:reached.missing,
      images:imageCoverage,links:linkCoverage,outputResources:{images:select(resources.images),links:select(resources.links)},
      shape:measureShape(scope === 'overall' ? components : components.filter(c => componentRegion(c) === scope), scope === 'overall' ? dropped : dropped.filter(d => d.region === scope), scope === 'overall' ? diagnostics : diagnostics.filter(d => d.region === scope || d.regions?.includes(scope)))}]
  })) as Measurement
}
