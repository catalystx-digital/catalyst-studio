import fs from 'node:fs/promises'
import path from 'node:path'
import { dataRoot, writeJson, digest, errorRecord, main } from './storage'
import { argumentsForPhase2, slug } from './labels'
import { validateFamilyOptions, type FamilyOptions } from './families'
import { captureConsole, runtimeRequire } from './runtime'
import { runProductionBlocks, type RunFixtures } from './blocks-production'
import { runPick } from './jev-pick'

export const ARMS = ['blocks-production', 'jev-pick'] as const
interface RunOptions extends FamilyOptions { page: string; run: string; arm: string; dryRun: boolean }
export async function runArm(options: RunOptions, fixtures?: RunFixtures) {
  validateFamilyOptions(options)
  if (!ARMS.includes(options.arm as typeof ARMS[number])) throw new Error('Unknown arm: ' + options.arm)
  if (options.families && options.arm !== 'jev-pick') throw new Error('Family picking applies only to jev-pick')
  const arm = options.families ? 'jev-pick@families-' + options.familySet : options.arm
  const directory = path.join(dataRoot(), 'arms', slug(options.page), slug(arm), slug(options.run))
  await fs.mkdir(path.dirname(directory), { recursive: true })
  await fs.mkdir(directory)
  await fs.mkdir(path.join(directory, 'calls'))
  await writeJson(path.join(directory, 'components.json'), [])
  const started = performance.now(), events: unknown[] = []
  const restoreConsole = captureConsole(events)
  const record: any = { version: 1, page: options.page, arm, baseArm: options.arm, runId: options.run, status: 'started', createdAt: new Date().toISOString(), fixture: !!fixtures, failures: [], issues: [], callCount: 0, plannedCallCount: 0, failedCalls: 0 }
  try {
    if (options.arm === 'blocks-production') await runProductionBlocks(options.page, directory, options.dryRun, record, fixtures)
    else await runPick(options.page, directory, options.dryRun, record, options, fixtures)
  } catch (error) { record.status = 'failed'; record.failures.push({ stage: 'run', ...errorRecord(error) }) }
  finally {
    restoreConsole()
    const sources = Object.keys(runtimeRequire.cache).filter(file => /[/\\]lib[/\\]studio[/\\]/.test(file) && /\.[cm]?[jt]sx?$/.test(file)).sort()
    const hashes = await Promise.all(sources.map(async file => [path.relative(process.cwd(), file), digest(await fs.readFile(file, 'utf8'))]))
    record.codeSha256 = digest(JSON.stringify(hashes))
    record.comparisonKey = digest(JSON.stringify({ snapshot: record.snapshotInputsSha256 ?? record.snapshotSha256, models: record.models, rules: record.rules, configuration: record.configurationSha256, families: record.families?.sha256, code: record.codeSha256 }))
    record.wallClockSeconds = (performance.now() - started) / 1000
    await writeJson(path.join(directory, 'events.json'), events)
    await writeJson(path.join(directory, 'run.json'), record)
  }
  console.log(arm + '/' + options.run + ': ' + record.status + '; ' + record.callCount + ' calls, ' + record.plannedCallCount + ' planned, ' + (record.retryCount === undefined ? '' : record.retryCount + ' retries, ') + record.failures.length + ' failures')
  return record
}
export async function armCLI(fixedArm?: string) {
  const args = argumentsForPhase2(['--families', '--family-set', '--page', '--run', '--arm', '--dry-run'], ['--dry-run'])
  if (fixedArm && args['--arm']) throw new Error('This command has a fixed arm')
  const record = await runArm({ page: slug(args['--page'] || ''), run: slug(args['--run'] || ''), arm: fixedArm || args['--arm'], dryRun: !!args['--dry-run'], families: args['--families'], familySet: args['--family-set'] })
  if (record.status === 'failed') process.exitCode = 1
}
if (require.main === module) main(() => armCLI())
