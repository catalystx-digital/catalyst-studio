import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getContentSource, updateContentSource } from '@/lib/utils/content-source'
import { getAuthContext } from '@/lib/auth/context'
import { assertWebsiteOwnership } from '@/lib/auth/ownership'

// Request validation schema
const bulkDeleteRequestSchema = z.object({
  componentIds: z.array(z.string()).min(1),
  contentItemId: z.string(),
  confirmDeletion: z.boolean()
})

export async function DELETE(request: NextRequest) {
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
    const validation = bulkDeleteRequestSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request data', details: validation.error.flatten() },
        { status: 400 }
      )
    }

    const { componentIds, contentItemId, confirmDeletion } = validation.data

    // Get content item to find websiteId for ownership check
    const page = await prisma.websitePage.findUnique({
      where: { id: contentItemId },
      select: { websiteId: true }
    });
    if (!page) {
      return NextResponse.json({ error: 'Content item not found' }, { status: 404 });
    }
    await assertWebsiteOwnership(prisma as any, auth.accountId, page.websiteId);

    if (!confirmDeletion) {
      return NextResponse.json(
        { error: 'Deletion must be confirmed' },
        { status: 400 }
      )
    }

    // Start transaction for atomic operation
    const result = await prisma.$transaction(async (tx) => {
      const startTime = Date.now()
      
      // Get content source using shared utility
      const source = await getContentSource(tx, contentItemId)
      const content = source.content

      // Parse the content JSON to get component tree
      const components = (content?.components as Record<string, unknown>[]) || []
      
      if (!Array.isArray(components)) {
        throw new Error('Invalid content structure')
      }

      // Find all components to delete and their descendants
      const allIdsToDelete = new Set(componentIds)
      const orphanedComponents: string[] = []
      
      // Helper function to find all descendants
      const findDescendants = (parentIds: string[]) => {
        const children = components.filter((c: Record<string, unknown>) => 
          parentIds.includes(c.parentId as string)
        )
        const childIds = children.map((c: Record<string, unknown>) => c.id as string)
        childIds.forEach((id: string) => allIdsToDelete.add(id))
        if (childIds.length > 0) {
          findDescendants(childIds)
        }
      }
      
      // Find all descendants of components to delete
      findDescendants(Array.from(allIdsToDelete))

      // Note: Global component usage checks removed as globalComponentUsage table doesn't exist
      // Components within pages are self-contained in the JSON structure

      // Find orphaned components (whose parents are being deleted but they aren't selected)
      components.forEach((comp: Record<string, unknown>) => {
        if (!allIdsToDelete.has(comp.id as string) && 
            comp.parentId && 
            allIdsToDelete.has(comp.parentId as string)) {
          orphanedComponents.push(comp.id as string)
          // Set orphaned components to root level
          comp.parentId = null
        }
      })

      // Remove deleted components from the array
      const remainingComponents = components.filter((c: Record<string, unknown>) => 
        !allIdsToDelete.has(c.id as string)
      )

      // Reindex positions for components at each level
      const componentsByParent = new Map<string | null, Record<string, unknown>[]>()
      remainingComponents.forEach((comp: Record<string, unknown>) => {
        const parentId = (comp.parentId as string) || null
        if (!componentsByParent.has(parentId)) {
          componentsByParent.set(parentId, [])
        }
        componentsByParent.get(parentId)!.push(comp)
      })

      // Sort and reindex positions
      componentsByParent.forEach((siblings) => {
        siblings.sort((a: Record<string, unknown>, b: Record<string, unknown>) => ((a.position as number) || 0) - ((b.position as number) || 0))
        siblings.forEach((sibling: Record<string, unknown>, index: number) => {
          sibling.position = index
        })
      })

      // Update the content item with the modified component tree
      const updatedContent = {
        ...content,
        components: remainingComponents
      }
      await updateContentSource(tx, source, updatedContent)

      // Note: Global component associations removed as globalComponentUsage table doesn't exist

      // Log deletion for future audit capability
      const totalTime = Date.now() - startTime
      console.log('Bulk delete completed:', {
        userId,
        action: 'BULK_DELETE_COMPONENTS',
        contentItemId,
        model: source.model,
        performance: {
          totalTime: `${totalTime}ms`,
          componentsProcessed: components.length,
          componentsDeleted: allIdsToDelete.size
        },
        metadata: {
          deletedCount: allIdsToDelete.size,
          deletedIds: Array.from(allIdsToDelete),
          orphanedComponents
        }
      })

      return {
        success: true,
        deletedCount: allIdsToDelete.size,
        orphanedComponents,
        errors: []
      }
    })

    return NextResponse.json(result)

  } catch (error) {
    console.error('Bulk delete error:', error)
    
    if (error instanceof Error) {
      return NextResponse.json(
        { error: error.message },
        { status: error.message.includes('not found') ? 404 : 400 }
      )
    }
    
    return NextResponse.json(
      { error: 'Failed to delete components' },
      { status: 500 }
    )
  }
}

// OPTIONS handler for CORS preflight
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Methods': 'DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  })
}