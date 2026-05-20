import { resolve } from 'node:path'
import { existsSync, readFileSync } from 'node:fs'
import type { ComponentMappingSummary } from '../core/component-mapper'
import type {
  DiagnosticsSummary,
  GenerationManifest,
  GeneratorDiagnostic,
  DataSourceKind,
  ProviderKind,
  RouteDefinition,
  SiteSnapshot,
  SlugRegistryEntry,
  MediaDiagnosticsReport
} from '../core/types'
import type { StructureIndex } from '../core/structure'
import { addBaseProjectFiles } from './base-project'
import { ProjectBuilder } from './project-builder'
import { addLayout, type LayoutFontPlan } from './layout'
import {
  addDirectoryToBuilder,
  collectRemoteImagePatterns,
  type RemoteImagePattern
} from './scaffold/file-utils'
import { buildDiagnosticsModule, buildSiteDataModule, stringifyJson } from './scaffold/data-modules'
import {
  buildComponentsModule,
  buildComponentTreeModule,
  buildRenderContextModule,
  buildRuntimeLoadersModule,
  type ComponentModulePaths
} from './scaffold/component-modules'
import {
  buildPageRendererModule,
  buildRuntimeRoutingModule,
  buildRouteRequestHelpersModule,
  buildCatchAllRouteModule,
  buildRootRouteModule,
  buildAppErrorModule,
  buildGlobalErrorModule,
  buildRuntimeConfigModule,
  buildRuntimeCacheModule,
  buildRuntimeSiteDataModule,
  buildDesignSystemInjectorModule,
  buildRuntimeDiagnosticsModule,
  buildDiagnosticsApiRouteModule,
  buildDiagnosticsLogApiRouteModule,
  buildCacheApiRouteModule,
  buildHealthApiRouteModule,
  buildComponentProbeModule,
  buildValidationRunnerModule,
  buildSitemapModule
} from './scaffold/runtime-modules'
import {
  buildProviderTypesModule,
  buildStaticProviderModule,
  buildPrismaClientModule,
  buildGraphqlProviderModule,
  buildUcsProviderModule,
  buildOptimizelyProviderModule,
  buildOptimizelyClientModule,
  buildOptimizelyMapperModule,
  buildUmbracoComposeProviderModule,
  buildProvidersIndexModule,
  buildProvidersReadme,
  buildEnvLocalFile
} from './scaffold/provider-modules'
import { buildManifest } from './scaffold/manifest'
import { normalizeFontFamilyValue } from '@/lib/studio/design-system/generate-css-variables'
import { getNormalizedDesignSystem, isNewFormat, generateDesignSystemCss, getDesignSystemVariables } from '@/lib/studio/design-system/design-system-reader'
import { SHADCN_DEFAULTS, SHADCN_DEFAULTS_DARK, generateShadcnCss } from '@/lib/studio/design-system/shadcn-defaults'
import type { ShadcnDesignSystemTokens } from '@/lib/studio/design-system/shadcn-transformer'
import type { DesignSystem, TokenTypography } from '@/lib/studio/import/types/design-system.types'
import { generateDesignSystemCSSVariables } from '@/lib/studio/design-system/generate-css-variables'
import {
  GENERIC_FONT_FAMILIES,
  GOOGLE_FONT_REGISTRY,
  SYSTEM_FONT_ALLOWLIST,
  DEFAULT_SYSTEM_FONT_STACK
} from '@/lib/studio/design-system/font-registry'

export { buildManifest } from './scaffold/manifest'
export {
  buildComponentTreeModule,
  buildRuntimeLoadersModule,
  buildRenderContextModule
} from './scaffold/component-modules'
export { buildCatchAllRouteModule, buildRootRouteModule, buildRuntimeDiagnosticsModule } from './scaffold/runtime-modules'

const stripQuotes = (value: string): string => value.replace(/^['"]+|['"]+$/g, '')

const extractPrimaryFontFamily = (fontFamily?: string | null): string | null => {
  if (!fontFamily || typeof fontFamily !== 'string') {
    return null
  }
  const [first] = fontFamily.split(',')
  if (!first) {
    return null
  }

  const normalized = stripQuotes(first).trim()
  if (!normalized || /^(sans-serif|serif|monospace|system-ui|inherit)$/i.test(normalized)) {
    return null
  }

  return normalized
}

const collectFontWeights = (tokens?: TokenTypography[]): string[] => {
  if (!Array.isArray(tokens)) {
    return []
  }
  const weights = new Set<string>()
  tokens.forEach(token => {
    if (token && token.fontWeight) {
      weights.add(String(token.fontWeight))
    }
  })
  return Array.from(weights)
}

type FontCategory = 'body' | 'heading' | 'ui'

interface FontFallbackAdjustment {
  target: FontCategory
  original: string
  normalized: string
  reason: 'reordered' | 'fallback'
}

const prioritiseFontStack = (fontStack: string): { normalized: string; reason: 'reordered' | 'fallback'; changed: boolean } => {
  const sanitized = fontStack.trim()
  if (!sanitized) {
    return {
      normalized: DEFAULT_SYSTEM_FONT_STACK,
      reason: 'fallback',
      changed: true
    }
  }

  const segments = sanitized.split(',').map(segment => segment.trim()).filter(Boolean)
  if (segments.length === 0) {
    return {
      normalized: DEFAULT_SYSTEM_FONT_STACK,
      reason: 'fallback',
      changed: DEFAULT_SYSTEM_FONT_STACK !== sanitized
    }
  }

  const varSegments: string[] = []
  const googleSegments: string[] = []
  const systemSegments: string[] = []
  const genericSegments: string[] = []
  const unknownSegments: string[] = []

  segments.forEach(segment => {
    const bare = stripQuotes(segment)
    const lower = bare.toLowerCase()
    if (!bare) return

    if (lower.startsWith('var(')) {
      varSegments.push(segment)
      return
    }
    if (GOOGLE_FONT_REGISTRY[lower]) {
      googleSegments.push(segment)
      return
    }
    if (SYSTEM_FONT_ALLOWLIST.has(lower)) {
      systemSegments.push(segment)
      return
    }
    if (GENERIC_FONT_FAMILIES.has(lower)) {
      genericSegments.push(segment)
      return
    }
    unknownSegments.push(segment)
  })

  const hasLoadable = varSegments.length > 0 || googleSegments.length > 0 || systemSegments.length > 0
  if (!hasLoadable) {
    return {
      normalized: DEFAULT_SYSTEM_FONT_STACK,
      reason: 'fallback',
      changed: DEFAULT_SYSTEM_FONT_STACK !== sanitized
    }
  }

  const ordered = [...varSegments, ...googleSegments, ...systemSegments, ...unknownSegments, ...genericSegments]
  const seen = new Set<string>()
  const deduped = ordered.filter(segment => {
    const key = segment.toLowerCase()
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  const normalizedStack = normalizeFontFamilyValue(deduped.join(', '))
  const originalSegments = sanitized.split(',').map(segment => stripQuotes(segment.trim()).toLowerCase()).filter(Boolean)
  const normalizedSegments = normalizedStack
    .split(',')
    .map(segment => stripQuotes(segment.trim()).toLowerCase())
    .filter(Boolean)

  const originalPrimary = originalSegments[0]
  const normalizedPrimary = normalizedSegments[0]

  const isOriginalLoadable = Boolean(
    originalPrimary && (GOOGLE_FONT_REGISTRY[originalPrimary] || SYSTEM_FONT_ALLOWLIST.has(originalPrimary) || originalPrimary.startsWith('var('))
  )
  const isNormalizedLoadable = Boolean(
    normalizedPrimary && (GOOGLE_FONT_REGISTRY[normalizedPrimary] || SYSTEM_FONT_ALLOWLIST.has(normalizedPrimary) || normalizedPrimary.startsWith('var('))
  )

  const reason: 'reordered' | 'fallback' =
    !isOriginalLoadable && isNormalizedLoadable ? 'fallback' : 'reordered'

  return {
    normalized: normalizedStack,
    reason,
    changed: normalizedStack !== sanitized
  }
}

const applyFontFallbacks = (designSystem: DesignSystem): FontFallbackAdjustment[] => {
  if (!designSystem.typography) {
    return []
  }

  const adjustments: FontFallbackAdjustment[] = []
  const categories: Array<{ target: FontCategory; tokens?: TokenTypography[] }> = [
    { target: 'body', tokens: designSystem.typography.body },
    { target: 'heading', tokens: designSystem.typography.heading },
    { target: 'ui', tokens: designSystem.typography.ui }
  ]

  categories.forEach(({ target, tokens }) => {
    if (!Array.isArray(tokens)) {
      return
    }

    let recorded: FontFallbackAdjustment | null = null

    tokens.forEach(token => {
      if (!token) {
        return
      }

      const sanitized = normalizeFontFamilyValue(token.fontFamily)
      const prioritized = prioritiseFontStack(sanitized)
      const finalValue = prioritized.changed ? prioritized.normalized : sanitized

      token.fontFamily = finalValue

      if (prioritized.changed && !recorded) {
        recorded = {
          target,
          original: sanitized,
          normalized: prioritized.normalized,
          reason: prioritized.reason
        }
      }
    })

    if (recorded) {
      adjustments.push(recorded)
    }
  })

  return adjustments
}

const buildLayoutFontPlan = (designSystem: DesignSystem | null): LayoutFontPlan | null => {
  if (!designSystem) {
    return null
  }

  const plan: LayoutFontPlan = {
    imports: [],
    usages: [],
    unsupported: []
  }
  const seenImports = new Set<string>()

  const pickTypographyToken = (tokens?: TokenTypography[]): TokenTypography | undefined => {
    if (!Array.isArray(tokens)) {
      return undefined
    }
    return tokens.find(token => typeof token?.fontFamily === 'string' && token.fontFamily.trim().length > 0)
  }

  const isMeaningfulFontFamily = (fontFamily?: string | null): boolean => {
    const normalized = normalizeFontFamilyValue(fontFamily)
    if (!normalized) {
      return false
    }

    const lower = normalized.toLowerCase()
    if (lower.startsWith('var(')) {
      return true
    }

    const families = normalized
      .split(',')
      .map(segment => stripQuotes(segment.trim()).toLowerCase())
      .filter(Boolean)

    return families.some(name => !GENERIC_FONT_FAMILIES.has(name))
  }

  const chooseTypographyToken = (
    primarySource: TokenTypography[] | undefined,
    ...fallbackSources: Array<TokenTypography[] | undefined>
  ): { token?: TokenTypography; source?: TokenTypography[] } => {
    const candidates = [
      { token: pickTypographyToken(primarySource), source: primarySource },
      ...fallbackSources.map(source => ({ token: pickTypographyToken(source), source }))
    ].filter((entry): entry is { token: TokenTypography; source?: TokenTypography[] } => Boolean(entry.token))

    for (const candidate of candidates) {
      if (isMeaningfulFontFamily(candidate.token.fontFamily)) {
        return candidate
      }
    }

    return candidates[0] ?? { token: undefined, source: undefined }
  }

  const categories: Array<{
    target: 'body' | 'heading'
    tokens?: TokenTypography[]
    variableName: string
    identifier: string
  }> = [
    { target: 'body', tokens: designSystem.typography?.body, variableName: '--font-body', identifier: 'bodyFont' },
    { target: 'heading', tokens: designSystem.typography?.heading, variableName: '--font-heading', identifier: 'headingFont' }
  ]

  categories.forEach(category => {
    const fallbackSources =
      category.target === 'body'
        ? [designSystem.typography?.ui, designSystem.typography?.heading]
        : [designSystem.typography?.body, designSystem.typography?.ui]

    const { token: chosenToken, source: tokenSource } = chooseTypographyToken(category.tokens, ...fallbackSources)
    if (!chosenToken) {
      return
    }

    const primaryFamily = extractPrimaryFontFamily(chosenToken.fontFamily)
    if (!primaryFamily) {
      return
    }

    const lowerPrimary = primaryFamily.toLowerCase()
    const registryEntry = GOOGLE_FONT_REGISTRY[lowerPrimary]
    if (!registryEntry) {
      if (SYSTEM_FONT_ALLOWLIST.has(lowerPrimary) || GENERIC_FONT_FAMILIES.has(lowerPrimary)) {
        return
      }
      plan.unsupported.push({ target: category.target, fontFamily: primaryFamily })
      return
    }

    const weightTokens = tokenSource ?? category.tokens
    const weights = collectFontWeights(weightTokens)
    const normalizedWeights = weights.map(weight => {
      const numeric = Number.parseInt(weight, 10)
      if (Number.isNaN(numeric)) {
        return weight
      }
      if (numeric <= 100) return '100'
      if (numeric <= 200) return '200'
      if (numeric <= 300) return '300'
      if (numeric <= 400) return '400'
      if (numeric <= 500) return '500'
      if (numeric <= 600) return '600'
      if (numeric <= 700) return '700'
      if (numeric <= 800) return '800'
      if (numeric <= 900) return '900'
      return String(Math.min(numeric, 900))
    })
    const optionParts = [
      `subsets: ['latin']`,
      `display: 'swap'`,
      `variable: '${category.variableName}'`
    ]
    const allowedWeights = registryEntry.weights ? new Set(registryEntry.weights) : null
    let weightOptions = normalizedWeights.filter(Boolean)

    if (allowedWeights) {
      weightOptions = weightOptions.filter(weight => allowedWeights.has(weight))
    }

    weightOptions = Array.from(new Set(weightOptions))

    if (allowedWeights) {
      if (weightOptions.length === 0) {
        if (allowedWeights.has('400')) {
          weightOptions = ['400']
        } else {
          const [fallbackWeight] = Array.from(allowedWeights.values())
          if (fallbackWeight) {
            weightOptions = [fallbackWeight]
          }
        }
      }
    } else if (weightOptions.length === 0) {
      weightOptions = ['400']
    }

    if (weightOptions.length > 0) {
      optionParts.push(`weight: [${weightOptions.map(weight => `'${weight}'`).join(', ')}]`)
    }

    plan.usages.push({
      target: category.target,
      identifier: category.identifier,
      importName: registryEntry.importName,
      optionsLiteral: `{ ${optionParts.join(', ')} }`
    })

    if (!seenImports.has(registryEntry.importName)) {
      plan.imports.push(registryEntry.importName)
      seenImports.add(registryEntry.importName)
    }
  })

  if (plan.usages.length === 0 && plan.unsupported.length === 0) {
    return null
  }

  return plan
}

interface ProjectScaffoldContext {
  snapshot: SiteSnapshot
  provider: ProviderKind
  dataSource: DataSourceKind
  projectName: string
  diagnostics: GeneratorDiagnostic[]
  diagnosticSummary: DiagnosticsSummary
  componentSummary: ComponentMappingSummary
  routes: RouteDefinition[]
  slugRegistry: SlugRegistryEntry[]
  structureIndex: StructureIndex
  websiteId: string
  templateOverrideKey?: string | null
  repoRoot: string
  mediaDiagnostics: MediaDiagnosticsReport
  graphqlRuntime?: {
    endpoint?: string
    apiKey?: string
    timeoutMs?: number
    maxRetries?: number
  }
  /** Optimizely runtime configuration for the Optimizely provider */
  optimizelyRuntime?: {
    gateway: string
    singleKey: string
    locale: string
    startPageId: string
  }
  /** Umbraco Compose runtime configuration */
  umbracoComposeRuntime?: {
    projectAlias: string
    region: string
    environment: string
    personalAccessToken: string
  }
  /** Include data/site.ts static snapshot. Default: false for UCS provider (uses database instead) */
  includeStaticSnapshot?: boolean
}

export function populateProjectFiles(builder: ProjectBuilder, context: ProjectScaffoldContext): GenerationManifest {
  const studioLibAliasPath = './lib'
  const mediaStorageUrl = process.env.STUDIO_MEDIA_STORAGE_S3_PUBLIC_BASE_URL
  const remoteImagePatterns: RemoteImagePattern[] = collectRemoteImagePatterns(context.snapshot, {
    mediaStorageUrl
  })
  const includeGraphqlRuntime = context.dataSource === 'graphql'
  const includeOptimizelyRuntime = context.provider === 'optimizely'
  const includeUmbracoComposeRuntime = context.provider === 'umbraco-compose'

  // Determine the default runtime provider
  // standalone provider uses UCS (database) at runtime by default
  let defaultRuntimeProvider: 'static' | 'ucs' | 'graphql' | 'optimizely' | 'umbraco-compose'
  if (context.provider === 'optimizely') {
    defaultRuntimeProvider = 'optimizely'
  } else if (context.provider === 'umbraco-compose') {
    defaultRuntimeProvider = 'umbraco-compose'
  } else if (context.provider === 'standalone') {
    // Standalone generates without DB, but runs with UCS provider at runtime
    defaultRuntimeProvider = includeGraphqlRuntime ? 'graphql' : 'ucs'
  } else if (context.provider === 'ucs') {
    defaultRuntimeProvider = includeGraphqlRuntime ? 'graphql' : 'ucs'
  } else {
    defaultRuntimeProvider = 'static'
  }

  const pushDiagnostic = (diagnostic: GeneratorDiagnostic) => {
    context.diagnostics.push(diagnostic)
    if (diagnostic.level === 'error') {
      context.diagnosticSummary.errorCount += 1
    } else if (diagnostic.level === 'warn') {
      context.diagnosticSummary.warnCount += 1
    } else {
      context.diagnosticSummary.infoCount += 1
    }
  }

  const snapshotDesignSystem = context.snapshot.designSystem ?? null
  const designSystemTokens = snapshotDesignSystem?.tokens
    ? (JSON.parse(JSON.stringify(snapshotDesignSystem.tokens)) as DesignSystem)
    : null
  const fontAdjustments = designSystemTokens ? applyFontFallbacks(designSystemTokens) : []
  let aliasMap: Record<string, string> | null = null
  let aliasDiagnostics: Array<{ type: 'warning' | 'error' | 'info'; code: string; message: string; source: string; severity: 'low' | 'medium' | 'high'; tokenRef?: string }> = []
  let fallbackSummary: Record<string, number> = {}

  if (designSystemTokens) {
    const aliasSource = snapshotDesignSystem?.aliases ?? snapshotDesignSystem?.tokens?.aliases ?? designSystemTokens.aliases
    // Use new simplified design system reader - handles both new and legacy formats
    const computedVariables = getDesignSystemVariables(designSystemTokens)

    const sourceDiagnostics = aliasSource?.diagnostics ?? []
    const sourceFallbackSummary = aliasSource?.fallbackSummary ?? {}
    const sourceVariables = aliasSource?.cssVariables ?? null
    const computedAt = new Date().toISOString()

    if (sourceVariables && Object.keys(sourceVariables).length > 0) {
      aliasMap = {
        ...sourceVariables,
        ...computedVariables
      }
    } else {
      aliasMap = computedVariables
    }

    // Preserve existing diagnostics from source (new system doesn't generate diagnostics)
    aliasDiagnostics = [...sourceDiagnostics]

    // Preserve existing fallback summary from source
    fallbackSummary = { ...sourceFallbackSummary }

    if (aliasMap) {
      const fallbackSummaryForTokens = Object.keys(fallbackSummary).length > 0 ? { ...fallbackSummary } : undefined
      const diagnosticsForTokens = aliasDiagnostics.length > 0 ? [...aliasDiagnostics] : undefined

      designSystemTokens.aliases = {
        cssVariables: aliasMap,
        computedAt,
        diagnostics: diagnosticsForTokens,
        fallbackSummary: fallbackSummaryForTokens
      }

      if (snapshotDesignSystem) {
        const snapshotAliasPayload = {
          cssVariables: { ...aliasMap },
          computedAt,
          diagnostics: diagnosticsForTokens ? diagnosticsForTokens.map(entry => ({ ...entry })) : undefined,
          fallbackSummary: fallbackSummaryForTokens ? { ...fallbackSummaryForTokens } : undefined
        }

        snapshotDesignSystem.aliases = snapshotAliasPayload
        if (snapshotDesignSystem.tokens) {
          snapshotDesignSystem.tokens.aliases = snapshotAliasPayload
        }
      }

      const radiusAlias = aliasMap['--radius']
      if (typeof radiusAlias === 'string' && designSystemTokens.radii) {
        const match = radiusAlias.trim().match(/^(-?\d*\.?\d+)([a-z%]+)?$/i)
        if (match) {
          const numeric = Number.parseFloat(match[1])
          const unit = match[2] ?? designSystemTokens.radii.unit
          if (!Number.isNaN(numeric)) {
            designSystemTokens.radii.base = numeric
            if (unit) {
              designSystemTokens.radii.unit = unit
            }
          }
        }
      }
    }
  }

  // Generate CSS - use simplified path for new format, legacy path for old format
  let designSystemCss: ReturnType<typeof generateDesignSystemCSSVariables> | null = null

  if (snapshotDesignSystem?.tokens && isNewFormat(snapshotDesignSystem.tokens)) {
    // NEW FORMAT: Use simplified CSS generation (Phase 2 complete - no compatibility shim needed)
    const normalizedTokens = snapshotDesignSystem.tokens as ShadcnDesignSystemTokens
    const lightVars = generateShadcnCss(normalizedTokens.variables)
    const darkVars = normalizedTokens.darkVariables
      ? generateShadcnCss(normalizedTokens.darkVariables)
      : generateShadcnCss(SHADCN_DEFAULTS_DARK)

    // Build the combined CSS output structure - pure shadcn variables only
    designSystemCss = {
      canonical: lightVars,
      aliases: '', // No longer needed - all components use shadcn variables directly
      combined: lightVars,
      sections: {
        root: lightVars,
        dark: darkVars,
        themeLight: `  color-scheme: light;\n${lightVars}`,
        themeDark: `  color-scheme: dark;\n${darkVars}`,
        themeInverted: `  color-scheme: dark;\n${darkVars}`,
      },
    }

    pushDiagnostic({
      code: 'DESIGN_SYSTEM_NEW_FORMAT',
      level: 'info',
      message: 'Using simplified shadcn-based design system format.',
      context: {
        detectedCount: normalizedTokens.extraction?.detectedCount ?? 0,
        confidence: normalizedTokens.extraction?.confidence ?? 0,
      },
    })
  } else if (designSystemTokens) {
    // LEGACY FORMAT: Use existing complex mapping
    designSystemCss = generateDesignSystemCSSVariables(designSystemTokens, aliasMap ?? null)
  }

  const layoutFontPlan = buildLayoutFontPlan(designSystemTokens ?? null)

  if (aliasDiagnostics.length > 0) {
    aliasDiagnostics.forEach(entry => {
      const level: GeneratorDiagnostic['level'] =
        entry.type === 'error' ? 'error' : entry.type === 'warning' ? 'warn' : 'info'
      pushDiagnostic({
        code: `DESIGN_SYSTEM_${entry.code}`,
        level,
        message: entry.message,
        context: {
          source: entry.source,
          severity: entry.severity,
          tokenRef: entry.tokenRef
        }
      })
    })
  }

  if (designSystemTokens && Object.keys(fallbackSummary).length > 0) {
    pushDiagnostic({
      code: 'DESIGN_SYSTEM_FALLBACK_APPLIED',
      level: 'info',
      message: 'Design system export required Catalyst fallback values for some aliases.',
      context: { fallbackSummary }
    })
  }

  if (fontAdjustments.length > 0) {
    fontAdjustments.forEach(adjustment => {
      const code =
        adjustment.reason === 'fallback'
          ? 'DESIGN_SYSTEM_FONT_FALLBACK'
          : 'DESIGN_SYSTEM_FONT_NORMALIZED'
      const message =
        adjustment.reason === 'fallback'
          ? `Promoted ${adjustment.target} font stack to use available fonts (${adjustment.normalized}).`
          : `Normalized ${adjustment.target} font stack ordering to ${adjustment.normalized}.`

      pushDiagnostic({
        code,
        level: 'info',
        message,
        context: {
          target: adjustment.target,
          originalStack: adjustment.original,
          normalizedStack: adjustment.normalized
        }
      })
    })
  }

  if (layoutFontPlan && layoutFontPlan.unsupported.length > 0) {
    pushDiagnostic({
      code: 'DESIGN_SYSTEM_FONTS_UNSUPPORTED',
      level: 'warn',
      message: 'Some design system fonts could not be auto-loaded; review layout TODOs to complete font setup.',
      context: { unsupportedFonts: layoutFontPlan.unsupported }
    })
  }

  addBaseProjectFiles(builder, {
    projectName: context.projectName,
    siteName: context.snapshot.site.name,
    siteDescription: context.snapshot.site.description,
    studioLibAliasPath,
    remoteImagePatterns,
    designSystemCss,
    runtimeProvider: defaultRuntimeProvider,
    includeGraphqlRuntime
  })

  addLayout(builder, context.snapshot, layoutFontPlan)

  const repoLibDir = resolve(context.repoRoot, 'lib')
  addDirectoryToBuilder(builder, resolve(repoLibDir, 'studio/components/cms'), 'lib/studio/components/cms')
  addDirectoryToBuilder(builder, resolve(repoLibDir, 'studio/headless'), 'lib/studio/headless')
  addDirectoryToBuilder(builder, resolve(repoLibDir, 'studio/types/site-builder'), 'lib/studio/types/site-builder')
  addDirectoryToBuilder(builder, resolve(repoLibDir, 'studio/utils'), 'lib/studio/utils')
  addDirectoryToBuilder(builder, resolve(repoLibDir, 'studio/design-system'), 'lib/studio/design-system')
  addDirectoryToBuilder(builder, resolve(repoLibDir, 'studio/pages/_core'), 'lib/studio/pages/_core')
  addDirectoryToBuilder(builder, resolve(context.repoRoot, 'lib/generated/prisma'), 'lib/generated/prisma')

  // Fix Prisma schema output path for standalone HEAD projects
  // The main project's schema uses "../lib/generated/prisma" (relative to prisma/schema.prisma)
  // but in HEAD projects the schema is at lib/generated/prisma/schema.prisma, so we need "."
  const prismaSchemaPath = resolve(context.repoRoot, 'lib/generated/prisma/schema.prisma')
  if (existsSync(prismaSchemaPath)) {
    let schemaContent = readFileSync(prismaSchemaPath, 'utf8')
    schemaContent = schemaContent.replace(
      /output\s*=\s*["']\.\.\/lib\/generated\/prisma["']/,
      'output        = "."'
    )
    builder.addFile('lib/generated/prisma/schema.prisma', schemaContent)
  }

  const copyFileToBuilder = (source: string, target: string) => {
    const contents = readFileSync(source)
    builder.addFile(target, contents)
  }

  copyFileToBuilder(
    resolve(repoLibDir, 'studio/import/types/design-system.types.ts'),
    'lib/studio/import/types/design-system.types.ts'
  )
  copyFileToBuilder(
    resolve(repoLibDir, 'studio/import/repositories/design-system.repository.ts'),
    'lib/studio/import/repositories/design-system.repository.ts'
  )
  copyFileToBuilder(resolve(context.repoRoot, 'tailwind-plugin.ts'), 'tailwind-plugin.ts')
  addDirectoryToBuilder(builder, resolve(context.repoRoot, 'lib/design-system'), 'lib/design-system')

  const publicDir = resolve(context.repoRoot, 'public')
  if (existsSync(publicDir)) {
    addDirectoryToBuilder(builder, publicDir, 'public')
  }

  const componentModulePaths: ComponentModulePaths = {
    componentImportPath: '@/lib/studio/components/cms',
    componentTypeImportPath: '@/lib/studio/components/cms/_core/types'
  }

  // Only include static snapshot if explicitly requested (for debugging)
  // For UCS provider, database is used at runtime - no need for 100MB+ site.ts file
  const shouldIncludeStaticSnapshot = context.includeStaticSnapshot === true
  if (shouldIncludeStaticSnapshot) {
    builder.addFile('data/site.ts', buildSiteDataModule(context.snapshot))
  } else {
    // Create a stub that throws a helpful error if static provider is used without snapshot
    // Use GeneratedSiteSnapshot | null type to enable proper type checking in dependent code
    builder.addFile('data/site.ts', `// Static snapshot not generated (use --include-static-snapshot flag if needed)
// This site uses the UCS database provider at runtime.
import type { GeneratedSiteSnapshot } from '@/generated/providers/types'

export const siteSnapshot: GeneratedSiteSnapshot | null = null

export function getPageByFullPath(_fullPath: string): never {
  throw new Error(
    'Static snapshot not available. This site was generated with --provider ucs and uses the database at runtime. ' +
    'To generate a static snapshot for debugging, re-run with --include-static-snapshot flag.'
  )
}
`)
  }
  builder.addFile('generated/components.tsx', buildComponentsModule(context.componentSummary, componentModulePaths))
  builder.addFile('generated/runtime/component-tree.ts', buildComponentTreeModule())
  builder.addFile('generated/runtime/loaders.ts', buildRuntimeLoadersModule())
  builder.addFile('generated/runtime/render-context.ts', buildRenderContextModule())
  builder.addFile('generated/runtime/component-probe.ts', buildComponentProbeModule())
  builder.addFile('generated/runtime/request-helpers.ts', buildRouteRequestHelpersModule())
  builder.addFile('generated/page-renderer.tsx', buildPageRendererModule())
  builder.addFile(
    'generated/runtime/config.ts',
    buildRuntimeConfigModule(context.snapshot, context.websiteId, context.templateOverrideKey, {
      optimizely: includeOptimizelyRuntime ? context.optimizelyRuntime : undefined
    })
  )
  builder.addFile('generated/runtime/cache.ts', buildRuntimeCacheModule())

  // Generate Optimizely runtime files when using Optimizely provider
  if (includeOptimizelyRuntime) {
    builder.addFile('generated/runtime/optimizely-client.ts', buildOptimizelyClientModule())
    builder.addFile('generated/runtime/optimizely-mapper.ts', buildOptimizelyMapperModule())
  }
  builder.addFile('generated/runtime/site-data.ts', buildRuntimeSiteDataModule())
  builder.addFile('generated/runtime/design-system-injector.tsx', buildDesignSystemInjectorModule())
  builder.addFile('generated/runtime/routing.ts', buildRuntimeRoutingModule(context.slugRegistry, context.structureIndex, context.snapshot.redirects ?? [], defaultRuntimeProvider))
  builder.addFile('generated/runtime/diagnostics.ts', buildRuntimeDiagnosticsModule())
  builder.addFile('app/api/head-runtime/diagnostics/route.ts', buildDiagnosticsApiRouteModule())
  builder.addFile('app/api/head-runtime/diagnostics/log/route.ts', buildDiagnosticsLogApiRouteModule())
  builder.addFile('app/api/head-runtime/cache/route.ts', buildCacheApiRouteModule())
  builder.addFile('app/api/head-runtime/health/route.ts', buildHealthApiRouteModule())
  builder.addFile('generated/validation/run.ts', buildValidationRunnerModule())

  // Generate sitemap.ts that excludes redirect source paths
  // For UCS/GraphQL: uses provider (dynamic sitemap from database)
  // For static: uses baked-in site.json
  const siteOrigin = context.snapshot.site.origin || 'https://example.com'
  builder.addFile('app/sitemap.ts', buildSitemapModule(siteOrigin, defaultRuntimeProvider))

  // Generate site.json only for static provider
  // UCS/GraphQL providers use dynamic sitemap that queries the database
  if (defaultRuntimeProvider === 'static') {
    const siteJsonData = {
      pages: context.snapshot.pages.map(page => ({
        id: page.id,
        fullPath: page.fullPath,
        title: page.title
      })),
      redirects: context.snapshot.redirects ?? []
    }
    builder.addFile('generated/data/site.json', stringifyJson(siteJsonData))
  }
  builder.addFile('generated/providers/types.ts', buildProviderTypesModule())
  builder.addFile('generated/providers/static-provider.ts', buildStaticProviderModule())
  if (includeGraphqlRuntime) {
    builder.addFile('generated/providers/graphql-provider.ts', buildGraphqlProviderModule())
  }
  builder.addFile('generated/providers/ucs-provider.ts', buildUcsProviderModule())
  if (includeOptimizelyRuntime) {
    builder.addFile('generated/providers/optimizely-provider.ts', buildOptimizelyProviderModule())
  }
  if (includeUmbracoComposeRuntime) {
    builder.addFile('generated/providers/umbraco-compose-provider.ts', buildUmbracoComposeProviderModule())
  }
  builder.addFile(
    'generated/providers/index.ts',
    buildProvidersIndexModule(context.provider, {
      includeGraphql: includeGraphqlRuntime,
      includeOptimizely: includeOptimizelyRuntime,
      includeUmbracoCompose: includeUmbracoComposeRuntime,
      defaultRuntimeProvider
    })
  )
  builder.addFile(
    'generated/providers/README.md',
    buildProvidersReadme({
      includeGraphql: includeGraphqlRuntime,
      includeOptimizely: includeOptimizelyRuntime,
      defaultRuntimeProvider
    })
  )

  if (designSystemTokens) {
    builder.addFile(
      'generated/design-system.json',
      stringifyJson({
        generatedAt: new Date().toISOString(),
        tokens: designSystemTokens,
        css: {
          canonical: designSystemCss?.canonical ?? null,
          aliases: designSystemCss?.aliases ?? null,
          combined: designSystemCss?.combined ?? null,
          sections: designSystemCss
            ? {
                root: designSystemCss.sections.root,
                dark: designSystemCss.sections.dark,
                themeLight: designSystemCss.sections.themeLight,
                themeDark: designSystemCss.sections.themeDark,
                themeInverted: designSystemCss.sections.themeInverted
              }
            : null
        },
        aliasMap,
        diagnostics: aliasDiagnostics,
        fallbackSummary,
        fonts: layoutFontPlan
          ? {
              googleImports: layoutFontPlan.imports,
              usage: layoutFontPlan.usages.map(usage => ({
                target: usage.target,
                importName: usage.importName,
                options: usage.optionsLiteral
              })),
              unsupported: layoutFontPlan.unsupported
            }
          : undefined
      })
    )
  }

  const envFile = buildEnvLocalFile({
    provider: context.provider,
    websiteId: context.websiteId,
    templateOverrideKey: context.templateOverrideKey ?? null,
    defaultRuntimeProvider,
    includeGraphqlRuntime,
    graphqlRuntime: context.graphqlRuntime,
    // Pass environment values from the parent Catalyst Studio app to generated head
    mediaStoragePublicUrl: process.env.STUDIO_MEDIA_STORAGE_S3_PUBLIC_BASE_URL,
    databaseUrl: process.env.DATABASE_URL,
    directUrl: process.env.DIRECT_URL,
    // Umbraco Compose configuration
    umbracoCompose: includeUmbracoComposeRuntime ? context.umbracoComposeRuntime : undefined
  })
  builder.addFile('.env', envFile)
  builder.addFile('.env.local', envFile)
  builder.addFile(
    'lib/generated/prisma-client.ts',
    buildPrismaClientModule({ stub: defaultRuntimeProvider !== 'ucs' })
  )

  builder.addFile('app/[...slug]/page.tsx', buildCatchAllRouteModule())
  builder.addFile('app/page.tsx', buildRootRouteModule())
  builder.addFile('app/error.tsx', buildAppErrorModule())
  builder.addFile('app/global-error.tsx', buildGlobalErrorModule())

  const routes = context.routes.length > 0 ? context.routes : context.componentSummary.pages.map(page => ({
    pageId: page.pageId,
    fullPath: page.fullPath,
    routePath: page.fullPath.replace(/^\/+/, ''),
    segments: page.fullPath.replace(/^\/+|\/+$/g, '').split('/').filter(Boolean),
    title:
      context.snapshot.pages.find(snapshotPage => snapshotPage.id === page.pageId)?.title ??
      page.template?.name ??
      page.fullPath,
    templateKey: page.templateKey
  }))

  const manifest = buildManifest(context.snapshot, context.provider, routes, context.componentSummary)

  // Generate manifest.json only for static provider
  // For UCS/GraphQL, this large file is not needed at runtime (data comes from database)
  if (defaultRuntimeProvider === 'static') {
    builder.addFile('generated/manifest.json', stringifyJson(manifest))
  }

  builder.addFile('generated/diagnostics.json', buildDiagnosticsModule(context.diagnostics, context.diagnosticSummary))
  builder.addFile('generated/media-diagnostics.json', stringifyJson(context.mediaDiagnostics))

  return manifest
}
