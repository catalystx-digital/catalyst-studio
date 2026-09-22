import path from 'node:path'
import { AsyncLocalStorage } from 'node:async_hooks'
import { writeJson, errorRecord, type Snapshot } from './storage'

export class CallRecorder {
  calls: any[] = []
  context = new AsyncLocalStorage<any>()
  constructor(readonly directory: string, readonly dryRun: boolean) {}
  async save(call: any) { await writeJson(path.join(this.directory, 'calls', String(call.id).padStart(5, '0') + '.json'), call) }
  async call(kind: string, request: any, invoke: () => Promise<any>, metadata: any = {}, signal?: AbortSignal) {
    const call: any = { id: this.calls.length + 1, kind, request: structuredClone(request), model: request.model, ...metadata, status: this.dryRun ? 'planned' : 'started', rawReply: null, usage: null, cost: null, latencyMs: null, transport: [], totalCharacters: JSON.stringify(request).length }
    this.calls.push(call)
    await this.save(call)
    if (this.dryRun) return null
    const started = performance.now()
    let aborted: (() => void) | undefined
    try {
      const response = await this.context.run(call, () => signal ? Promise.race([
        invoke(), new Promise<never>((_, reject) => {
          aborted = () => reject(signal.reason || new Error('Production call aborted'))
          if (signal.aborted) aborted()
          else signal.addEventListener('abort', aborted, { once: true })
        })
      ]) : invoke())
      call.response = response
      call.rawReply = response.choices?.[0]?.message?.content ?? response
      call.usage = kind === 'decision' && !metadata.fixture ? call.transport.at(-1)?.parsedResponse?.usage ?? null : response.usage ?? null
      call.cost = call.usage?.cost ?? call.usage?.total_cost ?? null
      call.status = 'complete'
      return response
    } catch (error) {
      call.status = signal?.aborted || (error instanceof Error && /timeout/i.test(error.name)) ? 'timeout' : 'failed'
      call.error = errorRecord(error)
      throw error
    } finally {
      if (aborted) signal?.removeEventListener('abort', aborted)
      call.latencyMs = performance.now() - started
      await this.save(call)
    }
  }
}

export function replayTransport(snapshot: Snapshot, recorder: CallRecorder, endpoints: string[]) {
  const original = globalThis.fetch
  globalThis.fetch = async (input, init) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    if (url === 'https://openrouter.ai/api/v1/models') return new Response(JSON.stringify(snapshot.models), { headers: { 'content-type': 'application/json' } })
    const call = recorder.context.getStore()
    if (recorder.dryRun || !call || !endpoints.includes(url)) throw new Error('Replay blocked an unsaved network request')
    const attempt: any = { status: 'started', requestBody: typeof init?.body === 'string' ? init.body : input instanceof Request ? await input.clone().text() : null }
    call.transport.push(attempt)
    await recorder.save(call)
    const started = performance.now()
    try {
      const response = await original(input, init)
      attempt.httpStatus = response.status
      attempt.rawReply = await response.clone().text()
      attempt.status = response.ok ? 'complete' : 'http-error'
      try { attempt.parsedResponse = JSON.parse(attempt.rawReply) } catch { attempt.parseError = 'Transport response is not JSON' }
      return response
    } catch (error) { attempt.status = 'failed'; attempt.error = errorRecord(error); throw error }
    finally { attempt.latencyMs = performance.now() - started; await recorder.save(call) }
  }
  return () => { globalThis.fetch = original }
}

export async function mapLimited<T, R>(items: T[], limit: number, work: (item: T, index: number) => Promise<R>): Promise<Array<PromiseSettledResult<R>>> {
  if (!Number.isSafeInteger(limit) || limit < 1) throw new Error('Concurrency must be a positive integer')
  const results: Array<PromiseSettledResult<R>> = new Array(items.length)
  let next = 0
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next++
      try { results[index] = { status: 'fulfilled', value: await work(items[index], index) } }
      catch (reason) { results[index] = { status: 'rejected', reason } }
    }
  }))
  return results
}
