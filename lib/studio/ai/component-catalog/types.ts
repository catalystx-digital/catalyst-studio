export interface ComponentPropertyInfo {
  name: string
  type: string
  required: boolean
  description?: string
  allowedTypes?: string[]
  source?: 'propsMeta' | 'aiMetadata' | 'schema'
}

export interface ComponentCatalogComponent {
  type: string
  category: string
  summary?: string
  description?: string
  keywords: string[]
  patterns: string[]
  confidence: number
  metadata?: Record<string, any>
  /** LLM extraction/generation directives from component definition */
  directives?: string[]
  properties?: ComponentPropertyInfo[]
}

export interface ComponentCatalogCategory {
  name: string
  components: ComponentCatalogComponent[]
}

export interface SubComponentCatalogEntry {
  type: string
  summary?: string
  description?: string
  metadata?: Record<string, any>
  /** LLM extraction/generation directives from component definition */
  directives?: string[]
  properties?: ComponentPropertyInfo[]
}

export interface ComponentCatalogSummary {
  total: number
  generatedAt: string
  components: ComponentCatalogComponent[]
  categories: ComponentCatalogCategory[]
  topLevelTypes: string[]
  subComponentTypes: string[]
  subComponents: SubComponentCatalogEntry[]
  warnings: any[]
}

export interface ComponentCatalogOptions {
  forceRefresh?: boolean
}

export interface BuildDetectionPromptOptions {
  schemaSummary: any
  contractBundle?: any
  pagePrompt?: string
  pageSummary?: any
  mode?: 'full' | 'section'
}

export interface BuildChatPromptOptions {
  includeGuidelines?: boolean
  maxComponentsPerCategory?: number
  maxPropertiesPerComponent?: number
}
