#!/usr/bin/env tsx
import { promises as fsp } from 'node:fs'
import path from 'node:path'
import { Command } from 'commander'

import { runEvaluation } from './test-runner'

interface RegressionResult {
  baseline: string
  passed: boolean
  paletteAgreement: number
  paletteThreshold: number
  typography: {
    matched: number
    missing: number
    unexpected: number
  }
  spacingDelta: number
  spacingPassed: boolean
  notes: string[]
}

interface RegressionReport {
  generatedAt: string
  baselines: RegressionResult[]
  failures: string[]
  refresh: boolean
}

async function listBaselines(): Promise<string[]> {
  const baselineDir = path.join(process.cwd(), 'data', 'design-system', 'dom-probe', 'baselines')
  const entries = await fsp.readdir(baselineDir)
  return entries
    .filter(entry => entry.endsWith('.json'))
    .map(entry => entry.replace(/\.json$/i, ''))
    .sort()
}

async function runRegression(baselines: string[], refresh: boolean): Promise<RegressionReport> {
  const results: RegressionResult[] = []
  for (const baseline of baselines) {
    const evaluation = await runEvaluation({ baseline, refresh })
    // reset exit code that runEvaluation may have set so we can decide later
    process.exitCode = undefined
    const summary = evaluation.summary
    results.push({
      baseline,
      passed: summary.overall,
      paletteAgreement: summary.palette.agreementRatio,
      paletteThreshold: summary.palette.agreementThreshold,
      typography: {
        matched: summary.typography.matched,
        missing: summary.typography.missing,
        unexpected: summary.typography.unexpected
      },
      spacingDelta: summary.spacing.delta,
      spacingPassed: summary.spacing.passed,
      notes: evaluation.notes
    })
  }

  const failures = results.filter(result => !result.passed).map(result => result.baseline)

  return {
    generatedAt: new Date().toISOString(),
    baselines: results,
    failures,
    refresh
  }
}

function printTable(report: RegressionReport): void {
  console.log('')
  console.log('DOM Probe Regression Summary')
  console.log('Generated:', report.generatedAt)
  console.log('Refresh captures:', report.refresh ? 'yes' : 'no')
  console.log('')

  const headers = ['Baseline', 'Status', 'Palette', 'Typography', 'Spacing Δ', 'Notes']
  const rows = report.baselines.map(result => {
    const palettePercent = `${Math.round(result.paletteAgreement * 100)}%`
    const paletteStatus =
      result.paletteAgreement >= result.paletteThreshold ? palettePercent : `${palettePercent} ⚠`
    const typographySummary = `${result.typography.matched}/${result.typography.matched + result.typography.missing}`
    const spacingSummary = `${result.spacingDelta.toFixed(2)}${result.spacingPassed ? '' : ' ⚠'}`
    const status = result.passed ? '✅ Pass' : '❌ Fail'
    const note = result.notes.slice(0, 2).join(' | ')
    return [result.baseline, status, paletteStatus, typographySummary, spacingSummary, note]
  })

  const columnWidths = headers.map((header, index) =>
    Math.max(
      header.length,
      ...rows.map(row => String(row[index]).length)
    )
  )

  const formatRow = (values: string[]) =>
    values
      .map((value, index) => {
        const padded = value.padEnd(columnWidths[index], ' ')
        return ` ${padded} `
      })
      .join('|')

  console.log(formatRow(headers))
  console.log(columnWidths.map(width => '-'.repeat(width + 2)).join('+'))
  rows.forEach(row => {
    console.log(formatRow(row.map(String)))
  })
  console.log('')
}

async function writeReport(report: RegressionReport, outputPath: string): Promise<void> {
  const payload = JSON.stringify(report, null, 2)
  await fsp.mkdir(path.dirname(outputPath), { recursive: true })
  await fsp.writeFile(outputPath, payload, 'utf-8')
}

async function main(): Promise<void> {
  const program = new Command()

  program
    .name('dom-probe-regression')
    .description('Run DOM probe regression evaluations for the configured baselines')
    .option('--baselines <list>', 'Comma-separated baseline identifiers (defaults to known baselines)')
    .option('--no-refresh', 'Use cached captures instead of forcing a new Playwright run')
    .option('--output <path>', 'Write JSON report to the specified path')
    .option('--json', 'Print JSON summary to stdout', false)

  const argv = process.argv.filter(arg => arg !== '--')
  program.parse(argv)
  const options = program.opts<{ baselines?: string; refresh?: boolean; output?: string; json?: boolean }>()

  const baselineList =
    options.baselines && options.baselines.length > 0
      ? options.baselines.split(',').map(item => item.trim()).filter(Boolean)
      : await listBaselines()

  if (baselineList.length === 0) {
    throw new Error('No baselines configured. Provide --baselines or ensure baseline JSON files exist.')
  }

  const refresh = options.refresh !== undefined ? options.refresh : true
  const report = await runRegression(baselineList, refresh)

  if (options.output) {
    await writeReport(report, path.resolve(options.output))
    console.log(`Regression report written to ${path.resolve(options.output)}`)
  }

  if (options.json) {
    console.log(JSON.stringify(report, null, 2))
  } else {
    printTable(report)
  }

  if (report.failures.length > 0) {
    console.error(`Regression failures detected for: ${report.failures.join(', ')}`)
    process.exitCode = 1
  }
}

main().catch(error => {
  const message = error instanceof Error ? error.message : String(error)
  console.error('DOM probe regression run failed:', message)
  process.exitCode = 1
})
