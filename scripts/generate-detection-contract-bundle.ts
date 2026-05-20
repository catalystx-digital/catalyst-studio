#!/usr/bin/env tsx

import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'

import { buildPromptContractBundle } from '@/lib/studio/ai/prompt-contract-builder'

async function main(): Promise<void> {
  const bundle = await buildPromptContractBundle({ forceRefresh: true })
  const outputPath = resolve(process.cwd(), 'reports/detection/contract-bundle.json')
  await mkdir(dirname(outputPath), { recursive: true })
  await writeFile(outputPath, JSON.stringify(bundle, null, 2))
  console.log(`[contract-bundle] wrote ${outputPath} (hash=${bundle.hash})`)
}

main().catch(error => {
  console.error('[contract-bundle] failed to generate bundle:', error)
  process.exit(1)
})

