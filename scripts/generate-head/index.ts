#!/usr/bin/env tsx
import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { resolve as resolvePath } from 'node:path'
import { spawn } from 'node:child_process'
import { Command } from 'commander'
import { supportedProviders } from './providers'
import { logger } from './utils/logger'
import { generateHeadProject } from './core/generator'
import type { DataSourceKind, GeneratorOptions } from './core/types'
import { ensureInstallCache } from './utils/install-cache'
import type { InstallCacheResult } from './utils/install-cache'
import { ensureCliEnvLoaded } from './utils/env'
import type { ApiKeyEvent } from './utils/api-key-manager'

type CliOptions = GeneratorOptions & {
  output: string
  template?: string
  verbose?: boolean
  installCache?: boolean
  installCacheDir?: string
  dataSource?: DataSourceKind
  graphqlUrl?: string
  apiKey?: string
  autoManageKeys?: boolean
  apiKeyLabel?: string
  persistKeyPath?: string
  apiAccessUserFile?: string
  apiAccessCookies?: string
  graphqlMaxRetries?: number
  includeStaticSnapshot?: boolean
  // Optimizely-specific options
  optimizelyKey?: string
  optimizelyGateway?: string
  optimizelyLocale?: string
  optimizelyStartPageId?: string
  optimizelyDebug?: boolean
  optimizelyConfig?: string
  // Design system source options (for non-UCS providers)
  designSystemWebsiteId?: string
  // Umbraco Compose-specific options
  umbracoProject?: string
  umbracoRegion?: string
  umbracoPat?: string
  umbracoEnv?: string
  umbracoCollection?: string
  umbracoDebug?: boolean
}

const program = new Command()
const DEFAULT_GRAPHQL_ENDPOINT = 'https://studio.catalyst.dev/api/studio/ucs/graphql'
const DEFAULT_GRAPHQL_MAX_RETRIES = 3

/**
 * Run prisma generate in the target project directory
 */
function runPrismaGenerate(projectDir: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const npxCommand = process.platform === 'win32' ? 'npx.cmd' : 'npx'
    const proc = spawn(
      npxCommand,
      ['prisma', 'generate', '--schema=./lib/generated/prisma/schema.prisma'],
      {
        cwd: projectDir,
        stdio: 'inherit',
        shell: process.platform === 'win32'
      }
    )

    proc.on('error', reject)
    proc.on('close', code => {
      if (code === 0) {
        resolve()
      } else {
        reject(new Error(`prisma generate exited with code ${code}`))
      }
    })
  })
}

function normalizeDataSource(value?: string): DataSourceKind {
  if (!value) {
    return 'prisma'
  }
  const normalized = value.trim().toLowerCase()
  if (normalized === 'prisma' || normalized === 'graphql') {
    return normalized
  }
  throw new Error(`Unsupported data source: ${value}. Expected prisma or graphql.`)
}

function sanitizeRetryCount(value?: number): number {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return Math.floor(value)
  }
  return DEFAULT_GRAPHQL_MAX_RETRIES
}

function resolveGraphqlEndpoint(value?: string): string {
  const fromOption = value?.trim()
  if (fromOption) {
    return fromOption
  }
  const envValue = process.env.UCS_GRAPHQL_ENDPOINT?.trim()
  if (envValue) {
    return envValue
  }
  return DEFAULT_GRAPHQL_ENDPOINT
}

async function readAuthUserFromFile(filePath: string): Promise<string> {
  const absolutePath = resolvePath(process.cwd(), filePath)
  if (!existsSync(absolutePath)) {
    throw new Error(`Auth user file not found at ${absolutePath}`)
  }
  const contents = await readFile(absolutePath, 'utf-8')
  return contents
}

function encodeAuthUserPayload(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed) {
    throw new Error('Auth user payload is empty')
  }
  if (trimmed.startsWith('{')) {
    try {
      return encodeURIComponent(JSON.stringify(JSON.parse(trimmed)))
    } catch (error) {
      throw new Error(`Invalid auth user JSON payload: ${(error as Error).message}`)
    }
  }
  return trimmed
}

async function resolveAuthUserHeader(options: CliOptions): Promise<string | null> {
  if (options.apiAccessUserFile) {
    const filePayload = await readAuthUserFromFile(options.apiAccessUserFile)
    return encodeAuthUserPayload(filePayload)
  }

  const envPayload = process.env.CATALYST_AUTH_USER
  if (typeof envPayload === 'string' && envPayload.trim().length > 0) {
    return encodeAuthUserPayload(envPayload)
  }
  return null
}

function summarizeApiKeyEvents(events: ApiKeyEvent[]): Record<string, unknown> | null {
  if (events.length === 0) {
    return null
  }
  const summary = {
    minted: 0,
    rotated: 0,
    reused: 0,
    reusedFromFile: 0,
    persisted: 0,
    rotatedReasons: {} as Record<string, number>
  }

  events.forEach(event => {
    switch (event.type) {
      case 'minted':
        summary.minted += 1
        break
      case 'rotated':
        summary.rotated += 1
        summary.rotatedReasons[event.reason] = (summary.rotatedReasons[event.reason] ?? 0) + 1
        break
      case 'reused':
        summary.reused += 1
        if (event.source === 'file') {
          summary.reusedFromFile += 1
        }
        break
      case 'persisted':
        summary.persisted += 1
        break
      default:
        break
    }
  })

  return summary
}

program
  .name('generate-head')
  .description('Catalyst CLI head generator')
  .requiredOption('-o, --output <dir>', 'Output directory for the generated project')
  .option('-p, --provider <provider>', 'Data provider to use', 'stub')
  .option('--website-id <id>', 'Website ID to source content from (required for --provider ucs)')
  .option('--design-concept <concept>', 'Design concept name, slug, or ID to use when exporting')
  .option('--template <key>', 'Template override key')
  .option('--dry-run', 'Do not write files to disk', false)
  .option('--force', 'Overwrite output directory if it already exists', false)
  .option('--copy-env', 'Copy .env and .env.local from the current workspace into the generated project', false)
  .option('--no-install-cache', 'Disable install cache hydration (enabled by default)')
  .option('--install-cache-dir <path>', 'Directory used to store install cache entries (default: <repo>/.cache/head-installs)')
  .option('--verbose', 'Enable verbose logging', false)
  .option('--use-stock-media', 'Fill unresolved media with curated stock imagery', false)
  .option('--data-source <source>', 'Data source to use for UCS exports (prisma|graphql)', 'prisma')
  .option('--graphql-url <url>', 'GraphQL endpoint for UCS exports (defaults to UCS_GRAPHQL_ENDPOINT or production URL)')
  .option('--api-key <key>', 'GraphQL API key (defaults to UCS_GRAPHQL_API_KEY env var)')
  .option('--auto-manage-keys', 'Automatically manage website-scoped API keys via API Access endpoints', false)
  .option('--api-key-label <label>', 'Custom label to apply when minting API keys')
  .option('--persist-key-path <path>', 'Persist minted API keys to a file during the run (0600 permissions)')
  .option('--api-access-user-file <path>', 'Path to a serialized auth user payload used for API Access authentication')
  .option('--api-access-cookies <cookie>', 'Cookie header value to forward to API Access endpoints')
  .option('--graphql-max-retries <count>', 'Maximum GraphQL retry attempts (default 3)', value => parseInt(value, 10))
  .option('--include-static-snapshot', 'Include data/site.ts static snapshot for debugging (default: false for UCS)', false)
  // Optimizely provider options
  .option('--optimizely-key <key>', 'Optimizely Graph Single Key for authentication (required for --provider optimizely)')
  .option('--optimizely-gateway <url>', 'Optimizely Graph gateway URL (default: https://cg.optimizely.com)')
  .option('--optimizely-locale <locale>', 'Default locale for Optimizely content (default: en)')
  .option('--optimizely-start-page-id <id>', 'Starting point page ID in Optimizely (the website root)')
  .option('--optimizely-debug', 'Enable debug logging for Optimizely provider', false)
  .option('--optimizely-config <path>', 'Path to JSON config file for Optimizely provider')
  // Design system source options (for non-UCS providers like Optimizely)
  .option('--design-system-website-id <id>', 'Catalyst Studio website ID to fetch design system from (for non-UCS exports)')
  // Umbraco Compose provider options
  .option('--umbraco-project <alias>', 'Umbraco Compose project alias (required for --provider umbraco-compose)')
  .option('--umbraco-region <region>', 'Umbraco Compose region (required for --provider umbraco-compose)')
  .option('--umbraco-pat <token>', 'Umbraco Compose Personal Access Token (required for --provider umbraco-compose)')
  .option('--umbraco-env <env>', 'Umbraco Compose environment (default: production)')
  .option('--umbraco-collection <name>', 'Umbraco Compose collection to query (default: pages)')
  .option('--umbraco-debug', 'Enable debug logging for Umbraco Compose provider', false)
  .allowExcessArguments(false)

program.addHelpText('after', () => {
  return `
Supported providers: ${supportedProviders.join(', ')}`
})

async function run(): Promise<void> {
  program.parse(process.argv)
  const options = program.opts<CliOptions>()
  ensureCliEnvLoaded()

  const dataSource = normalizeDataSource(options.dataSource)
  const provider = options.provider

  if (!supportedProviders.includes(provider)) {
    throw new Error(`Unsupported provider: ${provider}. Supported providers: ${supportedProviders.join(', ')}`)
  }

  if (provider === 'ucs' && !options.websiteId) {
    throw new Error('The --website-id flag is required when --provider ucs is used')
  }

  if (provider === 'standalone' && !options.websiteId) {
    throw new Error('The --website-id flag is required when --provider standalone is used (used at runtime)')
  }

  if (dataSource === 'graphql' && provider !== 'ucs' && provider !== 'standalone') {
    throw new Error('GraphQL data source is only supported for the UCS and standalone providers')
  }

  // Optimizely provider validation
  if (provider === 'optimizely') {
    const optimizelyKey = options.optimizelyKey || process.env.OPTIMIZELY_GRAPH_SINGLE_KEY
    if (!optimizelyKey) {
      throw new Error('The --optimizely-key flag or OPTIMIZELY_GRAPH_SINGLE_KEY env var is required when --provider optimizely is used')
    }
  }

  // Umbraco Compose provider validation
  if (provider === 'umbraco-compose') {
    const umbracoProject = options.umbracoProject || process.env.UMBRACO_PROJECT_ALIAS
    const umbracoRegion = options.umbracoRegion || process.env.UMBRACO_REGION
    const umbracoPat = options.umbracoPat || process.env.UMBRACO_PAT

    if (!umbracoProject) {
      throw new Error('The --umbraco-project flag or UMBRACO_PROJECT_ALIAS env var is required when --provider umbraco-compose is used')
    }
    if (!umbracoRegion) {
      throw new Error('The --umbraco-region flag or UMBRACO_REGION env var is required when --provider umbraco-compose is used')
    }
    if (!umbracoPat) {
      throw new Error('The --umbraco-pat flag or UMBRACO_PAT env var is required when --provider umbraco-compose is used')
    }
  }

  if (options.verbose) {
    logger.setVerbose(true)
  }

  const websiteId = options.websiteId
  let authUserHeader: string | null = null
  const graphqlMaxRetries = sanitizeRetryCount(options.graphqlMaxRetries)
  const apiKeyEvents: ApiKeyEvent[] = []
  const manualApiKey =
    typeof options.apiKey === 'string' && options.apiKey.trim()
      ? options.apiKey.trim()
      : process.env.UCS_GRAPHQL_API_KEY?.trim()
  const autoManageKeys = Boolean(options.autoManageKeys)
  const graphqlEndpoint = resolveGraphqlEndpoint(options.graphqlUrl)
  const persistKeyPath =
    typeof options.persistKeyPath === 'string' && options.persistKeyPath.trim()
      ? resolvePath(process.cwd(), options.persistKeyPath)
      : undefined
  const apiAccessCookies = options.apiAccessCookies?.trim() || process.env.CATALYST_AUTH_COOKIES?.trim()

  if (dataSource === 'graphql') {
    if (!websiteId) {
      throw new Error('GraphQL exports require --website-id to be specified')
    }

    if (!manualApiKey && !autoManageKeys) {
      throw new Error('Provide --api-key (or UCS_GRAPHQL_API_KEY) or enable --auto-manage-keys for GraphQL exports')
    }

    if (autoManageKeys) {
      authUserHeader = await resolveAuthUserHeader(options)
      if (!authUserHeader) {
        throw new Error(
          'Auto key management requires a serialized auth user payload via --api-access-user-file or CATALYST_AUTH_USER'
        )
      }
    }

    logger.info('Configured UCS GraphQL export', {
      dataSource,
      endpoint: graphqlEndpoint,
      websiteId,
      autoManageKeys,
      apiKeyProvided: Boolean(manualApiKey),
      maxRetries: graphqlMaxRetries
    })
  }

  // Build Optimizely options if provider is optimizely
  // Design system source options - fetch from Catalyst Studio GraphQL
  const designSystemSourceOptions =
    provider === 'optimizely' && options.designSystemWebsiteId
      ? {
          websiteId: options.designSystemWebsiteId,
          designConcept: options.designConcept,
          graphql: {
            endpoint: resolveGraphqlEndpoint(options.graphqlUrl),
            apiKey: manualApiKey ?? undefined,
            maxRetries: graphqlMaxRetries
          }
        }
      : undefined

  const optimizelyOptions =
    provider === 'optimizely'
      ? {
          gateway: options.optimizelyGateway || process.env.OPTIMIZELY_GRAPH_GATEWAY,
          singleKey: options.optimizelyKey || process.env.OPTIMIZELY_GRAPH_SINGLE_KEY || '',
          locale: options.optimizelyLocale || process.env.OPTIMIZELY_GRAPH_LOCALE || 'en',
          startPageId: options.optimizelyStartPageId || process.env.OPTIMIZELY_START_PAGE_ID || '',
          debug: Boolean(options.optimizelyDebug),
          designSystemSource: designSystemSourceOptions
        }
      : undefined

  if (provider === 'optimizely' && optimizelyOptions) {
    logger.info('Configured Optimizely provider', {
      gateway: optimizelyOptions.gateway || 'https://cg.optimizely.com (default)',
      locale: optimizelyOptions.locale,
      startPageId: optimizelyOptions.startPageId || '(not set)',
      debug: optimizelyOptions.debug,
      designSystemSource: designSystemSourceOptions?.websiteId ?? '(not set)'
    })
  }

  // Build Umbraco Compose options if provider is umbraco-compose
  const umbracoComposeOptions =
    provider === 'umbraco-compose'
      ? {
          projectAlias: options.umbracoProject || process.env.UMBRACO_PROJECT_ALIAS || '',
          region: options.umbracoRegion || process.env.UMBRACO_REGION || '',
          personalAccessToken: options.umbracoPat || process.env.UMBRACO_PAT || '',
          environment: options.umbracoEnv || process.env.UMBRACO_ENVIRONMENT || 'production',
          collection: options.umbracoCollection || 'pages',
          debug: Boolean(options.umbracoDebug)
        }
      : undefined

  if (provider === 'umbraco-compose' && umbracoComposeOptions) {
    logger.info('Configured Umbraco Compose provider', {
      projectAlias: umbracoComposeOptions.projectAlias,
      region: umbracoComposeOptions.region,
      environment: umbracoComposeOptions.environment,
      collection: umbracoComposeOptions.collection,
      debug: umbracoComposeOptions.debug
    })
  }

  const generationResult = await generateHeadProject({
    outputDir: options.output,
    provider,
    websiteId,
    dataSource,
    designConcept: options.designConcept,
    templateKey: options.template,
    dryRun: options.dryRun,
    force: options.force,
    copyEnv: options.copyEnv,
    useStockMedia: Boolean(options.useStockMedia),
    includeStaticSnapshot: Boolean(options.includeStaticSnapshot),
    verbose: Boolean(options.verbose),
    graphql:
      dataSource === 'graphql'
        ? {
            endpoint: graphqlEndpoint,
            apiKey: manualApiKey ?? undefined,
            autoManageKeys,
            apiKeyLabel: options.apiKeyLabel?.trim() || undefined,
            persistKeyPath,
            maxRetries: graphqlMaxRetries,
            onApiKeyEvent: event => apiKeyEvents.push(event),
            apiAccess:
              authUserHeader || apiAccessCookies
                ? {
                    encodedUser: authUserHeader ?? undefined,
                    cookies: apiAccessCookies ?? undefined
                  }
                : undefined
          }
        : undefined,
    optimizely: optimizelyOptions,
    umbracoCompose: umbracoComposeOptions
  })

  logger.info('Generation complete.', {
    pages: generationResult.snapshot.pages.length,
    sharedComponentCount: generationResult.snapshot.sharedComponents.length
  })
  logger.info('Diagnostic summary', { ...generationResult.diagnosticSummary })
  logger.info('Media resolution summary', {
    ...generationResult.mediaDiagnostics.summary
  })
  logger.info('Generated route count', { count: generationResult.routes.length })
  logger.info('Slug registry entries', { count: generationResult.slugRegistry.length })
  const mediaSummary = generationResult.mediaDiagnostics.summary
  if (mediaSummary.ingestWarnings > 0 && generationResult.mediaDiagnostics.ingestWarnings.length > 0) {
    const reasonCounts = generationResult.mediaDiagnostics.ingestWarnings.reduce<Record<string, number>>((acc, warning) => {
      const key = warning.reason || 'unknown'
      acc[key] = (acc[key] ?? 0) + 1
      return acc
    }, {})
    logger.warn('Media ingestion skipped assets', {
      count: mediaSummary.ingestWarnings,
      reasons: reasonCounts
    })
  }
  if (mediaSummary.fallbackUrlUsage > 0) {
    logger.warn('Media references fell back to original URLs', {
      fallbackCount: mediaSummary.fallbackUrlUsage,
      unresolved: mediaSummary.unresolved
    })
  }
  if (mediaSummary.referencesWithRenditions > 0) {
    logger.info('Media renditions attached', {
      referencesWithRenditions: mediaSummary.referencesWithRenditions,
      resolved: mediaSummary.resolved
    })
  }
  if (mediaSummary.resolvedWithSignedFallback > 0) {
    logger.warn('Media export includes signed URL fallbacks; these links will expire.', {
      signedFallbackCount: mediaSummary.resolvedWithSignedFallback,
      stableUrlCount: mediaSummary.resolvedWithStableUrl
    })
  }

  if (generationResult.overwroteOutput) {
    logger.info('Output directory was cleared before writing files', { outputDir: options.output })
  }

  let installCacheResult: InstallCacheResult = 'skipped'

  if (!options.dryRun && options.installCache !== false) {
    const projectDir = resolvePath(process.cwd(), options.output)
    try {
      installCacheResult = await ensureInstallCache({
        repoRoot: process.cwd(),
        projectDir,
        logger,
        cacheDir: options.installCacheDir,
        packageManager: 'pnpm'
      })

      // Always run prisma generate to ensure client is ready
      // This is needed because postinstall hooks are skipped when using cached node_modules
      if (installCacheResult === 'restored') {
        logger.info('Generating Prisma client...')
        try {
          await runPrismaGenerate(projectDir)
          logger.info('Prisma client generated successfully')
        } catch (prismaError: unknown) {
          logger.warn('Prisma generate failed, pages using UCS provider may not work', {
            error: prismaError instanceof Error ? prismaError.message : String(prismaError)
          })
        }
      }
    } catch (error: unknown) {
      installCacheResult = 'skipped'
      logger.warn('Install cache step failed', {
        error: error instanceof Error ? error.message : String(error)
      })
    }
  }

  if (!options.dryRun) {
    logger.info('Next steps:')
    logger.info(`  cd ${options.output}`)
    if (installCacheResult === 'restored') {
      logger.info('  pnpm dev')
      logger.info('Dependencies restored from install cache; install step skipped.')
    } else if (installCacheResult === 'populated') {
      logger.info('  pnpm dev')
      logger.info('Dependencies installed and cached for future runs.')
    } else {
      logger.info('  pnpm install')
      logger.info('  pnpm dev')
      logger.info('Install cache disabled or unavailable; run pnpm install before starting dev server.')
    }
    logger.info('Diagnostics file written to generated/diagnostics.json', { outputDir: options.output })
  } else {
    logger.info('Diagnostics file will be generated as generated/diagnostics.json when run without --dry-run.')
  }

  const apiKeySummary = summarizeApiKeyEvents(apiKeyEvents)
  if (apiKeySummary) {
    logger.info('API key summary', apiKeySummary)
  }

  if (generationResult.diagnosticSummary.errorCount > 0) {
    logger.warn('Generation completed with errors; inspect generated/diagnostics.json for details.', { ...generationResult.diagnosticSummary })
    const currentExitCode = typeof process.exitCode === 'number' ? process.exitCode : 0
    process.exitCode = Math.max(currentExitCode, 2)
  }
}

run().catch(error => {
  logger.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
