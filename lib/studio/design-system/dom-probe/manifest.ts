import type { DomProbeManifest, DomProbeRunConfig } from './types'

const CHECKPOINT_IDS = ['CP1', 'CP2', 'CP3', 'CP4', 'CP5'] as const

export function createEmptyManifest(config: DomProbeRunConfig, runId: string): DomProbeManifest {
  return {
    baseline: config.baseline,
    runId,
    timestamp: new Date().toISOString(),
    url: config.targetUrl,
    artifacts: {
      runLog: '',
      captureJson: '',
      domSnapshot: '',
      screenshots: [],
      diffs: [],
      manifest: ''
    },
    status: 'success',
    errors: [],
    checkpoints: CHECKPOINT_IDS.reduce<Record<string, { completed: boolean; artifact?: string }>>((acc, id) => {
      acc[id] = { completed: false }
      return acc
    }, {})
  }
}

export function markCheckpoint(manifest: DomProbeManifest, id: string, artifact?: string): void {
  if (!manifest.checkpoints[id]) {
    manifest.checkpoints[id] = { completed: true, artifact }
    return
  }
  manifest.checkpoints[id].completed = true
  if (artifact) {
    manifest.checkpoints[id].artifact = artifact
  }
}

export function registerError(manifest: DomProbeManifest, error: string): void {
  manifest.errors.push(error)
  manifest.status = 'failed'
}
