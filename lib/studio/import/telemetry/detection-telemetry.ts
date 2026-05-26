import { randomUUID } from 'crypto'

import { performanceMonitor } from '@/lib/studio/components/cms/_import/performance'

type Logger = Pick<typeof console, 'log' | 'warn'>

export type DetectionPhase =
  | 'fetch'
  | 'prompt_build'
  | 'section_extract'
  | 'page_map'
  | 'component_plan'
  | 'fill_batch'
  | 'assembly'
  | 'llm_call'
  | 'canonicalization'
  | 'contract_loading'
  | 'registry_seeding'

// Baselines can be overridden via IMPORT_LLM_BASELINE_MS env var (for free/slow models)
const LLM_BASELINE_MS = parseInt(process.env.IMPORT_LLM_BASELINE_MS || '4000', 10)
const WARN_MULTIPLIER = parseInt(process.env.IMPORT_WARN_MULTIPLIER || '2', 10)

const PHASE_BASELINES_MS: Record<DetectionPhase, number> = {
  fetch: 1500,
  prompt_build: 500,
  section_extract: LLM_BASELINE_MS,
  page_map: 800,
  component_plan: LLM_BASELINE_MS,
  fill_batch: LLM_BASELINE_MS,
  assembly: 400,
  llm_call: LLM_BASELINE_MS,
  canonicalization: 400,
  contract_loading: 800,
  registry_seeding: 600
}

export interface DetectionPhaseRecord {
  runId: string
  phase: DetectionPhase
  durationMs: number
  baselineMs: number
  thresholdMs: number
  status: 'ok' | 'warning'
  url: string
  host?: string
  path?: string
  timestamp: string
  metadata?: Record<string, unknown>
}

export interface DetectionTelemetryContext {
  url: string
  model?: string
  runId?: string
  logger?: Logger
}

type MetadataBuilder<T> = (result: T | undefined, error: unknown) => Record<string, unknown> | undefined

export interface DetectionTelemetry {
  timePhase<T>(phase: DetectionPhase, fn: () => T | Promise<T>, metadataBuilder?: MetadataBuilder<T>): Promise<T>
  recordPhase(phase: DetectionPhase, durationMs: number, metadata?: Record<string, unknown>, statusOverride?: 'ok' | 'warning'): void
  flush(extraSummary?: Record<string, unknown>): void
  getPhaseRecords(): DetectionPhaseRecord[]
}

interface SanitizedUrl {
  displayUrl: string
  host?: string
  pathname?: string
}

function sanitizeUrl(rawUrl: string): SanitizedUrl {
  try {
    const parsed = new URL(rawUrl)
    const displayUrl = `${parsed.origin}${parsed.pathname}`
    return { displayUrl, host: parsed.hostname, pathname: parsed.pathname || '/' }
  } catch {
    return { displayUrl: rawUrl }
  }
}

function resolveRunId(explicit?: string): string {
  if (explicit && explicit.trim().length > 0) {
    return explicit.trim()
  }
  if (typeof randomUUID === 'function') {
    try {
      return randomUUID()
    } catch {
      /* ignore */
    }
  }
  return `detect-${Date.now().toString(36)}`
}

function nowIso(): string {
  return new Date().toISOString()
}

export function createDetectionTelemetry(context: DetectionTelemetryContext): DetectionTelemetry {
  const logger: Logger = context.logger ?? console
  const sanitized = sanitizeUrl(context.url)
  const runId = resolveRunId(context.runId)
  const phaseRecords: DetectionPhaseRecord[] = []

  function logPhase(record: DetectionPhaseRecord): void {
    const logPayload = {
      runId: record.runId,
      phase: record.phase,
      durationMs: record.durationMs,
      baselineMs: record.baselineMs,
      thresholdMs: record.thresholdMs,
      status: record.status,
      url: record.url,
      host: record.host,
      path: record.path,
      model: context.model ?? 'unknown',
      timestamp: record.timestamp,
      ...(record.metadata ? { metadata: record.metadata } : {})
    }
    logger.log('[DETECTION][PhaseTiming]', logPayload)
    if (record.status === 'warning') {
      logger.warn('[DETECTION][PhaseThreshold]', logPayload)
    }
  }

  function recordPhase(
    phase: DetectionPhase,
    durationMs: number,
    metadata?: Record<string, unknown>,
    statusOverride?: 'ok' | 'warning'
  ): void {
    const baselineMs = PHASE_BASELINES_MS[phase]
    const thresholdMs = baselineMs * WARN_MULTIPLIER
    const status: 'ok' | 'warning' =
      statusOverride ?? (durationMs > thresholdMs ? 'warning' : 'ok')
    const record: DetectionPhaseRecord = {
      runId,
      phase,
      durationMs,
      baselineMs,
      thresholdMs,
      status,
      url: sanitized.displayUrl,
      host: sanitized.host,
      path: sanitized.pathname,
      timestamp: nowIso(),
      ...(metadata ? { metadata } : {})
    }
    phaseRecords.push(record)
    logPhase(record)
  }

  async function timePhase<T>(
    phase: DetectionPhase,
    fn: () => T | Promise<T>,
    metadataBuilder?: MetadataBuilder<T>
  ): Promise<T> {
    const timerName = `web.detect.${phase}`
    const timerId = performanceMonitor.startTimer(timerName)
    try {
      const result = await Promise.resolve().then(fn)
      const metadata = metadataBuilder ? metadataBuilder(result, undefined) : undefined
      const duration = performanceMonitor.endTimer(timerName, metadata, timerId)
      recordPhase(phase, duration, metadata)
      return result
    } catch (error) {
      const metadata = metadataBuilder ? metadataBuilder(undefined, error) : undefined
      const duration = performanceMonitor.endTimer(timerName, { ...(metadata || {}), error: true }, timerId)
      recordPhase(phase, duration, { ...(metadata || {}), error: true })
      throw error
    }
  }

  function flush(extraSummary?: Record<string, unknown>): void {
    const totalDurationMs = phaseRecords.reduce((sum, record) => sum + record.durationMs, 0)
    const summary = {
      runId,
      url: sanitized.displayUrl,
      host: sanitized.host,
      path: sanitized.pathname,
      model: context.model ?? 'unknown',
      phaseCount: phaseRecords.length,
      totalDurationMs,
      phases: phaseRecords.map(record => ({
        phase: record.phase,
        durationMs: record.durationMs,
        baselineMs: record.baselineMs,
        thresholdMs: record.thresholdMs,
        status: record.status
      })),
      ...(extraSummary ? extraSummary : {})
    }
    logger.log('[DETECTION][Summary]', summary)
  }

  function getPhaseRecords(): DetectionPhaseRecord[] {
    return [...phaseRecords]
  }

  return {
    timePhase,
    recordPhase,
    flush,
    getPhaseRecords
  }
}
