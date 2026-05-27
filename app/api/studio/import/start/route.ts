import { NextRequest, NextResponse } from 'next/server';
import { start } from 'workflow/api';
import { ImportService } from '@/lib/studio/import/services/import-service';
import { importWebsiteWorkflow } from '@/lib/studio/workflows/import-website.workflow';
import { prisma } from '@/lib/prisma';
import { ApiError } from '@/lib/api/errors';
import { getAuthContext } from '@/lib/auth/context';
import { checkAndRecordUsage } from '@/lib/usage/limits';
import { normalizeImportUrl } from '@/lib/studio/import/services/import-run-service';
import { resolveImportModelSelection, type ImportModelMode } from '@/lib/studio/import/config/import-config';

type ImportMode = 'new' | 'merge';
type ApiImportModelMode = Extract<ImportModelMode, 'quality' | 'cheap'>;
const ACTIVE_RUN_STATUSES = ['queued', 'discovering', 'importing', 'running', 'detecting', 'normalizing', 'staged', 'committing'];

function startImportProcessing(input: {
  jobId: string;
  websiteId: string;
  url: string;
  accountId: string;
  model: string;
}): void | Promise<unknown> {
  if (process.env.STUDIO_DISABLE_WORKFLOW_PLUGIN === 'true') {
    void importWebsiteWorkflow(input).then((result) => {
      console.log('[import/start] Local import workflow completed', {
        jobId: input.jobId,
        websiteId: input.websiteId,
        success: result.success,
        pagesProcessed: result.pagesProcessed,
        componentsDetected: result.componentsDetected,
        errorCount: result.errors.length,
      });
    }).catch((error) => {
      console.error('[import/start] Local import workflow failed', {
        jobId: input.jobId,
        websiteId: input.websiteId,
        error: error instanceof Error ? error.message : String(error),
      });
    });
    return;
  }

  return start(importWebsiteWorkflow, [input]);
}

/**
 * Extended request body for import start.
 * Supports three input modes:
 * 1. Single URL (backward compatible): { url: 'https://example.com' }
 * 2. Multiple specific URLs: { urls: ['https://a.com/p1', 'https://a.com/p2'] }
 * 3. Natural language request: { request: 'import all courses', url: 'https://example.com' }
 */
interface ImportStartRequest {
  // Existing fields
  url?: string;
  websiteName?: string;
  mode?: ImportMode;
  targetWebsiteId?: string;

  // New fields for flexible import
  urls?: string[];           // Multiple specific URLs
  request?: string;          // Natural language request
  followSubpages?: boolean;  // Whether to crawl subpages (default: true)
  maxDepth?: number;         // Max link depth (default: 3)
  modelMode?: ApiImportModelMode;
}

/**
 * Validate a single URL and return error message or null if valid.
 */
function validateUrl(url: string): string | null {
  // Check for non-HTTP protocols BEFORE normalization
  const nonHttpProtocols = /^(ftp|file|mailto|tel|javascript|data|sftp|ssh|git|svn)[:\/]/i;
  if (nonHttpProtocols.test(url.trim())) {
    return 'Only HTTP and HTTPS URLs are supported';
  }

  try {
    const urlObj = new URL(url);

    // Must be HTTP or HTTPS
    if (!['http:', 'https:'].includes(urlObj.protocol)) {
      return 'Please provide a valid website URL (HTTP or HTTPS)';
    }

    // Reject localhost and internal IPs
    const hostname = urlObj.hostname.toLowerCase();
    if (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname.startsWith('192.168.') ||
      hostname.startsWith('10.') ||
      hostname.startsWith('172.')
    ) {
      return 'Cannot import from localhost or internal IP addresses';
    }

    // Validate hostname has a valid TLD (at least one dot followed by 2+ letters)
    const validTldPattern = /\.[a-zA-Z]{2,}$/;
    if (!validTldPattern.test(hostname)) {
      return 'Please provide a valid website URL with a valid domain';
    }

    // Check for malformed paths (like //ftp in path from "ftp//example.com")
    if (urlObj.pathname.includes('//')) {
      return 'Invalid URL format';
    }

    return null;
  } catch {
    return 'Please provide a valid website URL';
  }
}

export async function POST(request: NextRequest) {
  try {
    const body: ImportStartRequest = await request.json();

    const {
      url,
      urls,
      request: importRequest,
      websiteName,
      mode = 'new',
      targetWebsiteId,
      followSubpages = true,
      maxDepth = 3,
      modelMode = 'quality',
    } = body;

    if (modelMode !== 'quality' && modelMode !== 'cheap') {
      return NextResponse.json(
        { error: 'Invalid model mode. Expected "quality" or "cheap".' },
        { status: 400 }
      );
    }

    // Validate: must have at least one of: url, urls, or request with url
    if (!url && (!urls || urls.length === 0)) {
      // Natural language request still needs at least one URL for context
      if (importRequest) {
        return NextResponse.json(
          { error: 'A URL is required even with a natural language request' },
          { status: 400 }
        );
      }
      return NextResponse.json(
        { error: 'At least one of url or urls is required' },
        { status: 400 }
      );
    }

    // Collect all URLs to validate
    const allUrls: string[] = [];
    if (url) {
      allUrls.push(url);
    }
    if (urls && urls.length > 0) {
      allUrls.push(...urls);
    }

    // Validate all URLs
    for (const u of allUrls) {
      const validationError = validateUrl(u);
      if (validationError) {
        return NextResponse.json(
          { error: validationError },
          { status: 400 }
        );
      }
    }

    // Ensure all URLs are from the same domain (for consistency)
    if (allUrls.length > 1) {
      try {
        const hosts = new Set(allUrls.map(u => new URL(u).host.toLowerCase()));
        if (hosts.size > 1) {
          return NextResponse.json(
            { error: 'All URLs must be from the same domain' },
            { status: 400 }
          );
        }
      } catch {
        return NextResponse.json(
          { error: 'Invalid URL format' },
          { status: 400 }
        );
      }
    }

    if (mode !== 'new' && mode !== 'merge') {
      return NextResponse.json(
        { error: 'Invalid import mode' },
        { status: 400 }
      );
    }

    // Validate OpenRouter API key before creating a website/job so failed starts do not leave orphan sites.
    const openRouterApiKey = process.env.OPENROUTER_API_KEY;
    if (!openRouterApiKey) {
      return NextResponse.json(
        { error: 'Import service not configured. Please contact support.' },
        { status: 500 }
      );
    }
    const modelSelection = resolveImportModelSelection({ ...process.env, IMPORT_MODEL_MODE: modelMode });

    const auth = await getAuthContext(request);

    let websiteId: string;

    // Get primary URL for website creation
    const primaryUrl = url || (urls && urls.length > 0 ? urls[0] : '');
    const idempotencyKey = buildImportIdempotencyKey({
      primaryUrl,
      urls,
      importRequest,
      followSubpages,
      maxDepth,
      modelMode: modelSelection.mode,
      modelChain: modelSelection.chain,
    });

    if (mode === 'merge') {
      if (!targetWebsiteId) {
        return NextResponse.json(
          { error: 'targetWebsiteId is required when merging into an existing site' },
          { status: 400 }
        );
      }

      const existingWebsite = await (prisma as any).website.findUnique({
        where: { id: targetWebsiteId },
        select: { id: true, accountId: true },
      });

      if (!existingWebsite || existingWebsite.accountId !== auth.accountId) {
        return NextResponse.json(
          { error: 'Website not found' },
          { status: 404 }
        );
      }

      websiteId = existingWebsite.id;

      const existingRun = await (prisma as any).importRun.findFirst({
        where: {
          websiteId,
          status: { in: ACTIVE_RUN_STATUSES },
        },
        orderBy: { createdAt: 'desc' },
        select: { importJobId: true, idempotencyKey: true },
      });

      if (existingRun) {
        if (existingRun.idempotencyKey === idempotencyKey) {
          return NextResponse.json({
            jobId: existingRun.importJobId,
            websiteId,
            mode,
            modelMode: modelSelection.mode,
            modelFallback: modelSelection.fallbackEnabled,
            replayed: true,
            message: 'Import is already running',
            initialSitemap: [],
          });
        }
        return NextResponse.json(
          { error: 'An import is already running for this website' },
          { status: 409 }
        );
      }
      await checkAndRecordUsage(prisma as any, auth.accountId, 'import_page', 1, { metadata: { mode, modelMode: modelSelection.mode } });
    } else {
      await checkAndRecordUsage(prisma as any, auth.accountId, 'import_page', 1, { metadata: { mode, modelMode: modelSelection.mode } });
      const newWebsite = await prisma.website.create({
        data: {
          name: websiteName || new URL(primaryUrl).hostname,
          category: 'imported',
          description: `Imported from ${primaryUrl}`,
          isActive: true,
          accountId: auth.accountId,
        },
      });

      websiteId = newWebsite.id;
    }

    // Initialize import service
    const importService = new ImportService();

    // Create import job record with new options
    const result = await importService.startImport({
      websiteId,
      url: primaryUrl,
      urls: urls && urls.length > 0 ? urls : undefined,
      request: importRequest,
      accountId: auth.accountId,
      followSubpages,
      maxDepth,
      idempotencyKey,
      modelMode: modelSelection.mode,
      modelChain: modelSelection.chain,
    });

    await startImportProcessing({
      jobId: result.job.id,
      websiteId,
      url: primaryUrl,
      accountId: auth.accountId,
      model: modelSelection.primary,
    });

    return NextResponse.json({
      jobId: result.job.id,
      websiteId,
      mode,
      modelMode: modelSelection.mode,
      modelFallback: modelSelection.fallbackEnabled,
      message: result.message,
      initialSitemap: result.initialSitemap ?? [],
    });
  } catch (error) {
    console.error('Error starting import:', error);

    if (error instanceof ApiError) {
      return NextResponse.json(
        {
          error: {
            message: error.message,
            code: error.code,
            details: error.details,
          },
        },
        { status: error.statusCode }
      );
    }

    const message = error instanceof Error ? error.message : 'Failed to start import';

    if (message.toLowerCase().includes('rate limit')) {
      return NextResponse.json(
        { error: 'Import temporarily unavailable. Please try again in a few minutes.' },
        { status: 429 }
      );
    }

    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}

function buildImportIdempotencyKey(input: {
  primaryUrl: string;
  urls?: string[];
  importRequest?: string;
  followSubpages: boolean;
  maxDepth: number;
  modelMode: ImportModelMode;
  modelChain: string;
}): string {
  const normalizedUrls = (input.urls && input.urls.length > 0 ? input.urls : [input.primaryUrl])
    .map(normalizeImportUrl)
    .sort();
  return JSON.stringify({
    urls: normalizedUrls,
    request: input.importRequest?.trim() ?? '',
    followSubpages: input.followSubpages,
    maxDepth: input.maxDepth,
    modelMode: input.modelMode,
    modelChain: input.modelChain,
  });
}
