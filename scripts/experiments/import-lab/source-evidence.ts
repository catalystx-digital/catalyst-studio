import { createRequire } from 'node:module'
import { resolveRoots } from '@/lib/studio/import/detection/blocks/block-input'
import { absoluteUrl, extractPageEvidence, normalizeText, visibilityContext, type Region } from './metrics'
import type { Block, Box } from './labels'

const { parse } = createRequire(__filename)('parse5') as typeof import('parse5')
type Node = {tagName?:string;nodeName?:string;value?:string;attrs?:Array<{name:string;value:string}>;childNodes?:Node[]}
type GeometryNode = {anchorKey?:string|null;box?:Box;evidence?:{images?:string[]};children?:GeometryNode[]}
export interface ImageGroup {addresses:string[]; width:number|null; height:number|null; kind:'image'|'background'}
export interface SourceEvidence {text:Array<{text:string;region:Region}>; headings:string[]; links:Array<{url:string;label:string}>; images:ImageGroup[]; wordCount:number; sourceText:string; issue?:string}
const attrs=(node:Node)=>Object.fromEntries((node.attrs||[]).map(a=>[a.name,a.value]))
const elements=(node:Node)=>(node.childNodes||[]).filter(n=>n.tagName)
const descendants=(node:Node):Node[]=>[node,...(node.childNodes||[]).flatMap(descendants)]
const excluded=new Set(['script','style','template','noscript'])
const rawText=(node:Node):string=>node.nodeName==='#text'?node.value||'':(node.childNodes||[]).map(rawText).join(' ')
const oneUrl=(value:string|undefined,base:string)=>value?[absoluteUrl(value,base,'image')].filter((url):url is string=>!!url):[]
const srcsetUrls=(value:string|undefined,base:string)=>value?value.replace(/data:[^\s]+(?:\s+\S+)?/gi,'').split(',').flatMap(part=>oneUrl(part.trim().split(/\s+/)[0],base)):[]
const size=(a:Record<string,string>,g?:GeometryNode)=>({width:Math.max(Number(a.width)||0,g?.box?.width||0)||null,height:Math.max(Number(a.height)||0,g?.box?.height||0)||null})
const counted=(group:ImageGroup)=>!((group.width===1&&group.height===1)||(group.width!==null&&group.height!==null&&group.width<16&&group.height<16))
export function fallbackEvidence(block:Block,pageUrl:string,issue:string):SourceEvidence {
  const sourceText=normalizeText(block.text)
  return {text:sourceText.length>=12?[{text:sourceText,region:block.region}]:[],headings:block.headings.map(normalizeText),links:[...new Set(block.links.map(url=>absoluteUrl(url,pageUrl,'link')).filter((url):url is string=>!!url))].map(url=>({url,label:''})),images:block.images.map(address=>({addresses:[absoluteUrl(address,pageUrl,'image')||address],width:null,height:null,kind:'image'})),wordCount:sourceText.split(/\s+/).filter(Boolean).length,sourceText,issue}
}
export function blockEvidence(html:string, stylesheets:string[], block:Block, geometry:unknown, pageUrl:string):SourceEvidence {
  if (!geometry || typeof geometry!=='object' || !('tree' in geometry)) throw new Error('Missing geometry.json')
  if (!(block.sourceAnchors?.length||block.anchor) || !block.anchorResolved) {
    return fallbackEvidence(block,pageUrl,`Block ${block.id} has no resolved anchor; used blocks.json evidence`)
  }
  const doc=parse(html) as Node
  const head=descendants(doc).find(n=>n.tagName==='head')
  const css=[...stylesheets,...(head?descendants(head).filter(n=>n.tagName==='style').map(rawText):[])]
  const visibility=visibilityContext(doc,css)
  const {isHidden}=visibility
  const visibleText=(node:Node):string=>excluded.has(node.tagName||'')||isHidden(node)?'':node.nodeName==='#text'?node.value||'':(node.childNodes||[]).map(visibleText).join(' ')
  const map=new Map<string,GeometryNode>()
  const mapGeometry=(g:GeometryNode)=>{if(g.anchorKey!=null)map.set(g.anchorKey,g);g.children?.forEach(mapGeometry)}
  mapGeometry((geometry as {tree:GeometryNode}).tree)
  const anchors=block.sourceAnchors?.length?block.sourceAnchors:[block.anchor!]
  let roots:Node[]
  try {
    resolveRoots(html,block as Parameters<typeof resolveRoots>[1])
    const body=descendants(doc).find(node=>node.tagName==='body')!
    roots=anchors.map(anchor=>anchor.path.reduce((node,index)=>elements(node)[index],body))
  } catch { return fallbackEvidence(block,pageUrl,`Block ${block.id} has no resolved anchor; used blocks.json evidence`) }
  const extracted=extractPageEvidence(html,pageUrl,stylesheets,{document:doc,roots,visibility})
  const headings:string[]=[],links:SourceEvidence['links']=[],images:ImageGroup[]=[]
  const seenImages=new Set<string>()
  const pushImage=(group:ImageGroup)=>{group.addresses=[...new Set(group.addresses)];const signature=[...group.addresses].sort().join('|');if(group.addresses.length&&counted(group)&&!seenImages.has(signature)){seenImages.add(signature);images.push(group)}}
  const walk=(node:Node,path:number[],parentPicture?:{addresses:string[];width:number|null;height:number|null})=>{
    const a=attrs(node)
    if(isHidden(node))return
    const tag=node.tagName||''
    const key=path.join('.')||'body',g=map.get(key)
    if(node.nodeName==='#text')return
    if(excluded.has(tag))return
    if(tag==='picture') {
      const ownSize=size(a,g)
      const group={addresses:[...oneUrl(a.src,pageUrl),...oneUrl(a['data-src'],pageUrl),...srcsetUrls(a.srcset,pageUrl),...srcsetUrls(a['data-srcset'],pageUrl),...(g?.evidence?.images||[]).flatMap(u=>oneUrl(u,pageUrl))],width:ownSize.width,height:ownSize.height}
      elements(node).forEach((child,index)=>walk(child,[...path,index],group))
      pushImage({...group,kind:'image'})
      return
    }
    if(tag==='img'||tag==='source'&&parentPicture){
      const addresses=[...oneUrl(a.src,pageUrl),...oneUrl(a['data-src'],pageUrl),...srcsetUrls(a.srcset,pageUrl),...srcsetUrls(a['data-srcset'],pageUrl),...(g?.evidence?.images||[]).flatMap(u=>oneUrl(u,pageUrl))]
      if(parentPicture){parentPicture.addresses.push(...addresses);const box=size(a,g);parentPicture.width=Math.max(parentPicture.width||0,box.width||0)||null;parentPicture.height=Math.max(parentPicture.height||0,box.height||0)||null}
      else if(tag==='img')pushImage({addresses:[...new Set(addresses)],...size(a,g),kind:'image'})
    }
    if((/^h[1-6]$/.test(tag)||a.role==='heading')&&a['aria-hidden']!=='true'&&!/sr-only|visually-hidden|screen-reader/i.test(a.class||'')){const value=normalizeText(visibleText(node));if(value)headings.push(value)}
    if(tag==='a') {const url=absoluteUrl(a.href||'',pageUrl,'link'),label=normalizeText(visibleText(node));if(url&&!links.some(link=>link.url===url&&link.label===label))links.push({url,label})}
    const childImages=new Set((g?.children||[]).flatMap(function collect(child):string[]{return [...(child.evidence?.images||[]),...(child.children||[]).flatMap(collect)]}))
    const own=(g?.evidence?.images||[]).filter(address=>!childImages.has(address)&&tag!=='img'&&tag!=='picture')
    const inline=[...(a.style||'').matchAll(/background(?:-image)?\s*:\s*([^;]+)/gi)].flatMap(declaration=>[...declaration[1].matchAll(/url\(\s*['"]?([^'"\s)]+)['"]?\s*\)/gi)].map(m=>m[1]))
    for(const address of [...new Set([...own,...inline])]){const url=absoluteUrl(address,pageUrl,'image');if(url)pushImage({addresses:[url],...size(a,g),kind:'background'})}
    elements(node).forEach((child,index)=>walk(child,[...path,index],parentPicture))
  }
  roots.forEach((root,index)=>walk(root,anchors[index].path))
  const attributes:string[]=[]
  const collectAttributes=(node:Node)=>{if(excluded.has(node.tagName||'')||isHidden(node))return;const a=attrs(node);attributes.push(...['alt','title','aria-label'].map(key=>a[key]).filter(Boolean));node.childNodes?.forEach(collectAttributes)}
  roots.forEach(collectAttributes)
  const sourceText=[...extracted.visibleText,...attributes].join(' ')
  return {text:extracted.text,headings:[...new Set(headings)],links,images,wordCount:extracted.visibleText.flatMap(run=>run.split(/\s+/).filter(Boolean)).length,sourceText:normalizeText(sourceText)}
}
