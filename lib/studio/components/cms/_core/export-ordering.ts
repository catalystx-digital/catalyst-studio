/**
 * Export Ordering Utility
 *
 * Provides topological sorting for component exports to ensure
 * dependent components are exported in the correct order.
 *
 * Sub-components must be exported BEFORE parent components that use them.
 */

import { ComponentType } from './types'
import { getAllDefinitions } from './definition-loader'

/**
 * Component dependency map
 * Key = parent component, Value = sub-components it uses
 *
 * This map defines which components depend on other components.
 * Sub-components must be exported before their parents.
 */
const COMPONENT_DEPENDENCIES: Record<string, string[]> = {
  [ComponentType.Accordion]: [ComponentType.AccordionItem],
  [ComponentType.Tabs]: [ComponentType.TabItem],
  [ComponentType.CardGrid]: [ComponentType.CardItem],
  [ComponentType.FeatureGrid]: [ComponentType.FeatureItem],
  [ComponentType.Testimonials]: [ComponentType.TestimonialItem],
  [ComponentType.TeamGrid]: [ComponentType.TeamMember],
  [ComponentType.Timeline]: [ComponentType.TimelineEvent],
  [ComponentType.NavBar]: [ComponentType.NavMenuItem, ComponentType.MobileMenu],
  [ComponentType.Footer]: [ComponentType.NavMenuItem, ComponentType.SocialLinkItem],
  [ComponentType.SideMenu]: [ComponentType.NavMenuItem],
  [ComponentType.SidebarNav]: [ComponentType.NavMenuItem],
  [ComponentType.BlogList]: [ComponentType.BlogCard],
  [ComponentType.RelatedPosts]: [ComponentType.BlogCard],
}

/**
 * Topologically sort component types for export
 * Uses Kahn's algorithm to ensure sub-components are exported before their parents
 *
 * @param componentTypes - Array of component types to sort
 * @returns Sorted array with dependencies first
 */
export function sortForExport(componentTypes: string[]): string[] {
  if (componentTypes.length === 0) {
    return []
  }

  // Create a set for quick lookup
  const typeSet = new Set(componentTypes)

  // Build dependency graph (only for types we're sorting)
  const graph = new Map<string, string[]>() // node -> dependencies (what it depends on)
  const inDegree = new Map<string, number>() // node -> count of components that depend on it

  // Initialize all types
  for (const type of componentTypes) {
    graph.set(type, [])
    inDegree.set(type, 0)
  }

  // Build edges (reverse the dependencies)
  // If A depends on B, then B must come before A
  // So we create edge B -> A
  for (const type of componentTypes) {
    const dependencies = COMPONENT_DEPENDENCIES[type] || []

    for (const dep of dependencies) {
      // Only add edge if both nodes are in our set
      if (typeSet.has(dep)) {
        // dep must come before type
        // So add edge: dep -> type
        if (!graph.has(dep)) {
          graph.set(dep, [])
          inDegree.set(dep, 0)
        }

        const dependents = graph.get(dep) || []
        dependents.push(type)
        graph.set(dep, dependents)

        // Increment in-degree of type (it has a dependency)
        inDegree.set(type, (inDegree.get(type) || 0) + 1)
      }
    }
  }

  // Kahn's algorithm
  const queue: string[] = []
  const result: string[] = []

  // Start with nodes that have no dependencies
  for (const [type, degree] of inDegree.entries()) {
    if (degree === 0) {
      queue.push(type)
    }
  }

  // Process queue
  while (queue.length > 0) {
    const current = queue.shift()!
    result.push(current)

    // For each dependent of current
    const dependents = graph.get(current) || []
    for (const dependent of dependents) {
      // Reduce in-degree
      const newDegree = (inDegree.get(dependent) || 1) - 1
      inDegree.set(dependent, newDegree)

      // If all dependencies satisfied, add to queue
      if (newDegree === 0) {
        queue.push(dependent)
      }
    }
  }

  // Check for circular dependencies
  if (result.length !== componentTypes.length) {
    if (process.env.NODE_ENV === 'development') {
    console.warn(
      '[export-ordering] Circular dependency detected. Some components may be in wrong order.',
      {
        expected: componentTypes.length,
        sorted: result.length,
        missing: componentTypes.filter(t => !result.includes(t))
      }
    )
    }

    // Add remaining types to end (fallback)
    const remainingTypes = componentTypes.filter(t => !result.includes(t))
    result.push(...remainingTypes)
  }

  return result
}

/**
 * Get export order for all components
 * @returns Array of all component types in correct export order
 */
export function getExportOrder(): string[] {
  const definitions = getAllDefinitions()
  const allTypes = definitions.map(def => def.type as string)
  return sortForExport(allTypes)
}

/**
 * Get dependency information for a component
 * @param componentType - Component type to check
 * @returns Array of component types this component depends on
 */
export function getDependencies(componentType: string): string[] {
  return COMPONENT_DEPENDENCIES[componentType] || []
}

/**
 * Get reverse dependency information (dependents)
 * @param componentType - Component type to check
 * @returns Array of component types that depend on this component
 */
export function getDependents(componentType: string): string[] {
  const dependents: string[] = []

  for (const [parent, deps] of Object.entries(COMPONENT_DEPENDENCIES)) {
    if (deps.includes(componentType)) {
      dependents.push(parent)
    }
  }

  return dependents
}

/**
 * Check if a component type is a sub-component (used by other components)
 * @param componentType - Component type to check
 * @returns true if component is used as a dependency by other components
 */
export function isSubComponent(componentType: string): boolean {
  return getDependents(componentType).length > 0
}

/**
 * Validate dependency graph for issues
 * @returns Object with validation results
 */
export function validateDependencies(): {
  valid: boolean
  circularDependencies: string[][]
  missingTypes: string[]
} {
  const result = {
    valid: true,
    circularDependencies: [] as string[][],
    missingTypes: [] as string[]
  }

  // Check for undefined component types in dependencies
  const allComponentTypes = new Set(Object.values(ComponentType))

  for (const [parent, deps] of Object.entries(COMPONENT_DEPENDENCIES)) {
    if (!allComponentTypes.has(parent as ComponentType)) {
      result.valid = false
      result.missingTypes.push(parent)
    }

    for (const dep of deps) {
      if (!allComponentTypes.has(dep as ComponentType)) {
        result.valid = false
        result.missingTypes.push(dep)
      }
    }
  }

  // Check for circular dependencies using DFS
  const visited = new Set<string>()
  const recursionStack = new Set<string>()

  function hasCycle(node: string, path: string[]): boolean {
    visited.add(node)
    recursionStack.add(node)
    path.push(node)

    const dependencies = COMPONENT_DEPENDENCIES[node] || []

    for (const dep of dependencies) {
      if (!visited.has(dep)) {
        if (hasCycle(dep, [...path])) {
          return true
        }
      } else if (recursionStack.has(dep)) {
        // Found a cycle
        result.circularDependencies.push([...path, dep])
        result.valid = false
        return true
      }
    }

    recursionStack.delete(node)
    return false
  }

  for (const type of Object.keys(COMPONENT_DEPENDENCIES)) {
    if (!visited.has(type)) {
      hasCycle(type, [])
    }
  }

  return result
}
