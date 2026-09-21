/** @jest-environment node */
import fs from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import sharp from 'sharp'
import { scorePage } from './score'
import { draftLabels } from './draft-labels'
import { validateLabel, atomicJson, catalogue, labelDirectory, sha, type Proposal } from './labels'
import { block, label, entry, sheet, component } from './phase2-fixtures'
import { readJson } from './storage'
const originalRoot=process.env.IMPORT_LAB_ROOT,originalExit=process.exitCode
let directory:string
beforeEach(async()=>{
  process.env.IMPORT_LAB_ROOT=await fs.mkdtemp(path.join(os.tmpdir(),'import-lab-io-'))
  directory=labelDirectory('_fixture');await fs.mkdir(directory,{recursive:true})
  const proposal:Proposal={version:1,page:'_fixture',snapshotSha256:'fixture',finalUrl:'https://example.com/',javascriptEnabled:false,renderedHeight:300,viewportWidth:1440,blocks:[block()],issues:[],status:'complete'}
  await atomicJson(path.join(directory,'blocks.json'),proposal)
  await atomicJson(path.join(directory,'answer-sheet.json'),{...sheet(),proposalSha256:sha(proposal)})
})
afterEach(async()=>{await fs.rm(process.env.IMPORT_LAB_ROOT!,{recursive:true,force:true});if(originalRoot===undefined)delete process.env.IMPORT_LAB_ROOT;else process.env.IMPORT_LAB_ROOT=originalRoot;process.exitCode=originalExit})
test('bulk scoring preserves skipped arms and incomplete run reasons in saved scores',async()=>{
  const run=path.join(process.env.IMPORT_LAB_ROOT!,'runs','_fixture','run-1')
  await atomicJson(path.join(run,'run.json'),{status:'complete',snapshotSha256:'fixture'})
  await atomicJson(path.join(run,'arms.json'),{snapshotSha256:'fixture',arms:{off:{status:'complete',components:[component]},'on-as-production':{status:'skipped',reason:'Missing job-wide inputs'}}})
  await atomicJson(path.join(process.env.IMPORT_LAB_ROOT!,'runs','_fixture','dry','run.json'),{status:'dry-run'})
  await scorePage('_fixture',{allRuns:true})
  const score=await readJson(path.join(directory,'scores','run-1--off.json'))
  expect(score.counts.correct).toBe(1)
  const skipped=await readJson(path.join(directory,'scores','run-1--on-as-production.json'))
  expect(skipped.reason).toBe('Missing job-wide inputs')
  expect((await readJson(path.join(directory,'score-runs.json'))).outcomes).toContainEqual({run:'dry',status:'skipped',reason:'Dry run; no score written'})
  expect(process.exitCode).toBe(originalExit)
})
test('missing inputs produce a failed score artifact',async()=>{
  await expect(scorePage('_fixture',{components:path.join(directory,'missing.json'),name:'broken'})).rejects.toThrow()
  expect(await readJson(path.join(directory,'scores','broken.json'))).toMatchObject({status:'failed',name:'broken'})
})
test('dry-run saves one request with image size, full catalogue, no reply or approvals',async()=>{
  const proposal=await readJson<Proposal>(path.join(directory,'blocks.json'));directory=labelDirectory('_draft_fixture');await atomicJson(path.join(directory,'blocks.json'),{...proposal,page:'_draft_fixture'})
  await sharp({create:{width:1440,height:300,channels:3,background:'#ffffff'}}).png().toFile(path.join(directory,'screenshot.png'))
  const draft=await draftLabels('_draft_fixture','example/vision-test',true)
  expect(draft.entries).toHaveLength(1);expect(draft.entries[0]).toMatchObject({status:'draft',draftStatus:'dry-run',label:null})
  const batch=(await fs.readdir(path.join(directory,'calls')))[0]
  const call=await readJson(path.join(directory,'calls',batch,'hero.json'))
  expect(call.model).toBe('example/vision-test');expect(call.status).toBe('planned');expect(call.usage).toBeNull();expect(call.rawReply).toBeUndefined()
  const parts=call.payload.messages[1].content;expect(parts[1].image_url.url).toMatch(/^\[PNG image: \d+ bytes;/)
  const prompt=JSON.parse(parts[0].text);expect(prompt.catalogue.length).toBeGreaterThan(20);expect(prompt.catalogue.find((c:any)=>c.type==='hero-banner').description).toBeTruthy()
})

test('catalogue returns distinct types including testimonials',async()=>{
  const types=(await catalogue()).map(entry=>entry.type)
  expect(new Set(types).size).toBe(types.length)
  expect(types).toContain('testimonials')
})

import { changeSheet } from './review-server'
const types=['hero','card-grid','footer']
test('approval is explicit and rejects an altered draft',()=>{const s=sheet([entry({status:'draft'})]);expect(changeSheet(s,{blockId:'hero',action:'approve',label:label()},types).entries[0].status).toBe('approved');expect(()=>changeSheet(s,{blockId:'hero',action:'approve',label:label({bestType:'footer',acceptableTypes:['footer']})},types)).toThrow('Save correction');expect(s.entries[0].status).toBe('draft')})
test('correction validates schema and catalogue',()=>{expect(()=>validateLabel({...label(),bestType:'imaginary'},types)).toThrow();expect(()=>validateLabel({...label(),expected:{itemCount:-1}},types)).toThrow();expect(()=>validateLabel(label({ignore:true,ignoreReason:''}),types)).toThrow();expect(changeSheet(sheet(),{blockId:'hero',action:'correct',label:label({bestType:'footer',acceptableTypes:['footer']})},types).entries[0].status).toBe('corrected')})
test('merge preserves content, source anchors and resets review',()=>{const s=sheet([entry(),entry({block:block({id:'next',order:2,text:'second block',box:{x:0,y:300,width:1440,height:200}})})]);const merged=changeSheet(s,{blockId:'hero',action:'merge'},types);expect(merged.entries).toHaveLength(1);expect(merged.entries[0].status).toBe('draft');expect(merged.entries[0].block.box.height).toBe(500);expect(merged.entries[0].block.text).toContain('second block');expect(merged.entries[0].block.sourceAnchors).toHaveLength(2);const split=changeSheet(merged,{blockId:merged.entries[0].block.id,action:'split'},types);expect(split.entries.map(e=>e.block.id)).toEqual(['hero','next']);expect(split.entries.every(e=>e.status==='draft')).toBe(true)})
test('split uses stored children, renumbers and clears labels',()=>{const s=sheet([entry({block:block({children:[block({id:'a'}),block({id:'b'})]})})]);const result=changeSheet(s,{blockId:'hero',action:'split'},types);expect(result.entries.map(e=>e.block.order)).toEqual([1,2]);expect(result.entries.every(e=>e.status==='draft'&&e.label?.bestType===null)).toBe(true)})
test('ignore does not auto-approve; single children cannot split',()=>{const result=changeSheet(sheet(),{blockId:'hero',action:'ignore',reason:'Cookie notice'},types);expect(result.entries[0].status).toBe('draft');expect(result.entries[0].label?.ignore).toBe(true);expect(()=>changeSheet(sheet(),{blockId:'hero',action:'split'},types)).toThrow();expect(sha(result)).not.toBe(sha(sheet()))})

test('approval treats acceptable types as a set',()=>{const s=sheet([entry({status:'draft',label:label({acceptableTypes:['hero','footer']})})]);expect(changeSheet(s,{blockId:'hero',action:'approve',label:label({acceptableTypes:['footer','hero']})},types).entries[0].status).toBe('approved')})
