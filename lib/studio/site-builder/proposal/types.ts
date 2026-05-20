/**
 * SEO issue found during analysis.
 */
export interface ProposalSEOIssue {
  severity: 'critical' | 'warning' | 'info'
  category: string
  message: string
  affectedPages?: number
}

/**
 * SEO analysis results for the proposal.
 */
export interface ProposalSEOAnalysis {
  score: number
  issues: ProposalSEOIssue[]
  stats: {
    totalPages: number
    pagesWithMeta: number
    pagesWithoutMeta: number
    pagesWithImages: number
    imagesWithAlt: number
    imagesWithoutAlt: number
    internalLinks: number
    externalLinks: number
  }
}

/**
 * Original website screenshot captured during import.
 */
export interface ProposalOriginalScreenshot {
  url: string
  pageUrl: string
  key?: string
}

/**
 * Agency branding configuration for white-label proposals.
 */
export interface AgencyBranding {
  logoUrl?: string | null
  agencyName?: string | null
  primaryColor?: string | null
  contactEmail?: string | null
  websiteUrl?: string | null
  phone?: string | null
}

/**
 * Custom Word template for proposal exports.
 */
export interface ProposalTemplate {
  fileName: string
  mimeType: string
  content: string // base64 encoded
  uploadedAt: string
  description?: string | null
}

/**
 * Template variables for substitution in Word templates.
 */
export interface ProposalTemplateVariables {
  website_name: string
  proposal_title: string
  executive_summary: string
  tagline: string
  date: string
  agency_name: string
  page_count: number
  content_types_count: number
  seo_score: number | string
  uplift_plan: string
  call_to_action: string
}

export interface ProposalIANodeSummary {
  id: string
  label: string
  depth: number
  status?: string
}

export interface ProposalContentTypeSummary {
  id: string
  name: string
  category: string
  instanceCount: number
  missingSchemaFields?: number
  notes?: string | null
}

export interface ProposalImportBrief {
  url?: string | null
  websiteType?: string | null
  summary?: string | null
  tagline?: string | null
  detectionHighlights: string[]
}

export interface ProposalDesignConceptPreview {
  id: string
  name: string
  isDefault?: boolean
  generatorSeed?: string | null
  palette: {
    primary: string
    secondary: string
    accent: string
    neutral: string
    surface: string
  }
  typography: {
    heading: string
    body: string
  }
  positioningNote?: string | null
  paletteAngleNote?: string | null
}

/**
 * Design palette for comparison.
 */
export interface ProposalDesignPalette {
  primary: string
  secondary: string
  accent: string
  neutral: string
  surface: string
}

/**
 * Typography for comparison.
 */
export interface ProposalDesignTypography {
  heading: string
  body: string
}

/**
 * Side-by-side design comparison showing original vs proposed design.
 */
export interface ProposalDesignComparison {
  originalPalette: ProposalDesignPalette
  proposedPalette: ProposalDesignPalette
  originalTypography: ProposalDesignTypography
  proposedTypography: ProposalDesignTypography
  hasOriginalDesign: boolean
}

export interface ProposalContextSummary {
  website: {
    id: string
    name: string
    conceptId: string | null
    proposalTitle?: string | null
    tagline?: string | null
  }
  sitemap: {
    nodes: ProposalIANodeSummary[]
    stats: {
      total: number
      published: number
      draft: number
      depthMax: number
    }
  }
  contentTypes: ProposalContentTypeSummary[]
  importBrief?: ProposalImportBrief | null
  designConcepts: ProposalDesignConceptPreview[]
  designComparison?: ProposalDesignComparison | null
  seoAnalysis?: ProposalSEOAnalysis | null
  originalScreenshots?: ProposalOriginalScreenshot[]
  agencyBranding?: AgencyBranding | null
}

export interface ProposalNarrativeIAHighlight {
  section: string
  insight: string
}

export interface ProposalNarrativeContentTypeNote {
  typeName: string
  summary: string
  opportunities?: string[]
}

export interface ProposalNarrativeDesignConceptEntry {
  conceptId: string
  positioning: string
  paletteAngle: string
  bestUseCases?: string[]
}

export interface ProposalNarrative {
  project_summary: string
  ia_highlights: ProposalNarrativeIAHighlight[]
  content_type_notes: ProposalNarrativeContentTypeNote[]
  uplift_plan: string[]
  design_concepts: ProposalNarrativeDesignConceptEntry[]
  call_to_action: string
  design_evolution_narrative?: string
  seo_recommendations?: string
}

export interface ProposalApiResponse {
  narrative: ProposalNarrative
  context: ProposalContextSummary
  assets: {
    designConcepts: ProposalDesignConceptPreview[]
  }
}
