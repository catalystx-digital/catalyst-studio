/** @jest-environment node */
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { EventEmitter } from 'node:events'
import { PassThrough } from 'node:stream'
import type { spawn as spawnType } from 'node:child_process'
import sharp from 'sharp'
import { atomicJson, validateFamilyLabel } from './labels'
import { comparisonProposal, comparisonSheet, comparisonSnapshot } from './phase3-fixtures'
import { assertClaudePolicyAbsent, childEnvironment, defaultProcessRunner, draftLabels } from './draft-labels'
import { evaluate, parseEval } from './eval'

const catalogue=path.join(__dirname,'component-families.json')
const originalRoot=process.env.IMPORT_LAB_ROOT,originalExit=process.exitCode
const answer=(change:Record<string,unknown>={})=>JSON.stringify({family:'hero',acceptableFamilies:['hero'],multiple:false,familiesInOrder:[],placement:'main',ignore:false,ignoreReason:'',itemCount:null,itemKind:null,decorativeImageGroupIds:[],reason:'Invented introduction.',...change})
let root:string
beforeEach(async()=>{root=await fs.mkdtemp(path.join(os.tmpdir(),'labeller-fixes-'));process.env.IMPORT_LAB_ROOT=root})
afterEach(async()=>{await fs.rm(root,{recursive:true,force:true});if(originalRoot===undefined)delete process.env.IMPORT_LAB_ROOT;else process.env.IMPORT_LAB_ROOT=originalRoot;process.exitCode=originalExit})

async function pageSetup(page='invented-page',v1=false,blocks=3){
  const base=comparisonProposal(),proposal={...base,page,blocks:base.blocks.slice(0,blocks)}
  const directory=path.join(root,'labels',page),pageDirectory=path.join(root,'pages',page)
  await atomicJson(path.join(directory,'blocks.json'),proposal)
  if(v1){const sheet=comparisonSheet();sheet.page=page;sheet.entries=sheet.entries.slice(0,blocks-1);await atomicJson(path.join(directory,'answer-sheet.json'),sheet)}
  await atomicJson(path.join(directory,'geometry.json'),{tree:{anchorKey:'body',children:[]}})
  await fs.mkdir(pageDirectory,{recursive:true})
  await fs.writeFile(path.join(pageDirectory,'page.html'),comparisonSnapshot().html)
  await atomicJson(path.join(pageDirectory,'stylesheets.json'),[])
  await sharp({create:{width:1440,height:540,channels:3,background:'#fff'}}).png().toFile(path.join(directory,'screenshot.png'))
  return {directory,proposal}
}
async function calls(directory:string){const runs=await fs.readdir(path.join(directory,'calls'));return Promise.all((await fs.readdir(path.join(directory,'calls',runs[0]))).map(async file=>JSON.parse(await fs.readFile(path.join(directory,'calls',runs[0],file),'utf8'))))}
const options=(page:string,out='a')=>({page,catalogue,set:'C',model:'opus',out})

test('v2 accepts count without kind and normalises the best family',()=>{
  const label={family:'hero',acceptableFamilies:[],multiple:false,familiesInOrder:[],placement:'main',ignore:false,ignoreReason:'',itemCount:4,itemKind:null,decorativeImages:[],reason:'Invented collection.'}
  expect(validateFamilyLabel(label,['hero']).acceptableFamilies).toEqual(['hero'])
  const {itemKind,...withoutKind}=label
  expect(validateFamilyLabel(withoutKind,['hero']).itemKind).toBeNull()
})

test('draft entry records family normalisation',async()=>{
  const {directory}=await pageSetup('invented-page',false,1)
  const fake={chat:{completions:{create:async()=>({choices:[{message:{content:answer({acceptableFamilies:[],itemCount:4})}}]})}}}
  const sheet=await draftLabels(options('invented-page'),fake)
  expect(sheet.entries[0]).toMatchObject({draftStatus:'complete',normalised:['acceptableFamilies'],label:{acceptableFamilies:['hero'],itemCount:4,itemKind:null}})
  expect((await calls(directory))[0].status).toBe('complete')
})

test('validation failure gets one corrective reply in the same conversation',async()=>{
  const {directory}=await pageSetup('invented-page',false,1)
  const requests:any[]=[]
  const fake={chat:{completions:{create:async(request:any)=>{requests.push(request);return {choices:[{message:{content:requests.length===1?answer({placement:'ceiling'}):answer()}}]}}}}}
  const sheet=await draftLabels(options('invented-page'),fake)
  expect(sheet.entries[0].draftStatus).toBe('complete')
  expect(requests).toHaveLength(2)
  expect(requests[1].messages).toHaveLength(4)
  const correction=requests[1].messages[3].content
  expect(correction).toContain('Reply again with valid JSON only')
  expect(correction).toContain('ceiling')
  expect((await calls(directory))[0].attempts).toHaveLength(2)
})

test('second validation failure marks block failed and records both attempts',async()=>{
  const {directory}=await pageSetup('invented-page',false,1)
  let count=0
  const fake={chat:{completions:{create:async()=>{count++;return {choices:[{message:{content:answer({placement:'ceiling'})}}]}}}}}
  const sheet=await draftLabels(options('invented-page'),fake)
  expect(count).toBe(2)
  expect(sheet.entries[0].draftStatus).toBe('failed')
  expect((await calls(directory))[0].attempts).toHaveLength(2)
})

test('provider error envelope is reported without the undefined choices TypeError',async()=>{
  const {directory}=await pageSetup('invented-page',false,1)
  const fake={chat:{completions:{create:async()=>({id:'failed',error:{message:'Invented provider rejection'}})}}}
  const sheet=await draftLabels(options('invented-page'),fake)
  expect(sheet.entries[0].error).toContain('Invented provider rejection')
  expect(sheet.entries[0].error).not.toContain("reading '0'")
  expect((await calls(directory))[0].error.message).toContain('Invented provider rejection')
})

test('batch includes proposal-only and v1 pages, with their correct block boundaries',async()=>{
  await pageSetup('proposal-page',false,3)
  await pageSetup('reviewed-page',true,3)
  await atomicJson(path.join(root,'pages.json'),Object.fromEntries(['proposal-page','reviewed-page'].map(page=>[page,{url:'https://invented.example/'+page,kind:'home',siteKind:'saas',heldOut:false,renderWithJavaScript:false,notes:''}])))
  const log=jest.spyOn(console,'log').mockImplementation(()=>{})
  try{
    const plan=await evaluate(parseEval(['draft','--catalogue',catalogue,'--set','C','--provider','claude-cli','--model','opus','--out','dry','--dry-run']))
    expect(plan.map(task=>[task.page,task.calls,task.source])).toEqual([['proposal-page',3,'blocks.json'],['reviewed-page',2,'answer-sheet.json']])
    expect(log.mock.calls.map(args=>args.join(' ')).join('\n')).toContain('Estimated calls: 5')
  }finally{log.mockRestore()}
})

test('claude-cli sends an image block with no tools and limits concurrent blocks',async()=>{
  const {directory}=await pageSetup()
  let active=0,maxActive=0
  const seen:Array<{command:string;args:string[];input:any}>=[]
  const runner=async(command:string,args:string[],input:string)=>{
    active++;maxActive=Math.max(maxActive,active)
    seen.push({command,args,input:JSON.parse(input.trim())})
    await new Promise(resolve=>setTimeout(resolve,15))
    active--
    return {stdout:JSON.stringify({type:'result',result:answer()}),exitCode:0}
  }
  const sheet=await draftLabels({...options('invented-page'),provider:'claude-cli' as const,concurrency:2},undefined,runner)
  expect(sheet.entries.map(entry=>entry.draftStatus)).toEqual(['complete','complete','complete'])
  expect(maxActive).toBe(2)
  expect(seen).toHaveLength(3)
  for(const call of seen){
    expect(call.command).toBe('claude')
    expect(call.args).toEqual(expect.arrayContaining(['--print','--input-format','stream-json','--output-format','json','--safe-mode','--settings','{"disableAllHooks":true}','--strict-mcp-config','--tools','','--model','opus']))
    expect(call.args.join(' ')).not.toMatch(/dangerously-skip-permissions|bypassPermissions/)
    const content=call.input.message.content
    expect(content[1]).toMatchObject({type:'image',source:{type:'base64',media_type:'image/png',data:expect.any(String)}})
    expect(Buffer.from(content[1].source.data,'base64').subarray(0,8).toString('hex')).toBe('89504e470d0a1a0a')
  }
  const records=await calls(directory)
  expect(records).toHaveLength(3)
  for(const record of records){expect(record).toMatchObject({provider:'claude-cli',billing:'subscription',cost:null,status:'complete',request:{promptSha256:expect.any(String),imageSha256:expect.any(String)}});expect(JSON.stringify(record)).not.toContain(seen[0].input.message.content[1].source.data)}
})

test('claude-cli corrective retry resumes the same block conversation',async()=>{
  await pageSetup('invented-page',false,1)
  const seen:Array<{args:string[];input:any}>=[]
  const runner=async(_command:string,args:string[],input:string)=>{
    seen.push({args,input:JSON.parse(input.trim())})
    return {stdout:JSON.stringify({type:'result',result:seen.length===1?answer({placement:'ceiling'}):answer()}),exitCode:0}
  }
  const sheet=await draftLabels({...options('invented-page'),provider:'claude-cli'},undefined,runner)
  expect(sheet.entries[0].draftStatus).toBe('complete')
  expect(seen).toHaveLength(2)
  expect(seen[0].args).toContain('--session-id')
  expect(seen[1].args).toContain('--resume')
  expect(seen[1].args.at(-1)).toBe(seen[0].args.at(-1))
  expect(seen[1].input.message.content[0].text).toContain('Reply again with valid JSON only')
  expect(seen[1].input.message.content[0].text).toContain('ceiling')
})

test('codex-cli reads only the reply file, isolates each call and removes its temp directory',async()=>{
  const {directory}=await pageSetup('invented-page',false,2)
  const seen:Array<{args:string[];input:string;temp:string;crop:Buffer}>=[]
  let active=0,maxActive=0
  const runner=async(command:string,args:string[],input:string)=>{
    active++;maxActive=Math.max(maxActive,active)
    expect(command).toBe('codex')
    expect(args.slice(0,2)).toEqual(['exec','-m'])
    const temp=args[args.indexOf('-C')+1],cropFile=args[args.indexOf('-i')+1],replyFile=args[args.indexOf('-o')+1]
    expect(args).toEqual(expect.arrayContaining(['-s','read-only','--skip-git-repo-check','-C',temp,'-i',cropFile,'-o',replyFile,'-']))
    expect(args.join(' ')).not.toMatch(/--dangerously-bypass-approvals-and-sandbox|--full-auto|workspace-write|danger-full-access/)
    expect(path.dirname(cropFile)).toBe(temp)
    expect(path.dirname(replyFile)).toBe(temp)
    expect(await fs.readdir(temp)).toEqual([path.basename(cropFile)])
    const crop=await fs.readFile(cropFile)
    expect(crop.subarray(0,8).toString('hex')).toBe('89504e470d0a1a0a')
    seen.push({args,input,temp,crop})
    await new Promise(resolve=>setTimeout(resolve,15))
    await fs.writeFile(replyFile,answer())
    active--
    return {stdout:'this is deliberately not JSON',exitCode:0}
  }
  const sheet=await draftLabels({...options('invented-page'),model:'gpt-6-sol',provider:'codex-cli' as const,concurrency:2},undefined,runner)
  expect(sheet.entries.map(entry=>entry.draftStatus)).toEqual(['complete','complete'])
  expect(seen).toHaveLength(2)
  expect(maxActive).toBe(2)
  expect(new Set(seen.map(call=>call.temp)).size).toBe(2)
  for(const call of seen){expect(call.input).toContain('replySchema');await expect(fs.stat(call.temp)).rejects.toMatchObject({code:'ENOENT'})}
  for(const record of await calls(directory)){
    expect(record).toMatchObject({provider:'codex-cli',billing:'subscription',cost:null,status:'complete',request:{promptSha256:expect.any(String),imageSha256:expect.any(String)}})
    for(const call of seen)expect(JSON.stringify(record)).not.toContain(call.crop.toString('base64'))
  }
})

test('codex-cli corrective retry includes the validation message and cleans both directories',async()=>{
  const {directory}=await pageSetup('invented-page',false,1)
  const dirs:string[]=[],inputs:string[]=[]
  const runner=async(_command:string,args:string[],input:string)=>{
    const temp=args[args.indexOf('-C')+1],replyFile=args[args.indexOf('-o')+1]
    dirs.push(temp);inputs.push(input)
    await fs.writeFile(replyFile,dirs.length===1?answer({placement:'ceiling'}):answer())
    return {stdout:'ignored',exitCode:0}
  }
  const sheet=await draftLabels({...options('invented-page'),model:'gpt-6-sol',provider:'codex-cli'},undefined,runner)
  expect(sheet.entries[0].draftStatus).toBe('complete')
  expect(dirs).toHaveLength(2)
  expect(dirs[0]).not.toBe(dirs[1])
  expect(inputs[1]).toContain('Reply again with valid JSON only')
  expect(inputs[1]).toContain('ceiling')
  expect((await calls(directory))[0].attempts).toHaveLength(2)
  for(const dir of dirs)await expect(fs.stat(dir)).rejects.toMatchObject({code:'ENOENT'})
})

test('batch only-failed counts failed and unfinished blocks across pages',async()=>{
  for(const page of ['first-page','second-page'])await pageSetup(page,false,1)
  await atomicJson(path.join(root,'pages.json'),Object.fromEntries(['first-page','second-page'].map(page=>[page,{url:'https://invented.example/'+page,kind:'home',siteKind:'saas',heldOut:false,renderWithJavaScript:false,notes:''}])))
  for(const page of ['first-page','second-page']){
    const fake={chat:{completions:{create:async()=>({choices:[{message:{content:answer({placement:'ceiling'})}}]})}}}
    await draftLabels(options(page),fake)
  }
  const log=jest.spyOn(console,'log').mockImplementation(()=>{})
  try{
    const plan=await evaluate(parseEval(['draft','--provider','claude-cli','--model','opus','--out','a','--only-failed','--dry-run']))
    expect(plan.map(task=>[task.page,task.calls,task.existing])).toEqual([['first-page',1,false],['second-page',1,false]])
  }finally{log.mockRestore()}
})

test('Claude refuses any managed policy file and fake spawn runs when none exists',async()=>{
  const managed=path.join(root,'managed'),other=path.join(root,'other-managed')
  await fs.mkdir(managed,{recursive:true})
  await assertClaudePolicyAbsent([managed,other])
  const child=Object.assign(new EventEmitter(),{stdin:new PassThrough(),stdout:new PassThrough(),stderr:new PassThrough()})
  const spawn=jest.fn((_binary:string,_args:string[],options:any)=>{
    expect(options.env).toEqual(childEnvironment('claude'))
    process.nextTick(()=>child.emit('close',0))
    return child as any
  })
  for(const name of ['managed-settings.json','managed-mcp.json']){
    const file=path.join(managed,name)
    await fs.writeFile(file,'{}')
    await expect(assertClaudePolicyAbsent([managed,other])).rejects.toThrow(file)
    await expect(defaultProcessRunner('claude',[], '',spawn as unknown as typeof spawnType,[managed,other])).rejects.toThrow(file)
    await fs.rm(file)
  }
  expect(spawn).not.toHaveBeenCalled()
  await expect(defaultProcessRunner('claude',['--version'],'',spawn as unknown as typeof spawnType,[managed,other])).resolves.toMatchObject({exitCode:0})
  expect(spawn).toHaveBeenCalledTimes(1)
})

test('child environments exclude unrelated parent credentials',()=>{
  const keys=['OPENROUTER_API_KEY','AWS_SECRET_ACCESS_KEY','ANTHROPIC_API_KEY','OPENAI_API_KEY','OTHER_SECRET','OTHER_TOKEN']
  const previous=Object.fromEntries(keys.map(key=>[key,process.env[key]]))
  try {
    for(const key of keys)process.env[key]='sentinel-'+key
    for(const command of ['claude','codex'] as const){
      const environment=childEnvironment(command)
      for(const key of keys)expect(environment).not.toHaveProperty(key)
      expect(environment).toHaveProperty('PATH')
      expect(Object.keys(environment)).toEqual(expect.arrayContaining(['PATH','TEMP']))
    }
  }finally{for(const key of keys)if(previous[key]===undefined)delete process.env[key];else process.env[key]=previous[key]}
})

test('actual Codex spawn options contain only allowlisted environment values',async()=>{
  const previous=process.env.AWS_SECRET_ACCESS_KEY
  process.env.AWS_SECRET_ACCESS_KEY='sentinel-parent-secret'
  const child=Object.assign(new EventEmitter(),{stdin:new PassThrough(),stdout:new PassThrough(),stderr:new PassThrough()})
  const spawn=jest.fn((_binary:string,_args:string[],options:any)=>{
    expect(options.env.AWS_SECRET_ACCESS_KEY).toBeUndefined()
    expect(options.env.PATH).toBe(process.env.PATH)
    expect(Object.keys(options.env).every(key=>Object.hasOwn(childEnvironment('codex'),key))).toBe(true)
    process.nextTick(()=>child.emit('close',0))
    return child as any
  })
  try {
    await expect(defaultProcessRunner('codex',['--version'],'',spawn as unknown as typeof spawnType)).resolves.toMatchObject({exitCode:0})
    expect(spawn).toHaveBeenCalledTimes(1)
  }finally{if(previous===undefined)delete process.env.AWS_SECRET_ACCESS_KEY;else process.env.AWS_SECRET_ACCESS_KEY=previous}
})

test('CLI stderr and echoed crop bytes never enter failure files',async()=>{
  for(const provider of ['claude-cli','codex-cli'] as const){
    const page=provider==='claude-cli'?'claude-failure':'codex-failure'
    const {directory}=await pageSetup(page,false,1)
    let echoedImage=''
    const runner=async(_command:string,args:string[],input:string)=>{
      echoedImage=provider==='claude-cli'?JSON.parse(input).message.content[1].source.data:(await fs.readFile(args[args.indexOf('-i')+1])).toString('base64')
      return {stdout:'OPENROUTER_API_KEY=sentinel-stdout '+echoedImage,stderr:'AWS_SECRET_ACCESS_KEY=sentinel-stderr '+echoedImage,exitCode:1}
    }
    const sheet=await draftLabels({...options(page),provider,model:provider==='claude-cli'?'opus':'gpt-6-sol'},undefined,runner)
    expect(sheet.entries[0].draftStatus).toBe('failed')
    const saved=JSON.stringify(await calls(directory))+await fs.readFile(path.join(directory,'label-a.json'),'utf8')
    expect(saved).not.toContain('sentinel-stdout')
    expect(saved).not.toContain('sentinel-stderr')
    expect(saved).not.toContain(echoedImage)
  }
})

test('stdout-derived errors and replies redact credentials and images',async()=>{
  const {directory}=await pageSetup('invented-page',false,1)
  const image='a'.repeat(180)
  const fake={chat:{completions:{create:async()=>({choices:[{message:{content:answer({reason:'Bearer sentinel-reply OPENAI_API_KEY=sentinel-key data:image/png;base64,'+image})}}]})}}}
  await draftLabels(options('invented-page'),fake)
  const saved=JSON.stringify(await calls(directory))+await fs.readFile(path.join(directory,'label-a.json'),'utf8')
  for(const secret of ['sentinel-reply','sentinel-key',image])expect(saved).not.toContain(secret)
  expect(saved).toContain('[redacted]')

  const failurePage='provider-error'
  const failure=await pageSetup(failurePage,false,1)
  const rejected={chat:{completions:{create:async()=>({error:{message:'OPENROUTER_API_KEY=sentinel-error data:image/png;base64,'+image+' x'.repeat(2000)}})}}}
  await draftLabels(options(failurePage),rejected)
  const failed=JSON.stringify(await calls(failure.directory))+await fs.readFile(path.join(failure.directory,'label-a.json'),'utf8')
  expect(failed).not.toContain('sentinel-error')
  expect(failed).not.toContain(image)
  expect((await calls(failure.directory))[0].error.message.length).toBeLessThanOrEqual(1000)
})

test.each(['claude-cli','codex-cli'] as const)('%s persists no credentials from properties, quoted strings, bare forms or errors',async provider=>{
  const page=provider+'-credentials',failurePage=provider+'-credential-error'
  const {directory}=await pageSetup(page,false,1)
  const secrets=['sentinel-property-123456','sentinel-api-camel-123456','sentinel-quoted-123456','sentinel-escaped-123456','sentinel-token-123456','sentinel-password-123456','sentinel-access-123456','sentinel-authorization-123456','sentinel-cookie-123456','sentinel-secret-123456']
  const forms=[`"api_key":"${secrets[2]}"`,String.raw`\"apiKey\":\"${secrets[3]}\"`,`token=${secrets[4]}`,`password: ${secrets[5]}`,`access_token: "${secrets[6]}"`,`AUTHORIZATION=${secrets[7]}`,`cookie: ${secrets[8]}`,`secret=${secrets[9]}`]
  const reply=(placement:string)=>answer({placement,reason:forms.join(' '),...(placement==='ceiling'?{metadata:{nested:{api_key:secrets[0],apiKey:secrets[1]}}}:{})})
  let attempt=0
  const runner=async(_command:string,args:string[])=>{
    const raw=reply(++attempt===1?'ceiling':'main')
    if(provider==='codex-cli')await fs.writeFile(args[args.indexOf('-o')+1],raw)
    return {stdout:provider==='claude-cli'?JSON.stringify({type:'result',result:raw}):'',exitCode:0}
  }
  const sheet=await draftLabels({...options(page),provider},undefined,runner)
  expect(sheet.entries[0].draftStatus).toBe('complete')
  const record=(await calls(directory))[0]
  expect(record.attempts.map((item:any)=>item.status)).toEqual(['validation-failed','complete'])
  const persisted=JSON.stringify(record)+await fs.readFile(path.join(directory,'label-a.json'),'utf8')
  for(const secret of secrets)expect(persisted).not.toContain(secret)
  expect(persisted).toContain('[redacted]')

  const failure=await pageSetup(failurePage,false,1)
  const failed=await draftLabels({...options(failurePage),provider},undefined,async()=>{throw new Error(forms.join(' '))})
  expect(failed.entries[0].draftStatus).toBe('failed')
  const savedError=JSON.stringify(await calls(failure.directory))+await fs.readFile(path.join(failure.directory,'label-a.json'),'utf8')
  for(const secret of secrets.slice(2))expect(savedError).not.toContain(secret)
})

test('only-failed batch keeps complete entries and starts missing outputs',async()=>{
  const pages=['complete-page','failed-page','pending-page','never-started-page']
  for(const page of pages)await pageSetup(page,false,page==='pending-page'||page==='never-started-page'?2:1)
  await atomicJson(path.join(root,'pages.json'),Object.fromEntries(pages.map(page=>[page,{url:'https://invented.example/'+page,kind:'home',siteKind:'saas',heldOut:false,renderWithJavaScript:false,notes:''}])))
  const good={chat:{completions:{create:async()=>({choices:[{message:{content:answer()}}]})}}}
  await draftLabels(options('complete-page'),good)
  await draftLabels(options('pending-page'),good)
  const pendingFile=path.join(root,'labels','pending-page','label-a.json')
  const pending=JSON.parse(await fs.readFile(pendingFile,'utf8'))
  pending.entries[1].draftStatus='pending';pending.entries[1].label=null
  await atomicJson(pendingFile,pending)
  const bad={chat:{completions:{create:async()=>({choices:[{message:{content:answer({placement:'ceiling'})}}]})}}}
  await draftLabels(options('failed-page'),bad)
  const log=jest.spyOn(console,'log').mockImplementation(()=>{})
  try {
    const plan=await evaluate(parseEval(['draft','--provider','codex-cli','--model','opus','--out','a','--only-failed','--dry-run']))
    expect(plan.map(task=>[task.page,task.calls,task.existing])).toEqual([
      ['complete-page',0,true],['failed-page',1,false],['never-started-page',2,false],['pending-page',1,false]
    ])
  }finally{log.mockRestore()}
  let callsMade=0
  const resumed=await draftLabels({...options('pending-page'),onlyFailed:true}, {chat:{completions:{create:async()=>{callsMade++;return {choices:[{message:{content:answer()}}]}}}}})
  expect(callsMade).toBe(1)
  expect(resumed.entries.map(entry=>entry.draftStatus)).toEqual(['complete','complete'])
  const started=await draftLabels({...options('never-started-page'),onlyFailed:true},good)
  expect(started.entries.map(entry=>entry.draftStatus)).toEqual(['complete','complete'])
})
