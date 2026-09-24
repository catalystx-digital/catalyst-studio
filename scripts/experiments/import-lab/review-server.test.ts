/** @jest-environment node */
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import http from 'node:http'
import sharp from 'sharp'
import { startReviewServer, reviewSummary } from './review-server'
import { parseEval, planEvaluation } from './eval'

const baseLabel = {family:'hero',acceptableFamilies:['hero'],multiple:false,familiesInOrder:[],placement:'main',ignore:false,ignoreReason:'',itemCount:null,itemKind:null,decorativeImages:[],reason:{a:'first',b:'second'}}
const disputed = (id:string) => ({blockId:id,order:1,status:'disputed',label:{...baseLabel,family:{disputed:true,a:'hero',b:'content'},itemCount:{disputed:true,a:2,b:3}}})
const agreed = (id:string,order:number,ignore=false) => ({blockId:id,order,status:'agreed',label:{...baseLabel,ignore,ignoreReason:ignore?'fixture ignored':''}})
const block = (id:string,order:number) => ({id,order,region:'main',anchor:null,anchorResolved:true,box:{x:0,y:0,width:40,height:30},text:'Invented fixture text',images:[],links:[],headings:[],repeatedChildren:[],children:[]})
let root:string
let originalRoot:string|undefined
let server:Awaited<ReturnType<typeof startReviewServer>>
let address:string

async function put(page:string,heldOut:boolean,entries:any[]) {
  const dir=path.join(root,'labels',page)
  await fs.mkdir(dir,{recursive:true})
  const blocks=entries.map((e:any,i:number)=>block(e.blockId,i+1))
  await fs.writeFile(path.join(dir,'answer-sheet-v2.json'),JSON.stringify({version:2,page,heldOut,familySet:'C',familyNames:['hero','content','collection'],labellers:{a:{model:'vendor-secret-a'},b:{model:'vendor-secret-b'}},entries}))
  await fs.writeFile(path.join(dir,'blocks.json'),JSON.stringify({version:1,page,snapshotSha256:'fixture',finalUrl:'https://example.test/',javascriptEnabled:false,renderedHeight:30,viewportWidth:40,blocks,issues:[],status:'complete'}))
  await sharp({create:{width:40,height:30,channels:3,background:'#ddd'}}).png().toFile(path.join(dir,'screenshot.png'))
}
async function get(queue:string) {const response=await fetch(address+'/api/queue?queue='+queue);expect(response.status).toBe(200);return response.json() as Promise<any>}
async function answer(queue:string,item:any,values:any={}) {return fetch(address+'/api/answer',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({queue,page:item.page,blockId:item.blockId,revision:item.revision,...values})})}
async function start() {server=await startReviewServer(0,{arm:'blocks-production',run:'fixture-run'});const a=server.address();address='http://127.0.0.1:'+(typeof a==='object'&&a?a.port:0)}
async function stop() {if(server)await new Promise<void>((resolve,reject)=>server.close(error=>error?reject(error):resolve()))}

beforeEach(async()=>{
  root=await fs.mkdtemp(path.join(os.tmpdir(),'review-queues-'))
  originalRoot=process.env.IMPORT_LAB_ROOT
  process.env.IMPORT_LAB_ROOT=root
  await put('held',true,[disputed('held-dispute'),...Array.from({length:31},(_,i)=>agreed('held-'+i,i+2)),agreed('held-ignored',33,true)])
  await put('development',false,[disputed('dev-dispute'),...Array.from({length:31},(_,i)=>agreed('dev-'+i,i+2)),agreed('dev-ignored',33,true)])
  await fs.writeFile(path.join(root,'pages.json'),JSON.stringify({held:{url:'https://example.test/held',kind:'other',siteKind:'saas',heldOut:true,renderWithJavaScript:false,notes:''},development:{url:'https://example.test/dev',kind:'other',siteKind:'saas',heldOut:false,renderWithJavaScript:false,notes:''}}))
  const scoreDir=path.join(root,'labels','development','scores-stick')
  await fs.mkdir(scoreDir,{recursive:true})
  await fs.writeFile(path.join(scoreDir,'blocks-production--fixture-run--stick1.json'),JSON.stringify({rows:Array.from({length:32},(_,i)=>({id:i===31?'dev-ignored':'dev-'+i,verdict:'correct',ignored:i===31,componentIndices:[i]}))}))
  const runDir=path.join(root,'arms','development','blocks-production','fixture-run')
  await fs.mkdir(runDir,{recursive:true})
  await fs.writeFile(path.join(runDir,'components.json'),JSON.stringify(Array.from({length:32},(_,i)=>({type:'hero',content:{heading:'Fixture heading '+i,text:'Invented fixture text',image:'https://example.test/image.png',link:{label:'Fixture link',href:'https://example.test/target'}}}))))
  await start()
})
afterEach(async()=>{await stop();if(originalRoot===undefined)delete process.env.IMPORT_LAB_ROOT;else process.env.IMPORT_LAB_ROOT=originalRoot;await fs.rm(root,{recursive:true,force:true})})

test('held-out disputes come first; one choice resolves fields, records history and reviewer',async()=>{
  const first=(await get('disputes')).item
  expect(first).toMatchObject({page:'held',blockId:'held-dispute'})
  expect(first.choices).toHaveLength(2)
  const response=await answer('disputes',first,{choiceId:first.choices[0].id})
  expect(response.status).toBe(200)
  const saved=JSON.parse(await fs.readFile(path.join(root,'labels','held','answer-sheet-v2.json'),'utf8'))
  expect(saved.entries[0]).toMatchObject({status:'reviewed',reviewedBy:'founder',label:{family:'hero',itemCount:2}})
  expect(saved.entries[0].history).toEqual(expect.arrayContaining([expect.objectContaining({field:'family',losingOptions:['content']})]))
  expect((await get('disputes')).item.blockId).toBe('dev-dispute')
})

test('invalid family is 400 and stale revision is 409',async()=>{
  const item=(await get('disputes')).item
  expect((await answer('disputes',item,{choiceId:'other',values:{family:'unknown',itemCount:4}})).status).toBe(400)
  expect((await answer('disputes',item,{choiceId:item.choices[0].id})).status).toBe(200)
  expect((await answer('disputes',item,{choiceId:item.choices[1].id})).status).toBe(409)
})

test('seeded sample and stick selections survive restart and exclude ignored blocks; stick verdict stays private',async()=>{
  const firstSample=await get('sample'),firstStick=await get('stick')
  expect(firstSample.item.blockId).not.toBe('held-ignored')
  expect(firstStick.item.blockId).not.toBe('dev-ignored')
  expect(JSON.stringify(firstStick)).not.toContain('verdict')
  expect(JSON.stringify(firstSample)).not.toMatch(/vendor-secret/)
  expect(JSON.stringify(firstStick)).not.toMatch(/vendor-secret/)
  expect(JSON.stringify(await get('disputes'))).not.toMatch(/vendor-secret/)
  await stop();await start()
  expect((await get('sample')).item.blockId).toBe(firstSample.item.blockId)
  expect((await get('stick')).item.blockId).toBe(firstStick.item.blockId)
  expect((await answer('sample',firstSample.item,{answer:'right'})).status).toBe(200)
  expect((await get('sample')).item.blockId).not.toBe(firstSample.item.blockId)
  expect((await answer('stick',firstStick.item,{answer:'right'})).status).toBe(200)
  expect((await get('stick')).item.blockId).not.toBe(firstStick.item.blockId)
})

test('wrong sample corrects the family; stick record stores its verdict privately',async()=>{
  const sample=(await get('sample')).item
  expect((await answer('sample',sample,{answer:'wrong',correction:'content'})).status).toBe(200)
  const saved=JSON.parse(await fs.readFile(path.join(root,'labels','held','answer-sheet-v2.json'),'utf8'))
  expect(saved.entries.find((entry:any)=>entry.blockId===sample.blockId)).toMatchObject({status:'reviewed',reviewedBy:'founder',label:{family:'content'}})
  const stick=(await get('stick')).item
  expect((await answer('stick',stick,{answer:'right'})).status).toBe(200)
  const records=JSON.parse(await fs.readFile(path.join(root,'labels','stick-check.json'),'utf8'))
  expect(records[0]).toMatchObject({page:stick.page,blockId:stick.blockId,answer:'right',stickVerdict:'correct',arm:'blocks-production',run:'fixture-run'})
})

test('stick queue excludes unsettled rows and records the latest verdict after drawing',async()=>{
  const file=path.join(root,'labels','development','scores-stick','blocks-production--fixture-run--stick1.json')
  const score=JSON.parse(await fs.readFile(file,'utf8'))
  score.rows[0].verdict='unsettled'
  await fs.writeFile(file,JSON.stringify(score))
  const first=await get('stick')
  expect(first.progress.total).toBe(30)
  expect(first.item.blockId).not.toBe('dev-0')

  const drawn=score.rows.find((row:any)=>row.id===first.item.blockId)
  drawn.verdict='wrong type'
  await fs.writeFile(file,JSON.stringify(score))
  expect((await answer('stick',first.item,{answer:'wrong'})).status).toBe(200)
  const records=JSON.parse(await fs.readFile(path.join(root,'labels','stick-check.json'),'utf8'))
  expect(records[0]).toMatchObject({blockId:first.item.blockId,stickVerdict:'wrong type'})
})

test('summary rules flip at 2 wrong and 28 agreements',()=>{
  const samples=(wrong:number)=>Array.from({length:30},(_,i)=>({answer:(i<wrong?'wrong':'right') as 'wrong'|'right'}))
  const sticks=(agree:number)=>Array.from({length:30},(_,i)=>({answer:(i<agree?'right':'wrong') as 'right'|'wrong',stickVerdict:'correct'}))
  expect(reviewSummary(samples(1),sticks(27))).toMatchObject({sample:{wrong:1,relabel:false},stick:{agree:27,passes:false}})
  expect(reviewSummary(samples(2),sticks(28))).toMatchObject({sample:{wrong:2,relabel:true},stick:{agree:28,passes:true}})
})

test('server listens on loopback only and rejects another Host',async()=>{
  const a=server.address()
  expect(typeof a==='object'&&a?.address).toBe('127.0.0.1')
  const status=await new Promise<number>((resolve,reject)=>{
    http.get(address+'/api/summary',{headers:{host:'example.test'}},response=>{response.resume();resolve(response.statusCode||0)}).on('error',reject)
  })
  expect(status).toBe(403)
})

test('merged block geometry serves the queue and matching crop',async()=>{
  const dir=path.join(root,'labels','held'),sheet=JSON.parse(await fs.readFile(path.join(dir,'answer-sheet-v2.json'),'utf8'))
  sheet.entries=[{...agreed('merged-section',1),label:{...baseLabel,family:{disputed:true,a:'hero',b:'content'}}}]
  await fs.writeFile(path.join(dir,'answer-sheet-v2.json'),JSON.stringify(sheet))
  const original=JSON.parse(await fs.readFile(path.join(dir,'blocks.json'),'utf8'))
  await fs.writeFile(path.join(dir,'answer-sheet.json'),JSON.stringify({version:1,page:'held',snapshotSha256:original.snapshotSha256,entries:[{block:{...block('merged-section',1),box:{x:5,y:4,width:21,height:17}},label:{legacy:'discarded'}}]}))
  const item=(await get('disputes')).item
  expect(item).toMatchObject({blockId:'merged-section',region:'main'})
  const response=await fetch(address+item.cropUrl)
  expect(response.status).toBe(200)
  expect(await sharp(Buffer.from(await response.arrayBuffer())).metadata()).toMatchObject({width:21,height:17})
})

test('stick preview extracts HTML and structured image and link URLs',async()=>{
  const file=path.join(root,'arms','development','blocks-production','fixture-run','components.json')
  const rich={type:'hero',content:{heading:'A Clear Heading',bodyHtml:'<p>Useful imported description with <a href="/inside">inside link</a>.</p><img src="/inside.png">',description:'Long plain words '.repeat(40),date:'2026-09-24',tabs:[{label:'All updates'},{label:'Research'}],caption:'Figure caption',image:{url:'/photo.png'},link:{label:'Visit details',url:'/details?view=all&utm_source=fixture#tab'}},metadata:{region:'main',readingTime:'8 min read'}}
  await fs.writeFile(file,JSON.stringify(Array.from({length:32},()=>rich)))
  const imported=(await get('stick')).item.imported
  expect(imported.headings).toContain('a clear heading')
  expect(imported.text).toContain('useful imported description')
  expect(imported.text).toContain('long plain words '.repeat(40).trim())
  expect(imported.text.length).toBeGreaterThan(300)
  expect(imported.text).toContain('2026-09-24')
  expect(imported.text).toContain('all updates')
  expect(imported.text).toContain('research')
  expect(imported.text).toContain('figure caption')
  expect(imported.text).toContain('8 min read')
  expect(imported.images).toEqual(expect.arrayContaining(['https://example.test/inside.png','https://example.test/photo.png']))
  expect(imported.links).toEqual(expect.arrayContaining([{label:'Visit details',target:'https://example.test/details?view=all&utm_source=fixture#tab'}]))
  expect(imported.links.some((link:any)=>link.target==='https://example.test/inside')).toBe(true)
})

test('stick preview keeps HTML headings, anchor labels and each text passage once',async()=>{
  const file=path.join(root,'arms','development','blocks-production','fixture-run','components.json')
  const rich={type:'content',content:{bodyHtml:'<section><h2>Why teams choose us</h2><p>Useful imported description with <a href="/inside#details">Read details</a>.</p></section>'}}
  await fs.writeFile(file,JSON.stringify(Array.from({length:32},()=>rich)))
  const imported=(await get('stick')).item.imported
  expect(imported.headings).toContain('why teams choose us')
  expect(imported.links).toContainEqual({label:'Read details',target:'https://example.test/inside#details'})
  expect(imported.links).toHaveLength(1)
  expect(imported.text.match(/useful imported description/g)).toHaveLength(1)
})

test('stick preview pairs a structured button label with its fragment URL',async()=>{
  const file=path.join(root,'arms','development','blocks-production','fixture-run','components.json')
  const rich={type:'hero',content:{buttons:[{label:'Get Started Free',link:{url:'/inside#details'}}]}}
  await fs.writeFile(file,JSON.stringify(Array.from({length:32},()=>rich)))
  const imported=(await get('stick')).item.imported
  expect(imported.links).toEqual([{label:'Get Started Free',target:'https://example.test/inside#details'}])
})

test('round two samples fresh blocks and stores answers in separate files',async()=>{
  const firstSample=(await get('sample')).item,firstStick=(await get('stick')).item
  expect((await answer('sample',firstSample,{answer:'right'})).status).toBe(200)
  expect((await answer('stick',firstStick,{answer:'right'})).status).toBe(200)
  const roundOne=Array.from({length:30},(_,i)=>({page:'held',blockId:'held-'+i,answer:i<2?'wrong':'right',time:'2026-01-01T00:00:00Z',...(i<2?{correction:'content'}:{})}))
  await fs.writeFile(path.join(root,'labels','review-sample.json'),JSON.stringify(roundOne))
  const heldFile=path.join(root,'labels','held','answer-sheet-v2.json'),devFile=path.join(root,'labels','development','answer-sheet-v2.json')
  for(const [file,prefix] of [[heldFile,'held'],[devFile,'dev']] as const){const sheet=JSON.parse(await fs.readFile(file,'utf8'));sheet.entries.push(...Array.from({length:30},(_,i)=>agreed(prefix+'-new-'+i,34+i)));await fs.writeFile(file,JSON.stringify(sheet));const blocksFile=path.join(path.dirname(file),'blocks.json'),proposal=JSON.parse(await fs.readFile(blocksFile,'utf8'));proposal.blocks.push(...Array.from({length:30},(_,i)=>block(prefix+'-new-'+i,34+i)));await fs.writeFile(blocksFile,JSON.stringify(proposal))}
  const scoreFile=path.join(root,'labels','development','scores-stick','blocks-production--fixture-run--stick1.json')
  const score=JSON.parse(await fs.readFile(scoreFile,'utf8'));score.rows.push(...Array.from({length:30},(_,i)=>({id:'dev-new-'+i,verdict:'correct',componentIndices:[i]})));await fs.writeFile(scoreFile,JSON.stringify(score))
  await stop();server=await startReviewServer(0,{arm:'blocks-production',run:'fixture-run',round:2});const a=server.address();address='http://127.0.0.1:'+(typeof a==='object'&&a?a.port:0)
  const summary=await (await fetch(address+'/api/summary')).json() as any
  expect(summary.round).toBe(2)
  expect(summary.queues.sample.total).toBe(30)
  expect(summary.queues.sample.remaining).toBe(30)
  expect(summary.sample).toMatchObject({wrong:0,answered:0,relabel:false})
  expect(summary.queues.stick.total).toBe(30)
  const sample=(await get('sample')).item,stick=(await get('stick')).item
  expect(sample.blockId).not.toBe(firstSample.blockId)
  expect(stick.blockId).not.toBe(firstStick.blockId)
  expect((await answer('sample',sample,{answer:'wrong',correction:'content'})).status).toBe(200)
  const partial=await (await fetch(address+'/api/summary')).json() as any
  expect(partial.queues.sample.remaining).toBe(29)
  expect(partial.sample).toMatchObject({wrong:1,answered:1,relabel:false})
  expect((await answer('stick',stick,{answer:'right'})).status).toBe(200)
  expect(await fs.readFile(path.join(root,'labels','review-sample-round2.json'),'utf8')).toContain(sample.blockId)
  expect(await fs.readFile(path.join(root,'labels','stick-check-round2.json'),'utf8')).toContain(stick.blockId)
})

test('two one-image decoration answers carry distinct shared image numbers',async()=>{
  const dir=path.join(root,'labels','held'),file=path.join(dir,'answer-sheet-v2.json'),sheet=JSON.parse(await fs.readFile(file,'utf8'))
  const first='https://example.test/first.png',second='https://example.test/second.png'
  sheet.labellers={a:{out:'invented-a'}}
  sheet.entries[0].label={...baseLabel,decorativeImages:{disputed:true,a:[first],b:[second]}}
  await fs.writeFile(file,JSON.stringify(sheet))
  await fs.writeFile(path.join(dir,'label-invented-a.json'),JSON.stringify({entries:[{blockId:'held-dispute',evidence:{imageGroups:[{id:0,addresses:[first]},{id:1,addresses:[second]}]}}]}))
  const item=(await get('disputes')).item
  expect(item.choices.map((choice:any)=>choice.label)).toEqual(expect.arrayContaining([expect.stringContaining('Image 1'),expect.stringContaining('Image 2')]))
  expect(item.choices.map((choice:any)=>choice.decorationNumbers)).toEqual([[1],[2]])
  expect(item.decorationGroups.map((group:any)=>group.thumbnail)).toEqual([first,second])
})

test('review evaluation forwards the chosen arm and run',async()=>{
  const tasks=await planEvaluation(parseEval(['review','--arm','blocks-production','--run','fixture-run']),{})
  expect(tasks).toEqual([expect.objectContaining({script:'review-server.ts',args:['--arm','blocks-production','--run','fixture-run']})])
})

test('public choice and section-kind labels use readable wording',async()=>{
  const file=path.join(root,'labels','held','answer-sheet-v2.json'),sheet=JSON.parse(await fs.readFile(file,'utf8'))
  const kinds=['site-header','site-footer','local-nav','hero','content','collection','logo-strip','stats','testimonials','pricing','disclosure','cta','form','table','media']
  sheet.familyNames=kinds
  sheet.entries[0].label={family:{disputed:true,a:'site-header',b:'site-footer'},acceptableFamilies:{disputed:true,a:['site-header'],b:['site-footer']},multiple:{disputed:true,a:false,b:true},familiesInOrder:{disputed:true,a:['site-header'],b:['site-footer']},placement:{disputed:true,a:'header',b:'footer'},ignore:{disputed:true,a:false,b:true},ignoreReason:{disputed:true,a:'',b:'not useful'},itemCount:{disputed:true,a:2,b:3},itemKind:{disputed:true,a:'cards',b:'feed'},decorativeImages:[]}
  await fs.writeFile(file,JSON.stringify(sheet))
  const item=(await get('disputes')).item
  expect(item.familyNames.map((name:any)=>name.label)).toEqual(['Top menu','Bottom of page','Page menu','Opening banner','Text section','Repeated items (cards, posts, people)','Logo row','Key numbers','Quotes and reviews','Prices and plans','Expandable content (accordion or tabs)','Call to action','Form','Table or chart','Pictures, video or map'])
  expect(item.fields.map((field:any)=>field.label)).toEqual(expect.arrayContaining(['section kind','allowed section kinds','section kinds from top to bottom','number of items','type of item','where it sits','more than one section','skip this section']))
  const visible=JSON.stringify(item.choices)
  expect(visible).toContain('Top menu')
  expect(visible).toContain('where it sits: Top')
  expect(visible).not.toMatch(/\b(?:family|acceptableFamilies|familiesInOrder|itemCount|itemKind|placement|decorativeImages|multiple|ignore|true|false|site-header|site-footer|cards|feed)\b/)
})

test('a null family choice reads None',async()=>{
  const file=path.join(root,'labels','held','answer-sheet-v2.json'),sheet=JSON.parse(await fs.readFile(file,'utf8'))
  sheet.entries[0].label.family={disputed:true,a:null,b:'hero'}
  await fs.writeFile(file,JSON.stringify(sheet))
  const item=(await get('disputes')).item
  expect(item.choices.map((choice:any)=>choice.label)).toEqual([expect.stringMatching(/^None ·/),expect.stringMatching(/^Opening banner ·/)])
})

test('public request errors use plain wording while diagnostics retain the cause',async()=>{
  const diagnostic=jest.spyOn(console,'error').mockImplementation(()=>{})
  try {
    const item=(await get('disputes')).item
    const body=JSON.stringify({queue:'disputes',page:item.page,blockId:item.blockId,revision:item.revision,choiceId:item.choices[0].id})
    const origin=await fetch(address+'/api/answer',{method:'POST',headers:{origin:'https://elsewhere.test','content-type':'application/json'},body})
    const format=await fetch(address+'/api/answer',{method:'POST',headers:{'content-type':'text/plain'},body})
    const unexpected=await fetch(address+'/api/queue?queue=unknown')
    for(const response of [origin,format,unexpected]){
      expect(response.status).toBeGreaterThanOrEqual(400)
      expect((await response.json()).error).not.toMatch(/Cross-origin|application\/json|server log/i)
    }
    expect(JSON.stringify(diagnostic.mock.calls)).toMatch(/Cross-origin|application\/json|Unknown queue/)
  }finally{diagnostic.mockRestore()}
})
