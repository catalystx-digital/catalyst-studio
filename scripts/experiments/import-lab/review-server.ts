import fs from 'node:fs/promises'
import path from 'node:path'
import http from 'node:http'
import { createRequire } from 'node:module'
import sharp from 'sharp'
import { dataRoot, main } from './storage'
import { argumentsForPhase2, atomicJson, directories, familyBlockSource, labelDirectory, optionalJson, sha, slug, type Block, type Proposal, type FamilyDraftSheet } from './labels'
import { componentRegion, componentResources, extractPageEvidence, normalizeText, absoluteUrl, type Component, type Field as ComponentField } from './metrics'
const { parseFragment } = createRequire(__filename)('parse5') as typeof import('parse5')
type HtmlNode = {nodeName?:string;tagName?:string;value?:string;attrs?:Array<{name:string;value:string}>;childNodes?:HtmlNode[]}

type Queue = 'disputes'|'sample'|'stick'
type Field = 'family'|'acceptableFamilies'|'multiple'|'familiesInOrder'|'placement'|'ignore'|'ignoreReason'|'itemCount'|'itemKind'|'decorativeImages'
type Dispute = {disputed:true;a:unknown;b:unknown;c?:unknown}
type Entry = {blockId:string;order:number;status:string;reviewedBy?:string;label:Record<string,unknown>;history?:Array<{field:string;chosen:unknown;losingOptions:unknown[];at:string;queue?:'disputes'|'sample'}>}
type Sheet = {version:2;page:string;heldOut:boolean;familySet:string;familyNames?:string[];labellers?:{a?:{out:string}};entries:Entry[];[key:string]:unknown}
type ScoreRow = {id:string;verdict:string;ignored?:boolean;componentIndices?:number[]}
type Candidate = {page:string;blockId:string;sheet:Sheet;entry:Entry;block:Block;revision:string;row?:ScoreRow}
type ReviewRecord = {page:string;blockId:string;answer:'right'|'wrong';time:string;correction?:string;stickVerdict?:string;arm?:string;run?:string}
type Options = {arm?:string;run?:string;round?:1|2}
const fields:Field[]=['family','acceptableFamilies','multiple','familiesInOrder','placement','ignore','ignoreReason','itemCount','itemKind','decorativeImages']
const kindNames:Record<string,string>={'site-header':'Top menu','site-footer':'Bottom of page','local-nav':'Page menu',hero:'Opening banner',content:'Text section',collection:'Repeated items (cards, posts, people)','logo-strip':'Logo row',stats:'Key numbers',testimonials:'Quotes and reviews',pricing:'Prices and plans',disclosure:'Expandable content (accordion or tabs)',cta:'Call to action',form:'Form',table:'Table or chart',media:'Pictures, video or map',navigation:'Menu',footer:'Bottom of page',split:'Side by side section',cards:'Cards',feed:'Updates',text:'Text',statistics:'Key numbers',logos:'Logos',tables:'Tables',article:'Article',contact:'Contact details',timeline:'Timeline',section:'Section'}
const fieldNames:Record<Field,string>={family:'section kind',acceptableFamilies:'allowed section kinds',multiple:'more than one section',familiesInOrder:'section kinds from top to bottom',placement:'where it sits',ignore:'skip this section',ignoreReason:'reason for skipping',itemCount:'number of items',itemKind:'type of item',decorativeImages:'decoration images'}
const placeNames:Record<string,string>={header:'Top',main:'Main area',sidebar:'Side',footer:'Bottom'}
const kindName=(value:unknown)=>value===null?'None':kindNames[String(value)]||String(value).replace(/[-_]/g,' ')
const readable=(field:Field,value:unknown):string=>Array.isArray(value)?value.length?value.map(part=>readable(field,part)).join(', '):'None':value===null||value===''?'None':typeof value==='boolean'?value?'Yes':'No':field==='family'||field==='acceptableFamilies'||field==='familiesInOrder'?kindName(value):field==='placement'?placeNames[String(value)]||String(value):field==='itemKind'?kindName(value):String(value)
const isDispute=(value:unknown):value is Dispute=>!!value&&typeof value==='object'&&!Array.isArray(value)&&(value as Dispute).disputed===true
const disputedFields=(entry:Entry)=>fields.filter(field=>isDispute(entry.label[field]))
const same=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b)
const recordFile=(queue:'sample'|'stick',round:1|2=1)=>path.join(dataRoot(),'labels',(queue==='sample'?'review-sample':'stick-check')+(round===2?'-round2':'')+'.json')
const readRecords=async(queue:'sample'|'stick',options:Options={})=>{
  const all=(await optionalJson<ReviewRecord[]>(recordFile(queue,options.round)))||[]
  return queue==='stick'?all.filter(record=>record.arm===(options.arm||'blocks-production')&&record.run===(options.run||'')):all
}
const rank=(seed:string,item:Candidate)=>sha(seed+'|'+item.page+'/'+item.blockId)
const shuffle=(items:Candidate[],seed:string)=>items.sort((a,b)=>rank(seed,a).localeCompare(rank(seed,b)))
const minutes=(count:number)=>Math.ceil(count/3)
const namesFor=(sheet:Sheet):string[]=>{
  if(sheet.familyNames)return sheet.familyNames
  const catalog=require('./component-families.json') as {sets:Record<string,Record<string,unknown>>}
  const names=Object.keys(catalog.sets[sheet.familySet]||{})
  if(!names.length)throw new Error('Unknown family set')
  return names
}
async function sheetSources() {
  const sources:Array<{page:string;sheet:Sheet;proposal:Proposal;revision:string}>=[]
  for(const page of await directories(path.join(dataRoot(),'labels'))) {
    const sheet=await optionalJson<Sheet>(path.join(labelDirectory(page),'answer-sheet-v2.json'))
    if(!sheet)continue
    if(sheet.version!==2||sheet.page!==page||!Array.isArray(sheet.entries))throw new Error('Invalid version-2 answer sheet')
    const proposal=await familyBlockSource(page)
    if(sheet.snapshotSha256&&sheet.snapshotSha256!==proposal.snapshotSha256||sheet.proposalSha256&&sheet.proposalSha256!==sha(proposal))throw new Error('Review sheet differs from source blocks')
    sources.push({page,sheet,proposal,revision:sha(sheet)})
  }
  return sources
}
function makeCandidate(source:Awaited<ReturnType<typeof sheetSources>>[number],entry:Entry):Candidate {
  const block=source.proposal.blocks.find(block=>block.id===entry.blockId)
    if(!block)throw new Error('Review item is missing from the saved source blocks')
  return {page:source.page,blockId:entry.blockId,sheet:source.sheet,entry,block,revision:source.revision}
}
async function latestScore(page:string,arm:string,run:string) {
  if(!run)return null
  const folder=path.join(labelDirectory(page),'scores-stick'),prefix=arm+'--'+run+'--stick'
  let files:string[]
  try{files=(await fs.readdir(folder)).filter(name=>name.startsWith(prefix)&&name.endsWith('.json'))}
  catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')return null;throw error}
  const dated=await Promise.all(files.map(async name=>({name,date:(await fs.stat(path.join(folder,name))).mtimeMs})))
  dated.sort((a,b)=>b.date-a.date||b.name.localeCompare(a.name))
  return dated[0]?optionalJson<{rows:ScoreRow[]}>(path.join(folder,dated[0].name)):null
}
async function selections(options:Options) {
  const disputes:Candidate[]=[],sample:Candidate[]=[],stick:Candidate[]=[]
  let disputeDone=0
  for(const source of await sheetSources()) {
    for(const entry of source.sheet.entries) {
      const item=makeCandidate(source,entry)
      if(disputedFields(entry).length)disputes.push(item)
      else if(source.sheet.heldOut&&entry.label.ignore!==true&&(entry.status==='agreed'||entry.history?.some(change=>change.queue==='sample')))sample.push(item)
      if(!disputedFields(entry).length&&entry.history?.some(change=>change.queue==='disputes'))disputeDone++
    }
    if(source.sheet.heldOut)continue
    const score=await latestScore(source.page,options.arm||'blocks-production',options.run||'')
    if(!score)continue
    const componentFile=path.join(dataRoot(),'arms',source.page,slug(options.arm||'blocks-production'),slug(options.run||''),'components.json')
    if(!await optionalJson<unknown[]>(componentFile))continue
    for(const row of score.rows||[]) {
      const entry=source.sheet.entries.find(entry=>entry.blockId===row.id)
      if(entry&&entry.label.ignore!==true&&!row.ignored)stick.push({...makeCandidate(source,entry),row})
    }
  }
  disputes.sort((a,b)=>Number(b.sheet.heldOut)-Number(a.sheet.heldOut)||a.page.localeCompare(b.page)||a.entry.order-b.entry.order)
  const stickSeed='stick-v1|'+(options.arm||'blocks-production')+'|'+(options.run||'')
  const firstSample=shuffle([...sample],'sample-v1').slice(0,30),firstStick=shuffle([...stick],stickSeed).slice(0,30)
  if(options.round!==2)return {disputes,disputeDone,sample:firstSample,stick:firstStick}
  const [sampleRecords,stickRecords]=await Promise.all([readRecords('sample',{round:1}),optionalJson<ReviewRecord[]>(recordFile('stick',1)).then(records=>records||[])])
  const used=(items:Candidate[],records:ReviewRecord[])=>new Set([...(records.length>=30?[]:items.map(item=>item.page+'/'+item.blockId)),...records.map(record=>record.page+'/'+record.blockId)])
  const sampleUsed=used(firstSample,sampleRecords),stickUsed=used(firstStick,stickRecords)
  return {disputes,disputeDone,sample:shuffle(sample.filter(item=>!sampleUsed.has(item.page+'/'+item.blockId)),'sample-v2').slice(0,30),stick:shuffle(stick.filter(item=>!stickUsed.has(item.page+'/'+item.blockId)),'stick-v2|'+(options.arm||'blocks-production')+'|'+(options.run||'')).slice(0,30)}
}
function choices(entry:Entry,decorationGroups:Array<{number:number;addresses:string[]}> = []) {
  const fields=disputedFields(entry),result:Array<{id:string;label:string;values:Record<string,unknown>;decorationNumbers:number[]}>=[]
  for(const source of ['a','b','c'] as const) {
    const values:Record<string,unknown>={}
    for(const field of fields) {
      const option=entry.label[field] as Dispute
      if(source in option)values[field]=option[source]
    }
    if(Object.keys(values).length!==fields.length||result.some(choice=>same(choice.values,values)))continue
    const family=kindName('family' in values?values.family:entry.label.family)
    const decorationNumbers=Array.isArray(values.decorativeImages)?decorationGroups.filter(group=>group.addresses.some(address=>(values.decorativeImages as string[]).includes(address))).map(group=>group.number):[]
    const details=[
      ...fields.filter(field=>field!=='family'&&field!=='decorativeImages').map(field=>fieldNames[field]+': '+readable(field,values[field])),
      values.decorativeImages!==undefined?'decoration images: '+(decorationNumbers.length?decorationNumbers.map(number=>'Image '+number).join(', '):'None'):null
    ].filter(Boolean)
    result.push({id:'option-'+result.length,label:family+(details.length?' · '+details.join(' · '):''),values,decorationNumbers})
  }
  return result
}
function importedContents(components:Component[],indices:number[],baseUrl:string) {
  const selected=indices.filter(index=>Number.isInteger(index)&&index>=0&&index<components.length).map(index=>components[index])
  const fields:ComponentField[]=[]
  selected.forEach((component,componentIndex)=>{
    const walk=(value:unknown,fieldPath:string):void=>{
      if(typeof value==='string'||typeof value==='number')fields.push({value:String(value),path:fieldPath,componentType:component.type,componentIndex,region:componentRegion(component)})
      else if(Array.isArray(value))value.forEach((item,index)=>walk(item,fieldPath+'['+index+']'))
      else if(value&&typeof value==='object')Object.entries(value).forEach(([key,item])=>walk(item,fieldPath+'.'+key))
    }
    for(const [key,value] of Object.entries(component))if(!['type','component','id','location'].includes(key))walk(value,key)
  })
  const evidence=extractPageEvidence('',baseUrl),resources=componentResources(fields,evidence)
  const headings:string[]=[],paragraphs:string[]=[],links:Array<{label:string;target:string}>=[]
  const add=(list:string[],value:string)=>{const clean=normalizeText(value);if(clean&&!list.includes(clean))list.push(clean)}
  const displayLink=(value:string)=>{
    if(!absoluteUrl(value,baseUrl,'link'))return null
    return new URL(value,baseUrl).href
  }
  const addLink=(label:string,value:string)=>{
    const target=displayLink(value)
    if(!target)return
    const clean=label.replace(/\s+/g,' ').trim()||target
    if(!links.some(link=>link.label===clean&&link.target===target))links.push({label:clean,target})
  }
  const htmlText=(node:HtmlNode):string=>['script','style','template','noscript'].includes(node.tagName||'')?'':node.nodeName==='#text'?node.value||'':(node.childNodes||[]).map(htmlText).join(' ')
  for(const field of fields){
    const key=field.path.split('.').pop()!.replace(/\[\d+\]/g,''),html=/<[a-z][\s\S]*>/i.test(field.value)
    if(html){
      const parsed=extractPageEvidence(field.value,baseUrl)
      const walk=(node:HtmlNode)=>{
        if(['script','style','template','noscript'].includes(node.tagName||''))return
        if(/^h[1-6]$/.test(node.tagName||''))add(headings,htmlText(node))
        if(node.tagName==='a'){
          const href=node.attrs?.find(attr=>attr.name==='href')?.value
          if(href)addLink(htmlText(node),href)
        }
        node.childNodes?.forEach(walk)
      }
      walk(parseFragment(field.value) as HtmlNode)
      add(paragraphs,parsed.visibleText.join(' '))
    }else if(/^(heading|headline|title|subheading|h[1-6])$/i.test(key))add(headings,field.value)
    else if(!/^(?:id|type|component|variant|layout|size|align|alignment|position|region|location|confidence|class|className|classes|color|style|theme|icon|font|fontFamily|weight|target|rel|mediaType|url|href|src|srcset|path|originalUrl|canonicalUrl)$/i.test(key)&&!/^(?:https?:|mailto:|tel:|data:|\/|#)/i.test(field.value))add(paragraphs,field.value)
  }
  for(const field of fields){
    const key=field.path.split('.').pop()!.replace(/\[\d+\]/g,'')
    if(!/^(label|text|title)$/i.test(key))continue
    const prefix=field.path.slice(0,field.path.lastIndexOf('.'))
    const target=fields.find(candidate=>candidate.componentIndex===field.componentIndex&&candidate.path.startsWith(prefix+'.')&&/^(?:href|url|link|action|path|link\.url|action\.url)$/i.test(candidate.path.slice(prefix.length+1)))
    if(target)addLink(field.value,target.value)
  }
  for(const resource of resources.links)if(!links.some(link=>absoluteUrl(link.target,baseUrl,'link')===resource.url))links.push({label:resource.url,target:resource.url})
  return {headings,text:paragraphs.join(' '),images:resources.images.map(resource=>resource.url),links}
}
async function decorationGroups(item:Candidate){
  const out=item.sheet.labellers?.a?.out
  const draft=out?await optionalJson<FamilyDraftSheet>(path.join(labelDirectory(item.page),'label-'+slug(out)+'.json')):null
  const groups=draft?.entries.find(entry=>entry.blockId===item.blockId)?.evidence?.imageGroups||[]
  const addresses=groups.flatMap(group=>group.addresses)
  const options=disputedFields(item.entry).includes('decorativeImages')?item.entry.label.decorativeImages as Dispute:undefined
  for(const value of options?[options.a,options.b,options.c]:[])if(Array.isArray(value))for(const address of value)if(!addresses.includes(address))addresses.push(address)
  const mapped=groups.map((group,index)=>({number:index+1,addresses:group.addresses,thumbnail:group.addresses[0]}))
  for(const address of addresses)if(!mapped.some(group=>group.addresses.includes(address)))mapped.push({number:mapped.length+1,addresses:[address],thumbnail:address})
  return mapped
}
async function payload(item:Candidate,queue:Queue,options:Options) {
  const common={page:item.page,blockId:item.blockId,revision:item.revision,cropUrl:'/crop?page='+encodeURIComponent(item.page)+'&block='+encodeURIComponent(item.blockId),region:item.block.region}
  if(queue==='disputes') {
    const disputed=disputedFields(item.entry)
    const otherFields=Object.fromEntries(disputed.map(field=>{
      const option=item.entry.label[field] as Dispute
      return [field,field==='family'?namesFor(item.sheet):[...new Map(['a','b','c'].filter(key=>key in option).map(key=>{const value=option[key as keyof Dispute];return [JSON.stringify(value),value]})).values()]]
    }))
    const groups=await decorationGroups(item)
    return {...common,fields:disputed.map(field=>({key:field,label:fieldNames[field]})),choices:choices(item.entry,groups).map(({id,label,decorationNumbers})=>({id,label,decorationNumbers})),decorationGroups:groups,familyNames:namesFor(item.sheet).map(name=>({value:name,label:kindName(name)})),currentFamily:isDispute(item.entry.label.family)?null:item.entry.label.family,otherFields}
  }
  if(queue==='sample')return {...common,family:kindName(item.entry.label.family),familyNames:namesFor(item.sheet).map(name=>({value:name,label:kindName(name)})),currentFamily:item.entry.label.family}
  const file=path.join(dataRoot(),'arms',item.page,slug(options.arm||'blocks-production'),slug(options.run||''),'components.json')
  const components=await optionalJson<unknown[]>(file)
  if(!components)throw new Error('The imported result is unavailable')
  return {...common,imported:importedContents(components as Component[],item.row?.componentIndices||[],(await familyBlockSource(item.page)).finalUrl)}
}
function progress(total:number,answered:number) {
  const remaining=Math.max(0,total-answered),batchStart=Math.floor(answered/20)*20
  return {position:remaining?answered-batchStart+1:0,batchSize:Math.min(20,total-batchStart),remaining,total,estimateMinutes:minutes(remaining)}
}
export function reviewSummary(samples:Array<Pick<ReviewRecord,'answer'>>,sticks:Array<Pick<ReviewRecord,'answer'|'stickVerdict'>>) {
  const wrong=samples.filter(record=>record.answer==='wrong').length
  const agree=sticks.filter(record=>(record.stickVerdict==='correct')===(record.answer==='right')).length
  return {sample:{wrong,total:30,answered:samples.length,relabel:wrong>=2,rule:'2 or more wrong: fix labelling instructions and relabel'},stick:{agree,total:30,answered:sticks.length,passes:agree>=28&&sticks.length===30,rule:'28 or more must agree'}}
}
async function getSummary(options:Options) {
  const all=await selections(options),sample=await readRecords('sample',options),stick=await readRecords('stick',options)
  return {round:options.round||1,queues:{disputes:progress(all.disputes.length+all.disputeDone,all.disputeDone),sample:progress(all.sample.length,sample.length),stick:progress(all.stick.length,stick.length)},...reviewSummary(sample,stick)}
}
async function getQueue(queue:Queue,options:Options) {
  const all=await selections(options),items=all[queue],records=queue==='disputes'?[]:await readRecords(queue,options)
  const answered=new Set(records.map(record=>record.page+'/'+record.blockId))
  const pending=queue==='disputes'?items:items.filter(item=>!answered.has(item.page+'/'+item.blockId))
  const done=queue==='disputes'?all.disputeDone:items.length-pending.length
  return {item:pending[0]?await payload(pending[0],queue,options):null,progress:progress(items.length+(queue==='disputes'?all.disputeDone:0),done)}
}
function resolveDispute(item:Candidate,body:any) {
  const entry=item.entry,disputed=disputedFields(entry)
  const values=body.choiceId==='other'?body.values:choices(entry).find(choice=>choice.id===body.choiceId)?.values
  if(!values||typeof values!=='object')throw new Error('Choose an answer')
  if(body.choiceId==='other'&&typeof values.family==='string'&&!namesFor(item.sheet).includes(values.family))throw new Error('Choose a listed section kind')
  for(const field of disputed) {
    const value=(values as Record<string,unknown>)[field],option=entry.label[field] as Dispute
    if(value===undefined)throw new Error('Choose an answer for every highlighted detail')
    if(field==='family'&&value!==null&&!namesFor(item.sheet).includes(String(value)))throw new Error('Choose a listed section kind')
    if(field==='itemCount'&&value!==null&&(!Number.isInteger(value)||Number(value)<0))throw new Error('Enter a whole number of items, or leave it blank')
    if(field==='placement'&&!['header','main','sidebar','footer'].includes(String(value)))throw new Error('Choose where this section sits')
    if(['acceptableFamilies','familiesInOrder'].includes(field)&&(!Array.isArray(value)||value.some(name=>!namesFor(item.sheet).includes(String(name)))))throw new Error('Choose listed section kinds')
    if(['multiple','ignore'].includes(field)&&typeof value!=='boolean')throw new Error('Choose Yes or No')
    if(['ignoreReason','itemKind'].includes(field)&&value!==null&&typeof value!=='string')throw new Error('Enter a short description')
    if(field==='decorativeImages'&&(!Array.isArray(value)||value.some(address=>typeof address!=='string')))throw new Error('Choose decoration images shown below')
    entry.history??=[]
    entry.history.push({field,chosen:value,losingOptions:[option.a,option.b,...('c' in option?[option.c]:[])].filter(other=>!same(other,value)),at:new Date().toISOString(),queue:'disputes'})
    entry.label[field]=value
  }
  if(body.choiceId==='other'&&typeof values.family==='string'&&!disputed.includes('family')&&values.family!==entry.label.family){
    entry.history??=[]
    entry.history.push({field:'family',chosen:values.family,losingOptions:[entry.label.family],at:new Date().toISOString(),queue:'disputes'})
    entry.label.family=values.family
  }
  const family=entry.label.family,acceptable=entry.label.acceptableFamilies
  if(typeof family==='string'&&Array.isArray(acceptable)&&!acceptable.includes(family))entry.label.acceptableFamilies=[...acceptable,family]
  if(!disputedFields(entry).length){entry.status='reviewed';entry.reviewedBy='founder'}
}
async function saveAnswer(queue:Queue,body:any,options:Options) {
  const source=(await sheetSources()).find(source=>source.page===body.page)
  if(source&&body.revision!==source.revision)return {status:409,value:{error:'This page changed in another tab. Reload before saving.'}}
  const all=await selections(options),item=all[queue].find(item=>item.page===body.page&&item.blockId===body.blockId)
  if(!item)throw new Error('This item is no longer waiting. Reload the page.')
  if(queue==='disputes') {
    resolveDispute(item,body)
    await atomicJson(path.join(labelDirectory(item.page),'answer-sheet-v2.json'),item.sheet)
  }else{
    const records=(await optionalJson<ReviewRecord[]>(recordFile(queue,options.round)))||[]
    if(records.some(record=>record.page===item.page&&record.blockId===item.blockId&&(queue==='sample'||record.arm===(options.arm||'blocks-production')&&record.run===(options.run||''))))return {status:409,value:{error:'Already answered. Reload to continue.'}}
    if(body.answer!=='right'&&body.answer!=='wrong')throw new Error('Choose Right or Wrong')
    if(queue==='sample'&&body.answer==='wrong') {
      if(typeof body.correction!=='string'||!namesFor(item.sheet).includes(body.correction))throw new Error('Choose a listed section kind')
      item.entry.history??=[]
      item.entry.history.push({field:'family',chosen:body.correction,losingOptions:[item.entry.label.family],at:new Date().toISOString(),queue:'sample'})
      item.entry.label.family=body.correction
      const acceptable=item.entry.label.acceptableFamilies
      if(Array.isArray(acceptable)&&!acceptable.includes(body.correction))item.entry.label.acceptableFamilies=[...acceptable,body.correction]
      item.entry.status='reviewed';item.entry.reviewedBy='founder'
      await atomicJson(path.join(labelDirectory(item.page),'answer-sheet-v2.json'),item.sheet)
    }
    records.push({page:item.page,blockId:item.blockId,answer:body.answer,time:new Date().toISOString(),...(queue==='sample'&&body.answer==='wrong'?{correction:body.correction}:{}),...(queue==='stick'?{stickVerdict:item.row!.verdict,arm:options.arm||'blocks-production',run:options.run||''}:{})})
    await atomicJson(recordFile(queue,options.round),records)
  }
  return {status:200,value:await getQueue(queue,options)}
}
function parseQueue(value:unknown):Queue {
  if(value==='disputes'||value==='sample'||value==='stick')return value
  throw new Error('Unknown queue')
}
export async function startReviewServer(port=4777,options:Options={}) {
  if(!Number.isInteger(port)||port<0||port>65535)throw new Error('Invalid port')
  if(options.round!==undefined&&options.round!==1&&options.round!==2)throw new Error('Review round must be 1 or 2')
  if(options.arm)slug(options.arm)
  if(options.run)slug(options.run)
  let writes=Promise.resolve()
  const server=http.createServer(async(req,res)=>{
    const json=(status:number,value:unknown)=>{res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store'});res.end(JSON.stringify(value))}
    try{
      const address=server.address(),actualPort=typeof address==='object'&&address?address.port:port,host='127.0.0.1:'+actualPort
      if(req.headers.host!==host){json(403,{error:'Use the 127.0.0.1 review address'});return}
      const url=new URL(req.url||'/','http://'+host)
      if(req.method==='GET'&&url.pathname==='/'){res.writeHead(200,{'content-type':'text/html; charset=utf-8','content-security-policy':"default-src 'self'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src 'self' https: data:; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'"});res.end(await fs.readFile(path.join(__dirname,'review.html')));return}
      if(req.method==='GET'&&url.pathname==='/api/summary'){json(200,await getSummary(options));return}
      if(req.method==='GET'&&url.pathname==='/api/queue'){json(200,await getQueue(parseQueue(url.searchParams.get('queue')),options));return}
      if(req.method==='GET'&&url.pathname==='/crop'){
        const page=slug(url.searchParams.get('page')||''),id=url.searchParams.get('block')||''
        const proposal=await familyBlockSource(page)
        const block=proposal.blocks.find(block=>block.id===id)
        if(!block)throw new Error('Source picture unavailable. Reload the page.')
        const file=path.join(labelDirectory(page),'screenshot.png'),metadata=await sharp(file).metadata()
        const left=Math.max(0,Math.floor(block.box.x)),top=Math.max(0,Math.floor(block.box.y))
        const width=Math.min(metadata.width!-left,Math.max(1,Math.ceil(block.box.width))),height=Math.min(metadata.height!-top,Math.max(1,Math.ceil(block.box.height)))
        if(width<1||height<1)throw new Error('Source picture unavailable. Reload the page.')
        res.writeHead(200,{'content-type':'image/png','cache-control':'no-store'})
        res.end(await sharp(file).extract({left,top,width,height}).png().toBuffer());return
      }
      if(req.method==='POST'&&url.pathname==='/api/answer'){
        if(req.headers.origin&&req.headers.origin!=='http://'+host){console.error('Review request rejected: Cross-origin write',req.headers.origin);json(403,{error:'Open this review at the address shown when it started, then try again.'});return}
        if(!req.headers['content-type']?.startsWith('application/json')){console.error('Review request rejected: expected application/json');json(415,{error:'This answer could not be sent. Reload the review page and try again.'});return}
        let raw='';for await(const chunk of req){raw+=chunk;if(Buffer.byteLength(raw)>1024*1024)throw new Error('Review request too large')}
        const body=JSON.parse(raw),queue=parseQueue(body.queue)
        slug(body.page||'')
        const job=writes.then(()=>saveAnswer(queue,body,options))
        writes=job.then(()=>undefined,()=>undefined)
        const result=await job;json(result.status,result.value);return
      }
      json(404,{error:'Not found'})
    }catch(error){console.error('Review request failed:',error);if(!res.headersSent){const message=error instanceof Error?error.message:'';json(400,{error:/^(Choose |Enter |This item|Already answered|Source picture|The imported result|Review request too large|Use the )/.test(message)?message:'Could not load this review item. Reload the page and try again.'})}else res.end()}
  })
  await new Promise<void>((resolve,reject)=>{const failed=(error:NodeJS.ErrnoException)=>reject(error.code==='EADDRINUSE'?new Error('Port '+port+' is already in use. Choose another --port.'):error);server.once('error',failed);server.listen(port,'127.0.0.1',()=>{server.off('error',failed);resolve()})})
  const address=server.address();console.log('Review: http://127.0.0.1:'+(typeof address==='object'&&address?address.port:port))
  return server
}
if(require.main===module)main(async()=>{const a=argumentsForPhase2(['--port','--arm','--run','--round']);await startReviewServer(Number(a['--port']||4777),{arm:a['--arm'],run:a['--run'],round:a['--round']?Number(a['--round']) as 1|2:1})})
