/** @jest-environment node */
import fs from 'node:fs/promises'
import sharp from 'sharp'
import path from 'node:path'
import os from 'node:os'
import { share, totals, stability, splitResults, pickTotals, buildSummary, readSavedResults, type SavedResult } from './summary'
import { validatePages, initializePages, loadPages } from './pages'
import { parseEval, planEvaluation, authorizePlan, estimate } from './eval'
import { selectDraftEntries, repeatedHtmlChildren, draftLabels } from './draft-labels'
import { comparisonBlocks, comparisonProposal, comparisonSheet } from './phase3-fixtures'
import { atomicJson } from './labels'
import { scorePage } from './score'
import { scoreSheet } from './scoring'
import { startReviewServer } from './review-server'
import { summary } from './summary'
import { sheet, component } from './phase2-fixtures'
const originalRoot=process.env.IMPORT_LAB_ROOT, originalExit=process.exitCode
beforeEach(async()=>{process.env.IMPORT_LAB_ROOT=await fs.mkdtemp(path.join(os.tmpdir(),'import-lab-durability-'))})
afterEach(async()=>{await fs.rm(process.env.IMPORT_LAB_ROOT!,{recursive:true,force:true});if(originalRoot===undefined)delete process.env.IMPORT_LAB_ROOT;else process.env.IMPORT_LAB_ROOT=originalRoot;process.exitCode=originalExit})
const manifest=()=>validatePages({garden:{url:'https://example.com/',kind:'home',heldOut:false,renderWithJavaScript:true,notes:''},library:{url:'https://example.org/library',kind:'listing',heldOut:true,renderWithJavaScript:false,notes:''}})
const row=(id:string,verdict:string,ignored=false)=>({id,verdict,ignored,checks:{itemCount:{passed:false}}})
const result=(changes:Partial<SavedResult>={}):SavedResult=>({page:'garden',arm:'today-off',run:'r1',status:'complete',rows:[row('a','correct'),row('b','wrong type')],sheetHash:'same',reviewedBy:{a:'owner',b:'reviewer'},calls:[],seconds:null,issues:[],picks:[],record:{comparisonKey:'same'},...changes})
test('summary pools counts, excludes ignored blocks, and flags small shares',()=>{
  expect(share(1,4)).toBe('1/4 (25.0%) *');expect(share(0,0)).toContain('not measured')
  expect(totals([result(),result({rows:[row('c','right type, content incomplete'),row('d','correct',true)]})])).toMatchObject({blocks:3,correct:1,incomplete:1,wrong:1,right:2,ignored:1})
  expect(splitResults([result(),result({page:'library'})],manifest(),true).map(r=>r.page)).toEqual(['library'])
})
test('stability compares shared block IDs for every run pair, not matching positions',()=>{
  const a=result(), b=result({run:'r2',rows:[row('b','correct'),row('a','correct')]}), c=result({run:'r3',sheetHash:'changed'})
  expect(stability([a,b,c])).toEqual(expect.arrayContaining([expect.objectContaining({runs:['r1','r2'],same:1,blocks:2}),expect.objectContaining({runs:['r1','r3'],blocks:0,excluded:1})]))
})
test('probability bands include exact boundaries and confusions keep their counts',()=>{
  const rows=[0,0.1999,0.2,0.4,0.6,0.8,1].map((probability,i)=>({probability,top1:i%2===0,top3:true,pick:'hero',answer:['text-block']}))
  const p=pickTotals(rows);expect(p.bands.map(b=>b.blocks)).toEqual([2,1,1,1,2]);expect(p.top1).toBe(4);expect(p.top3).toBe(7);expect(p.confusions).toEqual([['hero → text-block',3]])
})
test('summary discovers arms and never uses held-out results to choose the best arm',()=>{
  const results=[result(),result({arm:'invented-arm',rows:[row('a','correct'),row('b','correct')]}),result({page:'library',arm:'heldout-winner',rows:[row('a','correct')]})]
  const summary=buildSummary(results,manifest());expect(summary.json.headline).toContain('invented-arm');expect(summary.markdown.split('\n').length).toBeLessThan(150);expect(summary.json.heldOut[0].name).toBe('heldout-winner/r1');expect(summary.json.reviewers.owner).toBe(2)
})
test('manifest validates settings and initialization never replaces an existing file',async()=>{
  expect(()=>validatePages({...manifest(),bad:{...manifest().garden,heldOut:'yes'}})).toThrow('Invalid page settings')
  expect(()=>validatePages({'../bad':manifest().garden})).toThrow()
  await atomicJson(path.join(process.env.IMPORT_LAB_ROOT!,'pages','garden','manifest.json'),{url:'https://example.com/'})
  await initializePages();expect((await loadPages()).garden.kind).toBe('home')
  await expect(initializePages()).rejects.toMatchObject({code:'EEXIST'})
})
test('dry evaluation plans preserve run IDs, skip existing folders, and require explicit spending',async()=>{
  await fs.mkdir(path.join(process.env.IMPORT_LAB_ROOT!,'runs','garden','run-1'),{recursive:true})
  const options=parseEval(['today','--runs','2','--dry-run']), tasks=await planEvaluation(options,manifest())
  expect(tasks).toHaveLength(4);expect(tasks.filter(t=>t.existing)).toHaveLength(1)
  expect(()=>authorizePlan(tasks,options)).not.toThrow();expect(()=>authorizePlan(tasks,{...options,dryRun:false})).toThrow('--yes-spend')
  expect(()=>authorizePlan(tasks,{...options,dryRun:false,yesSpend:true})).not.toThrow()
  expect(estimate([], 'new-arm')).toEqual({calls:null,cost:null})
  expect(await fs.readdir(path.join(process.env.IMPORT_LAB_ROOT!,'runs','garden'))).toEqual(['run-1'])
})
test('only-failed keeps successful drafts and reviewed corrections, rejects changed proposals',()=>{
  const proposal=comparisonProposal(), previous=comparisonSheet();previous.entries.forEach(e=>{e.status='draft';e.draftStatus='complete'});previous.entries[1].draftStatus='failed';previous.entries[2].draftStatus='failed'
  const reviewed=structuredClone(previous);reviewed.entries[2].status='corrected';reviewed.entries[2].reviewedBy='owner'
  const kept=selectDraftEntries(proposal,previous,reviewed,true);expect(kept.map(e=>e.block.id)).toEqual(['notice','noticeboard']);expect(kept[1].reviewedBy).toBe('owner')
  expect(()=>selectDraftEntries({...proposal,snapshotSha256:'changed'},previous,null,true)).toThrow('differ')
  expect(()=>selectDraftEntries(proposal,previous,null,false)).toThrow('--only-failed')
})
test('only-failed with no failures makes no new call batch and leaves reviewed labels untouched',async()=>{
  const directory=path.join(process.env.IMPORT_LAB_ROOT!,'labels','comparison-fixture'),proposal=comparisonProposal(), previous=comparisonSheet()
  await atomicJson(path.join(directory,'blocks.json'),proposal);await atomicJson(path.join(directory,'draft.json'),previous)
  expect(await draftLabels('comparison-fixture','example/vision',true,true)).toEqual(previous)
  await expect(fs.stat(path.join(directory,'calls'))).rejects.toMatchObject({code:'ENOENT'})
})
test('HTML item evidence counts hidden carousel slides and reports unresolved anchors',()=>{
  const b={...comparisonBlocks()[0],anchor:{path:[0],tag:'section',id:'notice',classes:[]}}
  const evidence=repeatedHtmlChildren('<section id="notice"><article><p>One</p></article><article hidden><p>Two</p></article><article hidden><p>Three</p></article></section>',b)
  expect(evidence.groups).toContainEqual({parent:'root[0]',signature:'article>p',count:3})
  expect(repeatedHtmlChildren('<p>Missing anchor</p>',b).issue).toContain('no longer resolves')
})
test('item count mismatches remain reported when excluded from verdict',()=>{
  const answer=sheet();answer.entries[0].label!.expected.itemCount=3;answer.entries[0].label!.expected.itemKind='slides'
  const normal=scoreSheet(answer,[component],'https://example.com/'),ignored=scoreSheet(answer,[component],'https://example.com/',{ignoreItemCount:true})
  expect(normal.rows[0].verdict).toBe('right type, content incomplete');expect(ignored.rows[0].verdict).toBe('correct');expect(ignored.itemCountMismatches).toHaveLength(1);expect(ignored.rows[0].checks.itemCount.passed).toBe(false)
})
test('all-runs skips dry runs without failing or writing a failed score',async()=>{
  const directory=path.join(process.env.IMPORT_LAB_ROOT!,'labels','comparison-fixture'),proposal=comparisonProposal(),answer=comparisonSheet()
  await atomicJson(path.join(directory,'blocks.json'),proposal);await atomicJson(path.join(directory,'answer-sheet.json'),answer)
  await atomicJson(path.join(process.env.IMPORT_LAB_ROOT!,'runs','comparison-fixture','preview','run.json'),{status:'dry-run'})
  await scorePage('comparison-fixture',{allRuns:true});expect(process.exitCode).toBe(originalExit)
  expect(await fs.readdir(path.join(directory,'scores'))).toEqual([])
})
test('occupied review port rejects with a clear instruction and the first server remains listening',async()=>{
  const server=await startReviewServer(0)
  try { const address=server.address();if(!address||typeof address==='string')throw new Error('No TCP address');await expect(startReviewServer(address.port)).rejects.toThrow('already in use');expect(server.listening).toBe(true) }
  finally { await new Promise<void>((resolve,reject)=>server.close(e=>e?reject(e):resolve())) }
})
test('summary leaves other saved reports byte-for-byte unchanged',async()=>{
  const directory=path.join(process.env.IMPORT_LAB_ROOT!,'reports');await fs.mkdir(directory,{recursive:true})
  for(const file of ['comparison.json','comparison.md','phase1.json','phase1.md'])await fs.writeFile(path.join(directory,file),'keep this saved report')
  await summary()
  for(const file of ['comparison.json','comparison.md','phase1.json','phase1.md'])expect(await fs.readFile(path.join(directory,file),'utf8')).toBe('keep this saved report')
  expect(await fs.readFile(path.join(directory,'SUMMARY.md'),'utf8')).toMatch(/^Component right:/)
})

test('only-failed writes requests only for failed blocks and keeps reviewed answers unchanged',async()=>{
  const directory=path.join(process.env.IMPORT_LAB_ROOT!,'labels','comparison-fixture'),proposal=comparisonProposal(),previous=comparisonSheet()
  previous.entries.forEach(e=>{e.status='draft';e.draftStatus='complete'});previous.entries[1].draftStatus='failed'
  const reviewed=structuredClone(previous);reviewed.entries[2].status='corrected';reviewed.entries[2].reviewedBy='owner'
  await atomicJson(path.join(directory,'blocks.json'),proposal);await atomicJson(path.join(directory,'draft.json'),previous);await atomicJson(path.join(directory,'answer-sheet.json'),reviewed)
  const original=await fs.readFile(path.join(directory,'answer-sheet.json'),'utf8')
  await sharp({create:{width:1440,height:540,channels:3,background:'#ffffff'}}).png().toFile(path.join(directory,'screenshot.png'))
  const next=await draftLabels('comparison-fixture','example/vision',true,true), batches=await fs.readdir(path.join(directory,'calls'))
  expect(await fs.readdir(path.join(directory,'calls',batches[0]))).toEqual(['hours.json'])
  expect(next.entries[0]).toEqual(previous.entries[0]);expect(next.entries[2]).toEqual(reviewed.entries[2]);expect(await fs.readFile(path.join(directory,'answer-sheet.json'),'utf8')).toBe(original)
})
test('existing scores survive rescoring with missing component inputs',async()=>{
  const directory=path.join(process.env.IMPORT_LAB_ROOT!,'labels','comparison-fixture'),proposal=comparisonProposal()
  await atomicJson(path.join(directory,'blocks.json'),proposal);await atomicJson(path.join(directory,'answer-sheet.json'),comparisonSheet())
  await atomicJson(path.join(directory,'scores','saved.json'),{status:'complete',proof:'unchanged'})
  const original=await fs.readFile(path.join(directory,'scores','saved.json'),'utf8')
  await scorePage('comparison-fixture',{components:path.join(directory,'missing.json'),name:'saved'})
  expect(await fs.readFile(path.join(directory,'scores','saved.json'),'utf8')).toBe(original)
})
test('many future arms stay below 150 lines without losing their tables',()=>{
  const rows=Array.from({length:80},(_,i)=>result({arm:'arm-'+i}))
  const summary=buildSummary(rows,manifest());expect(summary.markdown.split('\n').length).toBeLessThan(150)
  expect(summary.markdown).toContain('<table>');expect(summary.markdown).toContain('arm-79');expect(summary.json.all).toHaveLength(80)
})

test('summary reads saved scores for removed arms without their implementation',async()=>{
  const directory=process.env.IMPORT_LAB_ROOT!,answer=comparisonSheet()
  await atomicJson(path.join(directory,'labels',answer.page,'answer-sheet.json'),answer)
  await atomicJson(path.join(directory,'labels',answer.page,'scores','retired-fixture--r1.json'),{name:'retired-fixture--r1',status:'complete',rows:[row('notice','correct')]})
  await atomicJson(path.join(directory,'arms',answer.page,'retired-fixture','r1','run.json'),{status:'complete'})
  const saved=await readSavedResults(),report=buildSummary(saved,{})
  expect(report.json.byArm[0]).toMatchObject({arm:'retired-fixture',correct:1,blocks:1})
  expect(report.markdown).toContain('retired-fixture (arm removed from the tool)')
})
