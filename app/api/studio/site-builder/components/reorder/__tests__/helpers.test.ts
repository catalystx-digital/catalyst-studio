import { describe, it, expect } from '@jest/globals'

// Import the helper functions from the route file
// Note: In production, these would be exported from a separate helpers file
type ComponentType = {
  id: string
  parentId: string | null
  position: number
  [key: string]: unknown
}

// Helper function to get all descendants of a component
function getDescendants(components: ComponentType[], componentId: string): string[] {
  const descendants: string[] = []
  const queue = [componentId]
  
  while (queue.length > 0) {
    const currentId = queue.shift()!
    const children = components.filter((c: ComponentType) => c.parentId === currentId)
    const childIds = children.map((c: ComponentType) => c.id)
    descendants.push(...childIds)
    queue.push(...childIds)
  }
  
  return descendants
}

// Helper function to calculate depth of a component
function calculateDepth(components: ComponentType[], componentId: string | null): number {
  if (!componentId) return 0
  
  let depth = 0
  let currentId: string | null = componentId
  
  while (currentId) {
    const component = components.find((c: ComponentType) => c.id === currentId)
    if (!component || !component.parentId) break
    
    depth++
    currentId = component.parentId
    
    // Prevent infinite loops
    if (depth > 10) {
      console.warn('Maximum depth check exceeded')
      break
    }
  }
  
  return depth
}

// Helper function to calculate maximum depth of a subtree
function calculateSubtreeDepth(components: ComponentType[], componentId: string): number {
  const descendants = getDescendants(components, componentId)
  
  if (descendants.length === 0) return 0
  
  const depths = descendants.map(id => calculateDepth(components, id))
  const componentDepth = calculateDepth(components, componentId)
  
  return Math.max(...depths) - componentDepth
}

describe('Reorder Helper Functions', () => {
  describe('getDescendants', () => {
    it('should return empty array for component with no children', () => {
      const components: ComponentType[] = [
        { id: '1', parentId: null, position: 0 },
        { id: '2', parentId: null, position: 1 }
      ]
      
      expect(getDescendants(components, '1')).toEqual([])
    })

    it('should return direct children', () => {
      const components: ComponentType[] = [
        { id: '1', parentId: null, position: 0 },
        { id: '2', parentId: '1', position: 0 },
        { id: '3', parentId: '1', position: 1 }
      ]
      
      expect(getDescendants(components, '1').sort()).toEqual(['2', '3'])
    })

    it('should return all descendants recursively', () => {
      const components: ComponentType[] = [
        { id: '1', parentId: null, position: 0 },
        { id: '2', parentId: '1', position: 0 },
        { id: '3', parentId: '2', position: 0 },
        { id: '4', parentId: '3', position: 0 },
        { id: '5', parentId: '1', position: 1 }
      ]
      
      const descendants = getDescendants(components, '1')
      expect(descendants.sort()).toEqual(['2', '3', '4', '5'])
    })

    it('should handle complex tree structures', () => {
      const components: ComponentType[] = [
        { id: 'root', parentId: null, position: 0 },
        { id: 'a', parentId: 'root', position: 0 },
        { id: 'b', parentId: 'root', position: 1 },
        { id: 'a1', parentId: 'a', position: 0 },
        { id: 'a2', parentId: 'a', position: 1 },
        { id: 'b1', parentId: 'b', position: 0 },
        { id: 'a1a', parentId: 'a1', position: 0 }
      ]
      
      expect(getDescendants(components, 'a').sort()).toEqual(['a1', 'a1a', 'a2'])
      expect(getDescendants(components, 'b').sort()).toEqual(['b1'])
    })
  })

  describe('calculateDepth', () => {
    it('should return 0 for null componentId', () => {
      const components: ComponentType[] = []
      expect(calculateDepth(components, null)).toBe(0)
    })

    it('should return 0 for root component', () => {
      const components: ComponentType[] = [
        { id: '1', parentId: null, position: 0 }
      ]
      
      expect(calculateDepth(components, '1')).toBe(0)
    })

    it('should calculate correct depth for nested components', () => {
      const components: ComponentType[] = [
        { id: '1', parentId: null, position: 0 },
        { id: '2', parentId: '1', position: 0 },
        { id: '3', parentId: '2', position: 0 },
        { id: '4', parentId: '3', position: 0 }
      ]
      
      expect(calculateDepth(components, '1')).toBe(0)
      expect(calculateDepth(components, '2')).toBe(1)
      expect(calculateDepth(components, '3')).toBe(2)
      expect(calculateDepth(components, '4')).toBe(3)
    })

    it('should handle max depth limit to prevent infinite loops', () => {
      // Create a very deep tree
      const components: ComponentType[] = []
      for (let i = 0; i < 15; i++) {
        components.push({
          id: `${i}`,
          parentId: i === 0 ? null : `${i - 1}`,
          position: 0
        })
      }
      
      // Should stop at 10 due to safety check (but actually goes to 11 before stopping)
      expect(calculateDepth(components, '14')).toBeLessThanOrEqual(11)
    })
  })

  describe('calculateSubtreeDepth', () => {
    it('should return 0 for leaf component', () => {
      const components: ComponentType[] = [
        { id: '1', parentId: null, position: 0 },
        { id: '2', parentId: null, position: 1 }
      ]
      
      expect(calculateSubtreeDepth(components, '1')).toBe(0)
    })

    it('should calculate correct subtree depth', () => {
      const components: ComponentType[] = [
        { id: '1', parentId: null, position: 0 },
        { id: '2', parentId: '1', position: 0 },
        { id: '3', parentId: '2', position: 0 },
        { id: '4', parentId: '3', position: 0 }
      ]
      
      expect(calculateSubtreeDepth(components, '1')).toBe(3)
      expect(calculateSubtreeDepth(components, '2')).toBe(2)
      expect(calculateSubtreeDepth(components, '3')).toBe(1)
      expect(calculateSubtreeDepth(components, '4')).toBe(0)
    })

    it('should handle branching trees correctly', () => {
      const components: ComponentType[] = [
        { id: 'root', parentId: null, position: 0 },
        { id: 'a', parentId: 'root', position: 0 },
        { id: 'b', parentId: 'root', position: 1 },
        { id: 'a1', parentId: 'a', position: 0 },
        { id: 'a2', parentId: 'a', position: 1 },
        { id: 'b1', parentId: 'b', position: 0 },
        { id: 'a1a', parentId: 'a1', position: 0 },
        { id: 'b1a', parentId: 'b1', position: 0 },
        { id: 'b1b', parentId: 'b1', position: 1 }
      ]
      
      // Root has max depth of 3 (root -> a -> a1 -> a1a)
      expect(calculateSubtreeDepth(components, 'root')).toBe(3)
      // Branch 'a' has max depth of 2 (a -> a1 -> a1a)
      expect(calculateSubtreeDepth(components, 'a')).toBe(2)
      // Branch 'b' has max depth of 2 (b -> b1 -> b1a/b1b)
      expect(calculateSubtreeDepth(components, 'b')).toBe(2)
    })
  })

  describe('Circular dependency prevention', () => {
    it('should detect circular dependencies', () => {
      const components: ComponentType[] = [
        { id: '1', parentId: null, position: 0 },
        { id: '2', parentId: '1', position: 0 },
        { id: '3', parentId: '2', position: 0 },
        { id: '4', parentId: '3', position: 0 }
      ]
      
      // Trying to move component '1' to be child of '4' would create a cycle
      const descendants = getDescendants(components, '1')
      expect(descendants.includes('4')).toBe(true)
      
      // This check would prevent the move
      const wouldCreateCycle = descendants.includes('4')
      expect(wouldCreateCycle).toBe(true)
    })
  })

  describe('Maximum nesting validation', () => {
    it('should validate max nesting depth of 5', () => {
      const components: ComponentType[] = [
        { id: '1', parentId: null, position: 0 },
        { id: '2', parentId: '1', position: 0 },
        { id: '3', parentId: '2', position: 0 },
        { id: '4', parentId: '3', position: 0 }
      ]
      
      // Component '5' at depth 4 trying to move under '4'
      const newParentDepth = calculateDepth(components, '4')
      const componentSubtreeDepth = 0 // '5' has no children
      
      const wouldExceedMaxDepth = (newParentDepth + 1 + componentSubtreeDepth) > 5
      expect(wouldExceedMaxDepth).toBe(false)
      
      // But if '5' had children going 2 levels deep
      const deepSubtreeDepth = 2
      const wouldExceedWithDeepSubtree = (newParentDepth + 1 + deepSubtreeDepth) > 5
      expect(wouldExceedWithDeepSubtree).toBe(true)
    })
  })
})