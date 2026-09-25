/** @jest-environment node */
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { buildComparison, generateComparison, type ComparisonPage, type ComparisonRun } from './compare'
import { parseEval } from './eval'
import { stickScoreName } from './stick-version'

const runs=['c-r1','c-r2']
const row=(correct:boolean, failedChecks:string[]=correct?[]:['C2'], key='stats', pick='stats')=>({id:'b',ignored:false,verdict:correct?'correct':'right type, content incomplete',failedChecks,acceptableFamilies:[key],producedFamilies:[pick]})
function sample(correct:number,total=10, check:string[]=[]):ComparisonRun {
  return {rows:Array.from({length:total},(_,i)=>row(i<correct,i<correct?[]:check.length?check:['C2'])),extra:[],blockCount:total,dropped:0,seconds:2,cost:0,choices:[]}
}
function page(id:string,site:string,base:number,candidate:number,kind='saas'):ComparisonPage {
  return {id,site,siteKind:kind,baseline:{'c-r1':sample(base),'c-r2':sample(base)},candidate:{'c-r1':sample(candidate),'c-r2':sample(candidate)}}
}
const options={baseline:'blocks-production',candidate:'family-fill',runs,heldOutRuns:['c-r1'],familySet:'C'}
const heldOut={baseline:0.6,candidate:0.7}

test('clear synthetic win passes every gate and plain opening',()=>{
  const result=buildComparison(Array.from({length:12},(_,i)=>page('p'+i,'site'+Math.floor(i/2),5,8)),heldOut,options)
  expect(result.decision).toBe('GO')
  expect(Object.values(result.conditions).every(x=>x.passed)).toBe(true)
  expect(result.markdown.split('\n').slice(0,3).join(' ')).not.toMatch(/interval|bootstrap|kappa|percentile|C[1-7]/i)
  expect(result.markdown.trimEnd().split('\n').length).toBeLessThanOrEqual(30)
})

test('leave-one-site-out removes every page on the hostname',()=>{
  const pages=[page('a1','same.example',5,10),page('a2','same.example',5,10),page('b1','other.example',5,4),page('b2','other.example',5,4)]
  const result=buildComparison(pages,heldOut,options)
  expect(result.conditions.b.passed).toBe(false)
  expect(result.decision).toBe('NO-GO')
  expect(result.leaveOneSiteOut.min).toBeCloseTo(-0.1)
  expect(result.markdown).toContain('(b)')
})

test('a clearly falling check blocks the win',()=>{
  const pages=Array.from({length:12},(_,i)=>page('p'+i,'site'+i,5,8))
  for(const p of pages)for(const run of runs)p.candidate[run].rows.forEach((r,i)=>{if(i<8)r.failedChecks=['C4']})
  const result=buildComparison(pages,heldOut,options)
  expect(result.conditions.c.passed).toBe(false)
  expect(result.markdown).toContain('(c)')
})

test('held-out drop beyond baseline noise blocks the win',()=>{
  const pages=Array.from({length:12},(_,i)=>page('p'+i,'site'+i,5,8))
  const result=buildComparison(pages,{baseline:0.7,candidate:0.3},options)
  expect(result.conditions.heldOut.passed).toBe(false)
  expect(result.decision).toBe('NO-GO')
  expect(Object.keys(result.heldOut).sort()).toEqual(['baseline','candidate'])
  expect(JSON.stringify(result.heldOut)).not.toMatch(/rows|checks|families|site/)
})

test('extra and junk above the conservative noise band blocks the win',()=>{
  const pages=Array.from({length:12},(_,i)=>page('p'+i,'site'+i,5,8))
  for(const p of pages)for(const run of runs)p.candidate[run].extra=[0,1]
  const result=buildComparison(pages,heldOut,options)
  expect(result.conditions.d.passed).toBe(false)
  expect(result.markdown).toContain('(d)')
})

test('block-weighted loss rejects a page-average GO',()=>{
  const pages=Array.from({length:12},(_,i)=>page('p'+i,'site'+i,0,0))
  // Eleven one-block gains and one hundred-block loss look positive by page.
  for(let i=0;i<11;i++)for(const run of runs){pages[i].baseline[run]=sample(0,1);pages[i].candidate[run]=sample(1,1)}
  for(const run of runs){pages[11].baseline[run]=sample(100,100);pages[11].candidate[run]=sample(0,100)}
  const loss=buildComparison(pages,heldOut,options)
  expect(loss.baseline.accuracy).toBeCloseTo(100/111)
  expect(loss.candidate.accuracy).toBeCloseTo(11/111)
  expect(loss.candidate.accuracy-loss.baseline.accuracy).toBeLessThan(0)
  expect(loss.decision).toBe('NO-GO')
})

test('averages the two pooled run rates rather than pooling runs together',()=>{
  const pages=[page('p','site',0,0)]
  pages[0].baseline['c-r1']=sample(9,10)
  pages[0].baseline['c-r2']=sample(0,1)
  pages[0].candidate['c-r1']=sample(10,10)
  pages[0].candidate['c-r2']=sample(1,1)
  const result=buildComparison(pages,heldOut,options)
  expect(result.baseline.accuracy).toBeCloseTo(0.45)
  expect(result.candidate.accuracy).toBe(1)
})

test('junk counts distinct matched components and fails condition d at 8 to 24',()=>{
  const pages=Array.from({length:12},(_,i)=>page('p'+i,'site'+i,5,8))
  pages[0].baseline['c-r1'].rows.push({id:'ignored',ignored:true,verdict:'should have been ignored',failedChecks:[],componentIndices:Array.from({length:8},(_,i)=>i)})
  pages[0].candidate['c-r1'].rows.push({id:'ignored',ignored:true,verdict:'should have been ignored',failedChecks:[],componentIndices:Array.from({length:24},(_,i)=>i)})
  pages[0].candidate['c-r1'].rows.push({id:'ignored-again',ignored:true,verdict:'should have been ignored',failedChecks:[],componentIndices:[0,1]})
  const result=buildComparison(pages,heldOut,options)
  expect(result.baseline.junk).toBe(8)
  expect(result.candidate.junk).toBe(24)
  expect(result.conditions.d.passed).toBe(false)
  expect(result.markdown).toContain('0+8')
  expect(result.markdown).toContain('0+24')
})

test('folded family mapping changes only the folded result',()=>{
  const pages=[page('p','site',5,5)]
  for(const run of runs){pages[0].candidate[run].rows=[row(false,['C1'],'stats','collection')];pages[0].candidate[run].choices=[{id:'b',top1:'collection',top3:['collection','stats','pricing']}]}
  const result=buildComparison(pages,heldOut,options)
  expect(result.candidate.accuracy).toBe(0)
  expect(result.folded.accuracy).toBe(1)
  expect(result.folded.flips.stats).toBe(2)
})

test('folded C1 still requires every family in a multiple label',()=>{
  const pages=[page('p','site',5,5)]
  for(const run of runs)pages[0].candidate[run].rows=[{...row(false,['C1'],'collection','stats'),acceptableFamilies:['collection','text'],producedFamilies:['stats'],multiple:true}]
  const result=buildComparison(pages,heldOut,options)
  expect(result.folded.accuracy).toBe(0)
  expect(result.folded.correct).toBe(0)
})

test('same input produces byte-identical report and JSON',()=>{
  const pages=Array.from({length:12},(_,i)=>page('p'+i,'site'+i,5,8))
  const a=buildComparison(pages,heldOut,options),b=buildComparison(pages,heldOut,options)
  expect(a.markdown).toBe(b.markdown)
  expect(JSON.stringify(a.json)).toBe(JSON.stringify(b.json))
})

test('saved-data command writes only aggregate held-out output',async()=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'comparison-fixture-'))
  try{
    const manifest:Record<string,unknown>={}
    for(let i=0;i<4;i++)manifest['development-'+i]={url:`https://made-up-${i}.example/`,kind:'home',siteKind:'saas',heldOut:false,renderWithJavaScript:false,notes:''}
    manifest.hidden={url:'https://held-up.example/',kind:'home',siteKind:'saas',heldOut:true,renderWithJavaScript:false,notes:''}
    await fs.writeFile(path.join(root,'pages.json'),JSON.stringify(manifest))
    for(const pageName of Object.keys(manifest))for(const arm of ['blocks-production','family-fill'])for(const run of (pageName==='hidden'?['c-r1']:runs)){
      const runDir=path.join(root,'arms',pageName,arm,run),scoreDir=path.join(root,'labels',pageName,'scores-stick')
      await fs.mkdir(runDir,{recursive:true});await fs.mkdir(scoreDir,{recursive:true})
      await fs.writeFile(path.join(runDir,'run.json'),JSON.stringify({status:'complete',blockCount:10,wallClockSeconds:2,failures:[]}))
      const rows=sample(arm==='family-fill'?8:5).rows.map((row,i)=>({...row,id:`block-${i+1}`,order:i+1,componentIndices:[i]}))
      if(arm==='family-fill'&&pageName!=='hidden')Object.assign(rows[1],{acceptableFamilies:['pricing'],producedFamilies:['collection'],failedChecks:['C1'],verdict:'wrong type'})
      const score=pageName==='hidden'?{accuracy:{correct:arm==='family-fill'?8:7,total:10},rows:[{private:'invented-private-marker'}]}:{rows,extra:[]}
      await fs.writeFile(path.join(scoreDir,stickScoreName(arm,run,'C')+'.json'),JSON.stringify(score))
      if(pageName!=='hidden'){
        await fs.writeFile(path.join(root,'labels',pageName,'answer-sheet-v2.json'),JSON.stringify({entries:rows.map(row=>({blockId:row.id,order:row.order,label:{multiple:false}}))}))
        if(arm==='family-fill'){
          await fs.writeFile(path.join(runDir,'sections.json'),JSON.stringify([{sectionKey:'block:1',sectionOrder:0,components:[{}],debug:{blockPick:{topChoices:{component:'stats'}}}}]))
          await fs.writeFile(path.join(runDir,'section-errors.json'),JSON.stringify([{sectionKey:'block:2',debug:{blockPick:{topChoices:{component:'collection'}}}}]))
          await fs.mkdir(path.join(runDir,'calls'))
          for(const [order,pick] of [[1,'stats'],[2,'collection']] as const)await fs.writeFile(path.join(runDir,'calls',`0000${order}.json`),JSON.stringify({kind:'decision',request:{state:`Block ${order}; invented evidence`},response:{answers:{'import.block.component':{distribution:{[pick]:0.8,text:0.1,pricing:0.1}}}},cost:0}))
        }
      }
    }
    const result=await generateComparison(root,options)
    const markdown=await fs.readFile(path.join(root,'reports','COMPARE.md'),'utf8'),json=await fs.readFile(path.join(root,'reports','compare.json'),'utf8')
    expect(markdown).toBe(result.markdown)
    expect(markdown).not.toContain('invented-private-marker')
    expect(json).not.toContain('invented-private-marker')
    expect(json).not.toContain('held-up.example')
    expect(markdown.match(/Held-out pages:/g)).toHaveLength(1)
    expect(result.json.jev.top1Total).toBeGreaterThan(0)
    expect(result.json.jev.top3Total).toBeGreaterThan(0)
    expect(result.folded.accuracy).toBeGreaterThan(result.candidate.accuracy)
    expect(result.folded.flips.pricing).toBeGreaterThan(0)
    expect(parseEval(['compare','--baseline','blocks-production','--candidate','family-fill','--runs','c-r1,c-r2','--held-out-runs','c-r1','--family-set','C']).command).toBe('compare')
  }finally{await fs.rm(root,{recursive:true,force:true})}
})
