import React from 'react'
import { notFound, redirect, unstable_rethrow } from 'next/navigation'
import { PageRendererHelper } from '@/lib/renderers/page-renderer'
import { isCmsScopedVariableAllowed } from '@/lib/design-system/cms-token-guardrails'
import { prisma } from '@/lib/prisma'
import { UrlResolver } from '@/lib/services/url-resolution/url-resolver'
import {
  DesignSystemReaderError,
  generateStrictDesignSystemCss,
} from '@/lib/studio/design-system/design-system-reader'
import {
  normalizePageContent,
  normalizeMetadata,
  normalizeTemplateProps,
  type PageContentDiagnostic,
} from '@/lib/studio/page-content'
import {
  enrichComponentFromShared,
  extractSiteOriginFromMetadata,
} from '@/lib/studio/headless/ucs/snapshot-builder'
import { loadSharedComponentsById } from '@/lib/studio/headless/ucs/page-resolver'
import type {
  SnapshotPage,
  SnapshotStructureNode,
  SnapshotSharedComponent,
} from '@/lib/studio/headless/site-snapshot/types'
import { resolveSharedComponentReference } from '@/lib/studio/types/site-builder/component-instance'
import { isAssetLikeRequest } from '@/lib/utils/request-helpers'
import { createQaPreviewToken, verifyQaPreviewToken } from '@/lib/studio/preview/qa-preview-token'

interface RenderLocalPreviewOptions {
  websiteId: string
  slug?: string[]
  designConcept?: string
  previewToken?: string
  previewRouteBase?: string
}

function encodePreviewPath(path: string): string {
  const segments = path.split('/').filter(Boolean)
  return segments.length > 0
    ? `/${segments.map(segment => encodeURIComponent(segment)).join('/')}`
    : ''
}

function buildPreviewRedirectUrl(
  websiteId: string,
  path: string,
  options: { previewRouteBase: string; designConcept?: string; previewToken?: string; sourcePath?: string },
): string {
  const params = new URLSearchParams()
  if (options.designConcept?.trim()) {
    params.set('designConcept', options.designConcept.trim())
  }
  if (options.previewToken?.trim()) {
    const payload = verifyQaPreviewToken(options.previewToken.trim(), {
      websiteId,
      path: options.sourcePath ?? '/',
    })
    params.set('previewToken', createQaPreviewToken({
      websiteId,
      path,
      expiresAt: payload.expiresAt,
    }))
  }
  const query = params.toString()
  const previewPath = encodePreviewPath(path)
  const target = `${options.previewRouteBase.replace(/\/+$/, '')}${previewPath}`
  return query ? `${target}?${query}` : target
}

async function findFirstRenderablePreviewPath(websiteId: string): Promise<string | null> {
  const firstPage = await prisma.websiteStructure.findFirst({
    where: {
      websiteId,
      websitePageId: { not: null },
      fullPath: { not: '/' },
    },
    orderBy: [
      { pathDepth: 'asc' },
      { position: 'asc' },
      { createdAt: 'asc' },
    ],
    select: { fullPath: true },
  })

  return firstPage?.fullPath ?? null
}

function clone<T>(value: T): T {
  if (value === undefined || value === null) {
    return value
  }
  try {
    return JSON.parse(JSON.stringify(value)) as T
  } catch {
    return value
  }
}

function toSlugSegments(input?: string[]): string[] {
  if (!Array.isArray(input) || input.length === 0) {
    return []
  }
  return input.filter(segment => typeof segment === 'string' && segment.length > 0)
}

function buildStructurePayload(node: SnapshotStructureNode | null) {
  if (!node) {
    return {
      current: null,
      ancestors: [],
      children: [],
    }
  }

  return {
    current: node,
    ancestors: [],
    children: [],
  }
}

function extractRedirectTarget(metadata: Record<string, unknown> | undefined): string | null {
  if (!metadata) {
    return null
  }

  const redirectValue = metadata.redirect ?? metadata.redirectTo ?? metadata.redirect_url ?? metadata.redirectUrl
  if (typeof redirectValue === 'string' && redirectValue.trim().length > 0) {
    return redirectValue.trim()
  }

  return null
}

const CSS_VARIABLE_PATTERN = /^\s*--([^:]+):\s*([^;]+);/

function buildScopedDesignSystemCss(css: string | null): string | null {
  if (!css) {
    return null
  }

  const entries = css
    .split('\n')
    .map(line => line.trim())
    .map(line => {
      const match = line.match(CSS_VARIABLE_PATTERN)
      if (!match) {
        return null
      }
      const [, rawName, rawValue] = match
      const name = rawName.startsWith('--') ? rawName.trim() : `--${rawName.trim()}`
      const value = rawValue.trim()
      return isCmsScopedVariableAllowed(name) ? `  ${name}: ${value};` : null
    })
    .filter((line): line is string => Boolean(line))

  if (entries.length === 0) {
    return null
  }

  return `[data-design-system-scope="true"] {\n${entries.join('\n')}\n}`
}

function formatResolverError(error: unknown, requestPath: string, websiteId: string): string {
  const errorRecord = error && typeof error === 'object'
    ? error as Record<string, unknown>
    : {}
  const code = typeof errorRecord.code === 'string' ? errorRecord.code : 'UNKNOWN'
  const message = typeof errorRecord.message === 'string' ? errorRecord.message : 'URL resolver failed'

  return `[LocalPreview] resolveUrl failed: code=${code} message=${message} path=${requestPath} website=${websiteId}`
}

function hasBlockingDiagnostics(diagnostics: PageContentDiagnostic[]): boolean {
  return diagnostics.some(diagnostic => diagnostic.severity === 'warn' || diagnostic.severity === 'error')
}

function logInfoDiagnostics(
  diagnostics: PageContentDiagnostic[],
  context: { requestPath: string; websiteId: string; pageId?: string }
): void {
  const infoDiagnostics = diagnostics.filter(diagnostic => diagnostic.severity === 'info')
  if (infoDiagnostics.length === 0) {
    return
  }

  console.info('[LocalPreview] Adapted page content for preview', {
    ...context,
    diagnostics: infoDiagnostics.map(diagnostic => ({
      code: diagnostic.code,
      message: diagnostic.message,
      path: diagnostic.path,
      componentId: diagnostic.componentId,
    })),
  })
}

function renderPreviewUnavailablePanel({
  diagnostics,
  requestPath,
  websiteId,
  pageId,
  pageTitle,
  fullPath,
}: {
  diagnostics: PageContentDiagnostic[]
  requestPath: string
  websiteId: string
  pageId: string
  pageTitle?: string | null
  fullPath: string
}): React.ReactElement {
  return (
    <main className="min-h-screen bg-background p-6 text-foreground">
      <section
        role="alert"
        className="mx-auto max-w-3xl rounded-md border border-red-300 bg-red-50 p-5 text-red-950 shadow-sm"
      >
        <h1 className="text-xl font-semibold">Preview unavailable</h1>
        <p className="mt-2 text-sm">
          Page content diagnostics must be resolved before this page can be rendered.
        </p>
        <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="font-medium">Request path</dt>
            <dd>{requestPath}</dd>
          </div>
          <div>
            <dt className="font-medium">Page path</dt>
            <dd>{fullPath}</dd>
          </div>
          <div>
            <dt className="font-medium">Website</dt>
            <dd>{websiteId}</dd>
          </div>
          <div>
            <dt className="font-medium">Page</dt>
            <dd>{pageTitle ?? pageId}</dd>
          </div>
        </dl>
        <ul className="mt-4 space-y-3">
          {diagnostics.map((diagnostic, index) => (
            <li key={`${diagnostic.code}-${diagnostic.path ?? index}`} className="rounded border border-red-200 bg-white p-3 text-sm">
              <div className="font-mono font-semibold">{diagnostic.code}</div>
              <div className="mt-1">{diagnostic.message}</div>
              <dl className="mt-2 grid gap-1 text-xs sm:grid-cols-2">
                <div>
                  <dt className="font-medium">Severity</dt>
                  <dd>{diagnostic.severity}</dd>
                </div>
                <div>
                  <dt className="font-medium">Path</dt>
                  <dd>{diagnostic.path ?? 'n/a'}</dd>
                </div>
                <div>
                  <dt className="font-medium">Component ID</dt>
                  <dd>{diagnostic.componentId ?? 'n/a'}</dd>
                </div>
                <div>
                  <dt className="font-medium">Page ID</dt>
                  <dd>{pageId}</dd>
                </div>
              </dl>
            </li>
          ))}
        </ul>
      </section>
    </main>
  )
}

async function resolveDesignSystemCss(websiteId: string, designConcept?: string): Promise<string | null> {
  let designConceptId: string | undefined
  const db = prisma as unknown as {
    websiteDesignConcept: {
      findFirst: (args: Record<string, unknown>) => Promise<{ id: string } | null>
    }
    websiteDesignSystem: {
      findFirst: (args: Record<string, unknown>) => Promise<{ id?: string; tokens: unknown } | null>
    }
  }

  if (designConcept) {
    const concept = await db.websiteDesignConcept.findFirst({
      where: {
        websiteId,
        OR: [
          { slug: designConcept },
          { id: designConcept },
          { name: designConcept },
        ],
      },
      select: { id: true },
    })
    designConceptId = concept?.id
    if (!designConceptId) {
      throw new DesignSystemReaderError(
        'DESIGN_CONCEPT_NOT_FOUND',
        `Design concept "${designConcept}" was not found.`,
        { websiteId, selector: designConcept }
      )
    }
  }

  const designSystem = await db.websiteDesignSystem.findFirst({
    where: {
      websiteId,
      ...(designConceptId ? { designConceptId } : { isCurrent: true }),
    },
    orderBy: { createdAt: 'desc' },
    select: { id: true, tokens: true },
  })

  return designSystem
    ? generateStrictDesignSystemCss(designSystem.tokens, { websiteId, designSystemId: designSystem.id })
    : null
}

export async function renderLocalWebsitePreview({ websiteId, slug, designConcept, previewToken, previewRouteBase }: RenderLocalPreviewOptions) {
  const slugSegments = toSlugSegments(slug)
  const requestPath = slugSegments.length > 0 ? `/${slugSegments.join('/')}` : '/'
  const startTime = Date.now()

  if (isAssetLikeRequest(slugSegments)) {
    return notFound()
  }

  try {
    const urlResolver = new UrlResolver()
    const resolved = await urlResolver.resolveUrl(requestPath, {
      websiteId,
      caseInsensitive: true,
    })

    if (!resolved.success) {
      console.warn('[LocalPreview] Failed to resolve URL', {
        path: requestPath,
        websiteId,
        error: resolved.error,
      })
      throw new Error(formatResolverError(resolved.error, requestPath, websiteId))
    }

    if (resolved.data === undefined) {
      throw new Error(
        `[LocalPreview] Malformed resolver response: success=true data=undefined path=${requestPath} website=${websiteId}`
      )
    }

    if (resolved.data === null) {
      if (requestPath === '/' && previewRouteBase) {
        const firstPath = await findFirstRenderablePreviewPath(websiteId)
        if (firstPath) {
          console.info('[LocalPreview] Redirecting missing root preview to first renderable page', {
            websiteId,
            to: firstPath,
          })
          redirect(buildPreviewRedirectUrl(websiteId, firstPath, { previewRouteBase, designConcept, previewToken, sourcePath: requestPath }))
        }
      }
      console.info('[LocalPreview] No page found for path', { path: requestPath, websiteId })
      return notFound()
    }

    const { siteStructure, contentItem } = resolved.data
    if (!contentItem) {
      if (!siteStructure?.websitePageId) {
        if (requestPath === '/' && previewRouteBase) {
          const firstPath = await findFirstRenderablePreviewPath(websiteId)
          if (firstPath) {
            console.info('[LocalPreview] Redirecting folder root preview to first renderable page', {
              websiteId,
              to: firstPath,
            })
            redirect(buildPreviewRedirectUrl(websiteId, firstPath, { previewRouteBase, designConcept, previewToken, sourcePath: requestPath }))
          }
        }
        console.info('[LocalPreview] No page found for path', { path: requestPath, websiteId })
        return notFound()
      }
      throw new Error(
        `[LocalPreview] Broken resolver invariant: siteStructure.websitePageId=${siteStructure.websitePageId} but contentItem is missing path=${requestPath} website=${websiteId}`
      )
    }

    if (!siteStructure) {
      throw new Error(
        `[LocalPreview] Malformed resolver response: contentItem returned without siteStructure path=${requestPath} website=${websiteId}`
      )
    }

    const slugFromStructure = (siteStructure?.fullPath ?? requestPath)
      .split('/')
      .filter(Boolean)

    const normalizedContent = normalizePageContent(contentItem.content)
    const pageContent = normalizedContent.pageContent
    const diagnostics = normalizedContent.diagnostics
    logInfoDiagnostics(diagnostics, { requestPath, websiteId, pageId: contentItem.id })

    if (hasBlockingDiagnostics(diagnostics)) {
      console.warn('[LocalPreview] Page content diagnostics blocked preview render', {
        requestPath,
        websiteId,
        pageId: contentItem.id,
        fullPath: siteStructure.fullPath ?? requestPath,
        diagnostics: diagnostics.map(diagnostic => ({
          code: diagnostic.code,
          severity: diagnostic.severity,
          message: diagnostic.message,
          path: diagnostic.path,
          componentId: diagnostic.componentId,
        })),
      })

      return renderPreviewUnavailablePanel({
        diagnostics,
        requestPath,
        websiteId,
        pageId: contentItem.id,
        pageTitle: contentItem.title,
        fullPath: siteStructure.fullPath ?? requestPath,
      })
    }

    let componentInstances = pageContent.components

    const sharedIds = Array.from(
      new Set(
        componentInstances
          .map(instance => resolveSharedComponentReference(instance))
          .filter((value): value is string => typeof value === 'string' && value.length > 0)
      )
    )

    const metadata = normalizeMetadata(contentItem.metadata)
    const assetOrigin =
      extractSiteOriginFromMetadata(metadata) ??
      extractSiteOriginFromMetadata(contentItem.metadata)

    let sharedComponents: SnapshotSharedComponent[] = []
    if (sharedIds.length > 0) {
      const sharedCache = new Map<string, SnapshotSharedComponent>()
      sharedComponents = await loadSharedComponentsById(
        prisma as Parameters<typeof loadSharedComponentsById>[0],
        websiteId,
        sharedIds,
        sharedCache
      )
      componentInstances = componentInstances.map(instance =>
        enrichComponentFromShared(clone(instance), sharedComponents, { assetOrigin })
      )
    }

    const redirectTarget = extractRedirectTarget(metadata)
    if (redirectTarget) {
      console.info('[LocalPreview] Redirecting due to page metadata', {
        from: requestPath,
        to: redirectTarget,
      })
      redirect(redirectTarget)
    }

    if (metadata?.isFolder) {
      console.info('[LocalPreview] Folder node accessed', { path: requestPath, websiteId })
      return notFound()
    }

    const templateProps = normalizeTemplateProps(contentItem.templateProps)
    const regions = pageContent.regions ?? []

    const snapshotPage: SnapshotPage = {
      id: contentItem.id,
      title: contentItem.title ?? siteStructure?.slug ?? 'Untitled Page',
      fullPath: siteStructure?.fullPath ?? requestPath,
      templateKey: contentItem.templateKey ?? null,
      templateProps,
      regions,
      components: componentInstances,
      metadata,
      sharedComponentIds: sharedIds,
    }

    const structureNode: SnapshotStructureNode | null = siteStructure
      ? {
          id: siteStructure.id,
          parentId: siteStructure.parentId ?? null,
          slug: siteStructure.slug ?? slugFromStructure[slugFromStructure.length - 1] ?? '',
          fullPath: siteStructure.fullPath ?? requestPath,
          position: siteStructure.position ?? 0,
          websitePageId: siteStructure.websitePageId ?? null,
          isFolder: !siteStructure.websitePageId,
          title: contentItem.title ?? undefined,
        }
      : null

    const duration = Date.now() - startTime
    const designSystemCss = await resolveDesignSystemCss(websiteId, designConcept)
    const scopedDesignSystemCss = buildScopedDesignSystemCss(designSystemCss)
    console.info('[LocalPreview] Resolved page', {
      path: requestPath,
      websiteId,
      slug: slugSegments,
      durationMs: duration,
      componentCount: componentInstances.length,
      sharedComponentCount: sharedComponents.length,
    })

    return (
      <div className="min-h-screen bg-background text-foreground">
        {scopedDesignSystemCss && (
          <style
            id="studio-local-preview-design-system"
            dangerouslySetInnerHTML={{ __html: scopedDesignSystemCss }}
          />
        )}
        <PageRendererHelper
          page={snapshotPage}
          structure={buildStructurePayload(structureNode)}
          sharedComponents={sharedComponents}
          onMetrics={(metrics) => {
            if (process.env.NODE_ENV !== 'production') {
              console.debug('[LocalPreview] Component metrics', metrics)
            }
          }}
        />
      </div>
    )
  } catch (error) {
    unstable_rethrow(error)
    console.error('[LocalPreview] Failed to render page', {
      path: requestPath,
      websiteId,
      error: error instanceof Error ? error.message : String(error),
    })
    throw error
  }
}
