import { acceptableFamilies, familyPick, type FamilySet } from './families'
import type { Sheet } from './labels'

export interface Pick {blockId:string; order:number; distribution:Record<string,number>; ranked:Array<{type:string;probability:number}>; multipleProbability:number; allowedTypes:string[]; branch:string; issues:string[]}
function probability(value:unknown):value is number {return typeof value==='number'&&Number.isFinite(value)&&value>=0&&value<=1}
export function probabilityBand(p:number) {if(!probability(p))throw new Error('Invalid probability');return Math.min(4,Math.floor(p*5))}
export function scorePicks(sheet:Sheet,picks:Pick[],options:{families?:FamilySet;postHoc?:boolean}={}) {
  const rows:any[]=[],excluded:any[]=[]
  for(const entry of sheet.entries){
    if(entry.status==='draft'||!entry.label){excluded.push({blockId:entry.block.id,reason:'unreviewed'});continue}
    if(entry.label.ignore){excluded.push({blockId:entry.block.id,reason:'ignored label has no required component type'});continue}
    const saved=picks.find(p=>p.blockId===entry.block.id)
    const pick=saved&&options.families&&options.postHoc?familyPick(saved,options.families):saved
    if(!pick){excluded.push({blockId:entry.block.id,reason:'decision call failed or missing'});continue}
    const acceptable=options.families?acceptableFamilies(entry.label.acceptableTypes,options.families):entry.label.acceptableTypes
    rows.push({blockId:entry.block.id,answer:acceptable,pick:pick.ranked[0].type,probability:pick.ranked[0].probability,top1:acceptable.includes(pick.ranked[0].type),top3:pick.ranked.slice(0,3).some(r=>acceptable.includes(r.type)),reviewedBy:entry.reviewedBy||'unknown'})
  }
  return {rows,excluded,top1:rows.filter(r=>r.top1).length,top3:rows.filter(r=>r.top3).length,count:rows.length,bands:Array.from({length:5},(_,i)=>{const group=rows.filter(r=>probabilityBand(r.probability)===i);return {band:(i/5).toFixed(1)+'–'+((i+1)/5).toFixed(1)+(i===4?' inclusive':' exclusive upper'),count:group.length,acceptable:group.filter(r=>r.top1).length}}),confusions:rows.filter(r=>!r.top1)}
}
