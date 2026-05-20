import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { runEvaluations } from '@/lib/studio/evals/detection/runner'

jest.mock('@/lib/studio/evals/detection/schema', () => {
  const fakeBundle = {
    version: 1,
    generatedAt: new Date().toISOString(),
    components: {
      navbar: {
        canonicalType: 'navbar',
        summary: 'test',
        fields: [],
        propsSource: 'propsMeta'
      }
    },
    integrity: {
      algorithm: 'sha256',
      hash: 'test-hash',
      componentCount: 1
    },
    warnings: []
  }
  return {
    buildDetectionSchemaBundle: jest.fn().mockResolvedValue(fakeBundle),
    validateDetectionComponents: jest.fn().mockReturnValue({
      components: [],
      violations: [],
      warnings: []
    })
  }
})

jest.mock('@/lib/studio/import/detection/prompt-builder', () => ({
  buildDetectionPromptFromCatalog: jest.fn().mockResolvedValue({
    prompt: 'test prompt',
    components: [],
    pageSummary: {}
  })
}))

describe('Detection evaluation runner', () => {
  it('produces evaluation results using recorded fixture', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'detection-report-'))

    const results = await runEvaluations({
      dataset: 'tio',
      caseId: 'home',
      reportDir: tempDir
    })

    expect(results.length).toBeGreaterThan(0)
    const first = results[0]
    expect(first.raw).toBeDefined()
    expect(first.raw.metrics).toBeDefined()
    expect(first.raw.diff).toBeDefined()
    expect(first.normalized).toBeDefined()
    expect(first.normalized?.metrics).toBeDefined()
    expect(Array.isArray(first.importerDiffs)).toBe(true)
    expect(first.outputPath).toBeDefined()
    expect(fs.existsSync(first.outputPath!)).toBe(true)

    const report = JSON.parse(fs.readFileSync(first.outputPath!, 'utf-8'))
    expect(report.cases[0].raw).toBeDefined()
    expect(report.cases[0].normalized).toBeDefined()
    expect(report.cases[0].importerDiffs).toBeDefined()

    fs.rmSync(tempDir, { recursive: true, force: true })
  })
})
