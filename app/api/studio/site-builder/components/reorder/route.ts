import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getContentSource, updateContentSource } from '@/lib/utils/content-source'
import { getAuthContext } from '@/lib/auth/context'
import { assertWebsiteOwnership } from '@/lib/auth/ownership'

// Type for component structure in JSON
type ComponentType = {
  id: string
  parentId: string | null
  position: number
  [key: string]: unknown
}

// Request validation schema
const reorderRequestSchema = z.object({
  componentId: z.string(),
  newParentId: z.string().nullable(),
  newPosition: z.number(),
  contentItemId: z.string()
})

export async function POST(request: NextRequest) {
  try {
    // Auth check - always required
    let auth;
    try {
      auth = await getAuthContext(request);
    } catch {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse and validate request body
    const body = await request.json()
    const validation = reorderRequestSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request data', details: validation.error.flatten() },
        { status: 400 }
      )
    }

    const { componentId, newParentId, newPosition, contentItemId } = validation.data

    // Get content item to find websiteId for ownership check
    const page = await prisma.websitePage.findUnique({
      where: { id: contentItemId },
      select: { websiteId: true }
    });
    if (!page) {
      return NextResponse.json({ error: 'Content item not found' }, { status: 404 });
    }
    await assertWebsiteOwnership(prisma as any, auth.accountId, page.websiteId);

    // Start transaction for atomic operation
    const result = await prisma.$transaction(async (tx) => {
      const startTime = Date.now()
      
      // Get content source using shared utility
      const source = await getContentSource(tx, contentItemId)
      const content = source.content

      // Parse the content JSON to get component tree
      const components = (content?.components as ComponentType[]) || []
      
      if (!Array.isArray(components)) {
        throw new Error('Invalid content structure')
      }

      // Find the component to move
      const componentToMove = components.find((c: ComponentType) => c.id === componentId)
      if (!componentToMove) {
        throw new Error('Component not found')
      }

      // Validate hierarchy rules
      if (newParentId) {
        // Check for circular dependency
        const descendants = getDescendants(components, componentId)
        if (descendants.includes(newParentId)) {
          throw new Error('Cannot move component into its own descendant')
        }

        // Check parent exists
        const newParent = components.find((c: ComponentType) => c.id === newParentId)
        if (!newParent) {
          throw new Error('New parent component not found')
        }

        // Check depth constraints
        const newDepth = calculateDepth(components, newParentId) + 1
        const subtreeDepth = calculateSubtreeDepth(components, componentId)
        
        if (newDepth + subtreeDepth > 5) {
          throw new Error('Maximum nesting depth of 5 would be exceeded')
        }
      }

      const oldParentId = componentToMove.parentId
      const oldPosition = componentToMove.position || 0

      // Get siblings at the new position
      const newSiblings = components.filter((c: ComponentType) => 
        c.id !== componentId && c.parentId === newParentId
      ).sort((a: ComponentType, b: ComponentType) => (a.position || 0) - (b.position || 0))

      // If moving to a new parent
      if (oldParentId !== newParentId) {
        // Update positions at new location
        newSiblings.forEach((sibling: ComponentType, index: number) => {
          const targetPosition = index >= newPosition ? index + 1 : index
          sibling.position = targetPosition
        })

        // Update positions at old location
        const oldSiblings = components.filter((c: ComponentType) => 
          c.id !== componentId && c.parentId === oldParentId
        ).sort((a: ComponentType, b: ComponentType) => (a.position || 0) - (b.position || 0))

        oldSiblings.forEach((sibling: ComponentType, index: number) => {
          sibling.position = index
        })

        // Update the component being moved
        componentToMove.parentId = newParentId
        componentToMove.position = newPosition
      } else {
        // Moving within same parent - just reorder
        newSiblings.forEach((sibling: ComponentType) => {
          const siblingPosition = sibling.position || 0
          let newSiblingPosition = siblingPosition
          
          if (oldPosition < newPosition) {
            // Moving down
            if (siblingPosition > oldPosition && siblingPosition <= newPosition) {
              newSiblingPosition = siblingPosition - 1
            }
          } else {
            // Moving up
            if (siblingPosition >= newPosition && siblingPosition < oldPosition) {
              newSiblingPosition = siblingPosition + 1
            }
          }
          
          sibling.position = newSiblingPosition
        })

        componentToMove.position = newPosition
      }

      // Update the content item with the modified component tree
      const updatedContent = {
        ...content,
        components: components
      }
      await updateContentSource(tx, source, updatedContent)
      
      // Log performance metrics
      const totalTime = Date.now() - startTime
      console.log('Reorder completed:', {
        action: 'REORDER_COMPONENT',
        contentItemId,
        model: source.model,
        performance: {
          totalTime: `${totalTime}ms`,
          componentsProcessed: components.length
        },
        metadata: {
          componentId,
          oldParentId,
          newParentId,
          newPosition
        }
      })

      // Get affected component IDs for response
      const affectedComponents = [
        componentId,
        oldParentId,
        newParentId,
        ...newSiblings.map((s: ComponentType) => s.id)
      ].filter(Boolean)

      return {
        updatedComponent: componentToMove,
        updatedStructure: components,
        affectedComponents
      }
    })

    return NextResponse.json({
      success: true,
      updatedStructure: result.updatedStructure,
      affectedComponents: result.affectedComponents
    })

  } catch (error) {
    console.error('Reorder error:', error)
    
    if (error instanceof Error) {
      return NextResponse.json(
        { error: error.message },
        { status: error.message.includes('not found') ? 404 : 400 }
      )
    }
    
    return NextResponse.json(
      { error: 'Failed to reorder component' },
      { status: 500 }
    )
  }
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