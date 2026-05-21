import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { start } from 'workflow/api'
import { getAuthContext } from '@/lib/auth/context'
import { greenfieldWebsiteWorkflow, type GreenfieldWorkflowInput } from '@/lib/studio/workflows/greenfield-website.workflow'
import { greenfieldBootstrapper, type ProcessedPromptSnapshot } from '@/lib/studio/ai/greenfield-bootstrapper'
import { prisma } from '@/lib/prisma'

const RequestSchema = z.object({
  websiteId: z.string().min(1),
  originalPrompt: z.string().min(1),
  sessionId: z.string().optional(), // For progress tracking in assistant surface
  processedPrompt: z.object({
    websiteName: z.string().min(1),
    description: z.string().min(1),
    category: z.enum(['page', 'component']).default('page'),
    suggestedFeatures: z.array(z.string()),
    technicalRequirements: z.array(z.string()),
    targetAudience: z.string().min(1),
    /** URL to extract design system from (for "inspired by" prompts) */
    inspirationUrl: z.string().optional(),
  })
})

type RequestPayload = z.infer<typeof RequestSchema>

/**
 * Generate a unique job ID for greenfield bootstrap.
 * Format: bootstrap-{websiteId}-{timestamp}
 */
function generateJobId(websiteId: string): string {
  return `bootstrap-${websiteId}-${Date.now()}`
}

function runLocalBootstrap(input: GreenfieldWorkflowInput): void {
  void greenfieldBootstrapper.bootstrapWebsite({
    websiteId: input.websiteId,
    sessionId: input.sessionId,
    accountId: input.accountId,
    jobId: input.jobId,
    originalPrompt: input.originalPrompt,
    processedPrompt: input.processedPrompt,
  }).then((result) => {
    console.log('[bootstrap-route] Local greenfield bootstrap completed', {
      websiteId: input.websiteId,
      jobId: input.jobId,
      pagesCreated: result.pagesCreated,
      populatedPages: result.populatedPages,
      fallbackApplied: result.fallbackApplied,
    })
  }).catch((error) => {
    console.error('[bootstrap-route] Local greenfield bootstrap failed', {
      websiteId: input.websiteId,
      jobId: input.jobId,
      error: error instanceof Error ? error.message : String(error),
    })
  })
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const payload = RequestSchema.parse(body) as RequestPayload

    // Auth check - always required
    const auth = await getAuthContext(request)
    const website = await (prisma as any).website.findUnique({
      where: { id: payload.websiteId },
      select: { id: true, accountId: true }
    })
    if (!website) {
      return NextResponse.json({ error: 'Website not found' }, { status: 404 })
    }
    if (website.accountId !== auth.accountId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const accountId = auth.accountId

    // Generate unique job ID for tracking
    const jobId = generateJobId(payload.websiteId)
    // Use provided sessionId or generate one
    const sessionId = payload.sessionId || `session-${Date.now()}`

    // Build workflow input
    const workflowInput: GreenfieldWorkflowInput = {
      websiteId: payload.websiteId,
      sessionId,
      accountId,
      jobId,
      originalPrompt: payload.originalPrompt,
      processedPrompt: payload.processedPrompt as ProcessedPromptSnapshot,
    }

    console.log('[bootstrap-route] Starting greenfield generation', {
      websiteId: payload.websiteId,
      jobId,
      sessionId,
      mode: process.env.STUDIO_DISABLE_WORKFLOW_PLUGIN === 'true' ? 'local' : 'workflow',
      timestamp: new Date().toISOString()
    })

    if (process.env.STUDIO_DISABLE_WORKFLOW_PLUGIN === 'true') {
      runLocalBootstrap(workflowInput)
      console.log('[bootstrap-route] Local bootstrap started in background', {
        websiteId: payload.websiteId,
        jobId
      })
    } else {
      // Start durable workflow (non-blocking)
      // The start() function from workflow/api triggers the workflow runtime.
      try {
        await start(greenfieldWebsiteWorkflow, [workflowInput])
        console.log('[bootstrap-route] Workflow start() completed successfully', {
          websiteId: payload.websiteId,
          jobId
        })
      } catch (workflowError) {
        console.error('[bootstrap-route] Workflow start() failed', {
          websiteId: payload.websiteId,
          jobId,
          error: workflowError instanceof Error ? workflowError.message : String(workflowError)
        })
        throw workflowError
      }
    }

    // Return immediately with job ID for progress tracking
    return NextResponse.json({
      jobId,
      websiteId: payload.websiteId,
      sessionId,
      message: 'Greenfield website generation started',
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid request', details: error.issues }, { status: 400 })
    }

    console.error('[bootstrap-route] Failed to start greenfield workflow', {
      error: error instanceof Error ? error.message : String(error)
    })

    return NextResponse.json({ error: 'Failed to start website generation' }, { status: 500 })
  }
}
