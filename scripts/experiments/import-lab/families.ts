import path from 'node:path'
import { dataRoot, readJson } from './storage'
import { sha } from './labels'
import { runtimeRequire } from './runtime'
import type { Pick } from './pick-score'

export interface FamilyOptions { families?: string; familySet?: string }
export interface FamilySet { set: string; sha256: string; entries: Array<{type:string;description:string;types:string[]}>; byType: Record<string,string> }
export const foldedFamilies=['stats','testimonials','pricing','logo-strip'] as const
export const foldFamily=(name:string)=>foldedFamilies.includes(name as typeof foldedFamilies[number])?'collection':name
export function labelForFamilySet<T extends {family?:string|null;acceptableFamilies?:string[];familiesInOrder?:string[]}>(label:T,set:string):T {
  if(set!=='D')return label
  return {...label,family:label.family==null?label.family:foldFamily(label.family),acceptableFamilies:label.acceptableFamilies?.map(foldFamily),familiesInOrder:label.familiesInOrder?.map(foldFamily)}
}
export function validateFamilyOptions(options:FamilyOptions) {
  if(Boolean(options.families)!==Boolean(options.familySet))throw new Error('Use --families and --family-set together')
  if(options.familySet&&!/^[A-Za-z][A-Za-z0-9_-]*$/.test(options.familySet))throw new Error('Invalid family set name')
}
export function validateFamilies(value:unknown,types:string[]):Record<string,FamilySet> {
  const sets=(value as any)?.sets, result:Record<string,FamilySet>={}
  if(!sets||typeof sets!=='object'||Array.isArray(sets)||!Object.keys(sets).length)throw new Error('Family file needs named sets')
  for(const set of Object.keys(sets)){
    const families=sets[set],byType:Record<string,string>={},entries:FamilySet['entries']=[],duplicates=new Set<string>(),unknown=new Set<string>()
    if(!families||typeof families!=='object'||Array.isArray(families)||!Object.keys(families).length)throw new Error('Missing family set '+set)
    for(const [name,raw] of Object.entries(families)){
      const family=raw as any
      if(!/^[a-z][a-z0-9-]*$/.test(name)||typeof family?.description!=='string'||!family.description.trim()||!Array.isArray(family.types)||!family.types.length||family.types.some((t:unknown)=>typeof t!=='string'))throw new Error('Invalid family '+set+'/'+name)
      for(const type of family.types){if(Object.hasOwn(byType,type))duplicates.add(type);if(!types.includes(type))unknown.add(type);byType[type]=name}
      entries.push({type:name,description:family.description,types:[...family.types]})
    }
    const missing=types.filter(t=>!Object.hasOwn(byType,t))
    if(duplicates.size||unknown.size||missing.length)throw new Error('Invalid family set '+set+': duplicate types ['+[...duplicates].sort().join(', ')+']; missing types ['+missing.sort().join(', ')+']; unknown types ['+[...unknown].sort().join(', ')+']')
    result[set]={set,sha256:sha(families),entries,byType}
  }
  return result
}
export async function loadFamilies(file:string,set:string):Promise<FamilySet> {
  validateFamilyOptions({families:file,familySet:set})
  await runtimeRequire('@/lib/studio/components/cms/_factory/initialize').initializeCMSComponents()
  const {blockCatalogue}=await import('./jev-pick')
  const found=validateFamilies(await readJson(path.resolve(file)),(await blockCatalogue()).entries.map(c=>c.type))[set]
  if(!found)throw new Error('Missing family set '+set)
  return found
}
export function familyOf(type:string,families:FamilySet) {
  if(!Object.hasOwn(families.byType,type))throw new Error('Unknown catalogue type in family set '+families.set+': '+type)
  return families.byType[type]
}
export function acceptableFamilies(types:string[],families:FamilySet) {return [...new Set(types.map(t=>familyOf(t,families)))]}
export function familyPick(pick:Pick,families:FamilySet):Pick {
  const distribution:Record<string,number>=Object.fromEntries(families.entries.map(f=>[f.type,0]))
  for(const [type,p] of Object.entries(pick.distribution)){
    if(!Number.isFinite(p)||p<0||p>1)throw new Error('Invalid saved type probability: '+type)
    distribution[familyOf(type,families)]+=p
  }
  const missing=Object.keys(families.byType).filter(t=>!Object.hasOwn(pick.distribution,t))
  if(missing.length)throw new Error('Saved distribution missing types: '+missing.join(', '))
  const sum=Object.values(distribution).reduce((n,p)=>n+p,0)
  if(Math.abs(sum-1)>0.02)throw new Error('Saved probabilities do not sum to one: '+sum)
  const ranked=Object.entries(distribution).map(([type,probability])=>({type,probability})).sort((a,b)=>b.probability-a.probability||a.type.localeCompare(b.type))
  return {...pick,distribution,ranked,allowedTypes:acceptableFamilies(pick.allowedTypes,families)}
}
export const familyOutputRoot=()=>path.resolve(process.env.IMPORT_LAB_OUTPUT_ROOT||dataRoot())
export function scoreDirectory(page:string,options:FamilyOptions={}) {
  validateFamilyOptions(options)
  return path.join(options.families?familyOutputRoot():dataRoot(),'labels',page,options.families?'scores-family-'+options.familySet:'scores')
}
