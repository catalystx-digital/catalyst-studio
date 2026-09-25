import { componentStrings, componentResources, extractPageEvidence, isHumanText, measureTextKept, measureTextNotFound, normalizeText, containsPhrase, wordShingles, TEXT_COVERAGE_THRESHOLD, absoluteUrl, type Component, type Field } from './metrics'
import { familyOf, type FamilySet } from './families'
import { familySchemas } from './family-schemas'
import { sha, type Block, type FamilyLabel } from './labels'
import type { SourceEvidence } from './source-evidence'
import { fallbackEvidence } from './source-evidence'
import { createRequire } from 'node:module'
const {parseFragment}=createRequire(__filename)('parse5') as typeof import('parse5')
const verdicts=['correct','right type, content incomplete','wrong type','missed','should have been ignored','unsettled'] as const
type Verdict=typeof verdicts[number]
interface Check { passed: boolean | null; expected: unknown; produced: unknown; detail: string; structureUnknown?:boolean }
interface BlockScore { id: string; order: number; description: string; acceptableFamilies: string[]; producedFamilies: string[]; producedTypes: string[]; componentIndices: number[]; verdict: Verdict; checks: Record<'C1'|'C2'|'C3'|'C4'|'C5'|'C6'|'C7',Check>; failedChecks: string[]; split: boolean; splitAllowed: boolean; merged: boolean; ignored: boolean; structuralErrors: string[] }
export interface V2Sheet {version:2;page:string;heldOut?:boolean;snapshotSha256:string;proposalSha256:string;blocks?:Block[];familySet:string;entries:Array<{blockId:string;order:number;status:string;label:Record<string,unknown>}>}
const hasDispute=(value:unknown):boolean=>!!value&&typeof value==='object'&&(('disputed' in value&&value.disputed===true)||Object.values(value).some(hasDispute))
const familyName=(type:string,families:FamilySet)=>families.entries.some(entry=>entry.type===type)?type:familyOf(type,families)
const includesText=containsPhrase
const HEADING_KEYS=new Set(['title','heading','headline','subheading','subtitle','eyebrow','name','question'])
const lastKey=(field:Field)=>field.path.split('.').pop()!.replace(/\[\d+\]/g,'')
const phrasePresent=(values:string[],needle:string)=>values.some(value=>includesText(value,needle))
type HtmlNode={tagName?:string;value?:string;childNodes?:HtmlNode[]}
const htmlHeadings=(value:string):string[]=>{
  const text=(node:HtmlNode):string=>node.value|| (node.childNodes||[]).map(text).join(' ')
  const visit=(node:HtmlNode):string[]=>[...(/^h[1-6]$/.test(node.tagName||'')?[normalizeText(text(node))]:[]),...(node.childNodes||[]).flatMap(visit)]
  return visit(parseFragment(value) as HtmlNode).filter(Boolean)
}
function resourcesFor(components:Component[],blocks:Block[],baseUrl:string) {
  const evidence=extractPageEvidence('',baseUrl)
  evidence.images=blocks.flatMap(b=>b.images.map(url=>({url,region:b.region})))
  return componentResources(componentStrings(components),evidence)
}
export function matchComponents(blocks: Block[], components: Component[], baseUrl: string) {
  const matches=components.map((component,index)=>{
    const fields=componentStrings([component]),resources=resourcesFor([component],blocks,baseUrl)
    const candidates=blocks.map((block,blockIndex)=>{
      const coverage=measureTextKept(block.text?[{text:block.text,region:block.region}]:[],fields)
      const images=block.images.filter(url=>resources.images.some(r=>r.url===url)),links=block.links.filter(url=>resources.links.some(r=>r.url===url))
      const matchedShingles=coverage.shingles.numerator,totalShingles=coverage.shingles.denominator
      const outputShingles=[...new Set(fields.filter(f=>isHumanText(f,1)).flatMap(f=>wordShingles(f.value)))]
      const sharedOutputShingles=outputShingles.filter(shingle=>includesText(block.text,shingle)).length
      return {blockIndex,blockId:block.id,matchedShingles,totalShingles,textCoverage:coverage.shingles.share,images,links,sharedOutputShingles,strength:Math.max(matchedShingles,sharedOutputShingles)+images.length+links.length}
    })
    const ranked=candidates.filter(c=>c.strength>0).sort((a,b)=>b.strength-a.strength||a.blockIndex-b.blockIndex)
    const primary=ranked[0]??null
    // A secondary block needs substantial text coverage, or image evidence in a textless block.
    // A shared navigation URL alone cannot prove that two blocks were merged.
    const spanning=ranked.filter(c=>c.blockIndex!==primary?.blockIndex && (c.totalShingles>0 ? (c.textCoverage??0)>=TEXT_COVERAGE_THRESHOLD : c.images.length>0))
    return {componentIndex:index,primaryBlockId:primary?.blockId??null,tiedBlockIds:primary?ranked.filter(c=>c.strength===primary.strength).map(c=>c.blockId):[],candidates,blockIds:primary?[primary.blockId,...spanning.map(c=>c.blockId)]:[]}
  })
  return {matches,extra:matches.filter(m=>!m.primaryBlockId).map(m=>m.componentIndex),merged:matches.filter(m=>m.blockIds.length>1).map(m=>({componentIndex:m.componentIndex,blockIds:m.blockIds}))}
}
export function countItems(components: Component[], itemKind: string | null): { count: number | null; paths: string[]; reason: string } {
  if(!itemKind&&!components.some(component=>Object.hasOwn(familySchemas,component.type)&&Array.isArray((component.content as any)?.items)))return {count:null,paths:[],reason:'No collection specified'}
  const aliases:Record<string,string[]>= {card:['cards'],cards:['cards'],post:['posts','items','articles'],posts:['posts','items','articles'],article:['articles','posts','items'],articles:['articles','posts','items'],news:['items','articles','posts'],slide:['slides'],slides:['slides'],link:['links','items'],links:['links','items'],item:['items'],items:['items'],testimonial:['testimonials','items'],testimonials:['testimonials','items'],logo:['logos','items'],logos:['logos','items'],feature:['features','items'],features:['features','items']}
  const keys=itemKind ? aliases[itemKind.toLowerCase()]||[itemKind] : []
  const candidates:Array<{length:number;path:string;component:number}>=[]
  components.forEach((component,index)=>{
    if (Object.hasOwn(familySchemas,component.type) && Array.isArray((component.content as any)?.items)) {
      candidates.push({length:(component.content as any).items.length,path:'content.items',component:index})
      return
    }
    const walk=(value:unknown,prefix:string)=>{
      if(!value||typeof value!=='object'||Array.isArray(value))return
      for(const [key,item] of Object.entries(value)) {
        if(['metadata','type','component','id'].includes(key))continue
        if(Array.isArray(item)&&keys.includes(key))candidates.push({length:item.length,path:prefix+'.'+key,component:index})
        else if(!Array.isArray(item))walk(item,prefix+'.'+key)
      }
    }
    walk(component.content,'content');walk(component.props,'props')
  })
  if(new Set(candidates.map(c=>c.component)).size!==candidates.length)return {count:null,paths:candidates.map(c=>c.path),reason:'Ambiguous: more than one matching collection in a component'}
  if(!candidates.length)return {count:null,paths:[],reason:'Collection not found: '+itemKind}
  return {count:candidates.reduce((sum,c)=>sum+c.length,0),paths:candidates.map(c=>c.path),reason:'Counted explicit collections'}
}
const emptyEvidence=(block:Block,baseUrl:string):SourceEvidence=>fallbackEvidence(block,baseUrl,'Saved page evidence was not supplied')
function unionEvidence(evidence:SourceEvidence[]):SourceEvidence {
  return {text:evidence.flatMap(e=>e.text),headings:evidence.flatMap(e=>e.headings),links:evidence.flatMap(e=>e.links),images:evidence.flatMap(e=>e.images),wordCount:evidence.reduce((n,e)=>n+e.wordCount,0),sourceText:evidence.map(e=>e.sourceText).join(' ')}
}
export function checkContent(block:Block,label:FamilyLabel,components:Component[],baseUrl:string,families:FamilySet,source:SourceEvidence=emptyEvidence(block,baseUrl),pageSource=''):BlockScore['checks'] {
  const fields=componentStrings(components), human=fields.filter(field=>isHumanText(field,1))
  const producedFamilies=components.map(c=>familyName(c.type,families))
  const remaining=[...label.familiesInOrder]
  const rightType=label.multiple?producedFamilies.every(name=>{const index=remaining.indexOf(name);if(index<0)return false;remaining.splice(index,1);return true})&&remaining.length===0:producedFamilies.some(name=>label.acceptableFamilies.includes(name))
  const missingRuns=components.length>1?(()=>{
    const words=(value:string)=>normalizeText(value).match(/[\p{L}\p{N}]+/gu)||[]
    const available=new Map<string,number>()
    for(const field of human)for(const word of words(field.value))available.set(word,(available.get(word)||0)+1)
    return source.text.filter(run=>{
      const needed=new Map<string,number>()
      for(const word of words(run.text))needed.set(word,(needed.get(word)||0)+1)
      if([...needed].some(([word,count])=>(available.get(word)||0)<count))return true
      for(const [word,count] of needed)available.set(word,available.get(word)!-count)
      return false
    })
  })():source.text.filter(run=>!components.some(component=>measureTextKept([run],componentStrings([component])).scores[0]?.kept))
  const headingFields=[...fields.filter(f=>HEADING_KEYS.has(lastKey(f))).map(f=>f.value),...fields.filter(f=>/<[a-z][\s\S]*>/i.test(f.value)).flatMap(f=>htmlHeadings(f.value))]
  const missingHeadings=source.headings.filter(h=>!phrasePresent(headingFields,h))
  const resources=componentResources(fields,{...extractPageEvidence('',baseUrl),images:source.images.flatMap(group=>group.addresses.map(url=>({url,region:block.region})))})
  const outputLinks=new Set(resources.links.map(item=>absoluteUrl(item.url,baseUrl,'link')).filter(Boolean))
  const missingLinks=source.links.filter(link=>!outputLinks.has(absoluteUrl(link.url,baseUrl,'link')))
  const humanByComponent=components.map((_,index)=>fields.filter(f=>f.componentIndex===index&&(isHumanText(f,1)||/^\S+@\S+\.\S+$/.test(f.value)||/^\+?[\d\s().-]{3,}$/.test(f.value))).map(f=>normalizeText(f.value)).join(' '))
  const missingLabels=source.links.filter(link=>link.label&&!source.headings.some(h=>normalizeText(h)===normalizeText(link.label))&&!phrasePresent(humanByComponent,link.label))
  const outputImages=new Set(resources.images.map(item=>absoluteUrl(item.url,baseUrl,'image')).filter(Boolean))
  const decorations=new Set((label.decorativeImages||[]).map(address=>absoluteUrl(address,baseUrl,'image')))
  const contentImages=source.images.filter(group=>!group.addresses.some(address=>decorations.has(absoluteUrl(address,baseUrl,'image'))))
  const missingImages=contentImages.filter(group=>!group.addresses.some(address=>outputImages.has(absoluteUrl(address,baseUrl,'image'))))
  const item=countItems(components,label.itemKind)
  const alt=human.filter(f=>lastKey(f).toLowerCase()==='alt'),subject=human.filter(f=>lastKey(f).toLowerCase()!=='alt')
  const notFound=measureTextNotFound(subject,source.sourceText).notFound
  const totalCharacters=subject.reduce((n,f)=>n+normalizeText(f.value).length,0)
  const notFoundCharacters=notFound.reduce((n,f)=>n+normalizeText(f.value).length,0)
  const moved=notFound.filter(f=>pageSource&&measureTextNotFound([f],pageSource).notFound.length===0).map(f=>f.path)
  return {
    C1:{passed:components.length?rightType:false,expected:label.multiple?label.familiesInOrder:label.acceptableFamilies,produced:producedFamilies,detail:components.length?(rightType?'Right family':'Wrong family'):'No matched component'},
    C2:{passed:missingRuns.length===0,expected:source.text.length,produced:source.text.length-missingRuns.length,detail:missingRuns.map(run=>run.text).join('; ')},
    C3:{passed:missingHeadings.length===0,expected:source.headings,produced:source.headings.filter(h=>!missingHeadings.includes(h)),detail:missingHeadings.join('; ')},
    C4:{passed:!missingLinks.length&&!missingLabels.length,expected:source.links,produced:resources.links.map(l=>l.url),detail:`Missing targets: ${missingLinks.map(l=>l.url).join(', ')}; labels: ${missingLabels.map(l=>l.label).join(', ')}`},
    C5:{passed:missingImages.length===0,expected:contentImages,produced:resources.images.map(i=>i.url),detail:`Missing ${missingImages.length} of ${contentImages.length} groups`},
    C6:{passed:label.itemCount===null||item.count===null?null:item.count===label.itemCount,expected:label.itemCount,produced:item.count,detail:label.itemCount!==null&&item.count===null?'structure-unknown: '+item.reason:item.reason,structureUnknown:label.itemCount!==null&&item.count===null},
    C7:{passed:totalCharacters?notFoundCharacters/totalCharacters<=0.05:true,expected:{maximumShare:0.05},produced:{notFoundCharacters,totalCharacters,altExemptCharacters:alt.reduce((n,f)=>n+normalizeText(f.value).length,0),moved},detail:notFound.map(f=>f.path).join(', ')}
  }
}
export function scoreSheet(sheet:V2Sheet,components:Component[],baseUrl:string,options:{families:FamilySet;blocks:Block[];evidence?:SourceEvidence[];pageSource?:string;allMissed?:boolean}) {
  if(sheet?.version!==2||!Array.isArray(sheet.entries))throw new Error('Expected a version-2 answer sheet (answer-sheet-v2.json); version-1 sheets cannot be scored')
  if(sheet.familySet!==options.families.set)throw new Error('Answer sheet and scoring family sets differ')
  if(!Array.isArray(components)||components.some(c=>!c||typeof c.type!=='string'))throw new Error('Expected a JSON array of components, each with a string type')
  components.forEach(c=>familyName(c.type,options.families))
  if(sheet.entries.length!==options.blocks.length||sheet.entries.some((entry,index)=>entry.blockId!==options.blocks[index].id))throw new Error('Version-2 answer sheet and block proposal differ')
  const matching=matchComponents(options.blocks,options.allMissed?[]:components,baseUrl)
  const rows:BlockScore[]=sheet.entries.map((entry,index)=>{
    const block=options.blocks[index]
    const indices=matching.matches.filter(m=>m.blockIds.includes(block.id)).map(m=>m.componentIndex)
    const produced=indices.map(i=>components[i]),types=produced.map(c=>c.type),mapped=types.map(type=>familyName(type,options.families))
    const unsettled=hasDispute(entry.label)
    if(!unsettled&&(!entry.label||typeof entry.label!=='object'))throw new Error('Missing version-2 label: '+block.id)
    const label=entry.label as unknown as FamilyLabel
    const blockIds=new Set(indices.flatMap(i=>matching.matches[i].blockIds))
    const source=unionEvidence(options.blocks.filter(b=>blockIds.has(b.id)||b.id===block.id).map(b=>options.evidence?.[options.blocks.indexOf(b)]||emptyEvidence(b,baseUrl)))
    const checks=unsettled?Object.fromEntries(['C1','C2','C3','C4','C5','C6','C7'].map(name=>[name,{passed:null,expected:null,produced:null,detail:'Unsettled label'}])) as BlockScore['checks']:checkContent(block,label,produced,baseUrl,options.families,source,options.pageSource)
    if(!unsettled&&(!indices.length||label.ignore))for(const check of Object.values(checks)){check.passed=null;check.structureUnknown=false;check.detail=label.ignore?'Ignored block':'No matched component'}
    const failedChecks=Object.entries(checks).filter(([,check])=>check.passed===false).map(([name])=>name)
    const verdict:Verdict=unsettled?'unsettled':label.ignore?(indices.length?'should have been ignored':'correct'):!indices.length?'missed':checks.C1.passed===false?'wrong type':failedChecks.length?'right type, content incomplete':'correct'
    const merged=matching.merged.some(m=>m.blockIds.includes(block.id))
    return {acceptableFamilies:unsettled?[]:label.multiple?label.familiesInOrder:label.acceptableFamilies,producedFamilies:mapped,id:block.id,order:block.order,description:(block.headings[0]||block.text||block.region).slice(0,100),producedTypes:types,componentIndices:indices,verdict,checks,failedChecks,split:indices.length>1,splitAllowed:unsettled?false:indices.length>1&&checks.C1.passed===true,merged,ignored:unsettled?false:label.ignore,structuralErrors:[...(merged?['Component spans multiple blocks']:[])]}
  })
  const scored=rows.filter(r=>!r.ignored&&r.verdict!=='unsettled')
  return {version:6,page:sheet.page,itemCountMismatches:scored.filter(r=>r.checks.C6.passed===false).map(r=>({id:r.id,expected:r.checks.C6.expected,produced:r.checks.C6.produced})),answerSheetSha256:sha(sheet),reviewedBlocks:sheet.entries.length,scoredBlocks:scored.length,unsettledBlocks:rows.filter(r=>r.verdict==='unsettled').length,accuracy:{correct:scored.filter(r=>r.verdict==='correct').length,total:scored.length},unreviewedBlocks:0,totalBlocks:sheet.entries.length,rows,counts:Object.fromEntries(verdicts.map(v=>[v,rows.filter(r=>r.verdict===v).length])),...matching,
    unreviewedComponents:[],issues:[...(options.evidence||[]).flatMap(e=>e.issue?[e.issue]:[]),...matching.matches.filter(m=>m.tiedBlockIds.length>1).map(m=>'Component '+m.componentIndex+' has tied content matches: '+m.tiedBlockIds.join(', ')+'; primary uses document order')]}
}
