import React from 'react'
import { notFound, redirect } from 'next/navigation'
import { PageRendererHelper } from '@/lib/renderers/page-renderer'
import { prisma } from '@/lib/prisma'
import { UrlResolver } from '@/lib/services/url-resolution/url-resolver'
import { generateDesignSystemCss } from '@/lib/studio/design-system/design-system-reader'
import {
  normalizeComponents,
  enrichComponentFromShared,
  normalizeRegionSummary,
  normalizeMetadata,
  normalizeTemplateProps,
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

interface RenderLocalPreviewOptions {
  websiteId: string
  slug?: string[]
  designConcept?: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
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

async function resolveDesignSystemCss(websiteId: string, designConcept?: string): Promise<string | null> {
  let designConceptId: string | undefined
  const db = prisma as {
    websiteDesignConcept: {
      findFirst: (args: Record<string, unknown>) => Promise<{ id: string } | null>
    }
    websiteDesignSystem: {
      findFirst: (args: Record<string, unknown>) => Promise<{ tokens: unknown } | null>
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
  }

  const designSystem = await db.websiteDesignSystem.findFirst({
    where: {
      websiteId,
      ...(designConceptId ? { designConceptId } : { isCurrent: true }),
    },
    orderBy: { createdAt: 'desc' },
    select: { tokens: true },
  })

  return designSystem ? generateDesignSystemCss(designSystem.tokens) : null
}

export async function renderLocalWebsitePreview({ websiteId, slug, designConcept }: RenderLocalPreviewOptions) {
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
      return notFound()
    }

    if (!resolved.data || !resolved.data.contentItem) {
      console.info('[LocalPreview] No page found for path', { path: requestPath, websiteId })
      return notFound()
    }

    const { siteStructure, contentItem } = resolved.data
    const slugFromStructure = (siteStructure?.fullPath ?? requestPath)
      .split('/')
      .filter(Boolean)

    const rawContent = isRecord(contentItem.content)
      ? contentItem.content
      : typeof contentItem.content === 'string'
        ? (() => {
            try {
              return JSON.parse(contentItem.content) as Record<string, unknown>
            } catch {
              return {}
            }
          })()
        : {}

    const componentCandidates = Array.isArray(rawContent.components)
      ? rawContent.components
      : []

    let componentInstances = normalizeComponents(componentCandidates)

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
    const regions = normalizeRegionSummary(rawContent.regions)

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
    console.info('[LocalPreview] Resolved page', {
      path: requestPath,
      websiteId,
      slug: slugSegments,
      durationMs: duration,
      componentCount: componentInstances.length,
      sharedComponentCount: sharedComponents.length,
    })

    return (
      <div className="min-h-screen bg-background-primary text-text-primary">
        {designSystemCss && (
          <style
            id="studio-local-preview-design-system"
            dangerouslySetInnerHTML={{ __html: designSystemCss }}
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
    console.error('[LocalPreview] Failed to render page', {
      path: requestPath,
      websiteId,
      error: error instanceof Error ? error.message : String(error),
    })
    return notFound()
  }
}
