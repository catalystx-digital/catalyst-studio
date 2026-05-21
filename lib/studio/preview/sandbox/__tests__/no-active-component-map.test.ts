import { readFileSync } from 'node:fs'
import path from 'node:path'

describe('sandbox active rendering path', () => {
  it('does not keep a hard-coded component import map in sandbox-manager', () => {
    const source = readFileSync(
      path.join(process.cwd(), 'lib/studio/preview/sandbox/sandbox-manager.ts'),
      'utf8'
    )

    expect(source).not.toContain('getComponentImportPath')
    expect(source).not.toContain('componentMap')
    expect(source).not.toContain("app/preview/page.tsx")
  })
})
