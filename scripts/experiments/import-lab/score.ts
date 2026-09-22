import { loadFamilies, scoreDirectory, type FamilyOptions, type FamilySet } from './families'
import fs from 'node:fs/promises'
import path from 'node:path'
import { scoreSheet } from './scoring'
import { labelDirectory, slug, argumentsForPhase2, directories, optionalJson, sha, type Sheet, type Proposal } from './labels'
import { dataRoot, readJson, main, errorRecord } from './storage'
import type { Component } from './metrics'
async function saveNewScore(file:string,value:unknown) {
  await fs.mkdir(path.dirname(file),{recursive:true})
  try { await fs.writeFile(file,JSON.stringify(value,null,2)+'\n',{flag:'wx'}) }
  catch(error) { if((error as NodeJS.ErrnoException).code!=='EEXIST')throw error;console.log('Saved score kept: '+path.basename(file)) }
}
interface ScoreOptions extends FamilyOptions {components?:string;name?:string;allRuns?:boolean;ignoreItemCount?:boolean}
async function performScorePage(page:string,options:ScoreOptions,families?:FamilySet) {
  const directory=labelDirectory(page),sheet=await readJson<Sheet>(path.join(directory,'answer-sheet.json')),proposal=await readJson<Proposal>(path.join(directory,'blocks.json'))
  if(sheet.snapshotSha256!==proposal.snapshotSha256||sheet.proposalSha256!==sha(proposal))throw new Error('Answer sheet and snapshot differ')
  const scores=scoreDirectory(page,options);await fs.mkdir(scores,{recursive:true})
  const save=async(name:string,components:Component[],extra:Record<string,unknown>={})=>{
    const file=path.join(scores,slug(name)+'.json')
    const previous=await optionalJson(file)
    if(previous){if(families&&(previous.familySha256!==families.sha256||previous.answerSheetSha256!==sha(sheet)))throw new Error('Saved family score uses another definition or answer sheet: '+name);console.log('Saved score kept: '+name);return}
    const result={...scoreSheet(sheet,components,proposal.finalUrl,{ignoreItemCount:options.ignoreItemCount,families}),name,status:'complete',...(families?{familySet:families.set,familySha256:families.sha256}:{}),...extra}
    await saveNewScore(path.join(scores,slug(name)+'.json'),result)
    console.log(name+': '+result.reviewedBlocks+'/'+result.totalBlocks+' blocks reviewed; '+result.unreviewedBlocks+' unreviewed; '+result.extra.length+' extra components')
  }
  if(options.allRuns) {
    const runs=await directories(path.join(dataRoot(),'runs',slug(page)))
    const outcomes:Array<Record<string,unknown>>=[]
    for(const run of runs) {
      const folder=path.join(dataRoot(),'runs',page,run)
      try {
        const record=await readJson(path.join(folder,'run.json'))
        if(record.status==='dry-run'){outcomes.push({run,status:'skipped',reason:'Dry run; no score written'});continue}
        if(record.status!=='complete')throw new Error('Run not complete: '+record.status)
        if(record.snapshotSha256!==sheet.snapshotSha256)throw new Error('Run snapshot differs from answer sheet')
        const arms=await optionalJson(path.join(folder,'arms.json'))
        if(!arms) {
          await save(run+'--pre-repair',await readJson(path.join(folder,'pre-repair.json')),{run,arm:'pre-repair'})
          outcomes.push({run,status:'partial',reason:'arms.json missing; scored pre-repair only'});continue
        }
        if(arms.snapshotSha256!==sheet.snapshotSha256)throw new Error('Arms snapshot differs from answer sheet')
        for(const [arm,record] of Object.entries(arms.arms) as Array<[string,any]>) {
          const name=slug(run+'--'+arm)
          if(record.status==='complete') {await save(name,record.components,{run,arm});outcomes.push({run,arm,status:'complete'})}
          else {const skipped={name,page,run,arm,status:record.status,reason:record.reason||record.error||'Arm did not complete'};if(!await optionalJson(path.join(scores,name+'.json')))await saveNewScore(path.join(scores,name+'.json'),skipped);outcomes.push(skipped)}
        }
      } catch(error) {
        const failed={name:run+'--run',page,run,status:'failed',reason:errorRecord(error)}
        if(!await optionalJson(path.join(scores,slug(failed.name)+'.json')))await saveNewScore(path.join(scores,slug(failed.name)+'.json'),failed);outcomes.push(failed);process.exitCode=1
      }
    }
    await saveNewScore(options.families?path.join(scores,'score-runs.json'):path.join(directory,'score-runs.json'),{page,outcomes,issues:runs.length?[]:['No Phase 1 runs found']})
    for(const outcome of outcomes.filter(o=>o.status!=='complete'))console.warn(JSON.stringify(outcome))
    if(!runs.length)console.warn('No Phase 1 runs found')
  } else {
    if(!options.components||!options.name)throw new Error('Provide --components and --name, or --all-runs')
    const name=slug(options.name)
    const previous=await optionalJson(path.join(scores,name+'.json'))
    if(previous){if(families&&(previous.familySha256!==families.sha256||previous.answerSheetSha256!==sha(sheet)))throw new Error('Saved family score uses another definition or answer sheet: '+name);console.log('Saved score kept: '+name);return}
    try {await save(name,await readJson(path.resolve(options.components)))}
    catch(error){await saveNewScore(path.join(scores,name+'.json'),{page,name,status:'failed',reason:errorRecord(error)});throw error}
  }
}
export async function scorePage(page:string,options:ScoreOptions) {
  slug(page)
  const scores=scoreDirectory(page,options), families=options.families?await loadFamilies(options.families,options.familySet!):undefined
  try {return await performScorePage(page,options,families)}
  catch(error) {const name=slug(options.name||'all-runs');await saveNewScore(path.join(scores,name+'.json'),{page,name,status:'failed',reason:errorRecord(error)});throw error}
}
if(require.main===module)main(async()=>{const a=argumentsForPhase2(['--page','--components','--name','--all-runs','--ignore-item-count','--families','--family-set'],['--all-runs','--ignore-item-count']);if(a['--all-runs']&&(a['--components']||a['--name']))throw new Error('Use one scoring mode');await scorePage(slug(a['--page']||''),{families:a['--families'],familySet:a['--family-set'],components:a['--components'],name:a['--name'],allRuns:!!a['--all-runs'],ignoreItemCount:!!a['--ignore-item-count']})})
