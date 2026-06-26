/**
 * Internal API for Greenfield Result Persistence
 *
 * This endpoint handles database operations for persisting greenfield workflow results.
 * Workflow steps call this API because Prisma can't be bundled in workflow step code.
 *
 * Security: This is an INTERNAL API - called from workflow steps.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { isAuthorizedInternalWorkflowRequest } from '@/lib/studio/workflows/internal-auth';

// ============================================================================
// Request Validation
// ============================================================================

const SaveResultSchema = z.object({
  operation: z.literal('save_result'),
  websiteId: z.string().min(1),
  accountId: z.string().min(1),
  jobId: z.string().min(1),
  data: z.object({
    pagesCreated: z.number().int().nonnegative(),
    populatedPages: z.number().int().nonnegative(),
    errors: z.array(z.string()).optional(),
  }).refine((data) => data.populatedPages <= data.pagesCreated, {
    message: 'populatedPages cannot exceed pagesCreated',
    path: ['populatedPages'],
  }),
});

const CleanupSchema = z.object({
  operation: z.literal('cleanup'),
  websiteId: z.string().min(1),
  accountId: z.string().min(1),
  jobId: z.string().min(1),
  data: z.record(z.unknown()).optional(),
});

const RequestSchema = z.discriminatedUnion('operation', [SaveResultSchema, CleanupSchema]);

type RequestBody = z.infer<typeof RequestSchema>;

// ============================================================================
// Route Handler
// ============================================================================

export async function POST(request: NextRequest) {
  if (!isAuthorizedInternalWorkflowRequest(request)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const rawBody = await request.json();
    const parseResult = RequestSchema.safeParse(rawBody);

    if (!parseResult.success) {
      console.error('[Internal Greenfield Persist API] Validation error:', parseResult.error.errors);
      return NextResponse.json(
        { error: 'Invalid request', details: parseResult.error.errors },
        { status: 400 }
      );
    }

    const body = parseResult.data;

    switch (body.operation) {
      case 'save_result':
        return handleSaveResult(body);
      case 'cleanup':
        return handleCleanup(body);
      default:
        return NextResponse.json({ error: 'Unknown operation' }, { status: 400 });
    }
  } catch (error) {
    console.error('[Internal Greenfield Persist API] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 }
    );
  }
}

// ============================================================================
// Operation Handlers
// ============================================================================

async function handleSaveResult(body: z.infer<typeof SaveResultSchema>) {
  const { websiteId, accountId, jobId, data } = body;

  // Verify website belongs to account
  const website = await prisma.website.findUnique({
    where: { id: websiteId },
    select: { accountId: true },
  });

  if (!website || website.accountId !== accountId) {
    return NextResponse.json({ error: 'Website not found or not accessible' }, { status: 404 });
  }

  // Update website metadata with bootstrap result
  await prisma.website.update({
    where: { id: websiteId },
    data: {
      metadata: {
        bootstrapResult: {
          jobId,
          pagesCreated: data.pagesCreated,
          populatedPages: data.populatedPages,
          errors: data.errors ?? [],
          completedAt: new Date().toISOString(),
        },
      },
    },
  });

  console.info('[Internal Greenfield Persist API] Saved result', {
    websiteId,
    jobId,
    pagesCreated: data.pagesCreated,
    populatedPages: data.populatedPages,
  });

  return NextResponse.json({ success: true });
}

async function handleCleanup(body: z.infer<typeof CleanupSchema>) {
  const { websiteId, accountId, jobId } = body;

  // Verify website belongs to account
  const website = await prisma.website.findUnique({
    where: { id: websiteId },
    select: { accountId: true },
  });

  if (!website || website.accountId !== accountId) {
    return NextResponse.json({ error: 'Website not found or not accessible' }, { status: 404 });
  }

  // Cleanup is a no-op for now - greenfield workflow doesn't need cleanup
  // This endpoint exists for future extensibility (e.g., cleaning up temp files)
  console.info('[Internal Greenfield Persist API] Cleanup completed', {
    websiteId,
    jobId,
  });

  return NextResponse.json({ success: true });
}
