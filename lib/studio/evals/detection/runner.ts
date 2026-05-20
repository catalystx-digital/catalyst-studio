import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

import { initializeCMSComponents } from '@/lib/studio/components/cms/_factory/initialize'
import { buildDetectionPromptFromCatalog } from '@/lib/studio/import/detection/prompt-builder'
import { getDetectionService } from '@/lib/studio/import/web-detection'
import { ComponentBuilder } from '@/lib/studio/import/services/page-builder/component-builder'
import type { ComponentType as ImportComponentType, DetectionResult } from '@/lib/studio/import/services/interfaces'

import { buildDetectionSchemaBundle, validateDetectionComponents, type DetectionSchemaBundle } from './schema'
import { discoverFixtures } from './fixture-loader'
import type {
  CaseEvaluationResult,
  DetectionComponent,
  DetectionRunResult,
  EvalFixture,
  EvaluationMetrics,
  EvaluationPhaseResult,
  EvaluationReport,
  EvaluationSummary,
  EvaluationSummaryPhase,
  EvaluationSummaryMetrics,
  EvaluationViolation,
  ImporterDiffEntry,
  ImporterDiffKind,
  NormalizedComponent,
  RawDetectionOutput
} from './types'
import { computeDiff, computeFieldAccuracy, computePrecisionRecall } from './stats'
import { validateStructure } from './structural'

export interface RunOptions {
  dataset?: string
  caseId?: string
  responsePath?: string
  saveResponse?: string
  record?: boolean
  model?: string
  iterations?: number
  parallel?: number
  reportDir?: string
  promptChars?: number
  rawOnly?: boolean
  failOnImporterFix?: boolean
}

const RUNNER_VERSION = '1.0.0'
const PROMPT_CHAR_WARNING_THRESHOLD = 100000

interface DetectionReplay {
  normalizedComponents: DetectionComponent[]
  rawComponents: DetectionComponent[]
  raw: RawDetectionOutput
}

function buildComponentTypes(raw: RawDetectionOutput): ImportComponentType[] {
  const seen = new Set<string>()
  const types: ImportComponentType[] = []
  for (const [type] of raw.components) {
    if (seen.has(type)) continue
    seen.add(type)
    types.push({
      id: type,
      type,
      category: 'eval',
      version: '1.0.0',
      defaultConfig: {},
      placeholderData: {},
      styles: {},
      aiMetadata: {},
      confidence: 1,
      isGlobal: false,
      websiteId: 'eval',
      createdBy: null,
      updatedBy: null,
      patterns: []
    })
  }
  return types
}

function toDetectionResults(raw: RawDetectionOutput): DetectionResult[] {
  return raw.components.map(([type, confidence, content], index) => ({
    id: `${type}-${index}`,
    type,
    bounds: { x: 0, y: 0, width: 0, height: 0 },
    content,
    confidence,
    metadata: {}
  }))
}

function sanitizeComponent(component: DetectionComponent): DetectionComponent {
  const content: Record<string, any> = {}
  for (const [key, value] of Object.entries(component.content || {})) {
    if (value === undefined) continue
    content[key] = value
  }
  return {
    type: component.type,
    confidence: component.confidence,
    content,
    region: component.region,
    metadata: component.metadata
  }
}

function toRawComponents(raw: RawDetectionOutput): DetectionComponent[] {
  return raw.components.map(([type, confidence, content]) =>
    sanitizeComponent({
      type,
      confidence,
      content: content ? JSON.parse(JSON.stringify(content)) : {},
      region: content && typeof (content as any).region === 'string' ? (content as any).region : undefined,
      metadata: undefined
    })
  )
}

let cmsRegistryInit: Promise<void> | null = null

async function ensureCmsComponentsInitialized(): Promise<void> {
  if (!cmsRegistryInit) {
    cmsRegistryInit = initializeCMSComponents().catch(error => {
      cmsRegistryInit = null
      throw error
    })
  }
  await cmsRegistryInit
}

async function fromRawDetection(raw: RawDetectionOutput): Promise<DetectionReplay> {
  const rawComponents = toRawComponents(raw)
  const builder = new ComponentBuilder()
  const componentTypes = buildComponentTypes(raw)
  const detectionResults = toDetectionResults(raw)
  await ensureCmsComponentsInitialized()
  const instances = builder.mapToComponentInstances(detectionResults, componentTypes)

  const normalizedComponents: DetectionComponent[] = instances.map((instance, index) => {
    const [rawType] = raw.components[index]
    const props = instance.props as Record<string, any>
    const content = (props?.content as Record<string, any>) || {}
    const region = (props?.metadata as any)?.region ?? props?.region
    if (region && typeof content.region !== 'string') {
      content.region = region
    }
    const normalized: DetectionComponent = {
      type: rawType,
      confidence: raw.components[index]?.[1] ?? 1,
      content,
      region
    }
    return sanitizeComponent(normalized)
  })

  return {
    normalizedComponents,
    rawComponents,
    raw
  }
}

function makeEvalViolation(violation: any, phase: 'raw' | 'normalized'): EvaluationViolation {
  return {
    code: violation.code || 'unknown',
    message: violation.message || 'Unknown violation',
    severity: violation.severity || 'error',
    phase,
    path: violation.path,
    details: violation.details
  }
}

function computeMetrics(
  expected: NormalizedComponent[],
  actual: DetectionComponent[],
  matches: ReturnType<typeof computeDiff>['matches'],
  schemaViolations: EvaluationViolation[],
  detectionTimings?: DetectionRunResult['timings'],
  promptChars?: number
): EvaluationMetrics {
  const { precision, recall, f1, matchedCount } = computePrecisionRecall(expected, actual, matches)
  const fieldAccuracy = computeFieldAccuracy(matches)
  const strictPass = schemaViolations.length === 0 && matchedCount === expected.length && actual.length === expected.length

  return {
    componentPrecision: precision,
    componentRecall: recall,
    componentF1: f1,
    fieldAccuracy,
    strictPass,
    componentCount: {
      expected: expected.length,
      actual: actual.length,
      matched: matchedCount
    },
    latencyMs: detectionTimings?.totalMs,
    promptChars
  }
}

function addDiffViolations(
  violations: EvaluationViolation[],
  diff: ReturnType<typeof computeDiff>,
  phase: 'raw' | 'normalized'
): void {
  diff.missing.forEach(component => {
    violations.push({
      code: 'diff.missing_component',
      message: `Missing component "${component.type}" in detection output`,
      severity: 'error',
      phase,
      details: { component }
    })
  })

  diff.unexpected.forEach(component => {
    violations.push({
      code: 'diff.unexpected_component',
      message: `Unexpected component "${component.type}" detected`,
      severity: 'error',
      phase,
      details: { component }
    })
  })

  diff.matches.forEach(match => {
    match.fieldMismatches.forEach(mismatch => {
      violations.push({
        code: 'diff.field_mismatch',
        message: `Field mismatch for component "${match.type}" on "${mismatch.field}"`,
        severity: 'error',
        phase,
        path: `components[${match.actualIndex}].content.${mismatch.field}`,
        details: { expected: mismatch.expected, actual: mismatch.actual }
      })
    })
  })
}

function evaluateDetectionPhase(
  phase: 'raw' | 'normalized',
  components: DetectionComponent[],
  expected: NormalizedComponent[],
  schemaBundle: DetectionSchemaBundle,
  promptLength: number | undefined,
  detectionTimings?: DetectionRunResult['timings']
): EvaluationPhaseResult {
  const schemaResult = validateDetectionComponents(schemaBundle, components)
  const diff = computeDiff(expected, components)
  const structureResult = validateStructure(expected, components, diff)

  const violations: EvaluationViolation[] = [
    ...schemaResult.violations.map(violation => makeEvalViolation(violation, phase)),
    ...structureResult.violations.map(violation => ({ ...violation, phase }))
  ]
  const warnings: EvaluationViolation[] = [
    ...schemaResult.warnings.map(warning => makeEvalViolation(warning, phase)),
    ...structureResult.warnings.map(warning => ({ ...warning, phase }))
  ]

  addDiffViolations(violations, diff, phase)

  if (promptLength && promptLength > PROMPT_CHAR_WARNING_THRESHOLD) {
    warnings.push({
      code: 'prompt.length_warning',
      message: `Prompt length ${promptLength} characters exceeds warning threshold of ${PROMPT_CHAR_WARNING_THRESHOLD}.`,
      severity: 'warning',
      phase,
      details: { length: promptLength, limit: PROMPT_CHAR_WARNING_THRESHOLD }
    })
  }

  const metrics = computeMetrics(
    expected,
    components,
    diff.matches,
    violations.filter(v => v.severity === 'error'),
    detectionTimings,
    promptLength
  )

  return {
    components,
    schema: schemaResult,
    diff,
    metrics,
    violations,
    warnings
  }
}

function isPlainObject(value: unknown): value is Record<string, any> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (typeof a !== typeof b) return false
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false
    return a.every((value, index) => deepEqual(value, b[index]))
  }
  if (isPlainObject(a) && isPlainObject(b)) {
    const keysA = Object.keys(a)
    const keysB = Object.keys(b)
    if (keysA.length !== keysB.length) return false
    return keysA.every(key => deepEqual(a[key], b[key]))
  }
  return false
}

function joinPath(base: string | null, segment: string): string {
  if (!base || base.length === 0) {
    return segment
  }
  if (segment.startsWith('[')) {
    return `${base}${segment}`
  }
  return `${base}.${segment}`
}

interface DiffContext {
  componentIndex: number
  rawType?: string
  normalizedType?: string
  diffs: ImporterDiffEntry[]
}

function pushImporterDiff(
  ctx: DiffContext,
  kind: ImporterDiffKind,
  fieldPath: string | undefined,
  rawValue: unknown,
  normalizedValue: unknown
): void {
  ctx.diffs.push({
    kind,
    componentIndex: ctx.componentIndex,
    rawType: ctx.rawType,
    normalizedType: ctx.normalizedType,
    ...(fieldPath ? { fieldPath } : {}),
    ...(rawValue !== undefined ? { rawValue } : {}),
    ...(normalizedValue !== undefined ? { normalizedValue } : {})
  })
}

function collectFieldDiffs(
  rawValue: unknown,
  normalizedValue: unknown,
  fieldPath: string,
  ctx: DiffContext
): void {
  if (rawValue === undefined && normalizedValue === undefined) {
    return
  }
  if (rawValue === undefined) {
    pushImporterDiff(ctx, 'field_added', fieldPath, rawValue, normalizedValue)
    return
  }
  if (normalizedValue === undefined) {
    pushImporterDiff(ctx, 'field_removed', fieldPath, rawValue, normalizedValue)
    return
  }
  if (deepEqual(rawValue, normalizedValue)) {
    return
  }
  if (Array.isArray(rawValue) && Array.isArray(normalizedValue)) {
    const length = Math.max(rawValue.length, normalizedValue.length)
    for (let index = 0; index < length; index++) {
      const childPath = joinPath(fieldPath, `[${index}]`)
      collectFieldDiffs(rawValue[index], normalizedValue[index], childPath, ctx)
    }
    return
  }
  if (isPlainObject(rawValue) && isPlainObject(normalizedValue)) {
    const keys = new Set([...Object.keys(rawValue), ...Object.keys(normalizedValue)])
    for (const key of keys) {
      const childPath = joinPath(fieldPath, key)
      collectFieldDiffs((rawValue as any)[key], (normalizedValue as any)[key], childPath, ctx)
    }
    return
  }
  pushImporterDiff(ctx, 'field_changed', fieldPath, rawValue, normalizedValue)
}

function recordTopLevelFieldDiff(
  ctx: DiffContext,
  fieldPath: string,
  rawValue: unknown,
  normalizedValue: unknown
): void {
  if (rawValue === undefined && normalizedValue === undefined) {
    return
  }
  if (deepEqual(rawValue, normalizedValue)) {
    return
  }
  if (rawValue === undefined) {
    pushImporterDiff(ctx, 'field_added', fieldPath, rawValue, normalizedValue)
    return
  }
  if (normalizedValue === undefined) {
    pushImporterDiff(ctx, 'field_removed', fieldPath, rawValue, normalizedValue)
    return
  }
  if (isPlainObject(rawValue) && isPlainObject(normalizedValue)) {
    collectFieldDiffs(rawValue, normalizedValue, fieldPath, ctx)
    return
  }
  if (Array.isArray(rawValue) && Array.isArray(normalizedValue)) {
    collectFieldDiffs(rawValue, normalizedValue, fieldPath, ctx)
    return
  }
  pushImporterDiff(ctx, 'field_changed', fieldPath, rawValue, normalizedValue)
}

function computeImporterDiffs(
  rawComponents: DetectionComponent[],
  normalizedComponents: DetectionComponent[]
): ImporterDiffEntry[] {
  const diffs: ImporterDiffEntry[] = []
  const maxLength = Math.max(rawComponents.length, normalizedComponents.length)

  for (let index = 0; index < maxLength; index++) {
    const rawComponent = rawComponents[index]
    const normalizedComponent = normalizedComponents[index]

    if (!rawComponent && normalizedComponent) {
      diffs.push({
        kind: 'component_added',
        componentIndex: index,
        normalizedType: normalizedComponent.type
      })
      continue
    }

    if (rawComponent && !normalizedComponent) {
      diffs.push({
        kind: 'component_removed',
        componentIndex: index,
        rawType: rawComponent.type
      })
      continue
    }

    if (!rawComponent || !normalizedComponent) {
      continue
    }

    const ctx: DiffContext = {
      componentIndex: index,
      rawType: rawComponent.type,
      normalizedType: normalizedComponent.type,
      diffs
    }

    if (rawComponent.type !== normalizedComponent.type) {
      pushImporterDiff(ctx, 'type_mismatch', undefined, rawComponent.type, normalizedComponent.type)
    }

    recordTopLevelFieldDiff(ctx, 'confidence', rawComponent.confidence, normalizedComponent.confidence)
    recordTopLevelFieldDiff(ctx, 'region', rawComponent.region, normalizedComponent.region)
    recordTopLevelFieldDiff(ctx, 'metadata', rawComponent.metadata, normalizedComponent.metadata)
    collectFieldDiffs(rawComponent.content, normalizedComponent.content, 'content', ctx)
  }

  return diffs
}

function average(values: number[]): number {
  if (values.length === 0) return 0
  const sum = values.reduce((acc, value) => acc + value, 0)
  return Number((sum / values.length).toFixed(4))
}

function writeReport(reportDir: string, report: EvaluationReport): string {
  if (!fs.existsSync(reportDir)) {
    fs.mkdirSync(reportDir, { recursive: true })
  }
  const fileName = `${new Date().toISOString().replace(/[:.]/g, '-')}.json`
  const targetPath = path.join(reportDir, fileName)
  fs.writeFileSync(targetPath, `${JSON.stringify(report, null, 2)}\n`, 'utf-8')
  return targetPath
}

function hashPrompt(prompt: string | undefined): string | undefined {
  if (!prompt) return undefined
  return crypto.createHash('sha256').update(prompt).digest('hex')
}

export async function runEvaluations(options: RunOptions = {}): Promise<CaseEvaluationResult[]> {
  const fixtures = await discoverFixtures({ dataset: options.dataset, caseId: options.caseId })
  if (fixtures.length === 0) {
    throw new Error('No evaluation fixtures found matching the provided filters.')
  }

  const detections = await Promise.all(fixtures.map(async fixture => await acquireDetection(fixture, options)))

  const schemaBundle = await buildDetectionSchemaBundle()
  const prompt = await buildDetectionPromptFromCatalog()
  const promptLengthDefault = options.promptChars ?? prompt.prompt.length
  const promptHash = hashPrompt(prompt.prompt)

  const results: CaseEvaluationResult[] = []

  fixtures.forEach((fixture, index) => {
    const detection = detections[index]
    const promptLength = detection.promptChars ?? promptLengthDefault
    detection.promptChars = promptLength
    detection.promptHash = detection.promptHash ?? promptHash

    const rawResult = evaluateDetectionPhase(
      'raw',
      detection.rawComponents,
      fixture.expected.components,
      schemaBundle,
      promptLength,
      detection.timings
    )

    let normalizedResult: EvaluationPhaseResult | undefined
    if (!options.rawOnly) {
      normalizedResult = evaluateDetectionPhase(
        'normalized',
        detection.components,
        fixture.expected.components,
        schemaBundle,
        promptLength,
        detection.timings
      )
    }

    const importerDiffs = computeImporterDiffs(detection.rawComponents, detection.components)

    if (importerDiffs.length > 0) {
      const severity: 'warning' | 'error' = options.failOnImporterFix ? 'error' : 'warning'
      const targetPhase = normalizedResult ?? rawResult
      const targetCollection = severity === 'error' ? targetPhase.violations : targetPhase.warnings
      targetCollection.push({
        code: 'importer.diff_detected',
        message: `Importer modified detector output (${importerDiffs.length} field-level changes).`,
        severity,
        phase: normalizedResult ? 'normalized' : 'raw',
        details: { diffCount: importerDiffs.length }
      })
    }

    const rawPassed = rawResult.violations.every(violation => violation.severity !== 'error')
    const rawStrictPass = rawResult.metrics.strictPass

    let normalizedPassed: boolean | undefined
    let normalizedStrictPass: boolean | undefined
    if (normalizedResult) {
      normalizedPassed = normalizedResult.violations.every(violation => violation.severity !== 'error')
      normalizedStrictPass = normalizedResult.metrics.strictPass
    }

    const importerClean = importerDiffs.length === 0
    const passed = rawPassed && (normalizedPassed ?? true) && (!options.failOnImporterFix || importerClean)

    results.push({
      fixture,
      detection,
      raw: rawResult,
      normalized: normalizedResult,
      importerDiffs,
      summary: {
        passed,
        rawPassed,
        rawStrictPass,
        normalizedPassed,
        normalizedStrictPass,
        importerClean
      }
    })
  })

  if (options.reportDir) {
    const report = buildReport(schemaBundle.integrity.hash, results)
    const reportPath = writeReport(options.reportDir, report)
    results.forEach(result => {
      result.outputPath = reportPath
    })
  }

  return results
}

function summarizePhaseMetrics(phases: EvaluationPhaseResult[]): EvaluationSummaryMetrics {
  return {
    meanF1: average(phases.map(phase => phase.metrics.componentF1)),
    meanPrecision: average(phases.map(phase => phase.metrics.componentPrecision)),
    meanRecall: average(phases.map(phase => phase.metrics.componentRecall)),
    meanFieldAccuracy: average(phases.map(phase => phase.metrics.fieldAccuracy))
  }
}

function summarizeResults(results: CaseEvaluationResult[]): EvaluationSummary {
  const dataset = results[0]?.fixture.dataset ?? 'unknown'
  const caseCount = results.length
  const timestamp = new Date().toISOString()

  const rawPhase: EvaluationSummaryPhase = {
    passed: results.filter(result => result.summary.rawPassed).length,
    failed: results.filter(result => !result.summary.rawPassed).length,
    strictPassRate: caseCount === 0 ? 0 : results.filter(result => result.summary.rawStrictPass).length / caseCount,
    metrics: summarizePhaseMetrics(results.map(result => result.raw))
  }

  const normalizedResults = results.filter(result => result.normalized)
  const normalizedPhase: EvaluationSummaryPhase | undefined =
    normalizedResults.length === 0
      ? undefined
      : {
          passed: normalizedResults.filter(result => result.summary.normalizedPassed).length,
          failed: normalizedResults.filter(result => result.summary.normalizedPassed === false).length,
          strictPassRate:
            normalizedResults.length === 0
              ? 0
              : normalizedResults.filter(result => result.summary.normalizedStrictPass).length / normalizedResults.length,
          metrics: summarizePhaseMetrics(normalizedResults.map(result => result.normalized!))
        }

  return {
    startedAt: timestamp,
    completedAt: timestamp,
    dataset,
    caseCount,
    raw: rawPhase,
    ...(normalizedPhase ? { normalized: normalizedPhase } : {})
  }
}

function buildReport(schemaHash: string, results: CaseEvaluationResult[]): EvaluationReport {
  const summary = summarizeResults(results)
  return {
    summary,
    schema: {
      version: 1,
      hash: schemaHash
    },
    cases: results.map(result => ({
      caseId: result.fixture.caseId,
      dataset: result.fixture.dataset,
      raw: {
        metrics: result.raw.metrics,
        violations: result.raw.violations,
        warnings: result.raw.warnings
      },
      normalized: result.normalized
        ? {
            metrics: result.normalized.metrics,
            violations: result.normalized.violations,
            warnings: result.normalized.warnings
          }
        : undefined,
      importerDiffs: result.importerDiffs,
      detection: {
        model: result.detection.modelUsed,
        timings: result.detection.timings,
        tokenUsage: result.detection.tokenUsage,
        promptChars: result.detection.promptChars,
        promptHash: result.detection.promptHash
      }
    })),
    metadata: {
      runnerVersion: RUNNER_VERSION,
      generatedAt: new Date().toISOString()
    }
  }
}

async function acquireDetection(fixture: EvalFixture, options: RunOptions): Promise<DetectionRunResult> {
  if (options.responsePath) {
    const raw = JSON.parse(fs.readFileSync(options.responsePath, 'utf-8')) as RawDetectionOutput
    const replay = await fromRawDetection(raw)
    return {
      components: replay.normalizedComponents,
      rawComponents: replay.rawComponents,
      raw,
      timings: { totalMs: 0 },
      modelUsed: options.model
    }
  }

  if (options.record) {
    const detectionService = getDetectionService()
    const startedAt = Date.now()
    const detection = await detectionService.detectComponentsFromUrl(fixture.context.url, {
      model: options.model,
      includeContent: true
    })
    const elapsed = detection.processingTime || Date.now() - startedAt

    const raw: RawDetectionOutput = {
      pageTemplate: detection.pageTemplate,
      components: detection.components.map(component => [
        component.type,
        component.confidence ?? 0,
        component.content ? JSON.parse(JSON.stringify(component.content)) : {}
      ]),
      pageMetadata: detection.pageMetadata
    }

    const savePath =
      options.saveResponse || path.join(fixture.rootDir, `raw.${new Date().toISOString().replace(/[:.]/g, '-')}.json`)
    fs.writeFileSync(savePath, JSON.stringify(raw, null, 2), 'utf-8')

    const replay = await fromRawDetection(raw)

    return {
      components: replay.normalizedComponents,
      rawComponents: replay.rawComponents,
      raw,
      timings: {
        detectionMs: detection.processingTime,
        totalMs: elapsed
      },
      tokenUsage: detection.tokenUsage,
      modelUsed: detection.modelUsed ?? options.model
    }
  }

  const defaultRawPath = path.join(fixture.rootDir, 'raw.json')
  if (!fs.existsSync(defaultRawPath)) {
    throw new Error(`Fixture is missing raw.json at ${defaultRawPath}`)
  }

  const raw = JSON.parse(fs.readFileSync(defaultRawPath, 'utf-8')) as RawDetectionOutput
  const replay = await fromRawDetection(raw)

  if (options.saveResponse) {
    fs.writeFileSync(options.saveResponse, JSON.stringify(raw, null, 2), 'utf-8')
  }

  return {
    components: replay.normalizedComponents,
    rawComponents: replay.rawComponents,
    raw,
    timings: { totalMs: 0 },
    modelUsed: options.model
  }
}

export function printSummary(results: CaseEvaluationResult[]): void {
  const summary = summarizeResults(results)
  const header = `Dataset: ${summary.dataset} | Cases: ${summary.caseCount}`
  const rawMetricsLine = [
    `RawF1 ${summary.raw.metrics.meanF1.toFixed(2)}`,
    `RawPrecision ${summary.raw.metrics.meanPrecision.toFixed(2)}`,
    `RawRecall ${summary.raw.metrics.meanRecall.toFixed(2)}`,
    `RawFieldAcc ${summary.raw.metrics.meanFieldAccuracy.toFixed(2)}`,
    `RawStrict ${(summary.raw.strictPassRate * 100).toFixed(0)}%`
  ].join(' | ')
  const normalizedMetricsLine =
    summary.normalized &&
    [
      `NormF1 ${summary.normalized.metrics.meanF1.toFixed(2)}`,
      `NormPrecision ${summary.normalized.metrics.meanPrecision.toFixed(2)}`,
      `NormRecall ${summary.normalized.metrics.meanRecall.toFixed(2)}`,
      `NormFieldAcc ${summary.normalized.metrics.meanFieldAccuracy.toFixed(2)}`,
      `NormStrict ${(summary.normalized.strictPassRate * 100).toFixed(0)}%`
    ].join(' | ')

  // eslint-disable-next-line no-console
  console.log(header)
  // eslint-disable-next-line no-console
  console.log(rawMetricsLine)
  if (normalizedMetricsLine) {
    // eslint-disable-next-line no-console
    console.log(normalizedMetricsLine)
  }

  for (const result of results) {
    let status: 'PASS' | 'WARN' | 'FAIL' = 'PASS'
    if (!result.summary.passed) {
      status = 'FAIL'
    } else if (!result.summary.rawStrictPass || (result.summary.normalizedStrictPass === false) || !result.summary.importerClean) {
      status = 'WARN'
    }

    const caseLabel = `${result.fixture.dataset}/${result.fixture.caseId}`
    const metricsParts = [
      `RawF1 ${result.raw.metrics.componentF1.toFixed(2)}`,
      `RawStrict ${result.summary.rawStrictPass ? 'Y' : 'N'}`
    ]
    metricsParts.push(`RawField ${result.raw.metrics.fieldAccuracy.toFixed(2)}`)
    if (result.normalized) {
      metricsParts.push(`NormF1 ${result.normalized.metrics.componentF1.toFixed(2)}`)
      metricsParts.push(`NormStrict ${result.summary.normalizedStrictPass ? 'Y' : 'N'}`)
      metricsParts.push(`NormField ${result.normalized.metrics.fieldAccuracy.toFixed(2)}`)
    }
    metricsParts.push(`ImporterFix ${result.importerDiffs.length}`)

    // eslint-disable-next-line no-console
    console.log(`${status} ${caseLabel} → ${metricsParts.join(' | ')}`)

    const errorViolations = [
      ...result.raw.violations.filter(violation => violation.severity === 'error').map(violation => ({ phase: 'RAW', violation })),
      ...(result.normalized
        ? result.normalized.violations
            .filter(violation => violation.severity === 'error')
            .map(violation => ({ phase: 'NORMALIZED', violation }))
        : [])
    ]

    if (errorViolations.length > 0) {
      for (const { phase, violation } of errorViolations.slice(0, 5)) {
        // eslint-disable-next-line no-console
        console.log(`  - [${phase}/${violation.code}] ${violation.message}${violation.path ? ` (${violation.path})` : ''}`)
      }
      if (errorViolations.length > 5) {
        // eslint-disable-next-line no-console
        console.log(`  … ${errorViolations.length - 5} more violations`)
      }
    }

    if (result.importerDiffs.length > 0) {
      // eslint-disable-next-line no-console
      console.log(`  - [IMPORTER_FIX] ${result.importerDiffs.length} importer modifications detected.`)
      const diffSamples = result.importerDiffs.slice(0, 5)
      for (const diff of diffSamples) {
        const typeLabel =
          diff.rawType && diff.normalizedType && diff.rawType !== diff.normalizedType
            ? `${diff.rawType}→${diff.normalizedType}`
            : diff.rawType ?? diff.normalizedType ?? 'unknown'
        const location = diff.fieldPath ?? 'component'
        // eslint-disable-next-line no-console
        console.log(`    • ${diff.kind} @ ${location} (component ${diff.componentIndex}, ${typeLabel})`)
      }
      if (result.importerDiffs.length > diffSamples.length) {
        // eslint-disable-next-line no-console
        console.log(`    • … ${result.importerDiffs.length - diffSamples.length} more importer diffs`)
      }
    }
  }
}
