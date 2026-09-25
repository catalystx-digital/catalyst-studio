import { loadFamilies, validateFamilyOptions, type FamilyOptions } from './families'
import { ARMS } from './run-arm'
import { mapLimited } from './call-recording'
import fs from 'node:fs/promises'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { dataRoot, main, identifier } from './storage'
import { directories, familyBlockSource, optionalJson } from './labels'
import { selectFailedEntries, type DraftProvider } from './draft-labels'
import { mergePage, writeAgreement } from './merge-labels'
import { loadPages, type PageManifest } from './pages'
import { readSavedResults, callTotals, median, type SavedResult } from './summary'
import { stickScoreName } from './stick-version'
import { generateAccuracy } from './accuracy'
import { checkLeaks } from './leak-check'
import { generateComparison } from './compare'
import { verifySavedRuns } from './verify'
import { repairSavedRuns } from './repair'

interface EvalOptions extends FamilyOptions { command:string; run:string; arms:string[]; arm?:string; runs:string[]; roots:string[]; concurrency:number; dryRun:boolean; yesSpend:boolean; heldOut:boolean; model?:string; provider:DraftProvider; onlyFailed?:boolean;out?:string;a?:string;b?:string;c?:string;round?:1|2;baseline?:string;candidate?:string;heldOutRuns:string[] }
interface Task {page:string;stage:string;script:string;args:string[];existing:boolean;paid:boolean;internet:boolean;calls:number|null;cost:number|null;source?:'answer-sheet.json'|'blocks.json';reason?:string}
export function parseEval(argv:string[]): EvalOptions {
  const [command,...args]=argv, values:Record<string,string>={}, flags=['--dry-run','--yes-spend','--only-failed','--held-out']
  const allowed=[...flags,'--families','--family-set','--catalogue','--set','--out','--a','--b','--c','--run','--arms','--arm','--runs','--root','--concurrency','--model','--provider','--round','--baseline','--candidate','--held-out-runs'],roots:string[]=[]
  if(!['blocks','arms','score','summary','snapshot','draft','merge','review','accuracy','verify','repair','leak-check','compare'].includes(command))throw new Error('Use eval.ts blocks|arms|score|summary|snapshot|draft|merge|review|accuracy|verify|repair|leak-check|compare')
  for(let i=0;i<args.length;i++) { const key=args[i];if(!allowed.includes(key)||(key in values&&key!=='--root'))throw new Error('Unknown or duplicate option: '+key);if(flags.includes(key))values[key]='true';else{if(!args[i+1]||args[i+1].startsWith('--'))throw new Error('Missing value: '+key);const value=args[++i];if(key==='--root')roots.push(value);else values[key]=value} }
  const positive=(key:string,fallback:number,min=1)=>{const n=values[key]===undefined?fallback:Number(values[key]);if(!Number.isSafeInteger(n)||n<min)throw new Error(key+' must be an integer of at least '+min);return n}
  const families=values['--catalogue']||values['--families']||(['draft','score'].includes(command)?path.join(__dirname,'component-families.json'):undefined)
  const familySet=values['--set']||values['--family-set']||(['draft','score'].includes(command)?'C':undefined)
  const provider=(values['--provider']||'openrouter') as DraftProvider
  if(!['openrouter','claude-cli','codex-cli'].includes(provider)||values['--provider']&&command!=='draft')throw new Error('--provider applies to draft and must be openrouter, claude-cli or codex-cli')
  if(command==='draft'&&positive('--concurrency',1)>4)throw new Error('--concurrency must be at most 4 for draft')
  if(!['accuracy','compare'].includes(command))validateFamilyOptions({families,familySet})
  if(command==='accuracy'&&values['--families'])throw new Error('Accuracy uses --family-set without --families')
  if(values['--families']&&!['score','arms','summary'].includes(command))throw new Error('Family flags apply to score, arms or summary')
  if(values['--catalogue']&&command!=='draft')throw new Error('--catalogue applies to draft')
  if(command==='draft'&&(!families||!familySet||!values['--out']))throw new Error('Draft needs --catalogue, --set and --out')
  if(command==='merge'&&(!values['--a']||!values['--b']))throw new Error('Merge needs --a and --b')
  if(roots.length&&command!=='leak-check')throw new Error('--root applies to leak-check')
  const runs=values['--runs']?.split(',').map(identifier)||[]
  const heldOutRuns=values['--held-out-runs']?.split(',').map(identifier)||[]
  if(new Set(runs).size!==runs.length)throw new Error('Duplicate run')
  if(new Set(heldOutRuns).size!==heldOutRuns.length)throw new Error('Duplicate held-out run')
  const pair=values['--baseline']+'|'+values['--candidate']
  if(command==='compare'&&(!['blocks-production|family-fill','blocks-production|blocks-production+repair','family-fill|family-fill+repair'].includes(pair)||runs.length!==2||heldOutRuns.length!==1||familySet!=='C'))throw new Error('Compare needs a supported baseline/candidate pair, two --runs, one --held-out-runs and --family-set C')
  if(command!=='compare'&&(values['--baseline']||values['--candidate']||values['--held-out-runs']))throw new Error('Comparison options apply to compare')
  if(command==='accuracy'&&(!values['--arm']||![1,2,4].includes(runs.length)))throw new Error('Accuracy needs --arm and one, two or four --runs')
  if(command==='verify'&&(!values['--arm']||!runs.length))throw new Error('Verify needs --arm and --runs')
  if(command==='repair'&&(!['blocks-production','family-fill'].includes(values['--arm'])||!runs.length||!!values['--dry-run']===!!values['--yes-spend']))throw new Error('Repair needs --arm blocks-production|family-fill, --runs, and exactly one of --dry-run or --yes-spend')
  if(values['--held-out']&&command!=='repair')throw new Error('--held-out applies to repair')
  if(command==='score'&&values['--runs']&&(!values['--arm']||!runs.length))throw new Error('Score needs --arm with --runs')
  if(values['--round']&&(command!=='review'||!['1','2'].includes(values['--round'])))throw new Error('--round applies to review and must be 1 or 2')
  const arms=values['--arms']?.split(',').map(identifier)||[]
  if(command==='arms'&&(!arms.length||!values['--run']))throw new Error('Arms need --arms a,b,c --run r1')
  if(values['--families']&&command==='arms'&&(arms.some(arm=>arm!=='jev-pick')))throw new Error('Family picking applies only to jev-pick')
  if(arms.some(arm=>![...ARMS,'jev-pick'].includes(arm)))throw new Error('Unknown arm')
  if(new Set(arms).size!==arms.length)throw new Error('Duplicate arm')
  return {families,familySet,command,run:identifier(values['--run']||'r1'),arms,arm:values['--arm']?identifier(values['--arm']):undefined,runs,heldOutRuns,baseline:values['--baseline'],candidate:values['--candidate'],roots,concurrency:positive('--concurrency',1),dryRun:!!values['--dry-run'],yesSpend:!!values['--yes-spend'],heldOut:!!values['--held-out'],model:values['--model'],provider,onlyFailed:!!values['--only-failed'],out:values['--out'],a:values['--a'],b:values['--b'],c:values['--c'],round:values['--round']?Number(values['--round']) as 1|2:undefined}
}
export function estimate(history:SavedResult[], arm:string) {
  const rows=history.filter(r=>r.arm===arm&&r.calls.length)
  const calls=rows.map(r=>callTotals(r.calls).calls)
  const costs=rows.map(r=>callTotals(r.calls).cost).filter(c=>c.known===c.count&&c.count>0).map(c=>c.value)
  return {calls:median(calls),cost:median(costs)}
}
const exists=async(file:string)=>{try{await fs.stat(file);return true}catch(e){if((e as NodeJS.ErrnoException).code==='ENOENT')return false;throw e}}
export async function planEvaluation(options:EvalOptions,pages:PageManifest,history:SavedResult[]=[]):Promise<Task[]> {
  validateFamilyOptions(options)
  const tasks:Task[]=[], root=dataRoot(), familyArgs=options.families?['--families',options.families,'--family-set',options.familySet!]:[]
  const add=async(page:string,stage:string,script:string,args:string[],output:string|null,paid=false,internet=false,arm=stage,reason?:string)=>{
    const known=paid?estimate(history,arm):{calls:0,cost:0}
    let calls=known.calls, cost=known.cost
    const label=path.join(root,'labels',page)
    if(paid||stage==='draft') {
      const proposal=stage==='draft'?await familyBlockSource(page):await optionalJson(path.join(label,'blocks.json')),sheet=await optionalJson(path.join(label,'answer-sheet.json'))
      let initial:number|null=null
      if(stage==='draft'&&proposal) {
        const previous=await optionalJson(path.join(label,'label-'+options.out+'.json'))
        initial=options.onlyFailed&&previous?selectFailedEntries(proposal.blocks,previous.entries).length:proposal.blocks.length
      }
      if(stage==='arms') {
        if(arm==='blocks-production')initial=proposal?proposal.blocks.length*2:null
        else if(arm==='jev-pick')initial=sheet?sheet.entries.filter((e:any)=>e.status!=='draft'&&e.label).length:null
      }
      if(stage==='draft') {calls=initial;if(options.provider!=='openrouter')cost=null;else if(initial!==null&&known.calls&&known.cost!==null)cost=known.cost*initial/known.calls;if(initial===0&&options.provider==='openrouter')cost=0}
      else calls ??= initial
    }
    tasks.push({page,stage,script,args,existing:(output?await exists(output):false)||(stage==='draft'&&calls===0),paid,internet,calls,cost,source:stage==='draft'?(await exists(path.join(label,'answer-sheet.json'))?'answer-sheet.json':'blocks.json'):undefined,reason})
  }
  if(options.command==='summary'||options.command==='review') {
    await add('all',options.command,options.command==='summary'?'summary.ts':'review-server.ts',options.command==='review'?[...(options.arm?['--arm',options.arm]:[]),...(options.run?['--run',options.run]:[]),...(options.round?['--round',String(options.round)]:[])]:familyArgs,null)
    return tasks
  }
  for(const [page,entry] of Object.entries(pages).sort(([a],[b])=>a.localeCompare(b))) {
    const label=path.join(root,'labels',page), arms=path.join(root,'arms',page)
    if(options.command==='snapshot') {
      const {pageSlug}=await import('./storage')
      if(pageSlug(entry.url)!==page)throw new Error('Snapshot slug must match pageSlug(url): '+page)
      await add(page,'snapshot','snapshot.ts',[entry.url],path.join(root,'pages',page),false,true)
    }
    if(options.command==='blocks')await add(page,'blocks','propose-blocks.ts',['--page',page,...(!entry.renderWithJavaScript?['--no-js']:[])],path.join(label,'blocks.json'),false,true)
    if(options.command==='draft') {
      if(!options.model)throw new Error('Draft needs --model with a vision-capable model')
      if(!await exists(path.join(label,'blocks.json'))||!await exists(path.join(label,'screenshot.png')))continue
      await add(page,'draft','draft-labels.ts',['--page',page,'--catalogue',options.families!,'--set',options.familySet!,'--model',options.model,'--out',options.out!,'--provider',options.provider,'--concurrency',String(options.concurrency),...(options.onlyFailed?['--only-failed']:[]),...(options.yesSpend?['--yes-spend']:[])],options.onlyFailed?null:path.join(label,'label-'+options.out+'.json'),options.provider==='openrouter',true,'draft')
    }
    if(options.command==='merge') {
      const left=await exists(path.join(label,'label-'+options.a+'.json')),right=await exists(path.join(label,'label-'+options.b+'.json'))
      if(left!==right)throw new Error('Both labellers must have a label output for '+page)
      if(!left)continue
      const target=path.join(label,'answer-sheet-v2.json'),previous=await optionalJson<{heldOut?:boolean;labellers?:{a?:{out:string};b?:{out:string};c?:{out:string}}}>(target)
      const current=previous?.labellers?.a?.out===options.a&&previous?.labellers?.b?.out===options.b&&(previous?.heldOut||(previous?.labellers?.c?.out||undefined)===(options.c||undefined))
      await add(page,'merge','merge-labels.ts',['--page',page,'--a',options.a!,'--b',options.b!,...(options.c?['--c',options.c]:[])],current?target:null)
    }
    if(options.command==='arms') {
      for(const arm of options.arms) {
        const args=['--page',page,'--arm',arm,'--run',options.run,...familyArgs]
        await add(page,'arms','run-arm.ts',args,path.join(arms,options.families?'jev-pick@families-'+options.familySet:arm,options.run),true,true,arm)
      }
    }
    if(options.command==='score') {
      const scoreRoot=path.join(label,'scores-stick'), extra=familyArgs
      for(const arm of await directories(arms))for(const run of await directories(path.join(arms,arm))) {
        if(options.arm&&arm!==options.arm||options.runs.length&&!options.runs.includes(run))continue
        const folder=path.join(arms,arm,run),record=await optionalJson(path.join(folder,'run.json'))
        if(!record||record.status==='dry-run'||arm==='jev-pick'||arm.startsWith('jev-pick@families-'))continue
        const name=stickScoreName(arm,run)
        await add(page,'score','score.ts',['--page',page,'--components',path.join(folder,'components.json'),'--name',name,...extra],path.join(scoreRoot,stickScoreName(arm,run,options.familySet)+'.json'))
      }
    }
  }
  return tasks
}
export function authorizePlan(tasks:Task[],options:EvalOptions) {
  if(!options.dryRun&&!options.yesSpend&&tasks.some(t=>t.paid&&!t.existing))throw new Error('Paid calls are blocked. Read the --dry-run plan, then add --yes-spend to run it.')
}
function printPlan(tasks:Task[]) {
  if(tasks.length&&tasks.every(task=>task.stage==='merge'||task.stage==='score')){console.log(tasks.length+' offline '+tasks[0].stage+' tasks; '+tasks.filter(task=>task.existing).length+' already complete.');return}
  const pending=tasks.filter(t=>!t.existing),unknownCalls=pending.filter(t=>t.calls===null).length,unknownCosts=pending.filter(t=>t.cost===null).length
  if(tasks.length&&tasks.every(t=>t.stage==='draft'))for(const source of ['answer-sheet.json','blocks.json'] as const){const group=tasks.filter(t=>t.source===source);console.log(source+': '+group.length+' pages, '+group.reduce((n,t)=>n+(t.calls||0),0)+' blocks')}
  const subscription=tasks.length>0&&tasks.every(t=>t.stage==='draft'&&!t.paid)
  console.log(pending.length+' tasks to run; '+(tasks.length-pending.length)+' existing tasks skipped. Estimated calls: '+pending.reduce((n,t)=>n+(t.calls||0),0)+(unknownCalls?' plus '+unknownCalls+' unknown tasks':'')+'. '+(subscription?'Subscription billing; API cost not applicable.':'Estimated cost: $'+pending.reduce((n,t)=>n+(t.cost||0),0).toFixed(4)+(unknownCosts?' plus '+unknownCosts+' unknown tasks':'')+'.'))
  console.log(subscription?'Each block uses the '+tasks[0].args[tasks[0].args.indexOf('--provider')+1]+' subscription route; validation retries may add calls.':tasks.every(t=>t.stage==='draft')?'Draft cost estimate uses recorded model prices and calls; actual vision tokens and retries may differ.':'Estimates use middle recorded page costs and call counts. Splits and retries can add calls; unknown costs are not zero. Existing folders are never overwritten; use a fresh run ID after failure.')
  for(const t of tasks)console.log((t.existing?'SKIP':t.paid?'PAID':t.stage==='draft'?'SUBSCRIPTION':t.internet?'INTERNET':'FREE')+' '+t.page+': '+t.script+' '+t.args.join(' ')+'; source '+(t.source||'n/a')+'; blocks '+(t.calls??'unknown')+'; cost '+(t.cost===null?'unknown':'$'+t.cost.toFixed(4)))
}
async function execute(task:Task) {
  await new Promise<void>((resolve,reject)=>{
    const child=spawn(process.execPath,['--import','tsx',path.join(__dirname,task.script),...task.args],{stdio:'inherit',windowsHide:true,env:process.env})
    child.once('error',reject);child.once('exit',code=>code===0?resolve():reject(new Error(task.script+' exited '+code)))
  })
}
async function draftHistory():Promise<SavedResult[]> {
  const history:SavedResult[]=[]
  for(const page of await directories(path.join(dataRoot(),'labels'))) {
    const directory=path.join(dataRoot(),'labels',page,'calls')
    for(const run of await directories(directory)) {
      const calls:any[]=[]
      for(const file of (await fs.readdir(path.join(directory,run))).filter(f=>f.endsWith('.json'))) {
        const c=await optionalJson(path.join(directory,run,file));if(c&&!['planned','dry-run'].includes(c.status))calls.push({status:c.status,usage:c.usage,cost:c.cost,latencyMs:c.latencyMs})
      }
      if(calls.length)history.push({page,arm:'draft',run,status:'complete',rows:[],reviewedBy:{},calls,seconds:null,issues:[],picks:[],record:{}})
    }
  }
  return history
}
export async function evaluate(options:EvalOptions) {
  if(options.command==='repair'){
    try {await repairSavedRuns({arm:options.arm as 'blocks-production'|'family-fill',runs:options.runs,heldOut:options.heldOut,dryRun:options.dryRun,yesSpend:options.yesSpend})}
    catch(error){if(options.heldOut)throw new Error('Held-out repair failed');throw error}
    return []
  }
  if(options.command==='verify'){const result=await verifySavedRuns({arm:options.arm!,runs:options.runs});if(result.mismatches.length)process.exitCode=1;return []}
  if(options.command==='compare'){await generateComparison(dataRoot(),{baseline:options.baseline!,candidate:options.candidate!,runs:options.runs,heldOutRuns:options.heldOutRuns,familySet:options.familySet!});return []}
  if(options.command==='accuracy'){await generateAccuracy(dataRoot(),{arm:options.arm!,runs:options.runs,familySet:options.familySet});return []}
  if(options.command==='leak-check'){process.exitCode=await checkLeaks([dataRoot(),...options.roots]);return []}
  if(options.families)await loadFamilies(options.families,options.familySet!)
  const pages=await loadPages()
  if(options.command==='score')for(const page of [...await directories(path.join(dataRoot(),'labels')),...await directories(path.join(dataRoot(),'arms'))])if(!pages[page])pages[page]={url:'https://example.invalid/',kind:'other',siteKind:'saas',heldOut:false,renderWithJavaScript:false,notes:'Discovered for scoring; not saved to manifest'}
  const history=[...(options.command==='arms'?await readSavedResults():[]),...(options.command==='draft'?await draftHistory():[])],tasks=await planEvaluation(options,pages,history)
  printPlan(tasks);authorizePlan(tasks,options)
  if(options.dryRun)return tasks
  if(options.command==='merge') {
    for(const task of tasks.filter(task=>!task.existing))await mergePage(task.page,options.a!,options.b!,options.c,false)
    await writeAgreement()
    return tasks
  }
  const byPage=[...new Set(tasks.map(t=>t.page))]
  const outcomes=await mapLimited(byPage,options.command==='draft'?1:options.concurrency,async page=>{
    for(const task of tasks.filter(t=>t.page===page&&!t.existing))await execute(task)
  })
  const failures=outcomes.filter(r=>r.status==='rejected') as PromiseRejectedResult[]
  if(failures.length)throw new Error(failures.map(f=>String(f.reason)).join('\n'))
  return tasks
}
if(require.main===module)main(async()=>{await evaluate(parseEval(process.argv.slice(2)))})
