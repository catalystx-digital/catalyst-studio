import { loadFamilies, type FamilyOptions, type FamilySet } from './families'
import fs from 'node:fs/promises'
import path from 'node:path'
import { scoreSheet } from './scoring'
import { labelDirectory, slug, argumentsForPhase2, directories, optionalJson, sha, type Proposal } from './labels'
import { dataRoot, digest, readJson, main } from './storage'
import { extractPageEvidence, type Component } from './metrics'
import { blockEvidence } from './source-evidence'
import type { V2Sheet } from './scoring'
import { stickScoreName } from './stick-version'
import { loadPages } from './pages'
function scoreName(value:string) {
  if(value.includes('+')) {
    if(!/^(?:blocks-production|family-fill)\+repair--[a-zA-Z0-9_][a-zA-Z0-9_@.-]{0,239}--stick2-family-[A-Z]$/.test(value))throw new Error('Invalid repair arm score name')
    return value
  }
  return slug(value)
}
export function runIsMissed(record:{failures?:Array<{stage?:string}>}|null,components:Component[]|null) {
  return !record||!components||record.failures?.some(f=>f.stage==='run')===true
}
async function performScorePage(page:string,options:ScoreOptions,families:FamilySet) {
  const root=options.root||dataRoot(),directory=options.root?path.join(root,'labels',slug(page)):labelDirectory(page),sheet=await readJson<V2Sheet>(path.join(directory,'answer-sheet-v2.json')),proposal=await readJson<Proposal>(path.join(directory,'blocks.json'))
  const heldOut=(options.root?(await readJson<Record<string,{heldOut?:boolean}>>(path.join(root,'pages.json')))[page]?.heldOut:(await loadPages(false))[page]?.heldOut)===true||sheet.heldOut===true
  if(sheet.version!==2)throw new Error('Expected a version-2 answer sheet (answer-sheet-v2.json)')
  const sourceBlocks=sheet.blocks||proposal.blocks
  if(sheet.snapshotSha256!==proposal.snapshotSha256||sheet.proposalSha256!==sha({...proposal,blocks:sourceBlocks}))throw new Error('Answer sheet and snapshot differ')
  const geometry=await optionalJson(path.join(directory,'geometry.json'))
  if(!geometry)throw new Error('Missing geometry.json for '+page)
  const html=await fs.readFile(path.join(root,'pages',page,'page.html'),'utf8')
  if(digest(html)!==sheet.snapshotSha256)throw new Error('Saved page HTML snapshot checksum differs from answer sheet and proposal')
  const scores=path.join(directory,'scores-stick')
  let source: {evidence:ReturnType<typeof blockEvidence>[];pageSource:string}|undefined
  const save=async(name:string,componentFile:string)=>{
    const record=await optionalJson<{snapshotSha256?:string;failures?:Array<{stage?:string}>}>(path.join(path.dirname(componentFile),'run.json'))
    if(record&&record.snapshotSha256!==sheet.snapshotSha256)throw new Error('Run snapshot checksum differs from answer sheet and proposal: '+name)
    const components=await optionalJson<Component[]>(componentFile)
    const allMissed=runIsMissed(record,components)
    const file=path.join(scores,scoreName(name)+'.json')
    if(await optionalJson(file)){if(!heldOut)console.log('Saved score kept: '+name);return}
    if(!source){const stylesheets=await readJson<string[]>(path.join(root,'pages',page,'stylesheets.json'));source={evidence:sourceBlocks.map(block=>blockEvidence(html,stylesheets,block,geometry,proposal.finalUrl)),pageSource:extractPageEvidence(html,proposal.finalUrl,stylesheets).visibleText.join(' ')}}
    const measured=scoreSheet(sheet,allMissed?[]:components!,proposal.finalUrl,{families,blocks:sourceBlocks,...source,allMissed})
    const result=heldOut?{version:measured.version,name,status:'complete',familySet:families.set,accuracy:measured.accuracy}:{...measured,name,status:'complete',familySet:families.set,familySha256:families.sha256,...(record?{run:record}:{})}
    await saveNewScore(file,result)
    if(!heldOut)console.log(name+': '+measured.counts.correct+' correct; '+measured.counts['right type, content incomplete']+' right family incomplete; '+measured.counts.missed+' missed')
  }
  if(options.allRuns){
    const folder=path.join(root,'arms',page,'blocks-production')
    for(const run of await directories(folder)){
      const runFolder=path.join(folder,run)
      await save(stickScoreName('blocks-production',run,families.set),path.join(runFolder,'components.json'))
    }
  }else{
    if(!options.components||!options.name)throw new Error('Provide --components and --name, or --all-runs')
    const componentFile=path.resolve(options.components)
    await save(options.name+'-family-'+families.set,componentFile)
  }
}
export async function scorePage(page:string,options:ScoreOptions) {
  slug(page)
  const families=await loadFamilies(options.families||path.join(__dirname,'component-families.json'),options.familySet||'C')
  return performScorePage(page,options,families)
}
if(require.main===module)main(async()=>{const a=argumentsForPhase2(['--page','--components','--name','--all-runs','--families','--family-set'],['--all-runs']);if(a['--all-runs']&&(a['--components']||a['--name']))throw new Error('Use one scoring mode');await scorePage(slug(a['--page']||''),{families:a['--families'],familySet:a['--family-set'],components:a['--components'],name:a['--name'],allRuns:!!a['--all-runs']})})
async function saveNewScore(file:string,value:unknown) {
  await fs.mkdir(path.dirname(file),{recursive:true})
  try { await fs.writeFile(file,JSON.stringify(value,null,2)+'\n',{flag:'wx'}) }
  catch(error) { if((error as NodeJS.ErrnoException).code!=='EEXIST')throw error;console.log('Saved score kept: '+path.basename(file)) }
}
interface ScoreOptions extends FamilyOptions {components?:string;name?:string;allRuns?:boolean;root?:string}
