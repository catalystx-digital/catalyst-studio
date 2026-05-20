// Provider-agnostic TypeDependencyPlanner
// Builds a dependency plan (children-before-parents) based on detection inputs
// and a compiled schema-like index. No provider-specific imports.

export type ValueType =
  | 'string'
  | 'number'
  | 'boolean'
  | 'richText'
  | 'url'
  | 'contentReference'
  | 'array<string>'
  | 'array<contentReference>'

export interface CompiledField {
  name: string
  valueType: ValueType
  required?: boolean
  description?: string
}

export interface CompiledType {
  key: string
  name: string
  baseType: 'page' | 'component'
  fields: CompiledField[]
  mayContainTypes?: string[]
}

export interface CompiledTypeIndex {
  byKey: Record<string, CompiledType>
  all: CompiledType[]
}

export type DetectionInput = {
  // Parent (referencing) content item id and type
  itemId: string
  itemType?: string
  // JSON path within item.content that produced a detection
  path: string
  // FieldShapeDetector classification value
  classification: string
  // Any referenced child content item ids found at this path
  refIds?: string[]
}

export type PlanNode = {
  id: string
  type?: string
  // Direct dependencies for this node (child items that must be created first)
  deps: string[]
  // Example path that led to the dependency (first one encountered)
  path?: string
  // Topological order index (lower executes first)
  order: number
}

export type PlanResult =
  | { kind: 'ok'; nodes: PlanNode[] }
  | { kind: 'error'; error: { type: 'CycleDetected'; cycles: string[][] } }

export class TypeDependencyPlanner {
  // Minimal API as required by story
  planDependencies(detections: DetectionInput[], compiled: CompiledTypeIndex): PlanResult {
    // Build node set from detected parent item ids
    const baseIds = detections.map(d => d.itemId)
    const childIds = detections.flatMap(d => Array.isArray(d.refIds) ? d.refIds : [])
    const nodeIds = Array.from(new Set([...baseIds, ...childIds]))
    const edges = new Map<string, Set<string>>()
    const indegree = new Map<string, number>()
    const nodeMeta = new Map<string, { type?: string; path?: string }>()

    for (const id of nodeIds) {
      edges.set(id, new Set())
      indegree.set(id, 0)
    }

    // Build edges: parent item -> child items
    for (const d of detections) {
      if (!d || !d.itemId) continue
      if (!nodeMeta.has(d.itemId)) nodeMeta.set(d.itemId, { type: d.itemType, path: d.path })
      // Consider only content-reference oriented classifications
      const cls = (d.classification || '').toLowerCase()
      if (!cls.includes('content_reference')) continue
      const refs = Array.isArray(d.refIds) ? d.refIds.filter(Boolean) : []
      for (const child of refs) {
        if (!edges.has(d.itemId)) {
          edges.set(d.itemId, new Set())
          indegree.set(d.itemId, indegree.get(d.itemId) ?? 0)
        }
        // Track only edges to nodes we know about; ignore unknown children
        if (nodeIds.includes(child)) {
          if (!edges.get(d.itemId)!.has(child)) {
            edges.get(d.itemId)!.add(child)
            indegree.set(child, (indegree.get(child) || 0) + 1)
          }
        }
      }
    }

    // Kahn's algorithm, but we want children-first execution.
    // Standard topological order gives parents before children when edges point parent->child.
    // For children-first, we can simply reverse the final order or invert edges.
    const queue: string[] = []
    indegree.forEach((deg, n) => { if (deg === 0) queue.push(n) })
    const topo: string[] = []
    while (queue.length) {
      const n = queue.shift()!
      topo.push(n)
      for (const m of edges.get(n) || []) {
        indegree.set(m, (indegree.get(m) || 0) - 1)
        if ((indegree.get(m) || 0) === 0) queue.push(m)
      }
    }

    if (topo.length !== nodeIds.length) {
      // Cycle detected. Best-effort: return involved nodes as a single cycle bucket
      const remaining = nodeIds.filter(n => !topo.includes(n))
      return { kind: 'error', error: { type: 'CycleDetected', cycles: [remaining] } }
    }

    // Reverse to get children-before-parents
    const execution = topo.reverse()
    const orderMap = new Map<string, number>()
    execution.forEach((id, idx) => orderMap.set(id, idx))

    // Build PlanNode list
    const nodes: PlanNode[] = execution.map(id => ({
      id,
      type: nodeMeta.get(id)?.type,
      deps: Array.from(edges.get(id) || []),
      path: nodeMeta.get(id)?.path,
      order: orderMap.get(id) || 0
    }))

    return { kind: 'ok', nodes }
  }
}

export default TypeDependencyPlanner
