/** @jest-environment node */
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { spawnSync } from 'node:child_process'
import { validateFamilies, familyPick, scoreDirectory } from './families'
import { scoreSheet } from './scoring'
import { scorePicks, type Pick } from './pick-score'
import { block, label, entry, sheet, component } from './phase2-fixtures'
import { pairedFamilies, ambiguity, buildFamilySummary } from './family-summary'
import { parseEval, planEvaluation } from './eval'
import { buildSummary, type SavedResult } from './summary'
const proposal=()=>({sets:Object.fromEntries(['A','B'].map(s=>[s,{banner:{description:'Opening message',types:['hero','hero-split']},cards:{description:'Repeated items',types:['card-grid']},text:{description:'Running text',types:['text-block']}}]))})
const types=['hero','hero-split','card-grid','text-block']
const family=()=>validateFamilies(proposal(),types).A
const url='https://example.com/garden'
test('every set covers exactly the catalogue; duplicate, missing and unknown errors name types',()=>{
  expect(Object.keys(family().byType)).toEqual(types)
  const duplicate=proposal();duplicate.sets.B.cards.types.push('hero');expect(()=>validateFamilies(duplicate,types)).toThrow(/B: duplicate types \[hero\]/)
  const missing=proposal();missing.sets.A.banner.types.pop();expect(()=>validateFamilies(missing,types)).toThrow('missing types [hero-split]')
  const unknown=proposal();unknown.sets.A.banner.types.push('invented-unknown');expect(()=>validateFamilies(unknown,types)).toThrow('unknown types [invented-unknown]')
})
test('near twin becomes right; other family stays wrong; checks and ignored blocks stay unchanged',()=>{
  const answer=sheet(),output={...component,type:'hero-split'},normal=scoreSheet(answer,[output],url),grouped=scoreSheet(answer,[output],url,{families:family()})
  expect(normal.rows[0].verdict).toBe('wrong type');expect(grouped.rows[0].checks.C1.passed).toBe(true);for(const key of ['C2','C3','C4','C5','C6','C7'] as const)expect(grouped.rows[0].checks[key]).toEqual(normal.rows[0].checks[key])
  expect(scoreSheet(answer,[{...component,type:'card-grid'}],url,{families:family()}).rows[0].verdict).toBe('wrong type')
  const ignored=sheet([entry({label:label({ignore:true,ignoreReason:'Invented notice'})})])
  for(const components of [[],[output]])expect(scoreSheet(ignored,components,url,{families:family()}).rows[0].verdict).toBe(scoreSheet(ignored,components,url).rows[0].verdict)
  const multiple=sheet([entry({label:label({containsMultipleComponents:true,componentTypes:['hero','hero-split']})})])
  expect(scoreSheet(multiple,[component,component],url,{families:family()}).rows[0].checks.C1.passed).toBe(true)
  expect(scoreSheet(multiple,[component],url,{families:family()}).rows[0].verdict).toBe('wrong type')
})
const pick=():Pick=>({blockId:block().id,order:1,distribution:{hero:0.25,'hero-split':0.25,'card-grid':0.4,'text-block':0.1},ranked:[{type:'card-grid',probability:0.4},{type:'hero',probability:0.25},{type:'hero-split',probability:0.25},{type:'text-block',probability:0.1}],multipleProbability:0,allowedTypes:types,branch:'uncertain',issues:[]})
test('post-hoc sums ALL type probabilities before ranking DISTINCT families',()=>{
  const p=pick(),mapped=familyPick(p,family())
  expect(mapped.ranked).toEqual([{type:'banner',probability:0.5},{type:'cards',probability:0.4},{type:'text',probability:0.1}]);expect(p.distribution.hero).toBe(0.25)
  expect(scorePicks(sheet(),[p]).top1).toBe(0);expect(scorePicks(sheet(),[p],{families:family(),postHoc:true}).top1).toBe(1)
  expect(scorePicks(sheet(),[mapped],{families:family()})).toEqual(scorePicks(sheet(),[p],{families:family(),postHoc:true}))
  expect(()=>familyPick({...p,distribution:{hero:1}},family())).toThrow('missing types')
})
const saved=(rows:any[],overrides:Partial<SavedResult>={}):SavedResult=>({page:'garden',arm:'today-off',run:'r1',status:'complete',rows,sheetHash:'same',reviewedBy:{},calls:[],seconds:null,issues:[],picks:[],record:{familySha256:family().sha256},...overrides})
test('summary pairs the same blocks and labels, preserves content misses, counts flips and unique ambiguity',()=>{
  const before=saved([{id:'one',verdict:'wrong type'},{id:'two',verdict:'missed'},{id:'ignored',ignored:true,verdict:'correct'}])
  const after=saved([{id:'two',verdict:'missed'},{id:'one',verdict:'right type, content incomplete'},{id:'extra',verdict:'correct'}])
  expect(pairedFamilies([before],[after],family()).pairs[0].changed).toBe(1)
  expect(pairedFamilies([before],[{...after,sheetHash:'old'}],family()).pairs).toHaveLength(0)
  const s=sheet([entry({label:label({acceptableTypes:['hero','hero-split','card-grid']})})]);s.page='garden'
  expect(ambiguity([s],family())).toEqual({blocks:1,typeCount:3,familyCount:2,types:3,families:2})
  const summary=buildFamilySummary([before],[{definition:family(),results:[after]}],{garden:{url,kind:'home',heldOut:true,renderWithJavaScript:false,notes:''}},[s])
  expect(summary.json.scopes[0].rows[0].sets[0]).toMatchObject({type:{blocks:2,right:0,wrong:1,missed:1},family:{blocks:2,right:1,incomplete:1,missed:1},changed:1})
  expect(summary.json.scopes[1].rows).toHaveLength(1);expect(summary.json.scopes[2].rows).toHaveLength(0)
})
test('asked-family pick arms never appear as unscored extraction arms',()=>{
  const result=buildSummary([saved([],{arm:'jev-pick@families-A'})],{})
  expect(result.json.all).toEqual([]);expect(result.markdown).toContain('0 unscored page runs')
})
test('CLI validates paired flags and passes them to family arm plans and isolated score paths',async()=>{
  expect(parseEval(['score','--family-set','A']).familySet).toBe('A');expect(parseEval(['score','--families','families.json','--family-set','C']).familySet).toBe('C')
  expect(()=>parseEval(['arms','--arms','blocks-production','--run','r1','--families','families.json','--family-set','A'])).toThrow('only to jev-pick')
  expect(()=>parseEval(['score','--obsolete'])).toThrow('Unknown')
  const options=parseEval(['arms','--arms','jev-pick','--run','family-test','--families','families.json','--family-set','A','--dry-run'])
  const tasks=await planEvaluation(options,{garden:{url,kind:'home',heldOut:false,renderWithJavaScript:false,notes:''}})
  expect(tasks[0].args).toEqual(expect.arrayContaining(['--families','families.json','--family-set','A']));expect(tasks[0].paid).toBe(true)
  expect(scoreDirectory('garden',{families:'families.json',familySet:'B'})).toContain('scores-family-B')
})
test('offline family requests, fake client, dry CLI, post-hoc scores and source preservation',()=>{
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'import-lab-test-'))
  try {
    const result=spawnSync(process.execPath,['--import','tsx',path.join(__dirname,'family-fixtures.ts')],{cwd:path.resolve(__dirname,'../../..'),windowsHide:true,encoding:'utf8',maxBuffer:8000000,env:{...process.env,NODE_OPTIONS:'--require='+JSON.stringify(path.join(__dirname,'offline-guard.cjs')),IMPORT_MODEL_CHAIN:'offline/fixture-model',STUDIO_DISABLE_WORKFLOW_PLUGIN:'true',SKIP_DB_SETUP:'true',IMPORT_LAB_ROOT:directory},timeout:120000})
    if(result.status!==0)throw new Error(result.stdout+'\n'+result.stderr)
    expect(result.stdout).toContain('PASS families')
  } finally { fs.rmSync(directory,{recursive:true,force:true}) }
},130000)
