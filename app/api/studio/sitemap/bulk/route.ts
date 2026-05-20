import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@/lib/generated/prisma';
import { siteStructureService } from '@/lib/services/site-structure/site-structure-service';
import { z } from 'zod';
import { getAuthContext } from '@/lib/auth/context';
import { assertWebsiteOwnership } from '@/lib/auth/ownership';

// Input validation schemas with enhanced security
const MAX_METADATA_SIZE = 10000; // 10KB limit
const MAX_BATCH_SIZE = 50; // Limit batch operations to prevent DoS

// Helper function to validate metadata
function validateMetadata(metadata: unknown): boolean {
  if (!metadata) return true;
  const jsonStr = JSON.stringify(metadata);
  return jsonStr.length <= MAX_METADATA_SIZE;
}

const BulkDeleteSchema = z.object({
  type: z.literal('DELETE'),
  websiteId: z.string().min(1).max(100),
  nodeIds: z.array(z.string().max(100)).min(1).max(MAX_BATCH_SIZE)
});

const BulkUpdateSchema = z.object({
  type: z.literal('UPDATE'),
  websiteId: z.string().min(1).max(100),
  updates: z.array(z.object({
    nodeId: z.string().max(100),
    data: z.object({
      status: z.string().max(50).optional(),
      weight: z.number().min(-1000000).max(1000000).optional(),
      metadata: z.record(z.unknown()).optional().refine(
        validateMetadata,
        { message: `Metadata exceeds size limit (${MAX_METADATA_SIZE} bytes)` }
      )
    })
  })).min(1).max(MAX_BATCH_SIZE)
});

const BulkRequestSchema = z.union([BulkDeleteSchema, BulkUpdateSchema]);

/**
 * POST /api/studio/sitemap/bulk
 * Process bulk operations on multiple nodes
 */
export async function POST(request: NextRequest) {
  // Auth check - always required
  let auth;
  try {
    auth = await getAuthContext(request);
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();

    // Validate input
    const validation = BulkRequestSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request data', details: validation.error.flatten() },
        { status: 400 }
      );
    }
    
    const data = validation.data;

    // Verify ownership of the website
    try {
      await assertWebsiteOwnership(prisma as any, auth.accountId, data.websiteId);
    } catch {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (data.type === 'DELETE') {
      // Bulk delete operation
      const { nodeIds } = data;
      
      const results = await prisma.$transaction(
        async () => {
          const succeeded: string[] = [];
          const failed: Array<{ id: string; error: string }> = [];
          
          for (const nodeId of nodeIds) {
            try {
              // Use the service for proper cascade handling
              await siteStructureService.delete(nodeId);
              succeeded.push(nodeId);
            } catch (error) {
              console.error(`Failed to delete node ${nodeId}:`, error);
              // Sanitize error message for client
              let clientError = 'Delete failed';
              if (error instanceof Error && error.message.includes('not found')) {
                clientError = 'Node not found';
              }
              failed.push({
                id: nodeId,
                error: clientError
              });
            }
          }
          
          return { succeeded, failed };
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
          maxWait: 5000,
          timeout: 10000 // Reduced from 30s to 10s to prevent DoS
        }
      );
      
      return NextResponse.json({
        type: 'DELETE',
        totalRequested: nodeIds.length,
        totalSucceeded: results.succeeded.length,
        totalFailed: results.failed.length,
        succeeded: results.succeeded,
        failed: results.failed,
        timestamp: new Date().toISOString()
      });
      
    } else if (data.type === 'UPDATE') {
      // Bulk update operation
      const { updates } = data;
      
      const results = await prisma.$transaction(
        async () => {
          const succeeded: string[] = [];
          const failed: Array<{ id: string; error: string }> = [];
          
          for (const update of updates) {
            try {
              // Update the node using the service
              await siteStructureService.update(update.nodeId, {
                weight: update.data.weight
              });
              
              // If there's content-related updates, handle separately
              if (update.data.status || update.data.metadata) {
                const node = await prisma.websiteStructure.findUnique({
                  where: { id: update.nodeId }
                });
                
                if (node?.websitePageId) {
                  await prisma.websitePage.update({
                    where: { id: node.websitePageId },
                    data: {
                      status: update.data.status,
                      metadata: update.data.metadata as Prisma.InputJsonValue
                    }
                  });
                }
              }
              
              succeeded.push(update.nodeId);
            } catch (error) {
              console.error(`Failed to update node ${update.nodeId}:`, error);
              // Sanitize error message for client
              let clientError = 'Update failed';
              if (error instanceof Error) {
                if (error.message.includes('not found')) {
                  clientError = 'Node not found';
                } else if (error.message.includes('duplicate')) {
                  clientError = 'Duplicate value';
                }
              }
              failed.push({
                id: update.nodeId,
                error: clientError
              });
            }
          }
          
          return { succeeded, failed };
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
          maxWait: 5000,
          timeout: 10000 // Reduced from 30s to 10s to prevent DoS
        }
      );
      
      return NextResponse.json({
        type: 'UPDATE',
        totalRequested: updates.length,
        totalSucceeded: results.succeeded.length,
        totalFailed: results.failed.length,
        succeeded: results.succeeded,
        failed: results.failed,
        timestamp: new Date().toISOString()
      });
    }
    
  } catch (error) {
    console.error('Bulk operation failed:', error);
    
    // Handle Prisma-specific errors
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2034') {
        return NextResponse.json(
          { error: 'Transaction conflict - please retry', retryable: true },
          { status: 409 }
        );
      }
    }
    
    return NextResponse.json(
      { error: 'Failed to process bulk operation' },
      { status: 500 }
    );
  }
}