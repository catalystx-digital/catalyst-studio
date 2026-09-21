import fs from 'node:fs/promises'
import path from 'node:path'
import { createHash } from 'node:crypto'
import type { FetchOutlineResult, GetSectionResult } from '@/lib/studio/import/services/web-tools'

export interface Snapshot {
  manifest: { version: 1; url: string; finalUrl: string; fetchedAt: string; sha256: string; sectionKeys: string[]; bytes: Record<string, number>; stylesheetUrls?: string[] }
  html: string
  outline: FetchOutlineResult
  sections: Record<string, GetSectionResult>
  models: { data: Array<Record<string, unknown>> }
  stylesheets: string[]
}
export const dataRoot = () => path.resolve(process.env.IMPORT_LAB_ROOT || '.import-lab')
export function identifier(value: string): string {
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_@.-]{0,239}$/.test(value)) throw new Error('Invalid page or run identifier')
  return value
}
export const digest = (value: string) => createHash('sha256').update(value).digest('hex')
export function pageSlug(raw: string): string {
  const url = new URL(raw)
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error('Expected an HTTP(S) URL without credentials')
  return (url.hostname + url.pathname).replace(/[^a-z0-9]+/gi, '-').slice(0,70).replace(/-$/, '') + '-' + digest(raw).slice(0,16)
}
export const pageDirectory = (page: string) => path.join(dataRoot(), 'pages', identifier(page))
export const runDirectory = (page: string, run: string) => path.join(dataRoot(), 'runs', identifier(page), identifier(run))
const pendingWrites = new Map<string, Promise<void>>()
export async function writeJson(file: string, data: unknown) {
  const text = JSON.stringify(data, null, 2) + '\n'
  const task = (pendingWrites.get(file) || Promise.resolve()).then(async () => {
    await fs.mkdir(path.dirname(file), { recursive: true })
    await fs.writeFile(file, text)
  })
  pendingWrites.set(file, task)
  try { await task } finally { if (pendingWrites.get(file) === task) pendingWrites.delete(file) }
}
export async function readJson<T = any>(file: string): Promise<T> { return JSON.parse(await fs.readFile(file, 'utf8')) }
export async function saveSnapshot(directory: string, snapshot: Snapshot) {
  await fs.mkdir(directory, { recursive: true })
  await fs.writeFile(path.join(directory, 'page.html'), snapshot.html)
  for (const key of ['outline', 'sections', 'models', 'stylesheets', 'manifest'] as const) await writeJson(path.join(directory, key + '.json'), snapshot[key])
}
export async function loadSnapshot(page: string): Promise<Snapshot> {
  const directory = pageDirectory(page)
  const [manifest, html, outline, sections, models, stylesheets] = await Promise.all([
    readJson<Snapshot['manifest']>(path.join(directory, 'manifest.json')), fs.readFile(path.join(directory, 'page.html'), 'utf8'),
    readJson(path.join(directory, 'outline.json')), readJson(path.join(directory, 'sections.json')),
    readJson(path.join(directory, 'models.json')), readJson<string[]>(path.join(directory, 'stylesheets.json'))
  ])
  if (manifest.version !== 1 || manifest.sha256 !== digest(html)) throw new Error('Snapshot version or HTML checksum mismatch')
  if (JSON.stringify(manifest.sectionKeys) !== JSON.stringify((outline.sections || []).map((s: {key: string}) => s.key))) throw new Error('Snapshot section manifest mismatch')
  for (const key of manifest.sectionKeys) if (!sections[key] || sections[key].key !== key || sections[key].handle !== outline.handle) throw new Error('Missing or inconsistent section: ' + key)
  return { manifest, html, outline, sections, models, stylesheets }
}
export function argumentsForRun(argv = process.argv.slice(2)) {
  const allowed = new Set(['--page', '--run', '--max-sections', '--dry-run'])
  const values: Record<string, string> = {}
  for (let i=0; i<argv.length; i++) {
    const key = argv[i]
    if (!allowed.has(key) || values[key]) throw new Error('Unknown or duplicate argument: ' + key)
    if (key === '--dry-run') values[key] = 'true'
    else { if (!argv[i+1] || argv[i+1].startsWith('--')) throw new Error('Missing value: ' + key); values[key] = argv[++i] }
  }
  const page = identifier(values['--page'] || ''), run = identifier(values['--run'] || '')
  const maxSections = values['--max-sections'] === undefined ? undefined : Number(values['--max-sections'])
  if (maxSections !== undefined && (!Number.isSafeInteger(maxSections) || maxSections < 1)) throw new Error('--max-sections must be a positive integer')
  return { page, run, maxSections, dryRun: values['--dry-run'] === 'true' }
}
export function errorRecord(error: unknown) {
  return error instanceof Error ? { name: error.name, message: error.message, ...('debug' in error ? {debug: error.debug} : {}) } : { message: String(error) }
}
export function main(action: () => Promise<void>) { action().catch(error => { console.error(errorRecord(error)); process.exitCode = 1 }) }
