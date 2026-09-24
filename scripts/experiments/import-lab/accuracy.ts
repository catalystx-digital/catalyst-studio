import fs from 'node:fs/promises'
import path from 'node:path'
import { readJson } from './storage'
import { validatePages } from './pages'
import { stickScoreName } from './stick-version'

const CHECKS=['C1','C2','C3','C4','C5','C6','C7'] as const
type CheckName=typeof CHECKS[number]
const PLAIN:Record<CheckName,string>={C1:'wrong or missing section kind',C2:'text lost',C3:'headings lost or demoted',C4:'links lost',C5:'images lost',C6:'wrong number of items',C7:'invented text'}
type Row={id:string;ignored:boolean;verdict:string;failedChecks:string[];checks?:{C6?:{structureUnknown?:boolean}};acceptableTypes?:string[];acceptableFamilies?:string[]}
type Score={rows:Row[];extra?:unknown[]}
type PageScores={page:string;scores:Score[]}
interface AccuracyOptions {arm:string;runs:string[];familySet?:string}

function mulberry32(seed:number) {
  return ()=>{let t=seed+=0x6D2B79F5;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return ((t^t>>>14)>>>0)/4294967296}
}
const scored=(score:Score)=>score.rows.filter(row=>!row.ignored&&row.verdict!=='unsettled')
const unsettled=(pages:PageScores[])=>new Set(pages.flatMap(page=>page.scores.flatMap(score=>score.rows.filter(row=>row.verdict==='unsettled').map(row=>page.page+':'+row.id)))).size
const totals=(pages:PageScores[],runs:number[])=>runs.map(run=>pages.reduce((sum,page)=>{
  const rows=scored(page.scores[run]);return {correct:sum.correct+rows.filter(row=>row.verdict==='correct').length,total:sum.total+rows.length}
},{correct:0,total:0}))
function accuracy(pages:PageScores[],runs:number[]) {
  if(!pages.length)return 0
  const values=totals(pages,runs)
  return values.reduce((sum,value)=>sum+(value.total?value.correct/value.total:0),0)/values.length
}
function percentile(sorted:number[],fraction:number) {
  const position=(sorted.length-1)*fraction,lower=Math.floor(position),weight=position-lower
  return sorted[lower]*(1-weight)+sorted[Math.ceil(position)]*weight
}
function bootstrap(pages:PageScores[],measure:(sample:PageScores[])=>number) {
  if(!pages.length)return [0,0] as [number,number]
  const random=mulberry32(1),draws:number[]=[]
  for(let i=0;i<2000;i++)draws.push(measure(Array.from({length:pages.length},()=>pages[Math.floor(random()*pages.length)])))
  draws.sort((a,b)=>a-b)
  return [percentile(draws,0.025),percentile(draws,0.975)] as [number,number]
}
const percent=(share:number)=>`${(share*100).toFixed(1)}%`
const tenth=(share:number)=>(share*10).toFixed(1)
const countText=(numerator:number,denominator:number)=>`${percent(denominator?numerator/denominator:0)} (${numerator}/${denominator})`
const sum=(values:number[])=>values.reduce((total,value)=>total+value,0)
function failure(row:Row,check:CheckName) {return row.failedChecks.includes(check)||(check==='C1'&&row.verdict==='missed')}
function diagnostics(pages:PageScores[],familySet?:string) {
  const scores=pages.flatMap(page=>page.scores),rows=scores.flatMap(scored),total=rows.length
  const checks=Object.fromEntries(CHECKS.map(check=>{
    const failures=rows.filter(row=>failure(row,check)).length
    const onlyFailure=rows.filter(row=>failure(row,check)&&(row.verdict==='missed'?check==='C1':row.failedChecks.length===1)).length
    return [check,{failures,onlyFailure,total,failureRate:total?failures/total:0,upperBound:total?onlyFailure/total:0}]
  })) as Record<CheckName,{failures:number;onlyFailure:number;total:number;failureRate:number;upperBound:number}>
  const byName=new Map<string,{correct:number;total:number}>()
  for(const row of rows){
    const accepted=familySet?row.acceptableFamilies:row.acceptableTypes
    const names=[...new Set(accepted?.length?accepted:['unclassified'])]
    for(const name of names){
      const entry=byName.get(name)||{correct:0,total:0}
      entry.total++;if(row.verdict==='correct')entry.correct++
      byName.set(name,entry)
    }
  }
  const groups=Object.fromEntries([...byName].sort(([a],[b])=>a.localeCompare(b)))
  const cleanCount=pages.filter(page=>page.scores.every(score=>score.rows.every(row=>row.verdict!=='unsettled')&&scored(score).length>0&&scored(score).every(row=>row.verdict==='correct'))).length
  return {checks,structureUnknown:rows.filter(row=>row.checks?.C6?.structureUnknown).length,groups,
    cleanPages:{count:cleanCount,total:pages.length,share:pages.length?cleanCount/pages.length:0},
    missed:rows.filter(row=>row.verdict==='missed').length,
    junk:scores.flatMap(score=>score.rows).filter(row=>row.ignored&&row.verdict==='should have been ignored').length,
    extra:sum(scores.map(score=>score.extra?.length||0)),scoredBlocks:total}
}
export async function generateAccuracy(root:string,options:AccuracyOptions) {
  if(![1,2,4].includes(options.runs.length))throw new Error('Accuracy needs one, two or four runs')
  const manifest=validatePages(await readJson(path.join(root,'pages.json'))),pages:PageScores[]=[],skippedDevelopment:string[]=[]
  let skippedHeldOut=0
  for(const page of Object.keys(manifest).sort()){
    const scores:Score[]=[]
    for(const run of options.runs){
      const file=path.join(root,'labels',page,'scores-stick',stickScoreName(options.arm,run,options.familySet)+'.json')
      let score:Score
      try{score=await readJson(file)}catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT'){scores.length=0;break}throw error}
      if(!Array.isArray(score.rows))throw new Error(`Invalid stick score for page ${page}, run ${run}`)
      scores.push(score)
    }
    if(scores.length!==options.runs.length){if(manifest[page].heldOut)skippedHeldOut++;else skippedDevelopment.push(page);continue}
    pages.push({page,scores})
  }
  const development=pages.filter(page=>!manifest[page.page].heldOut),heldOut=pages.filter(page=>manifest[page.page].heldOut)
  if(!development.length)throw new Error('No development pages in pages.json')
  const runIndices=options.runs.map((_,index)=>index)
  const devAccuracy=accuracy(development,runIndices),devInterval=bootstrap(development,sample=>accuracy(sample,runIndices))
  const heldAccuracy=accuracy(heldOut,runIndices),heldInterval=bootstrap(heldOut,sample=>accuracy(sample,runIndices))
  const diagnostic=diagnostics(development,options.familySet)
  const compare=(sample:PageScores[])=>options.runs.length===4?accuracy(sample,[0,1])-accuracy(sample,[2,3]):accuracy(sample,[0])-accuracy(sample,[1])
  const difference=options.runs.length>1?compare(development):null
  const differenceInterval=options.runs.length>1?bootstrap(development,compare):null
  const noise=options.runs.length===1?{label:'not measured',difference:null,interval:null,halfWidth:null}:{label:options.runs.length===2?'single-run, conservative':'paired runs',difference,interval:differenceInterval,halfWidth:(differenceInterval![1]-differenceInterval![0])/2}
  const devCounts=totals(development,runIndices),heldCounts=totals(heldOut,runIndices)
  const devUnsettled=unsettled(development),heldUnsettled=unsettled(heldOut),totalUnsettled=devUnsettled+heldUnsettled
  const result={arm:options.arm,runs:options.runs,familySet:options.familySet||null,
    development:{accuracy:devAccuracy,interval:devInterval,pages:development.length,correctBlocks:sum(devCounts.map(v=>v.correct)),unsettledBlocks:devUnsettled,...diagnostic},
    heldOut:{accuracy:heldAccuracy,interval:heldInterval,pages:heldOut.length,scoredBlocks:sum(heldCounts.map(v=>v.total)),unsettledBlocks:heldUnsettled},skipped:{development:skippedDevelopment,heldOutPages:skippedHeldOut},noise}
  const biggest=[...CHECKS].sort((a,b)=>diagnostic.checks[b].failureRate-diagnostic.checks[a].failureRate||a.localeCompare(b)).slice(0,3).map(check=>PLAIN[check])
  const groups=Object.entries(diagnostic.groups).map(([name,value])=>`${name} ${countText(value.correct,value.total)}`)
  const groupSize=Math.max(1,Math.ceil(groups.length/10))
  const groupLines=Array.from({length:Math.ceil(groups.length/groupSize)},(_,index)=>`${options.familySet?'Family':'Type'} accuracy: ${groups.slice(index*groupSize,index*groupSize+groupSize).join('; ')}.`)
  const lines=[
    `About ${tenth(devAccuracy)} in 10 website sections import correctly today (likely range ${tenth(devInterval[0])}–${tenth(devInterval[1])} in 10).`,
    totalUnsettled?`Answer key not finished: ${totalUnsettled} sections still await a decision.`:'The answer key was checked by two AI models from different companies; a third settled most disagreements and the founder settled the rest.',
    `The three biggest losses: ${biggest.join(', ')}.`,
    '---',
    `Development: ${percent(devAccuracy)} (${result.development.correctBlocks}/${result.development.scoredBlocks} across ${development.length} pages and ${options.runs.length} runs); 95% interval ${percent(devInterval[0])}–${percent(devInterval[1])}.`,
    `Held-out: ${percent(heldAccuracy)} (${sum(heldCounts.map(v=>v.correct))}/${result.heldOut.scoredBlocks} across ${heldOut.length} pages); 95% interval ${percent(heldInterval[0])}–${percent(heldInterval[1])}.`,
    `Noise band: ${noise.halfWidth===null?'not measured':`${percent(noise.halfWidth)} half-width; difference ${percent(noise.difference!)}; interval ${percent(noise.interval![0])}–${percent(noise.interval![1])} (${noise.label})`}.`,
    `Clean development pages: ${countText(diagnostic.cleanPages.count,diagnostic.cleanPages.total)}.`,
    `Unsettled sections: development ${devUnsettled}; held-out ${heldUnsettled}.`,
    `Skipped for missing production runs: development ${skippedDevelopment.join(', ')||'none'}; held-out ${skippedHeldOut} pages.`,
    ...CHECKS.map(check=>`${check} ${PLAIN[check]}: failures ${countText(diagnostic.checks[check].failures,diagnostic.checks[check].total)}; upper bound ${countText(diagnostic.checks[check].onlyFailure,diagnostic.checks[check].total)}.`),
    `C6 structure unknown: ${diagnostic.structureUnknown}/${diagnostic.scoredBlocks}.`,
    ...groupLines,
    `Missed: ${diagnostic.missed}; junk: ${diagnostic.junk}; extra: ${diagnostic.extra} (development runs).`,
    'Hypotheses: see ledger.md in the lab data folder'
  ]
  const markdown=lines.join('\n')+'\n',json=JSON.stringify(result,null,2)+'\n'
  const reports=path.join(root,'reports');await fs.mkdir(reports,{recursive:true})
  for(const [name,content] of [['ACCURACY.md',markdown],['accuracy.json',json]] as const){
    const target=path.join(reports,name)
    try{
      await fs.access(target)
      const stamp=new Date().toISOString().replace(/[:.]/g,'-')
      let index=0,backup:string
      do{backup=path.join(reports,`${path.parse(name).name}-${stamp}${index?`-${index}`:''}${path.extname(name)}`);index++}while(await fs.access(backup).then(()=>true,()=>false))
      await fs.rename(target,backup)
    }catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error}
    await fs.writeFile(target,content,{flag:'wx'})
  }
  return result
}
