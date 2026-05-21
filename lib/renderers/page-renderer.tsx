import React from 'react';
import { DesignTokenProvider } from '@/lib/design-system/design-token-provider';
import { DesignSystemScope } from '@/lib/design-system/design-system-scope';
import type { DesignTokens } from '@/lib/design-system/tokens';
import { renderCMSComponents } from '@/lib/studio/components/cms/_factory/renderer.server';
import type {
  CMSComponentProps,
  ComponentType,
  ComponentCategory,
  ComponentTheme,
  ComponentPriority
} from '@/lib/studio/components/cms/_core/types';
import { ComponentCategory as CategoryEnum, ComponentType as TypeEnum } from '@/lib/studio/components/cms/_core/types';

type ComponentVariant = string;
import type { ComponentPerformanceMetrics } from '@/lib/studio/components/cms/_core/types';
import { COMPONENT_REGISTRY } from '@/lib/studio/components/component-registry.generated';
import type {
  SnapshotPage,
  SnapshotSharedComponent
} from '@/lib/studio/headless/site-snapshot/types';
import type { ResolverStructurePayload } from '@/lib/studio/headless/ucs/page-resolver';
import type {
  ComponentInstance,
  ComponentStyles
} from '@/lib/studio/types/site-builder/component-instance';
import { resolveSharedComponentReference } from '@/lib/studio/types/site-builder/component-instance';

type AnyRecord = Record<string, unknown>;

interface ComponentTreeNode {
  instance: ComponentInstance;
  region: string | null;
  depth: number;
  children: ComponentTreeNode[];
}

interface RenderedComponent {
  props: CMSComponentProps & AnyRecord;
  region: string | null;
}

export interface PageRenderProps {
  page: SnapshotPage;
  structure?: ResolverStructurePayload;
  sharedComponents?: SnapshotSharedComponent[];
  onMetrics?: (metrics: ComponentPerformanceMetrics) => void;
}

const COMPONENT_CATEGORY_VALUES = new Set<string>(Object.values(CategoryEnum));
const COMPONENT_TYPE_VALUES = new Set<string>(Object.values(TypeEnum));

const COMPONENT_CATEGORY_LOOKUP: Map<ComponentType, ComponentCategory> = (() => {
  const lookup = new Map<ComponentType, ComponentCategory>();

  COMPONENT_REGISTRY.forEach(entry => {
    if (!COMPONENT_TYPE_VALUES.has(entry.name)) {
      return;
    }

    if (!COMPONENT_CATEGORY_VALUES.has(entry.category)) {
      return;
    }

    lookup.set(entry.name as ComponentType, entry.category as ComponentCategory);
  });

  return lookup;
})();

interface PageDesignTokenPayload {
  tokens?: Partial<DesignTokens>;
  cssVariables?: Record<string, string>;
}

function isRecord(value: unknown): value is AnyRecord {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function clone<T>(value: T): T {
  if (value === undefined || value === null) {
    return value;
  }

  return JSON.parse(JSON.stringify(value)) as T;
}

function isDesignTokenStructure(value: unknown): value is Partial<DesignTokens> {
  if (!isRecord(value)) {
    return false;
  }

  return (
    'colors' in value ||
    'typography' in value ||
    'spacing' in value ||
    'shadows' in value ||
    'effects' in value ||
    'borders' in value ||
    'transitions' in value
  );
}

function extractCssVariableOverrides(value: unknown): Record<string, string> | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const entries = Object.entries(value).filter(([key, candidate]) => {
    if (!key.startsWith('--')) {
      return false;
    }
    return typeof candidate === 'string' || typeof candidate === 'number';
  });

  if (entries.length === 0) {
    return undefined;
  }

  return Object.fromEntries(entries.map(([key, candidate]) => [key, String(candidate)]));
}

function toDesignTokenPayload(value: unknown): PageDesignTokenPayload | null {
  if (!value) {
    return null;
  }

  if (isDesignTokenStructure(value)) {
    return { tokens: value };
  }

  if (isRecord(value)) {
    if (isDesignTokenStructure(value.tokens)) {
      const cssVariables =
        extractCssVariableOverrides(value.cssVariables) ??
        extractCssVariableOverrides(value.variables);
      return {
        tokens: value.tokens as Partial<DesignTokens>,
        cssVariables
      };
    }

    const directCss = extractCssVariableOverrides(value);
    if (directCss) {
      return { cssVariables: directCss };
    }
  }

  return null;
}

function collectTokenCandidates(payload: AnyRecord | undefined): unknown[] {
  if (!payload) {
    return [];
  }

  const candidates: unknown[] = [];

  [
    'designTokens',
    'tokens',
    'designSystem',
    'design',
    'theme',
    'branding'
  ].forEach(key => {
    if (key in payload) {
      candidates.push(payload[key]);
    }
  });

  if (isRecord(payload.styles)) {
    candidates.push(payload.styles.tokens);
    candidates.push(payload.styles.designTokens);
    candidates.push(payload.styles.cssVariables);
  }

  if (isRecord(payload.theme)) {
    candidates.push(payload.theme.tokens);
    candidates.push(payload.theme.designTokens);
    candidates.push(payload.theme.cssVariables);
  }

  if (isRecord(payload.branding)) {
    candidates.push(payload.branding.tokens);
    candidates.push(payload.branding.designTokens);
    candidates.push(payload.branding.cssVariables);
  }

  return candidates.filter(candidate => candidate !== undefined && candidate !== null);
}

function extractPageDesignTokens(page: SnapshotPage): PageDesignTokenPayload | null {
  const candidates: unknown[] = [];
  const templateProps = isRecord(page.templateProps) ? (page.templateProps as AnyRecord) : undefined;
  const metadata = isRecord(page.metadata) ? (page.metadata as AnyRecord) : undefined;

  candidates.push(...collectTokenCandidates(templateProps));
  candidates.push(...collectTokenCandidates(metadata));

  let tokensOverride: Partial<DesignTokens> | undefined;
  let cssVariableOverride: Record<string, string> | undefined;

  for (const candidate of candidates) {
    const payload = toDesignTokenPayload(candidate);
    if (!payload) {
      continue;
    }

    if (payload.tokens && !tokensOverride) {
      tokensOverride = payload.tokens;
    }

    if (payload.cssVariables) {
      cssVariableOverride = {
        ...(cssVariableOverride ?? {}),
        ...payload.cssVariables
      };
    }
  }

  if (!tokensOverride && !cssVariableOverride) {
    return null;
  }

  return {
    tokens: tokensOverride,
    cssVariables: cssVariableOverride
  };
}

function normalizeRegion(instance: ComponentInstance): string | null {
  const candidate = isRecord(instance.props) ? (instance.props.region as unknown) : undefined;
  if (typeof candidate !== 'string') {
    return null;
  }

  const trimmed = candidate.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function buildComponentTree(instances: ComponentInstance[]): ComponentTreeNode[] {
  if (!Array.isArray(instances) || instances.length === 0) {
    return [];
  }

  const sorted = instances.slice().sort((a, b) => {
    const aPos = typeof a.position === 'number' ? a.position : 0;
    const bPos = typeof b.position === 'number' ? b.position : 0;
    return aPos - bPos;
  });

  const nodesById = new Map<string, ComponentTreeNode>();
  const roots: ComponentTreeNode[] = [];

  sorted.forEach(instance => {
    const node: ComponentTreeNode = {
      instance,
      region: normalizeRegion(instance),
      depth: 0,
      children: []
    };
    nodesById.set(instance.id, node);
  });

  sorted.forEach(instance => {
    const node = nodesById.get(instance.id);
    if (!node) {
      return;
    }

    if (instance.parentId && nodesById.has(instance.parentId)) {
      const parent = nodesById.get(instance.parentId)!;
      node.depth = parent.depth + 1;
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  });

  const sortChildren = (entries: ComponentTreeNode[]): void => {
    entries.sort((a, b) => {
      const aPos = typeof a.instance.position === 'number' ? a.instance.position : 0;
      const bPos = typeof b.instance.position === 'number' ? b.instance.position : 0;
      return aPos - bPos;
    });

    entries.forEach(child => {
      if (child.children.length > 0) {
        sortChildren(child.children);
      }
    });
  };

  sortChildren(roots);
  return roots;
}

function resolvePageTheme(nodes: ComponentTreeNode[]): ComponentTheme {
  for (const node of nodes) {
    const propsTheme = coerceTheme((node.instance.props as AnyRecord | undefined)?.theme);
    if (propsTheme && propsTheme !== 'auto') {
      return propsTheme;
    }

    const metadataTheme = coerceTheme(
      isRecord(node.instance.metadata) ? (node.instance.metadata as AnyRecord).theme : undefined
    );
    if (metadataTheme && metadataTheme !== 'auto') {
      return metadataTheme;
    }
  }

  return 'dark';
}

function buildPageRootClasses(theme: ComponentTheme | undefined): string {
  const normalizedTheme = !theme || theme === 'auto' ? 'dark' : theme;

  return [
    'cms-page-root',
    'min-h-screen',
    'bg-background',
    'text-text-primary',
    `theme-${normalizedTheme}`
  ]
    .filter(Boolean)
    .join(' ');
}

function coerceComponentType(value: string): ComponentType {
  if (COMPONENT_TYPE_VALUES.has(value)) {
    return value as ComponentType;
  }

  throw new Error(`[PageRendererHelper] Unknown component type encountered: ${value}`);
}

function coerceTheme(value: unknown): ComponentTheme | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  switch (value) {
    case 'light':
    case 'dark':
    case 'auto':
    case 'inverted':
      return value;
    default:
      return undefined;
  }
}

function coerceVariant(value: unknown): ComponentVariant | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  switch (value) {
    case 'default':
    case 'minimal':
    case 'detailed':
    case 'compact':
    case 'expanded':
      return value;
    default:
      return undefined;
  }
}

function coercePriority(value: unknown): ComponentPriority | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  switch (value) {
    case 'critical':
    case 'high':
    case 'normal':
    case 'low':
    case 'lazy':
      return value;
    default:
      return undefined;
  }
}

function coerceLoading(value: unknown): CMSComponentProps['loading'] {
  if (value === 'lazy' || value === 'eager') {
    return value;
  }
  return undefined;
}

function deriveCategory(
  type: string,
  metadataCategory: unknown
): ComponentCategory {
  if (typeof metadataCategory === 'string' && COMPONENT_CATEGORY_VALUES.has(metadataCategory)) {
    return metadataCategory as ComponentCategory;
  }

  if (COMPONENT_CATEGORY_LOOKUP.has(type as ComponentType)) {
    return COMPONENT_CATEGORY_LOOKUP.get(type as ComponentType)!;
  }

  if (COMPONENT_TYPE_VALUES.has(type)) {
    return CategoryEnum.Content;
  }

  throw new Error(
    `[PageRendererHelper] Unable to derive component category for type "${type}" and metadata category "${String(metadataCategory)}"`
  );
}

function deriveInlineStyle(
  explicitStyle: unknown,
  styles: ComponentStyles | undefined
): React.CSSProperties | undefined {
  if (explicitStyle && isRecord(explicitStyle)) {
    return explicitStyle as React.CSSProperties;
  }

  if (styles && isRecord(styles.desktop)) {
    const entries = Object.entries(styles.desktop).filter(([, value]) => {
      return typeof value === 'string' || typeof value === 'number';
    });

    if (entries.length > 0) {
      return Object.fromEntries(entries) as React.CSSProperties;
    }
  }

  return undefined;
}

function componentInstanceToCMSProps(
  instance: ComponentInstance,
  sharedMap: Map<string, SnapshotSharedComponent>
): CMSComponentProps & AnyRecord {
  const baseProps = isRecord(instance.props) ? clone(instance.props) : {};

  const componentType = coerceComponentType(instance.type);
  const category = deriveCategory(instance.type, (instance.metadata as any)?.category);

  const content = isRecord(instance.content) ? clone(instance.content) : {};
  delete baseProps.content;
  delete baseProps.text;

  const inlineStyle = deriveInlineStyle(baseProps.style, instance.styles);
  if (inlineStyle) {
    baseProps.style = inlineStyle;
  } else {
    delete baseProps.style;
  }

  const cmsProps: CMSComponentProps & AnyRecord = {
    ...baseProps,
    id: instance.id,
    type: componentType,
    category,
    content
  };

  const theme = coerceTheme(baseProps.theme ?? (instance.metadata as any)?.theme);
  if (theme) {
    cmsProps.theme = theme;
  }

  const variant = coerceVariant(baseProps.variant ?? (instance.metadata as any)?.variant);
  if (variant) {
    cmsProps.variant = variant;
  }

  const loading = coerceLoading(baseProps.loading ?? (instance.metadata as any)?.loading);
  if (loading) {
    cmsProps.loading = loading;
  }

  const priority = coercePriority(baseProps.priority ?? (instance.metadata as any)?.priority);
  if (priority) {
    cmsProps.priority = priority;
  }

  if (typeof baseProps.interactive === 'boolean') {
    cmsProps.interactive = baseProps.interactive;
  }

  const sharedReference = resolveSharedComponentReference(instance);
  if (sharedReference) {
    cmsProps.globalComponentId = sharedReference;
    const shared = sharedMap.get(sharedReference);
    if (shared) {
      cmsProps.sharedComponent = clone(shared);
    }
  }

  if (instance.styles && Object.keys(instance.styles).length > 0) {
    cmsProps.__styles = clone(instance.styles);
  }

  const metadata = isRecord(instance.metadata) ? clone(instance.metadata) : {};
  metadata.position = instance.position;
  metadata.parentId = instance.parentId;

  if (Object.keys(metadata).length > 0) {
    cmsProps.metadata = metadata;
  }

  return cmsProps;
}

function assignChildComponents(
  cmsProps: CMSComponentProps & AnyRecord,
  renderedChildren: RenderedComponent[]
): void {
  if (renderedChildren.length === 0) {
    return;
  }

  const regionMap = renderedChildren.reduce<Record<string, Array<CMSComponentProps & AnyRecord>>>(
    (acc, child) => {
      const key = (child.region ?? 'default').toString();
      if (!acc[key]) {
        acc[key] = [];
      }
      acc[key].push(child.props);
      return acc;
    },
    {}
  );

  const content = isRecord(cmsProps.content) ? clone(cmsProps.content) : {};
  const existingAreas = isRecord(content.areas) ? clone(content.areas) as Record<string, unknown> : {};

  Object.entries(regionMap).forEach(([region, components]) => {
    existingAreas[region] = components;

    if (region === 'default') {
      content.children = components;
      content.items = components;
      content.components = components;
    }
  });

  content.areas = existingAreas;
  cmsProps.content = content;
  cmsProps.__regions = regionMap;
}

function renderTreeNode(
  node: ComponentTreeNode,
  sharedMap: Map<string, SnapshotSharedComponent>
): RenderedComponent {
  const renderedChildren = node.children.map(child => renderTreeNode(child, sharedMap));
  const props = componentInstanceToCMSProps(node.instance, sharedMap);

  assignChildComponents(props, renderedChildren);

  return {
    props,
    region: node.region
  };
}

export async function PageRendererHelper({
  page,
  structure: _structure,
  sharedComponents = [],
  onMetrics
}: PageRenderProps) {
  const componentInstances = Array.isArray(page.components) ? page.components : [];

  if (componentInstances.length === 0) {
    throw new Error(`[PageRendererHelper] Page "${page.id}" has no components to render.`);
  }

  const tree = buildComponentTree(componentInstances);
  const rootTheme = resolvePageTheme(tree);
  const rootClasses = buildPageRootClasses(rootTheme);
  const sharedMap = new Map(sharedComponents.map(component => [component.id, component]));
  const pageDesignTokens = extractPageDesignTokens(page);

  const renderedRoots = tree.map(node => renderTreeNode(node, sharedMap));
  const cmsComponents = renderedRoots.map(entry => entry.props);
  const renderedComponents = await renderCMSComponents(cmsComponents, {
    onMetrics,
  });

  // Scope imported design system variables to the preview subtree.
  return (
    <DesignSystemScope data-design-system-preview="renderer">
      <DesignTokenProvider
        tokens={pageDesignTokens?.tokens}
        cssVariables={pageDesignTokens?.cssVariables ?? null}
      >
        <div className={rootClasses}>
          <div className="cms-page-container">
            {page.title && (
              <div className="page-header mb-8">
                <h1 className="text-4xl font-bold text-text-primary">{page.title}</h1>
              </div>
            )}

            {renderedComponents}
          </div>
        </div>
      </DesignTokenProvider>
    </DesignSystemScope>
  );
}

export function PageRendererClient(props: PageRenderProps) {
  return <PageRendererHelper {...props} />;
}

export {
  buildComponentTree,
  componentInstanceToCMSProps
};

export default PageRendererHelper;
