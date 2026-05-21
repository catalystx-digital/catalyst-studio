import { prisma } from '@/lib/prisma';
import { Prisma } from '@/lib/generated/prisma';
import { normalizePageContent, toCanonicalPageContent } from '@/lib/studio/page-content';

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
    const config: Record<string, unknown> = { defaultProps: args.content, category: args.category };
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
    const components = normalizePageContent(content).pageContent.components as unknown as Array<Record<string, unknown>>;

    const sharedIds = components
      .map((c) => {
        const props = toRecord(c.props);
        return (props.sharedComponentId as string) || (c.sharedComponentId as string) || null;
      })
      .filter((v): v is string => !!v);

    const uniqueSharedIds = Array.from(new Set(sharedIds));
    const sharedRows = uniqueSharedIds.length
      ? await db.websiteSharedComponent.findMany({ where: { id: { in: uniqueSharedIds } } })
      : [];
    const sharedMap = new Map<string, any>(sharedRows.map((r: any) => [r.id, r]));

    const resolved: ResolvedInstance[] = components.map((c, idx) => {
      const id = (c.id as string) || `component-${idx}`;
      const type = (c.type as string) || 'unknown';
      const position = (c.position as number) ?? idx;
      const parentId = (c.parentId as string | null) ?? null;
      const props = toRecord(c.props);
      const sharedId = (props.sharedComponentId as string) || (c.sharedComponentId as string) || null;

      const shared = sharedId ? sharedMap.get(sharedId) : undefined;
      const sharedContent = toRecord(shared?.content ?? (toRecord(shared?.config).defaultProps ?? {}));
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
    opts?: { mirrorDefaultProps?: boolean; ifUnchangedSince?: Date }
  ): Promise<void> {
    await db.$transaction(async (tx: any) => {
      const current = await tx.websiteSharedComponent.findUnique({ where: { id: sharedId } });
      if (!current) throw new Error('Shared component not found');
      if (opts?.ifUnchangedSince && current.lastModified > opts.ifUnchangedSince) {
        throw new Error('Conflict: component modified since');
      }

      // Mirror to config.defaultProps for transition/back-compat
      let newConfig: Record<string, unknown> | null = null;
      if (opts?.mirrorDefaultProps !== false) {
        const cfg = toRecord(current.config);
        newConfig = { ...cfg, defaultProps: content };
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
    const page = await db.websitePage.findUnique({ where: { id: pageId } });
    if (!page) throw new Error('Page not found');
    if (opts?.ifUnchangedSince && page.updatedAt > opts.ifUnchangedSince) {
      throw new Error('Conflict: page modified since');
    }

    const content = (page.content || {}) as Record<string, unknown>;
    const components = normalizePageContent(content).pageContent.components as unknown as Array<Record<string, unknown>>;
    const idx = components.findIndex((c) => (c.id as string) === instanceId);
    if (idx === -1) throw new Error('Instance not found on page');

    const comp = { ...(components[idx] || {}) } as Record<string, unknown>;
    const props = { ...(toRecord(comp.props)) } as Record<string, unknown>;

    if (overrides === null) {
      // Clear overrides - reset props.text/content to remove override values
      delete props.overrides;
      delete props.hasOverrides;
    } else {
      // BUG-006 FIX: Merge overrides directly into props.text/content
      // The UI reads from props.text or props.content (JSON strings), NOT from props.overrides
      // So we need to merge the override values directly into those JSON strings

      // TKT-040 FIX: Handle wrapped overrides from the client
      // The client sends { props: { text: JSON, content: JSON } }
      // We need to extract and parse the actual content, not merge the wrapper
      let actualOverrides: Record<string, unknown> = overrides;

      // Unwrap if client sent { props: {...} } wrapper
      if (overrides.props && typeof overrides.props === 'object') {
        const propsWrapper = overrides.props as Record<string, unknown>;
        // Extract content from props.text or props.content (JSON strings)
        if (typeof propsWrapper.text === 'string') {
          try {
            actualOverrides = JSON.parse(propsWrapper.text);
          } catch {
            actualOverrides = {};
          }
        } else if (typeof propsWrapper.content === 'string') {
          try {
            actualOverrides = JSON.parse(propsWrapper.content);
          } catch {
            actualOverrides = {};
          }
        } else if (typeof propsWrapper.text === 'object' && propsWrapper.text !== null) {
          // Handle case where props.text is already an object
          actualOverrides = propsWrapper.text as Record<string, unknown>;
        } else if (typeof propsWrapper.content === 'object' && propsWrapper.content !== null) {
          // Handle case where props.content is already an object
          actualOverrides = propsWrapper.content as Record<string, unknown>;
        }
      }

      // Parse existing content from props.text or props.content
      let existingContent: Record<string, unknown> = {};
      const textValue = props.text;
      const contentValue = props.content;

      if (typeof textValue === 'string') {
        try {
          existingContent = JSON.parse(textValue);
        } catch { /* ignore parse errors */ }
      } else if (typeof contentValue === 'string') {
        try {
          existingContent = JSON.parse(contentValue);
        } catch { /* ignore parse errors */ }
      } else if (typeof textValue === 'object' && textValue !== null) {
        existingContent = textValue as Record<string, unknown>;
      } else if (typeof contentValue === 'object' && contentValue !== null) {
        existingContent = contentValue as Record<string, unknown>;
      }

      // Merge overrides into existing content (using UNWRAPPED overrides)
      const mergedContent = { ...existingContent, ...actualOverrides };
      const mergedJSON = JSON.stringify(mergedContent);

      // Update both props.text and props.content to keep them in sync
      props.text = mergedJSON;
      props.content = mergedJSON;

      // Also store overrides separately for tracking/rollback purposes
      props.overrides = actualOverrides;
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
      data: { content: toCanonicalPageContent(content, components) as unknown as Prisma.InputJsonValue },
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
    const instanceId = `instance-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const content = (page.content || {}) as Record<string, unknown>;
    const components = [...normalizePageContent(content).pageContent.components] as unknown as Array<Record<string, unknown>>;
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
      data: { content: toCanonicalPageContent(content, components) as unknown as Prisma.InputJsonValue },
    });
    return { instanceId };
  },

  async removeSharedInstanceFromPage(pageId: string, instanceId: string): Promise<void> {
    const page = await db.websitePage.findUnique({ where: { id: pageId } });
    if (!page) throw new Error('Page not found');
    const content = (page.content || {}) as Record<string, unknown>;
    const components = normalizePageContent(content).pageContent.components as unknown as Array<Record<string, unknown>>;
    const filtered = components.filter((c) => (c.id as string) !== instanceId);
    await db.websitePage.update({
      where: { id: pageId },
      data: { content: toCanonicalPageContent(content, filtered) as unknown as Prisma.InputJsonValue },
    });
  },

  async convertFullPropsToOverrides(pageId: string, instanceId: string, sharedId: string): Promise<void> {
    const page = await db.websitePage.findUnique({ where: { id: pageId } });
    if (!page) throw new Error('Page not found');
    const content = (page.content || {}) as Record<string, unknown>;
    const components = normalizePageContent(content).pageContent.components as unknown as Array<Record<string, unknown>>;
    const idx = components.findIndex((c) => (c.id as string) === instanceId);
    if (idx === -1) throw new Error('Instance not found on page');

    const comp = { ...(components[idx] || {}) } as Record<string, unknown>;
    const props = { ...(toRecord(comp.props)) } as Record<string, unknown>;
    const shared = await db.websiteSharedComponent.findUnique({ where: { id: sharedId } });
    const sharedContent = toRecord(shared?.content ?? (toRecord(shared?.config).defaultProps ?? {}));

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
      data: { content: toCanonicalPageContent(content, components) as unknown as Prisma.InputJsonValue },
    });
  },
};
