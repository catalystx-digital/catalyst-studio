/**
 * Import Website Workflow
 *
 * Durable workflow for importing websites using Vercel Workflow SDK.
 * Each pipeline stage is a separate step that can be resumed on failure.
 *
 * Stages:
 * 1. Sitemap Discovery - Expand URLs from the import target
 * 2. Page Processing - Detect components on each page (parallel, per-page steps)
 * 3. Shared Component Extraction - Extract navigation and shared components
 * 4. Design System Generation - Run DOM probe and extract design tokens
 * 5. Persist Results - Save all data to database
 */

import { sleep, FatalError } from "workflow";
// IMPORTANT: Database operations use internal API routes instead of direct Prisma imports.
// Vercel Workflow bundles step code separately and Prisma's generated client paths break.
// See: app/api/internal/import-job/route.ts, import-persist/route.ts, design-system/route.ts
import { ImportJobStatus } from "@/lib/studio/import/types/import-job.types";
import { ConcurrencyConfig, TimeoutConfig } from "@/lib/studio/import/config/import-config";
import type { ImportDetectionResult } from "@/lib/studio/import/web-detection";
import type { ExpandedImportUrls } from "@/lib/studio/import/services/sitemap-discovery.service";
import type { NavigationHierarchy, Template, DesignTokens, NavigationPage, TemplateRegion } from "@/lib/studio/import/types";
import type { CapturedDesignSystem } from "@/lib/studio/import/types/design-system.types";
import type { CaptureDesignSystemResult } from "@/lib/studio/design-system/dom-probe/service";

// ============================================================================
// Types
// ============================================================================

export interface ImportWorkflowInput {
  jobId: string;
  websiteId: string;
  url: string;
  accountId: string;
  model?: string;
  options?: {
    maxUrls?: number;
    model?: string;
  };
}

export interface ImportWorkflowResult {
  success: boolean;
  jobId: string;
  pagesProcessed: number;
  componentsDetected: number;
  errors: string[];
}

interface PageProcessingResult {
  url: string;
  detection: ImportDetectionResult | null;
  error?: string;
  attemptToken?: string | null;
}

interface PlannedImportUrl {
  url: string;
  normalizedUrl?: string;
  attemptToken?: string | null;
}

type WorkflowImportUrls = ExpandedImportUrls & {
  stagePlans?: PlannedImportUrl[];
};

interface SharedComponentsResult {
  navigation: NavigationHierarchy;
  templates: Template[];
  designTokens: DesignTokens;
}

interface DesignSystemResult {
  designSystem: CapturedDesignSystem | null;
  domProbeCapture: CaptureDesignSystemResult | null;
}

// ============================================================================
// Main Workflow
// ============================================================================

/**
 * Main import website workflow.
 * Orchestrates the import process with durable steps for each stage.
 */
export async function importWebsiteWorkflow(input: ImportWorkflowInput): Promise<ImportWorkflowResult> {
  "use workflow";

  const { jobId, websiteId, url, accountId, model, options } = input;
  const errors: string[] = [];
  // Use ConcurrencyConfig.maxUrls as default (reads from IMPORT_MAX_URLS env var)
  const maxUrls = options?.maxUrls ?? ConcurrencyConfig.maxUrls;

  try {
    await assertRunActiveStep(jobId);

    // Stage 1: Discover sitemap and expand URLs
    const sitemapResult = await loadImportUrlsStep(jobId, url, maxUrls);

    if (sitemapResult.urls.length === 0) {
      errors.push("No URLs discovered from sitemap");
      await markJobFailedStep(jobId, "No URLs discovered from sitemap");
      return { success: false, jobId, pagesProcessed: 0, componentsDetected: 0, errors };
    }

    // Update job with discovered URLs
    await updateJobProgressStep(jobId, 10, `Discovered ${sitemapResult.urls.length} pages`, {
      totalPages: sitemapResult.urls.length,
    });

    // Stage 2: Process pages in parallel batches for performance
    // Uses ConcurrencyConfig.detection but capped at 4 to avoid overwhelming APIs
    const pageResults: PageProcessingResult[] = [];
    const totalPages = sitemapResult.urls.length;
    const batchSize = Math.min(ConcurrencyConfig.detection, 4); // Cap at 4 for workflow stability

    for (let batchStart = 0; batchStart < totalPages; batchStart += batchSize) {
      const batchEnd = Math.min(batchStart + batchSize, totalPages);
      const batchUrls = sitemapResult.urls.slice(batchStart, batchEnd);
      const batchNum = Math.floor(batchStart / batchSize) + 1;
      const totalBatches = Math.ceil(totalPages / batchSize);

      const batchPlans = batchUrls.map((pageUrl) =>
        sitemapResult.stagePlans?.find((plan) => plan.url === pageUrl)
      );
      const settledResults = await Promise.allSettled(
        batchUrls.map((pageUrl, index) =>
          processPageStep(jobId, pageUrl, websiteId, options?.model ?? model, batchPlans[index]?.attemptToken ?? null)
        )
      );
      const batchResults = settledResults.map((result, index): PageProcessingResult => {
        if (result.status === "fulfilled") return result.value;
        const error = result.reason instanceof Error ? result.reason.message : String(result.reason);
        return { url: batchUrls[index], detection: null, error, attemptToken: batchPlans[index]?.attemptToken ?? null };
      });

      pageResults.push(...batchResults);

      // Update progress after each batch
      const progress = 10 + Math.floor((batchEnd / totalPages) * 50);
      await updateJobProgressStep(
        jobId,
        progress,
        `Processed batch ${batchNum}/${totalBatches} (${batchEnd}/${totalPages} pages)`,
        {
          totalPages,
          currentUrl: batchUrls[batchUrls.length - 1],
          processedCount: batchEnd,
        }
      );

      // Small delay between batches to avoid rate limiting
      if (batchEnd < totalPages) {
        await pauseBetweenBatches("500ms");
      }
    }

    const activeAttemptTokens = sitemapResult.stagePlans
      ?.map((plan) => plan.attemptToken)
      .filter((token): token is string => typeof token === "string" && token.length > 0) ?? [];
    const successfulDetections = await loadSuccessfulDetectionsStep(jobId, activeAttemptTokens);

    // Collect errors from failed pages
    for (const result of pageResults) {
      if (result.error) {
        errors.push(`Page ${result.url}: ${result.error}`);
      }
    }

    if (successfulDetections.length === 0) {
      const message = "No pages were successfully detected";
      errors.push(message);
      await markJobFailedStep(jobId, message);
      return { success: false, jobId, pagesProcessed: 0, componentsDetected: 0, errors };
    }

    await updateJobProgressStep(jobId, 60, "Extracting shared components...");

    // Stage 3: Extract shared components
    const sharedResult = await extractSharedComponentsStep(successfulDetections);

    await updateJobProgressStep(jobId, 70, "Generating design system...");

    // Stage 4: Generate design system
    const designResult = await generateDesignSystemStep(
      websiteId,
      sitemapResult.urls[0],
      successfulDetections
    );

    await updateJobProgressStep(jobId, 85, "Persisting results...");

    // Stage 5: Persist all results
    await persistResultsStep(
      jobId,
      websiteId,
      successfulDetections,
      sharedResult,
      designResult,
      sitemapResult,
      activeAttemptTokens
    );

    // Calculate totals
    const totalComponents = successfulDetections.reduce(
      (sum, d) => sum + (d.components?.length ?? 0),
      0
    );

    await updateJobProgressStep(jobId, 100, "Import completed");

    return {
      success: true,
      jobId,
      pagesProcessed: successfulDetections.length,
      componentsDetected: totalComponents,
      errors,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    errors.push(errorMessage);

    // Mark job as failed
    await markJobFailedStep(jobId, errorMessage);

    return {
      success: false,
      jobId,
      pagesProcessed: 0,
      componentsDetected: 0,
      errors,
    };
  }
}

// ============================================================================
// Step Functions
// ============================================================================

/**
 * Step 1: Discover sitemap and expand URLs for import.
 * Wraps SitemapDiscoveryService.expandUrlsForImport()
 */
async function loadImportUrlsStep(jobId: string, url: string, maxUrls: number): Promise<WorkflowImportUrls> {
  "use step";

  try {
    const response = await fetch(getInternalApiUrl("/api/internal/import-job"), {
      method: "POST",
      headers: getInternalApiHeaders(),
      body: JSON.stringify({
        action: "getRunPlan",
        jobId,
      }),
    });

    if (response.ok) {
      const result = await response.json();
      const urls = Array.isArray(result.data?.urls)
        ? result.data.urls.filter((candidate: unknown): candidate is string => typeof candidate === "string")
        : [];
      const stagePlans = Array.isArray(result.data?.stagePlans)
        ? result.data.stagePlans.filter((candidate: unknown): candidate is PlannedImportUrl =>
            Boolean(candidate) &&
            typeof candidate === "object" &&
            typeof (candidate as { url?: unknown }).url === "string"
          )
        : [];
      if (urls.length > 0 || result.data?.runId) {
        return {
          urls: urls.slice(0, maxUrls),
          sitemapMetaByUrl: new Map(),
          detectedPlatform: null,
          stagePlans,
        };
      }
    }
  } catch (error) {
    console.warn("[ImportWorkflow] Failed to load staged URL plan, falling back to discovery:", error);
  }

  // Validate URL format - this is a non-recoverable error
  try {
    new URL(url);
  } catch {
    throw new FatalError(`Invalid URL format: ${url}`);
  }

  const { SitemapDiscoveryService } = await import(
    "@/lib/studio/import/services/sitemap-discovery.service"
  );

  const sitemapDiscovery = new SitemapDiscoveryService();
  return sitemapDiscovery.expandUrlsForImport(url, maxUrls);
}

/**
 * Step 2: Process a single page and detect components.
 * Each page is a separate durable step for fine-grained resume.
 */
async function processPageStep(
  jobId: string,
  pageUrl: string,
  websiteId: string,
  model?: string,
  attemptToken?: string | null
): Promise<PageProcessingResult> {
  "use step";

  try {
    await assertRunActiveHttp(jobId);
    await upsertPageStageHttp(jobId, {
      pageUrl,
      status: "processing",
      phase: "detect_page",
      title: deriveFallbackPageTitle(pageUrl),
      attemptToken,
    });

    const { getDetectionService } = await import("@/lib/studio/import/web-detection");
    const detectionService = getDetectionService();

    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      // Missing API key is a fatal configuration error - won't recover on retry
      throw new FatalError("OPENROUTER_API_KEY not configured");
    }

    const detection = await withPageBudget(
      detectionService.detectComponentsFromUrl(pageUrl, {
        model,
        apiKey,
        includeContent: true,
      }),
      TimeoutConfig.perPageMs,
      pageUrl
    );

    await upsertPageStageHttp(jobId, {
      pageUrl,
      status: "detected",
      phase: "detect_page",
      title: derivePageTitle(detection),
      detectionPayload: detection,
      attemptToken,
    });

    return { url: pageUrl, detection, attemptToken };
  } catch (error) {
    // Re-throw FatalErrors as-is
    if (error instanceof FatalError) {
      throw error;
    }

    // Log and continue for transient errors (let workflow handle retries for the step)
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[ImportWorkflow] Page detection failed for ${pageUrl}:`, errorMessage);
    const isTimeout = error instanceof Error && error.name === "PageDetectionTimeoutError";
    await upsertPageStageHttp(jobId, {
      pageUrl,
      status: "failed_retryable",
      phase: "detect_page",
      title: deriveFallbackPageTitle(pageUrl),
      attemptToken,
      error: {
        code: isTimeout ? "PAGE_DETECTION_TIMEOUT" : "PAGE_DETECTION_FAILED",
        category: "llm_retryable",
        retryable: true,
        scope: "page",
        phase: "detect_page",
        pageUrl,
        message: errorMessage,
        attempts: 1,
        firstSeenAt: new Date().toISOString(),
        lastSeenAt: new Date().toISOString(),
      },
    });
    return { url: pageUrl, detection: null, error: errorMessage, attemptToken };
  }
}

async function loadSuccessfulDetectionsStep(jobId: string, attemptTokens: string[]): Promise<ImportDetectionResult[]> {
  "use step";
  const response = await fetch(getInternalApiUrl("/api/internal/import-job"), {
    method: "POST",
    headers: getInternalApiHeaders(),
    body: JSON.stringify({
      action: "getSuccessfulDetections",
      jobId,
      attemptTokens,
    }),
  });
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to load successful detections: ${error}`);
  }
  const result = await response.json();
  return Array.isArray(result.data?.detections) ? result.data.detections : [];
}

async function upsertPageStageHttp(jobId: string, input: {
  pageUrl: string;
  title?: string | null;
  status: string;
  phase?: string;
  detectionPayload?: unknown;
  pageContent?: unknown;
  structureCandidate?: unknown;
  committedPageId?: string | null;
  error?: unknown;
  attemptToken?: string | null;
}): Promise<void> {
  const response = await fetch(getInternalApiUrl("/api/internal/import-job"), {
    method: "POST",
    headers: getInternalApiHeaders(),
    body: JSON.stringify({
      action: "upsertPageStage",
      jobId,
      ...input,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to persist page stage: ${error}`);
  }
}

function withPageBudget<T>(promise: Promise<T>, timeoutMs: number, pageUrl: string): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  const timeoutPromise = new Promise<T>((_, reject) => {
    timeout = setTimeout(() => {
      const error = new Error(`Page detection timeout after ${timeoutMs}ms: ${pageUrl}`);
      error.name = "PageDetectionTimeoutError";
      reject(error);
    }, timeoutMs);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timeout) clearTimeout(timeout);
  });
}

async function pauseBetweenBatches(duration: "500ms"): Promise<void> {
  if (process.env.STUDIO_DISABLE_WORKFLOW_PLUGIN === "true") {
    await new Promise(resolve => setTimeout(resolve, 500));
    return;
  }

  await sleep(duration);
}

/**
 * Step 3: Extract shared components from detection results.
 * Wraps navigation extraction and template identification.
 */
async function extractSharedComponentsStep(
  detections: ImportDetectionResult[]
): Promise<SharedComponentsResult> {
  "use step";

  // Extract navigation hierarchy from detection results
  const navigation: NavigationHierarchy = extractNavigationFromDetection(detections);

  // Identify page templates from detection patterns
  const templates: Template[] = identifyTemplatesFromDetection(detections);

  // Extract design tokens from components
  const designTokens: DesignTokens = extractDesignTokensFromDetection(detections);

  return { navigation, templates, designTokens };
}

/**
 * Step 4: Generate design system using DOM probe via internal API.
 * Uses HTTP calls because Prisma can't be bundled in workflow steps.
 */
async function generateDesignSystemStep(
  websiteId: string,
  targetUrl: string,
  _detections: ImportDetectionResult[]
): Promise<DesignSystemResult> {
  "use step";

  try {
    const response = await fetch(getInternalApiUrl("/api/internal/design-system"), {
      method: "POST",
      headers: getInternalApiHeaders(),
      body: JSON.stringify({
        websiteId,
        targetUrl,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("[ImportWorkflow] Design system API error:", error);
      return { designSystem: null, domProbeCapture: null };
    }

    const result = await response.json();
    return {
      designSystem: result.data.designSystem,
      domProbeCapture: result.data.domProbeCapture,
    };
  } catch (error) {
    console.error("[ImportWorkflow] Design system generation failed:", error);
    return { designSystem: null, domProbeCapture: null };
  }
}

/**
 * Step 5: Persist all import results to database via internal API.
 * Uses HTTP calls because Prisma can't be bundled in workflow steps.
 *
 * Note: Database connection errors are transient and will be retried by the workflow.
 * Validation errors (e.g., missing required fields) are fatal.
 */
async function persistResultsStep(
  jobId: string,
  websiteId: string,
  detections: ImportDetectionResult[],
  sharedResult: SharedComponentsResult,
  designResult: DesignSystemResult,
  sitemapResult: ExpandedImportUrls,
  attemptTokens: string[]
): Promise<void> {
  "use step";

  // Validate inputs - these are fatal errors that won't recover on retry
  if (!jobId || typeof jobId !== "string") {
    throw new FatalError("Invalid jobId provided to persistResultsStep");
  }
  if (!websiteId || typeof websiteId !== "string") {
    throw new FatalError("Invalid websiteId provided to persistResultsStep");
  }

  await assertRunActiveHttp(jobId);

  const response = await fetch(getInternalApiUrl("/api/internal/import-persist"), {
    method: "POST",
    headers: getInternalApiHeaders(),
    body: JSON.stringify({
      jobId,
      websiteId,
      detections,
      sharedResult,
      designResult,
      attemptTokens,
      sitemapResult: {
        sitemapMetaByUrl: Object.fromEntries(sitemapResult.sitemapMetaByUrl),
      },
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to persist results: ${error}`);
  }
}

interface ProgressDetails {
  totalPages?: number;
  currentUrl?: string | null;
  processedCount?: number;
}

/**
 * Get the base URL for internal API calls.
 * Uses environment variable or falls back to localhost for local development.
 */
function getInternalApiBaseUrl(): string {
  // In production, use the Vercel URL
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  // In local development, use localhost with the dev port
  const port = process.env.PORT || "3000";
  return `http://localhost:${port}`;
}

/**
 * Build a full internal API URL with Vercel deployment protection bypass.
 *
 * When running on Vercel with deployment protection enabled (e.g., Vercel Authentication),
 * workflow steps run in an isolated runtime and their HTTP calls to the same deployment
 * are blocked by the edge protection. The bypass token allows authenticated automation.
 *
 * @see https://vercel.com/docs/deployment-protection/methods-to-bypass-deployment-protection/protection-bypass-automation
 */
function getInternalApiUrl(path: string): string {
  const baseUrl = getInternalApiBaseUrl();
  const url = new URL(path, baseUrl);

  // Add bypass token for Vercel deployment protection (only in production)
  const bypassSecret = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
  if (bypassSecret && process.env.VERCEL_URL) {
    url.searchParams.set("x-vercel-protection-bypass", bypassSecret);
  }

  return url.toString();
}

function getInternalApiHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (process.env.WORKFLOW_INTERNAL_SECRET) {
    headers["x-workflow-internal"] = process.env.WORKFLOW_INTERNAL_SECRET;
  }
  return headers;
}

/**
 * Step: Update job progress in database via internal API.
 * Uses HTTP calls because Prisma can't be bundled in workflow steps.
 */
async function updateJobProgressStep(
  jobId: string,
  progress: number,
  message: string,
  details?: ProgressDetails
): Promise<void> {
  "use step";

  const response = await fetch(getInternalApiUrl("/api/internal/import-job"), {
    method: "POST",
    headers: getInternalApiHeaders(),
    body: JSON.stringify({
      action: "updateProgress",
      jobId,
      progress,
      message,
      details,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to update progress: ${error}`);
  }
}

async function assertRunActiveStep(jobId: string): Promise<void> {
  "use step";
  await assertRunActiveHttp(jobId);
}

async function assertRunActiveHttp(jobId: string): Promise<void> {
  const response = await fetch(getInternalApiUrl("/api/internal/import-job"), {
    method: "POST",
    headers: getInternalApiHeaders(),
    body: JSON.stringify({
      action: "assertRunActive",
      jobId,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new FatalError(`Import run is no longer active: ${error}`);
  }
}

/**
 * Step: Mark job as failed via internal API.
 * Uses HTTP calls because Prisma can't be bundled in workflow steps.
 */
async function markJobFailedStep(jobId: string, errorMessage: string): Promise<void> {
  "use step";

  const response = await fetch(getInternalApiUrl("/api/internal/import-job"), {
    method: "POST",
    headers: getInternalApiHeaders(),
    body: JSON.stringify({
      action: "markFailed",
      jobId,
      errorMessage,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to mark job as failed: ${error}`);
  }
}

// ============================================================================
// Helper Functions (Pure, run within steps)
// ============================================================================

function extractNavigationFromDetection(results: ImportDetectionResult[]): NavigationHierarchy {
  const pages: NavigationPage[] = results.map((r) => ({
    title: derivePageTitle(r),
    url: (() => {
      try {
        return new URL(r.pageUrl).pathname;
      } catch {
        return r.pageUrl;
      }
    })(),
    children: [] as NavigationPage[],
  }));
  return { pages, sections: [] };
}

function derivePageTitle(result: ImportDetectionResult): string {
  if (result.pageMetadata?.title && String(result.pageMetadata.title).trim().length > 0) {
    return String(result.pageMetadata.title).trim();
  }
  try {
    const pathname = new URL(result.pageUrl).pathname;
    if (pathname === "/" || pathname === "") return "Home";
  } catch {
    /* ignore */
  }
  const nav = result.components.find((c) => c.type.toLowerCase().includes("nav"));
  const hero = result.components.find((c) => c.type.toLowerCase().includes("hero"));
  if (nav?.content?.links?.[0]?.label) return String(nav.content.links[0].label);
  if (hero?.content?.heading) return String(hero.content.heading);
  try {
    return new URL(result.pageUrl).pathname.replace(/\//g, " ").trim() || "Home";
  } catch {
    return "Page";
  }
}

function deriveFallbackPageTitle(pageUrl: string): string {
  try {
    const pathname = new URL(pageUrl).pathname;
    if (!pathname || pathname === "/") return "Home";
    return pathname.split("/").filter(Boolean).pop()?.replace(/[-_]+/g, " ") || "Page";
  } catch {
    return "Page";
  }
}

function identifyTemplatesFromDetection(results: ImportDetectionResult[]): Template[] {
  const templateMap = new Map<string, Template>();
  for (const result of results) {
    const regions: TemplateRegion = {
      header: [],
      hero: [],
      main: [],
      footer: [],
    };
    for (const c of result.components) {
      const loc = (c.location || "main") as keyof TemplateRegion;
      if (regions[loc]) {
        regions[loc].push(c.type);
      } else {
        regions.main.push(c.type);
      }
    }
    const key = JSON.stringify(regions);
    if (!templateMap.has(key)) {
      templateMap.set(key, {
        id: `tpl-${templateMap.size + 1}`,
        name: `Template ${templateMap.size + 1}`,
        regions,
        pages: [],
        similarity: 1,
      });
    }
    templateMap.get(key)!.pages.push(result.pageUrl);
  }
  return Array.from(templateMap.values());
}

function extractDesignTokensFromDetection(results: ImportDetectionResult[]): DesignTokens {
  const tokens: DesignTokens = {
    images: [],
    textPatterns: [],
    contentOrganization: [],
    componentUsage: [],
  };
  const imageSet = new Set<string>();
  const textPatternSet = new Set<string>();
  const componentUsageMap = new Map<string, number>();

  for (const r of results) {
    for (const c of r.components) {
      if (c.content?.image) imageSet.add(c.content.image);
      if (Array.isArray(c.content?.images)) {
        c.content.images.forEach((i: string) => imageSet.add(i));
      }
      if (c.content?.backgroundImage) imageSet.add(c.content.backgroundImage);
      if (c.content?.heading) textPatternSet.add("heading");
      if (c.content?.subheading) textPatternSet.add("subheading");
      if (c.content?.body) textPatternSet.add("body");
      componentUsageMap.set(c.type, (componentUsageMap.get(c.type) || 0) + 1);
    }
  }

  tokens.images = Array.from(imageSet);
  tokens.textPatterns = Array.from(textPatternSet);
  tokens.componentUsage = Array.from(componentUsageMap.entries()).map(([type, count]) => ({
    type,
    frequency: count / results.length,
    instances: count,
  }));
  tokens.componentUsage.sort((a, b) => b.frequency - a.frequency);

  return tokens;
}
