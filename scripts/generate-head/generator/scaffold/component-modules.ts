import { ComponentType } from '@/lib/studio/components/cms/_core/types'
import type { ComponentMappingSummary } from '../../core/component-mapper'
import { toComponentExportName } from '../../utils/strings'

export interface ComponentModulePaths {
  componentImportPath: string
  componentTypeImportPath: string
}

function resolveComponentEnumKey(componentType: ComponentType): string {
  const entry = Object.entries(ComponentType).find(([, value]) => value === componentType)
  return entry ? entry[0] : componentType
}

function normalizeComponentTypeForRegistry(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
}

export function buildComponentsModule(summary: ComponentMappingSummary, paths: ComponentModulePaths): string {
  const registryByType = new Map<
    string,
    {
      sourceType: string
      importName: string
      componentType?: ComponentType
      regions: Set<string>
      loaderKey?: string
    }
  >()

  const loaderConflicts = new Map<string, Set<string>>()

  // For runtime/live providers (UCS GraphQL, Optimizely), register all known component types
  // This ensures runtime pages can use any component type, even if build-time pages don't have importName set
  // We do this when componentImports is available, regardless of page count
  if (summary.componentImports.size > 0) {
    summary.componentImports.forEach((importName, componentType) => {
      const normalizedKey = normalizeComponentTypeForRegistry(componentType)
      registryByType.set(normalizedKey, {
        sourceType: componentType,
        importName,
        componentType,
        regions: new Set<string>(),
        loaderKey: undefined
      })
    })
  }

  // For static providers with pages, build registry from page components
  summary.pages.forEach(page => {
    page.components.forEach(component => {
      if (!component.original?.type || !component.importName) {
        return
      }
      const normalizedKey = normalizeComponentTypeForRegistry(component.original.type)

      const existing = registryByType.get(normalizedKey)
      const loaderKey =
        typeof component.loaderKey === 'string' && component.loaderKey.trim().length > 0
          ? component.loaderKey.trim()
          : undefined

      if (existing) {
        if (component.region) {
          existing.regions.add(component.region)
        }
        if (loaderKey) {
          if (existing.loaderKey && existing.loaderKey !== loaderKey) {
            const conflict = loaderConflicts.get(normalizedKey) ?? new Set<string>([existing.loaderKey])
            conflict.add(loaderKey)
            loaderConflicts.set(normalizedKey, conflict)
          } else if (!existing.loaderKey) {
            existing.loaderKey = loaderKey
          }
        }
        return
      }

      registryByType.set(normalizedKey, {
        sourceType: component.original.type,
        importName: component.importName,
        componentType: component.componentType,
        regions: new Set(component.region ? [component.region] : []),
        loaderKey
      })
    })
  })

  loaderConflicts.forEach((keys, componentKey) => {
    if (keys.size > 1) {
      console.warn('head-generator:loader-conflict', { component: componentKey, loaderKeys: Array.from(keys).sort() })
    }
  })

  const uniqueImports = Array.from(new Set(Array.from(registryByType.values()).map(entry => entry.importName))).sort()

  const registryEntries: string[] = []

  registryByType.forEach((entry, key) => {
    const enumLiteral = entry.componentType
      ? `ComponentType.${resolveComponentEnumKey(entry.componentType)}`
      : 'undefined'
    const regionsLiteral = entry.regions.size > 0 ? JSON.stringify(Array.from(entry.regions).sort()) : '[]'
    const loaderLiteral = entry.loaderKey ? JSON.stringify(entry.loaderKey) : 'undefined'
    registryEntries.push(`  '${key}': {
    type: ${JSON.stringify(entry.sourceType)},
    displayName: '${entry.importName}',
    componentType: ${enumLiteral},
    regions: ${regionsLiteral},
    loader: ${loaderLiteral},
    render(component, props, children) {
      const element = (
        <${entry.importName} {...(props as unknown as React.ComponentProps<typeof ${entry.importName}>)} >
          {children}
        </${entry.importName}>
      )

      // Extract region from component.props or use default
      const region = component.props?.region || 'main'
      const loaderKey = ${loaderLiteral === 'undefined' ? `'none'` : loaderLiteral}

      return withComponentProbe(element, {
        id: component.id,
        type: component.type,
        region: region,
        loaderKey: loaderKey
      })
    }
  }`)
  })

  const importsLine = uniqueImports.length > 0 ? `import { ${uniqueImports.join(', ')} } from '${paths.componentImportPath}'` : ''

  return `import * as React from 'react'
import type { ComponentInstance } from '@/lib/studio/types/site-builder/component-instance'
import { ComponentType } from '${paths.componentTypeImportPath}'
import type { ComponentLoaderKey } from '@/generated/runtime/loaders'
import { withComponentProbe } from '@/generated/runtime/component-probe'
import { resolveAlias } from '@/lib/studio/components/cms/_core/alias-registry'
${importsLine}

function normalizeComponentKey(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
}

export interface GeneratedComponentRenderer {
  type: string
  displayName: string
  componentType?: ComponentType
  regions: string[]
  loader?: ComponentLoaderKey
  render: (
    component: ComponentInstance,
    props: Record<string, unknown>,
    children: React.ReactNode[]
  ) => React.ReactNode
}

const registry: Record<string, GeneratedComponentRenderer> = {
${registryEntries.join(',\n')}
}

export function getGeneratedComponentRenderer(component: ComponentInstance): GeneratedComponentRenderer | undefined {
  const key = normalizeComponentKey(component.type ?? '')

  // Direct lookup first
  const direct = registry[key]
  if (direct) {
    return direct
  }

  // Try alias resolution (e.g., 'nav-bar' → 'navbar')
  const canonicalKey = resolveAlias(key)
  if (canonicalKey) {
    return registry[canonicalKey]
  }

  return undefined
}

export const generatedComponentRegistry = registry
`
}

export function buildComponentTreeModule(): string {
  return `import type { ComponentInstance } from '@/lib/studio/types/site-builder/component-instance'

export interface ComponentTreeNode {
  instance: ComponentInstance
  depth: number
  region: string | null
  children: ComponentTreeNode[]
}

function extractRegion(instance: ComponentInstance): string | null {
  const regionValue = instance?.props?.region
  if (typeof regionValue !== 'string') {
    return null
  }
  const normalized = regionValue.trim()
  return normalized.length > 0 ? normalized : null
}

export function buildComponentTree(instances: readonly ComponentInstance[]): ComponentTreeNode[] {
  if (!Array.isArray(instances) || instances.length === 0) {
    return []
  }

  const nodesById = new Map<string, ComponentTreeNode>()
  const roots: ComponentTreeNode[] = []
  const sorted = Array.from(instances).sort((a, b) => a.position - b.position)

  sorted.forEach(instance => {
    const node: ComponentTreeNode = {
      instance,
      depth: 0,
      region: extractRegion(instance),
      children: []
    }
    nodesById.set(instance.id, node)
  })

  sorted.forEach(instance => {
    const node = nodesById.get(instance.id)
    if (!node) {
      return
    }

    if (instance.parentId && nodesById.has(instance.parentId)) {
      const parent = nodesById.get(instance.parentId)!
      node.depth = parent.depth + 1
      parent.children.push(node)
    } else {
      roots.push(node)
    }
  })

  const sortChildren = (nodes: ComponentTreeNode[]): void => {
    nodes.sort((a, b) => a.instance.position - b.instance.position)
    nodes.forEach(child => {
      if (child.children.length > 0) {
        sortChildren(child.children)
      }
    })
  }

  sortChildren(roots)
  return roots
}

export function getChildren(node: ComponentTreeNode, region?: string): ComponentTreeNode[] {
  if (!region) {
    return node.children.slice()
  }
  return node.children.filter(child => child.region === region)
}

export function flattenTree(nodes: ComponentTreeNode[]): ComponentTreeNode[] {
  const result: ComponentTreeNode[] = []
  const visit = (node: ComponentTreeNode): void => {
    result.push(node)
    node.children.forEach(visit)
  }
  nodes.forEach(visit)
  return result
}
`
}

export function buildRuntimeLoadersModule(): string {
  return `import type { ComponentTreeNode } from './component-tree'
import type { RenderContext } from './render-context'

export type ComponentLoaderKey = string

export interface LoaderDescriptor {
  key: ComponentLoaderKey
  description?: string
  version?: string
}

export interface ComponentLoader<T = unknown> {
  key: ComponentLoaderKey
  resolve(node: ComponentTreeNode, context: RenderContext): Promise<T>
  describe?(): LoaderDescriptor
}

const registry = new Map<ComponentLoaderKey, ComponentLoader<any>>()

export function registerComponentLoader<T>(loader: ComponentLoader<T>): void {
  registry.set(loader.key, loader)
}

export function getRegisteredLoader<T = unknown>(key: ComponentLoaderKey): ComponentLoader<T> | undefined {
  return registry.get(key)
}

export function listComponentLoaderKeys(): ComponentLoaderKey[] {
  return Array.from(registry.keys()).sort()
}
`
}

export function buildRenderContextModule(): string {
  return `import type {
  GeneratedHeadDataProvider,
  GeneratedPagePayload,
  GeneratedProviderDiagnostic,
  GeneratedProviderRequestContext,
  GeneratedSnapshotSharedComponent
} from '@/generated/providers/types'
import type { ComponentTreeNode } from '@/generated/runtime/component-tree'
import { getRegisteredLoader } from '@/generated/runtime/loaders'
import type { ComponentLoaderKey } from '@/generated/runtime/loaders'

export interface RenderRequestContext {
  url: string
  headers: Record<string, string>
  searchParams: Record<string, string | string[]>
}

export interface RenderDiagnostic extends GeneratedProviderDiagnostic {}

export interface RenderDiagnosticsCollector {
  add(diagnostic: RenderDiagnostic): void
  list(): RenderDiagnostic[]
  drain(): RenderDiagnostic[]
}

class DiagnosticsCollector implements RenderDiagnosticsCollector {
  private readonly diagnostics: RenderDiagnostic[] = []

  add(diagnostic: RenderDiagnostic): void {
    this.diagnostics.push({
      level: diagnostic.level,
      code: diagnostic.code,
      message: diagnostic.message,
      context: diagnostic.context ? { ...diagnostic.context } : undefined
    })
  }

  list(): RenderDiagnostic[] {
    return this.diagnostics.map(diagnostic => ({
      level: diagnostic.level,
      code: diagnostic.code,
      message: diagnostic.message,
      context: diagnostic.context ? { ...diagnostic.context } : undefined
    }))
  }

  drain(): RenderDiagnostic[] {
    const copy = this.list()
    this.diagnostics.length = 0
    return copy
  }
}

function cloneSharedComponent(component: GeneratedSnapshotSharedComponent): GeneratedSnapshotSharedComponent {
  return JSON.parse(JSON.stringify(component)) as GeneratedSnapshotSharedComponent
}

export interface RenderContext {
  provider: GeneratedHeadDataProvider
  providerRequestContext: GeneratedProviderRequestContext
  request: RenderRequestContext
  diagnostics: RenderDiagnosticsCollector
  caches: {
    sharedComponents: Map<string, GeneratedSnapshotSharedComponent>
    loaderResults: Map<string, unknown>
  }
  resolveSharedComponent(id: string): Promise<GeneratedSnapshotSharedComponent | null>
  loadLoaderData<T = unknown>(key: ComponentLoaderKey, node: ComponentTreeNode): Promise<T | null>
}

interface CreateRenderContextOptions {
  provider: GeneratedHeadDataProvider
  payload: GeneratedPagePayload
  slug: string[]
  request?: Partial<RenderRequestContext> & { url?: string }
  requestId?: string
}

export function createRenderContext(options: CreateRenderContextOptions): RenderContext {
  const { provider, payload, slug } = options
  const headers = {
    ...(options.request?.headers ?? {})
  } as Record<string, string>
  const searchParams = {
    ...(options.request?.searchParams ?? {})
  } as Record<string, string | string[]>
  const url =
    options.request?.url ??
    (slug.length > 0 ? \`/\${slug.join('/')}\` : '/')
  const requestContext: RenderRequestContext = { url, headers, searchParams }
  const providerRequestContext: GeneratedProviderRequestContext = {
    requestId:
      options.requestId ??
      \`render:\${slug.length > 0 ? slug.join('/') : 'root'}\`,
    headers,
    searchParams
  }

  const diagnostics = new DiagnosticsCollector()

  const sharedComponents = new Map<string, GeneratedSnapshotSharedComponent>()
  payload.sharedComponents.forEach(component => {
    sharedComponents.set(component.id, cloneSharedComponent(component))
  })

  const loaderResults = new Map<string, unknown>()
  const loaderPromises = new Map<string, Promise<unknown>>()
  const sharedComponentPromises = new Map<string, Promise<GeneratedSnapshotSharedComponent | null>>()

  const context: RenderContext = {
    provider,
    providerRequestContext,
    request: requestContext,
    diagnostics,
    caches: {
      sharedComponents,
      loaderResults
    },
    async resolveSharedComponent(id: string): Promise<GeneratedSnapshotSharedComponent | null> {
      if (sharedComponents.has(id)) {
        return cloneSharedComponent(sharedComponents.get(id)!)
      }
      if (sharedComponentPromises.has(id)) {
        return sharedComponentPromises.get(id)!
      }
      if (typeof provider.preloadSharedComponents !== 'function') {
        diagnostics.add({
          level: 'warn',
          code: 'SHARED_COMPONENT_LOADER_UNAVAILABLE',
          message: 'Provider does not support shared component preloading',
          context: {
            provider: provider.name,
            sharedComponentId: id
          }
        })
        const fallback = Promise.resolve<GeneratedSnapshotSharedComponent | null>(null)
        sharedComponentPromises.set(id, fallback)
        return fallback
      }

      const promise = provider
        .preloadSharedComponents([id], providerRequestContext)
        .then(components => {
          const component = components[id]
          if (component) {
            sharedComponents.set(id, cloneSharedComponent(component))
            return cloneSharedComponent(component)
          }
          diagnostics.add({
            level: 'warn',
            code: 'SHARED_COMPONENT_NOT_FOUND',
            message: 'Provider did not return requested shared component',
            context: {
              provider: provider.name,
              sharedComponentId: id
            }
          })
          return null
        })
        .catch(error => {
          diagnostics.add({
            level: 'error',
            code: 'SHARED_COMPONENT_PRELOAD_FAILED',
            message: 'Provider failed to preload shared component',
            context: {
              provider: provider.name,
              sharedComponentId: id,
              error: error instanceof Error ? error.message : String(error)
            }
          })
          return null
        })
      sharedComponentPromises.set(id, promise)
      return promise
    },
    async loadLoaderData<T>(key: ComponentLoaderKey, node: ComponentTreeNode): Promise<T | null> {
      const cacheKey = \`\${key}::\${node.instance.id}\`
      if (loaderResults.has(cacheKey)) {
        return loaderResults.get(cacheKey) as T
      }
      if (loaderPromises.has(cacheKey)) {
        return loaderPromises.get(cacheKey)! as Promise<T | null>
      }

      const loader = getRegisteredLoader<T>(key)
      if (!loader) {
        diagnostics.add({
          level: 'warn',
          code: 'COMPONENT_LOADER_NOT_REGISTERED',
          message: 'No loader registered for component',
          context: {
            loaderKey: key,
            componentId: node.instance.id,
            componentType: node.instance.type
          }
        })
        const result = Promise.resolve<T | null>(null)
        loaderPromises.set(cacheKey, result)
        return result
      }

      const execution = loader
        .resolve(node, context)
        .then(value => {
          loaderResults.set(cacheKey, value as unknown)
          return value
        })
        .catch(error => {
          diagnostics.add({
            level: 'error',
            code: 'COMPONENT_LOADER_FAILED',
            message: 'Component loader execution failed',
            context: {
              loaderKey: key,
              componentId: node.instance.id,
              componentType: node.instance.type,
              error: error instanceof Error ? error.message : String(error)
            }
          })
          return null
        })

      loaderPromises.set(cacheKey, execution as Promise<unknown>)
      return execution
    }
  }

  return context
}
`
}
