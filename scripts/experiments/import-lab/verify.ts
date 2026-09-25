import fs from 'node:fs/promises'
import path from 'node:path'
import { loadFamilies } from './families'
import { dataRoot, digest, readJson } from './storage'
import { validatePages } from './pages'
import { optionalJson, type Proposal } from './labels'
import { blockEvidence, type SourceEvidence } from './source-evidence'
import { checkVisibleContent, matchedBlockEvidence, scoreSheet, type V2Sheet } from './scoring'
import { type Component } from './metrics'
import { runIsMissed } from './score'

export function verifyBlock(evidence:SourceEvidence,components:Component[]) {
  const baseUrl=evidence.baseUrl||evidence.links[0]?.url||evidence.images[0]?.addresses[0]||'https://example.invalid/'
  const {checks,missing,invented}=checkVisibleContent(evidence,components,baseUrl,evidence.text[0]?.region||'main')
  return {verified:components.length>0&&checks.C2.passed&&checks.C4.passed&&checks.C5.passed&&checks.C7.passed,missing,invented,headingsKept:checks.C3.passed}
}

interface VerifyOptions {arm:string;runs:string[]}
export async function verifyRuns(root:string,options:VerifyOptions) {
  const pages=validatePages(await readJson(path.join(root,'pages.json')))
  const pending:Array<{file:string;value:unknown}>=[]
  const mismatches:string[]=[]
  let complete=0,total=0,agreement=0
  for(const [page,settings] of Object.entries(pages).sort(([a],[b])=>a.localeCompare(b))) {
    if(settings.heldOut)continue
    const label=path.join(root,'labels',page)
    const sheet=await readJson<V2Sheet>(path.join(label,'answer-sheet-v2.json'))
    const proposal=await readJson<Proposal>(path.join(label,'blocks.json'))
    const blocks=sheet.blocks||proposal.blocks
    const geometry=await readJson(path.join(label,'geometry.json'))
    const html=await fs.readFile(path.join(root,'pages',page,'page.html'),'utf8')
    if(digest(html)!==sheet.snapshotSha256)throw new Error('Saved page HTML snapshot checksum differs from answer sheet: '+page)
    const stylesheets=await readJson<string[]>(path.join(root,'pages',page,'stylesheets.json'))
    const evidence=blocks.map(block=>blockEvidence(html,stylesheets,block,geometry,proposal.finalUrl))
    const families=await loadFamilies(path.join(__dirname,'component-families.json'),sheet.familySet)
    const sheetWithoutDecoration:V2Sheet={...sheet,entries:sheet.entries.map(entry=>({...entry,label:{...entry.label,decorativeImages:[]}}))}
    for(const run of options.runs) {
      const folder=path.join(root,'arms',page,options.arm,run)
      const record=await optionalJson<{status?:string;failures?:Array<{stage?:string}>;snapshotSha256?:string}>(path.join(folder,'run.json'))
      const components=await optionalJson<Component[]>(path.join(folder,'components.json'))
      if(!record||record.status==='dry-run')throw new Error('Missing production run: '+page+' '+run)
      if(record.snapshotSha256&&record.snapshotSha256!==sheet.snapshotSha256)throw new Error('Run snapshot checksum differs: '+page+' '+run)
      const missed=runIsMissed(record,components)
      const used=missed?[]:components!
      const measured=scoreSheet(sheetWithoutDecoration,used,proposal.finalUrl,{families,blocks,evidence,allMissed:missed})
      const rows=[]
      let runComplete=0,runAgreement=0
      for(const row of measured.rows.filter(row=>!row.ignored&&row.verdict!=='unsettled')) {
        const block=blocks.find(block=>block.id===row.id)!
        const source=matchedBlockEvidence(block,blocks,row.componentIndices,measured.matches,evidence,proposal.finalUrl)
        const output=row.componentIndices.map(index=>used[index])
        const result=verifyBlock(source,output)
        const expected=!!row.componentIndices.length&&(['C2','C4','C5','C7'] as const).every(name=>row.checks[name].passed===true)
        if(result.verified!==expected)mismatches.push(`${page} ${options.arm}/${run} ${row.id}: automatic=${result.verified}, stick=${expected}`)
        if(result.verified){complete++;runComplete++}
        if(result.verified===expected){agreement++;runAgreement++}
        total++
        rows.push({blockId:row.id,...result})
      }
      pending.push({file:path.join(label,'verify',`${options.arm}--${run}.json`),value:{page,arm:options.arm,run,summary:{complete:runComplete,total:rows.length,agreement:runAgreement},rows}})
    }
  }
  if(mismatches.length){mismatches.forEach(line=>console.error('Identity mismatch: '+line));return {complete,total,agreement,mismatches}}
  for(const {file,value} of pending) {
    await fs.mkdir(path.dirname(file),{recursive:true})
    try{await fs.writeFile(file,JSON.stringify(value,null,2)+'\n',{flag:'wx'})}
    catch(error){if((error as NodeJS.ErrnoException).code!=='EEXIST')throw error}
  }
  console.log(`Sections the automatic check calls complete: ${complete} of ${total}`)
  console.log(`Agreement between the automatic check and the measuring stick's content checks: ${agreement} of ${total}`)
  console.log(`Identity mismatches: ${mismatches.length}`)
  return {complete,total,agreement,mismatches}
}

export async function verifySavedRuns(options:VerifyOptions) {return verifyRuns(dataRoot(),options)}
