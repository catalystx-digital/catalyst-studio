import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import {spawnSync} from 'node:child_process'
import {comparisonSnapshot,comparisonBlocks} from './phase3-fixtures'
import type {Block} from '@/lib/studio/import/detection/blocks/block-cutter'
import {dataRoot,saveSnapshot,writeJson,readJson,digest} from './storage'
import {runtimeRequire} from './runtime'
import {runArm} from './run-arm'

async function verify(){
  const invalidTwice=process.argv[2]==='invalid-twice'
  const requiredRegions=process.argv[2]==='required-regions'
  const root=dataRoot(),page='comparison-fixture',snapshot=comparisonSnapshot()
  if(requiredRegions){
    snapshot.html=snapshot.html.replace('<main><section id="notice">','<header id="notice">').replace('</section><section id="hours">','</header><main><section id="hours">').replace('<section id="noticeboard">','</main><footer id="noticeboard">').replace('</section></main></body>','</footer></body>')
    snapshot.manifest.sha256=digest(snapshot.html)
  }
  process.env.DECISION_MODEL_ENABLED='true';process.env.DECISION_MODEL_SHADOW='false';process.env.DECISION_MODEL_API_KEY='offline-fixture';process.env.DECISION_MODEL_LOG_DIR=path.join(root,'decisions')
  const {DetectionConfig}=runtimeRequire('@/lib/studio/import/config')
  snapshot.models.data.push({...snapshot.models.data[0],id:DetectionConfig.blockFillModel})
  const {WebFetchTools}=runtimeRequire('@/lib/studio/import/services/web-tools')
  const nativeFetch=globalThis.fetch
  try {globalThis.fetch=async()=>new Response(snapshot.html,{headers:{'content-type':'text/html'}});snapshot.outline=await new WebFetchTools().fetchOutline({url:snapshot.manifest.url});snapshot.sections={};snapshot.manifest.sectionKeys=[]}
  finally{globalThis.fetch=nativeFetch}
  await saveSnapshot(path.join(root,'pages',page),snapshot)
  await writeJson(path.join(root,'pages.json'),{[page]:{url:snapshot.manifest.url,kind:'home',siteKind:'saas',heldOut:false,renderWithJavaScript:false,notes:'Invented fixture'}})
  const blocks=comparisonBlocks().map((block,index):Block=>({...block,...(requiredRegions?{region:index===0?'header':index===2?'footer':'main',anchor:{...block.anchor!,path:index===0?[0]:index===1?[1,0]:[2],tag:index===0?'header':index===2?'footer':'section'}}:{}),oversized:false,children:[]}))
  const geometry={key:'body',tag:'body',region:'main',box:{x:0,y:0,width:1440,height:1800},visible:true,meaningful:true,children:[{key:'main',tag:'main',region:'main',box:{x:0,y:0,width:1440,height:1800},visible:true,meaningful:true,children:blocks.map((block,index)=>({key:block.id,tag:'section',region:'main',ownTextLength:20,box:{...block.box,y:index*600,height:600},visible:true,meaningful:true,evidence:{anchor:block.anchor,repeatedChildren:[]},children:[]}))}]}
  await writeJson(path.join(root,'labels',page,'geometry.json'),{page,snapshotSha256:snapshot.manifest.sha256,tree:geometry})
  let decisions=0,fills=0,invalidKey:string|undefined
  globalThis.fetch=async (input,init)=>{
    const url=typeof input==='string'?input:input instanceof URL?input.href:input.url
    if (!url.endsWith('/alpha/decisions')) throw new Error('Unexpected fake transport URL')
    decisions++
    const body=JSON.parse(String(init?.body))
    const types=Object.keys(body.questions['import.block.component'].criteria)
    assert.equal(types.length,11)
    const state=JSON.stringify(body.state)
    const chosen=requiredRegions?(/Block 1; region header/.test(state)?'site-header':/Block 3; region footer/.test(state)?'site-footer':'content'):'content'
    const probabilities=Object.fromEntries(types.map(type=>[type,type===chosen?0.99:0.01/(types.length-1)]))
    return new Response(JSON.stringify({answers:{'import.block.component':{choice:chosen,probabilities},'import.block.multiple':{noul:0.1}},usage:{input_tokens:12,output_tokens:4,cost:0.001}}),{headers:{'content-type':'application/json'}})
  }
  const llm={chat:{completions:{async create(request:any){fills++;const prompt=request.messages.map((m:any)=>m.content).join('\n');const family=prompt.includes('=== COMPONENT FAMILY CATALOGUE ===');if(family)assert(!/card-grid|text-block|mediaId|mediaType/.test(prompt));const user=request.messages.find((m:any)=>m.role==='user').content;const payload=JSON.parse(user.slice(user.indexOf('Extract this single section:\n')+'Extract this single section:\n'.length));if(family)invalidKey??=payload.sectionKey;const heading=payload.nodes.find((n:any)=>/^h[1-6]$/.test(n.tag))?.text||'';const type=requiredRegions?(payload.sectionKey==='block:1'?'site-header':payload.sectionKey==='block:3'?'site-footer':'content'):family?'content':'text-block';const content=requiredRegions?{heading:type==='site-header'?'Invented Workshop':type==='site-footer'?'Workshop closing note':heading,placement:type==='site-header'?'header':type==='site-footer'?'footer':'main',links:[{label:'Visit',type:'external',url:'https://example.com/visit'}]}:family&&payload.sectionKey===invalidKey&&(invalidTwice||request.messages.length===3)?{bogus:true}:family?{heading}:{heading,body:'<p>Invented paragraph.</p>'};return {choices:[{message:{content:JSON.stringify({sectionKey:payload.sectionKey,components:[{component:type,confidence:0.95,content}]})}}],usage:{prompt_tokens:10,completion_tokens:5,total_tokens:15,cost:0}}}}}}
  const record=await runArm({page,arm:'family-fill',run:'fixture',dryRun:false},{llm,cut:async()=>({blocks,issues:[],javascriptEnabled:true,anchorResolutionShare:1})})
  if(requiredRegions){
    assert.equal(record.status,'complete',JSON.stringify(record.failures))
    assert.equal(decisions,3);assert.equal(fills,3)
    const components=await readJson(path.join(root,'arms',page,'family-fill','fixture','components.json'))
    assert.deepEqual(components.map((component:any)=>[component.type,component.location]),[['site-header','header'],['content','main'],['site-footer','footer']])
    console.log('PASS family-fill required header and footer through production importer')
    return
  }
  assert.equal(record.status,invalidTwice?'failed':'complete',JSON.stringify(record.failures));assert.equal(decisions,3);assert.equal(fills,invalidTwice?4:4)
  const directory=path.join(root,'arms',page,'family-fill','fixture'),components=await readJson(path.join(directory,'components.json'))
  assert.equal(components.length,invalidTwice?2:3);assert(components.every((component:any)=>component.type==='content'))
  if(invalidTwice)assert(record.failures.some((failure:any)=>failure.error?.message?.includes('bogus')))
  const calls=await fs.readdir(path.join(directory,'calls'));assert.equal(calls.length,7)
  const repair=await Promise.all(calls.map(file=>readJson(path.join(directory,'calls',file))));assert.equal(repair.filter((call:any)=>call.kind==='repair').length,1)
  assert(repair.filter((call:any)=>call.kind==='decision').every((call:any)=>call.usage?.cost===0.001&&call.transport.length===1))
  const before=await fs.readdir(path.join(root,'arms',page,'family-fill'))
  const dry=await runArm({page,arm:'family-fill',run:'dry-fixture',dryRun:true})
  assert.equal(dry.status,'dry-run');assert.deepEqual([dry.plan.decisionCalls,dry.plan.fillCalls],[3,3]);assert.equal(dry.plannedCallCount,6)
  assert.deepEqual(await fs.readdir(path.join(root,'arms',page,'family-fill')),['dry-fixture',...before])
  const familyRun=await readJson(path.join(directory,'run.json'))
  assert.equal(familyRun.families.set,'D')
  assert.equal(typeof familyRun.configurationSha256,'string')
  assert.equal(typeof familyRun.promptSha256,'string')
  assert.equal(typeof familyRun.overrideSha256,'string')
  assert.equal(typeof familyRun.labSourceHashes['family-schemas.ts'],'string')
  const planned=(arm:string)=>{
    const result=spawnSync(process.execPath,['--import','tsx',path.join(__dirname,'run-arm.ts'),'--page',page,'--arm',arm,'--run','dry','--dry-run'],{cwd:path.resolve(__dirname,'../../..'),encoding:'utf8',windowsHide:true,env:{...process.env,IMPORT_LAB_ROOT:root,IMPORT_MODEL_CHAIN:'test/dummy',SKIP_DB_SETUP:'true'}})
    assert.equal(result.status,0,result.stdout+'\n'+result.stderr)
    const directory=path.join(root,'arms',page,arm,'dry','calls')
    return Promise.all((require('node:fs').readdirSync(directory) as string[]).map(file=>readJson(path.join(directory,file))))
  }
  const [familyPlan,productionPlan]=await Promise.all([planned('family-fill'),planned('blocks-production')])
  assert.deepEqual(familyPlan.map((call:any)=>call.kind),productionPlan.map((call:any)=>call.kind))
  assert.deepEqual(familyPlan.map((call:any)=>call.kind),['decision','extract','decision','extract','decision','extract'])
  console.log('blocks-production dry plan: 3 decision, 3 extract; production catalogue')
  console.log('family-fill dry plan: 3 decision, 3 extract; family override')
  assert.deepEqual(familyPlan.map((call:any)=>call.request.block?.id),productionPlan.map((call:any)=>call.request.block?.id))
  for(let index=0;index<familyPlan.length;index++){
    const familyRequest={...familyPlan[index].request},productionRequest={...productionPlan[index].request}
    if(familyPlan[index].kind==='decision'){
      assert.equal(Object.keys(familyRequest.options).length,11)
      delete familyRequest.options
    }else{
      assert.equal(familyRequest.allowedTypes.length,11)
      familyRequest.allowedTypes=productionRequest.allowedTypes
    }
    assert.deepEqual(familyRequest,productionRequest)
  }
  console.log('PASS family-fill: shared offline pipeline, one repair, decision transport accounting, matched dry plans'+(invalidTwice?', invalid block dropped':''))
}
verify().catch(error=>{console.error(error);process.exitCode=1})
