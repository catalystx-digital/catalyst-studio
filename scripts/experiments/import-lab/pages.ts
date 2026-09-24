import fs from 'node:fs/promises'
import path from 'node:path'
import { dataRoot, readJson, identifier, main, pageSlug } from './storage'
import { directories, optionalJson, atomicJson, argumentsForPhase2 } from './labels'
const pageKinds = ['home','landing','article','listing','form','other'] as const
export const siteKinds = ['saas','shop','hospitality-local','professional-services','government','health','education','charity','magazine-news','docs-portfolio-events'] as const
interface PageEntry { url: string; kind: typeof pageKinds[number]; siteKind: typeof siteKinds[number]; heldOut: boolean; renderWithJavaScript: boolean; notes: string }
export type PageManifest = Record<string, PageEntry>
export function validatePages(value: unknown): PageManifest {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('pages.json must map page slugs to page settings')
  for (const [slug, entry] of Object.entries(value)) {
    identifier(slug)
    if (!entry || typeof entry !== 'object') throw new Error('Invalid page settings: ' + slug)
    const p = entry as PageEntry, url = new URL(p.url)
    if (!['http:','https:'].includes(url.protocol) || url.username || url.password || !pageKinds.includes(p.kind) || !siteKinds.includes(p.siteKind) || typeof p.heldOut !== 'boolean' || typeof p.renderWithJavaScript !== 'boolean' || typeof p.notes !== 'string') throw new Error('Invalid page settings: ' + slug)
  }
  return value as PageManifest
}
export async function loadPages(required = true): Promise<PageManifest> {
  const value = await optionalJson(path.join(dataRoot(), 'pages.json'))
  if (!value && required) throw new Error('Create pages.json first: run pages.ts --init, then check page kinds and held-out settings')
  return value ? validatePages(value) : {}
}
export async function initializePages() {
  const pages: PageManifest = {}
  for (const slug of await directories(path.join(dataRoot(), 'pages'))) {
    const manifest = await readJson(path.join(dataRoot(), 'pages', slug, 'manifest.json'))
    const proposal = await optionalJson(path.join(dataRoot(), 'labels', slug, 'blocks.json'))
    pages[slug] = {url: manifest.url, kind: new URL(manifest.url).pathname === '/' ? 'home' : 'other', heldOut: false,
      renderWithJavaScript: proposal?.javascriptEnabled ?? true, notes: 'Set site kind and check held-out setting before use.'} as PageEntry
  }
  await fs.mkdir(dataRoot(), {recursive: true})
  await fs.writeFile(path.join(dataRoot(), 'pages.json'), JSON.stringify(pages, null, 2) + '\n', {flag: 'wx'})
  return pages
}
async function addPage(entry: PageEntry) {
  const page=pageSlug(entry.url), pages=await loadPages(false)
  validatePages({[page]:entry})
  if(pages[page])throw new Error('Page already exists in pages.json: '+page)
  await atomicJson(path.join(dataRoot(),'pages.json'),{...pages,[page]:entry},true)
  return page
}
export async function setSiteKind(page:string,kind:string) {
  identifier(page)
  if (!siteKinds.includes(kind as PageEntry['siteKind'])) throw new Error('Unknown site kind: '+kind)
  const file=path.join(dataRoot(),'pages.json'),pages=await readJson<Record<string,PageEntry>>(file)
  if (!pages[page]) throw new Error('Page not found: '+page)
  const updated={...pages,[page]:{...pages[page],siteKind:kind as PageEntry['siteKind']}}
  validatePages({[page]:updated[page]})
  await atomicJson(file,updated,true)
}
if (require.main === module) main(async () => {
  if(process.argv[2]==='--set-site-kind') {
    if(process.argv.length!==5)throw new Error('--set-site-kind needs <page> <kind>')
    await setSiteKind(process.argv[3],process.argv[4]);console.log('Set site kind for '+process.argv[3]);return
  }
  const args=argumentsForPhase2(['--init','--add','--kind','--site-kind','--set-site-kind','--held-out','--no-js','--notes'],['--init','--held-out','--no-js'])
  if(args['--init']) {
    if(Object.keys(args).length!==1)throw new Error('--init cannot be combined with other options')
    console.log('Created pages.json for '+Object.keys(await initializePages()).length+' pages; check its settings before use.')
  } else if(args['--add']) {
    if(!args['--site-kind'])throw new Error('--add requires --site-kind')
    console.log('Added '+await addPage({url:args['--add'],kind:(args['--kind']||'other') as PageEntry['kind'],siteKind:args['--site-kind'] as PageEntry['siteKind'],heldOut:!!args['--held-out'],renderWithJavaScript:!args['--no-js'],notes:args['--notes']||''}))
  } else throw new Error('Use pages.ts --init, --add <url> --site-kind <kind>, or --set-site-kind <page> <kind>')
})
