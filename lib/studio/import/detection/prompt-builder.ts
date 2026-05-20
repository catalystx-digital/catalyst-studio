import type { DetectionPromptPayload } from './types'
import type { DetectionTelemetry } from '../telemetry/detection-telemetry'

type ComponentCatalogModule = typeof import('@/lib/studio/ai/component-catalog')
type PageCatalogModule = typeof import('@/lib/studio/ai/page-catalog')
type SchemaBuilderModule = typeof import('@/lib/studio/ai/prompt-schema-builder')
type ContractBuilderModule = typeof import('@/lib/studio/ai/prompt-contract-builder')

type SummariesResult = {
  componentCatalog: ComponentCatalogModule
  pageCatalog: PageCatalogModule
  contractBuilder: ContractBuilderModule
  schemaBuilder: SchemaBuilderModule
  componentSummary: Awaited<ReturnType<ComponentCatalogModule['getComponentCatalogSummary']>>
  pageSummary: Awaited<ReturnType<PageCatalogModule['getPageCatalogSummary']>>
  schemaSummary: Awaited<ReturnType<SchemaBuilderModule['buildPromptSchemaSummary']>>
  contractBundle: Awaited<ReturnType<ContractBuilderModule['buildPromptContractBundle']>>
  cacheKey: string
  cacheHit: boolean
}

interface BuildDetectionPromptOptions {
  telemetry?: DetectionTelemetry
}

const PROMPT_CACHE_TTL_MS = 60_000

let cachedPrompt: {
  key: string
  payload: DetectionPromptPayload
  pagePromptLength: number
  timestamp: number
} | null = null

function buildCacheKey(
  componentSummary: SummariesResult['componentSummary'],
  pageSummary: SummariesResult['pageSummary'],
  schemaSummary: SummariesResult['schemaSummary'],
  contractBundle: SummariesResult['contractBundle']
): string {
  return [
    componentSummary.generatedAt,
    componentSummary.total,
    pageSummary.generatedAt,
    pageSummary.templates.length,
    schemaSummary.schemaHash,
    contractBundle.hash
  ].join('|')
}

async function resolveSummaries(telemetry?: DetectionTelemetry): Promise<SummariesResult> {
  const loadSummaries = async () => {
    const [componentCatalog, pageCatalog, schemaBuilder, contractBuilder] = await Promise.all([
      import('@/lib/studio/ai/component-catalog'),
      import('@/lib/studio/ai/page-catalog'),
      import('@/lib/studio/ai/prompt-schema-builder'),
      import('@/lib/studio/ai/prompt-contract-builder')
    ])

    const [componentSummary, pageSummary, schemaSummary, contractBundle] = await Promise.all([
      componentCatalog.getComponentCatalogSummary(),
      pageCatalog.getPageCatalogSummary(),
      schemaBuilder.buildPromptSchemaSummary(),
      contractBuilder.buildPromptContractBundle()
    ])

    const cacheKey = buildCacheKey(componentSummary, pageSummary, schemaSummary, contractBundle)
    const cacheHit = Boolean(
      cachedPrompt &&
      cachedPrompt.key === cacheKey &&
      Date.now() - cachedPrompt.timestamp < PROMPT_CACHE_TTL_MS
    )

    return {
      componentCatalog,
      pageCatalog,
      schemaBuilder,
      contractBuilder,
      componentSummary,
      pageSummary,
      schemaSummary,
      contractBundle,
      cacheKey,
      cacheHit
    }
  }

  if (!telemetry) {
    return await loadSummaries()
  }

  return await telemetry.timePhase('contract_loading', loadSummaries, result => ({
    componentCount: result?.componentSummary.components.length ?? 0,
    templateCount: result?.pageSummary.templates.length ?? 0,
    contractHash: result?.contractBundle.hash,
    fromCache: result?.cacheHit ?? false
  }))
}

export async function buildDetectionPromptFromCatalog(
  options: BuildDetectionPromptOptions = {}
): Promise<DetectionPromptPayload> {
  const { telemetry } = options
  const {
    componentCatalog,
    pageCatalog,
    componentSummary,
    pageSummary,
    schemaSummary,
    contractBundle,
    cacheKey,
    cacheHit
  } =
    await resolveSummaries(telemetry)

  if (cacheHit && cachedPrompt) {
    if (telemetry) {
      telemetry.recordPhase('prompt_build', 0, {
        promptLength: cachedPrompt.payload.prompt.length,
        componentCount: componentSummary.components.length,
        templateCount: pageSummary.templates.length,
        fromCache: true
      })
    }
    return {
      prompt: cachedPrompt.payload.prompt,
      components: componentSummary.components as DetectionPromptPayload['components'],
      pageSummary
    }
  }

  const buildPrompt = async () => {
    const pagePrompt = pageCatalog.buildPageTemplatePrompt(pageSummary)
    const prompt = componentCatalog.buildDetectionPrompt(componentSummary, {
      schemaSummary,
      contractBundle,
      pagePrompt,
      pageSummary
    })
    return { prompt, pagePromptLength: pagePrompt.length }
  }

  const promptResult = telemetry
    ? await telemetry.timePhase('prompt_build', buildPrompt, result => ({
        promptLength: result?.prompt.length ?? 0,
        pagePromptLength: result?.pagePromptLength ?? 0,
        componentCount: componentSummary.components.length,
        templateCount: pageSummary.templates.length,
        schemaHash: schemaSummary.schemaHash,
        contractHash: contractBundle.hash,
        fromCache: false
      }))
    : await buildPrompt()

  cachedPrompt = {
    key: cacheKey,
    payload: {
      prompt: promptResult.prompt,
      components: componentSummary.components as DetectionPromptPayload['components'],
      pageSummary
    },
    pagePromptLength: promptResult.pagePromptLength,
    timestamp: Date.now()
  }

  return {
    prompt: promptResult.prompt,
    components: componentSummary.components as DetectionPromptPayload['components'],
    pageSummary
  }
}
