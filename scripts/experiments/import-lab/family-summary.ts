import path from 'node:path'
import { dataRoot } from './storage'
import { directories, optionalJson, type Sheet } from './labels'
import { acceptableFamilies, familyOutputRoot, loadFamilies, validateFamilyOptions, type FamilySet, type FamilyOptions } from './families'
import { readSavedResults, callTotals, armLabel, totals, pickTotals, share, median, type SavedResult } from './summary'
import type { PageManifest } from './pages'

const right=(row:any)=>['correct','right type, content incomplete'].includes(row.verdict)
export function pairedFamilies(types:SavedResult[],families:SavedResult[],definition:FamilySet) {
  const pairs:Array<{type:SavedResult;family:SavedResult;changed:number}>=[],excluded:string[]=[]
  for(const source of types.filter(r=>r.rows.length)){
    const target=families.find(r=>r.page===source.page&&r.arm===source.arm&&r.run===source.run)
    if(!target?.rows.length||!source.sheetHash||source.sheetHash!==target.sheetHash||target.record.familySha256!==definition.sha256||target.issues.includes('Saved score uses an older answer sheet')){excluded.push(source.arm+'/'+source.run);continue}
    const ids=new Set(target.rows.filter(r=>!r.ignored).map(r=>r.id)),before=source.rows.filter(r=>!r.ignored&&ids.has(r.id)),after=before.map(r=>target.rows.find(f=>f.id===r.id)!)
    pairs.push({type:{...source,rows:before},family:{...target,rows:after},changed:before.filter((r,i)=>r.verdict==='wrong type'&&right(after[i])).length})
  }
  return {pairs,excluded}
}
export function ambiguity(sheets:Sheet[],families:FamilySet) {
  const entries=sheets.flatMap(s=>s.entries.filter(e=>e.status!=='draft'&&e.label&&!e.label.ignore))
  const typeCount=entries.reduce((n,e)=>n+e.label!.acceptableTypes.length,0),familyCount=entries.reduce((n,e)=>n+acceptableFamilies(e.label!.acceptableTypes,families).length,0)
  return {blocks:entries.length,typeCount,familyCount,types:entries.length?typeCount/entries.length:null,families:entries.length?familyCount/entries.length:null}
}
function pickingAccounting(results:SavedResult[]) {
  const telemetry=callTotals(results.flatMap(r=>r.calls)),seconds=results.map(r=>r.seconds).filter((n):n is number=>typeof n==='number'&&Number.isFinite(n))
  const latency=results.flatMap(r=>r.calls).map(c=>c.latencyMs).filter((n):n is number=>typeof n==='number'&&Number.isFinite(n))
  return {...telemetry,pageSeconds:{median:median(seconds),known:seconds.length,count:results.length},callMilliseconds:{median:median(latency),known:latency.length,count:telemetry.calls}}
}
export function buildFamilySummary(types:SavedResult[],sets:Array<{definition:FamilySet;results:SavedResult[]}>,pages:PageManifest,sheets:Sheet[]) {
  const lines=['## Simpler component list','','Free regrouping of saved outputs; content checks unchanged. Repeats count again. Component right includes incomplete content.'],details:any[]=[]
  for(const scope of ['All pages','Held-out pages','Other pages'] as const){
    const included=(page:string)=>scope==='All pages'||(pages[page]&&pages[page].heldOut===(scope==='Held-out pages'))
    const scoped=types.filter(r=>included(r.page)),selected=sheets.filter(s=>included(s.page))
    const measured=sets.map(set=>({...set,...pairedFamilies(scoped,set.results.filter(r=>included(r.page)),set.definition)}))
    const arms=[...new Set(measured.flatMap(s=>s.pairs.map(p=>p.type.arm)))].sort()
    const rows=arms.map(arm=>({arm,sets:measured.map(set=>{const pairs=set.pairs.filter(p=>p.type.arm===arm);return {set:set.definition.set,type:totals(pairs.map(p=>p.type)),family:totals(pairs.map(p=>p.family)),changed:pairs.reduce((n,p)=>n+p.changed,0)}})}))
    lines.push('',scope+' — same block/run pairs within each comparison','| Arm | '+sets.map(s=>'Types → '+s.definition.set+' ('+s.definition.entries.length+' families): component right | Wrong → right').join(' | ')+' |','| --- | '+sets.map(()=>'--- | ---').join(' | ')+' |')
    for(const row of rows)lines.push('| '+armLabel(row.arm)+' | '+row.sets.map(s=>share(s.type.right,s.type.blocks,s.type.distinct)+' → '+share(s.family.right,s.family.blocks,s.family.distinct)+' | '+share(s.changed,s.type.wrong,s.type.distinct)).join(' | ')+' |')
    if(!rows.length)lines.push('No paired component scores.')
    const ambiguities=sets.map(s=>({set:s.definition.set,...ambiguity(selected,s.definition)}))
    lines.push('Ambiguity (acceptable choices per block): '+ambiguities.map(a=>a.set+' types '+(a.types?.toFixed(2)??'unmeasured')+' ('+a.typeCount+'/'+a.blocks+'), families '+(a.families?.toFixed(2)??'unmeasured')+' ('+a.familyCount+'/'+a.blocks+')').join('; ')+'.')
    const modes=sets.flatMap(set=>{
      const familyResults=set.results.filter(r=>included(r.page)),typeRuns=scoped.filter(r=>r.arm==='jev-pick'),postRuns=familyResults.filter(r=>r.arm==='jev-pick')
      const before:SavedResult[]=[],after:SavedResult[]=[]
      for(const run of typeRuns){const match=postRuns.find(r=>r.page===run.page&&r.run===run.run);if(!match)continue;const ids=new Set(match.picks.map(p=>p.blockId));const picks=run.picks.filter(p=>ids.has(p.blockId));before.push({...run,picks});after.push({...match,picks:match.picks.filter(p=>picks.some(q=>q.blockId===p.blockId))})}
      const asked=familyResults.filter(r=>r.arm==='jev-pick@families-'+set.definition.set)
      return [{name:set.definition.set+' type level',runs:before,newCalls:0},{name:set.definition.set+' post-hoc family',runs:after,newCalls:0},{name:set.definition.set+' asked at family level',runs:asked,newCalls:null}].map(m=>({...m,stats:pickTotals(m.runs.flatMap(r=>r.picks.map(p=>({...p,page:r.page})))),accounting:pickingAccounting(m.runs)}))
    })
    lines.push('| Picking | Top choice acceptable | Any of top three | Calls | Cost (USD; known calls) | Median call ms / page seconds |','| --- | --- | --- | ---: | --- | --- |')
    for(const m of modes){const a=m.accounting;lines.push('| '+m.name+' | '+share(m.stats.top1,m.stats.blocks,m.stats.distinct)+' | '+share(m.stats.top3,m.stats.blocks,m.stats.distinct)+' | '+a.calls+' | '+(a.cost.known?'$'+a.cost.value.toFixed(4):'unknown')+'; '+a.cost.known+'/'+a.cost.count+' | '+(a.callMilliseconds.median?.toFixed(1)??'unknown')+' ('+a.callMilliseconds.known+'/'+a.callMilliseconds.count+') / '+(a.pageSeconds.median?.toFixed(2)??'unknown')+' ('+a.pageSeconds.known+'/'+a.pageSeconds.count+') |')}
    details.push({scope,rows,ambiguity:ambiguities,picking:modes.map(({runs,...m})=>m),excluded:measured.map(s=>({set:s.definition.set,unpairedPageRuns:s.excluded.length}))})
  }
  lines.push('','Post-hoc rows reuse the type calls, cost and latency: zero new calls and zero new cost. Asked-family rows are separate runs; coverage may differ. Unknown costs remain unknown. * Fewer than 20 distinct blocks.','')
  for(const detail of details){
    lines.push(detail.scope+' — full verdict counts (correct / content incomplete / wrong component / missed)')
    for(const row of detail.rows)for(const s of row.sets)lines.push(armLabel(row.arm)+'; '+s.set+': types '+[s.type.correct,s.type.incomplete,s.type.wrong,s.type.missed].join(' / ')+'; families '+[s.family.correct,s.family.incomplete,s.family.wrong,s.family.missed].join(' / ')+'; '+s.type.blocks+' shared block/run observations.')
    lines.push('Excluded page runs without matching current labels, family definition or scores: '+detail.excluded.map((e:any)=>e.set+' '+e.unpairedPageRuns).join('; ')+'.')
    for(const m of detail.picking){
      lines.push(detail.scope+' — '+m.name,'| Stated probability | Top choice acceptable | Any of top three |','| --- | --- | --- |',...m.stats.bands.map((b:any)=>'| '+b.band+' | '+share(b.top1,b.blocks,b.distinct)+' | '+share(b.top3,b.blocks,b.distinct)+' |'))
      lines.push('Most frequent confusions (picked → acceptable): '+(m.stats.confusions.map(([name,n]:[string,number])=>name+' '+share(n,m.stats.blocks,m.stats.distinct)).join('; ')||'none')+'.')
    }
  }
  return {markdown:lines.join('\n')+'\n',json:{sets:sets.map(s=>s.definition),scopes:details}}
}
export async function simplerSummary(pages:PageManifest,options:FamilyOptions={}) {
  validateFamilyOptions(options)
  const labels=await directories(path.join(familyOutputRoot(),'labels'))
  const available=new Set<string>()
  for(const page of labels)for(const dir of await directories(path.join(familyOutputRoot(),'labels',page)))if(/^scores-family-[AB]$/.test(dir))available.add(dir.slice(-1))
  const names=options.familySet?[options.familySet]:[...available].sort()
  if(!names.length)return null
  const file=options.families||path.join(__dirname,'component-families.json'),sets=[]
  for(const name of names){const definition=await loadFamilies(file,name);sets.push({definition,results:await readSavedResults(definition)})}
  const sheets:Sheet[]=[]
  for(const page of await directories(path.join(dataRoot(),'labels'))){const sheet=await optionalJson<Sheet>(path.join(dataRoot(),'labels',page,'answer-sheet.json'));if(sheet)sheets.push(sheet)}
  const comparisonTypes=await readSavedResults()
  const result=buildFamilySummary(comparisonTypes,sets,pages,sheets)
  const issues=sets.flatMap(s=>s.results.flatMap(r=>r.issues.map(issue=>s.definition.set+': '+issue)))
  result.markdown+='Family scoring gaps: '+issues.length+' recorded issues. Details are in summary.json.\n'
  Object.assign(result.json,{issues})
  return result
}
