import fs from 'fs'
import path from 'path'

// Guardrail: universal/export layer must not import provider code
// Scans lib/services/export/** for any import paths that include 'lib/providers/' or '/providers/'

function* walk(dir: string): Generator<string> {
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  for (const e of entries) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) yield* walk(p)
    else yield p
  }
}

describe('Provider boundary (universal/export)', () => {
  it('has no imports of lib/providers/**', () => {
    const root = path.resolve(process.cwd(), 'lib', 'services', 'export')
    if (!fs.existsSync(root)) return // nothing to scan in some environments
    const files = Array.from(walk(root)).filter(f => /\.(t|j)sx?$/.test(f))
    const offenders: Array<{ file: string; line: number; text: string }> = []
    const pattern = /(from|require\()\s*['"][^'"]*(?:^|\/)providers\//
    for (const file of files) {
      const content = fs.readFileSync(file, 'utf8').split(/\r?\n/)
      content.forEach((line, i) => {
        if (pattern.test(line)) {
          offenders.push({ file, line: i + 1, text: line.trim() })
        }
      })
    }
    if (offenders.length) {
      const details = offenders.map(o => `${o.file}:${o.line} -> ${o.text}`).join('\n')
      throw new Error(`Provider imports detected in universal/export layer:\n${details}`)
    }
  })
})

