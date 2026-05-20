import type { BrowserContextOptions, ViewportSize } from 'playwright-core'

export interface DomProbeViewport extends ViewportSize {
  deviceScaleFactor: number
}

export interface DomProbeNavigationMetric {
  name: string
  valueMs: number
}

export interface DomProbeConsoleMessage {
  type: string
  text: string
  location?: {
    url?: string
    lineNumber?: number
    columnNumber?: number
  }
}

export interface DomTypographySample {
  id: string
  selector: string
  fontFamily: string
  fontStack: string
  fontWeight: string
  fontStyle: string
  fontSizePx: number
  lineHeightPx: number | null
  letterSpacingPx: number | null
  textTransform: string | null
  textDecoration: string | null
  textAlign: string | null
  textSample: string
  usageCount: number
  role?: 'heading' | 'body' | 'label' | 'cta' | 'unknown'
  script?: string
  scriptConfidence?: number | null
}

export interface DomPaletteSwatch {
  hex: string
  rgb: string
  occurrences: number
  cssProperties: string[]
  sampleSelectors: string[]
  oklch?: {
    l: number
    c: number
    h: number
  }
  contrastWarnings?: Array<{
    against: string
    ratio: number
    level: 'AA' | 'AAA'
  }>
  role?: 'primary' | 'secondary' | 'accent' | 'neutral' | 'background' | 'text'
}

export interface DomPaletteCapture {
  colors: DomPaletteSwatch[]
  primary?: DomPaletteSwatch | null
  secondary?: DomPaletteSwatch | null
  neutrals?: DomPaletteSwatch[]
  accent?: DomPaletteSwatch[]
  surface?: DomPaletteSwatch[]
}

export interface DomSpacingToken {
  valuePx: number
  occurrences: number
  sources: string[]
}

export interface DomSpacingCapture {
  baseUnitPx: number | null
  scale: DomSpacingToken[]
  gapTokens?: DomSpacingToken[]
}

export interface DomComponentCue {
  selector: string
  tagName: string
  classes: string[]
  role?: string
  description?: string
}

export interface DomProbeDiagnostics {
  errors: string[]
  warnings: string[]
  infos: string[]
  missingFonts: string[]
  consoleErrors: DomProbeConsoleMessage[]
  notes?: string[]
}

export interface DomProbeRemoteArtifact {
  key: string
  url?: string | null
  checksum?: string
}

export interface DomProbeRemoteArtifacts {
  captureJson?: DomProbeRemoteArtifact
  manifestJson?: DomProbeRemoteArtifact
  manifestMarkdown?: DomProbeRemoteArtifact
  runLog?: DomProbeRemoteArtifact
  domSnapshot?: DomProbeRemoteArtifact
  diffReports?: DomProbeRemoteArtifact[]
  screenshots?: DomProbeRemoteArtifact[]
}

export interface DomDesignSystemCaptureMetadata {
  baseline: string
  url: string
  timestamp: string
  runId: string
  runnerVersion: string
  viewport: DomProbeViewport
  browser: {
    name: string
    version: string
    userAgent: string
  }
  timings: DomProbeNavigationMetric[]
  captureDurationMs: number
  cached: boolean
  artifacts: {
    runLog: string
    captureJson: string
    domSnapshot: string
    screenshots: string[]
    diffs?: string[]
    manifest: string
  }
  checkpoint?: 'CP1' | 'CP2' | 'CP3' | 'CP4' | 'CP5'
  configuration: {
    refreshRequested: boolean
    evaluationRequested: boolean
    flags: Record<string, boolean | number | string | undefined>
    playwright: Pick<BrowserContextOptions, 'userAgent' | 'locale' | 'timezoneId'>
  }
}

export interface DomDesignSystemCapture {
  metadata: DomDesignSystemCaptureMetadata
  typography: DomTypographySample[]
  palette: DomPaletteCapture
  spacing: DomSpacingCapture
  components: DomComponentCue[]
  diagnostics: DomProbeDiagnostics
  rawDomSnapshotPath: string
}

export interface DomProbeManifest {
  baseline: string
  runId: string
  timestamp: string
  url: string
  artifacts: DomDesignSystemCaptureMetadata['artifacts']
  remoteArtifacts?: DomProbeRemoteArtifacts
  status: 'success' | 'failed'
  errors: string[]
  notes?: string[]
  checkpoints: Record<string, { completed: boolean; artifact?: string }>
}

export interface CachedRunInfo {
  baseline: string
  runId: string
  timestamp: string
  capturePath: string
  manifestPath: string
}

export interface DomProbeRunConfig {
  baseline: string
  targetUrl: string
  refresh: boolean
  evaluation: boolean
  viewport: DomProbeViewport
  runnerVersion: string
  flags?: Record<string, boolean | number | string | undefined>
}
