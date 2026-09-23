import { familyOutputRoot, type FamilySet } from './families'
import { checkedPickScore } from './family-pick-score'
import fs from 'node:fs/promises'
import path from 'node:path'
import { dataRoot, readJson, main } from './storage'
import { directories, optionalJson, sha, type Sheet } from './labels'
import { loadPages, type PageManifest } from './pages'
import { scoreSheet } from './scoring'
import { stickScoreName } from './stick-version'
import { probabilityBand } from './pick-score'

export function callTotals(calls:any[]) {
  const active=calls.filter(c=>!['planned','dry-run'].includes(c.status))
  const total=(get:(c:any)=>unknown)=>{const values=active.map(get).filter(finite);return {value:values.reduce((a,b)=>a+b,0),known:values.length,count:active.length}}
  const completion=(c:any)=>c.usage?.completion_tokens??c.usage?.output_tokens??c.usage?.outputTokens
  const reasoning=(c:any)=>c.usage?.completion_tokens_details?.reasoning_tokens??c.usage?.output_tokens_details?.reasoning_tokens??c.usage?.reasoning_tokens
  return {calls:active.length,planned:calls.length-active.length,retries:active.filter(c=>c.kind==='repair').length,failed:active.filter(c=>['failed','timeout','validation-failed','http-error'].includes(c.status)).length,totalTokens:total(c=>c.usage?.total_tokens??((finite(c.usage?.input_tokens)&&finite(c.usage?.output_tokens))?c.usage.input_tokens+c.usage.output_tokens:undefined)),reasoningTokens:total(reasoning),answerTokens:total(c=>finite(completion(c))&&finite(reasoning(c))?completion(c)-reasoning(c):undefined),promptCharacters:total(c=>c.totalCharacters),cost:total(c=>c.cost),latencyMs:total(c=>c.latencyMs)}
}

export interface SavedResult { page: string; arm: string; run: string; status: string; rows: any[]; sheetHash?: string; reviewedBy: Record<string,string>; calls: any[]; seconds: number | null; issues: string[]; picks: any[]; record: any }
const isPickArm=(arm:string)=>arm==='jev-pick'||arm.startsWith('jev-pick@families-')
const finite = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n)
export const armLabel = (arm: string) => arm + (['today-off','today-on-own-page','blocks-production','jev-pick'].includes(arm.split('@')[0]) ? '' : ' (arm removed from the tool)')
const safe = (v: unknown) => String(v).replace(/\|/g, '\\|').replace(/[\r\n]+/g, ' ')
export const share = (n: number, d: number, distinct = d) => n + '/' + d + (d ? ' (' + (100*n/d).toFixed(1) + '%)' : ' (not measured)') + (distinct < 20 ? ' *' : '')
export function splitResults(rows: SavedResult[], pages: PageManifest, heldOut: boolean) { return rows.filter(r => pages[r.page] && pages[r.page].heldOut === heldOut) }
export function totals(results: SavedResult[]) {
  const rows = results.flatMap(r => r.rows.filter(b => !b.ignored)), distinct = new Set(results.flatMap(r => r.rows.filter(b => !b.ignored).map(b => r.page + ':' + b.id))).size
  const count = (v: string) => rows.filter(b => b.verdict === v).length
  return {blocks: rows.length, distinct, correct: count('correct'), incomplete: count('right type, content incomplete'), wrong: count('wrong type'), missed: count('missed'), right: count('correct') + count('right type, content incomplete'), ignored: results.reduce((n,r) => n + r.rows.filter(b => b.ignored).length, 0)}
}
export function stability(results: SavedResult[]) {
  const groups = new Map<string, SavedResult[]>()
  for (const r of results.filter(r => !isPickArm(r.arm))) { const key = r.arm; groups.set(key, [...(groups.get(key) || []), r]) }
  return [...groups].flatMap(([arm, rows]) => {
    const runs = [...new Set(rows.map(r => r.run))].sort(), pairs: any[] = []
    for (let i=0;i<runs.length;i++) for (let j=i+1;j<runs.length;j++) {
      let same=0, blocks=0, excluded=0
      for (const a of rows.filter(r => r.run === runs[i])) {
        const b=rows.find(r => r.page === a.page && r.run === runs[j])
        if (!b) continue
        if (a.sheetHash !== b.sheetHash || a.record?.comparisonKey !== b.record?.comparisonKey) { excluded++; continue }
        for (const x of a.rows.filter(x => !x.ignored)) { const y=b.rows.find(y => y.id === x.id && !y.ignored); if (y) { blocks++; if (x.verdict === y.verdict) same++ } }
      }
      pairs.push({arm, runs:[runs[i],runs[j]],same,blocks,excluded})
    }
    return pairs
  })
}
export function pickTotals(rows: any[]) {
  const distinct=(group:any[])=>new Set(group.map((r,i)=>r.blockId ? (r.page||'')+':'+r.blockId : String(i))).size
  const bands = Array.from({length:5},(_,i) => { const group=rows.filter(r => probabilityBand(r.probability) === i); return {band:i*20+'–'+(i+1)*20+(i===4?'% inclusive':'% (upper end excluded)'),blocks:group.length,distinct:distinct(group),top1:group.filter(r=>r.top1).length,top3:group.filter(r=>r.top3).length} })
  const confusions = new Map<string,number>()
  for (const row of rows.filter(r=>!r.top1)) { const key=row.pick+' → '+[...row.answer].sort().join(' or '); confusions.set(key,(confusions.get(key)||0)+1) }
  return {blocks:rows.length,distinct:distinct(rows),top1:rows.filter(r=>r.top1).length,top3:rows.filter(r=>r.top3).length,bands,confusions:[...confusions].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0])).slice(0,10)}
}
export const median = (values: number[]) => { const a=[...values].sort((a,b)=>a-b); return a.length ? (a[Math.floor((a.length-1)/2)]+a[Math.floor(a.length/2)])/2 : null }
async function jsonFiles(directory: string) { try { return (await fs.readdir(directory)).filter(f=>f.endsWith('.json')).sort() } catch (e) { if ((e as NodeJS.ErrnoException).code === 'ENOENT') return []; throw e } }
function compactCall(c: any) { return {status:c.status,kind:c.kind,usage:c.usage,cost:c.cost,latencyMs:c.latencyMs,totalCharacters:c.totalCharacters,truncation:c.truncation,error:c.error,retryReason:c.retryReason} }
export async function readSavedResults(families?:FamilySet,comparisonBaseline=false): Promise<SavedResult[]> {
  const results: SavedResult[] = [], pages = [...new Set([...await directories(path.join(dataRoot(),'labels')),...await directories(path.join(dataRoot(),'runs')),...await directories(path.join(dataRoot(),'arms'))])].sort()
  for (const page of pages) {
    const sheet=await optionalJson<Sheet>(path.join(dataRoot(),'labels',page,'answer-sheet.json')), sheetHash=sheet?sha(sheet):undefined
    const scores:any[]=[],scoreRoot=path.join(dataRoot(),'labels',page,'scores-stick')
    for (const file of await jsonFiles(scoreRoot)) {const score=await readJson(path.join(scoreRoot,file));if(score.familySet===families?.set)scores.push(score)}
    const stickScore=(arm:string,run:string,...legacyPrefixes:string[])=>scores.find(score=>score.name===stickScoreName(arm,run,families?.set))||scores.filter(score=>legacyPrefixes.some(prefix=>[prefix,`${prefix}-v5`,`${prefix}-v6`].includes(score.name))).sort((a,b)=>(a.version||0)-(b.version||0)).at(-1)
    const add = async (arm: string, run: string, directory: string, score: any, record: any, old=false) => {
      if (record?.fixture || record?.status === 'dry-run') return
      let computedTypeBaseline=false
      if(comparisonBaseline&&!families&&!isPickArm(arm)&&sheet&&(score?.status!=='complete'||score?.answerSheetSha256!==sheetHash)){
        const proposal=await optionalJson(path.join(dataRoot(),'labels',page,'blocks.json'))
        if(proposal&&sha(proposal)===sheet.proposalSha256&&record?.snapshotSha256===sheet.snapshotSha256&&(!record.proposalSha256||record.proposalSha256===sheet.proposalSha256)){
          const savedArms=old?await optionalJson(path.join(directory,'arms.json')):null
          const components=old?(savedArms?.arms[arm==='today-off'?'off':arm.replace(/^today-/,'')]?.components||(arm==='today-off'?await optionalJson(path.join(directory,'pre-repair.json')):null)):await optionalJson(path.join(directory,'components.json'))
          if(Array.isArray(components)){score={...scoreSheet(sheet,components,proposal.finalUrl),status:'complete'};computedTypeBaseline=true}
        }
      }
      const calls:any[]=[]
      for (const f of await jsonFiles(path.join(directory,'calls'))) calls.push(compactCall(await readJson(path.join(directory,'calls',f))))
      const issues:string[]=computedTypeBaseline?['Type baseline computed in memory; saved type scores unchanged']:[], rows=score?.status==='complete' ? score.rows || [] : []
      if (!score && !isPickArm(arm)) issues.push('No saved score')
      if (score?.answerSheetSha256 && score.answerSheetSha256 !== sheetHash) issues.push('Saved score uses an older answer sheet')
      if (record?.answerSheetSha256 && record.answerSheetSha256 !== sheetHash) issues.push('Run used earlier labels')
      const reviewedBy:Record<string,string>={}
      for (const row of rows) reviewedBy[row.id] = score.answerSheetSha256 === sheetHash ? sheet?.entries.find(e=>e.block.id===row.id)?.reviewedBy || 'unknown' : 'unknown (older labels)'
      let seconds=finite(record?.wallClockSeconds)?record.wallClockSeconds:null
      if (old) { const detection=await optionalJson(path.join(directory,'detection.json')); seconds=finite(detection?.timingBreakdown?.totalDurationMs)?detection.timingBreakdown.totalDurationMs/1000:null }
      // Saved replies may be checked against the saved answer sheet; no extraction or matching is re-run.
      let picks:any[]=[]
      if (arm==='jev-pick'||(families&&arm==='jev-pick@families-'+families.set)) {
        const saved=await optionalJson(path.join(directory,'picks.json'))
        if (sheet && saved?.picks && !saved.dryAssumptions) {try{picks=checkedPickScore(sheet,record,saved,families)?.rows||[]}catch(error){issues.push(String(error))}}
        else { const p=await optionalJson(path.join(directory,'pick-score.json')); picks=families?[]:p?.rows || [] }
      }
      results.push({page,arm,run,status:record?.status || 'missing run',rows,sheetHash:score?.answerSheetSha256,reviewedBy,calls,seconds,issues,picks,record:{computedTypeBaseline,familySha256:score?.familySha256,families:record?.families,comparisonKey:record?.comparisonKey,models:record?.models,model:record?.model,createdAt:record?.createdAt}})
    }
    for (const run of await directories(path.join(dataRoot(),'runs',page))) {
      const directory=path.join(dataRoot(),'runs',page,run), record=await optionalJson(path.join(directory,'run.json'))
      const savedArms=await optionalJson(path.join(directory,'arms.json'))
      const names=new Set<string>([...Object.keys(savedArms?.arms||{}),...scores.filter(s=>s.run===run&&s.arm).map(s=>s.arm)])
      if (!names.size) names.add('off')
      for (const name of names) {
        if (name==='on-as-production') continue
        await add(name==='off'||name==='pre-repair'?'today-off':name==='on-own-page'?'today-on-own-page':'today-'+name,run,directory,stickScore(name,run,run+'--'+name),record,true)
      }
    }
    for (const arm of await directories(path.join(dataRoot(),'arms',page))) for (const run of await directories(path.join(dataRoot(),'arms',page,arm))) {
      const directory=path.join(dataRoot(),'arms',page,arm,run)
      await add(arm,run,directory,stickScore(arm,run,arm+'--'+run,...(arm==='blocks-production'?[run]:[])),await optionalJson(path.join(directory,'run.json')))
    }
  }
  return results
}
function amount(a: {value:number;known:number;count:number}, dollars=false) { return a.known ? (dollars?'$':'')+a.value.toFixed(dollars?4:0)+(a.known<a.count?' (known '+a.known+'/'+a.count+' calls)':'') : 'unknown (0/'+a.count+' calls)' }
export function buildSummary(results: SavedResult[], pages: PageManifest) {
  const arms=[...new Set(results.map(r=>r.arm))].sort(), scored=results.filter(r=>r.rows.length)
  const group=(rows:SavedResult[])=>[...new Set(rows.map(r=>r.arm+'/'+r.run))].sort().map(key=>({name:key,...totals(rows.filter(r=>r.arm+'/'+r.run===key)),unscored:rows.filter(r=>r.arm+'/'+r.run===key&&!r.rows.length).length,partial:rows.filter(r=>r.arm+'/'+r.run===key&&r.status!=='complete').length,pages:new Set(rows.filter(r=>r.arm+'/'+r.run===key).map(r=>r.page)).size}))
  const extraction=results.filter(r=>!isPickArm(r.arm))
  const all=group(extraction),heldOut=group(splitResults(extraction,pages,true)),other=group(splitResults(extraction,pages,false))
  const byArm=arms.map(arm=>({arm,...totals(scored.filter(r=>r.arm===arm))}))
  const today=byArm.find(r=>r.arm==='today-off')
  // Choose on design pages only; held-out labels never select the best arm.
  const candidates=arms.filter(arm=>!isPickArm(arm)).map(arm=>({arm,...totals(splitResults(scored,pages,false).filter(r=>r.arm===arm))})).filter(r=>r.blocks)
  const best=candidates.sort((a,b)=>b.right/b.blocks-a.right/a.blocks||a.arm.localeCompare(b.arm))[0]
  const bestAll=byArm.find(r=>r.arm===best?.arm)
  const headline='Component right: today '+share(today?.right||0,today?.blocks||0,today?.distinct||0)+'; '+(bestAll?armLabel(bestAll.arm):'not measured')+' (best on other pages) '+share(bestAll?.right||0,bestAll?.blocks||0,bestAll?.distinct||0)+'.'
  const picks=pickTotals(results.flatMap(r=>r.picks.map(p=>({...p,page:r.page})))), repeats=stability(results)
  const reviewers:Record<string,Set<string>>={}
  for(const r of scored) for(const b of r.rows) { const who=r.reviewedBy[b.id]||'unknown'; (reviewers[who]??=new Set()).add(r.page+':'+b.id+':'+r.sheetHash) }
  const accounting=arms.map(arm=>{
    const rs=results.filter(r=>r.arm===arm), calls=rs.flatMap(r=>r.calls), t=callTotals(calls), times=rs.map(r=>r.seconds).filter(finite)
    const completeCosts=rs.map(r=>callTotals(r.calls).cost).filter(c=>c.count>0&&c.known===c.count)
    return {arm,pages:new Set(rs.map(r=>r.page)).size,pageRuns:rs.length,seconds:{median:median(times),min:times.length?Math.min(...times):null,max:times.length?Math.max(...times):null,known:times.length},...t,
      timeouts:calls.filter(c=>c.status==='timeout'||/timeout|timed out/i.test(c.error?.message||'')).length,truncated:calls.filter(c=>c.truncation?.truncated||c.status==='truncated').length,
      costPerPage:completeCosts.length?completeCosts.reduce((n,c)=>n+c.value,0)/completeCosts.length:null,costPages:completeCosts.length}
  })
  const checks=arms.map(arm=>{
    const rows=scored.filter(r=>r.arm===arm).flatMap(r=>r.rows).filter(b=>!b.ignored), names=[...new Set<string>(rows.flatMap(b=>Object.keys(b.checks||{})))]
    return {arm,checks:names.map(name=>({name,failed:rows.filter(b=>b.checks?.[name]?.passed===false).length,checked:rows.filter(b=>typeof b.checks?.[name]?.passed==='boolean').length})).sort((a,b)=>b.failed-a.failed)}
  })
  const lines=[headline,'','Best is chosen from other pages only. Totals include scored partial runs; repeated runs count again. Page coverage differs, so this is not a controlled ranking.','* Fewer than 20 blocks. Ignored blocks are excluded from the four verdict columns and component-right counts.','Correct means component and checked content are right. Component right = correct + content incomplete.','','All saved scores','| Arm / run | Blocks | Correct | Content incomplete | Wrong component | Missed | Component right | Partial / unscored page runs |','| --- | ---: | ---: | ---: | ---: | ---: | --- | ---: |']
  const table=(rows:ReturnType<typeof group>)=>rows.map(r=>'| '+safe(armLabel(r.name.slice(0,r.name.lastIndexOf('/')))+'/'+r.name.slice(r.name.lastIndexOf('/')+1))+(r.distinct<20?' *':'')+' | '+r.blocks+' | '+r.correct+' | '+r.incomplete+' | '+r.wrong+' | '+r.missed+' | '+share(r.right,r.blocks,r.distinct)+' | '+r.partial+' / '+r.unscored+' |')
  lines.push(...table(all),'','Held-out pages — never use these results to choose rules or prompts',lines[7],lines[8],...table(heldOut),'','Other pages',lines[7],lines[8],...table(other),'',
    'Decision-model picking: '+picks.blocks+' blocks; top choice acceptable '+share(picks.top1,picks.blocks,picks.distinct)+'; any of top three acceptable '+share(picks.top3,picks.blocks,picks.distinct)+'.',
    '| Stated chance | Blocks | Top choice acceptable | Any of top three acceptable |','| --- | ---: | --- | --- |',...picks.bands.map(b=>'| '+b.band+' | '+b.blocks+' | '+share(b.top1,b.blocks,b.distinct)+' | '+share(b.top3,b.blocks,b.distinct)+' |'),
    'Most frequent confusions (picked → acceptable): '+(picks.confusions.map(([name,n])=>safe(name)+' '+share(n,picks.blocks)).join('; ')||'none')+'.','',
    'Stability — same verdict on shared blocks with matching labels; unknown settings cannot prove an identical setup',...repeats.map(r=>safe(armLabel(r.arm)+' '+r.runs.join(' / '))+': '+share(r.same,r.blocks)+'; '+r.excluded+' page pairs excluded.'),...(!repeats.length?['No repeated scored runs.']:[]),'',
    '| Arm | Pages / page runs | Page seconds: middle [low–high]; known runs | Calls / failed / timeouts / cut-short replies | Total / reasoning tokens | Cost per page; known runs | Total cost |',
    '| --- | --- | --- | --- | --- | --- | --- |',...accounting.map(a=>'| '+safe(armLabel(a.arm))+(totals(scored.filter(r=>r.arm===a.arm)).distinct<20&&!isPickArm(a.arm)?' *':'')+' | '+a.pages+' / '+a.pageRuns+' | '+(a.seconds.median===null?'unknown':a.seconds.median.toFixed(1)+' ['+a.seconds.min!.toFixed(1)+'–'+a.seconds.max!.toFixed(1)+']')+'; '+a.seconds.known+'/'+a.pageRuns+' | '+[a.calls,a.failed,a.timeouts,a.truncated].join(' / ')+' | '+amount(a.totalTokens)+' / '+amount(a.reasoningTokens)+' | '+(a.costPerPage===null?'unknown':'$'+a.costPerPage.toFixed(4))+'; '+a.costPages+'/'+a.pageRuns+' | '+amount(a.cost,true)+' |'),
    'Cost is recorded US dollars, including failed calls where known. Reused decision calls are excluded from new spending. Today arms share the same detection calls; do not add their costs. Today timing excludes later repair.','',
    'Content checks that fail most (failed / checked blocks)',...checks.filter(c=>c.checks.length).map(c=>safe(armLabel(c.arm))+(totals(scored.filter(r=>r.arm===c.arm)).distinct<20?' *':'')+': '+c.checks.map(k=>({headings:'headings',itemCount:'item count',image:'image',ctaLabels:'button/link text',textCoverage:'text kept'}[k.name]||k.name)+' '+share(k.failed,k.checked)).join('; ')+'.'),'',
    'Label reviewers (unique scored blocks per answer-sheet version): '+Object.entries(reviewers).map(([who,ids])=>safe(who)+' '+ids.size+(ids.size<20?' *':'')).join('; ')+'.',
    'Saved-data gaps: '+new Set(results.filter(r=>!pages[r.page]).map(r=>r.page)).size+' pages without manifest settings; '+results.filter(r=>!r.rows.length&&!isPickArm(r.arm)).length+' unscored page runs; '+scored.filter(r=>r.issues.includes('Saved score uses an older answer sheet')).length+' scores with older labels; '+results.filter(r=>r.issues.includes('Run used earlier labels')).length+' runs used earlier labels. All details: summary.json.','',
    'What this cannot show',
    Object.keys(pages).length+' pages in the manifest; '+new Set(results.map(r=>r.page)).size+' pages with saved runs. A small page set cannot show general performance.',
    'Page kinds: '+Object.entries(Object.values(pages).reduce((o,p)=>{o[p.kind]=(o[p.kind]||0)+1;return o},{} as Record<string,number>)).map(([k,n])=>k+' '+n).join(', ')+'. Missing kinds are untested.',
    'One extraction model: these results do not show how other models perform.',
    'No visual check: the scores do not show whether the imported page looks right.')
  // Keep the short report bounded; every table and detail remains in the small JSON.
  if(lines.length>=150) {
    // HTML tables retain all rows while bounding physical lines as arms grow.
    for(let i=0;i<lines.length;i++) if(lines[i].startsWith('| ')) {
      let end=i;while(end<lines.length&&lines[end].startsWith('| '))end++
      const html=lines.slice(i,end).filter(line=>!/^\| ---/.test(line)).map((line,row)=>'<tr>'+line.split(/(?<!\\)\|/).slice(1,-1).map(cell=>'<'+(row?'td':'th')+'>'+cell.trim().replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')+'</'+(row?'td':'th')+'>').join('')+'</tr>').join('')
      lines.splice(i,end-i,'<table>'+html+'</table>')
    }
    while(lines.length>=150) {const end=lines.length-1;lines.splice(end-1,2,lines[end-1]+'<br>'+lines[end])}
  }
  return {markdown:lines.join('\n')+'\n',json:{version:1,headline,all,heldOut,other,byArm,picks,stability:repeats,accounting,checks,reviewers:Object.fromEntries(Object.entries(reviewers).map(([k,v])=>[k,v.size])),pages,results:results.map(({calls,rows,picks,record,...r})=>({...r,blocks:rows.length,issues:r.issues}))}}
}
export async function summary(options:{families?:string;familySet?:string}={}) {
  const pages=await loadPages(false), results=await readSavedResults(), result=buildSummary(results,pages)
  const {simplerSummary}=await import('./family-summary')
  const simpler=await simplerSummary(pages,options)
  if(simpler){result.markdown+='\n'+simpler.markdown;Object.assign(result.json,{simpler:simpler.json})}
  const directory=path.join(process.env.IMPORT_LAB_OUTPUT_ROOT?familyOutputRoot():dataRoot(),'reports');await fs.mkdir(directory,{recursive:true})
  await fs.writeFile(path.join(directory,'SUMMARY.md'),result.markdown)
  await fs.writeFile(path.join(directory,'summary.json'),JSON.stringify(result.json,null,2)+'\n')
  console.log(result.json.headline)
  return result
}
if(require.main===module)main(async()=>{const {argumentsForPhase2}=await import('./labels');const a=argumentsForPhase2(['--families','--family-set']);await summary({families:a['--families'],familySet:a['--family-set']})})
