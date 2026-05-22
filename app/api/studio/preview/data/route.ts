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
import { assertStudioWebsiteAccess, previewAccessErrorResponse } from '@/lib/studio/preview/access'
import { getNormalizedDesignSystem, generateDesignSystemCss } from '@/lib/studio/design-system/design-system-reader'
import type { PreviewDesignTokens, PreviewComponentConfig } from '@/lib/studio/preview/sandbox/types'
import { normalizePageContent, type PageContentDiagnostic } from '@/lib/studio/page-content'

export interface PreviewPageContentDiagnostic extends PageContentDiagnostic {
  pageId?: string
  pageTitle?: string
  slug?: string
  fullPath?: string
}

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
      fullPath: string
      components: PreviewComponentConfig[]
    }>
  }
  error?: string
  diagnostics?: PreviewPageContentDiagnostic[]
}

interface ExtractComponentsContext {
  pageId?: string
  pageTitle?: string
  slug?: string
  fullPath?: string
}

interface ExtractComponentsResult {
  components: PreviewComponentConfig[]
  diagnostics: PreviewPageContentDiagnostic[]
}

function hasBlockingDiagnostics(diagnostics: PreviewPageContentDiagnostic[]): boolean {
  return diagnostics.some(diagnostic => diagnostic.severity === 'warn' || diagnostic.severity === 'error')
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
    await assertStudioWebsiteAccess(request, websiteId)

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

    // Map structures to pages and reconstruct nested preview paths.
    const structureMap = new Map(structures.map((s) => [s.websitePageId, s]))
    const structureById = new Map(structures.map((s) => [s.id, s]))

    const fullPathByStructureId = new Map<string, string>()
    const buildFullPath = (structureId: string | null | undefined): string => {
      if (!structureId) {
        return '/'
      }

      const cached = fullPathByStructureId.get(structureId)
      if (cached) {
        return cached
      }

      const structure = structureById.get(structureId)
      if (!structure) {
        return '/'
      }

      const parentPath = buildFullPath(structure.parentId)
      const slug = structure.slug?.replace(/^\/+|\/+$/g, '') ?? ''
      const fullPath = slug
        ? `${parentPath === '/' ? '' : parentPath}/${slug}`
        : '/'

      fullPathByStructureId.set(structureId, fullPath)
      return fullPath
    }

    // Convert pages to preview format
    const allDiagnostics: PreviewPageContentDiagnostic[] = []
    const previewPages = pages.map((page) => {
      const structure = structureMap.get(page.id)
      const slug = structure?.slug || page.id
      const fullPath = buildFullPath(structure?.id)
      const { components, diagnostics } = extractComponentsWithDiagnostics(page.content, {
        pageId: page.id,
        pageTitle: page.title,
        slug,
        fullPath,
      })
      allDiagnostics.push(...diagnostics)

      return {
        id: page.id,
        title: page.title,
        slug,
        fullPath,
        components,
      }
    })

    if (hasBlockingDiagnostics(allDiagnostics)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Preview data contains invalid page content',
          diagnostics: allDiagnostics,
        },
        { status: 422 }
      )
    }

    return NextResponse.json({
      success: true,
      data: {
        websiteId,
        websiteName: website.name,
        designSystem,
        designSystemCss,
        pages: previewPages,
      },
      ...(allDiagnostics.length > 0 ? { diagnostics: allDiagnostics } : {}),
    })
  } catch (error) {
    if (error && typeof error === 'object' && 'statusCode' in error) {
      return previewAccessErrorResponse(error) as NextResponse<PreviewDataResponse>
    }

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
export function extractComponents(content: unknown): PreviewComponentConfig[] {
  return extractComponentsWithDiagnostics(content).components
}

export function extractComponentsWithDiagnostics(
  content: unknown,
  context: ExtractComponentsContext = {}
): ExtractComponentsResult {
  const normalizedContent = normalizePageContent(content)
  const pageContent = normalizedContent.pageContent
  const diagnostics = normalizedContent.diagnostics
  const previewDiagnostics = diagnostics.map((diagnostic): PreviewPageContentDiagnostic => ({
    ...diagnostic,
    ...context,
  }))

  if (previewDiagnostics.length > 0 && process.env.NODE_ENV !== 'production') {
    console.info('[preview-data] Adapted page content for sandbox preview', {
      pageId: context.pageId,
      fullPath: context.fullPath,
      diagnostics: previewDiagnostics.map(diagnostic => ({
        code: diagnostic.code,
        severity: diagnostic.severity,
        message: diagnostic.message,
        componentId: diagnostic.componentId,
        path: diagnostic.path,
      })),
    })
  }

  const components = pageContent.components.map((component): PreviewComponentConfig => {
    const props = { ...component.props }
    if (Object.keys(component.content).length > 0) {
      props.content = component.content
    }

    return {
      id: component.id,
      type: component.type,
      parentId: component.parentId,
      position: component.position,
      props,
      content: component.content as Record<string, unknown>,
      styles: component.styles as Record<string, unknown>,
      metadata: component.metadata as Record<string, unknown>,
      ...(component.sharedComponentId ? { sharedComponentId: component.sharedComponentId } : {}),
      ...(component.globalComponentId ? { globalComponentId: component.globalComponentId } : {}),
    }
  })

  return { components, diagnostics: previewDiagnostics }
}
