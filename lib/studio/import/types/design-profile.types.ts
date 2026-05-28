export type DesignProfileConfidence = 'high' | 'medium' | 'low' | 'missing'

export interface DesignProfileEvidence {
  source: string
  value?: string
  confidence: DesignProfileConfidence
  selector?: string
}

export interface ImportDesignProfile {
  sourceUrl: string
  capturedAt: string
  confidence: number
  palette: {
    primary?: DesignProfileEvidence
    secondary?: DesignProfileEvidence
    background?: DesignProfileEvidence
    foreground?: DesignProfileEvidence
  }
  typography: {
    heading?: DesignProfileEvidence
    body?: DesignProfileEvidence
  }
  spacing: {
    baseUnitPx?: number | null
    density: 'compact' | 'comfortable' | 'spacious' | 'unknown'
  }
  brandAssets: {
    logo?: DesignProfileEvidence
    favicon?: DesignProfileEvidence
  }
  imagery: {
    detectedCount: number
    evidence: DesignProfileEvidence[]
  }
  diagnostics: DesignProfileDiagnostic[]
}

export interface DesignProfileDiagnostic {
  code:
    | 'DESIGN_PROFILE_MISSING_PROBE'
    | 'DESIGN_PROFILE_LOW_CONFIDENCE'
    | 'DESIGN_PROFILE_MISSING_PRIMARY'
    | 'DESIGN_PROFILE_MISSING_LOGO'
    | 'DESIGN_PROFILE_MISSING_IMAGERY'
  severity: 'info' | 'warning' | 'error'
  message: string
}

export interface PresentationSkeletonSelection {
  key: 'agency-home' | 'institutional-home' | 'service-business-home' | 'unknown'
  confidence: number
  reason: string
  diagnostics: DesignProfileDiagnostic[]
}

export interface DesignFitMutation {
  component: string
  field: string
  value: unknown
  evidence: string
  confidence: DesignProfileConfidence
}

export interface DesignFitDiagnostic extends DesignProfileDiagnostic {
  component?: string
  field?: string
}

export interface DesignFitComponentAudit {
  component: string
  mutations: DesignFitMutation[]
}

export interface DesignFitPageAudit {
  skeleton?: PresentationSkeletonSelection | null
  profileConfidence?: number
  diagnostics: DesignFitDiagnostic[]
  components: DesignFitComponentAudit[]
}
