/**
 * TKT-071: Greenfield Bootstrapper - IA-First Architecture
 *
 * Two-phase bootstrapping:
 * - Phase 1: Generate Information Architecture (single AI call -> createSiteStructure)
 * - Phase 2: Populate content per page (parallel AI calls -> populatePageContent)
 *
 * Benefits:
 * - Better content consistency (IA informs all pages)
 * - Faster execution (parallel content generation)
 * - Individual page failures don't block others
 */

import { Prisma, type Website } from '@/lib/generated/prisma'
import { prisma } from '@/lib/prisma'
import { ensureTemplatePageTypes } from '@/lib/studio/import/services/template-page-type-seeder'
import { ContextProvider, generateSystemPrompt } from '@/lib/ai-tools/context/context-provider'
import { tools as baseTools } from '@/lib/ai-tools/tools'
import { createAIModel } from '@/lib/studio/ai/ai-sdk-provider'
import { streamText, type UIMessage as Message, stepCountIs } from 'ai'
import { DesignConceptRepository } from '@/lib/studio/design-system/design-concept.repository'
import { DesignSystemRepository } from '@/lib/studio/import/repositories/design-system.repository'
import { getShadcnVariablesWithDefaults } from '@/lib/studio/design-system/shadcn-defaults'
import { generateDesignSystemFromPrompt } from '@/lib/studio/design-system/prompt-design-system-generator'
import { updateSystemEvent } from '@/lib/studio/import/utils/update-system-event'
import { getBuilderAssistantSessionId } from '@/lib/studio/components/site-builder/assistant-session'
import { checkAndRecordUsage } from '@/lib/usage/limits'
import { resolveReferencesStage } from '@/lib/studio/import/services/orchestrator/reference-resolution-stage'
import { buildIAGenerationPrompt, type IAPage, type BusinessInfo } from './prompts/ia-generation-prompt'
import { buildPageContentPrompt, type SiteContext } from './prompts/page-content-prompt'
import { ComponentCategory } from '@/lib/studio/components/cms/_core/types'
import { getComponentCatalogSummary, buildChatPrompt } from '@/lib/studio/ai/component-catalog'

// Type definitions
export interface ProcessedPromptSnapshot {
  websiteName: string
  description: string
  category: 'page' | 'component'
  suggestedFeatures: string[]
  technicalRequirements: string[]
  targetAudience: string
  /** URL to extract design system from (for "inspired by" prompts) */
  inspirationUrl?: string
}

export interface BootstrapRequest {
  websiteId: string
  accountId: string
  sessionId?: string
  /** Job ID for progress tracking (e.g., "bootstrap-{websiteId}-{timestamp}") */
  jobId?: string
  originalPrompt: string
  processedPrompt: ProcessedPromptSnapshot
}

export interface BootstrapResult {
  pagesCreated: number
  populatedPages: number
  fallbackApplied: boolean
  success: boolean
  error?: string
}

type WrappedTools = typeof baseTools
type StreamTextFn = typeof streamText

interface Dependencies {
  contextProvider?: ContextProvider
  prismaClient?: typeof prisma
  tools?: WrappedTools
  streamTextFn?: StreamTextFn
}

interface IAResult {
  structures: Record<string, { id: string; fullPath: string }>
  pages: IAPage[]
}

interface PageContentResult {
  slug: string
  success: boolean
  pageId?: string
  error?: string
}

// Read model at runtime, not module load time
function getGreenfieldModel(): string {
  const model = process.env.OPENROUTER_MODEL
  if (!model) {
    throw new Error('OPENROUTER_MODEL environment variable is not set')
  }
  return model
}

/**
 * IA-First Greenfield Bootstrapper
 */
export class GreenfieldBootstrapper {
  private readonly contextProvider: ContextProvider
  private readonly prisma: typeof prisma
  private readonly tools: WrappedTools
  private readonly streamText: StreamTextFn

  constructor(dependencies: Dependencies = {}) {
    this.contextProvider = dependencies.contextProvider ?? new ContextProvider()
    this.prisma = dependencies.prismaClient ?? prisma
    this.tools = dependencies.tools ?? baseTools
    this.streamText = dependencies.streamTextFn ?? streamText
  }

  /**
   * Progress update helper - same pattern as V1
   */
  private async updateProgress(
    websiteId: string,
    sessionId: string | undefined,
    accountId: string,
    stage: string,
    progress: number,
    message: string,
    pagesCreated: number = 0,
    totalPages: number = 4,
    jobId?: string
  ): Promise<void> {
    const resolvedSessionId = sessionId ?? getBuilderAssistantSessionId(websiteId)
    // Use the request job id when supplied; otherwise use the stable bootstrap id.
    const resolvedJobId = jobId ?? `bootstrap-${websiteId}`

    try {
      await updateSystemEvent({
        websiteId,
        sessionId: resolvedSessionId,
        accountId,
        jobId: resolvedJobId,
        content: message,
        metadata: {
          type: 'import-progress',
          jobId: resolvedJobId,
          url: '',
          stage,
          progress,
          processedCount: pagesCreated,
          totalCount: totalPages,
          currentUrl: null,
          status: stage === 'completed' ? 'completed' : stage === 'failed' ? 'failed' : 'processing',
          message,
          updatedAt: new Date().toISOString()
        }
      })
    } catch (error) {
      console.warn('[GreenfieldBootstrapper] Progress update failed', {
        websiteId,
        stage,
        error: error instanceof Error ? error.message : String(error)
      })
    }
  }

  /**
   * Main entry point - API compatible with V1
   */
  async bootstrapWebsite(request: BootstrapRequest): Promise<BootstrapResult> {
    const website = await this.prisma.website.findUnique({ where: { id: request.websiteId } })
    if (!website || website.accountId !== request.accountId) {
      return {
        pagesCreated: 0,
        populatedPages: 0,
        fallbackApplied: false,
        success: false,
        error: 'Website not found or not accessible'
      }
    }

    try {
      // Initialize (5%)
      await this.updateProgress(request.websiteId, request.sessionId, request.accountId, 'initializing', 5, 'Initializing website...', 0, 4, request.jobId)

      await ensureTemplatePageTypes({ prisma: this.prisma as any, websiteId: request.websiteId })
      await this.createDefaultDesignSystem(request.websiteId, request.processedPrompt)

      // Phase 1: Generate IA (10-20%)
      await this.updateProgress(request.websiteId, request.sessionId, request.accountId, 'generating_ia', 10, 'Designing site structure...', 0, 4, request.jobId)

      const iaResult = await this.generateIA(request, website)

      if (!iaResult || Object.keys(iaResult.structures).length === 0) {
        await this.updateProgress(request.websiteId, request.sessionId, request.accountId, 'failed', 0, 'Failed to generate site structure', 0, 4, request.jobId)
        return {
          pagesCreated: 0,
          populatedPages: 0,
          fallbackApplied: false,
          success: false,
          error: 'Failed to generate Information Architecture'
        }
      }

      const totalPages = Object.keys(iaResult.structures).length
      await this.updateProgress(request.websiteId, request.sessionId, request.accountId, 'generating_ia', 20, `Site structure ready: ${totalPages} pages`, 0, totalPages, request.jobId)

      // Phase 2: Populate content (20-90%)
      await this.updateProgress(request.websiteId, request.sessionId, request.accountId, 'populating_pages', 25, 'Generating page content...', 0, totalPages, request.jobId)

      const contentResults = await this.populateAllPagesParallel(
        request,
        website,
        iaResult
      )

      const successfulPages = contentResults.filter(r => r.success).length
      const failedPages = contentResults.filter(r => !r.success)

      if (failedPages.length > 0) {
        console.warn('[GreenfieldBootstrapper] Some pages failed to populate', {
          websiteId: request.websiteId,
          failed: failedPages.map(p => ({ slug: p.slug, error: p.error }))
        })
      }

      // Post-processing: Resolve references (90-95%)
      if (successfulPages > 0) {
        await this.updateProgress(request.websiteId, request.sessionId, request.accountId, 'resolving_references', 90, 'Resolving media references...', successfulPages, totalPages, request.jobId)

        try {
          await this.resolveReferences(request.websiteId, request.sessionId, request.accountId, request.jobId)
        } catch (error) {
          console.warn('[GreenfieldBootstrapper] Reference resolution failed (non-blocking)', {
            websiteId: request.websiteId,
            error: error instanceof Error ? error.message : String(error)
          })
        }
      }

      // Post-processing: Register component types (95-100%)
      if (successfulPages > 0) {
        await this.updateProgress(request.websiteId, request.sessionId, request.accountId, 'registering_components', 95, 'Registering components...', successfulPages, totalPages, request.jobId)

        try {
          await this.registerComponentTypesFromPages(request.websiteId)
        } catch (error) {
          console.warn('[GreenfieldBootstrapper] Component registration failed (non-blocking)', {
            websiteId: request.websiteId,
            error: error instanceof Error ? error.message : String(error)
          })
        }
      }

      // Final result
      if (successfulPages === 0) {
        await this.updateProgress(request.websiteId, request.sessionId, request.accountId, 'failed', 0, 'No pages could be created', 0, 4, request.jobId)
        return {
          pagesCreated: totalPages,
          populatedPages: 0,
          fallbackApplied: false,
          success: false,
          error: 'Content generation failed for all pages'
        }
      }

      await this.updateProgress(request.websiteId, request.sessionId, request.accountId, 'completed', 100, `Website ready! ${successfulPages} pages created.`, successfulPages, totalPages, request.jobId)

      return {
        pagesCreated: totalPages,
        populatedPages: successfulPages,
        fallbackApplied: false,
        success: true
      }

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error'
      console.error('[GreenfieldBootstrapper] Bootstrap failed', {
        websiteId: request.websiteId,
        error: errorMsg
      })

      await this.updateProgress(request.websiteId, request.sessionId, request.accountId, 'failed', 0, `Bootstrap failed: ${errorMsg}`, 0, 4, request.jobId)

      return {
        pagesCreated: 0,
        populatedPages: 0,
        fallbackApplied: false,
        success: false,
        error: errorMsg
      }
    }
  }

  /**
   * Phase 1: Generate Information Architecture
   * Single AI call that creates all WebsiteStructure records
   */
  private async generateIA(request: BootstrapRequest, website: Website): Promise<IAResult | null> {
    // TKT-088: Use helper that respects OPENROUTER_BASE_URL for xAI direct API
    const model = createAIModel() as any

    // Build business info for prompt
    const businessInfo: BusinessInfo = {
      websiteName: request.processedPrompt.websiteName,
      description: request.processedPrompt.description,
      targetAudience: request.processedPrompt.targetAudience,
      suggestedFeatures: request.processedPrompt.suggestedFeatures,
      originalPrompt: request.originalPrompt
    }

    const systemPrompt = buildIAGenerationPrompt(businessInfo)

    // Only need createSiteStructure for Phase 1
    const iaTools = {
      createSiteStructure: {
        ...this.tools.createSiteStructure,
        execute: async (args: any, options: any) => {
          const augmented = { ...args, websiteId: request.websiteId }
          return (this.tools.createSiteStructure.execute as any)(augmented, options)
        }
      }
    }

    console.info('[GreenfieldBootstrapper] Phase 1: Starting IA generation', {
      websiteId: request.websiteId
    })

    let iaResult: IAResult | null = null

    try {
      const streamResult = this.streamText({
        model,
        system: systemPrompt,
        tools: iaTools as any,
        toolChoice: 'required',
        messages: [
          {
            id: `greenfield-ia-${request.websiteId}`,
            role: 'user',
            parts: [
              {
                type: 'text',
                text: `Generate the site structure for websiteId: ${request.websiteId}`
              }
            ]
          } as Message
        ],
        stopWhen: stepCountIs(5),
        temperature: 0.7,
        maxTokens: 2048
      } as any)

      for await (const chunk of streamResult.fullStream) {
        if (chunk.type === 'tool-result') {
          const output = (chunk as any).output
          if (output?.success && output?.structures) {
            // Build IAPage array from the created structures
            const pages: IAPage[] = []

            // Query the created structures for full IA metadata
            const structures = await this.prisma.websiteStructure.findMany({
              where: { websiteId: request.websiteId },
              select: {
                slug: true,
                fullPath: true,
                iaMetadata: true,
                parentId: true
              }
            })

            // Build slug -> parentSlug map
            const idToSlug = new Map<string, string>()
            for (const s of structures) {
              const structWithId = await this.prisma.websiteStructure.findFirst({
                where: { websiteId: request.websiteId, slug: s.slug },
                select: { id: true }
              })
              if (structWithId) {
                idToSlug.set(structWithId.id, s.slug)
              }
            }

            for (const s of structures) {
              const metadata = s.iaMetadata as any || {}
              pages.push({
                slug: s.slug,
                title: metadata.title || s.slug.charAt(0).toUpperCase() + s.slug.slice(1),
                parentSlug: s.parentId ? idToSlug.get(s.parentId) || null : null,
                iaMetadata: {
                  purpose: metadata.purpose || '',
                  targetAudience: metadata.targetAudience || '',
                  primaryQuestion: metadata.primaryQuestion || '',
                  journeyStage: metadata.journeyStage || 'awareness',
                  sectionIntents: metadata.sectionIntents || []
                }
              })
            }

            iaResult = {
              structures: output.structures,
              pages
            }

            console.info('[GreenfieldBootstrapper] Phase 1: IA generation complete', {
              websiteId: request.websiteId,
              pageCount: pages.length,
              slugs: pages.map(p => p.slug)
            })
          }
        }
      }
    } catch (error) {
      console.error('[GreenfieldBootstrapper] Phase 1 failed', {
        websiteId: request.websiteId,
        error: error instanceof Error ? error.message : String(error)
      })
      throw error
    }

    return iaResult
  }

  /**
   * Phase 2: Populate content for all pages in parallel
   * Uses Promise.allSettled so individual failures don't block others
   */
  private async populateAllPagesParallel(
    request: BootstrapRequest,
    website: Website,
    iaResult: IAResult
  ): Promise<PageContentResult[]> {
    // Build site context for cross-page consistency
    const siteContext: SiteContext = {
      websiteName: request.processedPrompt.websiteName,
      targetAudience: request.processedPrompt.targetAudience,
      pages: iaResult.pages
    }

    // Get default content type
    const contentType = await this.prisma.contentType.findFirst({
      where: { websiteId: request.websiteId, category: 'page' },
      select: { id: true }
    })

    if (!contentType) {
      throw new Error('No page content type found')
    }

    // Get component schemas for the prompt
    const componentSchemas = await this.getComponentSchemas(request.websiteId)

    // Create parallel promises for each page
    const pagePromises = iaResult.pages.map(async (page, index) => {
      // Update progress for this page
      const progressBase = 25
      const progressRange = 65 // 25-90
      const progressPerPage = progressRange / iaResult.pages.length
      const currentProgress = progressBase + (index * progressPerPage)

      await this.updateProgress(
        request.websiteId,
        request.sessionId,
        request.accountId,
        'populating_pages',
        Math.round(currentProgress),
        `Generating ${page.title} page...`,
        index,
        iaResult.pages.length,
        request.jobId
      )

      try {
        const result = await this.populateSinglePage(
          request,
          page,
          siteContext,
          contentType.id,
          componentSchemas
        )
        return result
      } catch (error) {
        return {
          slug: page.slug,
          success: false,
          error: error instanceof Error ? error.message : String(error)
        }
      }
    })

    // Wait for all pages with allSettled
    const results = await Promise.allSettled(pagePromises)

    return results.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value
      }
      return {
        slug: iaResult.pages[index].slug,
        success: false,
        error: result.reason?.message || 'Unknown error'
      }
    })
  }

  /**
   * Populate content for a single page
   */
  private async populateSinglePage(
    request: BootstrapRequest,
    page: IAPage,
    siteContext: SiteContext,
    contentTypeId: string,
    componentSchemas: string
  ): Promise<PageContentResult> {
    // TKT-088: Use helper that respects OPENROUTER_BASE_URL for xAI direct API
    const model = createAIModel() as any

    // Build page-specific prompt (includes originalPrompt for verbatim copy extraction)
    const prompt = buildPageContentPrompt({
      pageSlug: page.slug,
      pageTitle: page.title,
      iaMetadata: page.iaMetadata,
      siteContext,
      componentSchemas,
      originalPrompt: request.originalPrompt
    })

    // Prepare tools with websiteId injection
    const pageTools = {
      populatePageContent: {
        ...this.tools.populatePageContent,
        execute: async (args: any, options: any) => {
          const augmented = {
            ...args,
            websiteId: request.websiteId,
            contentTypeId
          }
          return (this.tools.populatePageContent.execute as any)(augmented, options)
        }
      },
      searchImages: {
        ...this.tools.searchImages,
        execute: async (args: any, options: any) => {
          return (this.tools.searchImages.execute as any)(args, options)
        }
      }
    }

    console.info('[GreenfieldBootstrapper] Phase 2: Populating page', {
      websiteId: request.websiteId,
      slug: page.slug
    })

    let pageResult: PageContentResult = {
      slug: page.slug,
      success: false,
      error: 'AI did not call populatePageContent tool' // Default error if tool not called
    }

    // TKT-071: Retry loop - if AI doesn't call populatePageContent on first attempt, retry
    // Increased to 3 attempts due to Grok model occasionally not following toolChoice: 'required'
    const maxAttempts = 3

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      let toolCalled = false

      try {
        // Progressive prompting: start normal, get more direct on retries
        let messageContent: string
        if (attempt === 1) {
          messageContent = `Generate content for the "${page.slug}" page. WebsiteId: ${request.websiteId}, Slug: ${page.slug}`
        } else if (attempt === 2) {
          messageContent = `IMPORTANT: You MUST call the populatePageContent tool to create the "${page.slug}" page. ` +
            `Generate page content and call populatePageContent with: websiteId="${request.websiteId}", slug="${page.slug}". ` +
            `Do NOT just search for images - you must call populatePageContent to create the page.`
        } else {
          // Final attempt: Most direct, minimal prompt
          messageContent = `CALL populatePageContent NOW with pageSlug="${page.slug}" and a components array containing navbar, hero-simple, and footer.`
        }

        const streamResult = this.streamText({
          model,
          system: prompt,
          tools: pageTools as any,
          toolChoice: 'required',
          messages: [
            {
              id: `greenfield-page-${request.websiteId}-${page.slug}-${attempt}`,
              role: 'user',
              parts: [
                {
                  type: 'text',
                  text: messageContent
                }
              ]
            } as Message
          ],
          stopWhen: stepCountIs(10),
          temperature: 0.7,
          maxTokens: 4096
        } as any)

        for await (const chunk of streamResult.fullStream) {
          // Log all tool results for debugging
          if (chunk.type === 'tool-result') {
            console.info('[GreenfieldBootstrapper] Tool result received', {
              websiteId: request.websiteId,
              slug: page.slug,
              toolName: (chunk as any).toolName,
              hasOutput: !!(chunk as any).output,
              attempt
            })
          }

          if (chunk.type === 'tool-result' && chunk.toolName === 'populatePageContent') {
            toolCalled = true
            const output = (chunk as any).output
            if (output?.success && output?.page) {
              pageResult = {
                slug: page.slug,
                success: true,
                pageId: output.page.id
              }
              console.info('[GreenfieldBootstrapper] Page populated', {
                websiteId: request.websiteId,
                slug: page.slug,
                pageId: output.page.id,
                attempt
              })
            } else if (output?.error) {
              pageResult = {
                slug: page.slug,
                success: false,
                error: output.error
              }
            } else {
              // Tool returned but with unexpected shape
              pageResult = {
                slug: page.slug,
                success: false,
                error: `populatePageContent returned unexpected output: ${JSON.stringify(output).slice(0, 200)}`
              }
            }
          }
        }

        // If the tool was called successfully or with an error, we're done (no retry)
        if (toolCalled) {
          break
        }

        // If tool wasn't called and this is the first attempt, log and retry
        if (attempt < maxAttempts) {
          console.warn('[GreenfieldBootstrapper] populatePageContent tool was not called, retrying...', {
            websiteId: request.websiteId,
            slug: page.slug,
            attempt
          })
        } else {
          // Final attempt - keep the default error
          console.warn('[GreenfieldBootstrapper] populatePageContent tool was not called after retries', {
            websiteId: request.websiteId,
            slug: page.slug,
            totalAttempts: maxAttempts
          })
        }

      } catch (error) {
        pageResult = {
          slug: page.slug,
          success: false,
          error: error instanceof Error ? error.message : String(error)
        }
        // Don't retry on exceptions - likely a persistent issue
        break
      }
    }

    return pageResult
  }

  /**
   * Get component schemas for the page content prompt
   * Uses dynamic component catalog instead of hardcoded schemas
   */
  private async getComponentSchemas(websiteId: string): Promise<string> {
    try {
      const summary = await getComponentCatalogSummary()
      const prompt = buildChatPrompt(summary, {
        includeGuidelines: true,
        maxComponentsPerCategory: 10,
        maxPropertiesPerComponent: 8
      })

      console.info('[GreenfieldBootstrapper] Loaded dynamic component catalog', {
        websiteId,
        totalComponents: summary.total,
        categories: summary.categories.length
      })

      return prompt
    } catch (error) {
      console.error('[GreenfieldBootstrapper] Failed to load component catalog, using fallback', {
        websiteId,
        error: error instanceof Error ? error.message : String(error)
      })

      // Fallback to minimal hardcoded schemas if catalog fails
      return `
## hero-simple
{ type: "hero-simple", content: { heading: string, subheading?: string, ctaButtons?: [{label, href}] } }

## text-block
{ type: "text-block", content: { heading?: string, body: string } }

## contact-form
{ type: "contact-form", content: { title: string, fields: [{name, type, label}] } }

## footer
{ type: "footer", content: { copyright: string, links?: [{label, href}] } }
`
    }
  }

  /**
   * Resolve references - reused from V1 via import
   */
  private async resolveReferences(websiteId: string, sessionId: string | undefined, accountId: string, jobId?: string): Promise<void> {
    await resolveReferencesStage({
      websiteId,
      onProgress: async (message: string, progress: number) => {
        await this.updateProgress(
          websiteId,
          sessionId,
          accountId,
          'resolving_references',
          90 + (progress / 100) * 5,
          message,
          0,
          4,
          jobId
        )
      }
    })
  }

  /**
   * Register component types - same logic as V1
   */
  private async registerComponentTypesFromPages(websiteId: string): Promise<void> {
    const pages = await this.prisma.websitePage.findMany({
      where: { websiteId, type: 'page' },
      select: { id: true, content: true }
    })

    const componentTypeMap = new Map<string, { category: string; occurrences: number }>()

    for (const page of pages) {
      if (!page.content || typeof page.content !== 'object') continue

      const parsed = page.content as Record<string, unknown>
      const components = Array.isArray((parsed as any).components) ? (parsed as any).components : []

      for (const comp of components) {
        const component = comp as Record<string, unknown>
        const type = typeof component.type === 'string' ? component.type : null
        if (!type || /^page(?:-v\d+)?$/i.test(type)) continue

        const existing = componentTypeMap.get(type)
        if (existing) {
          existing.occurrences += 1
        } else {
          componentTypeMap.set(type, {
            category: this.inferComponentCategory(type),
            occurrences: 1
          })
        }
      }
    }

    if (componentTypeMap.size === 0) return

    const existingTypes = await this.prisma.websiteComponentType.findMany({
      where: { websiteId },
      select: { type: true }
    })
    const existingTypeSet = new Set(existingTypes.map(ct => ct.type))

    const newTypes: Array<{ type: string; category: string; occurrences: number }> = []
    for (const [type, data] of componentTypeMap) {
      if (!existingTypeSet.has(type)) {
        newTypes.push({ type, ...data })
      }
    }

    if (newTypes.length === 0) return

    await this.prisma.websiteComponentType.createMany({
      data: newTypes.map(({ type, category, occurrences }) => ({
        websiteId,
        type,
        category,
        defaultConfig: {} as Prisma.JsonObject,
        placeholderData: {} as Prisma.JsonObject,
        styles: {} as Prisma.JsonObject,
        aiMetadata: {
          source: 'greenfield-bootstrap',
          createdAt: new Date().toISOString(),
          occurrences
        } as Prisma.JsonObject,
        confidence: 0.7
      })),
      skipDuplicates: true
    })
  }

  private inferComponentCategory(type: string): string {
    const t = type.toLowerCase()
    if (t.includes('nav') || t.includes('menu') || t.includes('header') || t.includes('footer')) return ComponentCategory.Navigation
    if (t.includes('hero') || t.includes('banner')) return ComponentCategory.Heroes
    if (t.includes('form') || t.includes('contact')) return ComponentCategory.Contact
    if (t.includes('cta')) return ComponentCategory.CTA
    if (t.includes('feature')) return ComponentCategory.Features
    if (t.includes('testimonial') || t.includes('review')) return ComponentCategory.SocialProof
    if (t.includes('about') || t.includes('team')) return ComponentCategory.About
    if (t.includes('blog') || t.includes('article')) return ComponentCategory.Blog
    if (t.includes('pricing')) return ComponentCategory.Pricing
    return ComponentCategory.Content
  }

  private async createDefaultDesignSystem(
    websiteId: string,
    processedPrompt: ProcessedPromptSnapshot
  ): Promise<void> {
    try {
      // Use 'as any' for prisma to handle extended client type - same pattern as V1
      const conceptRepo = new DesignConceptRepository(this.prisma as any)
      const designSystemRepo = new DesignSystemRepository(this.prisma as any)

      const existing = await conceptRepo.findDefault(websiteId)
      if (existing) return

      const concept = await conceptRepo.create({
        websiteId,
        name: 'Default',
        slug: 'default',
        description: 'Default design system',
        isDefault: true
      })

      // TKT-088: Generate brand-appropriate colors using LLM
      let tokens: Record<string, string>
      let source: 'detected' | 'default' | 'mixed' = 'default'
      let confidence = 1.0

      try {
        // Build prompt from business context
        const prompt = [
          processedPrompt.websiteName,
          processedPrompt.description,
          processedPrompt.targetAudience ? `Target audience: ${processedPrompt.targetAudience}` : ''
        ].filter(Boolean).join(' - ')

        if (prompt.trim()) {
          console.info('[GreenfieldBootstrapper] Generating design system from prompt', {
            websiteId,
            promptLength: prompt.length
          })

          const result = await generateDesignSystemFromPrompt({ prompt })
          tokens = result.tokens.variables
          source = result.hasCustomColors ? 'detected' : 'default'
          confidence = result.hasCustomColors ? 0.8 : 0.5

          console.info('[GreenfieldBootstrapper] Design system generated', {
            websiteId,
            hasCustomColors: result.hasCustomColors,
            mode: result.mode
          })
        } else {
          // No business context, use defaults
          tokens = getShadcnVariablesWithDefaults({}, 'light')
        }
      } catch (llmError) {
        // LLM failed, fall back to defaults
        console.warn('[GreenfieldBootstrapper] LLM design system generation failed, using defaults', {
          websiteId,
          error: llmError instanceof Error ? llmError.message : String(llmError)
        })
        tokens = getShadcnVariablesWithDefaults({}, 'light')
        source = 'default'
        confidence = 1.0
      }

      await designSystemRepo.create({
        websiteId,
        designConceptId: concept.id,
        tokens: {
          variables: tokens,
          extraction: {
            timestamp: new Date().toISOString(),
            confidence,
            source,
            detectedCount: source === 'detected' ? Object.keys(tokens).length : 0,
            defaultCount: source === 'default' ? Object.keys(tokens).length : 0
          }
        }
      })
    } catch (error) {
      console.error('[GreenfieldBootstrapper] Failed to create design system', {
        websiteId,
        error: error instanceof Error ? error.message : String(error)
      })
    }
  }
}

export const greenfieldBootstrapper = new GreenfieldBootstrapper()
