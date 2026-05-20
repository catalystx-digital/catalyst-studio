import { notFound, redirect } from 'next/navigation';
import { PageRendererHelper } from '@/lib/renderers/page-renderer';
import { websiteResolver } from '@/lib/services/website-resolver';
import { UrlResolver } from '@/lib/services/url-resolution/url-resolver';
import { prisma } from '@/lib/prisma';
import {
  normalizeComponents,
  enrichComponentFromShared,
  normalizeRegionSummary,
  normalizeMetadata,
  normalizeTemplateProps,
  extractSiteOriginFromMetadata
} from '@/lib/studio/headless/ucs/snapshot-builder';
import { loadSharedComponentsById } from '@/lib/studio/headless/ucs/page-resolver';
import type {
  SnapshotPage,
  SnapshotStructureNode,
  SnapshotSharedComponent
} from '@/lib/studio/headless/site-snapshot/types';
import { resolveSharedComponentReference } from '@/lib/studio/types/site-builder/component-instance';
import { isAssetLikeRequest } from '@/lib/utils/request-helpers';

interface PageProps {
  params: Promise<{
    slug?: string[];
  }>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function clone<T>(value: T): T {
  if (value === undefined || value === null) {
    return value;
  }
  try {
    return JSON.parse(JSON.stringify(value)) as T;
  } catch {
    return value;
  }
}

function toSlugSegments(input?: string[]): string[] {
  if (!Array.isArray(input) || input.length === 0) {
    return [];
  }
  return input.filter(segment => typeof segment === 'string' && segment.length > 0);
}

function buildStructurePayload(
  node: SnapshotStructureNode | null
) {
  if (!node) {
    return {
      current: null,
      ancestors: [],
      children: []
    };
  }

  return {
    current: node,
    ancestors: [],
    children: []
  };
}

function extractRedirectTarget(metadata: Record<string, unknown> | undefined): string | null {
  if (!metadata) {
    return null;
  }

  const redirectValue = metadata.redirect ?? metadata.redirectTo ?? metadata.redirect_url ?? metadata.redirectUrl;
  if (typeof redirectValue === 'string' && redirectValue.trim().length > 0) {
    return redirectValue.trim();
  }

  return null;
}

export default async function DynamicPage(props: PageProps) {
  const params = await props.params;
  const slugSegments = toSlugSegments(params?.slug);
  const requestPath = slugSegments.length > 0 ? `/${slugSegments.join('/')}` : '/';
  const startTime = Date.now();

  if (isAssetLikeRequest(slugSegments)) {
    return notFound();
  }

  try {
    const websiteId = await websiteResolver.resolveFromContext();
    if (!websiteId) {
      console.warn('[DynamicPage] Unable to resolve website ID. Did you configure WEBSITE_RESOLUTION_STRATEGY?');
      return notFound();
    }

    const urlResolver = new UrlResolver();
    const resolved = await urlResolver.resolveUrl(requestPath, {
      websiteId,
      caseInsensitive: true
    });

    if (!resolved.success) {
      console.warn('[DynamicPage] Failed to resolve URL', {
        path: requestPath,
        error: resolved.error
      });
      return notFound();
    }

    if (!resolved.data || !resolved.data.contentItem) {
      console.info('[DynamicPage] No page found for path', { path: requestPath });
      return notFound();
    }

    const { siteStructure, contentItem } = resolved.data;
    const slugFromStructure = (siteStructure?.fullPath ?? requestPath)
      .split('/')
      .filter(Boolean);

    const rawContent = isRecord(contentItem.content)
      ? contentItem.content
      : typeof contentItem.content === 'string'
        ? (() => {
            try {
              return JSON.parse(contentItem.content) as Record<string, unknown>;
            } catch {
              return {};
            }
          })()
        : {};

    const componentCandidates = Array.isArray(rawContent.components)
      ? rawContent.components
      : [];

    let componentInstances = normalizeComponents(componentCandidates);

    const sharedIds = Array.from(
      new Set(
        componentInstances
          .map(instance => resolveSharedComponentReference(instance))
          .filter((value): value is string => typeof value === 'string' && value.length > 0)
      )
    );

    const metadata = normalizeMetadata(contentItem.metadata);
    const assetOrigin =
      extractSiteOriginFromMetadata(metadata) ??
      extractSiteOriginFromMetadata(contentItem.metadata);

    let sharedComponents: SnapshotSharedComponent[] = [];
    if (sharedIds.length > 0) {
      const sharedCache = new Map<string, SnapshotSharedComponent>();
      sharedComponents = await loadSharedComponentsById(
        prisma,
        websiteId,
        sharedIds,
        sharedCache
      );
      componentInstances = componentInstances.map(instance =>
        enrichComponentFromShared(clone(instance), sharedComponents, { assetOrigin })
      );
    }

    const redirectTarget = extractRedirectTarget(metadata);
    if (redirectTarget) {
      console.info('[DynamicPage] Redirecting due to page metadata', {
        from: requestPath,
        to: redirectTarget
      });
      redirect(redirectTarget);
    }

    if (metadata?.isFolder) {
      console.info('[DynamicPage] Folder node accessed', { path: requestPath });
      return notFound();
    }

    const templateProps = normalizeTemplateProps(contentItem.templateProps);
    const regions = normalizeRegionSummary(rawContent.regions);

    const snapshotPage: SnapshotPage = {
      id: contentItem.id,
      title: contentItem.title ?? siteStructure?.slug ?? 'Untitled Page',
      fullPath: siteStructure?.fullPath ?? requestPath,
      templateKey: contentItem.templateKey ?? null,
      templateProps,
      regions,
      components: componentInstances,
      metadata,
      sharedComponentIds: sharedIds
    };

    const structureNode: SnapshotStructureNode | null = siteStructure
      ? {
          id: siteStructure.id,
          parentId: siteStructure.parentId ?? null,
          slug: siteStructure.slug ?? slugFromStructure[slugFromStructure.length - 1] ?? '',
          fullPath: siteStructure.fullPath ?? requestPath,
          position: siteStructure.position ?? 0,
          websitePageId: siteStructure.websitePageId ?? null,
          isFolder: !siteStructure.websitePageId,
          title: contentItem.title ?? undefined
        }
      : null;

    const duration = Date.now() - startTime;
    console.info('[DynamicPage] Resolved page', {
      path: requestPath,
      websiteId,
      slug: slugSegments,
      durationMs: duration,
      componentCount: componentInstances.length,
      sharedComponentCount: sharedComponents.length
    });

    return (
      <div className="min-h-screen bg-background-primary text-text-primary">
        <PageRendererHelper
          page={snapshotPage}
          structure={buildStructurePayload(structureNode)}
          sharedComponents={sharedComponents}
          onMetrics={(metrics) => {
            if (process.env.NODE_ENV !== 'production') {
              console.debug('[DynamicPage] Component metrics', metrics);
            }
          }}
        />
      </div>
    );
  } catch (error) {
    console.error('[DynamicPage] Failed to render page', {
      path: requestPath,
      error: error instanceof Error ? error.message : String(error)
    });
    return notFound();
  }
}
