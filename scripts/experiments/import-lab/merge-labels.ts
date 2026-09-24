import fs from 'node:fs/promises'
import path from 'node:path'
import { dataRoot, main, readJson } from './storage'
import { argumentsForPhase2, familyBlockSource, labelDirectory, optionalJson, sha, slug, validateFamilyLabel, type FamilyLabel, type FamilyDraftSheet, type FamilyDraftEntry, type Proposal } from './labels'
import { loadPages } from './pages'

type Dispute<T>={disputed:true;a:T;b:T;c?:T}
type ImageGroup=NonNullable<FamilyDraftEntry['evidence']>['imageGroups'][number]
export interface MergeEvidence {detectedCount:number|null;imageGroups:ImageGroup[];heldOut?:boolean}
const dispute=<T>(a:T,b:T,c?:T):Dispute<T>=>c===undefined?{disputed:true,a,b}:{disputed:true,a,b,c}
const same=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b)
const sorted=(items:string[])=>[...new Set(items)].sort()
const sameSet=(a:string[],b:string[])=>same(sorted(a),sorted(b))
const isRuleDecorative=(address:string,groups:ImageGroup[])=>{
  const occurrences=groups.filter(group=>group.addresses.includes(address))
  return occurrences.length>0&&occurrences.every(group=>(group.width===1&&group.height===1)||(group.width!==null&&group.height!==null&&group.width<16&&group.height<16)||group.clonedCarouselCopy===true)
}

export function compareLabels(a:FamilyLabel,b:FamilyLabel,c:FamilyLabel|undefined,evidence:MergeEvidence) {
  const result:Record<string,unknown>={}
  const third=evidence.heldOut?undefined:c,settledBy:Record<string,'majority'>={}
  const majority=<T>(key:string,left:T,right:T,last:T|undefined,equal:(x:T,y:T)=>boolean=same):T|Dispute<T>=>{
    if(equal(left,right))return left
    if(third&&last!==undefined){
      if(equal(left,last)){settledBy[key]='majority';return left}
      if(equal(right,last)){settledBy[key]='majority';return right}
    }
    return dispute(left,right,last)
  }
  const family=majority('family',a.family,b.family,third?.family)
  const pair=typeof family==='object'&&family!==null?null:a.family===b.family?[a,b]:a.family===family&&third?.family===family?[a,third]:b.family===family&&third?.family===family?[b,third]:null
  const intersection=pair?pair[0].acceptableFamilies.filter(name=>pair[1].acceptableFamilies.includes(name)):[]
  result.family=family
  result.acceptableFamilies=pair&&(typeof family==='string'&&intersection.includes(family)||family===null&&pair[0].ignore&&pair[1].ignore)?sorted(intersection):dispute(a.acceptableFamilies,b.acceptableFamilies,third?.acceptableFamilies)
  if(settledBy.family&&Array.isArray(result.acceptableFamilies))settledBy.acceptableFamilies='majority'
  for(const key of ['placement','ignore'] as const)result[key]=majority(key,a[key],b[key],third?.[key])
  result.ignoreReason=a.ignoreReason??b.ignoreReason??third?.ignoreReason
  result.itemKind=a.itemKind??b.itemKind??third?.itemKind??null
  const multiple=majority('multiple', [a.multiple,a.familiesInOrder] as const,[b.multiple,b.familiesInOrder] as const,third?[third.multiple,third.familiesInOrder] as const:undefined)
  if(Array.isArray(multiple)){result.multiple=multiple[0];result.familiesInOrder=multiple[1];if(settledBy.multiple)settledBy.familiesInOrder='majority'}
  else{result.multiple=dispute(a.multiple,b.multiple,third?.multiple);result.familiesInOrder=dispute(a.familiesInOrder,b.familiesInOrder,third?.familiesInOrder)}
  result.itemCount=a.itemCount===b.itemCount?a.itemCount:evidence.detectedCount!==null&&[a.itemCount,b.itemCount,third?.itemCount].includes(evidence.detectedCount)?evidence.detectedCount:majority('itemCount',a.itemCount,b.itemCount,third?.itemCount)
  const both=sorted([...a.decorativeImages,...b.decorativeImages]),difference=both.filter(address=>a.decorativeImages.includes(address)!==b.decorativeImages.includes(address))
  const decorative=sameSet(a.decorativeImages,b.decorativeImages)?a.decorativeImages:difference.every(address=>isRuleDecorative(address,evidence.imageGroups))?both:majority('decorativeImages',a.decorativeImages,b.decorativeImages,third?.decorativeImages,sameSet)
  result.decorativeImages=Array.isArray(decorative)?sorted(decorative):decorative
  result.reason={a:a.reason,b:b.reason,...(third?{c:third.reason}:{})}
  const status=Object.values(result).some(value=>value&&typeof value==='object'&&'disputed' in value)?'disputed':'agreed'
  return {status,label:result,settledBy}
}

export function familyKappa(pairs:Array<[string|null,string|null]>):number|null {
  if(!pairs.length)return null
  const names=new Set(pairs.flat())
  const observed=pairs.filter(([a,b])=>a===b).length/pairs.length
  const expected=[...names].reduce((sum,name)=>sum+pairs.filter(([a])=>a===name).length*pairs.filter(([,b])=>b===name).length/(pairs.length*pairs.length),0)
  return expected===1?(observed===1?1:0):(observed-expected)/(1-expected)
}
async function saveExclusive(file:string,value:unknown) {
  await fs.mkdir(path.dirname(file),{recursive:true})
  await fs.writeFile(file,JSON.stringify(value,null,2)+'\n',{flag:'wx'})
}
function verifyDraft(sheet:FamilyDraftSheet,proposal:Proposal,complete=true) {
  if(sheet.version!==2||sheet.page!==proposal.page||sheet.snapshotSha256!==proposal.snapshotSha256||sheet.proposalSha256!==sha(proposal))throw new Error('Label sheet and block proposal differ')
  if(!Array.isArray(sheet.familyNames)||!sheet.familyNames.length||sheet.familyNames.some(name=>typeof name!=='string'))throw new Error('Missing family names in label sheet')
  if(sheet.entries.length!==proposal.blocks.length||sheet.entries.some((entry,index)=>entry.blockId!==proposal.blocks[index].id||complete&&(entry.draftStatus!=='complete'||!entry.label)))throw new Error(complete?'Every block needs a complete label':'Third labeller blocks must match the proposal')
}
export async function mergePage(page:string,aName:string,bName:string,cName?:string,finalize=true) {
  for(const name of [page,aName,bName,cName].filter((value):value is string=>!!value))slug(name)
  const directory=labelDirectory(page),target=path.join(directory,'answer-sheet-v2.json')
  if(await optionalJson(target))throw new Error('answer-sheet-v2.json already exists: '+page)
  const pages=await loadPages(),manifest=pages[page]
  if(!manifest)throw new Error('Page absent from manifest: '+page)
  const proposal=await familyBlockSource(page)
  const read=async(name:string)=>readJson<FamilyDraftSheet>(path.join(directory,'label-'+name+'.json'))
  const [a,b,c]=await Promise.all([read(aName),read(bName),cName&&!manifest.heldOut?read(cName):Promise.resolve(undefined)])
  if(a.model.split('/')[0]===b.model.split('/')[0])throw new Error('Independent labellers must use different vendors')
  verifyDraft(a,proposal);verifyDraft(b,proposal);if(c)verifyDraft(c,proposal,false)
  if(a.familySet!==b.familySet||a.catalogueSha256!==b.catalogueSha256||!same(a.familyNames,b.familyNames)||c&&(c.familySet!==a.familySet||c.catalogueSha256!==a.catalogueSha256||!same(c.familyNames,a.familyNames)))throw new Error('Labellers used different family catalogues')
  const entries=proposal.blocks.map((block,index)=>{
    const left=a.entries[index],right=b.entries[index],third=c?.entries[index]
    const labels=[left.label!,right.label!,third?.draftStatus==='complete'?third.label??undefined:undefined]
    for(const label of labels)if(label)validateFamilyLabel(label,a.familyNames)
    const evidence=left.evidence||right.evidence
    if(!evidence)throw new Error('Missing source evidence for '+block.id)
    if(right.evidence&&!same(evidence,right.evidence))throw new Error('Labellers have different source evidence for '+block.id)
    const merged=compareLabels(labels[0]!,labels[1]!,labels[2],{...evidence,heldOut:manifest.heldOut})
    return {blockId:block.id,order:block.order,...merged,...(merged.status==='agreed'?{reviewedBy:'model-agreed:'+a.model+'+'+b.model}:{})}
  })
  const sheet={version:2,page,heldOut:manifest.heldOut,snapshotSha256:proposal.snapshotSha256,proposalSha256:sha(proposal),blocks:proposal.blocks,familySet:a.familySet,catalogueSha256:a.catalogueSha256,labellers:{a:{out:aName,model:a.model},b:{out:bName,model:b.model},...(!manifest.heldOut&&c?{c:{out:cName,model:c.model}}:{})},entries}
  await saveExclusive(target,sheet)
  if(finalize)await writeAgreement()
  return sheet
}
export async function writeAgreement() {
  const pages=await loadPages(),rows:Array<{split:'development'|'heldOut';a:FamilyLabel;b:FamilyLabel;status:string}>=[]
  const fields=['family','acceptableFamilies','placement','ignore','ignoreReason','multiple','familiesInOrder','itemCount','itemKind','decorativeImages'] as const
  const counts=Object.fromEntries(fields.map(field=>[field,{agreed:0,total:0,settledByMajority:0}]))
  const ignore:Record<string,number>={a:0,b:0},width:Record<string,number>={a:0,b:0},sample:Record<string,number>={a:0,b:0},disputedBlocks={development:0,heldOut:0}
  for(const [page,manifest] of Object.entries(pages)) {
    const answer=await optionalJson<any>(path.join(labelDirectory(page),'answer-sheet-v2.json'))
    if(!answer)continue
    const [a,b,c]=await Promise.all([readJson<FamilyDraftSheet>(path.join(labelDirectory(page),'label-'+answer.labellers.a.out+'.json')),readJson<FamilyDraftSheet>(path.join(labelDirectory(page),'label-'+answer.labellers.b.out+'.json')),!manifest.heldOut&&answer.labellers.c?readJson<FamilyDraftSheet>(path.join(labelDirectory(page),'label-'+answer.labellers.c.out+'.json')):Promise.resolve(undefined)])
    if(c){ignore.c??=0;width.c??=0;sample.c??=0}
    answer.entries.forEach((entry:any,index:number)=>{
      const left=a.entries[index].label!,right=b.entries[index].label!,split=manifest.heldOut?'heldOut':'development'
      rows.push({split,a:left,b:right,status:entry.status})
      if(entry.status==='disputed')disputedBlocks[split]++
      if(left.ignore)ignore.a++;if(right.ignore)ignore.b++
      width.a+=left.acceptableFamilies.length;width.b+=right.acceptableFamilies.length
      sample.a++;sample.b++
      if(c){const third=c.entries[index];if(third.draftStatus==='complete'&&third.label){if(third.label.ignore)ignore.c=(ignore.c||0)+1;width.c=(width.c||0)+third.label.acceptableFamilies.length;sample.c=(sample.c||0)+1}}
      for(const field of fields){counts[field].total++;if(field==='acceptableFamilies'||field==='decorativeImages'?sameSet(left[field],right[field]):same(left[field],right[field]))counts[field].agreed++;if(entry.settledBy?.[field]==='majority')counts[field].settledByMajority=(counts[field].settledByMajority||0)+1}
    })
  }
  const all=rows.map(row=>[row.a.family,row.b.family] as [string|null,string|null])
  const familyAgreement=counts.family.total?counts.family.agreed/counts.family.total:null,kappa=familyKappa(all)
  const report={version:2,blocks:rows.length,perField:Object.fromEntries(fields.map(field=>[field,{...counts[field],rate:counts[field].total?counts[field].agreed/counts[field].total:null,...(field==='itemKind'||field==='ignoreReason'?{label:'(not disputed)'}:{})}])),kappa:{development:familyKappa(rows.filter(row=>row.split==='development').map(row=>[row.a.family,row.b.family])),heldOut:familyKappa(rows.filter(row=>row.split==='heldOut').map(row=>[row.a.family,row.b.family])),overall:kappa},ignoreCount:ignore,averageAcceptableWidth:Object.fromEntries(Object.keys(width).map(key=>[key,sample[key]?width[key]/sample[key]:null])),disputedBlocks,trustworthy:familyAgreement!==null&&familyAgreement>=0.85&&kappa!==null&&kappa>=0.7}
  await fs.mkdir(path.join(dataRoot(),'labels'),{recursive:true})
  await fs.writeFile(path.join(dataRoot(),'labels','agreement.json'),JSON.stringify(report,null,2)+'\n')
  if(!report.trustworthy){console.error('labels untrustworthy: fix instructions and relabel');process.exitCode=1}
  return report
}
if(require.main===module)main(async()=>{const args=argumentsForPhase2(['--page','--a','--b','--c']);await mergePage(args['--page']||'',args['--a']||'',args['--b']||'',args['--c'])})
