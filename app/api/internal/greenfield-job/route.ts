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

/**
 * Verify request is internal (from same server or workflow step).
 */
function isInternalRequest(request: NextRequest): boolean {
  const host = request.headers.get('host');
  const origin = request.headers.get('origin');

  // Accept localhost requests
  if (host?.includes('localhost') || host?.includes('127.0.0.1')) {
    return true;
  }

  // In production on Vercel, accept requests from same origin
  if (origin && host && new URL(origin).host === host) {
    return true;
  }

  // Check for internal workflow header
  const workflowHeader = request.headers.get('x-workflow-internal');
  if (workflowHeader === process.env.WORKFLOW_INTERNAL_SECRET) {
    return true;
  }

  // Accept requests with valid Vercel automation bypass token
  // This allows Vercel Workflow steps to call internal APIs
  const bypassToken = request.nextUrl.searchParams.get('x-vercel-protection-bypass');
  if (bypassToken && bypassToken === process.env.VERCEL_AUTOMATION_BYPASS_SECRET) {
    return true;
  }

  return false;
}

// ============================================================================
// Route Handler
// ============================================================================

export async function POST(request: NextRequest) {
  if (!isInternalRequest(request)) {
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
