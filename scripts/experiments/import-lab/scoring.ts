import { componentStrings, componentResources, extractPageEvidence, isHumanText, measureTextKept, normalizeText, wordShingles, TEXT_COVERAGE_THRESHOLD, type Component, type Field } from './metrics'
import { familyOf, acceptableFamilies, type FamilySet } from './families'
import { sha, type Block, type Entry, type Sheet } from './labels'
const verdicts=['correct','right type, content incomplete','wrong type','missed','should have been ignored'] as const
type Verdict=typeof verdicts[number]
interface Check { passed: boolean | null; expected: unknown; produced: unknown; detail: string }
interface BlockScore { id: string; order: number; description: string; acceptableTypes: string[]; producedTypes: string[]; componentIndices: number[]; verdict: Verdict; checks: Record<'headings'|'itemCount'|'image'|'ctaLabels'|'textCoverage',Check>; failedChecks: string[]; split: boolean; splitAllowed: boolean; merged: boolean; ignored: boolean; structuralErrors: string[] }
const includesText=(haystack:string,needle:string)=>(' '+normalizeText(haystack)+' ').includes(' '+normalizeText(needle)+' ')
function fieldsFor(components: Component[]) {return componentStrings(components).filter(f=>isHumanText(f,1))}
function phrasePresent(fields:Field[],text:string) {return fields.some(f=>includesText(f.value,text))}
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
  if(!itemKind)return {count:null,paths:[],reason:'No collection specified'}
  const aliases:Record<string,string[]>= {card:['cards'],cards:['cards'],post:['posts','items','articles'],posts:['posts','items','articles'],article:['articles','posts','items'],articles:['articles','posts','items'],news:['items','articles','posts'],slide:['slides'],slides:['slides'],link:['links','items'],links:['links','items'],item:['items'],items:['items'],testimonial:['testimonials','items'],testimonials:['testimonials','items'],logo:['logos','items'],logos:['logos','items'],feature:['features','items'],features:['features','items']}
  const keys=aliases[itemKind.toLowerCase()]||[itemKind]
  const candidates:Array<{length:number;path:string;component:number}>=[]
  components.forEach((component,index)=>{
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
export function checkContent(entry: Entry, components: Component[], baseUrl: string): BlockScore['checks'] {
  if(!entry.label)throw new Error('Reviewed block has no label: '+entry.block.id)
  const expected=entry.label.expected,fields=fieldsFor(components),resources=resourcesFor(components,[entry.block],baseUrl)
  const missingHeadings=expected.headings.filter(h=>!phrasePresent(fields,h)),missingCtas=expected.ctaLabels.filter(h=>!phrasePresent(fields,h))
  const item=countItems(components,expected.itemKind),coverage=measureTextKept(entry.block.text?[{text:entry.block.text,region:entry.block.region}]:[],componentStrings(components))
  return {
    headings:{passed:missingHeadings.length===0,expected:expected.headings,produced:expected.headings.filter(h=>!missingHeadings.includes(h)),detail:missingHeadings.length?'Missing: '+missingHeadings.join('; '):'All expected headings present'},
    itemCount:{passed:expected.itemCount===null?null:item.count===expected.itemCount,expected:expected.itemCount,produced:item.count,detail:expected.itemCount===null?'Not requested':item.reason+'; produced '+item.count+', expected '+expected.itemCount+'; '+item.paths.join(', ')},
    image:{passed:expected.hasImage?resources.images.length>0:null,expected:expected.hasImage,produced:resources.images.map(i=>i.url),detail:expected.hasImage?(resources.images.length?'Image present':'Expected image missing'):'Not requested'},
    ctaLabels:{passed:missingCtas.length===0,expected:expected.ctaLabels,produced:expected.ctaLabels.filter(h=>!missingCtas.includes(h)),detail:missingCtas.length?'Missing: '+missingCtas.join('; '):'All expected CTA labels present'},
    textCoverage:{passed:coverage.shingles.denominator?(coverage.shingles.share??0)>=TEXT_COVERAGE_THRESHOLD:null,expected:TEXT_COVERAGE_THRESHOLD,produced:coverage.shingles,detail:coverage.shingles.denominator?coverage.shingles.numerator+'/'+coverage.shingles.denominator+' shingles; requires '+TEXT_COVERAGE_THRESHOLD:'No block text to check'}
  }
}
export function scoreSheet(sheet: Sheet, components: Component[], baseUrl: string, options: {ignoreItemCount?: boolean; families?: FamilySet} = {}) {
  if(!Array.isArray(components)||components.some(c=>!c||typeof c.type!=='string'))throw new Error('Expected a JSON array of components, each with a string type')
  const matching=matchComponents(sheet.entries.map(e=>e.block),components,baseUrl)
  const reviewed=sheet.entries.filter(e=>e.status==='approved'||e.status==='corrected')
  const rows:BlockScore[]=reviewed.map(entry=>{
    if(!entry.label)throw new Error('Reviewed block has no label: '+entry.block.id)
    const indices=matching.matches.filter(m=>m.blockIds.includes(entry.block.id)).map(m=>m.componentIndex),produced=indices.map(i=>components[i]),types=produced.map(c=>c.type),label=entry.label
    const checks=checkContent(entry,produced,baseUrl),failedChecks=Object.entries(checks).filter(([,check])=>check.passed===false).map(([name])=>name)
    const mapType=(type:string)=>options.families?familyOf(type,options.families):type
    const remaining=label.ignore?[]:label.componentTypes.map(mapType)
    const multiCorrect=!label.ignore&&types.every(type=>{const index=remaining.indexOf(mapType(type));if(index<0)return false;remaining.splice(index,1);return true})&&remaining.length===0
    const acceptable=label.ignore?[]:label.acceptableTypes.map(mapType)
    const rightType=label.ignore|| (label.containsMultipleComponents?multiCorrect:types.every(t=>acceptable.includes(mapType(t))))
    const verdictChecks=options.ignoreItemCount?failedChecks.filter(name=>name!=='itemCount'):failedChecks
    const verdict:Verdict=label.ignore?(indices.length?'should have been ignored':'correct'):!indices.length?'missed':!rightType?'wrong type':verdictChecks.length?'right type, content incomplete':'correct'
    if(label.ignore)for(const check of Object.values(checks)){check.passed=null;check.detail='Not checked: block is labelled ignore'}
    return {...(options.families&&!label.ignore?{acceptableFamilies:acceptableFamilies(label.containsMultipleComponents?label.componentTypes:label.acceptableTypes,options.families),producedFamilies:types.map(mapType)}:{}),id:entry.block.id,order:entry.block.order,description:(entry.block.headings[0]||entry.block.text||entry.block.region).slice(0,100),acceptableTypes:label.containsMultipleComponents?label.componentTypes:label.acceptableTypes,producedTypes:types,componentIndices:indices,verdict,checks,failedChecks:label.ignore?[]:failedChecks,split:indices.length>1,splitAllowed:label.containsMultipleComponents,merged:matching.merged.some(m=>m.blockIds.includes(entry.block.id)),ignored:label.ignore,structuralErrors:[...(indices.length>1&&!label.containsMultipleComponents?['Unexpected split']:[]),...(matching.merged.some(m=>m.blockIds.includes(entry.block.id))?['Component spans multiple blocks']:[])]}
  })
  return {version:1,page:sheet.page,ignoreItemCount:!!options.ignoreItemCount,itemCountMismatches:rows.filter(r=>!r.ignored&&r.checks.itemCount.passed===false).map(r=>({id:r.id,expected:r.checks.itemCount.expected,produced:r.checks.itemCount.produced})),answerSheetSha256:sha(sheet),reviewedBlocks:reviewed.length,unreviewedBlocks:sheet.entries.length-reviewed.length,totalBlocks:sheet.entries.length,rows,counts:Object.fromEntries(verdicts.map(v=>[v,rows.filter(r=>r.verdict===v).length])),...matching,
    unreviewedComponents:matching.matches.filter(m=>m.primaryBlockId&&!reviewed.some(e=>e.block.id===m.primaryBlockId)).map(m=>m.componentIndex),
    issues:[...sheet.issues,...matching.matches.filter(m=>m.tiedBlockIds.length>1).map(m=>'Component '+m.componentIndex+' has tied content matches: '+m.tiedBlockIds.join(', ')+'; primary uses document order'),...(reviewed.length<sheet.entries.length?[String(sheet.entries.length-reviewed.length)+' unreviewed blocks excluded from verdicts']:[])]}
}
