import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { runEvaluations } from '@/lib/studio/evals/detection/runner'

jest.mock('@/lib/studio/evals/detection/schema', () => {
  const actual = jest.requireActual('@/lib/studio/evals/detection/schema')
  const fakeBundle = {
    version: 1,
    generatedAt: new Date().toISOString(),
    components: {
      'hero-banner': {
        canonicalType: 'hero-banner',
        summary: 'test hero',
        fields: [
          { name: 'summary', type: 'string', required: true },
          { name: 'heading', type: 'string', required: false }
        ],
        propsSource: 'propsMeta'
      },
      navbar: {
        canonicalType: 'navbar',
        summary: 'test navbar',
        fields: [
          {
            name: 'menuItems',
            type: 'array',
            required: true,
            allowedTypes: ['nav-menu-item'],
            items: { kind: 'component', allowedTypes: ['nav-menu-item'] }
          }
        ],
        propsSource: 'propsMeta'
      },
      'nav-menu-item': {
        canonicalType: 'nav-menu-item',
        summary: 'menu item',
        fields: [
          { name: 'label', type: 'string', required: true },
          { name: 'href', type: 'string', required: false }
        ],
        propsSource: 'propsMeta'
      }
    },
    integrity: {
      algorithm: 'sha256',
      hash: 'test-hash',
      componentCount: 3
    },
    warnings: []
  }
  return {
    ...actual,
    buildDetectionSchemaBundle: jest.fn().mockResolvedValue(fakeBundle)
  }
})

jest.mock('@/lib/studio/import/detection/prompt-builder', () => ({
  buildDetectionPromptFromCatalog: jest.fn().mockResolvedValue({
    prompt: 'test prompt',
    components: [],
    pageSummary: {}
  })
}))

jest.mock('@/lib/studio/import/services/page-builder/component-builder', () => ({
  ComponentBuilder: class {
    mapToComponentInstances(detectionResults: any[]) {
      return detectionResults.map(result => ({
        type: result.type,
        confidence: result.confidence,
        props: {
          content: result.content,
          metadata: { region: result.content?.region },
          region: result.content?.region
        }
      }))
    }
  }
}))

const fixtureRawPath = path.join(process.cwd(), 'prompts', 'evals', 'tio', 'home', 'raw.json')

function createTempRaw(mutator: (raw: any) => void): { dir: string; path: string } {
  const raw = JSON.parse(fs.readFileSync(fixtureRawPath, 'utf-8'))
  mutator(raw)
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'detection-raw-'))
  const tempPath = path.join(tempDir, 'raw.json')
  fs.writeFileSync(tempPath, JSON.stringify(raw, null, 2))
  return { dir: tempDir, path: tempPath }
}

describe('raw detection validation', () => {
  const tempDirs: string[] = []

  afterEach(() => {
    while (tempDirs.length > 0) {
      const dir = tempDirs.pop()
      if (!dir) continue
      try {
        fs.rmSync(dir, { recursive: true, force: true })
      } catch {
        // ignore cleanup errors
      }
    }
  })

  it('reports missing component types in raw payloads', async () => {
    const temp = createTempRaw(raw => {
      if (Array.isArray(raw.components) && raw.components.length > 0) {
        raw.components[0][0] = ''
      }
    })
    tempDirs.push(temp.dir)

    const [result] = await runEvaluations({
      dataset: 'tio',
      caseId: 'home',
      responsePath: temp.path,
      rawOnly: true
    })

    const codes = result.raw.violations.map(v => v.code)
    expect(codes).toContain('structure.missing_type')
  })

  it('reports disallowed subcomponent types before importer normalization', async () => {
    const temp = createTempRaw(raw => {
      const navbar = raw.components.find((tuple: any[]) => tuple[0] === 'navbar')
      if (navbar && navbar[2]?.menuItems && Array.isArray(navbar[2].menuItems)) {
        navbar[2].menuItems.push({
          type: 'unsupported-item',
          label: 'Invalid entry',
          href: '#'
        })
      }
    })
    tempDirs.push(temp.dir)

    const [result] = await runEvaluations({
      dataset: 'tio',
      caseId: 'home',
      responsePath: temp.path,
      rawOnly: true
    })

    const codes = result.raw.violations.map(v => v.code)
    expect(codes).toContain('component_array.disallowed_type')
  })
})
