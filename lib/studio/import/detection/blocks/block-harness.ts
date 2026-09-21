import { DetectionConfig } from '@/lib/studio/import/config'
import type { ImportDetectionOptions } from '../types'
import type { DetectionSectionTask } from '../section-plan'
import type { SectionExtractionArtifact } from '../section-aggregation'
import type { GlobalSectionReuseProvenance } from '../global-section-cache'
import type { DetectionTelemetry } from '@/lib/studio/import/telemetry/detection-telemetry'
import type { WebFetchTools, FetchOutlineResult } from '@/lib/studio/import/services/web-tools'
import type { createLLMClient } from '@/lib/studio/import/services/llm-client'
import { DetectionFailureError, loadReusableSectionFromCheckpoint, mapWithConcurrency, type SectionProcessingResult } from '@/lib/studio/import/web-detection'
import { BlockCutError, renderAndCut } from './block-cutter'
import { buildBlockInput } from './block-input'
import { pickBlockTypes, selectBlockCandidates } from './block-pick'
import { extractBlock } from './block-extract'
import { inferLocationFromType } from '../response-parser'
import { applyRegion } from '../../services/detection-post-processor/region-processor'

// Blocks cost far less than section slices; allow long pages while bounding runaway fragmentation.
const MAX_BLOCKS_PER_PAGE = 150

export async function runBlockHarness({
  url,
  options,
  endpointModel,
  effectiveMaxTokens,
  telemetry,
  webTools,
  preFlightFetch,
  client,
  tasks,
  failedSections
}: {
  url: string
  options: ImportDetectionOptions
  endpointModel: string
  effectiveMaxTokens: number
  telemetry: DetectionTelemetry
  webTools: WebFetchTools
  preFlightFetch: FetchOutlineResult
  client: ReturnType<typeof createLLMClient>
  tasks: DetectionSectionTask[]
  failedSections: Array<{ task: DetectionSectionTask; error: unknown }>
}): Promise<SectionProcessingResult[]> {
  const { checkpointSession, checkpointService, globalSectionCache, onProgress } = options
  const html = webTools.getRawHtml(preFlightFetch.handle)
  const { bgImageMap, stylesheets } = webTools.getPageStyling(preFlightFetch.handle)
  const finalUrl = preFlightFetch.finalUrl || url
  let cut
  try {
    cut = await renderAndCut({ html, finalUrl, stylesheets })
  } catch (error) {
    if (error instanceof BlockCutError) {
      throw new DetectionFailureError(error.message, { model: endpointModel, stage: 'fetch', validationPath: 'blocks.render' })
    }
    throw error
  }
  const blocks = [...cut.blocks].sort((a, b) => a.order - b.order)
  if (blocks.length > MAX_BLOCKS_PER_PAGE) {
    throw new DetectionFailureError(
      'Detection outline returned ' + blocks.length + ' blocks, exceeding the per-page limit of ' + MAX_BLOCKS_PER_PAGE,
      {
        model: endpointModel,
        stage: 'budget',
        validationPath: 'outline.blocks',
        requestCount: 0,
        skippedSectionsDueToBudget: blocks.slice(MAX_BLOCKS_PER_PAGE).map(block => 'block:' + block.order)
      }
    )
  }
  const assignRegions = (artifact: SectionExtractionArtifact, region: typeof blocks[number]['region']) => {
    for (const component of artifact.components) {
      const inferred = inferLocationFromType(component.type)
      applyRegion(component, inferred && inferred !== 'main' ? inferred : region)
    }
  }
  tasks.push(...blocks.map(block => ({
    sectionKey: 'block:' + block.order,
    sectionOrder: block.order - 1,
    role: block.region,
    required: block.region === 'header' || block.region === 'footer',
    candidateTypes: [] as string[]
  })))
  const concurrency = Math.max(1, DetectionConfig.blockConcurrency)
  const cached = await mapWithConcurrency(tasks, concurrency, async task => {
    const result = checkpointSession && checkpointService
      ? await checkpointService.loadSectionResult(checkpointSession, url, task.sectionKey)
      : null
    return result?.llmDebug?.model === endpointModel && result.llmDebug.blockPick && Array.isArray(result.components)
      ? result
      : null
  })
  const picks = await mapWithConcurrency(blocks.map((block, index) => ({ block, index })), concurrency, async ({ block, index }) => {
    if (cached[index]) return { input: undefined, pick: cached[index]!.llmDebug!.blockPick!, error: undefined }
    try {
      const blockInput = buildBlockInput({ html, block, bgImageMap })
      const input = {
        ...blockInput,
        selection: selectBlockCandidates(blockInput, url),
        sectionKey: tasks[index].sectionKey,
        url,
        finalUrl,
        websiteId: options.websiteId
      }
      const { allowedTypes, source, topChoices, issues } = await pickBlockTypes(input, input.selection)
      const pick = { allowedTypes, source, topChoices, issues: [...new Set([...issues, ...cut.issues])] }
      return { input, pick, error: undefined }
    } catch (error) {
      return { input: undefined, pick: undefined, error }
    }
  })
  tasks.forEach((task, index) => {
    task.candidateTypes = picks[index].pick?.allowedTypes ?? []
  })
  if (checkpointSession && checkpointService) {
    await checkpointService.savePagePlan(checkpointSession, url, {
      url,
      generatedAt: new Date().toISOString(),
      sections: tasks
    }).catch(error => {
      console.warn('[Checkpoint] Failed to save page plan:', error)
    })
  }
  const pageOutline = blocks.map((block, index) => {
    const pick = picks[index].pick
    const type = pick?.source === 'model'
      ? pick.topChoices.component
      : 'unavailable'
    return block.order + ' ' + block.region + ' ' + type
  }).join('; ')
  let completed = 0
  return mapWithConcurrency(tasks.map((task, index) => ({ task, index })), concurrency, async ({ task, index }) => {
    const saved = cached[index]
    const { input, pick, error: pickError } = picks[index]
    const started = Date.now()
    const result: SectionProcessingResult = {
      artifact: { sectionKey: task.sectionKey, sectionOrder: task.sectionOrder, components: [] },
      usage: {},
      requestCount: 0,
      reuse: { freshSections: 0, reusedSections: 0, cacheHits: 0, cacheMisses: 0 }
    }
    try {
      if (saved) {
        result.artifact = {
          ...result.artifact,
          components: saved.components,
          durationMs: saved.durationMs,
          pageMetadata: saved.pageMetadata,
          parserRepairs: saved.llmDebug?.parserRepairs
        }
        assignRegions(result.artifact, blocks[index].region)
        return result
      }
      if (!input || !pick) throw pickError || new Error('Block input unavailable')
      let fresh: Awaited<ReturnType<typeof extractBlock>> | undefined
      const extract = async (): Promise<SectionExtractionArtifact> => {
        fresh = await extractBlock({
          blockInput: input,
          allowedTypes: pick.allowedTypes,
          selection: input.selection,
          pageOutline,
          client,
          endpointModel,
          effectiveMaxTokens,
          telemetry,
          confidenceThreshold: options.confidenceThreshold
        })
        return fresh.artifact
      }
      const origin = (() => {
        try {
          return new URL(finalUrl).origin
        } catch {
          return 'unknown'
        }
      })()
      const reuseKey = DetectionConfig.globalSectionReuse && globalSectionCache
        ? globalSectionCache.createKey({
            role: task.role,
            origin,
            sectionSlice: input.nodes,
            candidateTypes: pick.allowedTypes,
            model: endpointModel
          })
        : null
      const checkpointReuse = DetectionConfig.globalSectionReuse
        ? await loadReusableSectionFromCheckpoint({ checkpointSession, checkpointService, reuseKey, role: task.role, currentUrl: url })
        : null
      const cachedResult = checkpointReuse || (DetectionConfig.globalSectionReuse && globalSectionCache
        ? await globalSectionCache.getOrCreate(reuseKey, { url, sectionKey: task.sectionKey }, extract)
        : {
            artifact: await extract(),
            provenance: {
              extractionMode: 'fresh',
              cacheHit: false,
              cacheMissReason: DetectionConfig.globalSectionReuse ? 'cache_unavailable' : 'reuse_disabled'
            } as GlobalSectionReuseProvenance
          })
      const provenance = cachedResult.provenance
      result.artifact = {
        ...cachedResult.artifact,
        sectionKey: task.sectionKey,
        sectionOrder: task.sectionOrder,
        durationMs: Date.now() - started,
        pageMetadata: provenance.extractionMode === 'reused' ? undefined : cachedResult.artifact.pageMetadata
      }
      assignRegions(result.artifact, blocks[index].region)
      result.usage = fresh?.usage ?? {}
      result.requestCount = fresh?.requestCount ?? 0
      result.pageSummary = fresh?.pageSummary
      result.reuse = {
        freshSections: provenance.extractionMode === 'fresh' ? 1 : 0,
        reusedSections: provenance.extractionMode === 'reused' ? 1 : 0,
        cacheHits: provenance.cacheHit ? 1 : 0,
        cacheMisses: provenance.cacheHit ? 0 : 1
      }
      if (checkpointSession && checkpointService) {
        await checkpointService.saveSectionResult(
          checkpointSession,
          url,
          task.sectionKey,
          task.sectionOrder,
          result.artifact.components,
          Date.now() - started,
          result.artifact.pageMetadata,
          {
            ...fresh?.debug,
            model: endpointModel,
            sectionKey: task.sectionKey,
            sectionOrder: task.sectionOrder,
            parserRepairs: result.artifact.parserRepairs,
            blockPick: pick,
            ...provenance
          }
        )
      }
      telemetry.recordPhase('section_extract', Date.now() - started, {
        sectionKey: task.sectionKey,
        sectionOrder: task.sectionOrder,
        role: task.role,
        extractionMode: provenance.extractionMode,
        cacheHit: provenance.cacheHit,
        requestCount: result.requestCount,
        componentCount: result.artifact.components.length,
        originalBytes: input.stats.approxBytes
      })
      return result
    } catch (error) {
      failedSections.push({ task, error })
      result.artifact.extractionFailed = true
      result.artifact.components = []
      if (error instanceof DetectionFailureError) {
        result.usage = error.debug.usage ?? result.usage
        result.requestCount = error.debug.requestCount ?? result.requestCount
      }
      const previous = checkpointSession && checkpointService
        ? await checkpointService.loadSectionError(checkpointSession, url, task.sectionKey)
        : null
      if (checkpointSession && checkpointService) {
        await checkpointService.saveSectionError(
          checkpointSession,
          url,
          task.sectionKey,
          task.sectionOrder,
          error instanceof Error ? error : new Error(String(error)),
          (previous?.attemptCount ?? 0) + 1,
          error instanceof DetectionFailureError
            ? error.debug.stage === 'output_limit' ? 'output_limit' : error.debug.stage === 'llm_call' ? 'llm_call' : 'parsing'
            : undefined,
          { ...(error instanceof DetectionFailureError ? error.debug : {}), blockPick: pick }
        )
      }
      console.warn('[DetectionService] Section ' + task.sectionKey + ' (' + task.role + ') failed and was dropped: ' +
        (error instanceof Error ? error.message : String(error)))
      return result
    } finally {
      completed++
      onProgress?.({
        subsystemProgress: { id: 'llm_detection', current: completed, total: tasks.length },
        message: 'Processed block ' + completed + ' of ' + tasks.length
      })
    }
  })
}
