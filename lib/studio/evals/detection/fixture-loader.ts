import fs from 'node:fs/promises'
import path from 'node:path'

import type {
  EvalFixture,
  EvalFixtureContext,
  NormalizedDetectionOutput,
  RawDetectionOutput
} from './types'

async function readJsonFile<T>(filePath: string): Promise<T> {
  const content = await fs.readFile(filePath, 'utf-8')
  return JSON.parse(content) as T
}

async function readOptionalJsonFile<T>(filePath: string): Promise<T | undefined> {
  try {
    return await readJsonFile<T>(filePath)
  } catch (error: any) {
    if (error && error.code === 'ENOENT') {
      return undefined
    }
    throw error
  }
}

async function readOptionalTextFile(filePath: string): Promise<string | undefined> {
  try {
    return await fs.readFile(filePath, 'utf-8')
  } catch (error: any) {
    if (error && error.code === 'ENOENT') {
      return undefined
    }
    throw error
  }
}

export interface DiscoverFixturesOptions {
  dataset?: string
  caseId?: string
  rootDir?: string
}

export async function discoverFixtures(options: DiscoverFixturesOptions = {}): Promise<EvalFixture[]> {
  const root = options.rootDir || path.resolve(process.cwd(), 'prompts', 'evals')
  const entries = await fs.readdir(root)

  const fixtures: EvalFixture[] = []

  for (const dataset of entries) {
    if (options.dataset && options.dataset !== dataset) continue
    const datasetDir = path.join(root, dataset)
    const stats = await fs.stat(datasetDir)
    if (!stats.isDirectory()) continue

    const cases = await fs.readdir(datasetDir)
    for (const caseId of cases) {
      if (options.caseId && options.caseId !== caseId) continue
      const caseDir = path.join(datasetDir, caseId)
      const caseStats = await fs.stat(caseDir)
      if (!caseStats.isDirectory()) continue
      fixtures.push(await loadFixture(dataset, caseId, caseDir))
    }
  }

  fixtures.sort((a, b) => {
    if (a.dataset !== b.dataset) return a.dataset.localeCompare(b.dataset)
    return a.caseId.localeCompare(b.caseId)
  })

  return fixtures
}

async function loadFixture(dataset: string, caseId: string, caseDir: string): Promise<EvalFixture> {
  const context = await readJsonFile<EvalFixtureContext>(path.join(caseDir, 'context.json'))
  const expected = await readJsonFile<NormalizedDetectionOutput>(path.join(caseDir, 'expected.json'))
  const raw = await readOptionalJsonFile<RawDetectionOutput>(path.join(caseDir, 'raw.json'))
  const assets = await readOptionalJsonFile<Record<string, unknown>>(path.join(caseDir, 'assets.json'))
  const domHtml = await readOptionalTextFile(path.join(caseDir, 'dom.html'))

  return {
    dataset,
    caseId,
    rootDir: caseDir,
    context,
    expected,
    raw,
    assets,
    domHtml
  }
}

