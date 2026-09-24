/** @jest-environment node */
import fs from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import { scorePage } from './score'
import { parseEval, planEvaluation } from './eval'
import { validateLabel, atomicJson, catalogue, labelDirectory, sha, type Proposal } from './labels'
import { block, label, sheet, component, fixtureHtml } from './phase2-fixtures'
import { digest, readJson } from './storage'
import { stickScoreName } from './stick-version'
const originalRoot=process.env.IMPORT_LAB_ROOT,originalExit=process.exitCode
let directory:string
beforeEach(async()=>{
  process.env.IMPORT_LAB_ROOT=await fs.mkdtemp(path.join(os.tmpdir(),'import-lab-io-'))
  directory=labelDirectory('_fixture');await fs.mkdir(directory,{recursive:true})
  const proposal:Proposal={version:1,page:'_fixture',snapshotSha256:digest(fixtureHtml),finalUrl:'https://example.com/',javascriptEnabled:false,renderedHeight:300,viewportWidth:1440,blocks:[block()],issues:[],status:'complete'}
  await atomicJson(path.join(directory,'blocks.json'),proposal)
  await atomicJson(path.join(directory,'answer-sheet.json'),{...sheet(),snapshotSha256:proposal.snapshotSha256,proposalSha256:sha(proposal)})
  await atomicJson(path.join(directory,'geometry.json'),{tree:{anchorKey:'body',children:[]}})
  const page=path.join(process.env.IMPORT_LAB_ROOT!,'pages','_fixture');await fs.mkdir(page,{recursive:true});await fs.writeFile(path.join(page,'page.html'),fixtureHtml);await atomicJson(path.join(page,'stylesheets.json'),[])
})
afterEach(async()=>{await fs.rm(process.env.IMPORT_LAB_ROOT!,{recursive:true,force:true});if(originalRoot===undefined)delete process.env.IMPORT_LAB_ROOT;else process.env.IMPORT_LAB_ROOT=originalRoot;process.exitCode=originalExit})
test('bulk scoring retains completed sections from a failed run',async()=>{
  const run=path.join(process.env.IMPORT_LAB_ROOT!,'arms','_fixture','blocks-production','run-1')
  await atomicJson(path.join(run,'run.json'),{snapshotSha256:digest(fixtureHtml),status:'failed',failures:[{stage:'fill',sectionKey:'other'}]})
  await atomicJson(path.join(run,'components.json'),[component])
  const failed=path.join(process.env.IMPORT_LAB_ROOT!,'arms','_fixture','blocks-production','run-stage')
  await atomicJson(path.join(failed,'run.json'),{snapshotSha256:digest(fixtureHtml),status:'failed',failures:[{stage:'run'}]})
  await atomicJson(path.join(failed,'components.json'),[component])
  await scorePage('_fixture',{allRuns:true})
  expect((await readJson(path.join(directory,'scores-stick',stickScoreName('blocks-production','run-1')+'.json'))).counts.missed).toBe(0)
  expect((await readJson(path.join(directory,'scores-stick',stickScoreName('blocks-production','run-stage')+'.json'))).counts.missed).toBe(1)
})
test('missing manual components mark every block missed',async()=>{
  await scorePage('_fixture',{components:path.join(directory,'missing.json'),name:'broken'})
  expect((await readJson(path.join(directory,'scores-stick','broken.json'))).counts.missed).toBe(1)
})

test('manual score honors the saved run stage',async()=>{
  const folder=path.join(process.env.IMPORT_LAB_ROOT!,'arms','_fixture','blocks-production','manual')
  await atomicJson(path.join(folder,'components.json'),[component])
  await atomicJson(path.join(folder,'run.json'),{snapshotSha256:digest(fixtureHtml),status:'failed',failures:[{stage:'run'}]})
  await scorePage('_fixture',{components:path.join(folder,'components.json'),name:'manual-stage'})
  expect((await readJson(path.join(directory,'scores-stick','manual-stage.json'))).counts.missed).toBe(1)
})
test('the same input preserves identical score bytes',async()=>{
  const input=path.join(directory,'components.json');await atomicJson(input,[component])
  await atomicJson(path.join(directory,'run.json'),{snapshotSha256:digest(fixtureHtml),status:'complete'})
  await scorePage('_fixture',{components:input,name:'repeat'})
  const file=path.join(directory,'scores-stick','repeat.json'),first=await fs.readFile(file)
  await scorePage('_fixture',{components:input,name:'repeat-again'})
  const regenerated=JSON.parse(await fs.readFile(path.join(directory,'scores-stick','repeat-again.json'),'utf8'))
  regenerated.name='repeat'
  expect(Buffer.from(JSON.stringify(regenerated,null,2)+'\n')).toEqual(first)
})
test('run snapshot and saved HTML mismatches reject without writing a score',async()=>{
  const input=path.join(directory,'components.json');await atomicJson(input,[component])
  await atomicJson(path.join(directory,'run.json'),{snapshotSha256:'different-snapshot',status:'complete'})
  await expect(scorePage('_fixture',{components:input,name:'wrong-run'})).rejects.toThrow('Run snapshot checksum differs')
  await expect(fs.access(path.join(directory,'scores-stick','wrong-run.json'))).rejects.toMatchObject({code:'ENOENT'})
  await atomicJson(path.join(directory,'run.json'),{snapshotSha256:digest(fixtureHtml),status:'complete'})
  await fs.writeFile(path.join(process.env.IMPORT_LAB_ROOT!,'pages','_fixture','page.html'),fixtureHtml+' ')
  await expect(scorePage('_fixture',{components:input,name:'wrong-html'})).rejects.toThrow('Saved page HTML snapshot checksum differs')
  await expect(fs.access(path.join(directory,'scores-stick','wrong-html.json'))).rejects.toMatchObject({code:'ENOENT'})
})
test('evaluation schedules only saved arm runs for stick scoring',async()=>{
  const root=process.env.IMPORT_LAB_ROOT!
  await atomicJson(path.join(root,'runs','_fixture','historical','arms.json'),{arms:{old:{status:'complete',components:[component]}}})
  await atomicJson(path.join(root,'runs','_fixture','historical','pre-repair.json'),{components:[component]})
  const arm=path.join(root,'arms','_fixture','blocks-production','saved')
  await atomicJson(path.join(arm,'run.json'),{status:'complete',snapshotSha256:digest(fixtureHtml)})
  await atomicJson(path.join(arm,'components.json'),[component])
  const tasks=await planEvaluation(parseEval(['score']),{'_fixture':{url:'https://example.com/',kind:'home',siteKind:'saas',heldOut:false,renderWithJavaScript:false,notes:''}})
  expect(tasks.filter(task=>task.script==='score.ts')).toHaveLength(1)
  expect(tasks.find(task=>task.script==='score.ts')?.args).toContain(path.join(arm,'components.json'))
})

test('catalogue returns distinct types including testimonials',async()=>{
  const types=(await catalogue()).map(entry=>entry.type)
  expect(new Set(types).size).toBe(types.length)
  expect(types).toContain('testimonials')
})

const types=['hero','card-grid','footer']
test('version-one label validation remains available for historical scoring',()=>{expect(()=>validateLabel({...label(),bestType:'imaginary'},types)).toThrow();expect(()=>validateLabel({...label(),expected:{itemCount:-1}},types)).toThrow();expect(()=>validateLabel(label({ignore:true,ignoreReason:''}),types)).toThrow()})
