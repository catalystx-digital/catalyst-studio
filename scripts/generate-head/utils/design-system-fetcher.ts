/**
 * Design System Fetcher
 *
 * Fetches design system tokens from Catalyst Studio GraphQL API.
 * Used by non-UCS providers (like Optimizely) to bake design system at build time.
 */

import type { DesignSystem } from '@/lib/studio/import/types/design-system.types'
import type { DesignSystemSourceOptions, GeneratorDiagnostic } from '../core/types'
import { GraphqlClient } from '../providers/graphql/graphql-client'
import { slugifyConceptName } from '@/lib/studio/design-system/design-concept.repository'
import { logger } from './logger'

interface DesignSystemQueryResult {
  designSystems: Array<{
    id: string
    designConceptId?: string | null
    conceptName?: string | null
    tokens: Record<string, unknown>
    isCurrent: boolean
  }>
}

const DESIGN_SYSTEMS_QUERY = /* GraphQL */ `
  query DesignSystemsForExport($websiteId: ID!) {
    designSystems(websiteId: $websiteId) {
      id
      designConceptId
      conceptName
      tokens
      isCurrent
    }
  }
`

export interface FetchDesignSystemResult {
  designSystem: DesignSystem | null
  conceptId?: string
  conceptName?: string
  diagnostics: GeneratorDiagnostic[]
}

/**
 * Fetches design system from Catalyst Studio GraphQL API.
 */
export async function fetchDesignSystemFromGraphql(
  options: DesignSystemSourceOptions
): Promise<FetchDesignSystemResult> {
  const diagnostics: GeneratorDiagnostic[] = []
  const { websiteId, designConcept, graphql } = options

  if (!graphql.endpoint) {
    diagnostics.push({
      level: 'error',
      code: 'DESIGN_SYSTEM_FETCH_NO_ENDPOINT',
      message: 'GraphQL endpoint is required to fetch design system',
      context: { websiteId }
    })
    return { designSystem: null, diagnostics }
  }

  if (!graphql.apiKey) {
    diagnostics.push({
      level: 'error',
      code: 'DESIGN_SYSTEM_FETCH_NO_API_KEY',
      message: 'GraphQL API key is required to fetch design system',
      context: { websiteId }
    })
    return { designSystem: null, diagnostics }
  }

  const client = new GraphqlClient({
    endpoint: graphql.endpoint,
    maxRetries: graphql.maxRetries ?? 3
  })

  try {
    logger.info('Fetching design system from Catalyst Studio', {
      websiteId,
      designConcept: designConcept ?? '(default)',
      endpoint: graphql.endpoint
    })

    const result = await client.request<DesignSystemQueryResult>({
      query: DESIGN_SYSTEMS_QUERY,
      variables: { websiteId },
      apiKey: graphql.apiKey
    })

    const designSystems = result.designSystems ?? []

    if (designSystems.length === 0) {
      diagnostics.push({
        level: 'warn',
        code: 'DESIGN_SYSTEM_NOT_FOUND',
        message: 'No design systems found for the specified website',
        context: { websiteId }
      })
      return { designSystem: null, diagnostics }
    }

    // Find the design system to use
    let selectedDesignSystem = designSystems.find(ds => ds.isCurrent)

    // If a specific concept was requested, try to match it
    if (designConcept) {
      const normalizedSelector = slugifyConceptName(designConcept)
      const matchedBySelector = designSystems.find(ds => {
        if (ds.designConceptId === designConcept) return true
        if (ds.conceptName === designConcept) return true
        if (ds.conceptName && slugifyConceptName(ds.conceptName) === normalizedSelector) return true
        return false
      })

      if (matchedBySelector) {
        selectedDesignSystem = matchedBySelector
      } else {
        diagnostics.push({
          level: 'warn',
          code: 'DESIGN_CONCEPT_NOT_MATCHED',
          message: `Design concept "${designConcept}" not found, using current design system`,
          context: {
            websiteId,
            requestedConcept: designConcept,
            availableConcepts: designSystems
              .map(ds => ds.conceptName)
              .filter(Boolean)
          }
        })
      }
    }

    if (!selectedDesignSystem) {
      // Fallback to first available
      selectedDesignSystem = designSystems[0]
    }

    if (!selectedDesignSystem?.tokens) {
      diagnostics.push({
        level: 'warn',
        code: 'DESIGN_SYSTEM_NO_TOKENS',
        message: 'Selected design system has no tokens',
        context: { websiteId, designSystemId: selectedDesignSystem?.id }
      })
      return { designSystem: null, diagnostics }
    }

    const tokens = selectedDesignSystem.tokens as DesignSystem

    diagnostics.push({
      level: 'info',
      code: 'DESIGN_SYSTEM_FETCHED',
      message: `Successfully fetched design system "${selectedDesignSystem.conceptName ?? 'default'}"`,
      context: {
        websiteId,
        conceptId: selectedDesignSystem.designConceptId,
        conceptName: selectedDesignSystem.conceptName,
        hasPalette: Boolean(tokens.palette),
        hasTypography: Boolean(tokens.typography)
      }
    })

    return {
      designSystem: tokens,
      conceptId: selectedDesignSystem.designConceptId ?? undefined,
      conceptName: selectedDesignSystem.conceptName ?? undefined,
      diagnostics
    }
  } catch (error) {
    diagnostics.push({
      level: 'error',
      code: 'DESIGN_SYSTEM_FETCH_ERROR',
      message: 'Failed to fetch design system from GraphQL',
      context: {
        websiteId,
        error: error instanceof Error ? error.message : String(error)
      }
    })
    return { designSystem: null, diagnostics }
  }
}
