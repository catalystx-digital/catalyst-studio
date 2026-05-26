#!/usr/bin/env npx tsx
/**
 * Standalone Import Script - POC for Process Isolation
 *
 * This script runs the import process independently of the Next.js application,
 * using its own Prisma client instance to prove imports can be decoupled.
 *
 * IMPORTANT: Environment Loading Strategy
 * ----------------------------------------
 * We use dynamic imports (await import()) instead of static imports for all
 * application modules. This is critical because:
 *
 * 1. JavaScript hoists static imports - they execute BEFORE any other code,
 *    even if dotenv.config() appears first in the source file.
 *
 * 2. Many modules (like import-config.ts) read process.env at module load time
 *    and cache the values. If .env.local hasn't loaded yet, they get defaults.
 *
 * 3. Dynamic imports execute at runtime in the order written, so we can
 *    guarantee dotenv loads before any env-dependent modules.
 *
 * This pattern ensures .env.local is the source of truth for all config,
 * matching how Next.js loads environment variables.
 *
 * Usage:
 *   npx tsx scripts/standalone-import.ts --url "https://example.com" --email "kikuxuzac@mailinator.com"
 *   npx tsx scripts/standalone-import.ts --url "https://example.com" --email "kikuxuzac@mailinator.com" --max-pages 50
 */

// =============================================================================
// Step 1: Load environment FIRST (before any application imports)
// These are the ONLY static imports allowed - they have no env dependencies
// =============================================================================
import * as dotenv from 'dotenv';
import * as path from 'path';
import { createId } from '@paralleldrive/cuid2';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

// =============================================================================
// CLI Argument Parsing (no env dependencies, safe as static code)
// =============================================================================

interface ScriptArgs {
  url: string;
  email: string;
  maxPages: number;
  /** Job ID to resume from checkpoint */
  resumeJobId?: string;
  /** Retain checkpoint files after successful import */
  retainCheckpoint?: boolean;
  /** Priority URLs/paths to process first (comma-separated) */
  priorityUrls?: string;
  /** Override IMPORT_MODEL_CHAIN for this run */
  modelChain?: string;
  /** Override IMPORT_CONCURRENCY for this run */
  concurrency?: number;

  // Re-import mode options
  /** Enable re-import mode */
  reimport?: boolean;
  /** Target website ID for re-import */
  websiteId?: string;
  /** Comma-separated URLs to re-import */
  urls?: string;
  /** Preserve local customizations where component types match */
  preserveCustomizations?: boolean;
  /** Skip design system update */
  skipDesignSystem?: boolean;
  /** Skip shared component detection */
  skipSharedComponents?: boolean;
  /** Create page if not found locally */
  createIfNotExists?: boolean;
  /** Preview changes without saving */
  dryRun?: boolean;
}

function parseArgs(argv: string[]): ScriptArgs {
  const args: Partial<ScriptArgs> = {
    maxPages: 10,
    retainCheckpoint: false,
    preserveCustomizations: false,
    skipDesignSystem: true,
    skipSharedComponents: false,
    createIfNotExists: true,
    dryRun: false
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--url' && argv[i + 1]) {
      args.url = argv[++i];
    } else if (arg === '--email' && argv[i + 1]) {
      args.email = argv[++i];
    } else if (arg === '--max-pages' && argv[i + 1]) {
      args.maxPages = parseInt(argv[++i], 10);
    } else if (arg === '--resume' && argv[i + 1]) {
      args.resumeJobId = argv[++i];
    } else if (arg === '--retain-checkpoint') {
      args.retainCheckpoint = true;
    } else if (arg === '--priority-urls' && argv[i + 1]) {
      args.priorityUrls = argv[++i];
    } else if (arg === '--model-chain' && argv[i + 1]) {
      args.modelChain = argv[++i];
    } else if (arg === '--concurrency' && argv[i + 1]) {
      args.concurrency = parseInt(argv[++i], 10);
    }
    // Re-import mode arguments
    else if (arg === '--reimport') {
      args.reimport = true;
    } else if (arg === '--website-id' && argv[i + 1]) {
      args.websiteId = argv[++i];
    } else if (arg === '--urls' && argv[i + 1]) {
      args.urls = argv[++i];
    } else if (arg === '--preserve-customizations') {
      args.preserveCustomizations = true;
    } else if (arg === '--skip-design-system') {
      args.skipDesignSystem = true;
    } else if (arg === '--no-skip-design-system') {
      args.skipDesignSystem = false;
    } else if (arg === '--skip-shared-components') {
      args.skipSharedComponents = true;
    } else if (arg === '--create-if-not-exists=false') {
      args.createIfNotExists = false;
    } else if (arg === '--dry-run') {
      args.dryRun = true;
    }
  }

  // Re-import mode: requires --reimport, --website-id, and --urls
  if (args.reimport) {
    if (!args.websiteId) {
      console.error('Error: --website-id is required for re-import mode');
      printUsage();
      process.exit(1);
    }
    if (!args.urls) {
      console.error('Error: --urls is required for re-import mode');
      printUsage();
      process.exit(1);
    }
    return args as ScriptArgs;
  }

  // Resume mode: only requires --resume (email not needed, job already has websiteId)
  if (args.resumeJobId) {
    return args as ScriptArgs;
  }

  // Normal mode: requires --url and --email
  if (!args.url) {
    console.error('Error: --url is required');
    printUsage();
    process.exit(1);
  }

  if (!args.email) {
    console.error('Error: --email is required');
    process.exit(1);
  }

  return args as ScriptArgs;
}

function applyRuntimeOverrides(args: ScriptArgs): void {
  if (args.modelChain?.trim()) {
    process.env.IMPORT_MODEL_CHAIN = args.modelChain.trim();
  }

  if (args.concurrency !== undefined) {
    if (!Number.isFinite(args.concurrency) || args.concurrency < 1) {
      console.error('Error: --concurrency must be a positive integer');
      process.exit(1);
    }
    process.env.IMPORT_CONCURRENCY = String(Math.floor(args.concurrency));
  }
}

function printUsage(): void {
  console.error('Usage:');
  console.error('');
  console.error('  New import:');
  console.error('    npx tsx scripts/standalone-import.ts --url "https://example.com" --email "kikuxuzac@mailinator.com"');
  console.error('');
  console.error('  Import with priority URLs (process certain sections first):');
  console.error('    npx tsx scripts/standalone-import.ts --url "https://example.com" --email "kikuxuzac@mailinator.com" --max-pages 100 --priority-urls "/about,/services,/contact"');
  console.error('');
  console.error('  Resume failed import:');
  console.error('    npx tsx scripts/standalone-import.ts --resume <jobId>');
  console.error('');
  console.error('  Re-import pages:');
  console.error('    npx tsx scripts/standalone-import.ts --reimport \\');
  console.error('      --website-id "clxxx..." \\');
  console.error('      --urls "https://example.com/about,https://example.com/contact"');
  console.error('');
  console.error('  Re-import with options:');
  console.error('    npx tsx scripts/standalone-import.ts --reimport \\');
  console.error('      --website-id "clxxx..." \\');
  console.error('      --urls "https://example.com/about" \\');
  console.error('      --preserve-customizations \\');
  console.error('      --skip-shared-components \\');
  console.error('      --dry-run');
  console.error('');
  console.error('Import flags:');
  console.error('  --url <url>                 Source website URL (required for new import)');
  console.error('  --email <email>             User email for account lookup (required for new import)');
  console.error('  --max-pages <n>             Maximum pages to import (default: 10)');
  console.error('  --priority-urls <paths>     Comma-separated paths to process first');
  console.error('                              (e.g., "/about,/services,/contact")');
  console.error('  --model-chain <models>      Override IMPORT_MODEL_CHAIN for this run');
  console.error('  --concurrency <n>           Override IMPORT_CONCURRENCY for this run');
  console.error('  --retain-checkpoint         Keep checkpoint files after success');
  console.error('');
  console.error('Re-import flags:');
  console.error('  --reimport                  Enable re-import mode (required)');
  console.error('  --website-id <id>           Target website ID (required)');
  console.error('  --urls <urls>               Comma-separated source URLs (required)');
  console.error('  --preserve-customizations   Keep local edits where possible');
  console.error('  --skip-design-system        Don\'t update design tokens (default: true)');
  console.error('  --skip-shared-components    Don\'t re-detect shared components');
  console.error('  --create-if-not-exists=false  Don\'t create page if not found');
  console.error('  --dry-run                   Preview changes without saving');
}

// =============================================================================
// Re-Import Mode Handler
// =============================================================================

async function runReImport(
  args: ScriptArgs,
  PrismaClient: any,
  ReImportService: any,
  ImportPipeline: any
): Promise<void> {
  console.log('='.repeat(60));
  console.log('[Re-Import] Starting page re-import...');
  console.log(`  Website ID: ${args.websiteId}`);
  console.log(`  URLs: ${args.urls}`);
  if (args.preserveCustomizations) console.log('  Preserve Customizations: yes');
  if (args.skipDesignSystem) console.log('  Skip Design System: yes');
  if (args.skipSharedComponents) console.log('  Skip Shared Components: yes');
  if (!args.createIfNotExists) console.log('  Create If Not Exists: no');
  if (args.dryRun) console.log('  Dry Run: yes (no changes will be saved)');
  console.log('='.repeat(60));

  // Validate API key
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    console.error('[Error] OPENROUTER_API_KEY environment variable is required');
    process.exit(1);
  }

  // Parse URLs
  const urls = args.urls!.split(',').map(u => u.trim()).filter(Boolean);
  if (urls.length === 0) {
    console.error('[Error] No valid URLs provided');
    process.exit(1);
  }

  console.log(`\n[Step 1/3] Validating ${urls.length} URL(s)...`);

  // Create Prisma client and services
  const prisma = new PrismaClient({
    log: ['error', 'warn'],
  });

  try {
    const importPipeline = new ImportPipeline();
    const reimportService = new ReImportService({
      prisma,
      importPipeline,
    });

    const startTime = Date.now();

    console.log('\n[Step 2/3] Executing re-import...');

    // Execute re-import with progress reporting
    const result = await reimportService.reimport({
      websiteId: args.websiteId!,
      urls,
      preserveCustomizations: args.preserveCustomizations,
      skipDesignSystem: args.skipDesignSystem,
      skipSharedComponents: args.skipSharedComponents,
      createIfNotExists: args.createIfNotExists,
      dryRun: args.dryRun,
      onProgress: ({ message, progress, currentUrl, currentIndex, totalUrls }) => {
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        if (currentUrl) {
          console.log(`  [${elapsed}s] ${progress}% - [${currentIndex}/${totalUrls}] ${message}`);
          console.log(`        → ${currentUrl}`);
        } else {
          console.log(`  [${elapsed}s] ${progress}% - ${message}`);
        }
      },
    });

    // Print results
    console.log('\n[Step 3/3] Processing results...');
    console.log('');

    for (const pageResult of result.results) {
      const statusIcon = getStatusIcon(pageResult.status);
      console.log(`  ${statusIcon} ${pageResult.url}`);

      if (pageResult.pageId) {
        console.log(`        Page ID: ${pageResult.pageId}`);
      }
      if (pageResult.error) {
        console.log(`        Error: ${pageResult.error}`);
      }
      if (pageResult.changes) {
        const { componentsAdded, componentsRemoved, componentsUpdated } = pageResult.changes;
        console.log(`        Components: +${componentsAdded} -${componentsRemoved} ~${componentsUpdated}`);
      }
      if (pageResult.redirectedTo) {
        console.log(`        Redirected to: ${pageResult.redirectedTo}`);
      }
    }

    // Print summary
    console.log('\n' + '='.repeat(60));
    console.log('[Summary]');
    console.log('='.repeat(60));
    console.log(`  Status: ${result.success ? 'SUCCESS' : 'FAILED'}`);
    console.log(`  Total Time: ${(result.processingTimeMs / 1000).toFixed(1)}s`);
    console.log(`  Updated: ${result.summary.updated}`);
    console.log(`  Created: ${result.summary.created}`);
    console.log(`  Unchanged: ${result.summary.unchanged}`);
    console.log(`  Source Not Found: ${result.summary.sourceNotFound}`);
    console.log(`  Failed: ${result.summary.failed}`);
    console.log(`  Skipped: ${result.summary.skipped}`);
    console.log(`  Components Added: ${result.summary.totalComponentsAdded}`);
    console.log(`  Components Removed: ${result.summary.totalComponentsRemoved}`);

    if (result.warnings.length > 0) {
      console.log('\n[Warnings]');
      for (const warning of result.warnings) {
        console.log(`  ⚠ ${warning}`);
      }
    }

    if (args.dryRun) {
      console.log('\n[Note] This was a dry run - no changes were saved to the database.');
    }

    await prisma.$disconnect();
    console.log('\n[Cleanup] Prisma client disconnected');

    if (!result.success) {
      process.exit(1);
    }

  } catch (error) {
    console.error('\n[Error] Re-import failed:', error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

function getStatusIcon(status: string): string {
  switch (status) {
    case 'updated': return '✓';
    case 'created': return '+';
    case 'unchanged': return '=';
    case 'source-not-found': return '⚠ 404';
    case 'source-moved': return '→';
    case 'source-error': return '✗ 5xx';
    case 'source-timeout': return '⏱';
    case 'skipped': return '⊘';
    case 'failed': return '✗';
    default: return '?';
  }
}

function printDetectionTimingSummary(detections: any[]): void {
  const timingResults = detections
    .map((detection) => detection?.timingBreakdown)
    .filter(Boolean);

  if (timingResults.length === 0) {
    return;
  }

  const phaseTotals = new Map<string, { count: number; totalMs: number; maxMs: number; warningCount: number }>();
  let sectionCount = 0;
  let sectionDurationMs = 0;
  let sectionMaxMs = 0;
  let llmRequestCount = 0;
  let promptTokenEstimate = 0;

  for (const timing of timingResults) {
    for (const phase of timing.phaseTotals || []) {
      const current = phaseTotals.get(phase.phase) || { count: 0, totalMs: 0, maxMs: 0, warningCount: 0 };
      current.count += phase.count || 0;
      current.totalMs += phase.totalMs || 0;
      current.maxMs = Math.max(current.maxMs, phase.maxMs || 0);
      current.warningCount += phase.warningCount || 0;
      phaseTotals.set(phase.phase, current);
    }
    for (const section of timing.sectionTimings || []) {
      sectionCount += 1;
      sectionDurationMs += section.durationMs || 0;
      sectionMaxMs = Math.max(sectionMaxMs, section.durationMs || 0);
      llmRequestCount += section.requestCount || 0;
      promptTokenEstimate += section.promptTokensEstimate || 0;
    }
  }

  const sortedPhases = Array.from(phaseTotals.entries())
    .sort(([, a], [, b]) => b.totalMs - a.totalMs);

  console.log('\n[Timing Breakdown]');
  console.log(`  Pages with timing: ${timingResults.length}`);
  console.log(`  Sections: ${sectionCount}`);
  console.log(`  Section avg/max: ${sectionCount > 0 ? (sectionDurationMs / sectionCount / 1000).toFixed(1) : '0.0'}s / ${(sectionMaxMs / 1000).toFixed(1)}s`);
  console.log(`  LLM section requests: ${llmRequestCount}`);
  console.log(`  Prompt token estimate: ${promptTokenEstimate}`);
  console.log('  Summed phase durations (nested/concurrent work, not wall time):');
  for (const [phase, stats] of sortedPhases) {
    console.log(`    - ${phase}: ${(stats.totalMs / 1000).toFixed(1)}s total, ${stats.count} event(s), max ${(stats.maxMs / 1000).toFixed(1)}s, warnings ${stats.warningCount}`);
  }
}

// =============================================================================
// Step 2: Main function with dynamic imports
// All application modules are imported HERE, after dotenv has loaded
// =============================================================================

async function main(args: ScriptArgs) {
  // Dynamic imports - these execute NOW, after dotenv.config() has run
  // This guarantees all env-dependent modules see the correct values
  const { PrismaClient } = await import('../lib/generated/prisma');
  const { ImportPipeline } = await import('../lib/studio/import/import-pipeline');
  const { ImportOrchestrator } = await import('../lib/studio/import/services/import-orchestrator');
  const { ComponentTypeExtractor } = await import('../lib/studio/import/services/component-type-extractor');
  const { PageBuilderService } = await import('../lib/studio/import/services/page-builder-service');
  const { StructureService } = await import('../lib/studio/import/services/structure-service');
  const { CanonicalSignatureSharedComponentDetector } = await import('../lib/studio/import/services/shared-component-detectors/canonical-signature-detector');
  const { SitemapDiscoveryService } = await import('../lib/studio/import/services/sitemap-discovery.service');
  const { ImportResultHandler } = await import('../lib/studio/import/services/import-result-handler');
  const { ImportJobRepository } = await import('../lib/studio/import/repositories/import-job.repository');
  const { ImportProgressManager } = await import('../lib/studio/import/services/import-progress-manager');
  const { ImportJobStatus } = await import('../lib/studio/import/types/import-job.types');
  const { getCheckpointService } = await import('../lib/studio/import/services/checkpoint-service');
  const { CheckpointConfig } = await import('../lib/studio/import/config');
  const { ReImportService } = await import('../lib/studio/import/services/reimport-service');
  const { prioritizeUrls, parsePriorityUrlsArg } = await import('../lib/studio/import/utils/url-prioritizer');

  // Handle re-import mode separately
  if (args.reimport) {
    return await runReImport(args, PrismaClient, ReImportService, ImportPipeline);
  }

  const isResumeMode = !!args.resumeJobId;

  console.log('='.repeat(60));
  console.log(`[Standalone Import] ${isResumeMode ? 'Resuming...' : 'Starting...'}`);
  if (isResumeMode) {
    console.log(`  Resuming Job ID: ${args.resumeJobId}`);
  } else {
    console.log(`  URL: ${args.url}`);
    console.log(`  Email: ${args.email}`);
  }
  console.log(`  Max Pages: ${args.maxPages}`);
  if (args.priorityUrls) {
    console.log(`  Priority URLs: ${args.priorityUrls}`);
  }
  if (args.retainCheckpoint) {
    console.log(`  Retain Checkpoint: yes`);
  }
  if (args.concurrency) {
    console.log(`  Concurrency: ${args.concurrency}`);
  }
  console.log('='.repeat(60));

  // Validate API key
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    console.error('[Error] OPENROUTER_API_KEY environment variable is required');
    process.exit(1);
  }

  // Log which model chain is being used (helps verify env loaded correctly)
  console.log(`  Model Chain: ${process.env.IMPORT_MODEL_CHAIN || '(using defaults)'}`);

  // Create dedicated Prisma client (NOT shared with web app)
  const prisma = new PrismaClient({
    log: ['error', 'warn'],
  });
  const repository = new ImportJobRepository();
  const checkpointService = getCheckpointService();
  let job: { id: string } | undefined;
  let checkpointSession: any = undefined;

  try {
    // Handle resume mode vs new import mode
    let website: { id: string };
    let urlsToScan: string[];
    let urlsContext: { urls: string[]; sitemapMetaByUrl: Map<string, any> };

    if (isResumeMode) {
      // ========== RESUME MODE ==========
      // No account lookup needed - job already has websiteId
      console.log('\n[Step 1/6] Resuming checkpoint session...');

      // Find the checkpoint session
      checkpointSession = await checkpointService.resumeSession(args.resumeJobId!);
      if (!checkpointSession) {
        console.error(`  Error: No checkpoint found for job ${args.resumeJobId}`);
        console.error('  Make sure the job was previously started with checkpointing enabled.');
        process.exit(1);
      }

      console.log(`  Found checkpoint at: ${checkpointSession.cacheDir}`);
      console.log(`  Progress: ${checkpointSession.manifest.progress.completedUrls}/${checkpointSession.manifest.progress.totalUrls} pages completed`);

      // Find the existing job and website
      const existingJob = await repository.findById(args.resumeJobId!);
      if (!existingJob) {
        console.error(`  Error: Job ${args.resumeJobId} not found in database`);
        process.exit(1);
      }

      job = { id: existingJob.id };
      website = { id: existingJob.websiteId };

      // Update job status back to processing
      await repository.updateStatus(job.id, ImportJobStatus.PROCESSING);

      // Load sitemap and pending URLs from checkpoint
      console.log('\n[Step 2/6] Loading checkpoint state...');
      const sitemap = await checkpointService.loadSitemap(checkpointSession);
      const allUrls = sitemap?.urls.map(u => u.url) || [];
      const pendingUrls = await checkpointService.getPendingUrls(checkpointSession);

      // Pass ALL URLs to pipeline - it will skip completed ones automatically
      // This ensures the full result set is available for aggregation stages
      urlsToScan = allUrls;
      urlsContext = {
        urls: allUrls,
        sitemapMetaByUrl: new Map()
      };

      // Show current stage and what will be resumed
      const currentStage = checkpointSession.manifest.currentStage;
      const completedStages = checkpointSession.manifest.completedStages.map((s: any) => s.stage);

      console.log(`  Current stage: ${currentStage}`);
      console.log(`  Completed stages: ${completedStages.join(', ') || '(none)'}`);
      console.log(`  Total URLs: ${allUrls.length}`);
      console.log(`  Pending URLs: ${pendingUrls.length}`);
      console.log(`  Completed URLs: ${allUrls.length - pendingUrls.length}`);

      console.log('\n[Step 3/6] Resuming from checkpoint...');

      // Explain what will happen based on stage
      if (completedStages.includes('page_detection_done')) {
        console.log('  ✓ Page detection complete - will load from checkpoint');
      } else {
        console.log(`  → Will process ${pendingUrls.length} remaining pages`);
      }
      if (completedStages.includes('dom_probe_done')) {
        console.log('  ✓ DOM probe complete - will load from checkpoint');
      }
      if (completedStages.includes('templates_generated')) {
        console.log('  ✓ Templates generated - will load from checkpoint');
      }

    } else {
      // ========== NEW IMPORT MODE ==========
      // 1. Find account via user email
      console.log('\n[Step 1/6] Finding account for user...');
      const user = await prisma.user.findFirst({
        where: { email: args.email },
        include: {
          memberships: {
            include: { account: true },
            take: 1,
          },
        },
      });

      if (!user || !user.memberships[0]?.account) {
        console.error(`  Error: No user found with email ${args.email} or user has no account`);
        process.exit(1);
      }

      const account = user.memberships[0].account;
      console.log(`  Found account: ${account.id} (${account.name})`);

      // 2. Create website record
      console.log('\n[Step 2/6] Creating website record...');
      const websiteName = new URL(args.url).hostname;
      const newWebsite = await prisma.website.create({
        data: {
          id: createId(),
          name: websiteName,
          category: 'imported',
          description: `Standalone import from ${args.url}`,
          isActive: true,
          accountId: account.id,
          updatedAt: new Date(),
        },
      });
      website = newWebsite;
      console.log(`  Created website: ${website.id}`);

      // 3. Create import job record
      console.log('\n[Step 3/6] Creating import job...');
      const newJob = await repository.create({
        websiteId: website.id,
        url: args.url,
        status: ImportJobStatus.PROCESSING,
      });
      job = newJob;
      console.log(`  Created job: ${job.id}`);

      // 4. Discover sitemap
      console.log('\n[Step 4/6] Discovering sitemap...');
      const sitemapDiscovery = new SitemapDiscoveryService();
      // Discover more URLs than maxPages to allow priority filtering to work effectively
      const discoveryLimit = args.priorityUrls ? args.maxPages * 3 : args.maxPages;
      const priorityPaths = args.priorityUrls ? parsePriorityUrlsArg(args.priorityUrls) : [];
      urlsContext = await sitemapDiscovery.expandUrlsForImport(args.url, {
        maxUrls: discoveryLimit,
        priorityPaths
      });
      console.log(`  Found ${urlsContext.urls.length} URLs from sitemap`);
      if (urlsContext.injectedPriorityUrls && urlsContext.injectedPriorityUrls.length > 0) {
        console.log(`  Injected ${urlsContext.injectedPriorityUrls.length} priority URLs not in sitemap`);
      }

      // Apply priority URL reordering if specified
      if (args.priorityUrls) {
        const priorityPaths = parsePriorityUrlsArg(args.priorityUrls);
        console.log(`\n  Applying priority ordering for ${priorityPaths.length} paths...`);

        const prioritized = prioritizeUrls({
          urls: urlsContext.urls,
          priorityPaths,
          maxUrls: args.maxPages
        });

        urlsToScan = prioritized.urls;
        console.log(`  Priority stats:`);
        console.log(`    - Priority exact matches: ${prioritized.stats.priorityExactCount}`);
        console.log(`    - Priority children: ${prioritized.stats.priorityChildrenCount}`);
        console.log(`    - Non-priority pages: ${prioritized.stats.nonPriorityCount}`);
        console.log(`    - Total to scan: ${prioritized.stats.totalOutput}`);
      } else {
        urlsToScan = urlsContext.urls.slice(0, args.maxPages);
        console.log(`  Scanning ${urlsToScan.length} URLs (default order)`);
      }

      // Initialize checkpoint session for new import
      if (CheckpointConfig.enabled) {
        console.log('\n  Initializing checkpoint session...');
        try {
          checkpointSession = await checkpointService.initializeSession(
            job.id,
            website.id,
            args.url,
            { maxPages: args.maxPages }
          );
          await checkpointService.saveSitemap(checkpointSession, urlsToScan, []);
          console.log(`  Checkpoint initialized at: ${checkpointSession.cacheDir}`);
        } catch (err) {
          console.warn('  Warning: Failed to initialize checkpoint:', err);
        }
      }
    }

    // 5. Execute pipeline
    console.log('\n[Step 5/6] Executing import pipeline...');
    const pipeline = new ImportPipeline();
    const startTime = Date.now();

    const result = await pipeline.execute({
      urls: urlsToScan,
      apiKey,
      websiteId: website.id,
      enablePerformanceMonitoring: true,
      generateTemplates: true,
      saveToDatabase: false,
      checkpointSession,
      onProgress: async ({ message, progress }) => {
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        console.log(`  [${elapsed}s] ${progress}% - ${message}`);
      },
    });

    if (!result.success) {
      throw new Error(result.errors?.[0] || 'Pipeline execution failed');
    }

    const invalidDetections = result.data?.detectedComponents.filter(detection => detection.detectionError) ?? [];
    if (invalidDetections.length > 0) {
      throw new Error(
        `Pipeline returned ${invalidDetections.length} failed detection(s); refusing to persist: ` +
        invalidDetections.map(detection => `${detection.pageUrl}: ${detection.detectionError?.message ?? 'No components detected'}`).join('; ')
      );
    }

    console.log(`  Pipeline completed in ${((Date.now() - startTime) / 1000).toFixed(1)}s`);

    // 6. Persist results using existing orchestrator
    console.log('\n[Step 6/6] Persisting results to database...');
    const progressManager = new ImportProgressManager(repository);
    const orchestrator = new ImportOrchestrator({
      componentTypeExtractor: new ComponentTypeExtractor(prisma),
      pageBuilderService: new PageBuilderService(prisma),
      structureService: new StructureService(prisma),
      sharedComponentDetector: new CanonicalSignatureSharedComponentDetector(prisma),
      prisma,
      memoryLimitMB: 4000,
    });

    const resultHandler = new ImportResultHandler({
      repository,
      progressManager,
      orchestrator,
      prisma,
    });

    const domProbeCapture = pipeline.getLastDomProbeCapture();
    await resultHandler.persist(job.id, result, {
      sitemapMetaByUrl: urlsContext.sitemapMetaByUrl,
      orchestratorTimeoutMs: 10 * 60 * 1000,
      domProbeCapture,
    });

    // Clean up progress manager timers BEFORE marking complete to prevent race condition
    // where throttled progress updates overwrite the completed status
    progressManager.cleanup(job.id);

    // Small delay to ensure any in-flight DB updates complete before we set final status
    await new Promise(resolve => setTimeout(resolve, 100));

    // Mark job complete using updateStatus to ensure proper status transition
    await repository.updateStatus(job.id, ImportJobStatus.COMPLETED);

    // Finalize checkpoint (cleanup unless --retain-checkpoint was used)
    if (checkpointSession) {
      if (args.retainCheckpoint) {
        await checkpointService.updateStatus(checkpointSession, 'completed');
        console.log(`\n  Checkpoint retained at: ${checkpointSession.cacheDir}`);
      } else {
        await checkpointService.finalize(checkpointSession, true);
      }
    }

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('[Complete] Import finished successfully!');
    console.log('='.repeat(60));
    console.log(`  Website ID: ${website.id}`);
    console.log(`  Job ID: ${job.id}`);
    console.log(`  Pages processed: ${urlsToScan.length}`);
    console.log(`  Total time: ${((Date.now() - startTime) / 1000).toFixed(1)}s`);

    // Count created records
    const pageCount = await prisma.websitePage.count({ where: { websiteId: website.id } });
    const componentTypeCount = await prisma.websiteComponentType.count({ where: { websiteId: website.id } });
    console.log(`  WebsitePages created: ${pageCount}`);
    console.log(`  ComponentTypes created: ${componentTypeCount}`);
    printDetectionTimingSummary(result.data?.detectedComponents || []);

    await prisma.$disconnect();
    console.log('\n[Cleanup] Prisma client disconnected');

  } catch (error) {
    console.error('\n[Error] Import failed:', error);
    const failure = error instanceof Error ? error : new Error(String(error ?? 'Unknown import failure'));
    if (job?.id) {
      try {
        await repository.update(job.id, {
          status: ImportJobStatus.FAILED,
          errorMessage: failure.message,
          completedAt: new Date(),
        });
      } catch (statusError) {
        console.error('[Error] Failed to mark import job failed:', statusError);
      }
    }
    if (checkpointSession) {
      try {
        await checkpointService.updateStatus(checkpointSession, 'failed', failure);
      } catch (checkpointError) {
        console.error('[Error] Failed to mark checkpoint failed:', checkpointError);
      }
    }
    console.error('\nTo resume this import, run:');
    console.error(`  npx tsx scripts/standalone-import.ts --resume <jobId>`);
    await prisma.$disconnect();
    process.exit(1);
  }
}

// =============================================================================
// Entry Point
// =============================================================================

const args = parseArgs(process.argv.slice(2));
applyRuntimeOverrides(args);
main(args)
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
