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
import { authorizePreviewRead, previewAccessErrorResponse } from '@/lib/studio/preview/access'
import {
  DesignSystemReaderError,
  generateStrictDesignSystemCss,
  isDesignSystemReaderError,
  readNullableShadcnDesignSystemTokens,
} from '@/lib/studio/design-system/design-system-reader'
import type { PreviewDesignTokens, PreviewComponentConfig } from '@/lib/studio/preview/sandbox/types'
import {
  extractComponentsWithDiagnostics,
  type PreviewPageContentDiagnostic,
} from '@/lib/studio/preview/component-extraction'
import { normalizePreviewPath } from '@/lib/studio/preview/qa-preview-token'

interface PreviewDesignSystemDiagnostic {
  code: string
  severity: 'error'
  message: string
  context?: Record<string, unknown>
}

type PreviewDataDiagnostic = PreviewPageContentDiagnostic | PreviewDesignSystemDiagnostic

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
      templateKey: string | null
      templateProps: Record<string, unknown>
      metadata: Record<string, unknown>
      components: PreviewComponentConfig[]
    }>
  }
  error?: string
  diagnostics?: PreviewDataDiagnostic[]
}

function hasBlockingDiagnostics(diagnostics: PreviewPageContentDiagnostic[]): boolean {
  return diagnostics.some(diagnostic => diagnostic.severity === 'warn' || diagnostic.severity === 'error')
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function withQaPreviewHeaders<T>(
  response: NextResponse<T>,
  enabled: boolean
): NextResponse<T> {
  if (enabled) {
    response.headers.set('Cache-Control', 'no-store')
    response.headers.set('Referrer-Policy', 'no-referrer')
  }

  return response
}

export async function GET(request: NextRequest): Promise<NextResponse<PreviewDataResponse>> {
  const websiteId = request.nextUrl.searchParams.get('websiteId')
  const designConceptSlug = request.nextUrl.searchParams.get('designConcept')
  const previewToken = request.nextUrl.searchParams.get('previewToken')
  const previewPath = normalizePreviewPath(request.nextUrl.searchParams.get('path'))

  if (!websiteId) {
    return NextResponse.json(
      { success: false, error: 'websiteId is required' },
      { status: 400 }
    )
  }

  try {
    const prisma = getClient()
    const access = await authorizePreviewRead(request, websiteId, {
      previewToken,
      path: previewPath,
    })
    const tokenAccess = access.mode === 'qa-token'

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
      if (!concept) {
        throw new DesignSystemReaderError(
          'DESIGN_CONCEPT_NOT_FOUND',
          `Design concept "${designConceptSlug}" was not found.`,
          { websiteId, selector: designConceptSlug }
        )
      }
      designConceptId = concept.id
    }

    // Fetch design system - optionally filter by design concept
    const designSystemRecord = await prisma.websiteDesignSystem.findFirst({
      where: {
        websiteId,
        ...(designConceptId && { designConceptId }),
      },
      orderBy: { createdAt: 'desc' },
    })

    // Runtime preview accepts only current shadcn token payloads. Missing design
    // systems are allowed; malformed or legacy payloads should fail loudly.
    const dsTokens = designSystemRecord?.tokens
    const normalized = readNullableShadcnDesignSystemTokens(dsTokens, {
      websiteId,
      designSystemId: designSystemRecord?.id,
    })

    const designSystem: PreviewDesignTokens = {
      variables: normalized?.variables ?? {},
      darkVariables: normalized?.darkVariables,
    }

    const designSystemCss = generateStrictDesignSystemCss(dsTokens, {
      websiteId,
      designSystemId: designSystemRecord?.id,
    }) ?? ''

    // Fetch pages with structure
    const pages = await prisma.websitePage.findMany({
      where: { websiteId },
      orderBy: { createdAt: 'asc' },
    })

    const structures = await prisma.websiteStructure.findMany({
      where: { websiteId },
      orderBy: [{ parentId: 'asc' }, { position: 'asc' }],
    })

    // Map structures to pages. WebsiteStructure.fullPath is the preview route
    // source of truth; slug alone is only the node label.
    const structureMap = new Map(structures.map((s) => [s.websitePageId, s]))

    const pagesForPreview = tokenAccess
      ? pages.filter((page) => normalizePreviewPath(structureMap.get(page.id)?.fullPath) === previewPath)
      : pages

    if (tokenAccess && pagesForPreview.length === 0) {
      return withQaPreviewHeaders(
        NextResponse.json(
          { success: false, error: 'Preview page not found for signed path' },
          { status: 404 }
        ),
        true
      )
    }

    // Convert pages to preview format
    const allDiagnostics: PreviewPageContentDiagnostic[] = []
    const previewPages = pagesForPreview.map((page) => {
      const structure = structureMap.get(page.id)
      const slug = structure?.slug || page.id
      const fullPath = normalizePreviewPath(structure?.fullPath)
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
        templateKey: page.templateKey ?? null,
        templateProps: isRecord(page.templateProps) ? page.templateProps : {},
        metadata: isRecord(page.metadata) ? page.metadata : {},
        components,
      }
    })

    if (hasBlockingDiagnostics(allDiagnostics)) {
      return withQaPreviewHeaders(
        NextResponse.json(
          {
            success: false,
            error: 'Preview data contains invalid page content',
            diagnostics: allDiagnostics,
          },
          { status: 422 }
        ),
        tokenAccess
      )
    }

    return withQaPreviewHeaders(
      NextResponse.json({
        success: true,
        data: {
          websiteId,
          websiteName: website.name,
          designSystem,
          designSystemCss,
          pages: previewPages,
        },
        ...(allDiagnostics.length > 0 ? { diagnostics: allDiagnostics } : {}),
      }),
      tokenAccess
    )
  } catch (error) {
    if (error && typeof error === 'object' && 'statusCode' in error) {
      return withQaPreviewHeaders(
        previewAccessErrorResponse(error) as NextResponse<PreviewDataResponse>,
        Boolean(previewToken)
      )
    }

    if (isDesignSystemReaderError(error)) {
      return withQaPreviewHeaders(
        NextResponse.json(
          {
            success: false,
            error: error.message,
            diagnostics: [
              {
                code: error.code,
                severity: 'error',
                message: error.message,
                ...(error.context ? { context: error.context } : {}),
              },
            ],
          },
          { status: 422 }
        ),
        Boolean(previewToken)
      )
    }

    console.error('[preview-data] Error:', error)
    return withQaPreviewHeaders(
      NextResponse.json(
        { success: false, error: error instanceof Error ? error.message : 'Internal error' },
        { status: 500 }
      ),
      Boolean(previewToken)
    )
  }
}
