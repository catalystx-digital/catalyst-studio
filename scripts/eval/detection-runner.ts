#!/usr/bin/env tsx
import { Command } from 'commander'

import { discoverFixtures } from '@/lib/studio/evals/detection/fixture-loader'
import { printSummary, runEvaluations } from '@/lib/studio/evals/detection/runner'

const program = new Command()

program.name('detection-runner').description('Component detection evaluation CLI')

program
  .command('list')
  .description('List available evaluation fixtures')
  .option('--dataset <dataset>', 'Filter by dataset')
  .option('--case <caseId>', 'Filter by case id')
  .action(async options => {
    const fixtures = await discoverFixtures({ dataset: options.dataset, caseId: options.case })
    fixtures.forEach(fixture => {
      // eslint-disable-next-line no-console
      console.log(`${fixture.dataset}/${fixture.caseId} → ${fixture.context.url}`)
    })
    if (fixtures.length === 0) {
      // eslint-disable-next-line no-console
      console.log('No fixtures found.')
    }
  })

program
  .command('run')
  .description('Run evaluation suite')
  .option('--dataset <dataset>', 'Dataset to run')
  .option('--case <caseId>', 'Specific case id')
  .option('--response <path>', 'Replay detection response from file')
  .option('--save-response <path>', 'Write detection response to path')
  .option('--record', 'Record live detection output using the detection service')
  .option('--model <model>', 'Model identifier for metadata')
  .option('--iterations <count>', 'Number of iterations', value => Number(value), 1)
  .option('--parallel <count>', 'Parallelism (unused placeholder)', value => Number(value), 1)
  .option('--report', 'Emit JSON report to reports/eval/detection')
  .option('--raw-only', 'Validate only the raw detector payload (skip normalized checks)')
  .option('--fail-on-importer-fix', 'Treat any importer modification as a failure')
  .action(async options => {
    const iterations = Math.max(1, Number(options.iterations || 1))
    const runOptions = {
      dataset: options.dataset as string | undefined,
      caseId: options.case as string | undefined,
      responsePath: options.response as string | undefined,
      saveResponse: options.saveResponse as string | undefined,
      record: Boolean(options.record),
      model: options.model as string | undefined,
      iterations,
      parallel: Number(options.parallel || 1),
      reportDir: options.report ? 'reports/eval/detection' : undefined,
      rawOnly: Boolean(options.rawOnly),
      failOnImporterFix: Boolean(options.failOnImporterFix)
    }

    const results = await runEvaluations(runOptions)
    printSummary(results)

    const failed = results.some(result => !result.summary.passed)
    if (failed) {
      process.exitCode = 1
    }
  })

program
  .command('report')
  .description('Run evaluation and produce report without console summary')
  .option('--dataset <dataset>', 'Dataset to run')
  .option('--case <caseId>', 'Specific case id')
  .option('--response <path>', 'Replay detection response from file')
  .option('--model <model>', 'Model identifier for metadata')
  .option('--raw-only', 'Validate only the raw detector payload (skip normalized checks)')
  .option('--fail-on-importer-fix', 'Treat any importer modification as a failure')
  .action(async options => {
    const results = await runEvaluations({
      dataset: options.dataset,
      caseId: options.case,
      responsePath: options.response,
      model: options.model,
      reportDir: 'reports/eval/detection',
      rawOnly: Boolean(options.rawOnly),
      failOnImporterFix: Boolean(options.failOnImporterFix)
    })
    const failed = results.some(result => !result.summary.passed)
    if (failed) {
      process.exitCode = 1
    }
  })

program.parse()
