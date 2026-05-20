/**
 * Design System Types for Import Pipeline
 *
 * Defines the canonical token schema for captured design systems
 * @module design-system.types
 */

export interface TokenColor {
  value: string
  name?: string
  confidence: number
  source: 'css-var' | 'literal' | 'llm' | 'shuffle'
  usageCount?: number
  hex?: string
  rgba?: string
  hsl?: string
  generatorSeed?: string
}

export interface TokenTypography {
  fontFamily: string
  fontSize?: string
  fontWeight?: number | string
  lineHeight?: string
  letterSpacing?: string
  name?: string
  confidence: number
  source: 'css' | 'inline' | 'llm' | 'fallback' | 'normalized'
  usageCount?: number
  fallbacks?: string[]
}

export interface TokenScale {
  name: string
  values: TokenScaleValue[]
  unit: string
  base?: number
  confidence: number
  source: 'css' | 'inferred' | 'llm'
}

export interface TokenScaleValue {
  step: number
  value: number
  name?: string
}

export interface TokenShadow {
  name?: string
  value: string
  confidence: number
  source: 'css' | 'inferred' | 'llm'
  usageCount?: number
}

export interface TokenEffect {
  name?: string
  type: 'animation' | 'transition' | 'filter' | 'backdrop'
  value: string
  confidence: number
  source: 'css' | 'inferred' | 'llm'
}

export interface DiagnosticEntry {
  type: 'warning' | 'error' | 'info'
  code: string
  message: string
  source: string
  severity: 'low' | 'medium' | 'high'
  tokenRef?: string
}

export interface EvidenceReference {
  key: string
  url?: string | null
  checksum?: string
}

export interface DomProbeMetadata {
  runId: string
  baseline: string
  targetUrl: string
  captureDurationMs: number
  storageBaseKey?: string
  evaluation?: {
    overall: boolean | null
    paletteAgreement?: number | null
    typographyMatched?: number | null
    spacingPassed?: boolean | null
  }
  evidence?: {
    captureJson?: EvidenceReference
    manifestJson?: EvidenceReference
    manifestMarkdown?: EvidenceReference
    runLog?: EvidenceReference
    domSnapshot?: EvidenceReference
    diffReports?: EvidenceReference[]
    screenshots?: EvidenceReference[]
  }
}

export interface DesignSystemAliases {
  cssVariables: Record<string, string>
  computedAt: string
  diagnostics?: DiagnosticEntry[]
  fallbackSummary?: Record<string, number>
}

export interface DesignSystem {
  palette: {
    primary: TokenColor[]
    secondary: TokenColor[]
    accent: TokenColor[]
    neutral: TokenColor[]
    surface: TokenColor[]
  }
  typography: {
    heading: TokenTypography[]
    body: TokenTypography[]
    ui: TokenTypography[]
  }
  spacing: TokenScale
  radii: TokenScale
  shadows: TokenShadow[]
  effects: TokenEffect[]
  metadata: {
    sourceUrls: string[]
    capturedAt: string
    confidence: number
    extractionMethod: 'deterministic' | 'llm-assisted' | 'hybrid'
    version: string
    domProbe?: DomProbeMetadata
    generatorSeed?: string
  }
  diagnostics: DiagnosticEntry[]
  version: string
  aliases?: DesignSystemAliases
}

export interface CapturedDesignSystem {
  designSystem: DesignSystem
  rawData: {
    cssVariables?: Record<string, string>
    stylesheets?: string[]
    literals?: {
      colors: Array<{ value: string; usage: number }>
      fonts: Array<{ value: string; usage: number }>
    }
    inlineStyles?: Record<string, any>
  }
  processingStats: {
    totalStylesheets: number
    totalInlineStyles: number
    extractionTime: number
    llmCalls: number
    cacheHits: number
  }
}

// API Response types
export interface WebsiteDesignSystemResponse {
  id: string
  websiteId: string
  version: string
  tokens: DesignSystem
  sourceJobId?: string
  createdAt: string
  updatedAt: string
}
