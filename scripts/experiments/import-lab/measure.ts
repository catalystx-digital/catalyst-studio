import fs from 'node:fs/promises'
import path from 'node:path'
import { argumentsForRun, loadSnapshot, runDirectory, readJson, writeJson, main } from './storage'
import { extractPageEvidence, measureArm, diagnosticEvidence, extractSectionEvidence } from './metrics'
export * from './metrics'

async function measure() {
  const {page,run}=argumentsForRun(), directory=runDirectory(page,run)
  const snapshot=await loadSnapshot(page), runRecord=await readJson(path.join(directory,'run.json')), input=await readJson(path.join(directory,'arms.json'))
  if (snapshot.manifest.sha256 !== input.snapshotSha256 || snapshot.manifest.sha256 !== runRecord.snapshotSha256) throw new Error('Snapshot and run checksums differ')
  const detection=await readJson(path.join(directory,'detection.json'))
  const evidence=extractPageEvidence(snapshot.html,snapshot.manifest.finalUrl,snapshot.stylesheets)
  const calls = await Promise.all((await fs.readdir(path.join(directory,'calls'))).filter(name => name.endsWith('.json')).sort().map(name => readJson(path.join(directory,'calls',name))))
  // Only sections with a recorded provider call reached the model; omitted/planned sections do not count.
  const shownKeys = [...new Set<string>(calls.filter(call => call.kind === 'extract' && call.status !== 'dry-run').map(call => call.sectionKey))]
  const shown = extractSectionEvidence(snapshot.sections, shownKeys)
  const diagnostics=detection.diagnostics || []
  const outcomes=diagnosticEvidence(diagnostics,runRecord.sectionsOmittedByLimit || [])
  const arms:Record<string,unknown>={}
  for(const [name,arm] of Object.entries(input.arms) as Array<[string,any]>) arms[name]=arm.status==='complete' ? {...arm,components:undefined,measurement:measureArm(evidence,arm.components,outcomes.dropped,outcomes.diagnostics,shown)} : arm
  await writeJson(path.join(directory,'measurement.json'),{version:2,page,run,shownSectionKeys:shown.sectionKeys,snapshotSha256:snapshot.manifest.sha256,comparisonKey:runRecord.comparisonKey || null,fixture:runRecord.fixture || false,arms})
  console.log('Measured '+page+'/'+run)
}
if(require.main===module) main(measure)
