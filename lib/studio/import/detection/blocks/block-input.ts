import * as parse5 from 'parse5'
import type { Block, Anchor } from './block-cutter'
import { shouldSkipBodyFallbackMainNode, traverseToNodes, removeScriptsStylesAndComments, collectResources, type DomNode, type ResourcesSummary, type BackgroundImageMap } from '@/lib/studio/import/services/web-tools'

export interface BlockInputArgs {
  html: string
  bgImageMap: BackgroundImageMap
  block: Block
}

export interface BlockInput {
  block: Block
  nodes: DomNode[]
  trees: any[]
  resourcesSummary: ResourcesSummary
  issues: string[]
  stats: {
    nodeCount: number
    approxBytes: number
  }
  sectionKey: string
}

const elements = (node: any): any[] => (node?.childNodes || []).filter((n: any) => n.tagName)

const attr = (node: any, name: string): string => node.attrs?.find((a: any) => a.name === name)?.value || ''

function rootsFromDocument(doc: any, block: Block): any[] {
  if (!block.anchorResolved) {
    throw new Error('Unresolved saved anchor: ' + block.id)
  }
  const body = elements(elements(doc).find(n => n.tagName === 'html')).find(n => n.tagName === 'body')
  const anchors = block.sourceAnchors?.length ? block.sourceAnchors : block.anchor ? [block.anchor] : []
  if (!anchors.length) {
    throw new Error('Block has no saved anchor: ' + block.id)
  }
  const roots = anchors.map(a => {
    let node = body
    for (const index of a.path) {
      if (!Number.isInteger(index) || index < 0) {
        throw new Error('Invalid block anchor: ' + block.id)
      }
      node = elements(node)[index]
    }
    if (!node || node.tagName !== a.tag || attr(node, 'id') !== a.id || JSON.stringify(attr(node, 'class').split(/\s+/).filter(Boolean).sort()) !== JSON.stringify([...a.classes].sort())) {
      throw new Error('Saved anchor no longer resolves: ' + block.id)
    }
    return node
  })
  for (let i = 0; i < anchors.length; i++) {
    for (let j = i + 1; j < anchors.length; j++) {
      if (inside(anchors[i], anchors[j]) || inside(anchors[j], anchors[i])) {
        throw new Error('Overlapping source anchors: ' + block.id)
      }
    }
  }
  return roots
}

// Exported for the lab to inspect source repetition when drafting labels.
export function resolveRoots(html: string, block: Block): any[] { return rootsFromDocument(parse5.parse(html), block) }

function inside(child: Anchor, parent: Anchor) { return parent.path.every((v, i) => child.path[i] === v) }

function parsedTrees(root: any): any[] {
  const html = removeScriptsStylesAndComments(parse5.serializeOuter(root)).replace(/\s+/g, ' ')
  const trees = elements(parse5.parseFragment(root.parentNode?.tagName ? root.parentNode : undefined, html, {}))
  return root.tagName === 'body' ? trees.filter(node => node.tagName === 'body') : trees
}

export function buildBlockInput({ html, block, bgImageMap }: BlockInputArgs): BlockInput {
  const document = parse5.parse(html)
  const hasMain = (node: any): boolean => node.tagName === 'main' || elements(node).some(hasMain)
  const bodyFallback = block.region === 'main' && !hasMain(document)
  const roots = rootsFromDocument(document, block).flatMap(parsedTrees)
  const visibleNodes = new Map<any, DomNode>()
  const nodes = roots.flatMap(tree => traverseToNodes(tree, {
    maxTextPerNode: 1500, bgImageMap, preserveClassHiddenRoot: block.region === 'header',
    skipTags: bodyFallback ? new Set(['header', 'footer', 'nav']) : undefined,
    skipNode: bodyFallback ? shouldSkipBodyFallbackMainNode : undefined,
    onNode: (source, node) => visibleNodes.set(source, node)
  }))
  const filteredTree = (node: any): any => {
    if (node.nodeName === '#text') {
      return { nodeName: node.nodeName, value: node.value }
    }
    const visible = visibleNodes.get(node)
    return visible ? {
      tagName: node.tagName,
      attrs: node.attrs,
      bgImage: visible.bgImage,
      childNodes: (node.childNodes || []).map(filteredTree).filter(Boolean)
    } : null
  }
  const trees = roots.map(filteredTree).filter(Boolean)
  const issues = nodes.length ? [] : ['Production representation contains no visible nodes']
  return {
    block, nodes, trees, resourcesSummary: collectResources(nodes, []), issues,
    stats: { nodeCount: nodes.length, approxBytes: Buffer.byteLength(JSON.stringify(nodes)) },
    sectionKey: block.region + '-block-' + block.order + '-' + block.id
  }
}

export function splitBlockInput(args: BlockInputArgs, fits: (input: BlockInput) => boolean): { parts: BlockInput[]; splits: string[] } {
  const input = buildBlockInput(args), { block } = args
  if (fits(input)) return { parts: [input], splits: [] }
  if (block.children.length < 2) throw new Error('Oversized block has no safe saved child boundaries: ' + block.id)
  verifyChildCoverage(args.html, block, block.children)
  const results = [...block.children].sort((a, b) => a.order - b.order)
    .map(child => splitBlockInput({ ...args, block: child }, fits))
  return { parts: results.flatMap(result => result.parts), splits: [
    'Split ' + block.id + ' at saved child boundaries: ' + block.children.map(child => child.id).join(', '),
    ...results.flatMap(result => result.splits)
  ] }
}

function verifyChildCoverage(html: string, parent: Block, children: Block[]) {
  const parentAnchors = parent.sourceAnchors?.length ? parent.sourceAnchors : parent.anchor ? [parent.anchor] : []
  const childAnchors = children.flatMap(c => c.sourceAnchors?.length ? c.sourceAnchors : c.anchor ? [c.anchor] : [])
  if (childAnchors.length < children.length) {
    throw new Error('Split child lacks an anchor')
  }
  for (const c of childAnchors) {
    if (!parentAnchors.some(p => inside(c, p))) {
      throw new Error('Split child is outside parent')
    }
  }
  for (let i = 0; i < childAnchors.length; i++) {
    for (let j = i + 1; j < childAnchors.length; j++) {
      if (inside(childAnchors[i], childAnchors[j]) || inside(childAnchors[j], childAnchors[i])) {
        throw new Error('Split children overlap')
      }
    }
  }
  // Reject any split that would lose direct text or media on the retained parent/wrappers.
  resolveRoots(html, parent).forEach((root, i) => {
    const visit = (n: any, anchor: Anchor) => {
      if (childAnchors.some(c => inside(anchor, c))) {
        return
      }
      if (['script', 'style', 'template', 'noscript'].includes(n.tagName)) {
        return
      }
      const direct = (n.childNodes || []).some((c: any) => c.nodeName === '#text' && c.value.trim())
      if (direct || ['img', 'video', 'iframe', 'svg', 'input'].includes(n.tagName) || /background/i.test(attr(n, 'style'))) {
        throw new Error('Split would lose parent text/media: ' + parent.id)
      }
      elements(n).forEach((c, index) => visit(c, { ...anchor, path: [...anchor.path, index] }))
    }
    visit(root, parentAnchors[i])
  })
}
