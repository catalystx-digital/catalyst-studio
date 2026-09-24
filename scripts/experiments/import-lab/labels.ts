import fs from 'node:fs/promises'
import path from 'node:path'
import { z } from 'zod'
import { dataRoot, readJson, digest } from './storage'
import type { Region } from './metrics'

export interface Anchor { path: number[]; tag: string; id: string; classes: string[] }
export interface Box { x: number; y: number; width: number; height: number }
export interface Block {
  id: string; order: number; region: Region; anchor: Anchor | null; anchorResolved: boolean
  oversized?: boolean; sourceAnchors?: Anchor[]; box: Box; text: string; images: string[]; links: string[]; headings: string[]
  repeatedChildren: Array<{ signature: string; count: number }>; children: Block[]
}
export interface Proposal {
  version: 1; page: string; snapshotSha256: string; finalUrl: string; javascriptEnabled: boolean
  renderedHeight: number; viewportWidth: number; blocks: Block[]; issues: string[]; status: 'complete' | 'failed'
}
const labelSchema = z.object({
  bestType: z.string().min(1).nullable(), acceptableTypes: z.array(z.string().min(1)),
  containsMultipleComponents: z.boolean(), componentTypes: z.array(z.string().min(1)),
  ignore: z.boolean(), ignoreReason: z.string(),
  expected: z.object({ headings: z.array(z.string().min(1)), itemCount: z.number().int().nonnegative().nullable(), itemKind: z.string().min(1).nullable(), hasImage: z.boolean(), ctaLabels: z.array(z.string().min(1)) }).strict(),
  decorativeImages: z.array(z.string().min(1)).optional(),
  reason: z.string().min(1)
}).strict()
export type Label = z.infer<typeof labelSchema>
const familyLabelSchema=z.object({
  family:z.string().min(1).nullable(),acceptableFamilies:z.array(z.string().min(1)),
  multiple:z.boolean(),familiesInOrder:z.array(z.string().min(1)),
  placement:z.enum(['header','main','sidebar','footer']),ignore:z.boolean(),ignoreReason:z.string(),
  itemCount:z.number().int().nonnegative().nullable(),itemKind:z.string().min(1).nullable().default(null),
  decorativeImages:z.array(z.string().min(1)),reason:z.string().min(1)
}).strict()
export type FamilyLabel=z.infer<typeof familyLabelSchema>
export interface FamilyDraftEntry {blockId:string;draftStatus:'pending'|'complete'|'failed';label:FamilyLabel|null;error?:string;normalised?:string[];evidence?:{detectedCount:number|null;imageGroups:Array<{id:number;addresses:string[];width:number|null;height:number|null;alt:string;kind:string;clonedCarouselCopy?:boolean}>}}
export interface FamilyDraftSheet {version:2;labelPromptVersion?:string;page:string;model:string;familySet:string;familyNames:string[];catalogueSha256:string;snapshotSha256:string;proposalSha256:string;entries:FamilyDraftEntry[]}
export interface Entry { block: Block; status: 'draft' | 'approved' | 'corrected'; label: Label | null; draftStatus: 'complete' | 'failed' | 'dry-run' | 'manual'; reviewedBy?: string; error?: string }
export interface Sheet { version: 1; page: string; snapshotSha256: string; proposalSha256: string; updatedAt: string; entries: Entry[]; issues: string[] }
export function slug(value: string) { if (!/^[a-zA-Z0-9_][a-zA-Z0-9_@.-]{0,239}$/.test(value)) throw new Error('Invalid page or arm name'); return value }
export const labelDirectory = (page: string) => path.join(dataRoot(), 'labels', slug(page))
export const sha = (value: unknown) => digest(JSON.stringify(value))
export async function familyBlockSource(page:string):Promise<Proposal> {
  const directory=labelDirectory(page)
  const proposal=await readJson<Proposal>(path.join(directory,'blocks.json'))
  let sheet:Pick<Sheet,'version'|'page'|'snapshotSha256'|'entries'>|null=null
  try {
    // Drop prior labels as the v1 JSON is decoded; only block boundaries are retained.
    sheet=JSON.parse(await fs.readFile(path.join(directory,'answer-sheet.json'),'utf8'),(key,value)=>key==='label'?undefined:value)
  } catch(error) {if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error}
  if(!sheet)return proposal
  if(sheet.version!==1||sheet.page!==page||sheet.snapshotSha256!==proposal.snapshotSha256||!Array.isArray(sheet.entries))throw new Error('Version-one answer sheet differs from block proposal')
  // Project only source blocks. No prior label, status, reason or reviewer enters the v2 inputs.
  const blocks=sheet.entries.map(entry=>entry.block)
  if(blocks.some(block=>!block||typeof block.id!=='string'))throw new Error('Version-one answer sheet has an invalid block')
  return {...proposal,blocks}
}
export async function catalogue(): Promise<Array<{ type: string; description: string }>> {
  const manifest = await readJson(path.resolve(__dirname, '../../../lib/studio/components/cms/_generated/component-manifest.json'))
  if (!Array.isArray(manifest.components) || manifest.components.some((c: any) => typeof c.type !== 'string' || typeof c.description !== 'string')) throw new Error('Invalid component catalogue')
  const seen = new Set<string>()
  return manifest.components.filter(({type}: {type:string}) => {
    if (seen.has(type)) return false
    seen.add(type)
    return true
  }).map(({type,description}: {type:string;description:string}) => ({type,description}))
}
export function validateLabel(value: unknown, types: string[]): Label {
  const label = labelSchema.parse(value)
  for (const type of [label.bestType, ...label.acceptableTypes, ...label.componentTypes]) if (type !== null && !types.includes(type)) throw new Error('Unknown catalogue type: ' + type)
  if (!label.ignore && (!label.bestType || !label.acceptableTypes.includes(label.bestType))) throw new Error('Choose a best type and include it among acceptable types')
  if (new Set(label.acceptableTypes).size !== label.acceptableTypes.length) throw new Error('Acceptable types must be distinct')
  if (label.ignore && !label.ignoreReason.trim()) throw new Error('Explain why this block should be ignored')
  if (label.containsMultipleComponents !== (label.componentTypes.length >= 2)) throw new Error('Multiple components requires a list of at least two component types; otherwise leave the list empty')
  if (!label.containsMultipleComponents && label.componentTypes.length) throw new Error('Unexpected component types list')
  if (label.expected.itemCount !== null && !label.expected.itemKind) throw new Error('Name the item collection when specifying its count')
  return {...label,acceptableTypes:[...label.acceptableTypes].sort()}
}
export function validateFamilyLabel(value:unknown,families:string[]):FamilyLabel {
  const label=familyLabelSchema.parse(value)
  for(const name of [label.family,...label.acceptableFamilies,...label.familiesInOrder])if(name!==null&&!families.includes(name))throw new Error('Unknown family: '+name)
  if(!label.ignore&&!label.family)throw new Error('Choose a family')
  if(new Set(label.acceptableFamilies).size!==label.acceptableFamilies.length)throw new Error('Acceptable families must be distinct')
  if(label.multiple!==(label.familiesInOrder.length>=2)||(!label.multiple&&label.familiesInOrder.length))throw new Error('Multiple families require at least two families in order')
  if(label.ignore&&!label.ignoreReason.trim())throw new Error('Explain why this block should be ignored')
  if(new Set(label.decorativeImages).size!==label.decorativeImages.length)throw new Error('Decorative images must be distinct')
  return {...label,acceptableFamilies:[...new Set([...label.acceptableFamilies,...(label.family?[label.family]:[])])].sort(),decorativeImages:[...label.decorativeImages].sort()}
}
export function blankLabel(block: Block): Label {
  return {bestType:null, acceptableTypes:[], containsMultipleComponents:false, componentTypes:[], ignore:false, ignoreReason:'', expected:{headings:block.headings,itemCount:null,itemKind:null,hasImage:block.images.length>0,ctaLabels:[]},reason:'Awaiting human review.'}
}
export async function optionalJson<T = any>(file: string): Promise<T | null> {
  try { return await readJson<T>(file) } catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null; throw error }
}
export async function directories(directory: string): Promise<string[]> {
  try { return (await fs.readdir(directory,{withFileTypes:true})).filter(d=>d.isDirectory()).map(d=>d.name).sort() }
  catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []; throw error }
}
export function argumentsForPhase2(allowed: string[], flags: string[] = []) {
  const args: Record<string,string> = {}, argv = process.argv.slice(2)
  for (let i=0; i<argv.length; i++) {
    const key=argv[i]
    if (!allowed.includes(key) || key in args) throw new Error('Unknown or duplicate argument: '+key)
    if (flags.includes(key)) args[key]='true'
    else { if (!argv[i+1] || argv[i+1].startsWith('--')) throw new Error('Missing value: '+key); args[key]=argv[++i] }
  }
  return args
}
export async function atomicJson(file: string, value: unknown, backup = false) {
  await fs.mkdir(path.dirname(file),{recursive:true})
  const stamp = new Date().toISOString().replace(/[:.]/g,'-')+'-'+crypto.randomUUID()
  const temporary=file+'.'+stamp+'.tmp'
  await fs.writeFile(temporary,JSON.stringify(value,null,2)+'\n',{flag:'wx'})
  try {
    if (backup) { try { await fs.copyFile(file,file+'.'+stamp+'.bak') } catch(error) { if ((error as NodeJS.ErrnoException).code!=='ENOENT') throw error } }
    await fs.rename(temporary,file)
  } catch(error) { await fs.unlink(temporary); throw error }
}
