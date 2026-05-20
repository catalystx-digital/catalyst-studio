import type { ComponentCatalogSummary } from './types'
import { clearPromptContractBundleCache } from '@/lib/studio/ai/prompt-contract-builder'

let cachedSummary: ComponentCatalogSummary | null = null
let cachedSummaryHash: string | null = null

export function getCachedSummary(): ComponentCatalogSummary | null {
  return cachedSummary
}

export function getCachedSummaryHash(): string | null {
  return cachedSummaryHash
}

export function setCachedSummary(summary: ComponentCatalogSummary, hash: string): void {
  cachedSummary = summary
  cachedSummaryHash = hash
}

export function clearComponentCatalogCache(): void {
  cachedSummary = null
  cachedSummaryHash = null
  clearPromptContractBundleCache()
}
