import { ComponentInstance, ComponentTree, ComponentType, DetectionResult } from '../interfaces'
import { canonicalizeComponentType } from './component-helpers'

export function buildComponentTreeMetadata(components: DetectionResult[]): ComponentTree {
  const componentTypes = [...new Set(components.map(component => component.type))]
  const maxDepth = calculateDetectionMaxDepth(components)

  return {
    components: [],
    metadata: {
      totalComponents: components.length,
      maxDepth,
      componentTypes
    }
  }
}

export function calculateDetectionMaxDepth(components: DetectionResult[], currentDepth = 0): number {
  if (components.length === 0) {
    return currentDepth
  }

  let maxChildDepth = currentDepth
  for (const component of components) {
    if (component.children && component.children.length > 0) {
      const childDepth = calculateDetectionMaxDepth(component.children, currentDepth + 1)
      maxChildDepth = Math.max(maxChildDepth, childDepth)
    }
  }

  return maxChildDepth
}

export function buildHierarchicalTree(components: ComponentInstance[]): ComponentInstance[] {
  const componentMap = new Map(components.map(component => [component.id, component]))
  const rootComponents: ComponentInstance[] = []

  components.forEach(component => {
    if (!component.parentId) {
      rootComponents.push(component)
      return
    }

    const parent = componentMap.get(component.parentId)
    if (!parent) {
      return
    }

    if (!parent.children) {
      parent.children = []
    }

    parent.children.push(component)
  })

  sortTreeByPosition(rootComponents)
  return rootComponents
}

export function sortTreeByPosition(components: ComponentInstance[]): void {
  components.sort((a, b) => a.position - b.position)
  components.forEach(component => {
    if (component.children) {
      sortTreeByPosition(component.children)
    }
  })
}

export function calculatePositions(components: ComponentInstance[]): ComponentInstance[] {
  return components.map((component, index) => ({
    ...component,
    position: index,
    children: component.children ? calculatePositions(component.children) : undefined
  }))
}

export function deduplicateComponents(components: ComponentInstance[]): ComponentInstance[] {
  const seen = new Set<string>()
  const deduplicated: ComponentInstance[] = []

  for (const component of components) {
    const key = `${component.type}-${JSON.stringify(component.props)}`
    if (seen.has(key)) {
      continue
    }

    seen.add(key)
    deduplicated.push({
      ...component,
      children: component.children ? deduplicateComponents(component.children) : undefined
    })
  }

  return deduplicated
}

export function countComponentInstances(components: ComponentInstance[]): number {
  return components.reduce((acc, component) => {
    const childCount = component.children ? countComponentInstances(component.children) : 0
    return acc + 1 + childCount
  }, 0)
}

export function collectComponentInstanceTypes(components: ComponentInstance[]): string[] {
  const types = new Set<string>()

  const collect = (nodes: ComponentInstance[]) => {
    for (const node of nodes) {
      types.add(node.type)
      if (node.children && node.children.length > 0) {
        collect(node.children)
      }
    }
  }

  collect(components)
  return Array.from(types)
}

export function calculateInstanceMaxDepth(components: ComponentInstance[], currentDepth = 0): number {
  if (!components || components.length === 0) {
    return currentDepth
  }

  let maxDepth = currentDepth
  for (const component of components) {
    const depth = calculateInstanceMaxDepth(component.children ?? [], currentDepth + 1)
    maxDepth = Math.max(maxDepth, depth)
  }

  return maxDepth
}

export function buildComponentTypeIndex(componentTypes: ComponentType[]): Map<string, string> {
  const index = new Map<string, string>()
  for (const type of componentTypes) {
    if ((type as any)?.id) {
      const canonical = canonicalizeComponentType(type.type) ?? type.type
      index.set(String((type as any).id), canonical)
    }
  }
  return index
}
