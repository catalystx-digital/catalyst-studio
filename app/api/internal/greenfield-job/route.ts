/**
 * Internal API for Greenfield Job Progress Updates
 *
 * This endpoint handles progress updates for the greenfield website workflow.
 * Workflow steps call this API to update job status and send progress messages.
 *
 * Security: This is an INTERNAL API - only accept requests from localhost/same-origin.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { updateSystemEvent, finalizeProgressEvent } from '@/lib/studio/import/utils/update-system-event';
import { isAuthorizedInternalWorkflowRequest } from '@/lib/studio/workflows/internal-auth';

// ============================================================================
// Request Validation
// ============================================================================

const UpdateProgressSchema = z.object({
  action: z.literal('updateProgress'),
  jobId: z.string().min(1),
  websiteId: z.string().min(1),
  sessionId: z.string().min(1),
  accountId: z.string().min(1),
  progress: z.number().min(0).max(100),
  message: z.string(),
  metadata: z.record(z.unknown()).optional(),
});

const MarkFailedSchema = z.object({
  action: z.literal('markFailed'),
  jobId: z.string().min(1),
  websiteId: z.string().min(1),
  sessionId: z.string().min(1),
  accountId: z.string().min(1),
  errorMessage: z.string(),
});

const MarkCompletedSchema = z.object({
  action: z.literal('markCompleted'),
  jobId: z.string().min(1),
  websiteId: z.string().min(1),
  sessionId: z.string().min(1),
  accountId: z.string().min(1),
  message: z.string().optional(),
});

const RequestSchema = z.discriminatedUnion('action', [
  UpdateProgressSchema,
  MarkFailedSchema,
  MarkCompletedSchema,
]);

type RequestBody = z.infer<typeof RequestSchema>;

// ============================================================================
// Security
// ============================================================================

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
      console.error('[Internal Greenfield Job API] Validation error:', parseResult.error.errors);
      return NextResponse.json(
        { error: 'Invalid request', details: parseResult.error.errors },
        { status: 400 }
      );
    }

    const body = parseResult.data;

    switch (body.action) {
      case 'updateProgress':
        return handleUpdateProgress(body);
      case 'markFailed':
        return handleMarkFailed(body);
      case 'markCompleted':
        return handleMarkCompleted(body);
      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }
  } catch (error) {
    console.error('[Internal Greenfield Job API] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 }
    );
  }
}

// ============================================================================
// Action Handlers
// ============================================================================

async function handleUpdateProgress(body: z.infer<typeof UpdateProgressSchema>) {
  const { jobId, websiteId, sessionId, accountId, progress, message, metadata } = body;

  await updateSystemEvent({
    websiteId,
    sessionId,
    accountId,
    jobId,
    content: message,
    metadata: {
      type: 'import-progress',
      jobId,
      url: '',
      stage: 'greenfield',
      progress,
      processedCount: (metadata?.processedCount as number) ?? 0,
      totalCount: (metadata?.totalCount as number) ?? 0,
      currentUrl: null,
      status: 'running',
      message,
      description: (metadata?.description as string) ?? 'Creating website from description',
      updatedAt: new Date().toISOString(),
    },
  });

  return NextResponse.json({ success: true });
}

async function handleMarkFailed(body: z.infer<typeof MarkFailedSchema>) {
  const { jobId, websiteId, sessionId, accountId, errorMessage } = body;

  await finalizeProgressEvent({
    websiteId,
    sessionId,
    accountId,
    jobId,
    status: 'failed',
    message: errorMessage,
    metadata: {
      description: 'Greenfield website creation failed',
    },
  });

  return NextResponse.json({ success: true });
}

async function handleMarkCompleted(body: z.infer<typeof MarkCompletedSchema>) {
  const { jobId, websiteId, sessionId, accountId, message } = body;

  await finalizeProgressEvent({
    websiteId,
    sessionId,
    accountId,
    jobId,
    status: 'completed',
    message: message ?? 'Website created successfully',
    metadata: {
      description: 'Greenfield website creation completed',
    },
  });

  return NextResponse.json({ success: true });
}
