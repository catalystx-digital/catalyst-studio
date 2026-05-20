import { resolve } from 'node:path'
import type { HeadDataProvider } from './provider'
import { ensureRegistriesLoaded } from './registry'
import { mapSnapshotComponents } from './component-mapper'
import { buildRouteDefinitions, buildSlugRegistry, buildStructureIndex } from './structure'
import { populateProjectFiles } from '../generator/scaffold'
import { ProjectBuilder } from '../generator/project-builder'
import { resolveProvider } from '../providers'
import { ensureEmptyDirectory, copyEnvironmentFiles } from '../utils/fs'
import { logger } from '../utils/logger'
import type {
  GenerationResult,
  GeneratorDiagnostic,
  GeneratorOptions,
  ProviderContextSnapshot,
  SiteSnapshot,
  DiagnosticsSummary,
  MediaDiagnosticsReport,
  MediaReferenceHandle,
  MediaIngestWarningEntry,
  PlaceholderReplacement
} from './types'
import { createEmptyMediaDiagnosticsReport } from './types'
import { resolveSnapshotMedia } from './media-resolution'
import { applyStockMediaFallback } from './stock-media'
import { loadLatestMediaIngestWarnings } from './ingest-warnings'

function toPackageName(value: string): string {
  const normalized = value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  return normalized || 'generated-head'
}

function summarizeDiagnostics(diagnostics: GeneratorDiagnostic[]): DiagnosticsSummary {
  return diagnostics.reduce<DiagnosticsSummary>((acc, diagnostic) => {
    if (diagnostic.level === 'error') {
      acc.errorCount += 1
    } else if (diagnostic.level === 'warn') {
      acc.warnCount += 1
    } else {
      acc.infoCount += 1
    }
    return acc
  }, { infoCount: 0, warnCount: 0, errorCount: 0 })
}

function normalizeProviderResult(
  result: ProviderContextSnapshot | SiteSnapshot
): { snapshot: SiteSnapshot; diagnostics: GeneratorDiagnostic[] } {
  if (result && typeof (result as ProviderContextSnapshot).diagnostics !== 'undefined') {
    const { diagnostics, ...snapshot } = result as ProviderContextSnapshot
    const normalizedDiagnostics = Array.isArray(diagnostics) ? diagnostics : []
    return { snapshot: snapshot as SiteSnapshot, diagnostics: normalizedDiagnostics }
  }

  return { snapshot: result as SiteSnapshot, diagnostics: [] }
}

async function resolveProviderDiagnostics(
  provider: HeadDataProvider,
  skip: boolean
): Promise<GeneratorDiagnostic[]> {
  if (skip || typeof provider.getDiagnostics !== 'function') {
    return []
  }

  const diagnostics = await provider.getDiagnostics()
  return Array.isArray(diagnostics) ? diagnostics : []
}

export async function generateHeadProject(options: GeneratorOptions): Promise<GenerationResult> {
  const repoRoot = process.cwd()
  const outputDir = resolve(repoRoot, options.outputDir)
  const provider = resolveProvider(options.provider, {
    websiteId: options.websiteId,
    templateOverrideKey: options.templateKey,
    designConcept: options.designConcept,
    dataSource: options.dataSource,
    graphql: options.graphql,
    optimizely: options.optimizely,
    umbracoCompose: options.umbracoCompose
  })

  await ensureRegistriesLoaded()

  logger.info('Using provider', {
    provider: provider.name,
    websiteId: options.websiteId ?? null,
    templateOverride: options.templateKey ?? null,
    designConcept: options.designConcept ?? null
  })

  const providerResult = await provider.loadSnapshot()
  const { snapshot, diagnostics: snapshotDiagnostics } = normalizeProviderResult(providerResult)
  const providerDiagnostics = await resolveProviderDiagnostics(provider, snapshotDiagnostics.length > 0)

  const projectName = toPackageName(snapshot.site.name)
  // Runtime providers fetch pages at runtime, so we need to include all component types in the bundle.
  // - standalone: No database at build time, everything fetched at runtime
  // - optimizely: External CMS, pages fetched at runtime
  // - umbraco-compose: External CMS (Umbraco Compose), pages fetched at runtime
  // - ucs with graphql: GraphQL API, pages fetched at runtime
  const isRuntimeProvider = options.provider === 'standalone' ||
    options.provider === 'optimizely' ||
    options.provider === 'umbraco-compose' ||
    (options.provider === 'ucs' && options.dataSource === 'graphql')
  const componentSummary = mapSnapshotComponents(snapshot, {
    includeAllComponentTypes: isRuntimeProvider
  })
  const routes = buildRouteDefinitions(snapshot, componentSummary.pages)
  const structureIndex = buildStructureIndex(snapshot)
  const { entries: slugRegistry, diagnostics: slugDiagnostics } = buildSlugRegistry(routes, structureIndex)
  let mediaDiagnostics: MediaDiagnosticsReport = createEmptyMediaDiagnosticsReport()
  let mediaDiagnosticEntries: GeneratorDiagnostic[] = []
  let unresolvedMediaReferences: MediaReferenceHandle[] = []
  let stockMediaReplacements: PlaceholderReplacement[] = []

  // Media resolution ONLY for static provider
  // Static provider bakes pages into output, so media must be resolved during export
  // All other providers (UCS, etc.) resolve media at runtime when pages are fetched
  if (options.provider === 'static') {
    const websiteId = options.websiteId ?? snapshot.site.id
    let ingestWarnings: MediaIngestWarningEntry[] = []
    try {
      ingestWarnings = await loadLatestMediaIngestWarnings(websiteId)
    } catch (error) {
      mediaDiagnosticEntries.push({
        level: 'warn',
        code: 'MEDIA_INGEST_WARNING_LOAD_FAILED',
        message: 'Failed to load media ingest warnings; diagnostics will omit ingest skip reasons.',
        context: {
          websiteId,
          error: error instanceof Error ? error.message : String(error)
        }
      })
    }
    const resolutionResult = await resolveSnapshotMedia(snapshot, websiteId, {
      ingestWarnings
    })
    mediaDiagnostics = resolutionResult.report
    mediaDiagnosticEntries = resolutionResult.diagnostics
    unresolvedMediaReferences = resolutionResult.unresolvedReferences
  }

  if (options.useStockMedia && unresolvedMediaReferences.length > 0) {
    stockMediaReplacements = applyStockMediaFallback({
      references: unresolvedMediaReferences,
      mediaDiagnostics
    })
  }

  const diagnostics: GeneratorDiagnostic[] = [
    ...snapshotDiagnostics,
    ...providerDiagnostics,
    ...componentSummary.diagnostics,
    ...slugDiagnostics,
    ...mediaDiagnosticEntries
  ]
  const diagnosticSummary = summarizeDiagnostics(diagnostics)

  const builder = new ProjectBuilder(outputDir)
  const manifest = populateProjectFiles(builder, {
    snapshot,
    provider: options.provider,
    dataSource: options.dataSource ?? 'prisma',
    graphqlRuntime:
      options.dataSource === 'graphql'
        ? {
            endpoint: options.graphql?.endpoint,
            apiKey: options.graphql?.apiKey,
            timeoutMs: undefined,
            maxRetries: options.graphql?.maxRetries
          }
        : undefined,
    optimizelyRuntime:
      options.provider === 'optimizely' && options.optimizely
        ? {
            gateway: options.optimizely.gateway ?? 'https://cg.optimizely.com',
            singleKey: options.optimizely.singleKey ?? '',
            locale: options.optimizely.locale ?? 'en',
            startPageId: options.optimizely.startPageId ?? ''
          }
        : undefined,
    umbracoComposeRuntime:
      options.provider === 'umbraco-compose' && options.umbracoCompose
        ? {
            projectAlias: options.umbracoCompose.projectAlias ?? '',
            region: options.umbracoCompose.region ?? '',
            environment: options.umbracoCompose.environment ?? 'production',
            personalAccessToken: options.umbracoCompose.personalAccessToken ?? ''
          }
        : undefined,
    projectName,
    diagnostics,
    diagnosticSummary,
    componentSummary,
    routes,
    slugRegistry,
    structureIndex,
    websiteId: options.websiteId ?? snapshot.site.id,
    templateOverrideKey: options.templateKey ?? null,
    repoRoot,
    mediaDiagnostics,
    includeStaticSnapshot: options.includeStaticSnapshot
  })

  const files = builder.listFiles()
  let overwroteOutput = false

  if (options.dryRun) {
    logger.info('Dry run enabled; files will not be written to disk.', {
      fileCount: files.length,
      outputDir
    })
  } else {
    overwroteOutput = await ensureEmptyDirectory(outputDir, { force: options.force, verbose: options.verbose })
    await builder.writeToDisk()
    if (options.copyEnv) {
      const copied = await copyEnvironmentFiles(repoRoot, outputDir, {
        keys: ['DATABASE_URL', 'DIRECT_URL']
      })
      if (copied.length > 0) {
        logger.info('Copied environment files', {
          files: copied,
          outputDir
        })
      } else {
        logger.info('No environment files found to copy', { outputDir })
      }
    }
    logger.info('Wrote generated project to disk', {
      outputDir,
      fileCount: files.length,
      overwroteOutput
    })
  }

  logger.debug('Generated routes', {
    count: routes.length,
    routes: routes.map(route => route.routePath || '/')
  })

  logger.info('Media resolution summary', {
    references: mediaDiagnostics.summary.references,
    resolved: mediaDiagnostics.summary.resolved,
    unresolved: mediaDiagnostics.summary.unresolved,
    serviceAvailable: mediaDiagnostics.summary.serviceAvailable,
    assetsLoaded: mediaDiagnostics.summary.assetsLoaded,
    placeholders: mediaDiagnostics.summary.placeholders,
    resolvedWithStableUrl: mediaDiagnostics.summary.resolvedWithStableUrl,
    resolvedWithSignedFallback: mediaDiagnostics.summary.resolvedWithSignedFallback
  })

  if (options.useStockMedia) {
    logger.info('Stock media replacements', {
      enabled: true,
      replacements: stockMediaReplacements.length
    })
  }

  if (diagnostics.length > 0) {
    diagnostics.forEach(diag => {
      const context = diag.context && Object.keys(diag.context).length > 0 ? diag.context : undefined
      if (diag.level === 'error') {
        logger.error(`${diag.code}: ${diag.message}`, context)
      } else if (diag.level === 'warn') {
        logger.warn(`${diag.code}: ${diag.message}`, context)
      } else {
        logger.info(`${diag.code}: ${diag.message}`, context)
      }
    })
  } else {
    logger.info('No diagnostics reported')
  }

  return {
    files,
    snapshot,
    diagnostics,
    manifest,
    diagnosticSummary,
    routes,
    slugRegistry,
    overwroteOutput,
    mediaDiagnostics
  }
}
