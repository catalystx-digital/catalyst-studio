/** @jest-environment node */
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { f1Content, f1Mutations, f1Html, f1Block, f1Geometry, f1Url, f1Paragraph } from './f1-fixtures'
import { blockEvidence, inputEvidence } from './source-evidence'
import { repairBlock, repairPrompt, repairRuns } from './repair'
import { digest } from './storage'
import type { Component } from './metrics'
import { familyCatalogueOverride } from './family-fill'
import { clampCompletionTokens } from '@/lib/studio/import/web-detection'
import { runBlockReply, type BlockReplyState } from '@/lib/studio/import/detection/blocks/block-extract'
import type { ChatCompletion, ChatCompletionMessageParam } from 'openai/resources/chat/completions'
import { parseSectionDetectionResponse } from '@/lib/studio/import/detection/response-parser'

const source = blockEvidence(f1Html,[],f1Block,f1Geometry,f1Url)
const original = [{type:'card-grid',content:{...f1Content,description:'',href:undefined,label:undefined,image:undefined,body:Array(30).fill('invented').join(' ')}}]
const complete = f1Mutations[0][1]
const validCard={type:'card-grid',content:{heading:f1Content.heading,cards:[{title:f1Content.items[0].title,description:f1Paragraph},...f1Content.items.slice(1).map(item=>({title:item.title,description:item.text}))]}}
const reply=(components:Component[]=[validCard],confidence=0.9,finish_reason='stop')=>({choices:[{finish_reason,message:{content:JSON.stringify({sectionKey:'block:1',components:components.map(component=>({component:component.type,confidence,content:component.content}))})}}],usage:{total_tokens:17,cost:0.002}})
const request = {model:'test/dummy',temperature:0,max_tokens:1000,response_format:{type:'json_object'},messages:[{role:'system',content:'fixture contract'},{role:'user',content:'Extract this single section:\n{"sectionKey":"block:1","nodes":[]}'}]}

test('verified block is copied without a model call',async()=>{
  const client=jest.fn()
  const result=await repairBlock(source,complete,{request,sectionKey:'block:1',client,parse:()=>complete})
  expect(result.decision).toBe('verified')
  expect(result.components).toEqual(complete)
  expect(client).not.toHaveBeenCalled()
})

test('one targeted call lists missing text, link, picture and invented output',async()=>{
  const client=jest.fn().mockResolvedValue({choices:[{message:{content:'{}'}}]})
  const result=await repairBlock(source,original,{request,sectionKey:'block:1',client,parse:()=>complete})
  expect(result.decision).toBe('repaired')
  expect(client).toHaveBeenCalledTimes(1)
  const sent=client.mock.calls[0][0]
  expect(sent.model).toBe('test/dummy')
  expect(sent.temperature).toBe(0)
  const prompt=sent.messages.at(-1).content
  expect(prompt).toContain(f1Paragraph.toLowerCase().replace(/\.$/,''))
  expect(prompt).toContain('read the full story → https://example.test/stories/one')
  expect(prompt).toContain('https://example.test/photo-large.jpg')
  expect(prompt).toContain('invented')
  expect(prompt).toContain('Return the same component type with the missing items added; do not change anything else.')
  expect(repairPrompt(source,original,'{"nodes":[]}')).toContain('These items are on the page but missing from your output:')
})

test('invalid JSON gets the same validation repair request as fill',async()=>{
  const invalid={choices:[{finish_reason:'stop',message:{content:'{"sectionKey":"block:1","components":{}}'}}]}
  const parse=(rawResponse:string)=>parseSectionDetectionResponse({
    rawResponse,sectionKey:'block:1',availableComponents:[{type:'card-grid',description:'card-grid',confidence:1}],
    url:f1Url,confidenceThreshold:0.25,allowMissingSectionKey:false
  }).components as unknown as Component[]
  const labClient=jest.fn().mockResolvedValueOnce(invalid).mockResolvedValueOnce(reply())
  const outcome=await repairBlock(source,original,{request,sectionKey:'block:1',client:labClient,parse,validationRetries:1})
  expect(outcome.decision).toBe('repaired')
  const fillMessages=[...labClient.mock.calls[0][0].messages] as ChatCompletionMessageParam[]
  const fillRequests:ChatCompletionMessageParam[][]=[]
  const fillReplies=[invalid,reply()]
  const state:BlockReplyState={requestCount:0,rawResponse:'',finishReason:'',stage:'llm_call',repairDebug:{}}
  await runBlockReply({
    messages:fillMessages,sectionKey:'block:1',allowedTypes:['card-grid'],state,validationRetries:1,
    createRequest:messages=>{fillRequests.push([...messages]);return {messages}},
    call:async()=>fillReplies.shift() as unknown as ChatCompletion,
    validate:parse
  })
  expect(labClient).toHaveBeenCalledTimes(2)
  expect(fillRequests).toHaveLength(2)
  expect(labClient.mock.calls[1][0].messages).toEqual(fillRequests[1])
})

test('provider 429 uses fill backoff and recorded retry limit',async()=>{
  const throttled={error:{code:429,message:'slow down'},choices:[]}
  const client=jest.fn().mockResolvedValueOnce(throttled).mockResolvedValueOnce(reply())
  const started=Date.now()
  const outcome=await repairBlock(source,original,{request,sectionKey:'block:1',client,parse:()=>complete,providerErrorRetries:1})
  expect(outcome.decision).toBe('repaired')
  expect(client).toHaveBeenCalledTimes(2)
  expect(Date.now()-started).toBeGreaterThanOrEqual(900)
  const fillMessages=[...client.mock.calls[0][0].messages] as ChatCompletionMessageParam[]
  const fillRequests:ChatCompletionMessageParam[][]=[]
  const fillReplies=[throttled,reply()]
  const state:BlockReplyState={requestCount:0,rawResponse:'',finishReason:'',stage:'llm_call',repairDebug:{}}
  const fillStarted=Date.now()
  await runBlockReply({
    messages:fillMessages,sectionKey:'block:1',allowedTypes:['card-grid'],state,providerErrorRetries:1,
    createRequest:messages=>{fillRequests.push([...messages]);return {messages}},
    call:async()=>fillReplies.shift() as unknown as ChatCompletion,
    validate:raw=>JSON.parse(raw)
  })
  expect(state.requestCount).toBe(2)
  expect(fillRequests).toHaveLength(1)
  expect(Date.now()-fillStarted).toBeGreaterThanOrEqual(900)
  const exhausted=jest.fn().mockResolvedValue(throttled)
  await expect(repairBlock(source,original,{request,sectionKey:'block:1',client:exhausted,parse:()=>complete,providerErrorRetries:0})).rejects.toThrow('Block extraction provider error (429)')
  expect(exhausted).toHaveBeenCalledTimes(1)
})

test('reviewer budget probe keeps original and records fill reason before any call',async()=>{
  const expanded={...request,messages:[request.messages[0],{role:'user',content:'Extract this single section:\n'+ 'x'.repeat(450000)}]}
  expect(clampCompletionTokens(expanded.model,expanded.messages as ChatCompletionMessageParam[],expanded.max_tokens)).toBeGreaterThan(0)
  const client=jest.fn()
  const outcome=await repairBlock(source,original,{request:expanded,sectionKey:'block:1',client,parse:()=>complete})
  expect(outcome).toMatchObject({decision:'kept',reason:'context_budget_exceeded',components:original})
  expect(client).not.toHaveBeenCalled()
})

test('saved over-budget repair records context_budget_exceeded without a call',async()=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'repair-budget-'))
  try {
    const {runDir,target}=await savedRun(root)
    await fs.writeFile(path.join(runDir,'calls','00001.json'),JSON.stringify({
      kind:'extract',sectionKey:'block:1',
      request:{...request,messages:[request.messages[0],{role:'user',content:'Extract this single section:\n'+'x'.repeat(450000)}]}
    }))
    const client=jest.fn()
    const outcome=await repairRuns(root,{arm:'blocks-production',runs:['a-r1'],yesSpend:true},{client})
    expect(outcome).toMatchObject({kept:1,repaired:0})
    expect(client).not.toHaveBeenCalled()
    expect(JSON.parse(await fs.readFile(path.join(target,'decisions.json'),'utf8'))[0]).toMatchObject({decision:'kept',reason:'context_budget_exceeded'})
    expect(JSON.parse(await fs.readFile(path.join(target,'run.json'),'utf8'))).toMatchObject({callCount:0})
  } finally {await fs.rm(root,{recursive:true,force:true})}
})

test.each([
  ['changed type',[{type:'hero',content:complete[0].content}]],
  ['more invented',[{type:'card-grid',content:{...(complete[0].content as Record<string,unknown>),extra:Array(50).fill('fabricated').join(' ')}}]],
  ['no improvement',original]
])('%s is rejected and original copied',async(_case,replacement)=>{
  const client=jest.fn().mockResolvedValue({choices:[{message:{content:'{}'}}]})
  const result=await repairBlock(source,original,{request,sectionKey:'block:1',client,parse:()=>replacement})
  expect(result.decision).toBe('kept')
  expect(result.components).toEqual(original)
  expect(client).toHaveBeenCalledTimes(1)
})

test('the existing invented fixture remains invented under verification',()=>{
  expect(f1Mutations.find(([name])=>name==='M9')?.[1][0].content).toMatchObject({body:expect.stringContaining('invented')})
  expect(f1Content.heading).toBeTruthy()
})

async function savedRun(root:string,heldOut=false,arm='blocks-production',type='card-grid',components:Component[]=original) {
  const page=heldOut?'hidden':'development',run='a-r1'
  const pageDir=path.join(root,'pages',page),labelDir=path.join(root,'labels',page),runDir=path.join(root,'arms',page,arm,run)
  await fs.mkdir(pageDir,{recursive:true});await fs.mkdir(labelDir,{recursive:true});await fs.mkdir(path.join(runDir,'calls'),{recursive:true})
  await fs.writeFile(path.join(root,'pages.json'),JSON.stringify({[page]:{url:f1Url,kind:'home',siteKind:'saas',heldOut,renderWithJavaScript:false,notes:''}}))
  await fs.writeFile(path.join(pageDir,'page.html'),f1Html)
  await fs.writeFile(path.join(pageDir,'stylesheets.json'),'[]')
  await fs.writeFile(path.join(labelDir,'blocks.json'),JSON.stringify({blocks:[f1Block],finalUrl:f1Url,snapshotSha256:digest(f1Html)}))
  await fs.writeFile(path.join(labelDir,'geometry.json'),JSON.stringify(f1Geometry))
  await fs.writeFile(path.join(runDir,'run.json'),JSON.stringify({status:'complete',snapshotSha256:digest(f1Html),blockCount:1,configuration:{confidence:{detection:0.25},extractionEndpoint:{baseUrl:'https://example.test/api',timeoutMs:60000}},rules:{stallTimeoutMs:120000,infrastructureRetries:2,providerErrorRetries:4,validationRetries:1}}))
  await fs.writeFile(path.join(runDir,'section-plan.json'),JSON.stringify({sections:[{sectionKey:'block:1',sectionOrder:0,candidateTypes:[type]}]}))
  await fs.writeFile(path.join(runDir,'sections.json'),JSON.stringify([{sectionKey:'block:1',sectionOrder:0,components}]))
  await fs.writeFile(path.join(runDir,'components.json'),JSON.stringify(components))
  await fs.writeFile(path.join(runDir,'calls','00001.json'),JSON.stringify({kind:'extract',sectionKey:'block:1',request}))
  return {page,runDir,target:path.join(root,'arms',page,arm+'+repair',run)}
}

test('saved-run dry-run writes nothing; paid fixture records one call and never overwrites',async()=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'repair-fixture-'))
  try {
    const {target,runDir}=await savedRun(root)
    const sourceRecord=JSON.parse(await fs.readFile(path.join(runDir,'run.json'),'utf8'))
    await fs.writeFile(path.join(runDir,'run.json'),JSON.stringify({...sourceRecord,failures:[{stage:'parsing',sectionKey:'block:1'}]}))
    await fs.writeFile(path.join(runDir,'section-errors.json'),JSON.stringify([{sectionKey:'block:1',stage:'parsing'}]))
    const dryClient=jest.fn()
    const dry=await repairRuns(root,{arm:'blocks-production',runs:['a-r1'],dryRun:true},{client:dryClient})
    expect(dry).toMatchObject({checked:1,planned:1})
    expect(dryClient).not.toHaveBeenCalled()
    await expect(fs.stat(target)).rejects.toMatchObject({code:'ENOENT'})
    const client=jest.fn().mockResolvedValue(reply())
    const result=await repairRuns(root,{arm:'blocks-production',runs:['a-r1'],yesSpend:true},{client})
    expect(result).toMatchObject({checked:1,planned:1,repaired:1})
    expect(client).toHaveBeenCalledTimes(1)
    expect(JSON.parse(await fs.readFile(path.join(target,'components.json'),'utf8'))).toMatchObject([{type:'card-grid',location:'main'}])
    const repairedRecord=JSON.parse(await fs.readFile(path.join(target,'run.json'),'utf8'))
    expect(repairedRecord.repair).toMatchObject({blocksChecked:1,repaired:1,cost:0.002})
    expect(repairedRecord.failures).toEqual([])
    expect(JSON.parse(await fs.readFile(path.join(target,'section-errors.json'),'utf8'))).toEqual([])
    const call=JSON.parse(await fs.readFile(path.join(target,'calls','00001.json'),'utf8'))
    expect(call).toMatchObject({kind:'repair',status:'complete',model:'test/dummy',cost:0.002,usage:{total_tokens:17},latencyMs:expect.any(Number)})
    await expect(repairRuns(root,{arm:'blocks-production',runs:['a-r1'],dryRun:true})).rejects.toThrow('already exists')
  } finally {await fs.rm(root,{recursive:true,force:true})}
})

test('held-out fixture produces only an aggregate console line and no decision file',async()=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'repair-hidden-fixture-'))
  const log=jest.spyOn(console,'log').mockImplementation(()=>{})
  try {
    const {target}=await savedRun(root,true)
    const client=jest.fn().mockResolvedValue(reply())
    await repairRuns(root,{arm:'blocks-production',runs:['a-r1'],heldOut:true,yesSpend:true},{client})
    expect(log.mock.calls).toEqual([['Held-out overall repair calls: 1']])
    await expect(fs.stat(path.join(target,'decisions.json'))).rejects.toMatchObject({code:'ENOENT'})
    await expect(fs.stat(path.join(target,'report.json'))).rejects.toMatchObject({code:'ENOENT'})
    await expect(fs.stat(path.join(target,'report.md'))).rejects.toMatchObject({code:'ENOENT'})
    expect((await fs.readdir(target)).sort()).toEqual(['calls','components.json','run.json'])
    expect(await fs.readdir(path.join(target,'calls'))).toEqual(['00001.json'])
    expect(JSON.parse(await fs.readFile(path.join(target,'run.json'),'utf8')).repair).toMatchObject({repaired:1,kept:0})
  } finally {log.mockRestore();await fs.rm(root,{recursive:true,force:true})}
})

test('recorded confidence and request timeout govern real parser output',async()=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'repair-threshold-'))
  try {
    const {runDir,target}=await savedRun(root)
    const record=JSON.parse(await fs.readFile(path.join(runDir,'run.json'),'utf8'))
    await fs.writeFile(path.join(runDir,'run.json'),JSON.stringify({...record,configuration:{...record.configuration,confidence:{detection:0.8},extractionEndpoint:{timeoutMs:1234}},rules:{...record.rules,stallTimeoutMs:1000,infrastructureRetries:0}}))
    const client=jest.fn().mockResolvedValue(reply([validCard],0.5))
    const result=await repairRuns(root,{arm:'blocks-production',runs:['a-r1'],yesSpend:true},{client})
    expect(result).toMatchObject({kept:1,repaired:0})
    expect(client.mock.calls[0][1]).toMatchObject({timeout:1234,signal:expect.any(AbortSignal)})
    expect(JSON.parse(await fs.readFile(path.join(target,'components.json'),'utf8'))).toEqual(original)
  }finally{await fs.rm(root,{recursive:true,force:true})}
})

test('truncated reply retries; exhausted stall aborts and records timeout',async()=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'repair-response-'))
  try {
    const {runDir,target}=await savedRun(root)
    const record=JSON.parse(await fs.readFile(path.join(runDir,'run.json'),'utf8'))
    await fs.writeFile(path.join(runDir,'run.json'),JSON.stringify({...record,rules:{...record.rules,stallTimeoutMs:20,infrastructureRetries:1}}))
    const truncated={...reply(),choices:[{finish_reason:'length',message:{content:'{"sectionKey":"block:1","components":['}}]}
    const client=jest.fn().mockResolvedValueOnce(truncated).mockResolvedValueOnce(reply())
    expect((await repairRuns(root,{arm:'blocks-production',runs:['a-r1'],yesSpend:true},{client})).repaired).toBe(1)
    expect(client).toHaveBeenCalledTimes(2)
    expect((await fs.readdir(path.join(target,'calls'))).sort()).toEqual(['00001.json','00002.json'])
  }finally{await fs.rm(root,{recursive:true,force:true})}
  const stalled=await fs.mkdtemp(path.join(os.tmpdir(),'repair-stall-'))
  try {
    const {runDir,target}=await savedRun(stalled)
    const record=JSON.parse(await fs.readFile(path.join(runDir,'run.json'),'utf8'))
    await fs.writeFile(path.join(runDir,'run.json'),JSON.stringify({...record,rules:{...record.rules,stallTimeoutMs:10,infrastructureRetries:0}}))
    let signal:AbortSignal|undefined
    const client=jest.fn((_request:unknown,options?:{signal?:AbortSignal})=>{signal=options?.signal;return new Promise(()=>{})})
    await expect(repairRuns(stalled,{arm:'blocks-production',runs:['a-r1'],yesSpend:true},{client})).rejects.toThrow('Call timeout after 10ms')
    expect(signal?.aborted).toBe(true)
    expect(JSON.parse(await fs.readFile(path.join(target,'calls','00001.json'),'utf8')).status).toBe('timeout')
  }finally{await fs.rm(stalled,{recursive:true,force:true})}
})

test.each([['site-header','header'],['site-footer','footer'],['hero','hero'],['local-nav','header']])('%s repair gets fill placement %s before saving',async(type,placement)=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'repair-location-'))
  try {
    const components=[{type,content:{heading:'',intro:'invented words from nowhere',placement:'main'}}]
    const {target}=await savedRun(root,false,'family-fill',type,components)
    const client=jest.fn().mockResolvedValue(reply([{type,content:{heading:f1Content.heading,intro:f1Paragraph,placement:'main'}}]))
    const result=await repairRuns(root,{arm:'family-fill',runs:['a-r1'],yesSpend:true},{client})
    expect(result.repaired).toBe(1)
    const repaired=JSON.parse(await fs.readFile(path.join(target,'components.json'),'utf8'))[0]
    const fillLocation=(await familyCatalogueOverride()).override.location(type,repaired.content)
    expect(repaired).toMatchObject({type,location:placement})
    expect(repaired.location).toBe(fillLocation)
  }finally{await fs.rm(root,{recursive:true,force:true})}
})

test('saved fill input supplies evidence when a later production section is absent from label geometry',async()=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'repair-later-fixture-'))
  try {
    const {runDir}=await savedRun(root)
    const late='block:19'
    const input:Parameters<typeof inputEvidence>[0]&{sectionKey:string}={sectionKey:late,role:'main',nodes:[{tag:'p',text:f1Paragraph},{tag:'a',text:'Read the full story',attrs:{href:'/stories/one'}},{tag:'img',attrs:{src:'/photo-large.jpg',alt:'Example picture'}}]}
    const evidence=inputEvidence(input,f1Url)
    expect(evidence.links[0]).toEqual({url:'https://example.test/stories/one',label:'read the full story'})
    expect(evidence.images[0].addresses).toContain('https://example.test/photo-large.jpg')
    await fs.writeFile(path.join(runDir,'section-plan.json'),JSON.stringify({sections:[{sectionKey:late,sectionOrder:18,candidateTypes:['card-grid']}]}))
    await fs.writeFile(path.join(runDir,'sections.json'),JSON.stringify([{sectionKey:late,sectionOrder:18,components:original}]))
    await fs.writeFile(path.join(runDir,'calls','00001.json'),JSON.stringify({kind:'extract',sectionKey:late,request:{...request,messages:[...request.messages.slice(0,1),{role:'user',content:'Extract this single section:\n'+JSON.stringify(input)}]}}))
    const result=await repairRuns(root,{arm:'blocks-production',runs:['a-r1'],dryRun:true})
    expect(result).toMatchObject({checked:1,planned:1})
  } finally {await fs.rm(root,{recursive:true,force:true})}
})
