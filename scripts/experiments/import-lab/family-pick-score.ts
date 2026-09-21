import fs from 'node:fs/promises'
import path from 'node:path'
import { argumentsForPhase2, directories, optionalJson, sha, type Sheet } from './labels'
import { dataRoot, readJson, main, identifier } from './storage'
import { loadFamilies, scoreDirectory, type FamilySet } from './families'
import { scorePicks, type Pick } from './pick-score'

export function checkedPickScore(sheet:Sheet,record:any,saved:any,families?:FamilySet) {
  if(record.snapshotSha256!==sheet.snapshotSha256||record.proposalSha256!==sheet.proposalSha256)throw new Error('Saved picks and answer sheet use different source blocks')
  if(saved.dryAssumptions||record.fixture||record.status==='dry-run')return null
  if(record.picksSha256&&record.picksSha256!==sha(saved))throw new Error('Saved picks checksum differs from run')
  const asked=!!saved.familySet
  if(asked&&(!families||saved.familySet!==families.set||saved.familySha256!==families.sha256))throw new Error('Saved family picks use another family definition')
  return {...scorePicks(sheet,saved.picks as Pick[],{families,postHoc:!!families&&!asked}),answerSheetSha256:sha(sheet),mode:asked?'asked at family level':families?'post-hoc family':'type level'}
}
export async function scoreFamilyPicksPage(page:string,file:string,set:string) {
  identifier(page)
  if(!file||!set)throw new Error('Provide --families and --family-set')
  const families=await loadFamilies(file,set),sheet=await readJson<Sheet>(path.join(dataRoot(),'labels',page,'answer-sheet.json'))
  const output=path.join(scoreDirectory(page,{families:file,familySet:set}),'picks')
  for(const arm of ['jev-pick','jev-pick@families-'+set])for(const run of await directories(path.join(dataRoot(),'arms',page,arm))){
    const folder=path.join(dataRoot(),'arms',page,arm,run),record=await readJson(path.join(folder,'run.json')),saved=await optionalJson(path.join(folder,'picks.json'))
    if(record.fixture||record.status==='dry-run')continue
    if(!saved)throw new Error('Missing saved picks for '+arm+'/'+run)
    const score=checkedPickScore(sheet,record,saved,families)
    if(!score)continue
    const target=path.join(output,arm+'--'+run+'.json'),previous=await optionalJson(target)
    if(previous){if(previous.familySha256!==families.sha256||previous.answerSheetSha256!==sha(sheet))throw new Error('Existing family pick score has changed labels or families');continue}
    await fs.mkdir(output,{recursive:true})
    await fs.writeFile(target,JSON.stringify({...score,familySet:set,familySha256:families.sha256,arm,run,sourceStatus:record.status},null,2)+'\n',{flag:'wx'})
    console.log(arm+'/'+run+': top family '+score.top1+'/'+score.count+'; any top three '+score.top3+'/'+score.count)
  }
}
if(require.main===module)main(async()=>{const a=argumentsForPhase2(['--page','--families','--family-set']);await scoreFamilyPicksPage(a['--page'],a['--families'],a['--family-set'])})
