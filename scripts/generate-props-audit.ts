#!/usr/bin/env node
/*
  Scans registered CMS components and prints a PropsMeta audit report.
  Usage: node scripts/generate-props-audit.ts > docs/optimizely-propsmeta-audit.md
*/

import { initializeCMSComponents } from '@/lib/studio/components/cms/_factory/initialize'
import { cmsComponentFactory } from '@/lib/studio/components/cms/_factory/factory'

function normalizeType(raw?: string): string {
  const s = (raw || '').trim().toLowerCase()
  if (s === 'content[]' || s === 'contentreference[]' || /array\s*<\s*content\s*>/.test(s)) return 'array(content)'
  if (/^array\s*<.*>$/i.test(raw || '') || /\[\s*\]$/.test(s) || s.includes('array')) return 'array'
  if (s === 'contentreference' || s === 'reference' || s === 'content') return 'reference'
  if (s.startsWith('{') || s.includes('object') || /\{\s*[^}]+\s*\}/.test(raw || '')) return 'string(object)'
  if (s.includes('html') || s === 'richtext' || s === 'xhtml') return 'richText'
  if (s === 'bool' || s === 'boolean') return 'boolean'
  if (['media','image','file','asset'].some(k => s.includes(k))) return 'media'
  if (s.startsWith('number') || ['integer','float','decimal'].includes(s)) return 'number'
  if (s === 'url' || s === 'link') return 'url'
  return 'string'
}

function isContentAreaName(name: string): boolean {
  const low = name.toLowerCase()
  return low === 'components' || low === 'leftcolumn' || low === 'rightcolumn'
}

async function main() {
  await initializeCMSComponents()
  const catalog = cmsComponentFactory.getComponentCatalog()
  const types = Array.from(catalog.keys())
  const lines: string[] = []
  lines.push('# PropsMeta Audit')
  lines.push('')
  lines.push(`Components scanned: ${types.length}`)
  lines.push('')

  for (const t of types) {
    const entry: any = catalog.get(t as any)
    const propsMeta = entry?.propsMeta || {}
    lines.push(`## ${t}`)
    if (!propsMeta || Object.keys(propsMeta).length === 0) {
      lines.push('- No propsMeta found')
      lines.push('')
      continue
    }
    for (const [name, meta] of Object.entries<any>(propsMeta)) {
      const raw = meta?.type as string | undefined
      const type = normalizeType(raw)
      const required = !!meta?.required
      const contentArea = type.startsWith('array') && isContentAreaName(name)
      const flags: string[] = []
      if (type === 'array' && !contentArea) flags.push('config-array')
      if (type === 'array(content)') flags.push('content-array')
      if (type === 'reference') flags.push('content-reference')
      if (type === 'media' && raw && raw.includes('{')) flags.push('check:object-with-media-key')
      lines.push(`- ${name}: raw="${raw}" → ${type}${required ? ' (required)' : ''}${flags.length ? ' ['+flags.join(', ')+']' : ''}`)
    }
    lines.push('')
  }

  process.stdout.write(lines.join('\n'))
}

// eslint-disable-next-line @typescript-eslint/no-floating-promises
main()

