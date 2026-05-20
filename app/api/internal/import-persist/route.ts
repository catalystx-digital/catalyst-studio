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

// Verify request is internal (from same server or workflow step)
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
  sitemapMetaByUrl: Record<string, unknown>;
}

interface PersistRequest {
  jobId: string;
  websiteId: string;
  detections: ImportDetectionResult[];
  sharedResult: SharedComponentsResult;
  designResult: DesignSystemResult;
  sitemapResult: SitemapResult;
}

export async function POST(request: NextRequest) {
  if (!isInternalRequest(request)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = (await request.json()) as PersistRequest;
    const { jobId, websiteId, detections, sharedResult, designResult, sitemapResult } = body;

    // Validate required fields
    if (!jobId || typeof jobId !== "string") {
      return NextResponse.json({ error: "Invalid jobId" }, { status: 400 });
    }
    if (!websiteId || typeof websiteId !== "string") {
      return NextResponse.json({ error: "Invalid websiteId" }, { status: 400 });
    }

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
        detectedComponents: detections,
        navigation: sharedResult.navigation,
        templates: sharedResult.templates,
        designTokens: sharedResult.designTokens,
        designSystem: designResult.designSystem ?? undefined,
      },
      errors: [],
    };

    // Convert plain object back to Map (JSON serialization converts Map to object)
    const sitemapMetaMap = new Map<string, unknown>(
      Object.entries(sitemapResult.sitemapMetaByUrl || {})
    );

    // Persist results
    await resultHandler.persist(jobId, pipelineResult, {
      sitemapMetaByUrl: sitemapMetaMap,
      domProbeCapture: designResult.domProbeCapture,
    });

    // Mark job as completed
    await repository.updateStatus(jobId, ImportJobStatus.COMPLETED);
    await repository.update(jobId, { completedAt: new Date() });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Internal Import Persist API] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal error" },
      { status: 500 }
    );
  }
}
