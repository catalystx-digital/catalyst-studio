#!/usr/bin/env tsx
/**
 * Reads the shadow log and reports, per question, whether it is ready to be
 * flipped live and where its threshold should sit.
 *
 * Setting each cut at the widest gap in the question's observed distribution,
 * rather than at a round number, was worth more in the benchmark than any
 * rewording: F1 went from 0.653 to 0.857. This is that step, as a procedure
 * rather than a judgement call.
 *
 * A question whose widest gap is narrow is not separable. That is a signal to
 * reword the question, not to tune the number.
 *
 * Usage:
 *   tsx scripts/decisions/derive-thresholds.ts [logDir]
 */
import fs from 'node:fs'
import path from 'node:path'

interface Row {
  q: string
  v: number
  source: string
  p: number | null
  model: unknown
  fallback: unknown
  agreed: boolean | null
  url?: string
}

/** Below this, a question has not been observed enough to judge. */
const MIN_OBSERVATIONS = 30
/** A gap narrower than this means the question does not separate cleanly. */
const MIN_USEFUL_GAP = 0.15
/** Only look for a cut in the ambiguous middle; the tails are not decisions. */
const SEARCH_LOW = 0.2
const SEARCH_HIGH = 0.85

function readRows(file: string): Row[] {
  const rows: Row[] = []
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    if (!line.trim()) continue
    try {
      rows.push(JSON.parse(line) as Row)
    } catch {
      // A partially written final line is normal for an append-only log.
    }
  }
  return rows
}

function widestGap(values: number[]): { gap: number; threshold: number } | null {
  const sorted = [...values].sort((a, b) => a - b)
  let best: { gap: number; threshold: number } | null = null
  for (let i = 0; i < sorted.length - 1; i++) {
    const midpoint = (sorted[i] + sorted[i + 1]) / 2
    if (midpoint <= SEARCH_LOW || midpoint >= SEARCH_HIGH) continue
    const gap = sorted[i + 1] - sorted[i]
    if (!best || gap > best.gap) best = { gap, threshold: midpoint }
  }
  return best
}

function histogram(values: number[]): string {
  const buckets = new Array(10).fill(0)
  for (const value of values) {
    buckets[Math.min(9, Math.max(0, Math.floor(value * 10)))]++
  }
  const peak = Math.max(...buckets, 1)
  return buckets
    .map((count, i) => {
      const bar = '#'.repeat(Math.round((count / peak) * 24)).padEnd(24, '.')
      return `    ${(i / 10).toFixed(1)}-${((i + 1) / 10).toFixed(1)} ${bar} ${count}`
    })
    .join('\n')
}

function main(): void {
  const logDir = process.argv[2] || process.env.DECISION_MODEL_LOG_DIR || 'reports/decisions'

  if (!fs.existsSync(logDir)) {
    console.log(`No shadow log at ${logDir}.`)
    console.log('Nothing has been recorded yet. Enable the model in shadow mode and run an import:')
    console.log('  DECISION_MODEL_ENABLED=true DECISION_MODEL_SHADOW=true')
    return
  }

  const files = fs.readdirSync(logDir).filter(name => name.endsWith('.jsonl'))
  if (files.length === 0) {
    console.log(`No .jsonl files in ${logDir}.`)
    return
  }

  for (const file of files) {
    const rows = readRows(path.join(logDir, file))
    if (rows.length === 0) continue

    const questionId = rows[0].q
    // Numeric, not the default lexicographic sort: [1, 2, 10] would otherwise
    // order as [1, 10, 2] and every v10 row would be dropped as an old version.
    const versions = [...new Set(rows.map(row => row.v))].sort((a, b) => a - b)
    // Only the current version is comparable; instructions or criteria changed.
    const currentVersion = versions[versions.length - 1]
    const current = rows.filter(row => row.v === currentVersion)

    console.log(`\n${'='.repeat(72)}`)
    console.log(`${questionId}  (v${currentVersion})`)
    if (versions.length > 1) {
      console.log(`  ignoring ${rows.length - current.length} row(s) from earlier versions: v${versions.slice(0, -1).join(', v')}`)
    }

    const errors = current.filter(row => row.source === 'error')
    if (errors.length > 0) {
      console.log(`  ${errors.length} of ${current.length} calls failed`)
    }

    const probabilities = current
      .map(row => row.p)
      .filter((p): p is number => typeof p === 'number')

    if (probabilities.length < MIN_OBSERVATIONS) {
      console.log(`  NOT READY — ${probabilities.length} observations, need ${MIN_OBSERVATIONS}.`)
      continue
    }

    const comparable = current.filter(row => row.agreed !== null)
    const agreed = comparable.filter(row => row.agreed === true).length
    const agreementRate = comparable.length > 0 ? agreed / comparable.length : null

    console.log(`  observations: ${probabilities.length}`)
    if (agreementRate !== null) {
      console.log(`  agrees with the current heuristic: ${agreed}/${comparable.length} (${(agreementRate * 100).toFixed(0)}%)`)
    }
    console.log(histogram(probabilities))

    const gap = widestGap(probabilities)
    if (!gap) {
      console.log('  No gap found between 0.2 and 0.85. Every answer sits in the tails.')
    } else if (gap.gap < MIN_USEFUL_GAP) {
      console.log(`  NOT SEPARABLE — widest gap is only ${gap.gap.toFixed(2)}, at ${gap.threshold.toFixed(2)}.`)
      console.log('  Reword the question rather than tuning the number. A question that will')
      console.log('  not separate is a question that is asking two things at once.')
    } else {
      console.log(`  RECOMMENDED THRESHOLD: ${gap.threshold.toFixed(2)}  (widest gap ${gap.gap.toFixed(2)})`)
    }

    const disagreements = comparable.filter(row => row.agreed === false)
    if (disagreements.length > 0) {
      console.log(`\n  ${disagreements.length} disagreement(s). Read these before flipping the question live:`)
      for (const row of disagreements.slice(0, 10)) {
        console.log(`    p=${(row.p ?? 0).toFixed(2)}  model=${JSON.stringify(row.model)}  heuristic=${JSON.stringify(row.fallback)}  ${row.url ?? ''}`)
      }
      if (disagreements.length > 10) {
        console.log(`    …and ${disagreements.length - 10} more`)
      }
    }
  }

  console.log(`\n${'='.repeat(72)}`)
  console.log('A recommended threshold is not permission to flip a question live.')
  console.log('Read the disagreements first — the count is not the evidence, they are.')
}

main()
