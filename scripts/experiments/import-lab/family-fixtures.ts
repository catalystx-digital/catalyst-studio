import assert from 'node:assert/strict'
import path from 'node:path'
import fs from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import { dataRoot, saveSnapshot, writeJson, readJson, digest } from './storage'
import { comparisonSnapshot, comparisonProposal, comparisonSheet } from './phase3-fixtures'
import { runtimeRequire } from './runtime'
import { loadFamilies } from './families'
import { runArm } from './run-arm'
import { scorePage } from './score'
import { scoreFamilyPicksPage } from './family-pick-score'
import { readSavedResults } from './summary'
import { evaluate, parseEval } from './eval'

async function verify(){
  const root=path.join(dataRoot(),'fixture-'+Date.now()+'-'+process.pid);process.env.IMPORT_LAB_ROOT=root;delete process.env.IMPORT_LAB_OUTPUT_ROOT
  process.env.DECISION_MODEL_ENABLED='true';process.env.DECISION_MODEL_SHADOW='false';process.env.DECISION_MODEL_API_KEY='offline-fixture';process.env.DECISION_MODEL_LOG_DIR=path.join(root,'decisions')
  const snapshot=comparisonSnapshot(),proposal=comparisonProposal(),sheet=comparisonSheet(),file=path.join(__dirname,'component-families.json')
  const {WebFetchTools}=runtimeRequire('@/lib/studio/import/services/web-tools')
  const previous=globalThis.fetch
  try{globalThis.fetch=async()=>new Response(snapshot.html,{headers:{'content-type':'text/html'}});const web=new WebFetchTools();snapshot.outline=await web.fetchOutline({url:snapshot.manifest.url});snapshot.sections={};snapshot.manifest.sectionKeys=[]}
  finally{globalThis.fetch=previous}
  await saveSnapshot(path.join(root,'pages',proposal.page),snapshot)
  const labels=path.join(root,'labels',proposal.page)
  await writeJson(path.join(labels,'blocks.json'),proposal);await writeJson(path.join(labels,'answer-sheet.json'),sheet)
  await writeJson(path.join(labels,'geometry.json'),{tree:{anchorKey:'body',children:[]}})
  await writeJson(path.join(root,'pages.json'),{[proposal.page]:{url:'https://example.com/garden',kind:'home',heldOut:false,renderWithJavaScript:false,notes:'Invented fixture'}})
  const typeRequests:string[]=[]
  const typeRun=await runArm({page:proposal.page,run:'type-fixture',arm:'jev-pick',dryRun:false},{decision:{askRaw:async(state:string,questions:any[])=>{typeRequests.push(state);return runtimeRequire('@/lib/studio/decisions').createFakeDecisionClient({'import.block.component':{value:'text-block',probability:0.9,distribution:Object.fromEntries(Object.keys(questions[0].criteria).map(type=>[type,type==='text-block'?0.9:0.1/(Object.keys(questions[0].criteria).length-1)]))},'import.block.multiple':0.1}).askRaw(state,questions)}}})
  assert.equal(typeRun.status,'complete')
  const typeDirectory=path.join(root,'arms',proposal.page,'jev-pick','type-fixture')
  // Only this invented fixture is admitted to the saved-data reader for the test.
  await writeJson(path.join(typeDirectory,'run.json'),{...typeRun,fixture:false})
  const components=sheet.entries.map(e=>({type:'html-block',content:{body:e.block.text}})),componentFile=path.join(root,'fixture-run','components.json')
  await writeJson(componentFile,components)
  await writeJson(path.join(path.dirname(componentFile),'run.json'),{status:'complete',snapshotSha256:sheet.snapshotSha256})
  const unscoredDirectory=path.join(root,'arms',proposal.page,'blocks-production','unsaved-type-baseline')
  await writeJson(path.join(unscoredDirectory,'components.json'),components)
  await writeJson(path.join(unscoredDirectory,'run.json'),{status:'complete',snapshotSha256:sheet.snapshotSha256,proposalSha256:sheet.proposalSha256})
  await scorePage(proposal.page,{components:componentFile,name:'fixture'})
  const protectedFiles=[path.join(labels,'answer-sheet.json'),path.join(labels,'scores-stick','fixture.json'),path.join(typeDirectory,'run.json'),path.join(typeDirectory,'picks.json')]
  const hashes=await Promise.all(protectedFiles.map(async f=>digest(await fs.readFile(f,'utf8'))))
  for(const set of ['A','B']){
    const families=await loadFamilies(file,set);assert.equal(families.entries.length,set==='A'?18:16);assert.equal(Object.keys(families.byType).length,50)
    const seen:string[]=[]
    const record=await runArm({page:proposal.page,run:'family-fixture',arm:'jev-pick',families:file,familySet:set,dryRun:false},{decision:{askRaw:async(state:string,questions:any[])=>{
      seen.push(state);assert.equal(questions.length,2);assert.equal(questions[0].shape,'choice');assert.equal(questions[1].shape,'boolean');assert.deepEqual(questions[0].criteria,Object.fromEntries(families.entries.map(f=>[f.type,f.description])))
      const distribution=Object.fromEntries(families.entries.map(f=>[f.type,f.type==='text'?0.9:0.1/(families.entries.length-1)]))
      return runtimeRequire('@/lib/studio/decisions').createFakeDecisionClient({'import.block.component':{value:'text',probability:0.9,distribution},'import.block.multiple':0.1}).askRaw(state,questions)
    }}})
    assert.equal(record.status,'complete');assert.equal(record.callCount,3);assert.deepEqual(seen.sort(),[...typeRequests].sort());assert.equal(record.arm,'jev-pick@families-'+set)
    const armDir=path.join(root,'arms',proposal.page,record.arm,'family-fixture')
    assert.equal((await readJson(path.join(armDir,'pick-score.json'))).top1,3)
    await writeJson(path.join(armDir,'run.json'),{...record,fixture:false})
    const dry=spawnSync(process.execPath,['--import','tsx',path.join(__dirname,'jev-pick.ts'),'--page',proposal.page,'--run','dry-fixture','--families',file,'--family-set',set,'--dry-run'],{env:process.env,encoding:'utf8',windowsHide:true})
    assert.equal(dry.status,0,dry.stderr)
    const dryDir=path.join(root,'arms',proposal.page,record.arm,'dry-fixture'),dryRecord=await readJson(path.join(dryDir,'run.json'))
    assert.equal(dryRecord.callCount,0);assert.equal(dryRecord.plannedCallCount,3)
    const request=await readJson(path.join(dryDir,'calls','00001.json'));assert.equal(request.status,'planned');assert.equal(Object.keys(request.request.questions['import.block.component'].criteria).length,families.entries.length)
    await scorePage(proposal.page,{components:componentFile,name:'fixture',families:file,familySet:set})
    const score=await readJson(path.join(labels,'scores-stick','fixture-family-'+set+'.json'));assert.equal(score.reviewedBlocks,3);assert.equal(score.rows.filter((r:any)=>r.checks.C1.passed===true).length,3)
    await evaluate(parseEval(['score','--families',file,'--family-set',set]))
    for(const arm of ['jev-pick','jev-pick@families-'+set]){const r=await readJson(path.join(labels,'scores-family-'+set,'picks',arm+'--'+(arm==='jev-pick'?'type-fixture':'family-fixture')+'.json'));assert.equal(r.top1,3);assert.equal(r.top3,3)}
    await scoreFamilyPicksPage(proposal.page,file,set)
  }
  const baseline=(await readSavedResults(undefined,true)).find(r=>r.arm==='blocks-production'&&r.run==='unsaved-type-baseline')
  assert.equal(baseline?.record.computedTypeBaseline,true);assert.equal(baseline?.rows.length,3);assert(baseline?.rows.every(r=>r.verdict==='wrong type'))
  assert.equal(await fs.stat(path.join(labels,'scores','blocks-production--unsaved-type-baseline.json')).then(()=>true).catch(()=>false),false)
  assert.deepEqual(await Promise.all(protectedFiles.map(async f=>digest(await fs.readFile(f,'utf8')))),hashes)
  console.log('PASS families: 50 catalogue types, both sets, exact fake requests, dry CLI, post-hoc scoring and preserved source files')
}
verify().catch(error=>{console.error(error);process.exitCode=1})
