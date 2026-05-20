import { Node, Edge } from 'reactflow'

export interface ValidationResult {
  isValid: boolean
  errors: string[]
  warnings: string[]
}

export interface HierarchyRule {
  parent: string | string[]
  allowedChildren: string[]
  maxDepth?: number
  maxChildren?: number
}

export class HierarchyValidator {
  private rules: Map<string, HierarchyRule> = new Map()
  private maxNestingDepth: number = 5

  constructor(maxDepth: number = 5) {
    this.maxNestingDepth = maxDepth
    this.initializeDefaultRules()
  }

  private initializeDefaultRules() {
    // Page hierarchy rules
    this.addRule('page', {
      parent: ['root', null as any],
      allowedChildren: ['section', 'component', 'page'],
      maxDepth: 3
    })

    // Section hierarchy rules
    this.addRule('section', {
      parent: ['page', 'section'],
      allowedChildren: ['component', 'section'],
      maxDepth: 2
    })

    // Component hierarchy rules
    this.addRule('component', {
      parent: ['page', 'section', 'component'],
      allowedChildren: ['component'],
      maxDepth: 1
    })

    // Global component rules
    this.addRule('global-component', {
      parent: ['page', 'section'],
      allowedChildren: [],
      maxDepth: 0
    })
  }

  addRule(nodeType: string, rule: HierarchyRule) {
    this.rules.set(nodeType, rule)
  }

  validateMove(
    nodeId: string,
    newParentId: string | null,
    nodes: Node[],
    edges: Edge[]
  ): ValidationResult {
    const result: ValidationResult = {
      isValid: true,
      errors: [],
      warnings: []
    }

    const node = nodes.find(n => n.id === nodeId)
    if (!node) {
      result.isValid = false
      result.errors.push('Node not found')
      return result
    }

    // Check for circular dependency
    if (this.wouldCreateCircularDependency(nodeId, newParentId, nodes, edges)) {
      result.isValid = false
      result.errors.push('This move would create a circular dependency')
      return result
    }

    // Check depth constraints
    const newDepth = this.calculateDepth(newParentId, nodes) + 1
    const subtreeDepth = this.calculateSubtreeDepth(nodeId, nodes, edges)
    
    if (newDepth + subtreeDepth > this.maxNestingDepth) {
      result.isValid = false
      result.errors.push(`Maximum nesting depth of ${this.maxNestingDepth} would be exceeded`)
      return result
    }

    // Check parent-child relationship rules
    if (newParentId) {
      const parentNode = nodes.find(n => n.id === newParentId)
      if (parentNode) {
        const parentType = this.getNodeType(parentNode)
        const childType = this.getNodeType(node)
        
        if (!this.isValidParentChild(parentType, childType)) {
          result.isValid = false
          result.errors.push(`${childType} cannot be placed inside ${parentType}`)
          return result
        }

        // Check max children constraint
        const currentChildrenCount = this.getChildrenCount(newParentId, nodes, edges)
        const parentRule = this.rules.get(parentType)
        
        if (parentRule?.maxChildren && currentChildrenCount >= parentRule.maxChildren) {
          result.warnings.push(`Parent already has ${currentChildrenCount} children (max: ${parentRule.maxChildren})`)
        }
      }
    }

    // Check for orphaned components
    const orphans = this.findOrphanedNodes(nodeId, nodes, edges)
    if (orphans.length > 0) {
      result.warnings.push(`This move will orphan ${orphans.length} component(s)`)
    }

    return result
  }

  validateHierarchy(nodes: Node[], edges: Edge[]): ValidationResult {
    const result: ValidationResult = {
      isValid: true,
      errors: [],
      warnings: []
    }

    // Check for cycles
    if (this.hasCycles(nodes, edges)) {
      result.isValid = false
      result.errors.push('Circular dependencies detected in hierarchy')
    }

    // Check depth for all nodes
    nodes.forEach(node => {
      const depth = this.calculateDepth(node.id, nodes)
      if (depth > this.maxNestingDepth) {
        result.errors.push(`Node ${node.data?.label || node.id} exceeds maximum depth`)
        result.isValid = false
      }
    })

    // Check for orphaned nodes
    const orphans = nodes.filter(node => {
      const hasParent = edges.some(edge => edge.target === node.id)
      const isRoot = node.data?.parentId === null || node.data?.parentId === undefined
      return !hasParent && !isRoot && node.id !== 'root'
    })

    if (orphans.length > 0) {
      result.warnings.push(`Found ${orphans.length} orphaned node(s)`)
    }

    // Validate parent-child relationships
    edges.forEach(edge => {
      const parent = nodes.find(n => n.id === edge.source)
      const child = nodes.find(n => n.id === edge.target)
      
      if (parent && child) {
        const parentType = this.getNodeType(parent)
        const childType = this.getNodeType(child)
        
        if (!this.isValidParentChild(parentType, childType)) {
          result.errors.push(`Invalid relationship: ${parentType} -> ${childType}`)
          result.isValid = false
        }
      }
    })

    return result
  }

  private wouldCreateCircularDependency(
    nodeId: string,
    newParentId: string | null,
    nodes: Node[],
    edges: Edge[]
  ): boolean {
    if (!newParentId || nodeId === newParentId) return true

    // Check if newParentId is a descendant of nodeId
    const descendants = this.getDescendants(nodeId, nodes, edges)
    return descendants.includes(newParentId)
  }

  private getDescendants(nodeId: string, nodes: Node[], edges: Edge[]): string[] {
    const descendants: string[] = []
    const queue = [nodeId]
    const visited = new Set<string>()

    while (queue.length > 0) {
      const current = queue.shift()!
      if (visited.has(current)) continue
      visited.add(current)

      const children = edges
        .filter(edge => edge.source === current)
        .map(edge => edge.target)

      descendants.push(...children)
      queue.push(...children)
    }

    return descendants
  }

  private calculateDepth(nodeId: string | null, nodes: Node[]): number {
    if (!nodeId) return 0

    let depth = 0
    let currentId: string | null = nodeId
    const visited = new Set<string>()

    while (currentId) {
      if (visited.has(currentId)) {
        if (process.env.NODE_ENV === 'development') {
        console.warn('Circular reference detected while calculating depth')
        }
        break
      }
      visited.add(currentId)

      const node = nodes.find(n => n.id === currentId)
      if (!node || !node.data?.parentId) break

      depth++
      currentId = node.data.parentId
    }

    return depth
  }

  private calculateSubtreeDepth(nodeId: string, nodes: Node[], edges: Edge[]): number {
    const descendants = this.getDescendants(nodeId, nodes, edges)
    
    if (descendants.length === 0) return 0

    const depths = descendants.map(id => this.calculateDepth(id, nodes))
    return Math.max(...depths) - this.calculateDepth(nodeId, nodes)
  }

  private getNodeType(node: Node): string {
    // Extract type from node data or metadata
    if (node.data?.type) return node.data.type
    if (node.data?.metadata?.pageType) return node.data.metadata.pageType
    if (node.data?.isGlobal) return 'global-component'
    if (node.type) return node.type
    return 'component'
  }

  private isValidParentChild(parentType: string, childType: string): boolean {
    const parentRule = this.rules.get(parentType)
    if (!parentRule) return true // No rule means allow

    return parentRule.allowedChildren.includes(childType)
  }

  private getChildrenCount(parentId: string, nodes: Node[], edges: Edge[]): number {
    return edges.filter(edge => edge.source === parentId).length
  }

  private findOrphanedNodes(nodeId: string, nodes: Node[], edges: Edge[]): string[] {
    const descendants = this.getDescendants(nodeId, nodes, edges)
    
    // Check which descendants would become orphaned
    return descendants.filter(descId => {
      const node = nodes.find(n => n.id === descId)
      return node && !node.data?.isGlobal // Global components can't be orphaned
    })
  }

  private hasCycles(nodes: Node[], edges: Edge[]): boolean {
    const visited = new Set<string>()
    const recursionStack = new Set<string>()

    const hasCycleDFS = (nodeId: string): boolean => {
      visited.add(nodeId)
      recursionStack.add(nodeId)

      const children = edges
        .filter(edge => edge.source === nodeId)
        .map(edge => edge.target)

      for (const childId of children) {
        if (!visited.has(childId)) {
          if (hasCycleDFS(childId)) return true
        } else if (recursionStack.has(childId)) {
          return true
        }
      }

      recursionStack.delete(nodeId)
      return false
    }

    for (const node of nodes) {
      if (!visited.has(node.id)) {
        if (hasCycleDFS(node.id)) return true
      }
    }

    return false
  }

  // Utility method to fix common hierarchy issues
  fixHierarchyIssues(nodes: Node[], edges: Edge[]): {
    nodes: Node[]
    edges: Edge[]
    fixes: string[]
  } {
    const fixes: string[] = []
    const fixedNodes = [...nodes]
    let fixedEdges = [...edges]

    // Remove circular dependencies
    const validation = this.validateHierarchy(nodes, edges)
    if (validation.errors.some(e => e.includes('Circular'))) {
      // Remove edges that create cycles
      const visited = new Set<string>()
      const edgesToRemove: string[] = []

      const findCycles = (nodeId: string, path: string[] = []): void => {
        if (path.includes(nodeId)) {
          // Found a cycle, remove the edge that creates it
          const cycleEdge = fixedEdges.find(e => 
            e.source === path[path.length - 1] && e.target === nodeId
          )
          if (cycleEdge) {
            edgesToRemove.push(cycleEdge.id)
            fixes.push(`Removed circular edge: ${cycleEdge.source} -> ${cycleEdge.target}`)
          }
          return
        }

        visited.add(nodeId)
        const newPath = [...path, nodeId]
        
        const children = fixedEdges
          .filter(e => e.source === nodeId)
          .map(e => e.target)
        
        children.forEach(childId => findCycles(childId, newPath))
      }

      fixedNodes.forEach(node => {
        if (!visited.has(node.id)) {
          findCycles(node.id)
        }
      })

      fixedEdges = fixedEdges.filter(e => !edgesToRemove.includes(e.id))
    }

    // Fix orphaned nodes by connecting them to root
    const orphans = fixedNodes.filter(node => {
      const hasParent = fixedEdges.some(edge => edge.target === node.id)
      const isRoot = node.data?.parentId === null || node.id === 'root'
      return !hasParent && !isRoot
    })

    orphans.forEach(orphan => {
      const newEdge: Edge = {
        id: `e-root-${orphan.id}`,
        source: 'root',
        target: orphan.id,
        type: 'smoothstep'
      }
      fixedEdges.push(newEdge)
      fixes.push(`Connected orphaned node ${orphan.data?.label || orphan.id} to root`)
    })

    return { nodes: fixedNodes, edges: fixedEdges, fixes }
  }
}

// Singleton instance
export const hierarchyValidator = new HierarchyValidator()

export default HierarchyValidator
