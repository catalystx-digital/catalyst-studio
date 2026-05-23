import { prisma } from '@/lib/prisma';
import { Prisma } from '@/lib/generated/prisma';
import { normalizePageContent, parseJsonString, toCanonicalPageContent } from '@/lib/studio/page-content';

export interface ResolvedInstance {
  id: string;
  type: string;
  position: number;
  parentId?: string | null;
  sharedId?: string | null;
  isShared: boolean;
  hasOverrides: boolean;
  effectiveProps: Record<string, unknown>;
}

export interface ResolvedPage {
  pageId: string;
  websiteId: string;
  title: string;
  components: ResolvedInstance[];
}

/**
 * Deep merge utility with MVP semantics:
 * - Objects: recursively merged; null in overrides deletes the key.
 * - Arrays: override replaces base array (no per-element diff/delete in MVP).
 * - Primitives: override replaces base.
 */
export function deepMerge(base: unknown, override: unknown): unknown {
  if (override === null) {
    return undefined;
  }
  if (Array.isArray(base) && Array.isArray(override)) {
    return override;
  }
  if (typeof base === 'object' && base !== null && typeof override === 'object' && override !== null && !Array.isArray(base) && !Array.isArray(override)) {
    const result: Record<string, unknown> = {};
    const keys = new Set([...Object.keys(base as Record<string, unknown>), ...Object.keys(override as Record<string, unknown>)]);
    for (const key of keys) {
      const b = (base as Record<string, unknown>)[key];
      const o = (override as Record<string, unknown>)[key];
      if (o === null) {
        // null in overrides means delete property
        continue;
      }
      if (b === undefined) {
        result[key] = o;
        continue;
      }
      if (o === undefined) {
        result[key] = b;
        continue;
      }
      result[key] = deepMerge(b, o) as unknown;
    }
    return result;
  }
  return override !== undefined ? override : base;
}

function toRecord(obj: unknown): Record<string, unknown> {
  return (obj && typeof obj === 'object' ? (obj as Record<string, unknown>) : {}) as Record<string, unknown>;
}

function isRecord(obj: unknown): obj is Record<string, unknown> {
  return obj !== null && typeof obj === 'object' && !Array.isArray(obj);
}

function isPlainObject(obj: unknown): obj is Record<string, unknown> {
  if (!isRecord(obj)) {
    return false;
  }
  const proto = Object.getPrototypeOf(obj);
  return proto === Object.prototype || proto === null;
}

function assertCanonicalOverrides(overrides: unknown): asserts overrides is Record<string, unknown> | null {
  if (overrides === null) {
    return;
  }
  if (!isPlainObject(overrides)) {
    throw new Error('Page overrides must be a plain object or null');
  }
  const props = overrides.props;
  if (isPlainObject(props) && (
    Object.prototype.hasOwnProperty.call(props, 'text')
    || Object.prototype.hasOwnProperty.call(props, 'content')
  )) {
    throw new Error('Legacy wrapped page overrides are not accepted');
  }
}

function stripLegacyStrictWriteMirrors(component: Record<string, unknown>): Record<string, unknown> {
  const next = { ...component };
  const props = toRecord(next.props);
  if (isTextMirror(props.text)) {
    delete props.text;
  }
  delete props.content;
  next.props = props;
  return next;
}

function isTextMirror(value: unknown): boolean {
  return isRecord(value) || (typeof value === 'string' && isRecord(parseJsonString(value)));
}

const db = prisma as any;

export const ContentRepository = {
  async createSharedComponent(args: {
    id?: string;
    websiteId: string;
    websiteComponentTypeId: string;
    name: string;
    category: 'header' | 'footer' | 'navigation' | 'shared';
    content: Record<string, unknown>;
    createdBy?: string;
  }): Promise<{ id: string }> {
    const id = args.id || `global-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const createdBy = args.createdBy || 'user';
    const config: Record<string, unknown> = { category: args.category };
    const row = await db.websiteSharedComponent.create({
      data: {
        id,
        websiteId: args.websiteId,
        websiteComponentTypeId: args.websiteComponentTypeId,
        name: args.name,
        content: args.content as unknown as Prisma.InputJsonValue,
        config: config as unknown as Prisma.InputJsonValue,
        createdBy,
        usageCount: 0,
      },
      select: { id: true },
    });
    return { id: row.id };
  },
  async getPageWithResolvedComponents(websiteId: string, pageId: string): Promise<ResolvedPage> {
    const page = await db.websitePage.findUnique({ where: { id: pageId } });
    if (!page || page.websiteId !== websiteId) {
      throw new Error('Page not found');
    }

    const content = (page.content || {}) as Record<string, unknown>;
    const components = normalizePageContent(content, { mode: 'strict-read' }).pageContent.components as unknown as Array<Record<string, unknown>>;

    const sharedIds = components
      .map((c) => {
        const props = toRecord(c.props);
        return (props.sharedComponentId as string) || (c.sharedComponentId as string) || null;
      })
      .filter((v): v is string => !!v);

    const uniqueSharedIds = Array.from(new Set(sharedIds));
    const sharedRows = uniqueSharedIds.length
      ? await db.websiteSharedComponent.findMany({ where: { id: { in: uniqueSharedIds }, websiteId } })
      : [];
    const sharedMap = new Map<string, any>(sharedRows.map((r: any) => [r.id, r]));

    const resolved: ResolvedInstance[] = components.map((c) => {
      const id = c.id as string;
      const type = c.type as string;
      const position = c.position as number;
      const parentId = (c.parentId as string | null) ?? null;
      const props = toRecord(c.props);
      const sharedId = (props.sharedComponentId as string) || (c.sharedComponentId as string) || null;

      const shared = sharedId ? sharedMap.get(sharedId) : undefined;
      const sharedContent = toRecord(shared?.content);
      const overrides = toRecord(props.overrides ?? {});
      const hasOverrides = !!(props.hasOverrides || (overrides && Object.keys(overrides).length > 0));
      const effectiveProps = deepMerge(sharedContent, overrides) as Record<string, unknown>;

      return {
        id,
        type,
        position,
        parentId,
        sharedId: sharedId ?? undefined,
        isShared: !!sharedId,
        hasOverrides,
        effectiveProps: (effectiveProps || {}) as Record<string, unknown>,
      };
    });

    return {
      pageId: page.id,
      websiteId: page.websiteId,
      title: page.title,
      components: resolved,
    };
  },

  async saveSharedComponentContent(
    sharedId: string,
    content: Record<string, unknown>,
    opts?: { websiteId?: string; mirrorDefaultProps?: boolean; ifUnchangedSince?: Date }
  ): Promise<void> {
    await db.$transaction(async (tx: any) => {
      const current = await tx.websiteSharedComponent.findUnique({ where: { id: sharedId } });
      if (!current || (opts?.websiteId && current.websiteId !== opts.websiteId)) {
        throw new Error('Shared component not found');
      }
      if (opts?.ifUnchangedSince && current.lastModified > opts.ifUnchangedSince) {
        throw new Error('Conflict: component modified since');
      }

      let newConfig: Record<string, unknown> | null = null;
      if (opts?.mirrorDefaultProps !== false) {
        const cfg = toRecord(current.config);
        const { defaultProps: _legacyDefaultProps, ...nextConfig } = cfg;
        newConfig = nextConfig;
      }

      await tx.websiteSharedComponent.update({
        where: { id: sharedId },
        data: {
          content: content as unknown as Prisma.InputJsonValue,
          ...(newConfig ? { config: newConfig as unknown as Prisma.InputJsonValue } : {}),
        },
      });
    });
  },

  async savePageOverrides(
    pageId: string,
    instanceId: string,
    overrides: Record<string, unknown> | null,
    opts?: { ifUnchangedSince?: Date }
  ): Promise<void> {
    assertCanonicalOverrides(overrides);

    const page = await db.websitePage.findUnique({ where: { id: pageId } });
    if (!page) throw new Error('Page not found');
    if (opts?.ifUnchangedSince && page.updatedAt > opts.ifUnchangedSince) {
      throw new Error('Conflict: page modified since');
    }

    const content = (page.content || {}) as Record<string, unknown>;
    const components = (normalizePageContent(content, { mode: 'strict-read' }).pageContent.components as unknown as Array<Record<string, unknown>>)
      .map(stripLegacyStrictWriteMirrors);
    const idx = components.findIndex((c) => (c.id as string) === instanceId);
    if (idx === -1) throw new Error('Instance not found on page');

    const comp = { ...(components[idx] || {}) } as Record<string, unknown>;
    const props = { ...(toRecord(comp.props)) } as Record<string, unknown>;

    if (overrides === null) {
      // Clear overrides - reset props.text/content to remove override values
      delete props.overrides;
      delete props.hasOverrides;
      if (isTextMirror(props.text)) {
        delete props.text;
      }
      delete props.content;
      comp.content = {};
    } else {
      const existingContent = isPlainObject(comp.content) ? comp.content : {};
      const mergedContent = { ...existingContent, ...overrides };
      if (isTextMirror(props.text)) {
        delete props.text;
      }

      // Also store overrides separately for tracking/rollback purposes
      props.overrides = overrides;
      (props as any).hasOverrides = true;

      // CRITICAL FIX: Also update component.content for UCS provider compatibility
      // The UCS page-resolver reads from component.content, not props.text/content
      // Without this, sandbox preview shows stale data
      comp.content = mergedContent;
    }
    comp.props = props;
    components[idx] = comp;

    await db.websitePage.update({
      where: { id: pageId },
      data: { content: toCanonicalPageContent(content, components, { mode: 'strict-write' }) as unknown as Prisma.InputJsonValue },
    });
  },

  async addSharedInstanceToPage(
    pageId: string,
    sharedId: string,
    position: number,
    overrides?: Record<string, unknown>
  ): Promise<{ instanceId: string }> {
    const page = await db.websitePage.findUnique({ where: { id: pageId } });
    if (!page) throw new Error('Page not found');
    const shared = await db.websiteSharedComponent.findUnique({
      where: { id: sharedId },
      select: { id: true, websiteId: true },
    });
    if (!shared || shared.websiteId !== page.websiteId) {
      throw new Error('Shared component not found');
    }
    const instanceId = `instance-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const content = (page.content || {}) as Record<string, unknown>;
    const components = [...(normalizePageContent(content, { mode: 'strict-read' }).pageContent.components as unknown as Array<Record<string, unknown>>)
      .map(stripLegacyStrictWriteMirrors)];
    components.splice(position, 0, {
      id: instanceId,
      type: 'shared',
      parentId: null,
      position,
      props: {
        sharedComponentId: sharedId,
        ...(overrides && Object.keys(overrides).length > 0
          ? { overrides, hasOverrides: true }
          : {}),
      },
      content: {},
      styles: {},
      metadata: {},
    });
    await db.websitePage.update({
      where: { id: pageId },
      data: { content: toCanonicalPageContent(content, components, { mode: 'strict-write' }) as unknown as Prisma.InputJsonValue },
    });
    return { instanceId };
  },

  async removeSharedInstanceFromPage(pageId: string, instanceId: string): Promise<void> {
    const page = await db.websitePage.findUnique({ where: { id: pageId } });
    if (!page) throw new Error('Page not found');
    const content = (page.content || {}) as Record<string, unknown>;
    const components = (normalizePageContent(content, { mode: 'strict-read' }).pageContent.components as unknown as Array<Record<string, unknown>>)
      .map(stripLegacyStrictWriteMirrors);
    const filtered = components.filter((c) => (c.id as string) !== instanceId);
    await db.websitePage.update({
      where: { id: pageId },
      data: { content: toCanonicalPageContent(content, filtered, { mode: 'strict-write' }) as unknown as Prisma.InputJsonValue },
    });
  },

  async convertFullPropsToOverrides(pageId: string, instanceId: string, sharedId: string): Promise<void> {
    const page = await db.websitePage.findUnique({ where: { id: pageId } });
    if (!page) throw new Error('Page not found');
    const content = (page.content || {}) as Record<string, unknown>;
    const components = (normalizePageContent(content, { mode: 'strict-read' }).pageContent.components as unknown as Array<Record<string, unknown>>)
      .map(stripLegacyStrictWriteMirrors);
    const idx = components.findIndex((c) => (c.id as string) === instanceId);
    if (idx === -1) throw new Error('Instance not found on page');

    const comp = { ...(components[idx] || {}) } as Record<string, unknown>;
    const props = { ...(toRecord(comp.props)) } as Record<string, unknown>;
    const shared = await db.websiteSharedComponent.findUnique({ where: { id: sharedId } });
    if (!shared || shared.websiteId !== page.websiteId) {
      throw new Error('Shared component not found');
    }
    const sharedContent = toRecord(shared?.content);

    // Compute overrides as shallow diff: props minus sharedContent
    const currentFull = toRecord(props);
    // Remove identifiers
    delete currentFull.sharedComponentId;
    delete currentFull.hasOverrides;
    const overrides: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(currentFull)) {
      const base = (sharedContent as Record<string, unknown>)[k];
      if (JSON.stringify(base) !== JSON.stringify(v)) {
        overrides[k] = v;
      }
    }
    props.overrides = overrides;
    (props as any).hasOverrides = Object.keys(overrides).length > 0;

    // Remove full props keys, keep only metadata + overrides
    for (const k of Object.keys(currentFull)) {
      if (k !== 'overrides' && k !== 'sharedComponentId' && k !== 'hasOverrides') {
        delete (props as Record<string, unknown>)[k];
      }
    }
    comp.props = props;
    components[idx] = comp;

    await db.websitePage.update({
      where: { id: pageId },
      data: { content: toCanonicalPageContent(content, components, { mode: 'strict-write' }) as unknown as Prisma.InputJsonValue },
    });
  },
};
