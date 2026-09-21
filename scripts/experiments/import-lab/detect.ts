import fs from 'node:fs/promises'
import path from 'node:path'
import { argumentsForRun, loadSnapshot, runDirectory, writeJson, main, errorRecord, digest } from './storage'
import { createReplayTools } from './replay'
import { runtimeRequire, replaceExports, captureConsole, blockNetwork } from './runtime'

const DRY_STOP = 'IMPORT_LAB_PROMPT_CAPTURE_COMPLETE'
async function detect() {
  const args = argumentsForRun(), directory = runDirectory(args.page, args.run)
  await fs.mkdir(path.dirname(directory), { recursive: true })
  await fs.mkdir(directory) // Never overwrite a run, including failed runs.
  const parserEvents: unknown[] = [], salvageEvents: unknown[] = []
  const events: unknown[] = [], calls: any[] = [], transport: any[] = [], sectionResults: any[] = [], sectionErrors: any[] = []
  const restoreConsole = captureConsole(events)
  const restore: Array<() => void> = []
  let status = 'failed', failure: unknown, result: any, replay: ReturnType<typeof createReplayTools> | undefined
  let identity: Record<string, unknown> = {}
  try {
    const snapshot = await loadSnapshot(args.page)
    identity = { snapshotSha256: snapshot.manifest.sha256, snapshotInputsSha256: digest(JSON.stringify(snapshot)), pageUrl: snapshot.manifest.url }
    // Read configuration only after the caller has supplied its process environment.
    const { ModelConfig, DetectionConfig, OpenRouterConfig, ConfidenceConfig, TokenConfig, TimeoutConfig } = await import('@/lib/studio/import/config')
    if (DetectionConfig.detectionHarness !== 'section') throw new Error('Phase 1 requires IMPORT_DETECTION_HARNESS=section; page-map prompts depend on model replies')
    const decisions = await import('@/lib/studio/decisions')
    if (decisions.getDecisionConfig().enabled) throw new Error('Phase 1 does not support DECISION_MODEL_ENABLED=true; extra decision calls require separate capture')
    if (!snapshot.models.data.length) throw new Error('Saved model catalogue is empty')
    identity.configurationSha256 = digest(JSON.stringify({ ModelConfig, DetectionConfig, ConfidenceConfig, TokenConfig, TimeoutConfig, baseUrl: OpenRouterConfig.baseUrl }))
    identity.model = ModelConfig.primary
    const nativeFetch = globalThis.fetch
    if (args.dryRun) restore.push(blockNetwork())
    globalThis.fetch = async (input, init) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
      if (url === 'https://openrouter.ai/api/v1/models') return new Response(JSON.stringify(snapshot.models), {headers: {'content-type': 'application/json'}})
      const expected = OpenRouterConfig.baseUrl.replace(/\/$/, '') + '/chat/completions'
      if (!args.dryRun && url === expected && (init?.method || (input instanceof Request ? input.method : 'GET')).toUpperCase() === 'POST') {
        const attempt: any = { id:transport.length+1, status:'started' }
        transport.push(attempt)
        const requestBody = typeof init?.body === 'string' ? init.body : input instanceof Request ? await input.clone().text() : null
        attempt.requestBody = requestBody
        await writeJson(path.join(directory,'transport.json'),transport)
        const start = performance.now()
        try {
          const response = await nativeFetch(input, init)
          attempt.httpStatus = response.status
          attempt.rawResponse = await response.clone().text()
          attempt.status = response.ok ? 'complete' : 'http-error'
          return response
        } catch(error) { attempt.status='failed'; attempt.error=errorRecord(error); throw error }
        finally { attempt.latencyMs=performance.now()-start; await writeJson(path.join(directory,'transport.json'),transport) }
      }
      throw new Error('Replay blocked an unsaved network request')
    }
    restore.push(() => { globalThis.fetch = nativeFetch })
    const { getWebFetchTools } = await import('@/lib/studio/import/services/web-tools')
    const tools = getWebFetchTools()
    replay = createReplayTools(snapshot, args.maxSections, tools)
    for (const key of ['fetchOutline', 'getSection', 'release', 'getLastFetchOutline'] as const) {
      const original = tools[key]
      Object.assign(tools, { [key]: replay[key] })
      restore.push(() => Object.assign(tools, { [key]: original }))
    }
    const clients = runtimeRequire('@/lib/studio/import/services/llm-client') as typeof import('@/lib/studio/import/services/llm-client')
    restore.push(replaceExports('@/lib/studio/import/services/llm-client', {
      createLLMClient(options: Parameters<typeof clients.createLLMClient>[0]) {
        const client = args.dryRun ? null : clients.createLLMClient(options)
        return { chat: { completions: { async create(payload: any) {
          const id = calls.length + 1
          const messages = JSON.parse(JSON.stringify(payload.messages))
          const source = messages.find((m: any) => m.role === 'user' && typeof m.content === 'string' && m.content.startsWith('Extract this single section:\n'))
          const sectionKey = source ? JSON.parse(source.content.slice(source.content.indexOf('\n') + 1)).sectionKey : null
          const call: any = { id, sectionKey, kind: messages.length > 3 ? 'repair' : 'extract', model: payload.model, payload: JSON.parse(JSON.stringify(payload)), characters: messages.map((m: any) => ({ role: m.role, count: typeof m.content === 'string' ? m.content.length : JSON.stringify(m.content).length })), status: args.dryRun ? 'planned' : 'started' }
          call.totalCharacters = call.characters.reduce((n: number, m: any) => n + m.count, 0)
          calls.push(call)
          await writeJson(path.join(directory, 'calls', String(id) + '.json'), call)
          if (args.dryRun) throw new Error(DRY_STOP)
          const start = performance.now()
          try {
            const response = await client!.chat.completions.create(payload)
            call.response = response; call.rawReply = (response as any).choices?.[0]?.message?.content ?? null
            call.usage = (response as any).usage ?? null
            call.returnedModel = (response as any).model ?? null
            call.cost = call.usage?.cost ?? call.usage?.total_cost ?? null
            call.status = 'complete'
            return response
          } catch (error) { call.status = 'failed'; call.error = errorRecord(error); throw error }
          finally { call.latencyMs = performance.now() - start; await writeJson(path.join(directory, 'calls', String(id) + '.json'), call) }
        } } } }
      }
    }))
    const parser = runtimeRequire('@/lib/studio/import/detection/response-parser') as typeof import('@/lib/studio/import/detection/response-parser')
    restore.push(replaceExports('@/lib/studio/import/detection/response-parser', {
      parseSectionDetectionResponse(options: Parameters<typeof parser.parseSectionDetectionResponse>[0]) {
        try {
          const parsed = parser.parseSectionDetectionResponse(options)
          parserEvents.push({sectionKey:options.sectionKey,status:'complete',components:JSON.parse(JSON.stringify(parsed.components)),parserRepairs:parsed.parserRepairs || [],invalidComponents:parsed.invalidComponents || []})
          return parsed
        } catch(error) { parserEvents.push({sectionKey:options.sectionKey,status:'failed',error:errorRecord(error)});throw error }
      }
    }))
    const parsing = runtimeRequire('@/lib/studio/import/utils/json-parsing') as typeof import('@/lib/studio/import/utils/json-parsing')
    restore.push(replaceExports('@/lib/studio/import/utils/json-parsing', {
      salvageTruncatedJson(...values: Parameters<typeof parsing.salvageTruncatedJson>) {
        try { const salvaged = parsing.salvageTruncatedJson(...values); salvageEvents.push({rawCharacters:values[0].length,result:salvaged}); return salvaged }
        catch(error) {salvageEvents.push({status:'failed',error:errorRecord(error)});throw error}
      }
    }))
    const { DetectionService } = runtimeRequire('@/lib/studio/import/web-detection') as typeof import('@/lib/studio/import/web-detection')
    // A fresh, empty checkpoint records diagnostics without introducing cache reuse.
    const checkpoint = {
      loadSectionResult: async () => null, loadSectionError: async () => null, loadSitemap: async () => null,
      savePagePlan: async (...values: unknown[]) => { await writeJson(path.join(directory, 'section-plan.json'), values[2]) },
      saveSectionResult: async (...values: any[]) => { sectionResults.push({ sectionKey: values[2], sectionOrder: values[3], components: values[4], durationMs: values[5], pageMetadata: values[6], debug: values[7] }); await writeJson(path.join(directory, 'sections.json'), sectionResults) },
      saveSectionError: async (...values: any[]) => { sectionErrors.push({ sectionKey: values[2], sectionOrder: values[3], error: errorRecord(values[4]), attemptCount: values[5], stage: values[6], debug: values[7] }); await writeJson(path.join(directory, 'section-errors.json'), sectionErrors) },
      saveAssembledPage: async () => undefined
    }
    try {
      result = await new DetectionService().detectComponentsFromUrl(snapshot.manifest.url, {
        ...(args.dryRun ? { apiKey: 'offline-dry-run' } : {}),
        checkpointSession: { jobId: 'import-lab' } as any, checkpointService: checkpoint as any,
        onProgress: event => events.push({ progress: event })
      })
      status = args.dryRun ? 'dry-run' : 'complete'
    } catch (error) {
      const expected = replay.omitted.length + calls.length === snapshot.manifest.sectionKeys.length
      if (args.dryRun && expected && calls.length > 0 && calls.every(call => call.status === 'planned') && sectionErrors.every(section => section.error.message === DRY_STOP)) status = 'dry-run'
      else throw error
    }
    const sourceFiles = Object.keys(runtimeRequire.cache).filter(file => /[/\\]lib[/\\]studio[/\\]/.test(file) && /\.[cm]?[jt]sx?$/.test(file)).sort()
    const sourceHashes = await Promise.all(sourceFiles.map(async file => [path.relative(process.cwd(), file).replace(/\\/g, '/'), digest(await fs.readFile(file, 'utf8'))]))
    identity.codeSha256 = digest(JSON.stringify(sourceHashes))
    const initialCalls = calls.filter(call => call.kind === 'extract').map(call => ({ sectionKey: call.sectionKey, payload: call.payload })).sort((a,b) => String(a.sectionKey).localeCompare(String(b.sectionKey)))
    identity.comparisonKey = digest(JSON.stringify({ ...identity, initialCalls, maxSections: args.maxSections ?? null }))
    if (result && !args.dryRun) { await writeJson(path.join(directory, 'pre-repair.json'), result.components); await writeJson(path.join(directory, 'detection.json'), result) }
  } catch (error) { failure = errorRecord(error); process.exitCode = 1 }
  finally {
    if (replay) replay.release(replay.getLastFetchOutline().handle)
    for (const undo of restore.reverse()) undo()
    restoreConsole()
    await writeJson(path.join(directory, 'events.json'), events)
    await writeJson(path.join(directory, 'parser-events.json'), parserEvents)
    await writeJson(path.join(directory, 'salvage-events.json'), salvageEvents)
    await writeJson(path.join(directory, 'run.json'), { version: 1, page: args.page, run: args.run, status, ...identity, dryRun: args.dryRun, maxSections: args.maxSections ?? null, sectionsOmittedByLimit: replay?.omitted || [], stylingReplay: replay?.styling, callCount: calls.length, promptCharacters: calls.reduce((n, c) => n+c.totalCharacters, 0), sectionErrors, failure })
    if (failure) console.error(failure)
    else console.log(status + ': ' + calls.length + (args.dryRun ? ' initial calls; ' : ' total calls; ') + calls.reduce((n,c) => n+c.totalCharacters,0) + ' prompt characters. Conditional validation repair calls cannot be predicted in a dry run.')
  }
}
if (require.main === module) main(detect)
