const TRACE_ENV_FLAG = 'IMPORT_MEMORY_TRACE'

interface MemorySnapshot {
  rssMB: number
  heapUsedMB: number
  heapTotalMB: number
  externalMB: number
  arrayBuffersMB: number
}

let lastHeapUsedMB: number | null = null

function formatSnapshot(snapshot: MemorySnapshot, deltaMB: number | null, details?: Record<string, unknown>): Record<string, unknown> {
  return {
    rssMB: snapshot.rssMB,
    heapUsedMB: snapshot.heapUsedMB,
    heapTotalMB: snapshot.heapTotalMB,
    externalMB: snapshot.externalMB,
    arrayBuffersMB: snapshot.arrayBuffersMB,
    ...(deltaMB !== null ? { deltaHeapMB: deltaMB } : {}),
    ...(details ? details : {})
  }
}

export function traceMemory(label: string, details?: Record<string, unknown>): MemorySnapshot | undefined {
  if (typeof process === 'undefined' || typeof process.memoryUsage !== 'function') {
    return undefined
  }

  const usage = process.memoryUsage()
  const snapshot: MemorySnapshot = {
    rssMB: Math.round(usage.rss / 1024 / 1024),
    heapUsedMB: Math.round(usage.heapUsed / 1024 / 1024),
    heapTotalMB: Math.round(usage.heapTotal / 1024 / 1024),
    externalMB: Math.round(usage.external / 1024 / 1024),
    arrayBuffersMB: Math.round((usage as any).arrayBuffers ? (usage as any).arrayBuffers / 1024 / 1024 : 0)
  }

  const shouldTrace = process.env[TRACE_ENV_FLAG] === '1'
  const delta = lastHeapUsedMB !== null ? snapshot.heapUsedMB - lastHeapUsedMB : null
  lastHeapUsedMB = snapshot.heapUsedMB

  if (shouldTrace) {
    const payload = formatSnapshot(snapshot, delta, details)
    console.log('[ImportMemory] ' + label, payload)
  }

  return snapshot
}

export function resetMemoryTrace(): void {
  lastHeapUsedMB = null
}

export type { MemorySnapshot }
