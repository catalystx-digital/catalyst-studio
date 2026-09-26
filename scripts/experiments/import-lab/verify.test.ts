/** @jest-environment node */
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { blockEvidence } from './source-evidence'
import { block, entry, label, sheet, scoreFixture } from './phase2-fixtures'
import { validateFamilies } from './families'
import families from './component-families.json'
import { f1Block, f1Geometry, f1Html, f1Mutations, f1Sheet, f1Url } from './f1-fixtures'
import { verifyBlock, verifyRuns } from './verify'
import { digest } from './storage'

const evidence=()=>blockEvidence(f1Html,[],f1Block,f1Geometry,f1Url)
const familySet=validateFamilies(families,Object.values(families.sets.C).flatMap(group=>group.types)).C

test('F1 mutations list missing content and agree with the stick content checks',()=>{
  for(const [name,components] of f1Mutations){
    const result=verifyBlock(evidence(),components)
    const checks=scoreFixture(f1Sheet,components,f1Url,{evidence:[evidence()]}).rows[0].checks
    expect(result.verified).toBe(['C2','C4','C5','C7'].every(check=>checks[check as 'C2'|'C4'|'C5'|'C7'].passed===true))
    if(name==='M1')expect(result.verified).toBe(true)
    if(name==='M2') {expect(result.verified).toBe(false);expect(result.headingsKept).toBe(false)}
    if(name==='M3') {expect(result.verified).toBe(true);expect(result.headingsKept).toBe(false)}
    if(name==='M4')expect(result.missing.text).toEqual(expect.arrayContaining([expect.stringContaining('families can discover')]))
    if(name==='M6')expect(result.missing.links).toEqual(expect.arrayContaining([{url:'https://example.test/stories/one',label:'read the full story'}]))
    if(name==='M7')expect(result.missing.images).toEqual(expect.arrayContaining([expect.arrayContaining(['https://example.test/photo-large.jpg'])]))
    if(name==='M9')expect(result.invented).toEqual(expect.arrayContaining([expect.stringContaining('invented')]))
  }
})

test('a text-only section with no matched components is missed, not verified',async()=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'verify-missed-'))
  try {
    const html='<html><body><section id="hero">Hi</section></body></html>'
    const sourceBlock=block({text:'Hi',headings:[],links:[],images:[]})
    const geometry={tree:{anchorKey:'body',children:[]}}
    const source=blockEvidence(html,[],sourceBlock,geometry,f1Url)
    const stick=scoreFixture(sheet([entry({block:sourceBlock,label:label({expected:{headings:[],itemCount:null,itemKind:null,hasImage:false,ctaLabels:[]}})})]),[],f1Url,{evidence:[source]}).rows[0]
    expect(source.text).toEqual([])
    expect(stick.verdict).toBe('missed')
    expect(stick.checks.C2.passed).toBeNull()
    expect(verifyBlock(source,[]).verified).toBe(false)

    const page='development',labelDir=path.join(root,'labels',page),runDir=path.join(root,'arms',page,'blocks-production','r1')
    await fs.mkdir(labelDir,{recursive:true});await fs.mkdir(runDir,{recursive:true})
    await fs.mkdir(path.join(root,'pages',page),{recursive:true})
    await fs.writeFile(path.join(root,'pages.json'),JSON.stringify({[page]:{url:f1Url,kind:'home',siteKind:'saas',heldOut:false,renderWithJavaScript:false,notes:''}}))
    await fs.writeFile(path.join(labelDir,'answer-sheet-v2.json'),JSON.stringify({version:2,page,snapshotSha256:digest(html),proposalSha256:'fixture',familySet:'C',blocks:[sourceBlock],entries:[{blockId:sourceBlock.id,order:1,status:'agreed',label:{family:familySet.byType.hero,acceptableFamilies:[familySet.byType.hero],multiple:false,familiesInOrder:[],placement:'main',ignore:false,ignoreReason:'',itemCount:null,itemKind:null,decorativeImages:[],reason:{a:'fixture',b:'fixture'}}}]}))
    await fs.writeFile(path.join(labelDir,'blocks.json'),JSON.stringify({blocks:[sourceBlock],finalUrl:f1Url,snapshotSha256:digest(html)}))
    await fs.writeFile(path.join(labelDir,'geometry.json'),JSON.stringify(geometry))
    await fs.writeFile(path.join(root,'pages',page,'page.html'),html)
    await fs.writeFile(path.join(root,'pages',page,'stylesheets.json'),'[]')
    await fs.writeFile(path.join(runDir,'components.json'),'[]')
    await fs.writeFile(path.join(runDir,'run.json'),JSON.stringify({status:'complete'}))
    const result=await verifyRuns(root,{arm:'blocks-production',runs:['r1']})
    expect(result).toEqual({complete:0,total:1,agreement:1,mismatches:[]})
    const saved=JSON.parse(await fs.readFile(path.join(labelDir,'verify','blocks-production--r1.json'),'utf8'))
    expect(saved.rows[0].verified).toBe(false)
  } finally {await fs.rm(root,{recursive:true,force:true})}
})

test('verify CLI exits 1 on a forced identity mismatch',async()=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'verify-cli-'))
  try {
    const preload=path.join(root,'force-mismatch.cjs')
    await fs.writeFile(preload,`const Module=require('node:module');const load=Module._load;Module._load=function(request,parent,isMain){if(request==='./verify'&&parent&&/[/\\\\]eval\\.ts$/.test(parent.filename)){process.stderr.write('forced mismatch injected\\n');return {verifySavedRuns:async()=>({complete:0,total:1,agreement:0,mismatches:['forced mismatch']})}}return load.apply(this,arguments)};`)
    const result=spawnSync(process.execPath,['--require',preload,'--import','tsx',path.join(__dirname,'eval.ts'),'verify','--arm','blocks-production','--runs','r1'],{cwd:path.resolve(__dirname,'../../..'),encoding:'utf8',windowsHide:true,timeout:30000,env:{...process.env,IMPORT_MODEL_CHAIN:'test/dummy'}})
    expect(result.error).toBeUndefined()
    expect(result.stderr).toBe('forced mismatch injected\n')
    expect(result.status).toBe(1)
  } finally {await fs.rm(root,{recursive:true,force:true})}
})

test('verify writes once and skips held-out pages before reading their files',async()=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'verify-fixture-'))
  try {
    const pages={development:{url:f1Url,kind:'home',siteKind:'saas',heldOut:false,renderWithJavaScript:false,notes:''},secret:{url:'https://hidden.example/',kind:'home',siteKind:'saas',heldOut:true,renderWithJavaScript:false,notes:''}}
    await fs.writeFile(path.join(root,'pages.json'),JSON.stringify(pages))
    const label=path.join(root,'labels','development'),arm=path.join(root,'arms','development','blocks-production','r1')
    await fs.mkdir(label,{recursive:true});await fs.mkdir(arm,{recursive:true})
    const sheet={version:2,page:'development',snapshotSha256:digest(f1Html),proposalSha256:'fixture',familySet:'C',blocks:[f1Block],entries:[{blockId:f1Block.id,order:1,status:'agreed',label:{family:familySet.byType['card-grid'],acceptableFamilies:[familySet.byType['card-grid']],multiple:false,familiesInOrder:[],placement:'main',ignore:false,ignoreReason:'',itemCount:3,itemKind:'items',decorativeImages:[],reason:{a:'fixture',b:'fixture'}}}]}
    await fs.writeFile(path.join(label,'answer-sheet-v2.json'),JSON.stringify(sheet))
    await fs.writeFile(path.join(label,'blocks.json'),JSON.stringify({blocks:[f1Block],finalUrl:f1Url,snapshotSha256:digest(f1Html)}))
    await fs.writeFile(path.join(label,'geometry.json'),JSON.stringify(f1Geometry))
    await fs.mkdir(path.join(root,'pages','development'),{recursive:true})
    await fs.writeFile(path.join(root,'pages','development','page.html'),f1Html)
    await fs.writeFile(path.join(root,'pages','development','stylesheets.json'),'[]')
    await fs.writeFile(path.join(arm,'components.json'),JSON.stringify(f1Mutations[0][1]))
    await fs.writeFile(path.join(arm,'run.json'),JSON.stringify({status:'complete'}))
    const first=await verifyRuns(root,{arm:'blocks-production',runs:['r1']})
    expect(first.mismatches).toEqual([])
    const file=path.join(label,'verify','blocks-production--r1.json')
    expect(JSON.parse(await fs.readFile(file,'utf8')).summary).toEqual({complete:1,total:1,agreement:1})
    await fs.writeFile(file,'{"sentinel":true}\n')
    await verifyRuns(root,{arm:'blocks-production',runs:['r1']})
    expect(await fs.readFile(file,'utf8')).toBe('{"sentinel":true}\n')
    expect(await fs.readdir(path.join(root,'labels'))).toEqual(['development'])
  } finally {await fs.rm(root,{recursive:true,force:true})}
})
