export interface PropertyMeta {
  type: string
  required: boolean
  description?: string
  // Optional: explicit allowed sub-component types for content[] fields
  allowedTypes?: string[]
}

// Helper to define props meta with type safety on keys
export type PropsMeta<TContent> = Record<Extract<keyof TContent, string>, PropertyMeta>

export function definePropsMeta<TContent>(meta: PropsMeta<TContent>): PropsMeta<TContent> {
  return meta
}

