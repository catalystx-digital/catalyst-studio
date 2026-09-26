import fs from 'node:fs/promises'
import path from 'node:path'
import { CallRecorder } from './call-recording'
import { blockEvidence, inputEvidence, type SourceEvidence } from './source-evidence'
import { verifyBlock } from './verify'
import { dataRoot, digest, readJson, writeJson } from './storage'
import { validatePages } from './pages'
import { optionalJson, type Block, type Proposal } from './labels'
import { inferLocationFromType, parseSectionDetectionResponse } from '@/lib/studio/import/detection/response-parser'
import { INFRASTRUCTURE_RETRIES, PROVIDER_ERROR_RETRIES, STALL_TIMEOUT_MS, runBlockReply, type BlockReplyState } from '@/lib/studio/import/detection/blocks/block-extract'
import { clampCompletionTokens, DetectionFailureError } from '@/lib/studio/import/web-detection'
import type { ChatCompletion, ChatCompletionMessageParam } from 'openai/resources/chat/completions'
import { familyCatalogueOverride } from './family-fill'
import { runtimeRequire } from './runtime'
import { adapt } from './blocks-production'
import type { Component } from './metrics'

const instruction='Return the same component type with the missing items added; do not change anything else.'
export const repairPromptSha256=digest(instruction+'\nThese items are on the page but missing from your output:\nThis output text is not on the page; remove it or replace it with the page\'s own words:')
type Request={model:string;messages:Array<{role:string;content:string}>;[key:string]:unknown}
type Client=(request:Request,options?:{signal?:AbortSignal;timeout?:number})=>Promise<any>
const missingCount=(result:ReturnType<typeof verifyBlock>)=>result.missing.text.length+result.missing.links.length+result.missing.images.length
const inventedSize=(result:ReturnType<typeof verifyBlock>)=>result.invented.reduce((sum,value)=>sum+value.length,0)

export function repairPrompt(source:SourceEvidence,original:Component[],input:string) {
  const result=verifyBlock(source,original)
  const missing=[
    ...result.missing.text.map(value=>'text: '+value),
    ...result.missing.links.map(link=>'link: '+link.label+' → '+link.url),
    ...result.missing.images.map(group=>'picture: '+group.join(' | '))
  ]
  return [
    'Original section input:',input,
    'Saved component JSON:',JSON.stringify(original),
    'These items are on the page but missing from your output:',missing.length?missing.join('\n'):'(none)',
    "This output text is not on the page; remove it or replace it with the page's own words:",result.invented.length?result.invented.join('\n'):'(none)',
    instruction
  ].join('\n')
}

export async function repairBlock(source:SourceEvidence,original:Component[],options:{request:Request;sectionKey:string;client:Client;parse:(raw:string)=>Component[];allowedTypes?:string[];perRequestMs?:number;stallTimeoutMs?:number;infrastructureRetries?:number;providerErrorRetries?:number;validationRetries?:number}) {
  const before=verifyBlock(source,original)
  if(before.verified)return {decision:'verified' as const,components:original,before,after:before}
  const input=options.request.messages.find(message=>message.role==='user')?.content||''
  const messages=[...options.request.messages.filter((_,index)=>index<3),{role:'user',content:repairPrompt(source,original,input)}] as ChatCompletionMessageParam[]
  const state:BlockReplyState={requestCount:0,rawResponse:'',finishReason:'',stage:'llm_call',repairDebug:{}}
  let candidate:Component[]
  try {
    candidate=await runBlockReply({
      messages,sectionKey:options.sectionKey,allowedTypes:options.allowedTypes??original.map(component=>component.type),state,
      stallTimeoutMs:options.stallTimeoutMs??STALL_TIMEOUT_MS,
      infrastructureRetries:options.infrastructureRetries??INFRASTRUCTURE_RETRIES,
      providerErrorRetries:options.providerErrorRetries??PROVIDER_ERROR_RETRIES,
      validationRetries:options.validationRetries??1,
      createRequest:currentMessages=>({
        ...options.request,
        messages:[...currentMessages] as Request['messages'],
        max_tokens:clampCompletionTokens(options.request.model,currentMessages,Number(options.request.max_tokens))
      }),
      call:(request,signal)=>options.client(request,{signal,timeout:options.perRequestMs}) as Promise<ChatCompletion>,
      validate:options.parse
    })
  } catch(error) {
    if(error instanceof DetectionFailureError&&error.debug.validationPath==='context_budget_exceeded')
      return {decision:'kept' as const,reason:'context_budget_exceeded',components:original,before,after:before}
    if(state.stage==='validation')
      return {decision:'kept' as const,reason:'invalid reply: '+(error instanceof Error?error.message:String(error)),components:original,before,after:before}
    throw error
  }
  const after=verifyBlock(source,candidate)
  const sameTypes=JSON.stringify(candidate.map(c=>c.type))===JSON.stringify(original.map(c=>c.type))
  const kept=sameTypes&&missingCount(after)<missingCount(before)&&inventedSize(after)<=inventedSize(before)
  return {decision:kept?'repaired' as const:'kept' as const,reason:kept?undefined:!sameTypes?'component type changed':missingCount(after)>=missingCount(before)?'missing items did not fall':'invented text rose',components:kept?candidate:original,before,after}
}

type RepairOptions={arm:'blocks-production'|'family-fill';runs:string[];heldOut?:boolean;dryRun?:boolean;yesSpend?:boolean}
type Fixture={client?:Client}
type Section={sectionKey:string;sectionOrder:number;components:Component[];[key:string]:unknown}
const files=async(folder:string)=>{try{return (await fs.readdir(folder)).filter(name=>name.endsWith('.json')).sort()}catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')return [];throw error}}
const count=(items:Section[])=>items.reduce((n,item)=>n+item.components.length,0)

export async function repairRuns(root:string,options:RepairOptions,fixture:Fixture={}) {
  if(!['blocks-production','family-fill'].includes(options.arm)||!options.runs.length)throw new Error('Repair needs blocks-production or family-fill and --runs')
  if(options.dryRun&&options.yesSpend)throw new Error('Choose --dry-run or --yes-spend')
  if(!options.dryRun&&!options.yesSpend)throw new Error('Paid repair calls are blocked. Use --dry-run, then --yes-spend.')
  const manifest=validatePages(await readJson(path.join(root,'pages.json')))
  const pages=Object.keys(manifest).filter(page=>manifest[page].heldOut===!!options.heldOut).sort()
  let checked=0,planned=0,repaired=0,kept=0,cost=0
  for(const page of pages)for(const run of options.runs) {
    const sourceDir=path.join(root,'arms',page,options.arm,run)
    const targetDir=path.join(root,'arms',page,options.arm+'+repair',run)
    if(await optionalJson(path.join(targetDir,'run.json'))||await fs.stat(targetDir).then(()=>true,error=>{if(error.code==='ENOENT')return false;throw error}))throw new Error('Repair run already exists: '+page+'/'+run)
    const record=await readJson<any>(path.join(sourceDir,'run.json'))
    if(record.status==='dry-run'||record.fixture||!['complete','failed'].includes(record.status))throw new Error('Source run is unusable: '+page+'/'+run)
    const confidenceThreshold=record.configuration?.confidence?.detection
    const perRequestMs=record.configuration?.extractionEndpoint?.timeoutMs
    const stallTimeoutMs=record.rules?.stallTimeoutMs
    const infrastructureRetries=record.rules?.infrastructureRetries
    const providerErrorRetries=record.rules?.providerErrorRetries
    const validationRetries=record.rules?.validationRetries
    if(!Number.isFinite(confidenceThreshold)||confidenceThreshold<0||confidenceThreshold>1||!Number.isFinite(perRequestMs)||perRequestMs<=0||!Number.isFinite(stallTimeoutMs)||stallTimeoutMs<=0||!Number.isSafeInteger(infrastructureRetries)||infrastructureRetries<0||!Number.isSafeInteger(providerErrorRetries)||providerErrorRetries<0||!Number.isSafeInteger(validationRetries)||validationRetries<0)throw new Error('Missing or invalid recorded fill settings: '+page+'/'+run)
    const proposal=await readJson<Proposal>(path.join(root,'labels',page,'blocks.json'))
    const geometry=await readJson(path.join(root,'labels',page,'geometry.json'))
    const html=await fs.readFile(path.join(root,'pages',page,'page.html'),'utf8')
    if(record.snapshotSha256&&record.snapshotSha256!==digest(html))throw new Error('Run snapshot checksum differs: '+page+'/'+run)
    const stylesheets=await readJson<string[]>(path.join(root,'pages',page,'stylesheets.json'))
    const original=await readJson<Component[]>(path.join(sourceDir,'components.json'))
    const sections=await optionalJson<Section[]>(path.join(sourceDir,'sections.json'))||[]
    const plan=await readJson<{sections:Array<{sectionKey:string;sectionOrder:number;candidateTypes:string[]}>}>(path.join(sourceDir,'section-plan.json'))
    const byKey=new Map(sections.map(section=>[section.sectionKey,section]))
    const ordered=plan.sections.map(task=>byKey.get(task.sectionKey)||{sectionKey:task.sectionKey,sectionOrder:task.sectionOrder,components:[]})
    if(count(ordered)!==original.length||JSON.stringify(ordered.flatMap(section=>section.components))!==JSON.stringify(original))throw new Error('Saved sections differ from assembled components: '+page+'/'+run)
    const calls=await Promise.all((await files(path.join(sourceDir,'calls'))).map(file=>readJson<any>(path.join(sourceDir,'calls',file))))
    const out=structuredClone(ordered)
    const decisions:Array<Record<string,unknown>>=[]
    const pending:Array<{index:number;source:SourceEvidence;request:Request;sectionKey:string;allowed:string[]}>=[]
    const absent=plan.sections.some(task=>!proposal.blocks.some(block=>block.order===task.sectionOrder+1))
    const cutBlocks=absent?(runtimeRequire('@/lib/studio/import/detection/blocks/block-cutter') as typeof import('@/lib/studio/import/detection/blocks/block-cutter')).cutRenderedPage(adapt(geometry.tree)):[]
    for(const [index,task] of plan.sections.entries()) {
      const sectionKey=task.sectionKey
      const order=task.sectionOrder+1
      const block=proposal.blocks.find(item=>item.order===order)||cutBlocks.find(item=>item.order===order) as Block|undefined
      const saved=calls.filter(call=>call.sectionKey===sectionKey&&['extract','repair'].includes(call.kind)&&call.request?.messages?.length).at(-1)
      const source=block?blockEvidence(html,stylesheets,{...block,text:block.text||'',headings:block.headings||[],links:block.links||[],images:block.images||[],repeatedChildren:block.repeatedChildren||[]} as Block,geometry,proposal.finalUrl):(()=>{
        const message=saved?.request.messages.find((item:{role:string})=>item.role==='user')?.content||''
        const marker='Extract this single section:\n',at=message.indexOf(marker)
        if(at<0)throw new Error('Saved fill input is unavailable for '+page+'/'+run+'/'+sectionKey)
        return inputEvidence(JSON.parse(message.slice(at+marker.length)),proposal.finalUrl)
      })()
      const before=verifyBlock(source,out[index].components)
      checked++
      if(before.verified){if(!options.heldOut)decisions.push({sectionKey,decision:'verified'});continue}
      const template=saved||calls.find(call=>['extract','repair'].includes(call.kind)&&call.request?.messages?.length)
      if(!template)throw new Error('Source run has no saved fill request: '+page+'/'+run)
      const request:Request=saved?template.request:{...template.request,messages:[...template.request.messages.slice(0,2),{role:'user',content:'Extract this single section:\n'+JSON.stringify({sectionKey,sectionOrder:order-1,role:block?.region||'main',url:proposal.finalUrl,source:{text:source.text,headings:source.headings,links:source.links,images:source.images}})}]}
      planned++
      pending.push({index,source,request,sectionKey,allowed:plan.sections[index].candidateTypes.length?plan.sections[index].candidateTypes:out[index].components.map(component=>component.type)})
    }
    if(options.dryRun)continue
    await fs.mkdir(path.dirname(targetDir),{recursive:true})
    await fs.mkdir(targetDir)
    const recorder=new CallRecorder(targetDir,false)
    // Repair validates against the family set the source run was filled with; runs before set D recorded set C.
    const familyOverride=options.arm==='family-fill'?(await familyCatalogueOverride(record.families?.set==='D'?'D':'C')).override:undefined
    let runRepaired=0,runKept=0
    const repairedKeys=new Set<string>()
    const client=fixture.client||((request:Request,callOptions?:{signal?:AbortSignal;timeout?:number})=>{
      const apiKey=process.env.OPENROUTER_API_KEY
      if(!apiKey)throw new Error('OPENROUTER_API_KEY is required for paid repair')
      const {createLLMClient}=runtimeRequire('@/lib/studio/import/services/llm-client') as typeof import('@/lib/studio/import/services/llm-client')
      const instance=createLLMClient({apiKey,baseURL:record.configuration?.extractionEndpoint?.baseUrl,referer:record.pageUrl||proposal.finalUrl,title:'Catalyst Studio Web Detection'})
      return instance.chat.completions.create(request as any,{maxRetries:0,timeout:callOptions?.timeout??perRequestMs,signal:callOptions?.signal})
    })
    const start=performance.now()
    try {
      for(const task of pending) {
        const parse=(raw:string)=>parseSectionDetectionResponse({rawResponse:raw,sectionKey:task.sectionKey,availableComponents:task.allowed.map(type=>({type,description:type,confidence:1})),url:proposal.finalUrl,confidenceThreshold,allowMissingSectionKey:false,...(familyOverride?{validateContent:({canonicalType,content}:{canonicalType:string;content:Record<string,unknown>})=>familyOverride.validateContent(canonicalType,content)}:{})}).components as unknown as Component[]
        const mappedParse=(raw:string)=>parse(raw).map(component=>({...component,location:familyOverride?familyOverride.location(component.type,component.content as Record<string,unknown>):inferLocationFromType(component.type)}))
        const outcome=await repairBlock(task.source,out[task.index].components,{request:task.request,sectionKey:task.sectionKey,parse:mappedParse,allowedTypes:task.allowed,perRequestMs,stallTimeoutMs,infrastructureRetries,providerErrorRetries,validationRetries,client:(request,callOptions)=>recorder.call('repair',request,()=>client(request,callOptions),{sectionKey:task.sectionKey,sourceArm:options.arm,sourceRun:run,fixture:!!fixture.client},callOptions?.signal)})
        out[task.index].components=outcome.components
        if(outcome.decision==='repaired'){repaired++;runRepaired++;repairedKeys.add(task.sectionKey)}else{kept++;runKept++}
        if(!options.heldOut)decisions.push({sectionKey:task.sectionKey,decision:outcome.decision,reason:outcome.reason,before:{missing:missingCount(outcome.before),invented:inventedSize(outcome.before)},after:{missing:missingCount(outcome.after),invented:inventedSize(outcome.after)}})
      }
      cost+=recorder.calls.reduce((sum,call)=>sum+(typeof call.cost==='number'?call.cost:0),0)
      await writeJson(path.join(targetDir,'components.json'),out.flatMap(section=>section.components))
      if(!options.heldOut)await writeJson(path.join(targetDir,'sections.json'),out)
      if(!options.heldOut){
        const errors=await optionalJson<Array<{sectionKey?:string}>>(path.join(sourceDir,'section-errors.json'))
        if(errors)await writeJson(path.join(targetDir,'section-errors.json'),errors.filter(error=>!error.sectionKey||!repairedKeys.has(error.sectionKey)))
      }
      if(!options.heldOut)await writeJson(path.join(targetDir,'decisions.json'),decisions)
      const repairCost=recorder.calls.reduce((sum,call)=>sum+(typeof call.cost==='number'?call.cost:0),0)
      const summary={arm:options.arm+'+repair',baseArm:options.arm,source:{arm:options.arm,run},repairPromptSha256,promptSha256:digest(String(record.promptSha256||'')+repairPromptSha256),comparisonKey:digest(String(record.comparisonKey||'')+repairPromptSha256),status:'complete',createdAt:new Date().toISOString(),wallClockSeconds:(performance.now()-start)/1000,blockCount:plan.sections.length,repair:{blocksChecked:plan.sections.length,calls:pending.length,repaired:runRepaired,kept:runKept,cost:repairCost},callCount:recorder.calls.length,snapshotSha256:record.snapshotSha256}
      const failures=(record.failures||[]).filter((failure:{stage?:string;sectionKey?:string})=>failure.stage!=='run'&&(!failure.sectionKey||!repairedKeys.has(failure.sectionKey)))
      await writeJson(path.join(targetDir,'run.json'),options.heldOut?summary:{...record,...summary,failures})
    } catch(error) {
      await writeJson(path.join(targetDir,'run.json'),{arm:options.arm+'+repair',source:{arm:options.arm,run},status:'failed',error:options.heldOut?'Held-out repair failed':error instanceof Error?error.message:String(error)})
      if(options.heldOut)throw new Error('Held-out repair failed')
      throw error
    }
  }
  if(options.heldOut)console.log('Held-out overall repair calls: '+planned)
  else console.log(`Development blocks checked: ${checked}; repair calls planned: ${planned}`+(options.dryRun?'':`; repaired: ${repaired}; kept: ${kept}; cost: $${cost.toFixed(4)}`))
  return {checked,planned,repaired,kept,cost}
}

export async function repairSavedRuns(options:RepairOptions,fixture:Fixture={}) {return repairRuns(dataRoot(),options,fixture)}
