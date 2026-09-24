/** @jest-environment node */
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { spawnSync } from 'node:child_process'
import { parseEval, planEvaluation } from './eval'
import { armLabel } from './summary'

test.each(['complete', 'failure', 'retry', 'dry'])('production arm records %s with fake clients', mode => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'import-lab-production-'))
  try {
    const result = spawnSync(process.execPath, ['--import', 'tsx', path.join(__dirname, 'production-fixtures.ts'), mode], { cwd: path.resolve(__dirname, '../../..'), windowsHide: true, encoding: 'utf8', maxBuffer: 8000000, timeout: 45000, env: { ...process.env, NODE_OPTIONS: '--require=' + JSON.stringify(path.join(__dirname, 'offline-guard.cjs')), IMPORT_MODEL_CHAIN: 'offline/fixture-model', IMPORT_LAB_ROOT: directory } })
    if (result.status !== 0) throw new Error(result.stdout + '\n' + result.stderr)
    expect(result.stdout).toContain('PASS production ' + mode)
  } finally { fs.rmSync(directory, { recursive: true, force: true }) }
}, 50000)

test('evaluation accepts production and labels retired arms without losing their history', async () => {
  const options = parseEval(['arms', '--arms', 'blocks-production', '--run', 'm3-r1', '--dry-run'])
  const tasks = await planEvaluation(options, { garden: { url: 'https://example.com/', kind: 'home', siteKind:'saas', heldOut: false, renderWithJavaScript: true, notes: '' } })
  expect(tasks[0]).toMatchObject({ paid: true, internet: true, script: 'run-arm.ts' })
  expect(tasks[0].args).toContain('blocks-production')
  expect(armLabel('blocks-production')).toBe('blocks-production')
  for (const arm of ['oracle-blocks', 'oracle-type-today-rules', 'jev-then-llm-blocks']) {
    expect(() => parseEval(['arms', '--arms', arm, '--run', 'r1'])).toThrow('Unknown arm')
    expect(armLabel(arm)).toContain('arm removed from the tool')
  }
})
