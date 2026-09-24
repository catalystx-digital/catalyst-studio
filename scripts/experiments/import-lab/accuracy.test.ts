/** @jest-environment node */
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { generateAccuracy } from './accuracy'
import { stickScoreName, STICK_VERSION } from './stick-version'
import { parseEval, planEvaluation } from './eval'

let root:string
beforeEach(async()=>{root=await fs.mkdtemp(path.join(os.tmpdir(),'accuracy-fixture-'))})
afterEach(async()=>{await fs.rm(root,{recursive:true,force:true})})
const page=(heldOut=false)=>({url:'https://invented.example/',kind:'home' as const,siteKind:'saas' as const,heldOut,renderWithJavaScript:false,notes:''})
async function save(pageName:string,run:string,correct:number,total=10,familySet?:string) {
  const rows=Array.from({length:total},(_,i)=>({id:`block-${i}`,ignored:false,verdict:i<correct?'correct':'right type, content incomplete',failedChecks:i<correct?[]:['C2'],checks:{C6:{structureUnknown:false}},acceptableTypes:['fixture-type'],acceptableFamilies:['fixture-family']}))
  const file=path.join(root,'labels',pageName,'scores-stick',stickScoreName('blocks-production',run,familySet)+'.json')
  await fs.mkdir(path.dirname(file),{recursive:true})
  await fs.writeFile(file,JSON.stringify({rows,extra:[],counts:{missed:0,'should have been ignored':0}}))
}
async function pages(entries:Record<string,ReturnType<typeof page>>) {await fs.writeFile(path.join(root,'pages.json'),JSON.stringify(entries))}

test('fixed seed writes byte-identical latest reports and archives older copies',async()=>{
  await pages({alpha:page(),beta:page(true)})
  for(const run of ['r1','r2']) {await save('alpha',run,7,10,'C');await save('beta',run,8,10,'C')}
  await generateAccuracy(root,{arm:'blocks-production',runs:['r1','r2'],familySet:'C'})
  const md=await fs.readFile(path.join(root,'reports','ACCURACY.md'))
  const json=await fs.readFile(path.join(root,'reports','accuracy.json'))
  await generateAccuracy(root,{arm:'blocks-production',runs:['r1','r2'],familySet:'C'})
  expect(await fs.readFile(path.join(root,'reports','ACCURACY.md'))).toEqual(md)
  expect(await fs.readFile(path.join(root,'reports','accuracy.json'))).toEqual(json)
  expect((await fs.readdir(path.join(root,'reports'))).filter(n=>n.startsWith('ACCURACY-'))).toHaveLength(1)
})

test('identical runs have zero noise and a difference interval containing zero',async()=>{
  await pages({alpha:page(),beta:page()})
  for(const name of ['alpha','beta'])for(const run of ['r1','r2','r3','r4'])await save(name,run,7)
  const result=await generateAccuracy(root,{arm:'blocks-production',runs:['r1','r2','r3','r4']})
  expect(result.noise.halfWidth).toBe(0)
  expect(result.noise.interval![0]).toBeLessThanOrEqual(0)
  expect(result.noise.interval![1]).toBeGreaterThanOrEqual(0)
})

test('a uniform ten point difference on twenty pages has a positive lower bound',async()=>{
  const manifest:Record<string,ReturnType<typeof page>>={}
  for(let i=0;i<20;i++)manifest[`page-${i}`]=page()
  await pages(manifest)
  for(const name of Object.keys(manifest))for(const run of ['r1','r2','r3','r4'])await save(name,run,run==='r1'||run==='r2'?10:9)
  const result=await generateAccuracy(root,{arm:'blocks-production',runs:['r1','r2','r3','r4']})
  expect(result.noise.interval![0]).toBeGreaterThan(0)
})

test('seed-one page bootstrap bounds reflect unequal page sizes and accuracies',async()=>{
  const cases:[number,number][]=[[0,1],[1,2],[2,3],[1,5],[7,8],[4,11],[9,13],[3,17]]
  const manifest:Record<string,ReturnType<typeof page>>={}
  for(const [index,[correct,total]] of cases.entries()){
    const name=`page-${index}`;manifest[name]=page()
    await save(name,'r1',correct,total)
  }
  await pages(manifest)
  const result=await generateAccuracy(root,{arm:'blocks-production',runs:['r1']})
  expect(result.development.interval[0]).toBeCloseTo(0.24614754098360658,12)
  expect(result.development.interval[1]).toBeCloseTo(0.6857589285714283,12)
})

test('all 61 type groups fit within the 30-line report',async()=>{
  await pages({alpha:page()})
  await save('alpha','r1',61,61)
  const file=path.join(root,'labels','alpha','scores-stick',stickScoreName('blocks-production','r1')+'.json')
  const score=JSON.parse(await fs.readFile(file,'utf8'))
  score.rows.forEach((row:{acceptableTypes:string[]},index:number)=>{row.acceptableTypes=[`type-${String(index).padStart(2,'0')}`]})
  await fs.writeFile(file,JSON.stringify(score))
  const result=await generateAccuracy(root,{arm:'blocks-production',runs:['r1']})
  const markdown=await fs.readFile(path.join(root,'reports','ACCURACY.md'),'utf8')
  expect(markdown.trimEnd().split('\n').length).toBeLessThanOrEqual(30)
  expect(Object.keys(result.development.groups)).toHaveLength(61)
  for(let index=0;index<61;index++)expect(markdown).toContain(`type-${String(index).padStart(2,'0')} `)
})

test('held-out output contains overall accuracy only, and the opening uses plain words',async()=>{
  await pages({development:page(),heldout:page(true)})
  for(const run of ['r1','r2']) {await save('development',run,8,10,'C');await save('heldout',run,7,10,'C')}
  const result=await generateAccuracy(root,{arm:'blocks-production',runs:['r1','r2'],familySet:'C'})
  const md=await fs.readFile(path.join(root,'reports','ACCURACY.md'),'utf8')
  const json=JSON.parse(await fs.readFile(path.join(root,'reports','accuracy.json'),'utf8'))
  expect(Object.keys(json.heldOut).sort()).toEqual(['accuracy','interval','pages','scoredBlocks','unsettledBlocks'])
  expect(JSON.stringify(json.heldOut)).not.toMatch(/C[1-7]|block-|fixture-family|fixture-type/)
  expect(md.match(/Held-out:.*/g)).toHaveLength(1)
  expect(md.split('\n').slice(0,4)).toEqual([
    expect.stringMatching(/^About \d+\.\d in 10 website sections import correctly today \(likely range \d+\.\d–\d+\.\d in 10\)\.$/),
    'The answer key was checked by two AI models from different companies; a third settled most disagreements and the founder settled the rest.',
    expect.stringMatching(/^The three biggest losses: .+, .+, .+\.$/),
    '---'
  ])
  expect(md.split('\n').slice(0,3).join(' ')).not.toMatch(/interval|bootstrap|noise|percentile|kappa/i)
  expect(result.heldOut.accuracy).toBe(0.7)
})

test('missing runs skip a page and name the development page only',async()=>{
  await pages({alpha:page(),missing:page()})
  await save('alpha','r1',8)
  const result=await generateAccuracy(root,{arm:'blocks-production',runs:['r1']})
  expect(result.skipped).toEqual({development:['missing'],heldOutPages:0})
})

test('line two counts distinct unsettled sections and excludes them',async()=>{
  await pages({alpha:page(),beta:page(true)})
  for(const name of ['alpha','beta'])await save(name,'r1',1,2,'C')
  const file=path.join(root,'labels','alpha','scores-stick',stickScoreName('blocks-production','r1','C')+'.json')
  const score=JSON.parse(await fs.readFile(file,'utf8'))
  score.rows[1].verdict='unsettled'
  await fs.writeFile(file,JSON.stringify(score))
  const result=await generateAccuracy(root,{arm:'blocks-production',runs:['r1'],familySet:'C'})
  expect(result.development.unsettledBlocks).toBe(1)
  expect(result.development.scoredBlocks).toBe(1)
  expect(result.development.cleanPages.count).toBe(0)
  expect((await fs.readFile(path.join(root,'reports','ACCURACY.md'),'utf8')).split('\n')[1]).toBe('Answer key not finished: 1 sections still await a decision.')
})

test('upper bound counts only single-check failures',async()=>{
  await pages({alpha:page()})
  const file=path.join(root,'labels','alpha','scores-stick',stickScoreName('blocks-production','r1')+'.json')
  await fs.mkdir(path.dirname(file),{recursive:true})
  await fs.writeFile(file,JSON.stringify({rows:[
    {id:'one',ignored:false,verdict:'right type, content incomplete',failedChecks:['C2'],checks:{C6:{structureUnknown:false}},acceptableTypes:['fixture-type']},
    {id:'two',ignored:false,verdict:'right type, content incomplete',failedChecks:['C2','C3'],checks:{C6:{structureUnknown:false}},acceptableTypes:['fixture-type']},
    {id:'three',ignored:false,verdict:'correct',failedChecks:[],checks:{C6:{structureUnknown:false}},acceptableTypes:['fixture-type']}
  ],extra:[],counts:{missed:0,'should have been ignored':0}}))
  const result=await generateAccuracy(root,{arm:'blocks-production',runs:['r1']})
  expect(result.development.checks.C2).toMatchObject({failures:2,onlyFailure:1,total:3})
})

test('both score routes use the one stick name',async()=>{
  expect(STICK_VERSION).toBe('stick2')
  expect(stickScoreName('blocks-production','r1','C')).toBe('blocks-production--r1--stick2-family-C')
  expect(stickScoreName('blocks-production','r1','C')).not.toBe('blocks-production--r1--stick1-family-C')
  const folder=path.join(root,'arms','alpha','blocks-production','r1')
  await fs.mkdir(folder,{recursive:true})
  await fs.writeFile(path.join(folder,'run.json'),JSON.stringify({status:'complete'}))
  process.env.IMPORT_LAB_ROOT=root
  const options=parseEval(['score','--arm','blocks-production','--runs','r1'])
  const task=(await planEvaluation(options,{alpha:page()})).find(t=>t.script==='score.ts')
  expect(task?.args).toContain('blocks-production--r1--stick2')
  delete process.env.IMPORT_LAB_ROOT
})
