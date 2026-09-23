import { loadFamilies, validateFamilyOptions, type FamilyOptions } from './families'
import { ARMS } from './run-arm'
import { mapLimited } from './call-recording'
import fs from 'node:fs/promises'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { dataRoot, main, identifier } from './storage'
import { directories, optionalJson } from './labels'
import { selectDraftEntries } from './draft-labels'
import { loadPages, type PageManifest } from './pages'
import { readSavedResults, callTotals, median, type SavedResult } from './summary'

interface EvalOptions extends FamilyOptions { command:string; run:string; arms:string[]; concurrency:number; dryRun:boolean; yesSpend:boolean; model?:string; onlyFailed?:boolean }
interface Task {page:string;stage:string;script:string;args:string[];existing:boolean;paid:boolean;internet:boolean;calls:number|null;cost:number|null;reason?:string}
export function parseEval(argv:string[]): EvalOptions {
  const [command,...args]=argv, values:Record<string,string>={}, flags=['--dry-run','--yes-spend','--only-failed']
  const allowed=[...flags,'--families','--family-set','--run','--arms','--concurrency','--model']
  if(!['blocks','arms','score','summary','snapshot','draft','review'].includes(command))throw new Error('Use eval.ts blocks|arms|score|summary|snapshot|draft|review')
  for(let i=0;i<args.length;i++) { const key=args[i];if(!allowed.includes(key)||key in values)throw new Error('Unknown or duplicate option: '+key);if(flags.includes(key))values[key]='true';else{if(!args[i+1]||args[i+1].startsWith('--'))throw new Error('Missing value: '+key);values[key]=args[++i]} }
  const positive=(key:string,fallback:number,min=1)=>{const n=values[key]===undefined?fallback:Number(values[key]);if(!Number.isSafeInteger(n)||n<min)throw new Error(key+' must be an integer of at least '+min);return n}
  validateFamilyOptions({families:values['--families'],familySet:values['--family-set']})
  if(values['--families']&&!['score','arms','summary'].includes(command))throw new Error('Family flags apply to score, arms or summary')
  const arms=values['--arms']?.split(',').map(identifier)||[]
  if(command==='arms'&&(!arms.length||!values['--run']))throw new Error('Arms need --arms a,b,c --run r1')
  if(values['--families']&&command==='arms'&&(arms.some(arm=>arm!=='jev-pick')))throw new Error('Family picking applies only to jev-pick')
  if(arms.some(arm=>![...ARMS,'jev-pick'].includes(arm)))throw new Error('Unknown arm')
  if(new Set(arms).size!==arms.length)throw new Error('Duplicate arm')
  return {families:values['--families'],familySet:values['--family-set'],command,run:identifier(values['--run']||'r1'),arms,concurrency:positive('--concurrency',1),dryRun:!!values['--dry-run'],yesSpend:!!values['--yes-spend'],model:values['--model'],onlyFailed:!!values['--only-failed']}
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
    if(paid) {
      const proposal=await optionalJson(path.join(label,'blocks.json')),sheet=await optionalJson(path.join(label,'answer-sheet.json'))
      let initial:number|null=null
      if(stage==='draft'&&proposal) {
        const previous=await optionalJson(path.join(label,'draft.json'))
        const kept=options.onlyFailed?selectDraftEntries(proposal,previous,sheet,true):[]
        initial=proposal.blocks.length-kept.length
      }
      if(stage==='arms') {
        if(arm==='blocks-production')initial=proposal?proposal.blocks.length*2:null
        else if(arm==='jev-pick')initial=sheet?sheet.entries.filter((e:any)=>e.status!=='draft'&&e.label).length:null
      }
      if(stage==='draft') {calls=initial;if(initial!==null&&known.calls&&known.cost!==null)cost=known.cost*initial/known.calls;if(initial===0)cost=0}
      else calls ??= initial
    }
    tasks.push({page,stage,script,args,existing:(output?await exists(output):false)||(stage==='draft'&&calls===0),paid,internet,calls,cost,reason})
  }
  if(options.command==='summary'||options.command==='review') {
    await add('all',options.command,options.command==='summary'?'summary.ts':'review-server.ts',familyArgs,null)
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
      await add(page,'draft','draft-labels.ts',['--page',page,'--model',options.model,...(options.onlyFailed?['--only-failed']:[])],options.onlyFailed?null:path.join(label,'draft.json'),true,true,'draft')
    }
    if(options.command==='arms') {
      for(const arm of options.arms) {
        const args=['--page',page,'--arm',arm,'--run',options.run,...familyArgs]
        await add(page,'arms','run-arm.ts',args,path.join(arms,options.families?'jev-pick@families-'+options.familySet:arm,options.run),true,true,arm)
      }
    }
    if(options.command==='score') {
      const scoreRoot=path.join(label,'scores-stick'), extra=familyArgs
      if(options.families)await add(page,'score','family-pick-score.ts',['--page',page,...familyArgs],null)
      for(const arm of await directories(arms))for(const run of await directories(path.join(arms,arm))) {
        const folder=path.join(arms,arm,run),record=await optionalJson(path.join(folder,'run.json'))
        if(!record||record.status==='dry-run'||arm==='jev-pick'||arm.startsWith('jev-pick@families-'))continue
        await add(page,'score','score.ts',['--page',page,'--components',path.join(folder,'components.json'),'--name',arm+'--'+run+'-v5',...extra],path.join(scoreRoot,arm+'--'+run+'-v5'+(options.families?'-family-'+options.familySet:'')+'.json'))
      }
    }
  }
  return tasks
}
export function authorizePlan(tasks:Task[],options:EvalOptions) {
  if(!options.dryRun&&!options.yesSpend&&tasks.some(t=>t.paid&&!t.existing))throw new Error('Paid calls are blocked. Read the --dry-run plan, then add --yes-spend to run it.')
}
function printPlan(tasks:Task[]) {
  const pending=tasks.filter(t=>!t.existing),unknownCalls=pending.filter(t=>t.calls===null).length,unknownCosts=pending.filter(t=>t.cost===null).length
  console.log(pending.length+' tasks to run; '+(tasks.length-pending.length)+' existing tasks skipped. Estimated calls: '+pending.reduce((n,t)=>n+(t.calls||0),0)+(unknownCalls?' plus '+unknownCalls+' unknown tasks':'')+'. Estimated cost: $'+pending.reduce((n,t)=>n+(t.cost||0),0).toFixed(4)+(unknownCosts?' plus '+unknownCosts+' unknown tasks':'')+'.')
  console.log('Estimates use middle recorded page costs and call counts. Splits and retries can add calls; unknown costs are not zero. Existing folders are never overwritten; use a fresh run ID after failure.')
  for(const t of tasks)console.log((t.existing?'SKIP':t.paid?'PAID':t.internet?'INTERNET':'FREE')+' '+t.page+': '+t.script+' '+t.args.join(' ')+'; calls '+(t.calls??'unknown')+'; cost '+(t.cost===null?'unknown':'$'+t.cost.toFixed(4)))
}
async function execute(task:Task) {
  await new Promise<void>((resolve,reject)=>{
    const child=spawn(process.execPath,['--import','tsx',path.join(__dirname,task.script),...task.args],{stdio:'inherit',windowsHide:true,env:process.env})
    child.once('error',reject);child.once('exit',code=>code===0?resolve():reject(new Error(task.page+' '+task.script+' exited '+code)))
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
  if(options.families)await loadFamilies(options.families,options.familySet!)
  const pages=await loadPages()
  if(options.command==='score')for(const page of [...await directories(path.join(dataRoot(),'labels')),...await directories(path.join(dataRoot(),'arms'))])if(!pages[page])pages[page]={url:'https://example.invalid/',kind:'other',heldOut:false,renderWithJavaScript:false,notes:'Discovered for scoring; not saved to manifest'}
  const history=[...await readSavedResults(),...(options.command==='draft'?await draftHistory():[])],tasks=await planEvaluation(options,pages,history)
  printPlan(tasks);authorizePlan(tasks,options)
  if(options.dryRun)return tasks
  const byPage=[...new Set(tasks.map(t=>t.page))]
  const outcomes=await mapLimited(byPage,options.concurrency,async page=>{
    for(const task of tasks.filter(t=>t.page===page&&!t.existing))await execute(task)
  })
  const failures=outcomes.filter(r=>r.status==='rejected') as PromiseRejectedResult[]
  if(failures.length)throw new Error(failures.map(f=>String(f.reason)).join('\n'))
  return tasks
}
if(require.main===module)main(async()=>{await evaluate(parseEval(process.argv.slice(2)))})
