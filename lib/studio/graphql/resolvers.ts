import { GraphQLError } from 'graphql';

import type { ResolvedInstance } from '@/lib/services/unified-content-repository';
import { resolveUcsPageBySlug } from '@/lib/studio/headless/ucs/page-resolver';
import type { ResolverDiagnostic } from '@/lib/studio/headless/ucs/page-resolver';
import { DateTimeScalar, JSONScalar } from '@/lib/studio/graphql/scalars';
import type { GraphqlContext, GraphqlPageNode } from '@/lib/studio/graphql/types';
import { RESOLVED_COMPONENTS_SYMBOL } from '@/lib/studio/graphql/types';
import {
  enforceWebsiteScope,
  loadWebsiteIfAccessible,
  parseSlugInput,
  requirePageSelector,
} from '@/lib/studio/graphql/utils';
import { resolveContentReferences } from '@/lib/services/export/helpers/resolve-content-references';
import { createMediaUrlLoader } from '@/lib/services/content-reference/media-url-loader';
import { createPagePathLoader } from '@/lib/services/content-reference/page-path-loader';

function encodeBadRequest(message: string): GraphQLError {
  return new GraphQLError(message, {
    extensions: { code: 'BAD_REQUEST' },
  });
}

function getInvalidPageContentDiagnostics(diagnostics: ResolverDiagnostic[]): ResolverDiagnostic[] {
  return diagnostics.filter(
    diagnostic => diagnostic.level === 'error' && diagnostic.code.startsWith('PAGE_CONTENT_'),
  );
}

function encodeInvalidPageContent(diagnostics: ResolverDiagnostic[]): GraphQLError {
  return new GraphQLError('Invalid page content', {
    extensions: {
      code: 'INVALID_PAGE_CONTENT',
      diagnostics,
    },
  });
}

function coerceComponent(component: Record<string, unknown>): Record<string, unknown> {
  return component ?? {};
}

function enrichComponentInstances<T extends { id: string }>(
  components: T[],
  resolved: Map<string, ResolvedInstance>,
): Array<Record<string, unknown>> {
  return components.map(instance => {
    const merged: Record<string, unknown> = { ...instance };
    const info = resolved.get(instance.id);
    if (info) {
      merged.sharedComponentId = info.sharedId ?? merged.sharedComponentId ?? null;
      merged.effectiveProps = info.effectiveProps ?? null;
      merged.hasOverrides = info.hasOverrides;
      merged.isSharedInstance = info.isShared;
    } else {
      merged.effectiveProps = merged.effectiveProps ?? null;
      merged.hasOverrides = Boolean(merged.hasOverrides);
      merged.isSharedInstance = Boolean(merged.sharedComponentId);
    }
    return merged;
  });
}

async function resolveWebsiteNode(context: GraphqlContext, id: string) {
  const website = await loadWebsiteIfAccessible(context, id);
  return website ?? null;
}

async function resolveWebsitesConnection(
  context: GraphqlContext,
  args: { first?: number | null; after?: string | null },
) {
  const first = typeof args.first === 'number' ? args.first : 20;
  if (first < 1) {
    throw encodeBadRequest('first must be greater than 0');
  }
  if (first > 50) {
    throw encodeBadRequest('first must be less than or equal to 50');
  }

  try {
    const payload = await context.services.website.getWebsitesConnection({
      accountId: context.auth.accountId,
      websiteId: context.auth.websiteId ?? undefined,
      first,
      after: args.after ?? undefined,
    });
    return payload;
  } catch (error) {
    if (error instanceof Error && /Invalid pagination cursor/i.test(error.message)) {
      throw encodeBadRequest('Invalid pagination cursor');
    }
    throw error;
  }
}

async function resolvePageNode(
  context: GraphqlContext,
  args: { id?: string | null; slug?: string | null; websiteId: string },
): Promise<GraphqlPageNode | null> {
  requirePageSelector(args);
  enforceWebsiteScope(context, args.websiteId);
  const website = await loadWebsiteIfAccessible(context, args.websiteId);
  if (!website) {
    return null;
  }

  let slugSegments = parseSlugInput(args.slug);

  if (!slugSegments && args.id) {
    const structure = await context.loaders.structureByPageId.load(args.id);
    if (!structure || !structure.fullPath) {
      return null;
    }
    slugSegments = structure.fullPath.split('/').filter(Boolean);
  }

  const normalizedSlug = slugSegments ?? [];

  const { payload, diagnostics } = await resolveUcsPageBySlug({
    prisma: context.prisma,
    websiteId: args.websiteId,
    slug: normalizedSlug,
    originalSlug: args.slug ? parseSlugInput(args.slug) ?? undefined : undefined,
    sharedComponentCache: context.sharedComponentCache,
  });

  if (!payload) {
    const invalidPageContentDiagnostics = getInvalidPageContentDiagnostics(diagnostics);
    if (invalidPageContentDiagnostics.length > 0) {
      throw encodeInvalidPageContent(invalidPageContentDiagnostics);
    }
    return null;
  }

  const resolved = await context.repositories.unifiedContent.getPageWithResolvedComponents(
    args.websiteId,
    payload.page.id,
  );
  const resolutionMap = resolved.components.reduce<Map<string, ResolvedInstance>>((acc, component) => {
    acc.set(component.id, component);
    return acc;
  }, new Map());

  const enrichedComponents = enrichComponentInstances(payload.page.components, resolutionMap);

  const graphPage: GraphqlPageNode = {
    ...payload.page,
    websiteId: args.websiteId,
    components: enrichedComponents as unknown as typeof payload.page.components,
    sharedComponents: payload.sharedComponents,
    diagnostics: [...(payload.diagnostics ?? []), ...diagnostics],
    structure: payload.structure,
    [RESOLVED_COMPONENTS_SYMBOL]: resolutionMap,
  };

  return graphPage;
}

async function resolveSharedComponent(context: GraphqlContext, id: string) {
  const record = await context.loaders.sharedComponentById.load(id);
  if (!record) {
    return null;
  }

  const website = await loadWebsiteIfAccessible(context, record.websiteId);
  if (!website) {
    return null;
  }

  return {
    id: record.id,
    name: record.name,
    componentType: (record as Record<string, unknown>).websiteComponentType
      ? ((record as Record<string, unknown>).websiteComponentType as { type?: string })?.type ?? 'unknown'
      : 'unknown',
    componentTypeId: record.websiteComponentTypeId,
    content: record.content as Record<string, unknown> | null,
    config: coerceComponent(record.config as Record<string, unknown>),
  };
}

async function resolveSharedComponentList(context: GraphqlContext, websiteId: string) {
  enforceWebsiteScope(context, websiteId);
  const website = await loadWebsiteIfAccessible(context, websiteId);
  if (!website) {
    return [];
  }

  const records = await context.prisma.websiteSharedComponent.findMany({
    where: { websiteId },
    include: {
      websiteComponentType: {
        select: { type: true },
      },
    },
    orderBy: [
      { createdAt: 'asc' },
      { id: 'asc' },
    ],
  });

  return records.map(record => ({
    id: record.id,
    name: record.name,
    componentType: (record as Record<string, unknown>).websiteComponentType
      ? ((record as Record<string, unknown>).websiteComponentType as { type?: string })?.type ?? 'unknown'
      : 'unknown',
    componentTypeId: record.websiteComponentTypeId,
    content: record.content as Record<string, unknown> | null,
    config: coerceComponent(record.config as Record<string, unknown>),
  }));
}

async function resolveDesignSystems(context: GraphqlContext, websiteId: string) {
  enforceWebsiteScope(context, websiteId);
  const website = await loadWebsiteIfAccessible(context, websiteId);
  if (!website) {
    return [];
  }

  const snapshots = await context.repositories.designSystem.findMany({
    websiteId,
    orderBy: 'createdAt',
    orderDirection: 'desc',
  });

  return snapshots.map(snapshot => ({
    id: snapshot.id,
    websiteId: snapshot.websiteId,
    designConceptId: snapshot.designConceptId,
    conceptName: (snapshot as Record<string, unknown>).designConcept
      ? ((snapshot as Record<string, unknown>).designConcept as { name?: string })?.name ?? null
      : null,
    version: snapshot.version,
    tokens: snapshot.tokens,
    sourceJobId: snapshot.sourceJobId,
    isCurrent: snapshot.isCurrent,
    createdAt: snapshot.createdAt,
    updatedAt: snapshot.updatedAt,
  }));
}

async function resolveContentField(value: unknown): Promise<unknown> {
  if (!value || typeof value !== 'object') {
    return value;
  }
  // Clone to avoid mutating parent data
  const cloned = JSON.parse(JSON.stringify(value));
  // Create loaders per-request
  const mediaLoader = createMediaUrlLoader();
  const pageLoader = createPagePathLoader();
  // Resolve in-place
  await resolveContentReferences(cloned, { mediaLoader, pageLoader });
  return cloned;
}

export const ucsGraphqlResolvers = {
  DateTime: DateTimeScalar,
  JSON: JSONScalar,
  Query: {
    website: (_parent: unknown, args: { id: string }, context: GraphqlContext) =>
      resolveWebsiteNode(context, args.id),
    websites: (_parent: unknown, args: { first?: number; after?: string }, context: GraphqlContext) =>
      resolveWebsitesConnection(context, args),
    page: (
      _parent: unknown,
      args: { id?: string | null; slug?: string | null; websiteId: string },
      context: GraphqlContext,
    ) => resolvePageNode(context, args),
    sharedComponent: (_parent: unknown, args: { id: string }, context: GraphqlContext) =>
      resolveSharedComponent(context, args.id),
    sharedComponents: (_parent: unknown, args: { websiteId: string }, context: GraphqlContext) =>
      resolveSharedComponentList(context, args.websiteId),
    designSystems: (_parent: unknown, args: { websiteId: string }, context: GraphqlContext) =>
      resolveDesignSystems(context, args.websiteId),
  },
  Page: {
    structure: (parent: GraphqlPageNode) => parent.structure ?? null,
    sharedComponents: (parent: GraphqlPageNode) => parent.sharedComponents ?? [],
    diagnostics: (parent: GraphqlPageNode) => parent.diagnostics ?? [],
  },
  ComponentInstance: {
    effectiveProps: async (parent: { effectiveProps?: Record<string, unknown> }) =>
      parent.effectiveProps ? await resolveContentField(parent.effectiveProps) : null,
    props: async (parent: { props?: Record<string, unknown> }) =>
      parent.props ? await resolveContentField(parent.props) : {},
    content: async (parent: { content?: Record<string, unknown> }) =>
      parent.content ? await resolveContentField(parent.content) : {},
    styles: async (parent: { styles?: Record<string, unknown> }) =>
      parent.styles ? await resolveContentField(parent.styles) : {},
    metadata: async (parent: { metadata?: Record<string, unknown> }) =>
      parent.metadata ? await resolveContentField(parent.metadata) : {},
    sharedComponentId: (parent: { sharedComponentId?: string | null }) => parent.sharedComponentId ?? null,
    hasOverrides: (parent: { hasOverrides?: boolean }) => parent.hasOverrides ?? false,
    isSharedInstance: (parent: { isSharedInstance?: boolean }) => parent.isSharedInstance ?? false,
  },
  SharedComponent: {
    content: async (parent: { content?: Record<string, unknown> | null }) =>
      parent.content ? await resolveContentField(parent.content) : null,
    config: async (parent: { config?: Record<string, unknown> }) =>
      parent.config ? await resolveContentField(parent.config) : {},
  },
};
