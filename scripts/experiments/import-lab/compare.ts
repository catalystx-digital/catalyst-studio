import fs from 'node:fs/promises'
import path from 'node:path'
import { readJson } from './storage'
import { validatePages } from './pages'
import { stickScoreName } from './stick-version'
import { scorePage } from './score'
import { foldFamily, foldedFamilies } from './families'

const CHECKS=['C1','C2','C3','C4','C5','C6','C7'] as const
const FOLDS=foldedFamilies
type Row={id:string;order?:number;ignored:boolean;verdict:string;failedChecks:string[];acceptableFamilies?:string[];producedFamilies?:string[];componentIndices?:number[];multiple?:boolean}
export type ComparisonRun={rows:Row[];extra:unknown[];blockCount:number;dropped:number;seconds:number|null;cost:number|null;choices:Array<{id:string;top1:string;top3:string[]}>}
export type ComparisonPage={id:string;site:string;siteKind:string;baseline:Record<string,ComparisonRun>;candidate:Record<string,ComparisonRun>}
export type CompareOptions={baseline:string;candidate:string;runs:string[];heldOutRuns:string[];familySet:string}
type Arm='baseline'|'candidate'
const scored=(run:ComparisonRun)=>run.rows.filter(row=>!row.ignored&&row.verdict!=='unsettled')
const ratio=(n:number,d:number)=>d?n/d:0
const mean=(values:number[])=>ratio(values.reduce((a,b)=>a+b,0),values.length)
const pct=(n:number)=>`${(n*100).toFixed(1)}%`
const tenth=(n:number)=>(n*10).toFixed(1)
const count=(n:number,d:number)=>d?`${pct(n/d)} (${n}/${d})`:`not measured (${n}/${d})`
const point=(n:number)=>`${n>=0?'+':''}${(n*100).toFixed(1)}`
function random32(seed:number){return()=>{let t=seed+=0x6D2B79F5;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return ((t^t>>>14)>>>0)/4294967296}}
function percentile(sorted:number[],fraction:number){const at=(sorted.length-1)*fraction,lo=Math.floor(at),weight=at-lo;return sorted[lo]*(1-weight)+sorted[Math.ceil(at)]*weight}
function interval(pages:ComparisonPage[],metric:(sample:ComparisonPage[])=>number):[number,number]{
  const rng=random32(24),values:number[]=[]
  for(let i=0;i<2000;i++)values.push(metric(Array.from({length:pages.length},()=>pages[Math.floor(rng()*pages.length)])))
  values.sort((a,b)=>a-b)
  return [percentile(values,0.025),percentile(values,0.975)]
}
type Counts={correct:number;total:number}
const runRate=(run:ComparisonRun):Counts=>({correct:scored(run).filter(r=>r.verdict==='correct').length,total:scored(run).length})
function metric(pages:ComparisonPage[],arm:Arm,runs:string[],measure:(run:ComparisonRun)=>Counts){return mean(runs.map(run=>{const values=pages.map(page=>measure(page[arm][run]));return ratio(values.reduce((n,v)=>n+v.correct,0),values.reduce((n,v)=>n+v.total,0))}))}
function paired(pages:ComparisonPage[],runs:string[],measure:(run:ComparisonRun)=>Counts){return metric(pages,'candidate',runs,measure)-metric(pages,'baseline',runs,measure)}
function failure(run:ComparisonRun,check:string):Counts{const rows=scored(run);return {correct:rows.filter(r=>r.failedChecks.includes(check)||check==='C1'&&r.verdict==='missed').length,total:rows.length}}
function junk(run:ComparisonRun){return new Set(run.rows.filter(r=>r.ignored&&r.verdict==='should have been ignored').flatMap(r=>r.componentIndices||[])).size}
function extraJunk(run:ComparisonRun):Counts{return {correct:run.extra.length+junk(run),total:scored(run).length}}
function totals(pages:ComparisonPage[],arm:Arm,runs:string[]){const entries=pages.flatMap(p=>runs.map(r=>p[arm][r])),rows=entries.flatMap(scored);return {correct:rows.filter(r=>r.verdict==='correct').length,total:rows.length,extra:entries.reduce((n,r)=>n+r.extra.length,0),junk:entries.reduce((n,r)=>n+junk(r),0),dropped:entries.reduce((n,r)=>n+r.dropped,0),blocks:entries.reduce((n,r)=>n+r.blockCount,0),cost:entries.every(r=>r.cost!==null)?entries.reduce((n,r)=>n+r.cost!,0):null,seconds:entries.every(r=>r.seconds!==null)?entries.reduce((n,r)=>n+r.seconds!,0):null}}
function foldedRight(row:Row){const wanted=(row.acceptableFamilies||[]).map(foldFamily),picked=(row.producedFamilies||[]).map(foldFamily);if(row.multiple){const remaining=[...wanted];return picked.every(name=>{const index=remaining.indexOf(name);if(index<0)return false;remaining.splice(index,1);return true})&&remaining.length===0}return picked.some(p=>wanted.includes(p))}
const foldedCorrect=(row:Row)=>row.verdict==='correct'||row.failedChecks.includes('C1')&&row.failedChecks.every(c=>c==='C1')&&foldedRight(row)
function foldedRate(run:ComparisonRun):Counts{const rows=scored(run);return {correct:rows.filter(foldedCorrect).length,total:rows.length}}
function choices(pages:ComparisonPage[],runs:string[]){let top1=0,top3=0,top1Total=0,top3Total=0;for(const page of pages)for(const run of runs){const item=page.candidate[run],byId=new Map(scored(item).map(r=>[r.id,r]));for(const choice of item.choices){const row=byId.get(choice.id);if(!row)continue;top1Total++;if(row.acceptableFamilies?.includes(choice.top1))top1++;if(choice.top3.length===3){top3Total++;if(choice.top3.some(c=>row.acceptableFamilies?.includes(c)))top3++}}}return {top1,top3,top1Total,top3Total}}
function foldFlips(pages:ComparisonPage[],runs:string[]){const flips=Object.fromEntries(FOLDS.map(name=>[name,0])) as Record<typeof FOLDS[number],number>,eligible={...flips};for(const page of pages)for(const run of runs){const item=page.candidate[run],byId=new Map(scored(item).map(row=>[row.id,row]));for(const choice of item.choices){const key=byId.get(choice.id)?.acceptableFamilies||[];for(const name of FOLDS)if(key.includes(name)||key.includes('collection')){eligible[name]++;if(key.includes(name)&&choice.top1==='collection'||key.includes('collection')&&choice.top1===name)flips[name]++}}}return {flips,eligible}}
export function buildComparison(pages:ComparisonPage[],heldOut:{baseline:number;candidate:number},options:CompareOptions){
  if(!pages.length||options.runs.length!==2)throw new Error('Compare needs development pages and two runs')
  const repaired=options.candidate.endsWith('+repair'),baseName=repaired?'baseline':'today',candidateName=repaired?'repaired':'families'
  const runs=options.runs,accuracy=(arm:Arm,subset=pages)=>metric(subset,arm,runs,runRate)
  const gain=(subset=pages)=>paired(subset,runs,runRate),baseline=accuracy('baseline'),candidate=accuracy('candidate'),difference=gain()
  const baselineInterval=interval(pages,p=>accuracy('baseline',p)),candidateInterval=interval(pages,p=>accuracy('candidate',p)),gainInterval=interval(pages,gain)
  const noiseInterval=interval(pages,p=>metric(p,'baseline',[runs[0]],runRate)-metric(p,'baseline',[runs[1]],runRate)),noise=(noiseInterval[1]-noiseInterval[0])/2
  const sites=[...new Set(pages.map(p=>p.site))].sort(),leave=sites.map(site=>{const subset=pages.filter(p=>p.site!==site);return {siteKind:pages.find(p=>p.site===site)!.siteKind,gain:subset.length?gain(subset):0}})
  const leaveOneSiteOut={min:Math.min(...leave.map(x=>x.gain)),max:Math.max(...leave.map(x=>x.gain)),minimumSiteKind:leave.find(x=>x.gain===Math.min(...leave.map(v=>v.gain)))?.siteKind||'unknown',sites:leave.length}
  const checkResults=Object.fromEntries(CHECKS.map(check=>{const base=metric(pages,'baseline',runs,r=>failure(r,check)),cand=metric(pages,'candidate',runs,r=>failure(r,check)),change=cand-base,band=interval(pages,p=>paired(p,runs,r=>failure(r,check)));const counts=(arm:Arm)=>{const rows=pages.flatMap(p=>runs.flatMap(run=>scored(p[arm][run])));return {failed:rows.filter(r=>r.failedChecks.includes(check)||check==='C1'&&r.verdict==='missed').length,total:rows.length}};return [check,{baseline:base,candidate:cand,baselineCounts:counts('baseline'),candidateCounts:counts('candidate'),change,interval:band,passes:band[0]<=0}]})) as Record<typeof CHECKS[number],{baseline:number;candidate:number;baselineCounts:{failed:number;total:number};candidateCounts:{failed:number;total:number};change:number;interval:[number,number];passes:boolean}>
  const extraGain=paired(pages,runs,extraJunk),heldOutGain=heldOut.candidate-heldOut.baseline
  const conditions={a:{passed:gainInterval[0]>0},b:{passed:leaveOneSiteOut.min>0},c:{passed:CHECKS.every(check=>checkResults[check].passes)},d:{passed:extraGain<=noise},heldOut:{passed:heldOutGain>=-noise}}
  const decision=Object.values(conditions).every(c=>c.passed)?'GO':'NO-GO',bad=Object.entries(conditions).filter(([,value])=>!value.passed).map(([key])=>key==='heldOut'?'held-out':`(${key})`)
  const baseTotals=totals(pages,'baseline',runs),candTotals=totals(pages,'candidate',runs)
  const same=pages.filter(page=>runs.every(run=>page.baseline[run].blockCount===page.candidate[run].blockCount))
  const sameGain=same.length?gain(same):null,jev=choices(pages,runs),flips=foldFlips(pages,runs),foldRows=pages.flatMap(page=>runs.flatMap(run=>scored(page.candidate[run]))),folded={accuracy:metric(pages,'candidate',runs,options.familySet==='D'?runRate:foldedRate),correct:foldRows.filter(options.familySet==='D'?(row=>row.verdict==='correct'):foldedCorrect).length,total:foldRows.length,...flips}
  const report=[
    repaired?`${decision}: ${tenth(candidate)} in 10 sections correctly after repair, against ${tenth(baseline)} in 10 before repair (development pages).`:`${decision}: the ${options.familySet==='D'?'11':'15'} section families import ${tenth(candidate)} in 10 sections correctly, against ${tenth(baseline)} in 10 today (development pages).`,
    `The difference is ${point(difference)} points (likely range ${point(gainInterval[0])} to ${point(gainInterval[1])}); it ${conditions.b.passed?'holds':'does not hold'} when any one website is left out.`,
    `Held-out pages: ${candidateName} ${tenth(heldOut.candidate)} in 10, ${baseName} ${tenth(heldOut.baseline)} in 10.`,
    '---',
    `Gate: ${decision}; (a) ${conditions.a.passed?'met':'failed'}, (b) ${conditions.b.passed?'met':'failed'}, (c) ${conditions.c.passed?'met':'failed'}, (d) ${conditions.d.passed?'met':'failed'}, held-out ${conditions.heldOut.passed?'met':'failed'}${bad.length?`; failed ${bad.join(', ')}`:''}.`,
    `Development ${baseName}: ${pct(baseline)} (${baseTotals.correct}/${baseTotals.total}); 95% interval ${pct(baselineInterval[0])} to ${pct(baselineInterval[1])}.`,
    `Development ${candidateName}: ${pct(candidate)} (${candTotals.correct}/${candTotals.total}); 95% interval ${pct(candidateInterval[0])} to ${pct(candidateInterval[1])}.`,
    `Paired gain: ${point(difference)} points; 95% interval ${point(gainInterval[0])} to ${point(gainInterval[1])}.`,
    `Leave one site out: min ${point(leaveOneSiteOut.min)}, max ${point(leaveOneSiteOut.max)} points; minimum site kind ${leaveOneSiteOut.minimumSiteKind} (${sites.length} sites).`,
    ...CHECKS.map(check=>`${check} failure: ${baseName} ${pct(checkResults[check].baseline)} (${checkResults[check].baselineCounts.failed}/${checkResults[check].baselineCounts.total}), ${candidateName} ${pct(checkResults[check].candidate)} (${checkResults[check].candidateCounts.failed}/${checkResults[check].candidateCounts.total}), paired change ${point(checkResults[check].change)} points (95% ${point(checkResults[check].interval[0])} to ${point(checkResults[check].interval[1])}).`),
    `Sections dropped after validation: ${baseName} ${count(baseTotals.dropped,baseTotals.blocks)}, ${candidateName} ${count(candTotals.dropped,candTotals.blocks)}.`,
    `Extra and junk: ${baseName} ${baseTotals.extra}+${baseTotals.junk} (${pct(ratio(baseTotals.extra+baseTotals.junk,baseTotals.total))}), ${candidateName} ${candTotals.extra}+${candTotals.junk} (${pct(ratio(candTotals.extra+candTotals.junk,candTotals.total))}); paired rise ${point(extraGain)} points; noise band ${point(noise)} points (single-run, conservative).`,
    `Cost and wall-clock: ${baseName} ${baseTotals.cost===null?'unknown':'$'+baseTotals.cost.toFixed(4)} / ${baseTotals.seconds===null?'unknown':baseTotals.seconds.toFixed(1)+'s'}, ${candidateName} ${candTotals.cost===null?'unknown':'$'+candTotals.cost.toFixed(4)} / ${candTotals.seconds===null?'unknown':candTotals.seconds.toFixed(1)+'s'} (${pages.length*runs.length} page-runs per arm).`,
    `Same block count: ${sameGain===null?'not measured':point(sameGain)+' points'} (${same.length}/${pages.length} pages).`,
    `Jev family choice: top-1 ${count(jev.top1,jev.top1Total)}, any top-3 ${count(jev.top3,jev.top3Total)}.`,
    ...(options.familySet==='D'?[]:[`Fold flips (key versus Jev top-1): ${FOLDS.map(name=>`${name} ${count(flips.flips[name],flips.eligible[name])}`).join('; ')}.`]),
    options.familySet==='D'?`Set-D development accuracy: ${pct(folded.accuracy)} (${folded.correct}/${folded.total}).`:`Folded development accuracy: ${pct(folded.accuracy)} (${folded.correct}/${folded.total}; stats, testimonials, pricing and logo-strip folded into collection).`
  ]
  const json={decision,conditions,baseline:{accuracy:baseline,interval:baselineInterval,...baseTotals},candidate:{accuracy:candidate,interval:candidateInterval,...candTotals},gain:{point:difference,interval:gainInterval},leaveOneSiteOut,checks:checkResults,noise:{halfWidth:noise,label:'single-run, conservative'},heldOut,sameBlockCount:{pages:same.length,gain:sameGain},jev,folded}
  return {decision,conditions,baseline:json.baseline,candidate:json.candidate,leaveOneSiteOut,heldOut,folded,markdown:report.join('\n')+'\n',json}
}

async function optional<T>(file:string):Promise<T|null>{try{return await readJson<T>(file)}catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')return null;throw error}}
async function files(dir:string){try{return (await fs.readdir(dir)).filter(x=>x.endsWith('.json')).sort()}catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')return [];throw error}}
function validateRun(record:any,page:string,arm:string,run:string,heldOut=false){if(!record||record.status==='dry-run'||record.fixture||!['complete','failed'].includes(record.status))throw new Error(heldOut?`Missing usable held-out run: ${arm}/${run}`:`Missing usable run: ${page}/${arm}/${run}`)}
function dropped(record:any,sections:any[]){const completed=new Set(sections.filter(s=>Array.isArray(s.components)&&s.components.length).map(s=>s.sectionKey));return new Set((record.failures||[]).filter((f:any)=>f.sectionKey&&!completed.has(f.sectionKey)&&(f.stage==='parsing'||/validat|invalid|schema|zod/i.test(JSON.stringify({stage:f.stage,error:f.error})))).map((f:any)=>f.sectionKey)).size}
function sectionChoices(sections:any[],errors:any[],rows:Row[],calls:any[],keyEntries:Array<{blockId:string;order:number}>){
  const decisions=calls.filter(call=>call.kind==='decision'&&typeof call.request?.state==='string'&&/^Block \d+;/.test(call.request.state))
  const byOrder=new Map(keyEntries.map(entry=>[entry.order,entry.blockId]))
  const byId=new Map(rows.map(row=>[row.id,row]))
  return [...sections,...errors].flatMap(section=>{
    const match=/^block:(\d+)$/.exec(String(section.sectionKey||'')),order=match?Number(match[1]):NaN
    if(!Number.isSafeInteger(order)||section.sectionOrder!==undefined&&Number(section.sectionOrder)!==order-1)return []
    const id=byOrder.get(order),row=id&&byId.get(id),pick=section.debug?.blockPick,top1=pick?.topChoices?.component
    if(!row||row.order!==order||typeof top1!=='string')return []
    const call=decisions.find(call=>Number(/^Block (\d+);/.exec(call.request.state)?.[1])===order)
    const answer=call?.response?.answers?.['import.block.component']??call?.response?.['import.block.component']
    const distribution=answer?.distribution??answer?.probabilities
    const top3=distribution&&typeof distribution==='object'?Object.entries(distribution).filter(([,value])=>typeof value==='number').sort((a,b)=>(b[1] as number)-(a[1] as number)||a[0].localeCompare(b[0])).slice(0,3).map(([name])=>name):[]
    return [{id,top1,top3}]
  })
}
async function loadRun(root:string,page:string,arm:string,run:string,familySet:string):Promise<ComparisonRun>{
  const dir=path.join(root,'arms',page,arm,run),record=await optional<any>(path.join(dir,'run.json'));validateRun(record,page,arm,run)
  const scoreFile=path.join(root,'labels',page,'scores-stick',stickScoreName(arm,run,familySet)+'.json')
  if(!await optional<any>(scoreFile))await scorePage(page,{components:path.join(dir,'components.json'),name:stickScoreName(arm,run),familySet,root})
  const score=await readJson<any>(scoreFile)
  if(!Array.isArray(score.rows)||!Array.isArray(score.extra))throw new Error(`Invalid development score: ${page}/${arm}/${run}`)
  const sheet=await readJson<{entries:Array<{blockId:string;order:number;label?:{multiple?:boolean}}> }>(path.join(root,'labels',page,'answer-sheet-v2.json'))
  if(!Array.isArray(sheet.entries))throw new Error(`Invalid answer-key mapping: ${page}`)
  const keyById=new Map(sheet.entries.map(entry=>[entry.blockId,entry]))
  const rows:Row[]=score.rows.map((row:Row)=>{const entry=keyById.get(row.id);if(!entry||row.order!==entry.order)throw new Error(`Score and answer-key mapping differ: ${page}/${arm}/${run}`);return {...row,multiple:entry.label?.multiple===true}})
  const sections=await optional<any[]>(path.join(dir,'sections.json'))||[]
  const errors=await optional<any[]>(path.join(dir,'section-errors.json'))||[]
  const calls=await Promise.all((await files(path.join(dir,'calls'))).map(file=>readJson<any>(path.join(dir,'calls',file))))
  const sourceDir=record.source&&arm.endsWith('+repair')?path.join(root,'arms',page,record.source.arm,record.source.run):null
  const sourceCalls=sourceDir?await Promise.all((await files(path.join(sourceDir,'calls'))).map(file=>readJson<any>(path.join(sourceDir,'calls',file)))):[]
  const sourceRecord=sourceDir?await optional<any>(path.join(sourceDir,'run.json')):null
  const allCalls=[...sourceCalls,...calls],costs=allCalls.filter(c=>!['planned','dry-run'].includes(c.status)).map(c=>c.cost)
  const seconds=typeof record.wallClockSeconds==='number'&&(!sourceDir||typeof sourceRecord?.wallClockSeconds==='number')?record.wallClockSeconds+(sourceDir?sourceRecord.wallClockSeconds:0):null
  return {rows,extra:score.extra,blockCount:record.blockCount??0,dropped:dropped(record,sections),seconds,cost:costs.every(c=>typeof c==='number')?costs.reduce((a,b)=>a+b,0):null,choices:sectionChoices(sections,errors,rows,allCalls,sheet.entries)}
}
async function heldOutOverall(root:string,pages:string[],arm:string,runs:string[],familySet:string){const totals=new Map(runs.map(run=>[run,{correct:0,total:0}]));for(const page of pages)for(const run of runs){try{const dir=path.join(root,'arms',page,arm,run),record=await optional<any>(path.join(dir,'run.json'));validateRun(record,page,arm,run,true);const file=path.join(root,'labels',page,'scores-stick',stickScoreName(arm,run,familySet)+'.json');if(!await optional<any>(file))await scorePage(page,{components:path.join(dir,'components.json'),name:stickScoreName(arm,run),familySet,root});const score=await readJson<{accuracy?:{correct:number;total:number}}>(file);if(!score.accuracy||!Number.isFinite(score.accuracy.correct)||!Number.isFinite(score.accuracy.total))throw new Error('Overall score missing');const value=totals.get(run)!;value.correct+=score.accuracy.correct;value.total+=score.accuracy.total}catch{throw new Error(`Held-out overall scoring failed for ${arm}/${run}`)}}return mean(runs.map(run=>{const value=totals.get(run)!;return ratio(value.correct,value.total)}))}
export async function generateComparison(root:string,options:CompareOptions){
  const pair=options.baseline+'|'+options.candidate
  if(!['blocks-production|family-fill','blocks-production|blocks-production+repair','family-fill|family-fill+repair'].includes(pair)||!['C','D'].includes(options.familySet)||options.runs.length!==2||options.heldOutRuns.length!==1)throw new Error('Compare requires a supported arm pair, two development runs, one held-out run and family set C or D')
  const manifest=validatePages(await readJson(path.join(root,'pages.json'))),development=Object.keys(manifest).filter(page=>!manifest[page].heldOut).sort(),held=Object.keys(manifest).filter(page=>manifest[page].heldOut).sort()
  if(!development.length||!held.length)throw new Error('Compare requires development and held-out pages')
  let absent=0
  for(const page of [...development,...held])for(const arm of [options.baseline,options.candidate])for(const run of (manifest[page].heldOut?options.heldOutRuns:options.runs)){try{if(!(await fs.stat(path.join(root,'arms',page,arm,run))).isDirectory())absent++}catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')absent++;else throw error}}
  if(absent)throw new Error(`${absent} required run directories absent; comparison not run`)
  const pages:ComparisonPage[]=[]
  for(const page of development){const entry=manifest[page],pair:ComparisonPage={id:page,site:new URL(entry.url).hostname,siteKind:entry.siteKind,baseline:{},candidate:{}};for(const run of options.runs){pair.baseline[run]=await loadRun(root,page,options.baseline,run,options.familySet);pair.candidate[run]=await loadRun(root,page,options.candidate,run,options.familySet)}pages.push(pair)}
  const heldOut={baseline:await heldOutOverall(root,held,options.baseline,options.heldOutRuns,options.familySet),candidate:await heldOutOverall(root,held,options.candidate,options.heldOutRuns,options.familySet)}
  const result=buildComparison(pages,heldOut,options),dir=path.join(root,'reports');await fs.mkdir(dir,{recursive:true});await fs.writeFile(path.join(dir,'COMPARE.md'),result.markdown);await fs.writeFile(path.join(dir,'compare.json'),JSON.stringify(result.json,null,2)+'\n');return result
}
