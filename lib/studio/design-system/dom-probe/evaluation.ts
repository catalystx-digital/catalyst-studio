import fsp from 'node:fs/promises'
import path from 'node:path'

import type {
  DomDesignSystemCapture,
  DomPaletteCapture,
  DomPaletteSwatch,
  DomSpacingCapture,
  DomTypographySample
} from './types'
import { ensureDir, renderManifestMarkdown } from './artifacts'
import type { DomProbeManifest } from './types'

export interface TypographyExpectation {
  id: string
  role?: DomTypographySample['role']
  fontFamily: string
  fontWeight?: string
  fontSizePx: number
  tolerancePx?: number
}

export interface PaletteExpectation {
  hex: string
  role?: DomPaletteSwatch['role']
  toleranceDeltaE?: number
}

export interface SpacingExpectation {
  baseUnitPx: number
  tolerancePx?: number
  scale?: number[]
}

export interface DomDesignSystemBaseline {
  typography: TypographyExpectation[]
  palette: PaletteExpectation[]
  spacing: SpacingExpectation
  metadata?: {
    url?: string
    notes?: string[]
    updatedAt?: string
  }
}

export interface TypographyMatchResult {
  expectation: TypographyExpectation
  sample?: DomTypographySample
  sizeDelta?: number
}

export interface PaletteMatchResult {
  expectation: PaletteExpectation
  swatch?: DomPaletteSwatch
  deltaE?: number
  passed: boolean
}

export interface SpacingMatchResult {
  expectation: SpacingExpectation
  baseUnitDelta?: number
  matchedScaleValues: number[]
  missingScaleValues: number[]
}

export interface EvaluationSummary {
  typography: {
    passed: boolean
    matched: number
    missing: number
    unexpected: number
  }
  palette: {
    passed: boolean
    matched: number
    missing: number
    unexpected: number
    agreementRatio: number
    agreementThreshold: number
  }
  spacing: {
    passed: boolean
    delta: number
  }
  overall: boolean
}

export interface DomProbeEvaluationResult {
  baseline: DomDesignSystemBaseline
  capture: DomDesignSystemCapture
  typography: {
    matches: TypographyMatchResult[]
    missing: TypographyExpectation[]
    unexpected: DomTypographySample[]
    passed: boolean
  }
  palette: {
    matches: PaletteMatchResult[]
    missing: PaletteExpectation[]
    unexpected: DomPaletteSwatch[]
    passed: boolean
  }
  spacing: {
    result: SpacingMatchResult
    passed: boolean
  }
  summary: EvaluationSummary
  notes: string[]
}

function normalizeHex(hex: string): string {
  let value = hex.trim().toLowerCase()
  if (!value.startsWith('#')) value = `#${value}`
  if (value.length === 4) {
    value = `#${value[1]}${value[1]}${value[2]}${value[2]}${value[3]}${value[3]}`
  }
  return value
}

// Threshold aligns with PRD §6.7 requirement for palette deltaE agreement.
const DEFAULT_PALETTE_DELTA_E_THRESHOLD = 5
const PALETTE_AGREEMENT_THRESHOLD = 0.9

interface LabColor {
  l: number
  a: number
  b: number
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const normalized = normalizeHex(hex)
  if (!/^#[0-9a-f]{6}$/i.test(normalized)) return null
  return {
    r: parseInt(normalized.slice(1, 3), 16),
    g: parseInt(normalized.slice(3, 5), 16),
    b: parseInt(normalized.slice(5, 7), 16)
  }
}

function srgbToLinear(value: number): number {
  const channel = value / 255
  return channel <= 0.04045 ? channel / 12.92 : Math.pow((channel + 0.055) / 1.055, 2.4)
}

function rgbToLab(hex: string): LabColor | null {
  const rgb = hexToRgb(hex)
  if (!rgb) return null
  const r = srgbToLinear(rgb.r)
  const g = srgbToLinear(rgb.g)
  const b = srgbToLinear(rgb.b)

  const x = r * 0.4124 + g * 0.3576 + b * 0.1805
  const y = r * 0.2126 + g * 0.7152 + b * 0.0722
  const z = r * 0.0193 + g * 0.1192 + b * 0.9505

  const referenceX = 0.95047 // D65
  const referenceY = 1.0
  const referenceZ = 1.08883

  const transform = (value: number) => {
    const epsilon = 216 / 24389
    const kappa = 24389 / 27
    return value > epsilon ? Math.cbrt(value) : (kappa * value + 16) / 116
  }

  const fx = transform(x / referenceX)
  const fy = transform(y / referenceY)
  const fz = transform(z / referenceZ)

  return {
    l: 116 * fy - 16,
    a: 500 * (fx - fy),
    b: 200 * (fy - fz)
  }
}

function calculateDeltaE(a: LabColor, b: LabColor): number {
  const deltaL = a.l - b.l
  const deltaA = a.a - b.a
  const deltaB = a.b - b.b
  return Math.sqrt(deltaL * deltaL + deltaA * deltaA + deltaB * deltaB)
}

function matchTypography(expectation: TypographyExpectation, samples: DomTypographySample[]): TypographyMatchResult {
  const tolerance = expectation.tolerancePx ?? 1
  const targetFamily = expectation.fontFamily.trim().toLowerCase()
  const matches = samples.filter(sample => {
    const sameFamily = sample.fontFamily.trim().toLowerCase() === targetFamily
    if (!sameFamily) return false
    if (expectation.role && sample.role !== expectation.role) return false
    if (expectation.fontWeight && sample.fontWeight !== expectation.fontWeight) return false
    return true
  })
  if (matches.length === 0) {
    return { expectation }
  }
  const scored = matches
    .map(sample => ({
      sample,
      sizeDelta: Math.abs(sample.fontSizePx - expectation.fontSizePx)
    }))
    .sort((a, b) => a.sizeDelta - b.sizeDelta)
  const best = scored[0]
  if (best.sizeDelta <= tolerance) {
    return { expectation, sample: best.sample, sizeDelta: best.sizeDelta }
  }
  return { expectation }
}

function matchPalette(expectation: PaletteExpectation, palette: DomPaletteCapture): PaletteMatchResult {
  const targetHex = normalizeHex(expectation.hex)
  const targetLab = rgbToLab(targetHex)
  if (!targetLab) {
    return { expectation, passed: false }
  }

  const threshold = expectation.toleranceDeltaE ?? DEFAULT_PALETTE_DELTA_E_THRESHOLD
  const roleMatches = (swatch: DomPaletteSwatch) => {
    if (!expectation.role || !swatch.role) return true
    return expectation.role === swatch.role
  }

  const evaluateSwatch = (swatch: DomPaletteSwatch) => {
    const lab = rgbToLab(swatch.hex)
    if (!lab) return null
    const deltaE = calculateDeltaE(targetLab, lab)
    return { swatch, deltaE }
  }

  let candidates = palette.colors
    .filter(roleMatches)
    .map(evaluateSwatch)
    .filter((candidate): candidate is { swatch: DomPaletteSwatch; deltaE: number } => candidate !== null)

  if (candidates.length === 0) {
    candidates = palette.colors
      .map(evaluateSwatch)
      .filter((candidate): candidate is { swatch: DomPaletteSwatch; deltaE: number } => candidate !== null)
  }

  if (candidates.length === 0) {
    return { expectation, passed: false }
  }

  candidates.sort((a, b) => a.deltaE - b.deltaE)
  const best = candidates[0]
  const passed = best.deltaE <= threshold
  return {
    expectation,
    swatch: best.swatch,
    deltaE: best.deltaE,
    passed
  }
}

function evaluateSpacing(expectation: SpacingExpectation, spacing: DomSpacingCapture): SpacingMatchResult {
  const tolerance = expectation.tolerancePx ?? 2
  const delta = spacing.baseUnitPx === null ? Infinity : Math.abs(spacing.baseUnitPx - expectation.baseUnitPx)
  const scale = expectation.scale ?? []
  const matchedScale = spacing.scale
    .map(token => token.valuePx)
    .filter(value => scale.some(expected => Math.abs(expected - value) <= tolerance))
  const missingScale = scale.filter(expected => !matchedScale.some(value => Math.abs(value - expected) <= tolerance))
  return {
    expectation,
    baseUnitDelta: delta === Infinity ? undefined : delta,
    matchedScaleValues: matchedScale,
    missingScaleValues: missingScale
  }
}

function summarizeTypography(matches: TypographyMatchResult[], samples: DomTypographySample[]): {
  missing: TypographyExpectation[]
  unexpected: DomTypographySample[]
  passed: boolean
} {
  const missing = matches.filter(match => !match.sample).map(match => match.expectation)
  const matchedSampleIds = new Set(matches.filter(match => match.sample).map(match => match.sample!.id))
  const unexpected = samples.filter(sample => !matchedSampleIds.has(sample.id))
  const passed = missing.length === 0
  return { missing, unexpected, passed }
}

function summarizePalette(matches: PaletteMatchResult[], palette: DomPaletteCapture): {
  missing: PaletteExpectation[]
  unexpected: DomPaletteSwatch[]
  passed: boolean
  agreementRatio: number
} {
  const successfulMatches = matches.filter(match => match.passed && match.swatch)
  const missing = matches.filter(match => !match.passed).map(match => match.expectation)
  const matchedHexes = new Set(successfulMatches.map(match => normalizeHex(match.swatch!.hex)))
  const unexpected = palette.colors.filter(color => !matchedHexes.has(normalizeHex(color.hex)))
  const agreementRatio = matches.length === 0 ? 1 : successfulMatches.length / matches.length
  const passed = agreementRatio >= PALETTE_AGREEMENT_THRESHOLD
  return { missing, unexpected, passed, agreementRatio }
}

export function evaluateCaptureAgainstBaseline(
  capture: DomDesignSystemCapture,
  baseline: DomDesignSystemBaseline
): DomProbeEvaluationResult {
  const typographyMatches = baseline.typography.map(expectation => matchTypography(expectation, capture.typography))
  const typographySummary = summarizeTypography(typographyMatches, capture.typography)

  const paletteMatches = baseline.palette.map(expectation => matchPalette(expectation, capture.palette))
  const paletteSummary = summarizePalette(paletteMatches, capture.palette)
  const paletteMatchedCount = paletteMatches.filter(match => match.passed).length

  const spacingResult = evaluateSpacing(baseline.spacing, capture.spacing)
  const spacingPassed = typeof spacingResult.baseUnitDelta === 'number' ? spacingResult.baseUnitDelta <= (baseline.spacing.tolerancePx ?? 2) : false

  const summary: EvaluationSummary = {
    typography: {
      passed: typographySummary.passed,
      matched: typographyMatches.length - typographySummary.missing.length,
      missing: typographySummary.missing.length,
      unexpected: typographySummary.unexpected.length
    },
    palette: {
      passed: paletteSummary.passed,
      matched: paletteMatchedCount,
      missing: paletteSummary.missing.length,
      unexpected: paletteSummary.unexpected.length,
      agreementRatio: paletteSummary.agreementRatio,
      agreementThreshold: PALETTE_AGREEMENT_THRESHOLD
    },
    spacing: {
      passed: spacingPassed,
      delta: spacingResult.baseUnitDelta ?? Infinity
    },
    overall: typographySummary.passed && paletteSummary.passed && spacingPassed
  }

  const notes: string[] = []
  if (!summary.typography.passed) {
    notes.push(`Missing typography styles: ${typographySummary.missing.map(item => item.id).join(', ') || 'n/a'}`)
  }
  if (!summary.palette.passed) {
    const agreementPercent = (summary.palette.agreementRatio * 100).toFixed(1)
    const thresholdPercent = (summary.palette.agreementThreshold * 100).toFixed(0)
    notes.push(`Palette agreement ${agreementPercent}% below ${thresholdPercent}% threshold`)
    if (paletteSummary.missing.length > 0) {
      notes.push(`Missing palette colors: ${paletteSummary.missing.map(item => item.hex).join(', ') || 'n/a'}`)
    }
    paletteMatches
      .filter(match => !match.passed && typeof match.deltaE === 'number')
      .forEach(match => {
        notes.push(
          `Color ${match.expectation.hex} deviates by ΔE ${match.deltaE!.toFixed(2)} (tolerance ${
            match.expectation.toleranceDeltaE ?? DEFAULT_PALETTE_DELTA_E_THRESHOLD
          })`
        )
      })
  }
  if (!spacingPassed && spacingResult.baseUnitDelta !== undefined) {
    notes.push(`Spacing delta ${spacingResult.baseUnitDelta.toFixed(2)}px exceeds tolerance ${baseline.spacing.tolerancePx ?? 2}px`)
  }

  return {
    baseline,
    capture,
    typography: {
      matches: typographyMatches,
      missing: typographySummary.missing,
      unexpected: typographySummary.unexpected,
      passed: typographySummary.passed
    },
    palette: {
      matches: paletteMatches,
      missing: paletteSummary.missing,
      unexpected: paletteSummary.unexpected,
      passed: paletteSummary.passed
    },
    spacing: {
      result: spacingResult,
      passed: spacingPassed
    },
    summary,
    notes
  }
}

export async function loadBaseline(baseline: string): Promise<DomDesignSystemBaseline> {
  const root = process.env.DOM_PROBE_BASELINE_ROOT
    ? path.resolve(process.env.DOM_PROBE_BASELINE_ROOT)
    : path.join(process.cwd(), 'data', 'design-system', 'dom-probe', 'baselines')
  const baselinePath = path.join(root, `${baseline}.json`)
  const raw = await fsp.readFile(baselinePath, 'utf-8')
  return JSON.parse(raw) as DomDesignSystemBaseline
}

export async function writeDiffReport(diffDir: string, result: DomProbeEvaluationResult): Promise<string> {
  await ensureDir(diffDir)
  const payload = {
    summary: result.summary,
    typography: {
      matches: result.typography.matches.map(match => ({
        expectation: match.expectation,
        sample: match.sample ? { id: match.sample.id, fontFamily: match.sample.fontFamily, fontSizePx: match.sample.fontSizePx, role: match.sample.role } : null,
        sizeDelta: match.sizeDelta ?? null
      })),
      missing: result.typography.missing,
      unexpected: result.typography.unexpected.map(sample => ({ id: sample.id, fontFamily: sample.fontFamily, fontSizePx: sample.fontSizePx, role: sample.role }))
    },
    palette: {
      matches: result.palette.matches.map(match => ({
        expectation: match.expectation,
        swatch: match.swatch
          ? { hex: match.swatch.hex, role: match.swatch.role, occurrences: match.swatch.occurrences }
          : null,
        deltaE: typeof match.deltaE === 'number' ? match.deltaE : null,
        passed: match.passed
      })),
      missing: result.palette.missing,
      unexpected: result.palette.unexpected.map(color => ({ hex: color.hex, role: color.role, occurrences: color.occurrences }))
    },
    spacing: result.spacing,
    notes: result.notes
  }
  const outputPath = path.join(diffDir, 'diff.json')
  await fsp.writeFile(outputPath, JSON.stringify(payload, null, 2), 'utf-8')
  return outputPath
}

export async function updateManifestWithEvaluation(
  manifestPath: string,
  capture: DomDesignSystemCapture,
  evaluation: DomProbeEvaluationResult,
  diffPath: string
): Promise<void> {
  const manifestRaw = await fsp.readFile(manifestPath, 'utf-8')
  const manifest = JSON.parse(manifestRaw) as DomProbeManifest
  manifest.artifacts.diffs = [diffPath]
  manifest.checkpoints.CP3 = { completed: true, artifact: diffPath }
  manifest.status = evaluation.summary.overall ? manifest.status : 'failed'
  if (!evaluation.summary.overall) {
    manifest.errors.push('Evaluation failed – see diff report for details')
  }
  manifest.notes = Array.from(new Set([...(manifest.notes ?? []), ...evaluation.notes]))
  await fsp.writeFile(manifestPath, JSON.stringify(manifest, null, 2))
  const markdown = renderManifestMarkdown(manifest, capture.metadata.runnerVersion)
  const markdownPath = manifestPath.replace(/\.json$/i, '.md')
  await fsp.writeFile(markdownPath, markdown, 'utf-8')
}
