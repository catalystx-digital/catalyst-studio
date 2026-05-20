/**
 * Template-based Word document generator using docx-templates.
 * Allows agencies to upload custom Word templates with variable placeholders.
 */
import createReport from 'docx-templates'
import { 
  ProposalContextSummary, 
  ProposalNarrative,
  ProposalTemplate, 
  ProposalTemplateVariables 
} from './types'

/**
 * Parses a ProposalTemplate from unknown JSON data.
 * Returns null if the data is invalid or missing required fields.
 */
export function parseProposalTemplate(raw: unknown): ProposalTemplate | null {
  if (!raw || typeof raw !== 'object') {
    return null
  }
  const data = raw as Record<string, unknown>
  
  // Validate required fields
  if (
    typeof data.fileName !== 'string' ||
    typeof data.mimeType !== 'string' ||
    typeof data.content !== 'string' ||
    typeof data.uploadedAt !== 'string'
  ) {
    return null
  }

  return {
    fileName: data.fileName,
    mimeType: data.mimeType,
    content: data.content,
    uploadedAt: data.uploadedAt,
    description: typeof data.description === 'string' ? data.description : null
  }
}

/**
 * Builds template variables from proposal data.
 * These variables are substituted in the custom Word template.
 */
export function buildTemplateVariables(
  websiteName: string,
  proposalTitle: string,
  narrative: ProposalNarrative,
  context: ProposalContextSummary,
  capturedAt: string
): ProposalTemplateVariables {
  const capturedDate = new Date(capturedAt)
  const dateLabel = Number.isNaN(capturedDate.getTime())
    ? new Date().toLocaleDateString()
    : capturedDate.toLocaleDateString()
  
  const branding = context.agencyBranding
  const tagline = context.website.tagline ||
    narrative.project_summary.split('.').at(0) ||
    ''
  
  // Format uplift plan as numbered list
  const upliftPlanFormatted = narrative.uplift_plan
    .slice(0, 8)
    .map((step, i) => (i + 1).toString() + '. ' + step)
    .join('\n')

  return {
    website_name: websiteName,
    proposal_title: proposalTitle || websiteName + ' Proposal',
    executive_summary: narrative.project_summary,
    tagline,
    date: dateLabel,
    agency_name: branding?.agencyName || 'Catalyst Studio',
    page_count: context.sitemap.stats.total,
    content_types_count: context.contentTypes.length,
    seo_score: context.seoAnalysis?.score ?? 'N/A',
    uplift_plan: upliftPlanFormatted,
    call_to_action: narrative.call_to_action
  }
}

/**
 * Generates a proposal document using a custom Word template.
 * Uses docx-templates for variable substitution.
 */
export async function generateFromTemplate(
  template: ProposalTemplate,
  websiteName: string,
  proposalTitle: string,
  narrative: ProposalNarrative,
  context: ProposalContextSummary,
  capturedAt: string
): Promise<Blob> {
  // Decode base64 template content
  const templateBuffer = Buffer.from(template.content, 'base64')
  
  // Build template variables
  const variables = buildTemplateVariables(
    websiteName,
    proposalTitle,
    narrative,
    context,
    capturedAt
  )
  
  // Process template with docx-templates
  const resultBuffer = await createReport({
    template: templateBuffer,
    data: variables,
    cmdDelimiter: ['{{', '}}']
  })
  
  // Convert to Blob
  return new Blob([Buffer.from(resultBuffer)], {
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  })
}
