/**
 * Preview Data API
 *
 * Fetches website data needed for sandbox preview:
 * - Design system tokens (CSS variables in HSL format)
 * - Pages with component content
 *
 * GET /api/studio/preview/data?websiteId=xxx
 *
 * NOTE: This API runs on the server and accesses Prisma.
 * The database connection string is NEVER exposed to the client.
 * Only sanitized design tokens and component configs are returned.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getClient } from '@/lib/db/client'
import { getNormalizedDesignSystem, generateDesignSystemCss } from '@/lib/studio/design-system/design-system-reader'
import type { PreviewDesignTokens, PreviewComponentConfig } from '@/lib/studio/preview/sandbox/types'

interface PreviewDataResponse {
  success: boolean
  data?: {
    websiteId: string
    websiteName: string
    designSystem: PreviewDesignTokens
    /** Pre-generated CSS (variables only, no Tailwind directives - client adds those) */
    designSystemCss: string
    pages: Array<{
      id: string
      title: string
      slug: string
      components: PreviewComponentConfig[]
    }>
  }
  error?: string
}

export async function GET(request: NextRequest): Promise<NextResponse<PreviewDataResponse>> {
  const websiteId = request.nextUrl.searchParams.get('websiteId')
  const designConceptSlug = request.nextUrl.searchParams.get('designConcept')

  if (!websiteId) {
    return NextResponse.json(
      { success: false, error: 'websiteId is required' },
      { status: 400 }
    )
  }

  try {
    const prisma = getClient()

    // Fetch website
    const website = await prisma.website.findUnique({
      where: { id: websiteId },
    })

    if (!website) {
      return NextResponse.json(
        { success: false, error: 'Website not found' },
        { status: 404 }
      )
    }

    // Find design concept if specified
    let designConceptId: string | undefined
    if (designConceptSlug) {
      const concept = await prisma.websiteDesignConcept.findFirst({
        where: {
          websiteId,
          OR: [
            { slug: designConceptSlug },
            { id: designConceptSlug },
            { name: designConceptSlug },
          ],
        },
      })
      if (concept) {
        designConceptId = concept.id
      }
    }

    // Fetch design system - optionally filter by design concept
    const designSystemRecord = await prisma.websiteDesignSystem.findFirst({
      where: {
        websiteId,
        ...(designConceptId && { designConceptId }),
      },
      orderBy: { createdAt: 'desc' },
    })

    // Extract design system tokens using existing reader (same as generate-head)
    const dsTokens = designSystemRecord?.tokens
    const normalized = getNormalizedDesignSystem(dsTokens)

    const designSystem: PreviewDesignTokens = {
      variables: normalized.variables,
      darkVariables: normalized.darkVariables,
    }

    // Generate CSS using existing transformer (same output as generate-head)
    const designSystemCss = generateDesignSystemCss(dsTokens)

    // Fetch pages with structure
    const pages = await prisma.websitePage.findMany({
      where: { websiteId },
      orderBy: { createdAt: 'asc' },
    })

    const structures = await prisma.websiteStructure.findMany({
      where: { websiteId },
      orderBy: [{ parentId: 'asc' }, { position: 'asc' }],
    })

    // Map structures to pages
    const structureMap = new Map(
      structures.map((s) => [s.websitePageId, s])
    )

    // Convert pages to preview format
    const previewPages = pages.map((page) => {
      const structure = structureMap.get(page.id)
      const components = extractComponents(page.content)

      return {
        id: page.id,
        title: page.title,
        slug: structure?.slug || page.id,
        components,
      }
    })

    return NextResponse.json({
      success: true,
      data: {
        websiteId,
        websiteName: website.name,
        designSystem,
        designSystemCss,
        pages: previewPages,
      },
    })
  } catch (error) {
    console.error('[preview-data] Error:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 }
    )
  }
}

/**
 * Extract component configs from page content JSON
 */
function extractComponents(content: unknown): PreviewComponentConfig[] {
  if (!content || typeof content !== 'object') {
    return []
  }

  const components: PreviewComponentConfig[] = []
  const contentObj = content as Record<string, unknown>

  // Handle different content structures
  // 1. Array of components directly
  if (Array.isArray(contentObj)) {
    for (const item of contentObj) {
      if (isComponentConfig(item)) {
        const type = getType(item)
        components.push({
          type,
          props: (item.props || item.data || {}) as Record<string, unknown>,
        })
      }
    }
    return components
  }

  // 2. Object with 'components' array
  if (Array.isArray(contentObj.components)) {
    for (const item of contentObj.components) {
      if (isComponentConfig(item)) {
        const type = getType(item)
        components.push({
          type,
          props: (item.props || item.data || {}) as Record<string, unknown>,
        })
      }
    }
    return components
  }

  // 3. Object with 'sections' array (alternative structure)
  if (Array.isArray(contentObj.sections)) {
    for (const section of contentObj.sections) {
      if (isComponentConfig(section)) {
        const type = getType(section)
        components.push({
          type,
          props: (section.props || section.data || {}) as Record<string, unknown>,
        })
      }
    }
    return components
  }

  // 4. Single component object with type
  if (isComponentConfig(contentObj)) {
    const type = getType(contentObj)
    components.push({
      type,
      props: (contentObj.props || contentObj.data || {}) as Record<string, unknown>,
    })
  }

  return components
}

function isComponentConfig(obj: unknown): obj is Record<string, unknown> {
  if (!obj || typeof obj !== 'object') return false
  const record = obj as Record<string, unknown>
  return typeof record.type === 'string' || typeof record.componentType === 'string'
}

function getType(obj: Record<string, unknown>): string {
  if (typeof obj.type === 'string') return obj.type
  if (typeof obj.componentType === 'string') return obj.componentType
  return 'unknown'
}
