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
import { isAuthorizedInternalWorkflowRequest } from "@/lib/studio/workflows/internal-auth";

export const maxDuration = 300;

interface GenerateDesignSystemRequest {
  websiteId: string;
  targetUrl: string;
}

export async function POST(request: NextRequest) {
  if (!isAuthorizedInternalWorkflowRequest(request)) {
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
