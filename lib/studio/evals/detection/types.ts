import type { DetectionComponent, SchemaValidationResult } from './schema'

export type { DetectionComponent }

export interface EvalFixtureContext {
  url: string
  path: string
  language?: string
  capturedAt?: string
  model?: string
}

export interface EvalFixture {
  dataset: string
  caseId: string
  rootDir: string
  context: EvalFixtureContext
  expected: NormalizedDetectionOutput
  raw?: RawDetectionOutput
  assets?: Record<string, unknown>
  domHtml?: string
}

export interface RawDetectionOutput {
  pageTemplate?: any
  components: Array<[string, number, Record<string, any>]>
  pageMetadata?: Record<string, any>
}

export interface NormalizedComponent {
  type: string
  confidence?: number
  content: Record<string, any>
  region?: string
}

export interface NormalizedDetectionOutput {
  pageTemplate?: any
  components: NormalizedComponent[]
  pageMetadata?: Record<string, any>
}

export interface DetectionRunResult {
  components: DetectionComponent[]
  rawComponents: DetectionComponent[]
  raw: RawDetectionOutput
  timings: {
    detectionMs?: number
    parsingMs?: number
    totalMs?: number
  }
  tokenUsage?: number
  promptChars?: number
  promptHash?: string
  modelUsed?: string
}

export type ImporterDiffKind =
  | 'component_added'
  | 'component_removed'
  | 'type_mismatch'
  | 'field_added'
  | 'field_removed'
  | 'field_changed'

export interface ImporterDiffEntry {
  kind: ImporterDiffKind
  componentIndex: number
  rawType?: string
  normalizedType?: string
  fieldPath?: string
  rawValue?: unknown
  normalizedValue?: unknown
}

export interface ComponentDiff {
  expectedIndex: number
  actualIndex: number
  type: string
  score: number
  fieldMismatches: Array<{ field: string; expected: unknown; actual: unknown }>
  expectedFieldCount: number
}

export interface EvaluationPhaseResult {
  components: DetectionComponent[]
  schema: SchemaValidationResult
  diff: {
    matches: ComponentDiff[]
    missing: NormalizedComponent[]
    unexpected: NormalizedComponent[]
  }
  metrics: EvaluationMetrics
  violations: EvaluationViolation[]
  warnings: EvaluationViolation[]
}

export interface CaseEvaluationResult {
  fixture: EvalFixture
  detection: DetectionRunResult
  raw: EvaluationPhaseResult
  normalized?: EvaluationPhaseResult
  importerDiffs: ImporterDiffEntry[]
  summary: {
    passed: boolean
    rawPassed: boolean
    rawStrictPass: boolean
    normalizedPassed?: boolean
    normalizedStrictPass?: boolean
    importerClean: boolean
  }
  outputPath?: string
}

export interface EvaluationMetrics {
  componentPrecision: number
  componentRecall: number
  componentF1: number
  fieldAccuracy: number
  strictPass: boolean
  componentCount: {
    expected: number
    actual: number
    matched: number
  }
  latencyMs?: number
  promptChars?: number
}

export interface EvaluationViolation {
  code: string
  message: string
  severity: 'error' | 'warning'
  phase?: 'raw' | 'normalized'
  path?: string
  details?: Record<string, unknown>
}

export interface EvaluationSummaryMetrics {
  meanF1: number
  meanPrecision: number
  meanRecall: number
  meanFieldAccuracy: number
}

export interface EvaluationSummaryPhase {
  passed: number
  failed: number
  strictPassRate: number
  metrics: EvaluationSummaryMetrics
}

export interface EvaluationSummary {
  startedAt: string
  completedAt: string
  dataset: string
  caseCount: number
  raw: EvaluationSummaryPhase
  normalized?: EvaluationSummaryPhase
}

export interface EvaluationReport {
  summary: EvaluationSummary
  schema: {
    version: number
    hash: string
  }
  cases: Array<{
    caseId: string
    dataset: string
    raw: {
      metrics: EvaluationMetrics
      violations: EvaluationViolation[]
      warnings: EvaluationViolation[]
    }
    normalized?: {
      metrics: EvaluationMetrics
      violations: EvaluationViolation[]
      warnings: EvaluationViolation[]
    }
    importerDiffs: ImporterDiffEntry[]
    detection: {
      model?: string
      timings?: DetectionRunResult['timings']
      tokenUsage?: number
      promptChars?: number
      promptHash?: string
    }
  }>
  metadata: {
    runnerVersion: string
    generatedAt: string
  }
}
