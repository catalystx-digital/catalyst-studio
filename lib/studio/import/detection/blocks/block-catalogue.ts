/** Optional block-only catalogue used by the offline comparison harness. */
export interface BlockCatalogueOverride {
  types: Record<string, string>
  contract: string
  omitRules: string[]
  validateContent: (type: string, content: Record<string, unknown>) => Record<string, unknown>
  location: (type: string, content: Record<string, unknown>) => 'header' | 'main' | 'sidebar' | 'footer'
  /** First production type in set C; used only for page-template compatibility. */
  templateEquivalent: (family: string) => string
}
