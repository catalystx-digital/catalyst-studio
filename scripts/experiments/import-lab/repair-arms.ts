import path from 'node:path'
import fs from 'node:fs/promises'
import { argumentsForRun, loadSnapshot, runDirectory, readJson, writeJson, main, errorRecord, digest } from './storage'
import { runtimeRequire, replaceExports, captureConsole, blockNetwork } from './runtime'
import type { DetectedComponent } from '@/lib/studio/import/detection/types'

const productionSkipReason = 'Production first repairs without page markup. A later pass uses page structure captured in a browser for the whole import job, site-wide design findings, all detected pages, and a selected page layout. This single-page experiment lacks those inputs and the intervening validation outcome. Repeating repair with this page source would not reproduce production.'
async function repair() {
  const { page, run } = argumentsForRun(), directory = runDirectory(page, run)
  const snapshot = await loadSnapshot(page), record = await readJson(path.join(directory, 'run.json'))
  if (record.status !== 'complete') throw new Error('Repair requires a completed detection or explicit fixture run')
  if (record.snapshotSha256 !== snapshot.manifest.sha256) throw new Error('Run and snapshot HTML differ')
  const components = await readJson<DetectedComponent[]>(path.join(directory, 'pre-repair.json'))
  const detection = await readJson(path.join(directory, 'detection.json'))
  const arms: Record<string, any> = { off: { status: 'complete', components, steps: [], sessions: [], events: [] }, 'on-as-production': { status: 'skipped', reason: productionSkipReason } }
  const events: unknown[] = [], steps: any[] = [], sessions: unknown[] = []
  const restoreNetwork = blockNetwork(), restoreConsole = captureConsole(events)
  let lastStepState = JSON.stringify(components)
  let restoreExports: (() => void) | undefined, restoreEnd: (() => void) | undefined
  try {
    const telemetry = runtimeRequire('@/lib/studio/import/services/detection-post-processor/telemetry') as typeof import('@/lib/studio/import/services/detection-post-processor/telemetry')
    const end = telemetry.telemetryCollector.endSession
    telemetry.telemetryCollector.endSession = function() { const summary = end.call(this); sessions.push(summary); return summary }
    restoreEnd = () => { telemetry.telemetryCollector.endSession = end }
    const wrap = (name: string, values: DetectedComponent[], fn: (c: DetectedComponent[]) => void) => {
      const before = JSON.stringify(values)
      try { telemetry.withTelemetry(name, values, fn) }
      catch (error) { steps.push({ name, status: 'failed', changed: before !== JSON.stringify(values), error: errorRecord(error) }); throw error }
      lastStepState = JSON.stringify(values)
      steps.push({ name, status: 'complete', changed: before !== lastStepState })
    }
    restoreExports = replaceExports('@/lib/studio/import/services/detection-post-processor/telemetry', {
      withTelemetry: wrap,
      withConfidenceCheck(name: string, values: DetectedComponent[], fn: (c: DetectedComponent[]) => void, check: (name: string, values: DetectedComponent[]) => { shouldSkip: boolean; avgConfidence: number; threshold: number }) {
        const decision = check(name, values)
        if (decision.shouldSkip) { steps.push({ name, status: 'skipped', changed: false, ...decision }); telemetry.recordSkippedProcessor(name, values, decision.avgConfidence, decision.threshold); return }
        wrap(name, values, fn)
      }
    })
    const { adjustDetectedComponents } = runtimeRequire('@/lib/studio/import/services/detection-post-processor') as typeof import('@/lib/studio/import/services/detection-post-processor')
    const repaired = adjustDetectedComponents(JSON.parse(JSON.stringify(components)), {
      domSnapshot: snapshot.html, pageUrl: snapshot.manifest.url, resourcesSummary: detection.resourcesSummary || snapshot.outline.resourcesSummary,
      pageMetadata: detection.pageMetadata, pageTemplate: detection.pageTemplate
    })
    // URL transformation runs outside production telemetry; report its effect explicitly.
    steps.push({ name: 'transformSourceUrls', status: 'complete', changed: lastStepState !== JSON.stringify(repaired) })
    const files = Object.keys(runtimeRequire.cache).filter(file => /[/\\]lib[/\\]studio[/\\]/.test(file) && /\.[cm]?[jt]sx?$/.test(file)).sort()
    const sources = await Promise.all(files.map(async file => [path.relative(process.cwd(),file).replace(/\\/g,'/'),digest(await fs.readFile(file,'utf8'))]))
    const configuration = runtimeRequire('@/lib/studio/import/config/import-config')
    const repairFingerprint = digest(JSON.stringify({sources,urlTransform:configuration.UrlTransformConfig}))
    arms['on-own-page'] = { status: 'complete', repairFingerprint, components: repaired, steps, sessions, events, telemetryLimit: 'transformSourceUrls is an experiment-added before/after observation; production does not instrument that step.' }
  } catch (error) { arms['on-own-page'] = { status: 'failed', error: errorRecord(error), steps, sessions, events }; process.exitCode = 1 }
  finally { restoreEnd?.(); restoreExports?.(); restoreConsole(); restoreNetwork() }
  await writeJson(path.join(directory, 'arms.json'), { page, run, snapshotSha256: snapshot.manifest.sha256, arms })
  console.log('Saved repair arms. on-as-production skipped: ' + productionSkipReason)
}
if (require.main === module) main(repair)
