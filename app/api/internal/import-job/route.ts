/**
 * Internal API for Import Job Database Operations
 *
 * This endpoint handles Prisma database operations for the import workflow.
 * Workflow steps call this API instead of using Prisma directly because:
 * 1. Vercel Workflow bundles step code separately, breaking Prisma's dynamic imports
 * 2. Using HTTP calls ensures database access works in the Next.js server context
 *
 * Security: This is an INTERNAL API - only accept requests from localhost/same-origin.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ImportJobStatus } from "@/lib/studio/import/types/import-job.types";

// Verify request is internal (from same server)
function isInternalRequest(request: NextRequest): boolean {
  const host = request.headers.get("host");
  const origin = request.headers.get("origin");

  // Accept localhost requests
  if (host?.includes("localhost") || host?.includes("127.0.0.1")) {
    return true;
  }

  // In production on Vercel, accept requests from same origin
  if (origin && host && new URL(origin).host === host) {
    return true;
  }

  // Check for internal workflow header
  const workflowHeader = request.headers.get("x-workflow-internal");
  if (workflowHeader === process.env.WORKFLOW_INTERNAL_SECRET) {
    return true;
  }

  // Accept requests with valid Vercel automation bypass token
  // This allows Vercel Workflow steps to call internal APIs
  const bypassToken = request.nextUrl.searchParams.get(
    "x-vercel-protection-bypass"
  );
  if (bypassToken && bypassToken === process.env.VERCEL_AUTOMATION_BYPASS_SECRET) {
    return true;
  }

  // Reject unknown requests
  return false;
}

interface UpdateProgressRequest {
  action: "updateProgress";
  jobId: string;
  progress: number;
  message: string;
  details?: {
    totalPages?: number;
    currentUrl?: string | null;
    processedCount?: number;
  };
}

interface MarkFailedRequest {
  action: "markFailed";
  jobId: string;
  errorMessage: string;
}

interface MarkCompletedRequest {
  action: "markCompleted";
  jobId: string;
}

type RequestBody = UpdateProgressRequest | MarkFailedRequest | MarkCompletedRequest;

export async function POST(request: NextRequest) {
  if (!isInternalRequest(request)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = (await request.json()) as RequestBody;

    switch (body.action) {
      case "updateProgress":
        return handleUpdateProgress(body);
      case "markFailed":
        return handleMarkFailed(body);
      case "markCompleted":
        return handleMarkCompleted(body);
      default:
        return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }
  } catch (error) {
    console.error("[Internal Import Job API] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal error" },
      { status: 500 }
    );
  }
}

async function handleUpdateProgress(body: UpdateProgressRequest) {
  const { jobId, progress, message, details } = body;

  const existing = await prisma.importJob.findUnique({
    where: { id: jobId },
    select: { detectionResults: true },
  });

  const existingResults = (existing?.detectionResults as Record<string, unknown>) || {};

  await prisma.importJob.update({
    where: { id: jobId },
    data: {
      detectionResults: {
        ...existingResults,
        progress,
        lastProgressMessage: message,
        lastProgressUpdate: new Date().toISOString(),
        ...(details?.totalPages !== undefined && { totalPages: details.totalPages }),
        ...(details?.currentUrl !== undefined && { currentUrl: details.currentUrl }),
        ...(details?.processedCount !== undefined && {
          progressSummary: {
            ...((existingResults.progressSummary as Record<string, unknown>) || {}),
            processedCount: details.processedCount,
            totalCount: details.totalPages ?? existingResults.totalPages,
          },
        }),
      },
    },
  });

  return NextResponse.json({ success: true });
}

async function handleMarkFailed(body: MarkFailedRequest) {
  const { jobId, errorMessage } = body;

  await prisma.importJob.update({
    where: { id: jobId },
    data: {
      status: ImportJobStatus.FAILED,
      errorMessage,
      completedAt: new Date(),
    },
  });

  return NextResponse.json({ success: true });
}

async function handleMarkCompleted(body: MarkCompletedRequest) {
  const { jobId } = body;

  await prisma.importJob.update({
    where: { id: jobId },
    data: {
      status: ImportJobStatus.COMPLETED,
      completedAt: new Date(),
    },
  });

  return NextResponse.json({ success: true });
}
