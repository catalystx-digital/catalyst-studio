import fs from 'node:fs/promises'
import path from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { dataRoot, readJson } from './storage'
import { validatePages } from './pages'

const exec=promisify(execFile)
const GENERIC=new Set(['www','com','org','net','gov','edu','html','info','shop','site'])
export interface LeakHit {file:string;line:number;part:string}

export function hostnameParts(hostnames:string[]) {
  return [...new Set(hostnames.flatMap(host=>host.toLowerCase().split(/[.-]/).filter(part=>part.length>=4&&!GENERIC.has(part))))].sort()
}
function hits(line:string,file:string,lineNumber:number,parts:string[]):LeakHit[] {
  return parts.filter(part=>new RegExp(`(^|[^A-Za-z0-9_])${part.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}($|[^A-Za-z0-9_])`,'i').test(line)).map(part=>({file,line:lineNumber,part}))
}
export function scanAddedLines(diff:string,parts:string[]):LeakHit[] {
  let file='',lineNumber=0,inHunk=false;const found:LeakHit[]=[]
  for(const line of diff.split(/\r?\n/)){
    if(line.startsWith('diff --git ')){inHunk=false;continue}
    if(line.startsWith('@@')){const match=/\+(\d+)/.exec(line);if(match)lineNumber=Number(match[1]);inHunk=true;continue}
    if(!inHunk){if(line.startsWith('+++ b/'))file=line.slice(6);continue}
    if(line.startsWith('+')){found.push(...hits(line.slice(1),file,lineNumber,parts));lineNumber++}
    else if(line.startsWith(' '))lineNumber++
  }
  return found
}
export async function checkLeaks(roots:string[]=[dataRoot()],cwd=process.cwd()) {
  const hostnames:string[]=[]
  for(const root of roots){
    const pages=validatePages(await readJson(path.join(root,'pages.json')))
    for(const page of Object.values(pages))hostnames.push(new URL(page.url).hostname)
  }
  const parts=hostnameParts(hostnames)
  const [committed,working,untracked]=await Promise.all([
    exec('git',['diff','--unified=0','origin/main...HEAD'],{cwd,maxBuffer:32*1024*1024}),
    exec('git',['diff','--unified=0','HEAD'],{cwd,maxBuffer:32*1024*1024}),
    exec('git',['ls-files','--others','--exclude-standard','-z'],{cwd,maxBuffer:32*1024*1024})
  ])
  const found=[...scanAddedLines(committed.stdout,parts),...scanAddedLines(working.stdout,parts)]
  for(const file of untracked.stdout.split('\0').filter(Boolean)){
    const content=await fs.readFile(path.join(cwd,file),'utf8')
    if(content.includes('\0'))continue
    content.split(/\r?\n/).forEach((line,index)=>found.push(...hits(line,file,index+1,parts)))
  }
  const unique=[...new Map(found.map(hit=>[`${hit.file}:${hit.line}:${hit.part}`,hit])).values()].sort((a,b)=>a.file.localeCompare(b.file)||a.line-b.line||a.part.localeCompare(b.part))
  for(const hit of unique)console.log(`${hit.file}:${hit.line}: ${hit.part}`)
  if(!unique.length)console.log('No site names found')
  return unique.length?1:0
}
