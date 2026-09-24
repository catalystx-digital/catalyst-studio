/** @jest-environment node */
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import sharp from 'sharp'
import { validatePages, setSiteKind } from './pages'
import { validateFamilyLabel, atomicJson, familyBlockSource, sha, type FamilyLabel, type FamilyDraftEntry } from './labels'
import { compareLabels, familyKappa, mergePage } from './merge-labels'
import { draftLabels, selectFailedEntries, buildFamilyRequest } from './draft-labels'
import { comparisonProposal, comparisonSheet, comparisonSnapshot } from './phase3-fixtures'
import { evaluate, parseEval } from './eval'
import { blockEvidence } from './source-evidence'

const names=['hero','content','collection']
const label=():FamilyLabel=>({family:'hero',acceptableFamilies:['hero'],multiple:false,familiesInOrder:[],placement:'main',ignore:false,ignoreReason:'',itemCount:null,itemKind:null,decorativeImages:[],reason:'Visible introduction.'})
const originalRoot=process.env.IMPORT_LAB_ROOT
const originalExit=process.exitCode
let root:string
beforeEach(async()=>{root=await fs.mkdtemp(path.join(os.tmpdir(),'family-labels-'));process.env.IMPORT_LAB_ROOT=root})
afterEach(async()=>{await fs.rm(root,{recursive:true,force:true});if(originalRoot===undefined)delete process.env.IMPORT_LAB_ROOT;else process.env.IMPORT_LAB_ROOT=originalRoot;process.exitCode=originalExit})

test('manifest rejects missing and unknown site kinds; setter changes only one entry',async()=>{
  const pages={alpha:{url:'https://invented.example/a',kind:'home',heldOut:false,renderWithJavaScript:false,notes:'',siteKind:'saas'},beta:{url:'https://invented.example/b',kind:'article',heldOut:true,renderWithJavaScript:false,notes:'',siteKind:'education'}}
  expect(()=>validatePages({alpha:{...pages.alpha,siteKind:undefined}})).toThrow()
  expect(()=>validatePages({alpha:{...pages.alpha,siteKind:'unknown'}})).toThrow()
  await atomicJson(path.join(root,'pages.json'),pages)
  await setSiteKind('alpha','health')
  expect(JSON.parse(await fs.readFile(path.join(root,'pages.json'),'utf8'))).toEqual({...pages,alpha:{...pages.alpha,siteKind:'health'}})
})

test.each([
  [{family:'unknown'},'Unknown family'],
  [{acceptableFamilies:['unknown']},'Unknown family'],
  [{familiesInOrder:['hero','unknown'],multiple:true},'Unknown family'],
  [{acceptableFamilies:[]},'include'],
  [{multiple:true,familiesInOrder:['hero']},'Multiple'],
  [{multiple:false,familiesInOrder:['hero','content']},'Multiple'],
  [{ignore:true,ignoreReason:''},'Explain'],
  [{itemCount:3,itemKind:null},'item'],
  [{itemCount:-1,itemKind:'cards'},''],
] as const)('family label validation rejects %p', (change,part)=>{
  expect(()=>validateFamilyLabel({...label(),...change},names)).toThrow(part||undefined)
})

test('request contains source evidence and families, without importer or other labels',()=>{
  const request=buildFamilyRequest('vendor/model',{text:[{text:'Invented page heading',region:'main'}],headings:['Invented page heading'],links:[],images:[{id:0,addresses:['https://invented.example/image.png'],width:240,height:120,alt:'Illustration',kind:'image'}],wordCount:3,sourceText:'Invented page heading'},[{type:'hero',description:'Page introduction',types:[]}],{groups:[],issue:null},'[PNG crop]','Precedence rule','Granularity rule')
  const serial=JSON.stringify(request)
  expect(serial).toContain('Page introduction')
  expect(JSON.parse((request.messages[1].content as any[])[0].text).imageGroups[0].id).toBe(0)
  expect(serial).toContain('Label what the source shows; do not guess what an importer would produce.')
  expect(serial).not.toMatch(/importerOutput|decisionPick|otherLabel|bestType|acceptableTypes/)
})

test('existing output is refused; only-failed selects failed entries',async()=>{
  const proposal=comparisonProposal(), directory=path.join(root,'labels',proposal.page)
  await atomicJson(path.join(directory,'blocks.json'),proposal)
  const previous={version:2,page:proposal.page,model:'vendor/model',snapshotSha256:proposal.snapshotSha256,proposalSha256:'x',entries:[{blockId:'notice',draftStatus:'complete' as const,label:label()},{blockId:'hours',draftStatus:'failed' as const,label:null},{blockId:'noticeboard',draftStatus:'complete' as const,label:label()}]}
  await atomicJson(path.join(directory,'label-a.json'),previous)
  expect(selectFailedEntries(proposal.blocks,previous.entries).map(e=>e.id)).toEqual(['hours'])
  expect(selectFailedEntries(proposal.blocks,previous.entries.slice(0,1)).map(e=>e.id)).toEqual(['hours','noticeboard'])
  await expect(draftLabels({page:proposal.page,model:'vendor/model',out:'a',catalogue:path.join(__dirname,'component-families.json'),set:'C',dryRun:true})).rejects.toThrow('already exists')
})

test('merge agrees field by field and preserves explicit disputes',()=>{
  const a=label(),b={...label(),family:'content',acceptableFamilies:['content'],placement:'footer' as const,itemCount:3,itemKind:'cards'}
  const result=compareLabels(a,b,undefined,{detectedCount:null,imageGroups:[]})
  expect(result.status).toBe('disputed')
  expect(result.label.family).toMatchObject({disputed:true,a:'hero',b:'content'})
  expect(result.label.placement).toMatchObject({disputed:true,a:'main',b:'footer'})
  expect(result.label.ignore).toBe(false)
})

test('code count and decorative rules settle only supported differences',()=>{
  const a={...label(),itemCount:3,itemKind:'cards',decorativeImages:['https://invented.example/tiny.png']}
  const b={...label(),itemCount:4,itemKind:'cards',decorativeImages:[]}
  const result=compareLabels(a,b,undefined,{detectedCount:4,imageGroups:[{id:0,addresses:['https://invented.example/tiny.png'],width:1,height:1,alt:'',kind:'image'}]})
  expect(result.label.itemCount).toBe(4)
  expect(result.label.decorativeImages).toEqual(['https://invented.example/tiny.png'])
})

test('third model settles development family majority; held-out ignores it',()=>{
  const a=label(),b={...label(),family:'content',acceptableFamilies:['content']},c={...label(),family:'content',acceptableFamilies:['content']}
  expect(compareLabels(a,b,c,{detectedCount:null,imageGroups:[],heldOut:false}).label.family).toBe('content')
  expect(compareLabels(a,b,c,{detectedCount:null,imageGroups:[],heldOut:true}).label.family).toMatchObject({disputed:true})
  expect(compareLabels(a,b,{...label(),family:'collection',acceptableFamilies:['collection']},{detectedCount:null,imageGroups:[],heldOut:false}).label.family).toMatchObject({disputed:true})
})

test('acceptable lists intersect; multiple order and unresolved counts remain disputed',()=>{
  const a={...label(),acceptableFamilies:['hero','content'],multiple:true,familiesInOrder:['hero','content'],itemCount:3,itemKind:'cards'}
  const b={...label(),acceptableFamilies:['hero','collection'],multiple:true,familiesInOrder:['content','hero'],itemCount:4,itemKind:'cards'}
  const result=compareLabels(a,b,undefined,{detectedCount:null,imageGroups:[]})
  expect(result.label.acceptableFamilies).toEqual(['hero'])
  expect(result.label.multiple).toMatchObject({disputed:true})
  expect(result.label.familiesInOrder).toMatchObject({disputed:true})
  expect(result.label.itemCount).toMatchObject({disputed:true})
})

test('clone images from source HTML stay flagged; shared content addresses stay disputed',()=>{
  const address='https://invented.example/copy.png',html=`<html><body><section><img src="${address}" width="300" height="200"><div class="slick-cloned"><h2>Duplicate heading</h2><img src="${address}" width="300" height="200"><div style="background-image:url('/clone-bg.png')" width="300" height="200"></div></div></section></body></html>`
  const block={...comparisonProposal().blocks[0],anchor:{path:[0],tag:'section',id:'',classes:[]},sourceAnchors:undefined}
  const evidence=blockEvidence(html,[],block,{tree:{anchorKey:'body',children:[]}},'https://invented.example/',true)
  const occurrences=evidence.images.filter(group=>group.addresses.includes(address))
  expect(occurrences.map(group=>group.clonedCarouselCopy)).toEqual([false,true])
  expect(evidence.images.find(group=>group.kind==='background')?.clonedCarouselCopy).toBe(true)
  expect(evidence.headings).not.toContain('Duplicate heading')
  const a={...label(),decorativeImages:[address]},b=label()
  expect(compareLabels(a,b,undefined,{detectedCount:null,imageGroups:evidence.images.map((group,id)=>({...group,id,alt:group.alt||''}))}).label.decorativeImages).toMatchObject({disputed:true})
  const cloneOnly=evidence.images.filter(group=>group.clonedCarouselCopy).map((group,id)=>({...group,id,alt:group.alt||''}))
  expect(compareLabels(a,b,undefined,{detectedCount:null,imageGroups:cloneOnly}).label.decorativeImages).toEqual([address])
})

test('kappa matches a hand-computed balanced fixture',()=>{
  expect(familyKappa([['hero','hero'],['hero','hero'],['content','content'],['content','hero']])).toBeCloseTo(0.5)
})

test('fake saved labellers merge invented blocks without touching version one',async()=>{
  const proposal=comparisonProposal(),directory=path.join(root,'labels',proposal.page)
  await atomicJson(path.join(directory,'blocks.json'),proposal)
  const oldSheet=comparisonSheet();await atomicJson(path.join(directory,'answer-sheet.json'),oldSheet)
  await atomicJson(path.join(root,'pages.json'),{[proposal.page]:{url:'https://invented.example/',kind:'home',siteKind:'saas',heldOut:false,renderWithJavaScript:false,notes:''}})
  const entries:FamilyDraftEntry[]=proposal.blocks.map((block,i)=>({blockId:block.id,draftStatus:'complete',label:i===2?{...label(),family:'content',acceptableFamilies:['content']}:label(),evidence:{detectedCount:null,imageGroups:[]}}))
  for(const [out,model,rows] of [['a','vendor-a/model',entries],['b','vendor-b/model',entries.map((entry,i)=>i===2?{...entry,label:label()}:entry)]] as const)await atomicJson(path.join(directory,`label-${out}.json`),{version:2,page:proposal.page,model,familySet:'C',familyNames:names,catalogueSha256:'fixture',snapshotSha256:proposal.snapshotSha256,proposalSha256:sha(proposal),entries:rows})
  const result=await mergePage(proposal.page,'a','b')
  expect(result.entries.map(e=>e.status)).toEqual(['agreed','agreed','disputed'])
  const agreement=JSON.parse(await fs.readFile(path.join(root,'labels','agreement.json'),'utf8'))
  expect(agreement.perField.family).toMatchObject({agreed:2,total:3,rate:2/3})
  expect(agreement.disputedBlocks.development).toBe(1)
  expect(agreement.trustworthy).toBe(false)
  expect(process.exitCode).toBe(1)
  expect(await fs.readFile(path.join(directory,'answer-sheet.json'),'utf8')).toContain('Invented standalone notice.')
  await expect(mergePage(proposal.page,'a','b')).rejects.toThrow('already exists')
})

test('two fake clients draft source-only labels, resume a failure, and merge',async()=>{
  const proposal=comparisonProposal(),directory=path.join(root,'labels',proposal.page)
  await atomicJson(path.join(directory,'blocks.json'),proposal)
  await atomicJson(path.join(directory,'geometry.json'),{tree:{anchorKey:'body',children:[]}})
  await atomicJson(path.join(root,'pages.json'),{[proposal.page]:{url:'https://invented.example/',kind:'home',siteKind:'saas',heldOut:false,renderWithJavaScript:false,notes:''}})
  const pageDir=path.join(root,'pages',proposal.page);await fs.mkdir(pageDir,{recursive:true})
  await fs.writeFile(path.join(pageDir,'page.html'),comparisonSnapshot().html)
  await atomicJson(path.join(pageDir,'stylesheets.json'),[])
  await sharp({create:{width:1440,height:540,channels:3,background:'#ffffff'}}).png().toFile(path.join(directory,'screenshot.png'))
  const catalogue=path.join(__dirname,'component-families.json')
  const fake=(disagree:boolean,failOnce=false)=>{
    let calls=0
    return {get calls(){return calls},chat:{completions:{create:async(payload:any)=>{
      calls++
      if(failOnce&&calls===2)throw new Error('Invented temporary failure')
      const prompt=JSON.parse(payload.messages[1].content[0].text)
      expect(prompt).not.toHaveProperty('importerOutput')
      const isLast=JSON.stringify(prompt).toLowerCase().includes('community noticeboard message')
      const result={...label(),family:disagree&&isLast?'content':'hero',acceptableFamilies:[disagree&&isLast?'content':'hero'],decorativeImageGroupIds:[]}
      delete (result as any).decorativeImages
      return {choices:[{message:{content:JSON.stringify(result)}}],usage:{total_tokens:100,cost:0.001}}
    }}}}
  }
  const a=fake(false,true),b=fake(true)
  await draftLabels({page:proposal.page,catalogue,set:'C',model:'vendor-a/model',out:'a'},a)
  expect(a.calls).toBe(3)
  process.exitCode=originalExit
  await draftLabels({page:proposal.page,catalogue,set:'C',model:'vendor-a/model',out:'a',onlyFailed:true},a)
  expect(a.calls).toBe(4)
  await draftLabels({page:proposal.page,catalogue,set:'C',model:'vendor-b/model',out:'b'},b)
  expect(b.calls).toBe(3)
  await evaluate(parseEval(['merge','--a','a','--b','b']))
  const merged=JSON.parse(await fs.readFile(path.join(directory,'answer-sheet-v2.json'),'utf8'))
  expect(merged.entries.map((entry:{status:string})=>entry.status)).toEqual(['agreed','agreed','disputed'])
  expect((await fs.readdir(path.join(directory,'calls'))).length).toBe(3)
})

test('v1 merged block supplies drafting, hash and merge boundaries without old labels',async()=>{
  const proposal=comparisonProposal(),directory=path.join(root,'labels',proposal.page),old=comparisonSheet()
  const [first,second]=proposal.blocks
  const merged={...first,id:'merged-collection',sourceAnchors:[first.anchor!,second.anchor!],anchor:first.anchor,box:{x:0,y:0,width:1440,height:360},text:first.text+' '+second.text,headings:[...first.headings,...second.headings]}
  old.entries=[{...old.entries[0],block:merged},old.entries[2]]
  old.entries[0].label!.reason='OLD_LABEL_SENTINEL'
  await atomicJson(path.join(directory,'blocks.json'),proposal)
  await atomicJson(path.join(directory,'answer-sheet.json'),old)
  const source=await familyBlockSource(proposal.page)
  expect(source.blocks.map(block=>block.id)).toEqual(['merged-collection','noticeboard'])
  expect(JSON.stringify(source)).not.toContain('OLD_LABEL_SENTINEL')
  await atomicJson(path.join(directory,'geometry.json'),{tree:{anchorKey:'body',children:[]}})
  await atomicJson(path.join(root,'pages.json'),{[proposal.page]:{url:'https://invented.example/',kind:'home',siteKind:'saas',heldOut:false,renderWithJavaScript:false,notes:''}})
  const pageDir=path.join(root,'pages',proposal.page);await fs.mkdir(pageDir,{recursive:true})
  await fs.writeFile(path.join(pageDir,'page.html'),comparisonSnapshot().html)
  await atomicJson(path.join(pageDir,'stylesheets.json'),[])
  await sharp({create:{width:1440,height:540,channels:3,background:'#ffffff'}}).png().toFile(path.join(directory,'screenshot.png'))
  const fake={chat:{completions:{create:async(payload:any)=>{expect(JSON.stringify(payload)).not.toContain('OLD_LABEL_SENTINEL');const answer={...label(),decorativeImageGroupIds:[]};delete (answer as any).decorativeImages;return {choices:[{message:{content:JSON.stringify(answer)}}],usage:{cost:0}}}}}}
  for(const [out,model] of [['a','vendor-a/model'],['b','vendor-b/model']])await draftLabels({page:proposal.page,catalogue:path.join(__dirname,'component-families.json'),set:'C',model,out},fake)
  const draft=JSON.parse(await fs.readFile(path.join(directory,'label-a.json'),'utf8'))
  expect(draft.entries.map((entry:FamilyDraftEntry)=>entry.blockId)).toEqual(['merged-collection','noticeboard'])
  expect(draft.proposalSha256).toBe(sha(source))
  const result=await mergePage(proposal.page,'a','b')
  expect(result.entries.map(entry=>entry.blockId)).toEqual(['merged-collection','noticeboard'])
})

test('interrupted draft resumes pending and absent entries, preserving complete labels',async()=>{
  const proposal=comparisonProposal(),directory=path.join(root,'labels',proposal.page)
  await atomicJson(path.join(directory,'blocks.json'),proposal)
  await atomicJson(path.join(directory,'geometry.json'),{tree:{anchorKey:'body',children:[]}})
  const pageDir=path.join(root,'pages',proposal.page);await fs.mkdir(pageDir,{recursive:true})
  await fs.writeFile(path.join(pageDir,'page.html'),comparisonSnapshot().html)
  await atomicJson(path.join(pageDir,'stylesheets.json'),[])
  await sharp({create:{width:1440,height:540,channels:3,background:'#ffffff'}}).png().toFile(path.join(directory,'screenshot.png'))
  const catalogue=path.join(__dirname,'component-families.json')
  let calls=0
  const interrupt={chat:{completions:{create:async()=>{calls++;if(calls===1){const started=JSON.parse(await fs.readFile(path.join(directory,'label-a.json'),'utf8'));expect(started.entries.map((entry:FamilyDraftEntry)=>entry.draftStatus)).toEqual(['pending','pending','pending'])}if(calls===2)throw new Error('Interrupted');const answer={...label(),decorativeImageGroupIds:[]};delete (answer as any).decorativeImages;return {choices:[{message:{content:JSON.stringify(answer)}}]}}}}}
  await draftLabels({page:proposal.page,catalogue,set:'C',model:'vendor/model',out:'a'},interrupt)
  const file=path.join(directory,'label-a.json'),saved=JSON.parse(await fs.readFile(file,'utf8'))
  expect(saved.entries.map((entry:FamilyDraftEntry)=>entry.draftStatus)).toEqual(['complete','failed','complete'])
  saved.entries[1].draftStatus='pending';saved.entries.pop()
  await atomicJson(file,saved)
  const retry={chat:{completions:{create:async()=>{calls++;const answer={...label(),decorativeImageGroupIds:[]};delete (answer as any).decorativeImages;return {choices:[{message:{content:JSON.stringify(answer)}}]}}}}}
  await draftLabels({page:proposal.page,catalogue,set:'C',model:'vendor/model',out:'a',onlyFailed:true},retry)
  const resumed=JSON.parse(await fs.readFile(file,'utf8'))
  expect(calls).toBe(5)
  expect(resumed.entries.map((entry:FamilyDraftEntry)=>entry.draftStatus)).toEqual(['complete','complete','complete'])
  expect(resumed.entries[0].label).toEqual(saved.entries[0].label)
})

test('crop preparation failure is recorded per block and later blocks complete',async()=>{
  const proposal=comparisonProposal(),directory=path.join(root,'labels',proposal.page)
  proposal.blocks[1].box={x:5000,y:0,width:100,height:100}
  await atomicJson(path.join(directory,'blocks.json'),proposal)
  await atomicJson(path.join(directory,'geometry.json'),{tree:{anchorKey:'body',children:[]}})
  const pageDir=path.join(root,'pages',proposal.page);await fs.mkdir(pageDir,{recursive:true})
  await fs.writeFile(path.join(pageDir,'page.html'),comparisonSnapshot().html)
  await atomicJson(path.join(pageDir,'stylesheets.json'),[])
  await sharp({create:{width:1440,height:540,channels:3,background:'#ffffff'}}).png().toFile(path.join(directory,'screenshot.png'))
  let calls=0
  const fake={chat:{completions:{create:async()=>{calls++;const answer={...label(),decorativeImageGroupIds:[]};delete (answer as any).decorativeImages;return {choices:[{message:{content:JSON.stringify(answer)}}]}}}}}
  await draftLabels({page:proposal.page,catalogue:path.join(__dirname,'component-families.json'),set:'C',model:'vendor/model',out:'a'},fake)
  const saved=JSON.parse(await fs.readFile(path.join(directory,'label-a.json'),'utf8'))
  expect(calls).toBe(2)
  expect(saved.entries.map((entry:FamilyDraftEntry)=>entry.draftStatus)).toEqual(['complete','failed','complete'])
  expect(saved.entries[1].error).toContain('outside screenshot')
  const callRuns=await fs.readdir(path.join(directory,'calls'))
  const failedCall=JSON.parse(await fs.readFile(path.join(directory,'calls',callRuns[0],'hours.json'),'utf8'))
  expect(failedCall).toMatchObject({status:'failed',payload:null})
  process.exitCode=originalExit
})

test('batch merge checks final agreement once, including an all-skipped rerun, and reports C',async()=>{
  const manifest:Record<string,unknown>={}
  for(const [page,count] of [['alpha',3],['beta',20]] as const){
    const base=comparisonProposal(),proposal={...base,page,blocks:Array.from({length:count},(_,index)=>({...base.blocks[index%3],id:page+'-'+index,order:index+1}))}
    const directory=path.join(root,'labels',page)
    await atomicJson(path.join(directory,'blocks.json'),proposal)
    manifest[page]={url:'https://invented.example/'+page,kind:'home',siteKind:'saas',heldOut:false,renderWithJavaScript:false,notes:''}
    const entries=(vendor:'a'|'b'|'c'):FamilyDraftEntry[]=>proposal.blocks.map((block,index)=>{
      const family=page==='alpha'?(vendor==='a'&&index===2?'content':'hero'):(index<10?'hero':'content')
      const value={...label(),family,acceptableFamilies:[family]}
      if(vendor==='c'&&index===0){value.ignore=true;value.ignoreReason='Invented decoration';value.family=null as any;value.acceptableFamilies=[]}
      return {blockId:block.id,draftStatus:'complete',label:value,evidence:{detectedCount:null,imageGroups:[]}}
    })
    for(const [out,model] of [['a','vendor-a/model'],['b','vendor-b/model'],['c','vendor-c/model']])await atomicJson(path.join(directory,`label-${out}.json`),{version:2,page,model,familySet:'C',familyNames:names,catalogueSha256:'fixture',snapshotSha256:proposal.snapshotSha256,proposalSha256:sha(proposal),entries:entries(out as 'a'|'b'|'c')})
  }
  await atomicJson(path.join(root,'pages.json'),manifest)
  await evaluate(parseEval(['merge','--a','a','--b','b','--c','c']))
  const agreementFile=path.join(root,'labels','agreement.json')
  const agreement=JSON.parse(await fs.readFile(agreementFile,'utf8'))
  expect(agreement).toMatchObject({blocks:23,trustworthy:true,ignoreCount:{c:2}})
  expect(agreement.averageAcceptableWidth.c).toBeLessThan(1)
  expect(process.exitCode).toBe(originalExit)
  const changed=JSON.parse(await fs.readFile(path.join(root,'labels','beta','label-b.json'),'utf8'))
  changed.entries.forEach((entry:FamilyDraftEntry)=>{entry.label={...label(),family:'hero',acceptableFamilies:['hero']}})
  await atomicJson(path.join(root,'labels','beta','label-b.json'),changed)
  await evaluate(parseEval(['merge','--a','a','--b','b','--c','c']))
  expect(JSON.parse(await fs.readFile(agreementFile,'utf8')).trustworthy).toBe(false)
  expect(process.exitCode).toBe(1)
})
