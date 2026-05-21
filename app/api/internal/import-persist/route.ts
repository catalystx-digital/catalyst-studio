/**
 * Internal API for Import Result Persistence
 *
 * This endpoint handles the complex database operations for persisting import results.
 * Workflow steps call this API because Prisma can't be bundled in workflow step code.
 *
 * Security: This is an INTERNAL API - called from workflow steps.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ImportJobStatus } from "@/lib/studio/import/types/import-job.types";
import type { PrismaClient } from "@/lib/generated/prisma";
import { isAuthorizedInternalWorkflowRequest } from "@/lib/studio/workflows/internal-auth";

const TERMINAL_IMPORT_JOB_STATUSES = [
  ImportJobStatus.COMPLETED,
  ImportJobStatus.COMPLETED_WITH_WARNINGS,
  ImportJobStatus.FAILED,
  ImportJobStatus.CANCELLED,
];
const importDb = prisma as any;

import { ImportResultHandler } from "@/lib/studio/import/services/import-result-handler";
import { ImportJobRepository } from "@/lib/studio/import/repositories/import-job.repository";
import { ImportProgressManager } from "@/lib/studio/import/services/import-progress-manager";
import { ImportOrchestrator } from "@/lib/studio/import/services/import-orchestrator";
import { ComponentTypeExtractor } from "@/lib/studio/import/services/component-type-extractor";
import { PageBuilderService } from "@/lib/studio/import/services/page-builder-service";
import { StructureService } from "@/lib/studio/import/services/structure-service";
import { CanonicalSignatureSharedComponentDetector } from "@/lib/studio/import/services/shared-component-detectors/canonical-signature-detector";
import type { ImportDetectionResult } from "@/lib/studio/import/web-detection";
import type { NavigationHierarchy, Template, DesignTokens } from "@/lib/studio/import/types";
import type { CapturedDesignSystem } from "@/lib/studio/import/types/design-system.types";
import type { CaptureDesignSystemResult } from "@/lib/studio/design-system/dom-probe/service";
import type { SitemapMetadata } from "@/lib/studio/import/services/sitemap-discovery.service";
import { ImportRunService } from "@/lib/studio/import/services/import-run-service";

export const maxDuration = 300;

interface SharedComponentsResult {
  navigation: NavigationHierarchy;
  templates: Template[];
  designTokens: DesignTokens;
}

interface DesignSystemResult {
  designSystem: CapturedDesignSystem | null;
  domProbeCapture: CaptureDesignSystemResult | null;
}

interface SitemapResult {
  sitemapMetaByUrl: Record<string, SitemapMetadata>;
}

interface PersistRequest {
  jobId: string;
  websiteId: string;
  detections: ImportDetectionResult[];
  sharedResult: SharedComponentsResult;
  designResult: DesignSystemResult;
  attemptTokens?: string[];
  sitemapResult: SitemapResult;
}

export async function POST(request: NextRequest) {
  if (!isAuthorizedInternalWorkflowRequest(request)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = (await request.json()) as PersistRequest;
    const { jobId, websiteId, detections, sharedResult, designResult, attemptTokens, sitemapResult } = body;

    // Validate required fields
    if (!jobId || typeof jobId !== "string") {
      return NextResponse.json({ error: "Invalid jobId" }, { status: 400 });
    }
    if (!websiteId || typeof websiteId !== "string") {
      return NextResponse.json({ error: "Invalid websiteId" }, { status: 400 });
    }

    const currentJob = await importDb.importJob.findUnique({
      where: { id: jobId },
      select: { status: true },
    });
    if (!currentJob) {
      return NextResponse.json({ error: "Import job not found" }, { status: 404 });
    }
    if (TERMINAL_IMPORT_JOB_STATUSES.includes(currentJob.status as ImportJobStatus)) {
      return NextResponse.json(
        { error: `Cannot persist job with terminal status: ${currentJob.status}` },
        { status: 409 }
      );
    }

    const runService = new ImportRunService();
    await runService.assertRunNotCancelled(jobId);
    const run = await importDb.importRun.findUnique({
      where: { importJobId: jobId },
      include: {
        pageStages: {
          where: {
            status: { in: ["detected", "staged", "committed"] },
            ...(attemptTokens && attemptTokens.length > 0 ? { attemptToken: { in: attemptTokens } } : {}),
          },
          orderBy: [{ firstSeenAt: "asc" }, { createdAt: "asc" }],
          select: {
            sourceUrl: true,
            detectionPayload: true,
            attemptToken: true,
          },
        },
      },
    });
    const durableDetections: ImportDetectionResult[] = [];
    if (run) {
      for (const stage of run.pageStages) {
        if (stage.detectionPayload) {
          durableDetections.push(stage.detectionPayload as ImportDetectionResult);
        } else {
          await runService.upsertPageStageForJob(jobId, {
            pageUrl: stage.sourceUrl,
            status: "failed_retryable",
            phase: "commit_page",
            attemptToken: stage.attemptToken,
            error: {
              code: "PAGE_DETECTION_PAYLOAD_MISSING",
              category: "workflow_orchestration",
              retryable: true,
              scope: "page",
              phase: "commit_page",
              pageUrl: stage.sourceUrl,
              message: "Detected page stage is missing detectionPayload",
              attempts: 1,
              firstSeenAt: new Date().toISOString(),
              lastSeenAt: new Date().toISOString(),
            },
          });
        }
      }
    }
    const detectionsToPersist = run ? durableDetections : detections;

    const repository = new ImportJobRepository();
    const progressManager = new ImportProgressManager(repository);

    // Cast prisma to PrismaClient type expected by services
    const prismaClient = prisma as unknown as PrismaClient;

    const orchestrator = new ImportOrchestrator({
      componentTypeExtractor: new ComponentTypeExtractor(prismaClient),
      pageBuilderService: new PageBuilderService(prismaClient),
      structureService: new StructureService(prismaClient),
      sharedComponentDetector: new CanonicalSignatureSharedComponentDetector(prismaClient),
      prisma: prismaClient,
      memoryLimitMB: 8000, // Higher limit for workflow mode
      skipMemoryCheck: true, // Vercel manages resources in workflow mode
    });

    const resultHandler = new ImportResultHandler({
      repository,
      progressManager,
      orchestrator,
      prisma: prismaClient,
    });

    // Construct pipeline result for persist()
    const pipelineResult = {
      success: true,
      data: {
        detectedComponents: detectionsToPersist,
        navigation: sharedResult.navigation,
        templates: sharedResult.templates,
        designTokens: sharedResult.designTokens,
        designSystem: designResult.designSystem ?? undefined,
      },
      errors: [],
    };

    // Convert plain object back to Map (JSON serialization converts Map to object)
    const sitemapMetaMap = new Map<string, SitemapMetadata>(
      Object.entries(sitemapResult.sitemapMetaByUrl || {})
    );

    // Persist results
    await resultHandler.persist(jobId, pipelineResult, {
      sitemapMetaByUrl: sitemapMetaMap,
      domProbeCapture: designResult.domProbeCapture,
      skipDesignSystemProcessing: true,
    });

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

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Internal Import Persist API] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal error" },
      { status: 500 }
    );
  }
}
