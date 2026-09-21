import path from 'node:path'
import { loadSnapshot, writeJson, readJson, digest, errorRecord } from './storage'
import { labelDirectory } from './labels'
import { createReplayTools } from './replay'
import { runtimeRequire, replaceExports } from './runtime'
import { CallRecorder, replayTransport } from './call-recording'
import type { CutResult, Geometry } from '@/lib/studio/import/detection/blocks/block-cutter'
import type { DecisionClient, Question } from '@/lib/studio/decisions/types'

export interface RunFixtures { decision?: DecisionClient; llm?: any; cut?: () => Promise<CutResult> }
export async function decisionRequest(model: string, state: string, questions: Question[]) {
  return { model, state, questions: Object.fromEntries(await Promise.all(questions.map(async q => [q.id, { type: q.shape === 'boolean' ? 'noul' : q.shape, instructions: q.instructions, criteria: typeof q.criteria === 'function' ? await q.criteria() : q.criteria }])) ) }
}

export async function runProductionBlocks(page: string, directory: string, dryRun: boolean, record: any, fixtures?: RunFixtures) {
  const restore: Array<() => void> = []
  const recorder = new CallRecorder(directory, dryRun)
  const sections: any[] = [], errors: any[] = []
  try {
    const snapshot = await loadSnapshot(page)
    const config = runtimeRequire('@/lib/studio/import/config') as typeof import('@/lib/studio/import/config')
    const decisions = runtimeRequire('@/lib/studio/decisions') as typeof import('@/lib/studio/decisions')
    const decisionConfig = decisions.getDecisionConfig()
    const clients = runtimeRequire('@/lib/studio/import/services/llm-client') as typeof import('@/lib/studio/import/services/llm-client')
    restore.push(replaceExports('@/lib/studio/import/services/llm-client', {
      createLLMClient(options: Parameters<typeof clients.createLLMClient>[0]) {
        const client = fixtures?.llm ?? clients.createLLMClient(options)
        return { chat: { completions: { create(payload: any, requestOptions: any) {
          const user = payload.messages.find((m: any) => m.role === 'user')?.content || ''
          const marker = user.indexOf('Extract this single section:\n')
          const sectionKey = marker < 0 ? null : JSON.parse(user.slice(marker + 'Extract this single section:\n'.length)).sectionKey
          const previous = recorder.calls.filter(c => c.sectionKey === sectionKey && c.kind !== 'decision')
          const repair = payload.messages.length > 3
          return recorder.call(repair ? 'repair' : 'extract', payload, () => client.chat.completions.create(payload, requestOptions), { sectionKey, attempt: previous.length + 1, retry: previous.length > 0, fixture: !!fixtures }, requestOptions?.signal)
        } } } }
      }
    }))
    if (fixtures?.cut) restore.push(replaceExports('@/lib/studio/import/detection/blocks/block-cutter', { renderAndCut: fixtures.cut }))
    const { STALL_TIMEOUT_MS, INFRASTRUCTURE_RETRIES } = runtimeRequire('@/lib/studio/import/detection/blocks/block-extract')
    record.snapshotSha256 = snapshot.manifest.sha256
    record.snapshotInputsSha256 = digest(JSON.stringify(snapshot))
    record.pageUrl = snapshot.manifest.url
    record.configuration = { detection: { ...config.DetectionConfig, detectionHarness: 'blocks' }, model: config.ModelConfig, token: config.TokenConfig, confidence: config.ConfidenceConfig, timeout: config.TimeoutConfig }
    record.configurationSha256 = digest(JSON.stringify(record.configuration))
    record.models = { extraction: config.DetectionConfig.blockFillModel, decision: decisionConfig.modelId }
    record.rules = { harness: 'blocks', fillModel: config.DetectionConfig.blockFillModel, concurrency: config.DetectionConfig.blockConcurrency, stallTimeoutMs: STALL_TIMEOUT_MS, infrastructureRetries: INFRASTRUCTURE_RETRIES, validationRetries: 1, postExtractionRepair: false, decisionModel: decisionConfig.modelId, decisionTimeoutMs: decisionConfig.timeoutMs, decisionEnabled: decisionConfig.enabled, decisionShadow: decisionConfig.shadow }
    const previousHarness = config.DetectionConfig.detectionHarness
    Object.assign(config.DetectionConfig, { detectionHarness: 'blocks' })
    restore.push(() => Object.assign(config.DetectionConfig, { detectionHarness: previousHarness }))
    restore.push(replayTransport(snapshot, recorder, [config.OpenRouterConfig.baseUrl.replace(/\/$/, '') + '/chat/completions', decisionConfig.baseUrl.replace(/\/$/, '') + '/alpha/decisions']))
    const web = runtimeRequire('@/lib/studio/import/services/web-tools').getWebFetchTools()
    const replay = createReplayTools(snapshot, undefined, web)
    record.stylingReplay = replay.styling
    restore.push(() => replay.release(snapshot.outline.handle))
    if (dryRun) {
      await replay.fetchOutline({ url: snapshot.manifest.url })
      const geometry = await readJson(path.join(labelDirectory(page), 'geometry.json'))
      if (geometry.page !== page || geometry.snapshotSha256 !== snapshot.manifest.sha256) throw new Error('Dry plan requires saved geometry matching this snapshot')
      const { cutRenderedPage } = runtimeRequire('@/lib/studio/import/detection/blocks/block-cutter') as typeof import('@/lib/studio/import/detection/blocks/block-cutter')
      const adapt = (node: any): Geometry => ({ ...node, anchor: node.evidence?.anchor ?? null, repeatedChildren: node.evidence?.repeatedChildren, children: node.children.map(adapt) })
      const blocks = cutRenderedPage(adapt(geometry.tree))
      if (!blocks.length) throw new Error('Saved geometry produces no blocks')
      record.blockCount = blocks.length
      record.plan = { source: 'production cutter on saved geometry; paid run renders saved HTML again', decisionCalls: blocks.length, fillCalls: blocks.length, conditionalPageDecisionCalls: 2, conditionalRetries: true }
      for (const block of blocks) {
        await recorder.call('decision', { model: decisionConfig.modelId, questions: ['import.block.component', 'import.block.multiple'], block }, async () => { throw new Error('Dry run called a client') })
        await recorder.call('extract', { model: config.DetectionConfig.blockFillModel, sectionKey: 'block:' + block.order, allowedTypes: 'depends on production decision reply' }, async () => { throw new Error('Dry run called a client') })
      }
      record.status = 'dry-run'
      return
    }
    for (const key of ['fetchOutline', 'getSection', 'release', 'getLastFetchOutline'] as const) {
      const original = web[key]
      web[key] = replay[key]
      restore.push(() => { web[key] = original })
    }
    const client = fixtures?.decision ?? decisions.createDecisionClient()
    decisions.setDecisionClient({ askRaw: async (state, questions) => recorder.call('decision', await decisionRequest(decisionConfig.modelId, state, questions), () => client.askRaw(state, questions), { fixture: !!fixtures }) })
    restore.push(() => decisions.setDecisionClient(null))
    const checkpoint = {
      loadSectionResult: async () => null, loadSectionError: async () => null, loadSitemap: async () => null,
      savePagePlan: async (...args: any[]) => { record.blockCount = args[2].sections.length; await writeJson(path.join(directory, 'section-plan.json'), args[2]) },
      saveSectionResult: async (...args: any[]) => { sections.push({ sectionKey: args[2], sectionOrder: args[3], components: args[4], durationMs: args[5], debug: args[7] }); await writeJson(path.join(directory, 'sections.json'), sections) },
      saveSectionError: async (...args: any[]) => { const failure = { sectionKey: args[2], error: errorRecord(args[4]), stage: args[6], debug: args[7] }; errors.push(failure); record.failures.push(failure); await writeJson(path.join(directory, 'section-errors.json'), errors) },
      saveAssembledPage: async () => undefined
    }
    const { DetectionService } = runtimeRequire('@/lib/studio/import/web-detection') as typeof import('@/lib/studio/import/web-detection')
    const result = await new DetectionService().detectComponentsFromUrl(snapshot.manifest.url, { ...(fixtures ? { apiKey: 'offline-fixture' } : {}), checkpointSession: { jobId: 'import-lab' } as any, checkpointService: checkpoint as any })
    if (result.detectionHarness !== 'blocks') throw new Error('Production returned a different detection harness')
    await writeJson(path.join(directory, 'components.json'), result.components)
    await writeJson(path.join(directory, 'detection.json'), result)
    record.status = record.failures.length ? 'failed' : 'complete'
  } finally {
    for (const undo of restore.reverse()) undo()
    record.replayReady = record.stylingReplay?.rebuilt === true
    record.callCount = recorder.calls.filter(c => c.status !== 'planned').length
    record.plannedCallCount = recorder.calls.filter(c => c.status === 'planned').length
    record.retryCount = recorder.calls.filter(c => c.retry).length
    record.failedCalls = recorder.calls.filter(c => ['failed', 'timeout', 'http-error'].includes(c.status)).length
    record.decisionRequests = recorder.calls.filter(c => c.kind === 'decision' && c.status !== 'planned').length
  }
}
