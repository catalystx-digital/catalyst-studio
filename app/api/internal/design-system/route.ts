/**
 * Internal API for Design System Generation
 *
 * This endpoint handles DOM probe capture and design system generation.
 * Workflow steps call this API because Prisma can't be bundled in workflow step code.
 */

import { NextRequest, NextResponse } from "next/server";
import { DomProbeService } from "@/lib/studio/design-system/dom-probe/service";
import { importDesignSystemFromUrl } from "@/lib/studio/design-system/import-design-system";
import { isDomProbeEnabledForWebsite } from "@/lib/studio/import/utils/dom-probe-flags";

export const maxDuration = 300;

// Verify request is internal (from same server or workflow step)
function isInternalRequest(request: NextRequest): boolean {
  const host = request.headers.get("host");

  // Accept localhost requests
  if (host?.includes("localhost") || host?.includes("127.0.0.1")) {
    return true;
  }

  // Check for internal workflow header
  const workflowHeader = request.headers.get("x-workflow-internal");
  if (process.env.WORKFLOW_INTERNAL_SECRET && workflowHeader === process.env.WORKFLOW_INTERNAL_SECRET) {
    return true;
  }

  // Accept requests with valid Vercel automation bypass token
  // This allows Vercel Workflow steps to call internal APIs
  const bypassToken = request.nextUrl.searchParams.get("x-vercel-protection-bypass");
  if (bypassToken && bypassToken === process.env.VERCEL_AUTOMATION_BYPASS_SECRET) {
    return true;
  }

  // Reject unknown requests
  return false;
}

interface GenerateDesignSystemRequest {
  websiteId: string;
  targetUrl: string;
}

export async function POST(request: NextRequest) {
  if (!isInternalRequest(request)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = (await request.json()) as GenerateDesignSystemRequest;
    const { websiteId, targetUrl } = body;

    const domProbeEnabled = isDomProbeEnabledForWebsite(websiteId);
    if (!domProbeEnabled) {
      console.log(`[Internal Design System API] DOM probe disabled for website ${websiteId}`);
      return NextResponse.json({
        success: true,
        data: {
          designSystem: null,
          domProbeCapture: null,
        },
      });
    }

    const domProbeService = new DomProbeService();

    // Capture DOM probe
    const captureResult = await domProbeService.captureDesignSystem({
      websiteId,
      targetUrl,
      refresh: true,
    });

    // Process design system
    const dsResult = await importDesignSystemFromUrl({
      url: targetUrl,
      websiteId,
      existingProbeCapture: captureResult,
      useNewFormat: true,
    });

    return NextResponse.json({
      success: true,
      data: {
        designSystem: dsResult.designSystem ?? null,
        domProbeCapture: captureResult,
      },
    });
  } catch (error) {
    console.error("[Internal Design System API] Error:", error);
    return NextResponse.json({
      success: false,
      data: {
        designSystem: null,
        domProbeCapture: null,
      },
      error: error instanceof Error ? error.message : "Internal error",
    });
  }
}
