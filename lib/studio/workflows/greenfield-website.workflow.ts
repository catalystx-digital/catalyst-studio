/**
 * Greenfield Website Workflow
 *
 * Durable workflow for creating new websites from scratch using Vercel Workflow SDK.
 * Each stage is a separate step that can be resumed on failure.
 *
 * Stages:
 * 1. Initialize - Set up page types and design system
 * 2. AI Generation - Use AI to create pages (with heartbeat for long-running operations)
 * 3. Post-Process - Resolve references, verify images, register components
 *
 * @module workflows/greenfield-website
 */

import { FatalError } from 'workflow';
// IMPORTANT: Database operations use internal API routes instead of direct Prisma imports.
// Vercel Workflow bundles step code separately and Prisma's generated client paths break.
import {
  ProgressHeartbeat,
  getInternalApiUrl,
  callInternalApi,
} from '@/lib/studio/workflows/shared';
import type { ProcessedPromptSnapshot } from '@/lib/studio/ai/greenfield-bootstrapper';

// ============================================================================
// Types
// ============================================================================

export interface GreenfieldWorkflowInput {
  /** Website ID to bootstrap */
  websiteId: string;
  /** Session ID for progress updates */
  sessionId: string;
  /** Account ID for ownership */
  accountId: string;
  /** Job ID for tracking (e.g., "bootstrap-{websiteId}") */
  jobId: string;
  /** Original user prompt */
  originalPrompt: string;
  /** Processed prompt snapshot with structured data */
  processedPrompt: ProcessedPromptSnapshot;
}

export interface GreenfieldWorkflowResult {
  success: boolean;
  jobId: string;
  pagesCreated: number;
  populatedPages: number;
  errors: string[];
}

interface InitializeStepInput {
  websiteId: string;
  /** URL to extract design system from (for "inspired by" prompts) */
  inspirationUrl?: string;
  /** Original user prompt (for parsing color preferences) */
  originalPrompt?: string;
}

interface InitializeStepResult {
  designSystemCreated: boolean;
  pageTypesSeeded: boolean;
}

interface AIGenerationStepResult {
  pagesCreated: number;
  populatedPages: number;
  error?: string;
}

interface PostProcessStepResult {
  referencesResolved: boolean;
  imagesVerified: boolean;
  componentTypesRegistered: boolean;
}

// ============================================================================
// Main Workflow
// ============================================================================

/**
 * Main greenfield website workflow.
 * Orchestrates the creation of a new website with durable steps.
 */
export async function greenfieldWebsiteWorkflow(
  input: GreenfieldWorkflowInput
): Promise<GreenfieldWorkflowResult> {
  'use workflow';

  const { websiteId, sessionId, accountId, jobId } = input;
  const errors: string[] = [];

  // Log workflow start - this confirms the workflow was triggered
  console.log('[GreenfieldWorkflow] Workflow started', {
    websiteId,
    sessionId,
    jobId,
    timestamp: new Date().toISOString()
  });

  try {
    // Stage 1: Initialize website (page types, design system)
    const inspirationUrl = input.processedPrompt.inspirationUrl;
    const initMessage = inspirationUrl
      ? `Initializing website... (extracting design from ${new URL(inspirationUrl).hostname})`
      : 'Initializing website...';
    await updateProgressStep(jobId, websiteId, sessionId, accountId, 5, initMessage);
    const initResult = await initializeStep({ websiteId, inspirationUrl, originalPrompt: input.originalPrompt });

    if (!initResult.pageTypesSeeded) {
      errors.push('Failed to seed page types');
    }

    await updateProgressStep(jobId, websiteId, sessionId, accountId, 10, 'Page templates ready');

    // Stage 2: AI Generation (long-running, uses heartbeat)
    await updateProgressStep(jobId, websiteId, sessionId, accountId, 15, 'AI is generating your pages...');
    const aiResult = await aiGenerationStep(input);

    if (aiResult.error) {
      errors.push(aiResult.error);
    }

    if (aiResult.populatedPages === 0) {
      // No pages created - fatal error
      const errorMsg = aiResult.error
        ? `AI generation failed: ${aiResult.error}`
        : 'Could not generate pages from your description';

      await markJobFailedStep(jobId, websiteId, sessionId, accountId, errorMsg);

      return {
        success: false,
        jobId,
        pagesCreated: 0,
        populatedPages: 0,
        errors: [...errors, errorMsg],
      };
    }

    await updateProgressStep(
      jobId,
      websiteId,
      sessionId,
      accountId,
      75,
      `Created ${aiResult.populatedPages} pages`
    );

    // Stage 3: Post-processing (references, images, component types)
    await updateProgressStep(
      jobId,
      websiteId,
      sessionId,
      accountId,
      80,
      'Resolving media and page references...'
    );
    const postResult = await postProcessStep(websiteId, sessionId, accountId, jobId);

    if (!postResult.referencesResolved) {
      errors.push('Some references could not be resolved');
    }

    // Mark as complete
    await updateProgressStep(
      jobId,
      websiteId,
      sessionId,
      accountId,
      100,
      `Website ready! Created ${aiResult.populatedPages} pages.`
    );

    return {
      success: true,
      jobId,
      pagesCreated: aiResult.pagesCreated,
      populatedPages: aiResult.populatedPages,
      errors,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    errors.push(errorMessage);

    await markJobFailedStep(jobId, websiteId, sessionId, accountId, errorMessage);

    return {
      success: false,
      jobId,
      pagesCreated: 0,
      populatedPages: 0,
      errors,
    };
  }
}

// ============================================================================
// Step Functions
// ============================================================================

/**
 * Step 1: Initialize website with page types and design system.
 * Wraps ensureTemplatePageTypes() and createDefaultDesignSystem()
 *
 * If inspirationUrl is provided, extracts design system from that URL.
 * Otherwise, creates a default shadcn-based design system.
 */
async function initializeStep(input: InitializeStepInput): Promise<InitializeStepResult> {
  'use step';

  const { websiteId, inspirationUrl, originalPrompt } = input;

  // Validate input - fatal error if invalid
  if (!websiteId || typeof websiteId !== 'string') {
    throw new FatalError('Invalid websiteId provided to initializeStep');
  }

  let pageTypesSeeded = false;
  let designSystemCreated = false;

  try {
    // Seed template page types
    // NOTE: This calls ensureTemplatePageTypes from template-page-type-seeder
    const { ensureTemplatePageTypes } = await import(
      '@/lib/studio/import/services/template-page-type-seeder'
    );
    const { prisma } = await import('@/lib/prisma');

    await ensureTemplatePageTypes({ prisma: prisma as any, websiteId });
    pageTypesSeeded = true;
  } catch (error) {
    console.error('[GreenfieldWorkflow] Failed to seed page types', {
      websiteId,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  // Create design system - either from inspiration URL or default
  if (inspirationUrl) {
    // Extract design system from inspiration URL
    try {
      console.log('[GreenfieldWorkflow] Extracting design system from inspiration URL', {
        websiteId,
        inspirationUrl,
      });

      const { importDesignSystemFromUrl } = await import(
        '@/lib/studio/design-system/import-design-system'
      );

      await importDesignSystemFromUrl({
        url: inspirationUrl,
        websiteId,
        conceptName: 'Inspired Design',
        useNewFormat: true,
      });

      designSystemCreated = true;
      console.log('[GreenfieldWorkflow] Design system extracted from inspiration URL', {
        websiteId,
        inspirationUrl,
      });
    } catch (error) {
      console.warn('[GreenfieldWorkflow] Failed to extract design from inspiration URL, falling back to defaults', {
        websiteId,
        inspirationUrl,
        error: error instanceof Error ? error.message : String(error),
      });
      // Fallback to default design system
      designSystemCreated = await createDefaultDesignSystem(websiteId, originalPrompt);
    }
  } else {
    // No inspiration URL - use default shadcn design system (parse colors from prompt if available)
    designSystemCreated = await createDefaultDesignSystem(websiteId, originalPrompt);
  }

  return { pageTypesSeeded, designSystemCreated };
}

/**
 * Helper: Create a design system using LLM to understand the prompt.
 * Uses LLM-based generation to interpret natural language descriptions
 * like "modern tech startup" or "warm cozy coffee shop".
 *
 * @param websiteId - Website to create design system for
 * @param originalPrompt - User's original prompt (for LLM interpretation)
 */
async function createDefaultDesignSystem(websiteId: string, originalPrompt?: string): Promise<boolean> {
  try {
    const { prisma } = await import('@/lib/prisma');
    const { DesignConceptRepository } = await import(
      '@/lib/studio/design-system/design-concept.repository'
    );
    const { DesignSystemRepository } = await import(
      '@/lib/studio/import/repositories/design-system.repository'
    );
    const { generateDesignSystemFromPrompt } = await import(
      '@/lib/studio/design-system/prompt-design-system-generator'
    );

    const conceptRepo = new DesignConceptRepository(prisma);
    const designSystemRepo = new DesignSystemRepository(prisma);

    // Check if already exists
    const existing = await conceptRepo.findDefault(websiteId);
    if (!existing) {
      // Use LLM to generate design system from prompt
      const result = await generateDesignSystemFromPrompt({
        prompt: originalPrompt || '',
      });

      console.log('[GreenfieldWorkflow] Creating design system via LLM', {
        websiteId,
        mode: result.mode,
        hasCustomColors: result.hasCustomColors,
        model: result.metadata.model,
        confidence: result.tokens.extraction.confidence,
      });

      const concept = await conceptRepo.create({
        websiteId,
        name: 'Default',
        slug: 'default',
        description: result.hasCustomColors
          ? 'AI-generated design system from prompt'
          : 'Default design system',
        isDefault: true,
      });

      await designSystemRepo.create({
        websiteId,
        designConceptId: concept.id,
        tokens: {
          variables: result.tokens.variables,
          extraction: {
            ...result.tokens.extraction,
            strategy: result.hasCustomColors ? 'llm-prompt' : 'shadcn-defaults',
            sourceType: 'greenfield',
          },
        },
      });
    }
    return true;
  } catch (error) {
    console.error('[GreenfieldWorkflow] Failed to create design system', {
      websiteId,
      error: error instanceof Error ? error.message : String(error),
    });
    // Don't throw - design system is not strictly required
    return false;
  }
}

/**
 * Step 2: AI Generation with heartbeat for long-running operations.
 * This is the main AI bootstrapping step that creates pages.
 * Uses ProgressHeartbeat to emit progress every 15s during generation.
 */
async function aiGenerationStep(input: GreenfieldWorkflowInput): Promise<AIGenerationStepResult> {
  'use step';

  const { websiteId, sessionId, accountId, jobId, originalPrompt, processedPrompt } = input;

  // Validate inputs
  if (!websiteId || typeof websiteId !== 'string') {
    throw new FatalError('Invalid websiteId provided to aiGenerationStep');
  }

  // Verify website exists and belongs to account
  const { prisma } = await import('@/lib/prisma');
  const website = await prisma.website.findUnique({ where: { id: websiteId } });

  if (!website || website.accountId !== accountId) {
    throw new FatalError('Website not found or not accessible');
  }

  // Start heartbeat for progress updates during long-running AI generation
  const heartbeat = new ProgressHeartbeat({
    websiteId,
    sessionId,
    accountId,
    jobId,
  });

  try {
    heartbeat.start({ processed: 0, total: 4 }); // Estimate 4 pages

    // Run the AI bootstrap
    // NOTE: This calls the runAIBootstrap logic from GreenfieldBootstrapper
    const { GreenfieldBootstrapper } = await import('@/lib/studio/ai/greenfield-bootstrapper');
    const bootstrapper = new GreenfieldBootstrapper();

    // Create the bootstrap request
    const request = {
      websiteId,
      accountId,
      sessionId,
      jobId,
      originalPrompt,
      processedPrompt,
    };

    // Run AI bootstrap - this internally handles tool orchestration
    // The bootstrapper's runAIBootstrap method handles:
    // - Loading website context
    // - Building bootstrap prompt
    // - Running streamText with tools (createPage, listContentTypes, searchImages)
    // - Progress updates via updateSystemEvent
    const result = await bootstrapper.bootstrapWebsite(request);

    // Throw on business failure so Vercel Workflow step shows as failed (not green)
    // Using regular Error (not FatalError) so the step can be retried
    if (result.error) {
      throw new Error(result.error);
    }

    return {
      pagesCreated: result.pagesCreated,
      populatedPages: result.populatedPages,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[GreenfieldWorkflow] AI generation failed', {
      websiteId,
      error: errorMessage,
    });

    // Re-throw so Vercel Workflow step shows as failed
    throw error;
  } finally {
    // ALWAYS stop heartbeat to clean up timer
    heartbeat.stop();
  }
}

/**
 * Step 3: Post-processing after page creation.
 * Resolves references, verifies stock images, registers component types.
 */
async function postProcessStep(
  websiteId: string,
  sessionId: string,
  accountId: string,
  jobId: string
): Promise<PostProcessStepResult> {
  'use step';

  let referencesResolved = false;
  let imagesVerified = false;
  let componentTypesRegistered = false;

  // Resolve references (download external images, link pages)
  try {
    const { resolveReferencesStage } = await import(
      '@/lib/studio/import/services/orchestrator/reference-resolution-stage'
    );

    await resolveReferencesStage({
      websiteId,
      onProgress: async (message: string, progress: number) => {
        console.info('[GreenfieldWorkflow] Reference resolution progress', {
          websiteId,
          message,
          progress,
        });
      },
    });
    referencesResolved = true;
  } catch (error) {
    console.warn('[GreenfieldWorkflow] Failed to resolve references', {
      websiteId,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  // Verify stock images were ingested
  try {
    // NOTE: This calls verifyStockImageIngestion logic from bootstrapper
    // The bootstrapper handles scanning pages for external URLs and ingesting them
    const { prisma } = await import('@/lib/prisma');
    const { MediaRepository } = await import('@/lib/studio/media/media-repository');
    const { MediaIngestService } = await import('@/lib/studio/import/services/media-ingest-service');
    const { getMediaStorageProvider } = await import(
      '@/lib/studio/media/storage/media-storage-factory'
    );
    const { isMediaUrl } = await import('@/lib/studio/import/services/reference-resolver');

    // Collect external image URLs from pages
    const pages = await prisma.websitePage.findMany({
      where: { websiteId, type: 'page' },
      select: { content: true },
    });

    const externalUrls = new Set<string>();
    for (const page of pages) {
      if (page.content && typeof page.content === 'object') {
        collectExternalImageUrls(page.content, externalUrls, isMediaUrl);
      }
    }

    if (externalUrls.size > 0) {
      // Cross-check and ingest any missed URLs
      const mediaRepository = new MediaRepository(prisma);
      const { backend, provider } = getMediaStorageProvider();
      const mediaIngestService = new MediaIngestService({
        repository: mediaRepository,
        storageProvider: provider,
        backend,
      });

      for (const url of externalUrls) {
        const existing = await mediaRepository.resolveByOriginalUrl(websiteId, url);
        if (!existing) {
          try {
            await mediaIngestService.ingest({
              websiteId,
              detectionResults: [
                {
                  pageUrl: '',
                  components: [{ content: { src: url } }],
                  pageMetadata: {},
                } as any,
              ],
              designTokens: null,
            });
          } catch {
            // Continue with other URLs
          }
        }
      }
    }
    imagesVerified = true;
  } catch (error) {
    console.warn('[GreenfieldWorkflow] Failed to verify stock images', {
      websiteId,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  // Register component types from created pages
  try {
    // NOTE: This calls registerComponentTypesFromPages logic from bootstrapper
    const { prisma } = await import('@/lib/prisma');
    const { ComponentCategory } = await import(
      '@/lib/studio/components/cms/_core/types'
    );

    const pages = await prisma.websitePage.findMany({
      where: { websiteId, type: 'page' },
      select: { content: true },
    });

    const componentTypeMap = new Map<string, { category: string; occurrences: number }>();

    for (const page of pages) {
      if (!page.content || typeof page.content !== 'object') continue;
      const parsed = page.content as Record<string, unknown>;
      const components = Array.isArray((parsed as any).components)
        ? ((parsed as any).components as unknown[])
        : [];

      for (const comp of components) {
        const component = comp as Record<string, unknown>;
        const type = typeof component.type === 'string' ? component.type : null;
        if (!type || /^page(?:-v\d+)?$/i.test(type)) continue;

        const existing = componentTypeMap.get(type);
        if (existing) {
          existing.occurrences += 1;
        } else {
          componentTypeMap.set(type, {
            category: inferComponentCategory(type, ComponentCategory),
            occurrences: 1,
          });
        }
      }
    }

    if (componentTypeMap.size > 0) {
      const existingTypes = await prisma.websiteComponentType.findMany({
        where: { websiteId },
        select: { type: true },
      });
      const existingTypeSet = new Set(existingTypes.map((ct) => ct.type));

      const newTypes: Array<{ type: string; category: string; occurrences: number }> = [];
      for (const [type, data] of componentTypeMap) {
        if (!existingTypeSet.has(type)) {
          newTypes.push({ type, ...data });
        }
      }

      if (newTypes.length > 0) {
        await prisma.websiteComponentType.createMany({
          data: newTypes.map(({ type, category, occurrences }) => ({
            websiteId,
            type,
            category,
            defaultConfig: {},
            placeholderData: {},
            styles: {},
            aiMetadata: {
              source: 'greenfield-workflow',
              createdAt: new Date().toISOString(),
              occurrences,
            },
            confidence: 0.7,
          })),
          skipDuplicates: true,
        });
      }
    }
    componentTypesRegistered = true;
  } catch (error) {
    console.warn('[GreenfieldWorkflow] Failed to register component types', {
      websiteId,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  return { referencesResolved, imagesVerified, componentTypesRegistered };
}

/**
 * Step: Update job progress via internal API.
 */
async function updateProgressStep(
  jobId: string,
  websiteId: string,
  sessionId: string,
  accountId: string,
  progress: number,
  message: string
): Promise<void> {
  'use step';

  try {
    await callInternalApi('/api/internal/greenfield-job', {
      action: 'updateProgress',
      jobId,
      websiteId,
      sessionId,
      accountId,
      progress,
      message,
    });
  } catch (error) {
    // Log but don't fail - progress updates are non-critical
    console.warn('[GreenfieldWorkflow] Failed to update progress', {
      jobId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Step: Mark job as failed via internal API.
 */
async function markJobFailedStep(
  jobId: string,
  websiteId: string,
  sessionId: string,
  accountId: string,
  errorMessage: string
): Promise<void> {
  'use step';

  try {
    await callInternalApi('/api/internal/greenfield-job', {
      action: 'markFailed',
      jobId,
      websiteId,
      sessionId,
      accountId,
      errorMessage,
    });
  } catch (error) {
    console.error('[GreenfieldWorkflow] Failed to mark job as failed', {
      jobId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

// ============================================================================
// Helper Functions (Pure, run within steps)
// ============================================================================

/**
 * Recursively collect external image URLs from content object.
 */
function collectExternalImageUrls(
  value: unknown,
  urls: Set<string>,
  isMediaUrl: (url: string) => boolean,
  visited: WeakSet<object> = new WeakSet()
): void {
  if (value === null || value === undefined) return;

  if (typeof value === 'string') {
    if (isMediaUrl(value) && (value.startsWith('http://') || value.startsWith('https://'))) {
      urls.add(value);
    }
    return;
  }

  if (typeof value !== 'object') return;

  // Prevent circular references
  if (visited.has(value as object)) return;
  visited.add(value as object);

  // Skip already resolved media references
  const obj = value as Record<string, unknown>;
  if ('mediaId' in obj && typeof obj.mediaId === 'string') {
    return;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      collectExternalImageUrls(item, urls, isMediaUrl, visited);
    }
    return;
  }

  for (const child of Object.values(obj)) {
    collectExternalImageUrls(child, urls, isMediaUrl, visited);
  }
}

/**
 * Infer component category from type name.
 */
function inferComponentCategory(
  type: string,
  ComponentCategory: Record<string, string>
): string {
  const t = type.toLowerCase();

  if (t.includes('nav') || t.includes('menu') || t.includes('header') || t.includes('footer')) {
    return ComponentCategory.Navigation;
  }
  if (t.includes('hero') || t.includes('banner') || t.includes('carousel') || t.includes('slider')) {
    return ComponentCategory.Heroes;
  }
  if (t.includes('form') || t.includes('contact')) {
    return ComponentCategory.Contact;
  }
  if (t.includes('cta') || t.includes('call-to-action')) {
    return ComponentCategory.CTA;
  }
  if (t.includes('feature')) {
    return ComponentCategory.Features;
  }
  if (t.includes('testimonial') || t.includes('review') || t.includes('quote')) {
    return ComponentCategory.SocialProof;
  }
  if (t.includes('about') || t.includes('team') || t.includes('bio')) {
    return ComponentCategory.About;
  }
  if (t.includes('blog') || t.includes('article') || t.includes('post')) {
    return ComponentCategory.Blog;
  }
  if (t.includes('pricing') || t.includes('price')) {
    return ComponentCategory.Pricing;
  }
  if (t.includes('data') || t.includes('chart') || t.includes('graph')) {
    return ComponentCategory.Data;
  }

  return ComponentCategory.Content;
}
