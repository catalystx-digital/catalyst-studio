import fsp from 'node:fs/promises'

import type {
  DomDesignSystemCapture,
  DomDesignSystemCaptureMetadata,
  DomProbeDiagnostics,
  DomProbeNavigationMetric,
  DomProbeRunConfig,
  DomProbeViewport
} from './types'
import { DomProbeArtifacts } from './artifacts'

interface BuildMetadataParams {
  config: DomProbeRunConfig
  artifacts: DomProbeArtifacts
  runId: string
  runStartedAt: Date
  runCompletedAt: Date
  browser: {
    name: string
    version: string
    userAgent: string
  }
  viewport: DomProbeViewport
  timings: DomProbeNavigationMetric[]
  cached: boolean
}

export function buildCaptureMetadata(params: BuildMetadataParams): DomDesignSystemCaptureMetadata {
  const {
    config,
    artifacts,
    runId,
    runStartedAt,
    runCompletedAt,
    browser,
    viewport,
    timings,
    cached
  } = params
  const captureDurationMs = Math.max(0, runCompletedAt.getTime() - runStartedAt.getTime())
  return {
    baseline: config.baseline,
    url: config.targetUrl,
    timestamp: runCompletedAt.toISOString(),
    runId,
    runnerVersion: config.runnerVersion,
    viewport,
    browser,
    timings,
    captureDurationMs,
    cached,
    artifacts: {
      runLog: artifacts.logPath,
      captureJson: artifacts.capturePath,
      domSnapshot: artifacts.domSnapshotPath,
      screenshots: [],
      diffs: [],
      manifest: artifacts.manifestJsonPath
    },
    checkpoint: undefined,
    configuration: {
      refreshRequested: config.refresh,
      evaluationRequested: config.evaluation,
      flags: config.flags ?? {},
      playwright: {}
    }
  }
}

export function createEmptyDiagnostics(): DomProbeDiagnostics {
  return {
    errors: [],
    warnings: [],
    infos: [],
    missingFonts: [],
    consoleErrors: [],
    notes: []
  }
}

export async function persistCapture(artifacts: DomProbeArtifacts, capture: DomDesignSystemCapture): Promise<void> {
  await fsp.writeFile(artifacts.capturePath, JSON.stringify(capture, null, 2), 'utf-8')
}
