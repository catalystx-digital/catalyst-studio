import { createRequire } from 'node:module'
import { digest } from './storage'
import type { Anchor, Block, Box, Proposal } from './labels'
import type { Region } from './metrics'
const { parse, serialize } = createRequire(__filename)('parse5') as typeof import('parse5')
type Node = {tagName?: string; attrs?: Array<{name:string;value:string}>; childNodes?: Node[]}
const elements = (node: Node) => (node.childNodes || []).filter(n=>n.tagName)
const attribute = (node: Node, name: string) => node.attrs?.find(a=>a.name===name)?.value || ''
function bodyOf(html: string): Node { const doc=parse(html) as Node; return elements(elements(doc).find(n=>n.tagName==='html')!).find(n=>n.tagName==='body')! }
export function resolveAnchor(html: string, anchor: Anchor): Node | null {
  let node: Node | undefined=bodyOf(html)
  for (const index of anchor.path) { if (!Number.isInteger(index) || index<0) return null; node=node && elements(node)[index] }
  return node && node.tagName===anchor.tag && attribute(node,'id')===anchor.id && attribute(node,'class').split(/\s+/).filter(Boolean).join(' ')===anchor.classes.join(' ') ? node : null
}
export function instrumentHtml(html: string, finalUrl: string) {
  const doc=parse(html) as Node, top=elements(doc).find(n=>n.tagName==='html')!, body=elements(top).find(n=>n.tagName==='body')!
  const marker='data-import-lab-'+digest(html).slice(0,12), anchors: Record<string,Anchor>={}
  const visit=(node: Node, indices: number[])=> {
    const key=indices.join('.') || 'body'
    anchors[key]={path:indices,tag:node.tagName!,id:attribute(node,'id'),classes:attribute(node,'class').split(/\s+/).filter(Boolean)}
    node.attrs!.push({name:marker,value:key})
    elements(node).forEach((child,index)=>visit(child,[...indices,index]))
  }
  visit(body,[])
  const head=elements(top).find(n=>n.tagName==='head')!
  // Evidence URLs use the saved base; browser navigation supplies the document origin.
  const originalBase=elements(head).find(n=>n.tagName==='base' && attribute(n,'href'))
  const base=originalBase ? new URL(attribute(originalBase,'href'),finalUrl).href : finalUrl
  const serialized=serialize(doc as any)
  const stylesheetCount=(node:Node):number=>Number(node.tagName==='style' || (node.tagName==='link' && attribute(node,'rel').toLowerCase().split(/\s+/).includes('stylesheet')))+(node.childNodes||[]).reduce((sum,child)=>sum+stylesheetCount(child),0)
  return {html:serialized,marker,anchors,baseUrl:base,declaredStylesheets:stylesheetCount(doc)}
}
export interface Geometry {
  key: string; tag: string; region: Region; box: Box; visible: boolean; meaningful: boolean
  id?: string; classes?: string[]; role?: string; anchorKey?: string | null
  ownTextLength?: number; ownContent?: boolean; children: Geometry[]
  evidence?: Pick<Block, 'anchor' | 'anchorResolved' | 'text' | 'images' | 'links' | 'headings' | 'repeatedChildren'>
  // Synthetic rows retain disjoint source nodes, so merged blocks keep all anchors and evidence.
  members?: Geometry[]; grouping?: 'columns' | 'attached' | 'grid'; headerRequiresNavigation?: boolean
}
interface StylingCheck { declared: number; applied: number; inline: number; inaccessible: number }
export interface BlockProposal extends Omit<Proposal, 'status'> {
  status: Proposal['status'] | 'unstyled'
  styling?: StylingCheck
  stylesheetFailures?: Array<{url:string;reason:string}>
  lazyContent?: {durationMs:number;steps:number;bounded:boolean}
}
export interface GeometryDocument extends Omit<BlockProposal, 'blocks' | 'status'> { tree: Geometry }
export const UNSTYLED_ISSUE='rendered without styling - blocks are not trustworthy'
// Pixel thresholds refer to rendered CSS geometry, independent of viewport or container width.
const MIN_BAND_HEIGHT=48 // Short content joins its neighbouring band; empty spacers never veto a cut.
export const TALL_BLOCK=700 // Only larger containers are automatically divided into rows.
const ROW_OVERLAP=0.5 // Strictly more than half of the shorter vertical range defines one row.
const WIDE_COLUMN_RATIO=2 // A dominant main column may be cut independently of its sidebar.
const HEADING_ROW_HEIGHT=120 // Short headings belong with the content they introduce.
const HEADING_OTHER_TEXT=40 // Allow a small label alongside a heading, but not a prose section.
const NAVIGATION_SHARE=0.5 // Most visible text/media must be links or logo imagery for an unmarked header.
const MAX_HEADER_HEIGHT=300 // Navigation rows may merge only up to this height.
const HEADER_ZONE=300 // Unmarked link/logo navigation is inferred only at the top of the page.
const UNDER_CUT_HEIGHT=1500 // Keep indivisible content, but make suspiciously tall blocks reviewable.
const atomicTags=new Set(['img','picture','svg','video','canvas','iframe','input','ul','ol','p','pre','table'])
const meaningfulChildren=(node: Geometry)=>node.children.filter(eligible)
const hasOwnText=(node:Geometry)=>Boolean(node.ownContent || node.ownTextLength)
function eligible(node:Geometry):boolean {
  return node.visible && node.box.height>0 && node.box.width>0 &&
    (node.meaningful || hasOwnText(node) || node.children.some(eligible))
}
const byPosition=(a:Geometry,b:Geometry)=>a.box.y-b.box.y || a.box.x-b.box.x
function combine(nodes:Geometry[],grouping:'columns'|'attached'|'grid'):Geometry {
  if(nodes.length===1)return nodes[0]
  const x=Math.min(...nodes.map(n=>n.box.x)),y=Math.min(...nodes.map(n=>n.box.y))
  return {key:'row-'+digest(nodes.map(n=>n.key).join('|')).slice(0,16),tag:'div',region:nodes.every(n=>n.region===nodes[0].region)?nodes[0].region:'main',headerRequiresNavigation:nodes.some(n=>n.headerRequiresNavigation),
    box:{x,y,width:Math.max(...nodes.map(n=>n.box.x+n.box.width))-x,height:Math.max(...nodes.map(n=>n.box.y+n.box.height))-y},
    visible:true,meaningful:true,children:nodes,members:nodes,grouping}
}
function overlaps(a:Geometry,b:Geometry):boolean {
  return Math.min(a.box.y+a.box.height,b.box.y+b.box.height)-Math.max(a.box.y,b.box.y) > Math.min(a.box.height,b.box.height)*ROW_OVERLAP
}
function headingOnly(node:Geometry):boolean {
  if(node.box.height>=HEADING_ROW_HEIGHT)return false
  let headings=0,otherText=0,otherContent=false
  const visit=(n:Geometry)=>{
    if(!eligible(n))return
    if(/^h[1-6]$/.test(n.tag)){headings++;return}
    otherText+=n.ownTextLength ?? (n.ownContent?HEADING_OTHER_TEXT+1:0)
    if(atomicTags.has(n.tag) && n.tag!=='p')otherContent=true
    n.children.forEach(visit)
  }
  visit(node)
  return headings>0 && otherText<=HEADING_OTHER_TEXT && !otherContent
}
const attaches=(node:Geometry)=>node.box.height<MIN_BAND_HEIGHT || headingOnly(node)
export function groupRows(children:Geometry[],mergeGrid=false):Geometry[] {
  const groups:Geometry[][]=[]
  for(const child of children.filter(eligible).sort(byPosition)) {
    const matching=groups.filter(group=>group.some(n=>n.region===child.region && overlaps(n,child)))
    const joined=[child,...matching.flat()].sort(byPosition)
    for(const group of matching)groups.splice(groups.indexOf(group),1)
    groups.push(joined)
  }
  const rows=groups.map(group=>combine(group,'columns')).sort(byPosition)
  const bands:Geometry[]=[],pending:Geometry[]=[]
  for(const row of rows) {
    if(pending.length && pending[0].region!==row.region)bands.push(combine(pending.splice(0),'attached'))
    if(attaches(row)){pending.push(row);continue}
    bands.push(combine([...pending.splice(0),row],'attached'))
  }
  if(pending.length) {
    const previous=bands[bands.length-1]?.region===pending[0].region?bands.pop():undefined
    bands.push(combine([...(previous?[previous]:[]),...pending],'attached'))
  }
  return mergeGrid?mergeGridRows(bands):bands
}
function columnsOf(row:Geometry):Geometry[] {
  if(row.grouping==='grid')return columnsOf(row.members![0])
  if(row.grouping==='attached') {
    const content=row.members!.filter(n=>!attaches(n))
    return content.length===1?columnsOf(content[0]):[]
  }
  if(row.grouping==='columns')return [...row.members!].sort((a,b)=>a.box.x-b.box.x)
  // Only columns grouped from this parent's children share a grid; separate containers do not.
  return []
}
function mergeGridRows(rows:Geometry[]):Geometry[] {
  const merged:Geometry[]=[]
  for(const row of rows) {
    const previous=merged[merged.length-1],a=previous?columnsOf(previous):[],b=columnsOf(row)
    const sameColumns=a.length>=2 && a.length===b.length && a.every((column,i)=>
      Math.abs(column.box.x-b[i].box.x)<=column.box.width*0.05 && Math.abs(column.box.width-b[i].box.width)<=column.box.width*0.05)
    if(previous && previous.region===row.region && row.grouping!=='attached' && !headingOnly(row) && sameColumns &&
      row.box.y>=previous.box.y+previous.box.height && row.box.y+row.box.height-previous.box.y<=UNDER_CUT_HEIGHT) {
      merged[merged.length-1]=combine([...(previous.grouping==='grid'?previous.members!:[previous]),row],'grid')
    } else merged.push(row)
  }
  return merged
}
function articleSection(node:Geometry):boolean {
  let heading=false,article=false
  const visit=(n:Geometry)=>{
    if(!eligible(n))return
    if(/^h[1-6]$/.test(n.tag))heading=true
    if(n.tag==='article' || (['p','a'].includes(n.tag) && (n.ownTextLength||0)>HEADING_OTHER_TEXT))article=true
    n.children.forEach(visit)
  }
  visit(node)
  return heading && article
}
function mainRegion(node:Geometry):Geometry {
  return {...node,region:'main',children:node.children.map(mainRegion),...(node.members?{members:node.members.map(mainRegion)}:{})}
}
function cutRow(row:Geometry):Geometry[] {
  if(row.grouping==='grid')return [row]
  if(row.grouping==='attached') {
    const members=row.members!,index=members.findIndex(n=>!attaches(n))
    if(index<0)return [row]
    const bands=cutRow(members[index])
    const first=bands[0]
    if(first.grouping==='grid') {
      bands.splice(0,1,...mergeGridRows([combine([...members.slice(0,index),first.members![0]],'attached'),...first.members!.slice(1)]))
    } else bands[0]=combine([...members.slice(0,index),first],'attached')
    bands[bands.length-1]=combine([bands[bands.length-1],...members.slice(index+1)],'attached')
    return bands
  }
  if(row.grouping==='columns') {
    if(row.box.height<=(row.region==='header'?MAX_HEADER_HEIGHT:TALL_BLOCK))return [row]
    const columns=row.members!,widest=[...columns].sort((a,b)=>b.box.width-a.box.width)[0]
    if(columns.every(n=>n===widest || widest.box.width>=n.box.width*WIDE_COLUMN_RATIO))
      return columns.flatMap(n=>n===widest?proposeGeometry(n):[n]).sort(byPosition)
    return [row]
  }
  return proposeGeometry(row)
}
export function proposeGeometry(root: Geometry): Geometry[] {
  if(!eligible(root))return []
  if(hasOwnText(root) || atomicTags.has(root.tag))return [root]
  const children=meaningfulChildren(root)
  if(children.length===1)return proposeGeometry(children[0])
  if(root.box.height<=(root.region==='header'?MAX_HEADER_HEIGHT:TALL_BLOCK) || children.length<2)return [root]
  let rows=groupRows(children,true)
  if(root.region==='footer') {
    let leading=true
    rows=rows.map(row=>{
      if(leading && articleSection(row))return mainRegion(row)
      leading=false
      return row
    })
  }
  if(rows.length===1 && !rows[0].members)return proposeGeometry(rows[0])
  return rows.flatMap(cutRow)
}
export function childCandidates(node: Geometry): Geometry[] {
  if(node.grouping==='grid')return node.members!
  if(hasOwnText(node) || atomicTags.has(node.tag))return []
  let children=meaningfulChildren(node)
  while(children.length===1 && !hasOwnText(children[0]) && !atomicTags.has(children[0].tag))children=meaningfulChildren(children[0])
  const rows=groupRows(children)
  return rows.length>=2?rows:[]
}
function regionHints(root:Geometry,semantic:boolean):Geometry {
  const visit=(node:Geometry,region:Region,inMain:boolean,headerRequiresNavigation=false):Geometry=>{
    const identity=[node.id,...(node.classes||[])].join(' ')
    if(!inMain && (node.tag==='header' || node.role==='banner' || (!semantic && /header|nav|masthead/i.test(identity)))) {
      region='header'
      headerRequiresNavigation=headerRequiresNavigation || node.box.height>MAX_HEADER_HEIGHT
    }
    if(!inMain && (node.tag==='footer' || node.role==='contentinfo' || /footer/i.test(identity)))region='footer'
    if(node.tag==='main' || node.role==='main'){region='main';inMain=true}
    return {...node,region,headerRequiresNavigation,children:node.children.map(n=>visit(n,region,inMain,headerRequiresNavigation))}
  }
  return visit(root,'main',false)
}
function navigationLike(node:Geometry):boolean {
  let total=0,navigation=0
  const visit=(n:Geometry,inLink=false)=>{
    if(!eligible(n))return
    const linked=inLink || n.tag==='a' || n.tag==='nav'
    const text=n.ownTextLength ?? (n.ownContent?1:0)
    total+=text
    if(linked)navigation+=text
    if(n.tag==='img' || n.tag==='svg'){total++;navigation++}
    n.children.forEach(c=>visit(c,linked))
  }
  visit(node)
  return total>0 && navigation/total>NAVIGATION_SHARE
}
export function proposeFromGeometry(saved:GeometryDocument):BlockProposal {
  if(saved.version!==1 || !saved.tree)throw new Error('Unsupported or missing geometry tree')
  const hasSemantic=(n:Geometry):boolean=>['header','main','footer'].includes(n.tag)||n.children.some(hasSemantic)
  const semantic=hasSemantic(saved.tree),tree=regionHints(saved.tree,semantic)
  // Semantic roots are disjoint; section headers inside main remain part of main.
  const roots=(node:Geometry):Geometry[]=>{
    if(['header','main','footer'].includes(node.tag) || hasOwnText(node))return [node]
    return node.children.flatMap(child=>hasSemantic(child)?roots(child):[child])
  }
  let selected=(semantic?roots(tree).flatMap(proposeGeometry):proposeGeometry(tree)).sort(byPosition)
  let leading=true
  selected=selected.map(node=>{
    const header=leading && node.box.height<=MAX_HEADER_HEIGHT &&
      (node.region==='header' ? !node.headerRequiresNavigation || navigationLike(node) : !semantic && node.box.y<HEADER_ZONE && navigationLike(node))
    if(!header)leading=false
    if(node.region==='header' && !header)return mainRegion(node)
    return {...node,region:header?'header':node.region==='footer'?'footer':'main'}
  })
  if(!semantic) {
    let trailing=true
    for(let i=selected.length-1;i>=0;i--) {
      if(selected[i].region!=='footer')trailing=false
      if(!trailing && selected[i].region==='footer')selected[i]={...selected[i],region:'main'}
    }
  }
  const coveredKeys=new Set<string>()
  const cover=(node:Geometry)=>{coveredKeys.add(node.key);node.members?.forEach(cover)}
  selected.forEach(cover)
  const build=(node:Geometry,children=true):Block=>{
    let block:Block
    if(node.members)block=node.members.map(n=>build(n,false)).reduce(mergeBlocks)
    else {
      const evidence=node.evidence || {anchor:null,anchorResolved:false,text:'',images:[],links:[],headings:[],repeatedChildren:[]}
      block={...evidence,id:'block-'+(evidence.anchor?evidence.anchor.path.join('-')||'body':'dynamic-'+node.key),order:0,region:node.region,box:node.box,children:[]}
    }
    return {...block,region:node.region,box:node.box,children:children?childCandidates(node).map(n=>build(n,false)):[]}
  }
  const blocks:Block[]=[]
  for(const node of selected) {
    const block=build(node),last=blocks[blocks.length-1]
    if(last && block.region!=='main' && last.region===block.region &&
      (block.region!=='header' || Math.max(last.box.y+last.box.height,block.box.y+block.box.height)-Math.min(last.box.y,block.box.y)<=MAX_HEADER_HEIGHT)) {
      const merged=mergeBlocks(last,block)
      // One candidate level only; the same row groups remain available to Split.
      merged.children=[...(last.children.length?last.children:[last]),...(block.children.length?block.children:[block])].map(b=>({...b,children:[]}))
      blocks[blocks.length-1]=merged
    } else blocks.push(block)
  }
  const issues=[...saved.issues],unassigned:string[]=[]
  if(saved.styling && saved.styling.declared>0 && saved.styling.applied===0 && !issues.includes(UNSTYLED_ISSUE))issues.push(UNSTYLED_ISSUE)
  const audit=(node:Geometry,covered=false)=>{
    covered=covered||coveredKeys.has(node.key)
    if(eligible(node)&&!covered&&(hasOwnText(node)||!node.children.length))unassigned.push(node.tag+' at rendered node '+node.key)
    node.children.forEach(child=>audit(child,covered))
  }
  audit(tree)
  if(unassigned.length)issues.push('Visible content outside proposed bands: '+unassigned.join('; '))
  for(const block of blocks)if(block.box.height>UNDER_CUT_HEIGHT)issues.push('probably under-cut: '+block.id+' is '+block.box.height+'px tall')
  const unresolved=blocks.filter(b=>!b.anchorResolved).length
  if(!blocks.length)issues.push('No meaningful bands found; human investigation required')
  if(unresolved)issues.push(unresolved+' of '+blocks.length+' block anchors unresolved')
  const {tree:_,...metadata}=saved
  return {...metadata,blocks:blocks.map((b,i)=>({...b,order:i+1})),issues,status:issues.includes(UNSTYLED_ISSUE)?'unstyled':'complete'}
}
export function mergeBlocks(a: Block, b: Block): Block {
  const x=Math.min(a.box.x,b.box.x),y=Math.min(a.box.y,b.box.y)
  return {...a,id:'merge-'+digest(a.id+'|'+b.id).slice(0,16),anchor:null,anchorResolved:a.anchorResolved&&b.anchorResolved,
    sourceAnchors:[...(a.sourceAnchors || (a.anchor?[a.anchor]:[])),...(b.sourceAnchors || (b.anchor?[b.anchor]:[]))],
    box:{x,y,width:Math.max(a.box.x+a.box.width,b.box.x+b.box.width)-x,height:Math.max(a.box.y+a.box.height,b.box.y+b.box.height)-y},
    text:[a.text,b.text].filter(Boolean).join(' '),images:[...new Set([...a.images,...b.images])],links:[...new Set([...a.links,...b.links])],headings:[...a.headings,...b.headings],repeatedChildren:[...a.repeatedChildren,...b.repeatedChildren],children:[a,b]}
}
