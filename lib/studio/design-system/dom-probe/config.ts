import type { DomProbeRunConfig, DomProbeViewport } from './types'

export const DEFAULT_PROBE_VIEWPORT: DomProbeViewport = {
  width: 1280,
  height: 720,
  deviceScaleFactor: 1
}

export const DEFAULT_RUN_CONFIG: Omit<DomProbeRunConfig, 'baseline' | 'targetUrl' | 'refresh' | 'evaluation' | 'runnerVersion'> = {
  viewport: DEFAULT_PROBE_VIEWPORT,
  flags: {}
}
