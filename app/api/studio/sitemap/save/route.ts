import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@/lib/generated/prisma';
import { siteStructureService } from '@/lib/services/site-structure/site-structure-service';
import { pageOrchestrator } from '@/lib/services/site-structure/page-orchestrator';
import { z } from 'zod';
import { isHomeLike, isHomeNode } from '@/lib/studio/utils/home-page-utils';
import { getAuthContext } from '@/lib/auth/context';
import { assertWebsiteOwnership } from '@/lib/auth/ownership';
import { unifiedLayoutService } from '@/lib/studio/services/layout/unified-layout-service';
import { calculateLevelHeight } from '@/lib/studio/constants/layout-constants';
import { redirectService } from '@/lib/services/redirect-service';
import { studioEventBus, type StudioEventRecord } from '@/lib/studio/activity/studio-event-bus';

// Input validation schemas with enhanced security
const MAX_METADATA_SIZE = 100000; // 100KB limit for metadata (imported pages can be large)
const MAX_PROPS_SIZE = 100000; // 100KB limit for component props (navbars, carousels have large props)
const MAX_JSON_DEPTH = 10; // Maximum nesting depth (complex components need deeper nesting)

// Helper function to check JSON depth
function checkJSONDepth(obj: unknown, depth = 0): boolean {
  if (depth > MAX_JSON_DEPTH) return false;
  if (typeof obj !== 'object' || obj === null) return true;
  
  for (const value of Object.values(obj)) {
    if (!checkJSONDepth(value, depth + 1)) return false;
  }
  return true;
}

// Secure metadata schema with size and depth validation
const SecureMetadataSchema = z.record(z.unknown()).optional().refine(
  (data) => {
    if (!data) return true;
    const jsonStr = JSON.stringify(data);
    return jsonStr.length <= MAX_METADATA_SIZE && checkJSONDepth(data);
  },
  { message: `Metadata exceeds size limit (${MAX_METADATA_SIZE} bytes) or depth limit (${MAX_JSON_DEPTH})` }
);

// Secure props schema for components
const SecurePropsSchema = z.record(z.unknown()).optional().refine(
  (data) => {
    if (!data) return true;
    const jsonStr = JSON.stringify(data);
    return jsonStr.length <= MAX_PROPS_SIZE && checkJSONDepth(data);
  },
  { message: `Props exceed size limit (${MAX_PROPS_SIZE} bytes) or depth limit (${MAX_JSON_DEPTH})` }
);

// Content schema for component content (can be any structure)
const SecureContentSchema = z.unknown().optional().refine(
  (data) => {
    if (!data) return true;
    const jsonStr = JSON.stringify(data);
    return jsonStr.length <= MAX_METADATA_SIZE && checkJSONDepth(data);
  },
  { message: `Content exceeds size limit (${MAX_METADATA_SIZE} bytes) or depth limit (${MAX_JSON_DEPTH})` }
);

// Full component instance schema matching ComponentData interface
const ComponentInstanceSchema = z.object({
  id: z.string().max(100),
  type: z.string().max(100),
  props: SecurePropsSchema,
  content: SecureContentSchema,
  styles: z.record(z.unknown()).optional(),
  metadata: z.record(z.unknown()).optional(),
  parentId: z.string().nullable().optional(),
  position: z.number().optional(),
  globalComponentId: z.string().optional(),
}).passthrough(); // Allow additional properties for flexibility

const NodeDataSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  slug: z.string().regex(/^[a-z0-9-]+$/i).max(255).optional(),
  parentId: z.string().nullable().optional(),
  weight: z.number().int().min(-1000000).max(1000000).optional(),
  contentTypeId: z.string().optional(),
  contentTypeCategory: z.enum(['page', 'component', 'folder']).optional(),
  components: z.array(
    z.union([
      z.string().max(100), // Simple string for component names
      ComponentInstanceSchema // Full component instance objects
    ])
  ).max(100).optional(), // Limit to 100 components per page
  metadata: SecureMetadataSchema,
  // Redirect fields
  redirectUrl: z.string().max(2000).optional(),
  redirectType: z.number().int().refine((val) => val === 301 || val === 302, {
    message: 'Redirect type must be 301 or 302'
  }).optional(),
  showInNav: z.boolean().optional(),
  navLabel: z.string().max(255).optional(),
  openInNewTab: z.boolean().optional()
});

type NodeData = z.infer<typeof NodeDataSchema>;

function isHomeCreationRequest(data: NodeData | undefined): boolean {
  if (!data) return false;

  return isHomeNode({
    title: data.title,
    slug: data.slug,
    metadata: data.metadata
  });
}

interface HomePageLookupOptions {
  excludeStructureId?: string;
  excludePageId?: string;
}

async function hasExistingHomePage(
  websiteId: string,
  options: HomePageLookupOptions = {}
): Promise<boolean> {
  const structures = await prisma.websiteStructure.findMany({
    where: { websiteId },
    select: {
      id: true,
      slug: true,
      fullPath: true,
      websitePage: {
        select: {
          id: true,
          title: true,
          metadata: true
        }
      }
    }
  });

  const hasHomeInStructure = structures.some((structure) => {
    if (options.excludeStructureId && structure.id === options.excludeStructureId) {
      return false;
    }

    if (isHomeNode({
      slug: structure.slug,
      title: structure.websitePage?.title,
      metadata: structure.websitePage?.metadata
    })) {
      return true;
    }

    if (isHomeLike(structure.fullPath, { allowEmpty: true })) {
      return true;
    }

    return false;
  });

  if (hasHomeInStructure) {
    return true;
  }

  const pages = await prisma.websitePage.findMany({
    where: { websiteId },
    select: { id: true, title: true, metadata: true }
  });

  return pages.some((page) => {
    if (options.excludePageId && page.id === options.excludePageId) {
      return false;
    }

    return isHomeNode({
      title: page.title,
      metadata: page.metadata
    });
  });
}

const OperationSchema = z.object({
  type: z.enum(['CREATE', 'UPDATE', 'DELETE', 'MOVE']),
  nodeId: z.string().optional(),
  data: NodeDataSchema.optional(),
  newParentId: z.string().nullable().optional()
});

const SaveRequestSchema = z.object({
  websiteId: z.string().min(1).max(100), // Basic validation for websiteId format
  operations: z.array(OperationSchema).min(1).max(50), // Limit batch size to prevent DoS
  baseWebsiteRevision: z.number().int().min(0).nullable().optional()
});

// Error type mapping for Prisma errors
const errorMap = {
  'P2002': { status: 409, message: 'Duplicate slug - a page with this URL already exists' },
  'P2025': { status: 404, message: 'Node not found - it may have been deleted' },
  'P2003': { status: 400, message: 'Invalid reference - parent node does not exist' },
  'P2034': { status: 409, message: 'Transaction conflict - please retry' }
};

/**
 * POST /api/studio/sitemap/save
 * Process batch operations on the sitemap
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
    const validation = SaveRequestSchema.safeParse(body);
    if (!validation.success) {
      console.error('[Save API] Validation failed:', JSON.stringify(validation.error.flatten(), null, 2));
      console.error('[Save API] Request body sample:', JSON.stringify(body, null, 2).slice(0, 2000));
      return NextResponse.json(
        { error: 'Invalid request data', details: validation.error.flatten() },
        { status: 400 }
      );
    }
    
    const { websiteId, operations, baseWebsiteRevision } = validation.data;

    // Verify ownership of the website
    try {
      await assertWebsiteOwnership(prisma as any, auth.accountId, websiteId);
    } catch {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const eventsToPublish: StudioEventRecord[] = [];
    const actorSessionId = request.headers.get('x-studio-session-id');
    let currentWebsiteRevision = 0;

    // Process operations in a transaction with optimistic website revision checks.
    const results = await prisma.$transaction(
      async (tx) => {
        const revisionUpdate =
          typeof baseWebsiteRevision === 'number'
            ? await tx.website.updateMany({
                where: { id: websiteId, revision: baseWebsiteRevision },
                data: { revision: { increment: 1 } },
              })
            : await tx.website.updateMany({
                where: { id: websiteId },
                data: { revision: { increment: 1 } },
              });

        if (revisionUpdate.count !== 1) {
          const current = await tx.website.findUnique({
            where: { id: websiteId },
            select: { revision: true },
          });
          throw Object.assign(new Error('Website changed in another session'), {
            statusCode: 409,
            currentWebsiteRevision: current?.revision ?? null,
          });
        }

        const revisionRecord = await tx.website.findUnique({
          where: { id: websiteId },
          select: { revision: true },
        });
        currentWebsiteRevision = revisionRecord?.revision ?? 0;

        const operationResults = [];
        
        for (const op of operations) {
          try {
            let result;
            
            switch (op.type) {
              case 'CREATE':
                if (!op.data) throw new Error('Data required for create operation');
                
                // Validate contentTypeId if provided and not empty
                if (op.data.contentTypeId && op.data.contentTypeId !== '') {
                  const contentTypeExists = await prisma.contentType.findUnique({
                    where: { id: op.data.contentTypeId }
                  });
                  if (!contentTypeExists) {
                    throw new Error('Invalid content type specified');
                  }
                }
                
                const isPage = op.data.contentTypeCategory === 'page';
                const isHomeRequest = isPage ? isHomeCreationRequest(op.data as NodeData) : false;

                if (isHomeRequest) {
                  if (op.data.parentId) {
                    throw new Error('Home page must be created at the root level');
                  }

                  const existingHome = await hasExistingHomePage(websiteId);
                  if (existingHome) {
                    throw new Error('Home page already exists for this site');
                  }
                }

                // For pages with content, use pageOrchestrator for atomic creation
                if (isPage && op.data.components) {
                  const contentTypeId = op.data.contentTypeId || await getDefaultContentTypeId(websiteId, 'page');
                  if (!contentTypeId) {
                    throw new Error('No valid content type available for page creation');
                  }
                  
                  result = await pageOrchestrator.createPage({
                    title: op.data.title || 'Untitled',
                    contentTypeId,
                    parentId: op.data.parentId === null ? undefined : op.data.parentId,
                    slug: op.data.slug || 'untitled',
                    content: {
                      components: op.data.components || []
                    } as Prisma.JsonValue, // pageOrchestrator expects specific format
                    metadata: (op.data.metadata || {}) as Prisma.JsonValue
                  }, websiteId);
                } else {
                  // For folders or simple nodes, use siteStructureService
                  result = await siteStructureService.create({
                    websiteId,
                    parentId: op.data.parentId || null,
                    slug: op.data.slug || 'untitled',
                    title: op.data.title || 'Untitled',
                    websitePageId: null, // Folders have no content
                    weight: op.data.weight || 0
                  });
                }
                break;
                
              case 'UPDATE':
                if (!op.nodeId) throw new Error('Node ID required for update');

                const existingNode = await prisma.websiteStructure.findUnique({
                  where: { id: op.nodeId },
                  select: {
                    id: true,
                    parentId: true,
                    slug: true,
                    fullPath: true,
                    websitePageId: true,
                    websitePage: {
                      select: {
                        id: true,
                        title: true,
                        metadata: true
                      }
                    }
                  }
                });

                if (!existingNode) {
                  throw new Error('Node not found');
                }

                const effectiveParentId =
                  op.data?.parentId !== undefined ? op.data.parentId : existingNode.parentId;

                const effectiveMetadata =
                  op.data?.metadata !== undefined ? op.data.metadata : existingNode.websitePage?.metadata;

                const effectiveSlug = op.data?.slug ?? existingNode.slug ?? undefined;
                const effectiveTitle =
                  op.data?.title ?? existingNode.websitePage?.title ?? undefined;

                const becomesHome = isHomeNode({
                  title: effectiveTitle,
                  slug: effectiveSlug,
                  metadata: effectiveMetadata
                });

                if (becomesHome) {
                  if (effectiveParentId) {
                    throw new Error('Home page must be created at the root level');
                  }

                  const existingHome = await hasExistingHomePage(websiteId, {
                    excludeStructureId: existingNode.id,
                    excludePageId: existingNode.websitePage?.id
                  });

                  if (existingHome) {
                    throw new Error('Home page already exists for this site');
                  }
                }

                // Update WebsiteStructure fields
                result = await siteStructureService.update(op.nodeId, {
                  slug: op.data?.slug,
                  title: op.data?.title,
                  weight: op.data?.weight
                });

                // If components were provided, update the WebsitePage
                if (op.data?.components !== undefined) {
                  if (existingNode.websitePageId) {
                    await (prisma as any).websitePage.update({
                      where: { id: existingNode.websitePageId },
                      data: {
                        content: {
                          components: op.data.components
                        } as Prisma.InputJsonValue,
                        revision: { increment: 1 }
                      }
                    });
                  }
                }

                // Update metadata-backed fields (redirect, etc.)
                // These fields are stored in WebsitePage.metadata but exposed at node.data level
                const METADATA_BACKED_FIELDS = [
                  'redirectUrl',
                  'redirectType',
                  'showInNav',
                  'navLabel',
                  'openInNewTab'
                ] as const;

                const hasMetadataFields = METADATA_BACKED_FIELDS.some(
                  field => op.data?.[field] !== undefined
                );

                // Check if op.data.metadata contains SEO or other fields to persist
                const metadataUpdate = op.data?.metadata;
                const hasMetadataObject = metadataUpdate !== undefined && metadataUpdate !== null && typeof metadataUpdate === 'object';

                if ((hasMetadataFields || hasMetadataObject) && existingNode.websitePageId) {
                  // Get current metadata
                  const currentMetadata = (existingNode.websitePage?.metadata || {}) as Record<string, any>;

                  // Build updated metadata with changed fields
                  const updatedMetadata = { ...currentMetadata };

                  // Merge metadata object from op.data.metadata (SEO fields, etc.)
                  // This handles: title, description, keywords, ogImage, and any other metadata fields
                  if (hasMetadataObject) {
                    Object.assign(updatedMetadata, metadataUpdate);
                  }

                  // Apply metadata-backed fields (these are sent as top-level fields in op.data)
                  for (const field of METADATA_BACKED_FIELDS) {
                    if (op.data?.[field] !== undefined) {
                      updatedMetadata[field] = op.data[field];
                    }
                  }

                  await (prisma as any).websitePage.update({
                    where: { id: existingNode.websitePageId },
                    data: {
                      metadata: updatedMetadata as Prisma.InputJsonValue,
                      revision: { increment: 1 }
                    }
                  });

                  // Sync page-level redirect to Redirect table
                  // This ensures redirects set via Property Editor are exported
                  const redirectUrl = op.data?.redirectUrl;
                  const redirectType = (op.data?.redirectType ?? 301) as 301 | 302;

                  // Get the page's full path for sourcePath
                  const pageFullPath = existingNode.fullPath ||
                    (await prisma.websiteStructure.findUnique({
                      where: { id: existingNode.id },
                      select: { fullPath: true }
                    }))?.fullPath;

                  if (pageFullPath) {
                    try {
                      if (redirectUrl && typeof redirectUrl === 'string' && redirectUrl.trim().length > 0) {
                        // Create or update page-level redirect
                        await redirectService.syncPageRedirect({
                          websiteId,
                          sourcePath: pageFullPath,
                          targetPath: redirectUrl.trim(),
                          redirectType,
                          pageTitle: existingNode.websitePage?.title || pageFullPath
                        });
                      } else if (redirectUrl === '' || redirectUrl === null) {
                        // Remove page-level redirect (only if source is 'page-metadata')
                        await redirectService.removePageRedirect({
                          websiteId,
                          sourcePath: pageFullPath
                        });
                      }
                    } catch (syncError) {
                      console.error('Failed to sync page redirect to Redirect table:', syncError);
                      // Don't fail the save operation - log and continue
                    }
                  }
                }
                break;
                
              case 'DELETE':
                if (!op.nodeId) throw new Error('Node ID required for delete');
                await siteStructureService.delete(op.nodeId, tx);
                result = { deleted: true, nodeId: op.nodeId };
                break;
                
              case 'MOVE':
                if (!op.nodeId) throw new Error('Node ID required for move');

                const nodeToMove = await prisma.websiteStructure.findUnique({
                  where: { id: op.nodeId },
                  select: {
                    slug: true,
                    websitePage: {
                      select: {
                        title: true,
                        metadata: true
                      }
                    }
                  }
                });

                if (!nodeToMove) {
                  throw new Error('Node not found');
                }

                if (op.newParentId) {
                  const isMovingHome = isHomeNode({
                    title: nodeToMove.websitePage?.title ?? nodeToMove.slug,
                    slug: nodeToMove.slug,
                    metadata: nodeToMove.websitePage?.metadata
                  });

                  if (isMovingHome) {
                    throw new Error('Home page must be created at the root level');
                  }
                }

                result = await siteStructureService.moveNode(
                  op.nodeId,
                  op.newParentId || null
                );
                break;
                
              default:
                throw new Error(`Unknown operation type: ${op.type}`);
            }
            
            operationResults.push({
              success: true,
              operation: op.type,
              result
            });
          } catch (opError) {
            // Log full error for debugging but sanitize for client
            console.error(`Operation ${op.type} failed:`, opError);
            
            // Sanitize error message for client response
            let clientError = 'Operation failed';
            if (opError instanceof Error) {
              // Only expose safe error messages
              if (opError.message.includes('Invalid content type')) {
                clientError = 'Invalid content type';
              } else if (opError.message.includes('Node ID required')) {
                clientError = opError.message;
              } else if (opError.message.includes('Data required')) {
                clientError = opError.message;
              } else if (opError.message.includes('not found')) {
                clientError = 'Resource not found';
              } else if (opError.message.includes('duplicate')) {
                clientError = 'Duplicate resource';
              } else if (opError.message.includes('Home page already exists')) {
                clientError = 'Home page already exists for this site';
              } else if (opError.message.includes('Home page must be created at the root level')) {
                clientError = 'Home page must be created at the root level';
              }
            }
            
            throw Object.assign(new Error(clientError), {
              operation: op.type,
              cause: opError,
            });
          }
        }

        const event = await studioEventBus.publishInTransaction(tx, {
          websiteId,
          type: 'website.graph.changed',
          source: 'builder',
          actorUserId: auth.userId ?? null,
          actorSessionId,
          resourceType: 'website',
          resourceId: websiteId,
          revision: currentWebsiteRevision,
          payload: {
            operationTypes: operations.map((operation) => operation.type),
            operationCount: operations.length,
            layoutMayChange: operations.some((operation) => operation.type === 'CREATE' || operation.type === 'DELETE' || operation.type === 'MOVE'),
          },
        });
        eventsToPublish.push(event);
        
        return operationResults;
      },
      {
        // ReadCommitted is sufficient - Serializable causes too many conflicts
        // Unique constraints handle concurrent slug creation
        // Delete/update on non-existent nodes handled by error cases
        maxWait: 5000,
        timeout: 15000 // 15s max - Prisma Accelerate hard limit for interactive transactions
      }
    );

    await Promise.all(eventsToPublish.map((event) => studioEventBus.publishAfterCommit(event)));
    eventsToPublish.length = 0;

    // Run deferred cleanup tasks (redirect removal, layout invalidation)
    // These are non-critical and run AFTER transaction commits
    try {
      await siteStructureService.runPendingCleanup();
    } catch (cleanupError) {
      // Log but don't fail the response - cleanup is non-critical
      console.error('[Save API] Post-transaction cleanup error:', cleanupError);
    }

    // Check if all operations succeeded
    const allSucceeded = results.every(r => r.success);

    // Check if layout recalculation is needed due to component changes
    // This handles dynamic node heights - if a page's component count exceeds
    // the current level max height, we need to recalculate all positions
    let layoutRecalculated = false;
    const componentUpdateOps = operations.filter(
      op => op.type === 'UPDATE' && op.data?.components !== undefined && op.nodeId
    );

    if (componentUpdateOps.length > 0 && allSucceeded) {
      try {
        // Check each updated node to see if height needs recalculation
        for (const op of componentUpdateOps) {
          if (!op.nodeId) continue;

          const newComponentCount = Array.isArray(op.data?.components) ? op.data.components.length : 0;

          // Get the structure to find its pathDepth
          const structure = await prisma.websiteStructure.findUnique({
            where: { id: op.nodeId },
            select: { pathDepth: true },
          });

          if (!structure) continue;

          // Get current level height from any node at this level
          const currentLevelHeight = await prisma.nodePosition.findFirst({
            where: { websiteId, pathDepth: structure.pathDepth },
            select: { height: true },
          });

          // Calculate what height this page needs
          const neededHeight = calculateLevelHeight(newComponentCount);

          // If needed height exceeds current level height, recalculate all positions
          if (!currentLevelHeight || neededHeight > currentLevelHeight.height) {
            console.log('[Save API] Layout recalculation triggered:', {
              nodeId: op.nodeId,
              pathDepth: structure.pathDepth,
              newComponentCount,
              currentLevelHeight: currentLevelHeight?.height,
              neededHeight,
            });
            await unifiedLayoutService.calculateAndPersistLayout(websiteId);
            layoutRecalculated = true;
            await studioEventBus.publish({
              websiteId,
              type: 'website.layout.changed',
              source: 'builder',
              actorUserId: auth.userId ?? null,
              actorSessionId,
              resourceType: 'website',
              resourceId: websiteId,
              revision: currentWebsiteRevision,
              payload: {
                reason: 'component_height_changed',
              },
            });
            break; // Only need to recalculate once
          }
        }
      } catch (layoutError) {
        // Layout recalculation is non-critical - log but don't fail the save
        console.error('[Save API] Layout recalculation failed:', layoutError);
      }
    }

    return NextResponse.json({
      success: allSucceeded,
      results,
      layoutRecalculated,
      currentWebsiteRevision,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Save operation failed:', error);
    
    // Handle Prisma-specific errors
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      const errorInfo = errorMap[error.code as keyof typeof errorMap];
      if (errorInfo) {
        return NextResponse.json(
          { error: errorInfo.message, code: error.code },
          { status: errorInfo.status }
        );
      }
    }

    const statusCode = typeof (error as { statusCode?: unknown }).statusCode === 'number'
      ? (error as { statusCode: number }).statusCode
      : null;
    if (statusCode === 409) {
      return NextResponse.json(
        {
          success: false,
          error: error instanceof Error ? error.message : 'Website changed in another session',
          currentWebsiteRevision: (error as { currentWebsiteRevision?: number | null }).currentWebsiteRevision ?? undefined,
        },
        { status: 409 }
      );
    }

    if ((error as { operation?: unknown }).operation) {
      return NextResponse.json(
        {
          success: false,
          error: error instanceof Error ? error.message : 'Save operation failed',
        },
        { status: 400 }
      );
    }
    
    // Handle transaction conflicts specifically
    if (error instanceof Error && error.message.includes('transaction')) {
      return NextResponse.json(
        { error: 'Transaction conflict - please retry', retryable: true },
        { status: 409 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to save sitemap changes' },
      { status: 500 }
    );
  }
}

/**
 * Helper to get default content type ID for a category
 * Creates a default ContentType if none exists
 */
async function getDefaultContentTypeId(websiteId: string, category: 'page' | 'component' | 'folder'): Promise<string> {
  // First try to find an existing content type
  let contentType = await prisma.contentType.findFirst({
    where: {
      websiteId,
      category: category
    }
  });
  
  // If none exists, create a default one
  if (!contentType) {
    // Check if website exists, if not create it
    let website = await prisma.website.findUnique({
      where: { id: websiteId }
    });
    
    if (!website) {
      // Create a default website for demo purposes
      website = await prisma.website.create({
        data: {
          id: websiteId,
          name: 'Demo Website',
          category: 'BUSINESS', // Add required category field
          createdAt: new Date(),
          updatedAt: new Date()
        }
      });
    }
    
    // Create a default content type
    const defaultName = `Default ${category.charAt(0).toUpperCase() + category.slice(1)}`;
    contentType = await prisma.contentType.create({
      data: {
        websiteId,
        key: `default-${category}`,
        name: defaultName,
        pluralName: `${defaultName}s`,
        category: category,
        fields: {}
      }
    });
  }
  
  return contentType.id;
}
