/** Optional block-only catalogue used by the offline comparison harness. */
export interface BlockCatalogueOverride {
  types: Record<string, string>
  contract: string
  omitRules: string[]
  validateContent: (type: string, content: Record<string, unknown>) => Record<string, unknown>
  location: (type: string, content: Record<string, unknown>) => 'header' | 'hero' | 'main' | 'footer'
  /** Production type used by override-only required-role checks and template assembly. */
  templateEquivalent: (family: string) => string
}
