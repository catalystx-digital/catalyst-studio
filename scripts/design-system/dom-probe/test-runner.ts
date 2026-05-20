#!/usr/bin/env tsx
import fs from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

import { Command } from 'commander'

import {
  loadBaseline,
  evaluateCaptureAgainstBaseline,
  writeDiffReport,
  updateManifestWithEvaluation,
  type DomDesignSystemCapture,
  type DomProbeEvaluationResult
} from '@/lib/studio/design-system/dom-probe'
import { loadLatestRun } from '@/lib/studio/design-system/dom-probe/artifacts'
import { DomProbeService } from '@/lib/studio/design-system/dom-probe/service'

async function loadCapture(capturePath: string): Promise<DomDesignSystemCapture> {
  const raw = await fs.readFile(capturePath, 'utf-8')
  return JSON.parse(raw) as DomDesignSystemCapture
}

export interface EvaluationCliOptions {
  baseline: string
  refresh?: boolean
  url?: string
}

const BASELINE_URLS: Record<string, string> = {
  parra: 'https://www.parra.catholic.edu.au/',
  bathurst: 'https://bathurstcitycentre.qicre.com/',
  tio: 'https://www.tio.com.au/'
}

function resolveBaselineUrl(baseline: string): string | undefined {
  return BASELINE_URLS[baseline.trim().toLowerCase()]
}

function resolveArtifactPath(artifactPath: string): string {
  return path.isAbsolute(artifactPath) ? artifactPath : path.resolve(process.cwd(), artifactPath)
}

async function captureDomProbeRun(
  service: DomProbeService,
  baseline: string,
  urlOverride?: string
): Promise<{ capturePath: string; manifestPath: string }> {
  const targetUrl = urlOverride ?? resolveBaselineUrl(baseline)
  if (!targetUrl) {
    throw new Error(
      `No URL configured for baseline "${baseline}". Use --url to provide an explicit target.`
    )
  }

  const captureResult = await service.captureDesignSystem({
    websiteId: baseline,
    targetUrl,
    baselineKey: baseline,
    refresh: true,
    evaluation: true
  })

  const capturePath = resolveArtifactPath(captureResult.metadata.artifacts.captureJson)
  const manifestPath = resolveArtifactPath(captureResult.manifest.artifacts.manifest)
  return { capturePath, manifestPath }
}

export async function runEvaluation(options: EvaluationCliOptions): Promise<DomProbeEvaluationResult> {
  const baseline = options.baseline.toLowerCase()
  const refresh = Boolean(options.refresh)
  const overrideUrl = options.url ? String(options.url) : undefined
  const domProbeService = new DomProbeService()

  let capturePath: string
  let manifestPath: string

  if (refresh) {
    const run = await captureDomProbeRun(domProbeService, baseline, overrideUrl)
    capturePath = run.capturePath
    manifestPath = run.manifestPath
  } else {
    const latest = await loadLatestRun(baseline)
    if (!latest) {
      const run = await captureDomProbeRun(domProbeService, baseline, overrideUrl)
      capturePath = run.capturePath
      manifestPath = run.manifestPath
    } else {
      capturePath = latest.capturePath
      manifestPath = latest.manifestPath
    }
  }

  const capture = await loadCapture(capturePath)
  const baselineConfig = await loadBaseline(baseline)
  const evaluation = evaluateCaptureAgainstBaseline(capture, baselineConfig)

  const runDir = path.dirname(capture.metadata.artifacts.captureJson)
  const diffDir = path.join(runDir, 'diffs')
  const diffPath = await writeDiffReport(diffDir, evaluation)

  await updateManifestWithEvaluation(manifestPath, capture, evaluation, path.relative(process.cwd(), diffPath))

  const summary = evaluation.summary
  const paletteAgreementPercent = (summary.palette.agreementRatio * 100).toFixed(1)
  const paletteThresholdPercent = (summary.palette.agreementThreshold * 100).toFixed(0)
  const lines = [
    `Baseline: ${baseline}`,
    `Capture: ${path.relative(process.cwd(), capturePath)}`,
    `Diff: ${path.relative(process.cwd(), diffPath)}`,
    '',
    `Typography → matched ${summary.typography.matched}/${baselineConfig.typography.length}, missing ${summary.typography.missing}, unexpected ${summary.typography.unexpected}`,
    `Palette → agreement ${paletteAgreementPercent}% (threshold ${paletteThresholdPercent}%), matched ${summary.palette.matched}/${baselineConfig.palette.length}, missing ${summary.palette.missing}, unexpected ${summary.palette.unexpected}`,
    `Spacing → delta ${summary.spacing.delta.toFixed(2)}px (pass=${summary.spacing.passed})`
  ]
  // eslint-disable-next-line no-console
  console.log(lines.join('\n'))

  if (!summary.overall) {
    evaluation.notes.forEach(note => {
      // eslint-disable-next-line no-console
      console.warn(`⚠️  ${note}`)
    })
    process.exitCode = 1
  }

  return evaluation
}

async function main(): Promise<void> {
  const program = new Command()

  program
    .name('dom-probe-test')
    .description('DOM design system probe evaluation harness')
    .requiredOption('--baseline <name>', 'Baseline identifier (parra | bathurst | tio)')
    .option('--refresh', 'Force a new Playwright capture')
    .option('--url <url>', 'Override target URL for capture when refreshing')

  const argv = process.argv.filter(arg => arg !== '--')
  program.parse(argv)
  const options = program.opts<{ baseline: string; refresh?: boolean; url?: string }>()
  await runEvaluation(options)
}

const isCliEntry = (() => {
  try {
    const invocation = process.argv[1]
    if (!invocation) return false
    return import.meta.url === pathToFileURL(invocation).href
  } catch {
    return false
  }
})()

if (isCliEntry) {
  main().catch(error => {
    const message = error instanceof Error ? error.message : String(error)
    // eslint-disable-next-line no-console
    console.error(`DOM probe evaluation failed: ${message}`)
    process.exitCode = 1
  })
}
