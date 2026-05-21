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
import { ImportRunService, normalizeImportUrl } from "@/lib/studio/import/services/import-run-service";
import { isAuthorizedInternalWorkflowRequest } from "@/lib/studio/workflows/internal-auth";

const importDb = prisma as any;
const TERMINAL_IMPORT_JOB_STATUSES = [
  ImportJobStatus.COMPLETED,
  ImportJobStatus.COMPLETED_WITH_WARNINGS,
  ImportJobStatus.FAILED,
  ImportJobStatus.CANCELLED,
];

interface UpdateProgressRequest {
  action: "updateProgress";
  jobId: string;
  progress: number;
  message: string;
  details?: {
    totalPages?: number;
  currentUrl?: string | null;
  processedCount?: number;
  attemptToken?: string | null;
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

interface GetRunPlanRequest {
  action: "getRunPlan";
  jobId: string;
}

interface GetSuccessfulDetectionsRequest {
  action: "getSuccessfulDetections";
  jobId: string;
  attemptTokens?: string[];
}

interface AssertRunActiveRequest {
  action: "assertRunActive";
  jobId: string;
}

interface UpsertPageStageRequest {
  action: "upsertPageStage";
  jobId: string;
  pageUrl: string;
  canonicalUrl?: string | null;
  title?: string | null;
  status: string;
  phase?: string;
  detectionPayload?: unknown;
  pageContent?: unknown;
  structureCandidate?: unknown;
  committedPageId?: string | null;
  error?: unknown;
  attemptToken?: string | null;
}

type RequestBody =
  | UpdateProgressRequest
  | MarkFailedRequest
  | MarkCompletedRequest
  | GetRunPlanRequest
  | GetSuccessfulDetectionsRequest
  | AssertRunActiveRequest
  | UpsertPageStageRequest;

export async function POST(request: NextRequest) {
  if (!isAuthorizedInternalWorkflowRequest(request)) {
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
      case "getRunPlan":
        return handleGetRunPlan(body);
      case "getSuccessfulDetections":
        return handleGetSuccessfulDetections(body);
      case "assertRunActive":
        return handleAssertRunActive(body);
      case "upsertPageStage":
        return handleUpsertPageStage(body);
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
  const runService = new ImportRunService();

  const existing = await importDb.importJob.findUnique({
    where: { id: jobId },
    select: { detectionResults: true, status: true },
  });

  const existingResults = (existing?.detectionResults as Record<string, unknown>) || {};

  const nextDetectionResults = {
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
        totalCount: details.totalPages ?? existingResults.totalPages ?? 0,
      },
    }),
  };

  await importDb.importJob.update({
    where: { id: jobId },
    data: {
      detectionResults: nextDetectionResults,
      ...(existing?.status === ImportJobStatus.PENDING || existing?.status === ImportJobStatus.QUEUED
        ? { status: ImportJobStatus.PROCESSING, startedAt: new Date() }
        : {}),
    },
  });

  const currentRun = await runService.findByJobId(jobId);
  const runStatus = typeof currentRun?.status === "string" ? currentRun.status.toLowerCase() : null;
  const isTerminalRun =
    runStatus === "completed" ||
    runStatus === "completed_with_warnings" ||
    runStatus === "completed_with_redirects" ||
    runStatus === "failed_retryable" ||
    runStatus === "failed_terminal" ||
    runStatus === "cancelled" ||
    runStatus === "unknown";

  if (!isTerminalRun) {
    await runService.updateProgressForJob(jobId, {
      status: progress >= 85 ? "committing" : "importing",
      phase: progress >= 85 ? "commit_page" : "detect_page",
      progress,
      message,
      totalPages: details?.totalPages,
      stagedPages: details?.processedCount,
    });
  }

  return NextResponse.json({ success: true });
}

async function handleMarkFailed(body: MarkFailedRequest) {
  const { jobId, errorMessage } = body;
  const runService = new ImportRunService();

  await importDb.importJob.updateMany({
    where: {
      id: jobId,
      status: { notIn: TERMINAL_IMPORT_JOB_STATUSES },
    },
    data: {
      status: ImportJobStatus.FAILED,
      errorMessage,
      completedAt: new Date(),
    },
  });

  const run = await runService.findByJobId(jobId);
  const runStatus = typeof run?.status === "string" ? run.status.toLowerCase() : null;
  if (
    runStatus !== "completed" &&
    runStatus !== "completed_with_warnings" &&
    runStatus !== "completed_with_redirects" &&
    runStatus !== "failed_retryable" &&
    runStatus !== "failed_terminal" &&
    runStatus !== "cancelled" &&
    runStatus !== "unknown"
  ) {
    await runService.updateProgressForJob(jobId, {
      status: "failed_retryable",
      phase: "failed",
      message: errorMessage,
      lastError: {
        code: "IMPORT_FAILED",
        category: "workflow_orchestration",
        retryable: true,
        scope: "run",
        phase: "failed",
        message: errorMessage,
        attempts: 1,
        firstSeenAt: new Date().toISOString(),
        lastSeenAt: new Date().toISOString(),
      },
      recoverableActions: ["retry_phase", "finalize_partial", "cancel_run"],
      completedAt: new Date(),
    });
  }

  return NextResponse.json({ success: true });
}

async function handleMarkCompleted(body: MarkCompletedRequest) {
  const { jobId } = body;
  const runService = new ImportRunService();

  const run = await runService.findByJobId(jobId);
  const runStatus = typeof run?.status === "string" ? run.status.toLowerCase() : null;
  if (
    runStatus !== "completed" &&
    runStatus !== "completed_with_warnings" &&
    runStatus !== "completed_with_redirects" &&
    runStatus !== "failed_retryable" &&
    runStatus !== "failed_terminal" &&
    runStatus !== "cancelled" &&
    runStatus !== "unknown"
  ) {
    const finalStatus = await runService.deriveFinalStatusForJob(jobId);
    const runFinalStatus = finalStatus?.status ?? "completed";
    const jobFinalStatus =
      runFinalStatus === "completed_with_redirects"
        ? ImportJobStatus.COMPLETED_WITH_WARNINGS
        : runFinalStatus === "completed_with_warnings"
          ? ImportJobStatus.COMPLETED_WITH_WARNINGS
        : runFinalStatus === "completed"
          ? ImportJobStatus.COMPLETED
          : runFinalStatus === "cancelled"
            ? ImportJobStatus.CANCELLED
            : ImportJobStatus.FAILED;

    await importDb.importJob.updateMany({
      where: {
        id: jobId,
        status: { notIn: TERMINAL_IMPORT_JOB_STATUSES },
      },
      data: {
        status: jobFinalStatus,
        errorMessage: jobFinalStatus === ImportJobStatus.FAILED ? finalStatus?.message ?? "Import failed" : undefined,
        completedAt: new Date(),
      },
    });

    await runService.updateProgressForJob(jobId, {
      status: runFinalStatus,
      phase: "completed",
      progress: 100,
      message: finalStatus?.message ?? "Import completed",
      totalPages: finalStatus?.totalPages,
      committedPages: finalStatus?.committedPages,
      failedPages: finalStatus?.failedPages,
      recoverableActions:
        runFinalStatus === "completed_with_redirects"
          ? ["continue_with_redirects"]
          : runFinalStatus === "completed_with_warnings"
            ? ["retry_failed_pages"]
            : [],
      completedAt: new Date(),
    });
  }

  return NextResponse.json({ success: true });
}

async function handleGetRunPlan(body: GetRunPlanRequest) {
  const run = await importDb.importRun.findUnique({
    where: { importJobId: body.jobId },
    include: {
      pageStages: {
        orderBy: { firstSeenAt: "asc" },
        select: {
          sourceUrl: true,
          normalizedPageUrl: true,
          status: true,
          attemptToken: true,
        },
      },
    },
  });

  if (run) {
    const plan = run.importPlan && typeof run.importPlan === "object" && !Array.isArray(run.importPlan)
      ? (run.importPlan as Record<string, unknown>)
      : {};
    const planUrls = Array.isArray(plan.urls)
      ? plan.urls.filter((url): url is string => typeof url === "string")
      : [];
    const pendingStages = run.pageStages.filter((stage: { status: string }) =>
      ["discovered", "queued", "pending", "failed_retryable"].includes(String(stage.status).toLowerCase())
    );
    const sourceStages = pendingStages;
    const stagedUrls = sourceStages.map((stage: { sourceUrl: string }) => stage.sourceUrl);
    const stagedNormalizedUrls = sourceStages.map((stage: { normalizedPageUrl: string }) => stage.normalizedPageUrl);
    const stagePlans = sourceStages.map((stage: { sourceUrl: string; normalizedPageUrl: string; attemptToken?: string | null }) => ({
      url: stage.sourceUrl,
      normalizedUrl: stage.normalizedPageUrl,
      attemptToken: stage.attemptToken ?? null,
    }));
    const urls = stagedUrls.length > 0 ? stagedUrls : run.pageStages.length === 0 && planUrls.length > 0 ? planUrls : [];

    return NextResponse.json({
      success: true,
      data: {
        runId: run.id,
        urls,
        normalizedUrls: stagedNormalizedUrls.length > 0 ? stagedNormalizedUrls : urls.map(normalizeImportUrl),
        stagePlans,
        importPlan: run.importPlan,
      },
    });
  }

  const job = await importDb.importJob.findUnique({
    where: { id: body.jobId },
    select: { detectionResults: true, url: true },
  });
  const detectionResults = (job?.detectionResults as Record<string, unknown>) || {};
  const importPlan = detectionResults.importPlan as Record<string, unknown> | undefined;
  const planUrls = Array.isArray(importPlan?.urls)
    ? importPlan.urls.filter((url): url is string => typeof url === "string")
    : [];

  return NextResponse.json({
    success: true,
    data: {
      runId: null,
      urls: planUrls.length > 0 ? planUrls : job?.url ? [job.url] : [],
      normalizedUrls: planUrls.map(normalizeImportUrl),
      importPlan: importPlan ?? null,
    },
  });
}

async function handleGetSuccessfulDetections(body: GetSuccessfulDetectionsRequest) {
  const runService = new ImportRunService();
  const run = await importDb.importRun.findUnique({
    where: { importJobId: body.jobId },
    include: {
      pageStages: {
        where: {
          status: { in: ["detected", "staged", "committed"] },
          ...(body.attemptTokens && body.attemptTokens.length > 0 ? { attemptToken: { in: body.attemptTokens } } : {}),
        },
        orderBy: [{ firstSeenAt: "asc" }, { createdAt: "asc" }],
        select: {
          id: true,
          sourceUrl: true,
          status: true,
          detectionPayload: true,
          attemptToken: true,
        },
      },
    },
  });

  if (!run) {
    return NextResponse.json({ success: true, data: { detections: [] } });
  }

  const detections: unknown[] = [];
  for (const stage of run.pageStages) {
    if (stage.detectionPayload) {
      detections.push(stage.detectionPayload);
      continue;
    }

    await runService.upsertPageStageForJob(body.jobId, {
      pageUrl: stage.sourceUrl,
      status: "failed_retryable",
      phase: "detect_page",
      attemptToken: stage.attemptToken,
      error: {
        code: "PAGE_DETECTION_PAYLOAD_MISSING",
        category: "workflow_orchestration",
        retryable: true,
        scope: "page",
        phase: "detect_page",
        pageUrl: stage.sourceUrl,
        message: "Detected page stage is missing detectionPayload",
        attempts: 1,
        firstSeenAt: new Date().toISOString(),
        lastSeenAt: new Date().toISOString(),
      },
    });
  }

  return NextResponse.json({ success: true, data: { detections } });
}

async function handleAssertRunActive(body: AssertRunActiveRequest) {
  const run = await importDb.importRun.findUnique({
    where: { importJobId: body.jobId },
    select: { status: true, cancellationRequestedAt: true },
  });

  if (!run) {
    return NextResponse.json({ success: true, data: { active: true, legacy: true } });
  }

  const status = typeof run.status === "string" ? run.status.toLowerCase() : "unknown";
  if (status === "cancelled" || run.cancellationRequestedAt) {
    return NextResponse.json(
      { success: false, error: "Import run has been cancelled", data: { active: false, status } },
      { status: 409 }
    );
  }

  if (["completed", "completed_with_warnings", "completed_with_redirects", "failed_retryable", "failed_terminal", "unknown"].includes(status)) {
    return NextResponse.json(
      { success: false, error: `Import run is terminal: ${status}`, data: { active: false, status } },
      { status: 409 }
    );
  }

  return NextResponse.json({ success: true, data: { active: true, status } });
}

async function handleUpsertPageStage(body: UpsertPageStageRequest) {
  const runService = new ImportRunService();
  const stage = await runService.upsertPageStageForJob(body.jobId, {
    pageUrl: body.pageUrl,
    canonicalUrl: body.canonicalUrl,
    title: body.title,
    status: body.status,
    phase: body.phase,
    detectionPayload: body.detectionPayload as any,
    pageContent: body.pageContent as any,
    structureCandidate: body.structureCandidate as any,
    committedPageId: body.committedPageId,
    error: body.error as any,
    attemptToken: body.attemptToken,
  });

  if (!stage) {
    return NextResponse.json({ success: true, data: { staged: false, reason: "legacy_job_without_run" } });
  }

  return NextResponse.json({ success: true, data: { staged: Boolean(stage), stageId: stage?.id ?? null } });
}
