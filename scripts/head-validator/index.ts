#!/usr/bin/env tsx
import { Command } from 'commander'
import { resolve, join } from 'node:path'
import { spawn } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { logger } from '../generate-head/utils/logger'
import { ensureCliEnvLoaded } from '../generate-head/utils/env'
import { ensureEmptyDirectory } from '../generate-head/utils/fs'
import { generateHeadProject } from '../generate-head/core/generator'
import type { RouteDefinition } from '../generate-head/core/types'

interface ValidationReport {
  websiteId: string
  slug: string
  pageId: string
  expectedCount: number
  renderedCount: number
  missingIds: Array<{ id: string; type: string; region?: string | null }>
  unexpectedIds: Array<{ id: string; type?: string }>
  typeMismatches: Array<{ id: string; expectedType: string; renderedType: string }>
  generatorDiagnostics: any[]
  runtimeDiagnostics: any[]
  generatedAt: string
}

const program = new Command()
const require = createRequire(import.meta.url)

function normalizeSlugForProvider(input: string, provider: string): string {
  const value = input.trim()

  if (provider === 'stub') {
    if (value === '/' || value === '') {
      return 'home'
    }

    return value.replace(/^\/+/, '')
  }

  if (value === '') {
    return '/'
  }

  return value.startsWith('/') ? value : `/${value.replace(/^\/+/, '')}`
}

function deriveSlugsToValidate(provider: string, routes: RouteDefinition[], explicitSlug?: string): string[] {
  if (explicitSlug) {
    return [normalizeSlugForProvider(explicitSlug, provider)]
  }

  const slugSet = new Set<string>()

  for (const route of routes) {
    if (!route.fullPath) continue
    const normalized = normalizeSlugForProvider(route.fullPath, provider)
    if (!slugSet.has(normalized)) {
      slugSet.add(normalized)
    }
  }

  if (slugSet.size === 0) {
    return [provider === 'stub' ? 'home' : '/']
  }

  return Array.from(slugSet)
}

function slugToKey(slug: string): string {
  if (slug === '/') {
    return 'root'
  }

  return slug.replace(/^\/+/, '').replace(/[^a-z0-9_-]+/gi, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') || 'root'
}

program
  .name('head-validator')
  .description('Catalyst head runtime validation harness')
  .requiredOption('--website-id <id>', 'Website ID to validate')
  .option('--provider <provider>', 'Provider to use (ucs or stub)', 'ucs')
  .option('--slug <slug>', 'Slug to validate (default: all pages)')
  .option('--output <dir>', 'Output directory (default tmp/head-validator/<websiteId>)')
  .option('--force', 'Overwrite output directory if it already exists', false)
  .option('--dry-run', 'Do not write files or run validation', false)
  .allowExcessArguments(false)

async function copyDatabaseConnectionStrings(outputDir: string): Promise<void> {
  try {
    const mainEnvPath = resolve(process.cwd(), '.env.local')
    const generatedEnvPath = resolve(outputDir, '.env.local')

    if (!existsSync(mainEnvPath)) {
      logger.warn('Main .env.local file not found, skipping database connection copy')
      return
    }

    // Read main .env.local
    const mainEnvContent = readFileSync(mainEnvPath, 'utf8')

    // Extract database connection strings
    const databaseUrlMatch = mainEnvContent.match(/^DATABASE_URL=.*$/m)
    const directUrlMatch = mainEnvContent.match(/^DIRECT_URL=.*$/m)

    if (!databaseUrlMatch && !directUrlMatch) {
      logger.warn('No database connection strings found in main .env.local')
      return
    }

    // Read generated .env.local
    let generatedEnvContent = ''
    if (existsSync(generatedEnvPath)) {
      generatedEnvContent = readFileSync(generatedEnvPath, 'utf8')
    }

    // Update database connection strings in generated .env.local
    const lines = generatedEnvContent.split('\n')
    let updatedLines = lines.map(line => {
      if (line.startsWith('DATABASE_URL=')) {
        return databaseUrlMatch ? databaseUrlMatch[0] : line
      }
      if (line.startsWith('DIRECT_URL=')) {
        return directUrlMatch ? directUrlMatch[0] : line
      }
      return line
    })

    // If DATABASE_URL wasn't found in generated file, add it
    if (!updatedLines.some(line => line.startsWith('DATABASE_URL=')) && databaseUrlMatch) {
      updatedLines = [databaseUrlMatch[0], ...updatedLines]
    }

    // If DIRECT_URL wasn't found in generated file, add it
    if (!updatedLines.some(line => line.startsWith('DIRECT_URL=')) && directUrlMatch) {
      updatedLines = [directUrlMatch[0], ...updatedLines]
    }

    // Write updated content back
    writeFileSync(generatedEnvPath, updatedLines.join('\n'), 'utf8')

    logger.info('Database connection strings copied to generated project', {
      hasDatabaseUrl: !!databaseUrlMatch,
      hasDirectUrl: !!directUrlMatch,
      generatedEnvPath,
      envFileExists: existsSync(generatedEnvPath)
    })

    // Verify the copied content
    if (existsSync(generatedEnvPath)) {
      const updatedContent = readFileSync(generatedEnvPath, 'utf8')
      const copiedDatabaseUrl = updatedContent.match(/^DATABASE_URL=(.*)$/m)?.[1]
      const copiedDirectUrl = updatedContent.match(/^DIRECT_URL=(.*)$/m)?.[1]

      logger.info('Verification - copied database strings:', {
        databaseUrlLength: copiedDatabaseUrl?.length || 0,
        directUrlLength: copiedDirectUrl?.length || 0,
        databaseUrlStart: copiedDatabaseUrl?.substring(0, 50) + '...'
      })
    }

  } catch (error) {
    logger.error('Failed to copy database connection strings:', error instanceof Error ? error.message : String(error))
  }
}

async function spawnProbe(outputDir: string, slug: string | undefined, websiteId: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const databaseUrl = process.env.DATABASE_URL || ''
    const directUrl = process.env.DIRECT_URL || ''

    const env = {
      ...process.env,
      HEAD_RUNTIME_COMPONENT_PROBE: '1',
      HEAD_RUNTIME_WEBSITE_ID: websiteId,
      DATABASE_URL: databaseUrl,
      DIRECT_URL: directUrl
    }

    logger.info('Probe environment:', {
      HEAD_RUNTIME_COMPONENT_PROBE: env.HEAD_RUNTIME_COMPONENT_PROBE,
      HEAD_RUNTIME_WEBSITE_ID: env.HEAD_RUNTIME_WEBSITE_ID,
      DATABASE_URL: databaseUrl ? '[SET]' : '[NOT SET]',
      DIRECT_URL: directUrl ? '[SET]' : '[NOT SET]'
    })

    const repoRoot = process.cwd()
    const probeScript = join(outputDir, 'generated', 'validation', 'run.ts')
    logger.info('Probe script path:', { probeScript, outputDir })

    const tsxCli = require.resolve('tsx/cli')
    const args = [tsxCli, 'generated/validation/run.ts']
    if (typeof slug === 'string') {
      args.push('--slug', slug)
    }

    const child = spawn(
      process.execPath,
      args,
      {
        stdio: ['ignore', 'pipe', 'pipe'],
        env,
        cwd: outputDir
      }
    )

    let stdout = ''
    let stderr = ''

    if (child.stdout) {
      child.stdout.on('data', (data) => {
        const text = data.toString()
        stdout += text
        logger.info(text.trim())
      })
    }

    if (child.stderr) {
      child.stderr.on('data', (data) => {
        const text = data.toString()
        stderr += text
        logger.warn(text.trim())
      })
    }

    child.on('error', (error) => {
      reject(error)
    })

    child.on('close', (code) => {
      if (code === 0) {
        resolve()
      } else if (code === 2) {
        // Validation completed with discrepancies - this is expected behavior
        resolve()
      } else {
        reject(new Error(`Probe runner exited with code ${code}\n${stderr}`))
      }
    })
  })
}

async function run(): Promise<void> {
  program.parse(process.argv)
  const options = program.opts<{
    websiteId: string
    provider: string
    slug?: string
    output?: string
    force: boolean
    dryRun: boolean
  }>()

  // Load environment before touching Prisma
  ensureCliEnvLoaded()

  // Resolve output directory
  const outputDir = resolve(options.output ?? `tmp/head-validator/${options.websiteId}`)

  logger.info('Head validator configuration', {
    websiteId: options.websiteId,
    provider: options.provider,
    slug: options.slug ?? '(all)',
    outputDir,
    force: options.force,
    dryRun: options.dryRun
  })

  if (options.dryRun) {
    logger.info('Dry run mode - exiting without generation')
    return
  }

  // Ensure output directory is empty
  await ensureEmptyDirectory(outputDir, { force: options.force })

  // Generate head project
  logger.info(`Generating head project with provider: ${options.provider}...`)
  const result = await generateHeadProject({
    outputDir,
    provider: options.provider as 'ucs' | 'stub',
    websiteId: options.provider === 'stub' ? undefined : options.websiteId,
    dryRun: false,
    force: options.force
  })

  // Copy database connection strings from main .env.local to generated subapp
  if (options.provider === 'ucs') {
    await copyDatabaseConnectionStrings(outputDir)
  }

  // Store snapshot and metadata for validation (Story 2 requirement)
  const { snapshot, diagnostics, routes, manifest, diagnosticSummary } = result

  // Log generation summary
  logger.info('Generation complete.', {
    pages: snapshot.pages.length,
    sharedComponentCount: snapshot.sharedComponents.length
  })
  logger.info('Diagnostic summary', { ...diagnosticSummary })

  if (diagnosticSummary.errorCount > 0) {
    logger.warn('Generation completed with errors', { ...diagnosticSummary })
    // Continue even if diagnostics include errors (per PRD requirement)
  }

  // Story 5: Execute probe and aggregate report
  logger.info('Running validation probe...')

  const slugsToValidate = deriveSlugsToValidate(options.provider, routes, options.slug)
  logger.info('Validation targets', { slugs: slugsToValidate, count: slugsToValidate.length })

  const aggregatedReports: ValidationReport[] = []
  const failedSlugs: Array<{ slug: string; error: string }> = []
  let hasDiscrepancies = false

  try {
    for (const slug of slugsToValidate) {
      logger.info(`Running probe for slug: ${slug}`)

      try {
        await spawnProbe(outputDir, slug, options.websiteId)
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        logger.error('Probe execution failed for slug', { slug, error: message })
        failedSlugs.push({ slug, error: message })
        continue
      }

      const reportPath = resolve(outputDir, 'generated', 'validation', 'report.json')
      if (!existsSync(reportPath)) {
        const message = 'Probe completed but no report found at expected location'
        logger.error(message, { slug })
        failedSlugs.push({ slug, error: message })
        process.exitCode = 1
        continue
      }

      let report: ValidationReport
      try {
        const reportJson = readFileSync(reportPath, 'utf8')
        report = JSON.parse(reportJson) as ValidationReport
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        logger.error('Failed to read validation report', { slug, error: message })
        failedSlugs.push({ slug, error: message })
        process.exitCode = 1
        continue
      }

      aggregatedReports.push(report)

      logger.info('Validation Results:', {
        slug: report.slug,
        expected: report.expectedCount,
        rendered: report.renderedCount,
        missing: report.missingIds.length,
        unexpected: report.unexpectedIds.length,
        typeMismatches: report.typeMismatches.length,
        generatorDiagnostics: report.generatorDiagnostics.length,
        runtimeDiagnostics: report.runtimeDiagnostics.length
      })

      if (report.missingIds.length > 0) {
        hasDiscrepancies = true
        logger.warn(`Missing components for slug ${report.slug}:`)
        report.missingIds.forEach((item: any) => {
          logger.warn(`  - ${item.id} (${item.type}, region: ${item.region || 'none'})`)
        })
      }

      if (report.unexpectedIds.length > 0) {
        hasDiscrepancies = true
        logger.warn(`Unexpected components for slug ${report.slug}:`)
        report.unexpectedIds.forEach((item: any) => {
          logger.warn(`  - ${item.id} (${item.type || 'unknown'})`)
        })
      }

      if (report.typeMismatches.length > 0) {
        hasDiscrepancies = true
        logger.warn(`Type mismatches for slug ${report.slug}:`)
        report.typeMismatches.forEach((item: any) => {
          logger.warn(`  - ${item.id}: expected ${item.expectedType}, got ${item.renderedType}`)
        })
      }

      // Persist per-slug report snapshot for later inspection
      const slugReportPath = resolve(outputDir, 'generated', 'validation', `report-${slugToKey(report.slug)}.json`)
      writeFileSync(slugReportPath, JSON.stringify(report, null, 2), 'utf8')

      const txtReportPath = resolve(outputDir, 'generated', 'validation', 'report.txt')
      if (existsSync(txtReportPath)) {
        const txtContent = readFileSync(txtReportPath, 'utf8')
        const slugTxtPath = resolve(outputDir, 'generated', 'validation', `report-${slugToKey(report.slug)}.txt`)
        writeFileSync(slugTxtPath, txtContent, 'utf8')
      }
    }

    const aggregateSummary = aggregatedReports.reduce(
      (acc, report) => {
        acc.expected += report.expectedCount
        acc.rendered += report.renderedCount
        acc.missing += report.missingIds.length
        acc.unexpected += report.unexpectedIds.length
        acc.typeMismatches += report.typeMismatches.length
        return acc
      },
      { expected: 0, rendered: 0, missing: 0, unexpected: 0, typeMismatches: 0 }
    )

    if (aggregatedReports.length > 0) {
      logger.info('Aggregate validation results:', aggregateSummary)
    }

    const aggregateReportPath = resolve(outputDir, 'generated', 'validation', 'report.all.json')
    writeFileSync(
      aggregateReportPath,
      JSON.stringify(
        {
          websiteId: options.websiteId,
          provider: options.provider,
          generatedAt: new Date().toISOString(),
          totals: aggregateSummary,
          reports: aggregatedReports,
          failures: failedSlugs
        },
        null,
        2
      ),
      'utf8'
    )

    if (failedSlugs.length > 0) {
      logger.warn('Validation completed with errors on some slugs', {
        failedCount: failedSlugs.length,
        slugs: failedSlugs.map(item => item.slug)
      })
    }

    if (hasDiscrepancies) {
      logger.warn('Validation failed with discrepancies')
      process.exitCode = 2
    } else if (failedSlugs.length > 0) {
      process.exitCode = 1
    } else {
      logger.info('No validation discrepancies detected')
      process.exitCode = 0
    }
  } catch (error) {
    logger.error('Probe execution failed:', error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  }
}

run().catch(error => {
  logger.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})

// Export for testing
export default run
