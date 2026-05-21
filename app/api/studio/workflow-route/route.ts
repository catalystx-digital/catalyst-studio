/**
 * Workflow Routing API
 *
 * Uses LLM to analyze user prompts and determine the appropriate workflow:
 * - IMPORT: User wants to clone/copy an existing website from a URL
 * - GREENFIELD: User wants to create a new website from scratch/PRD
 *
 * @module api/studio/workflow-route
 */

import { createWorkflowRouterModel } from '@/lib/studio/ai/ai-sdk-provider'
import { generateObject } from 'ai'
import { z } from 'zod'
import { NextResponse } from 'next/server'

export const maxDuration = 30

/**
 * Schema for the LLM's workflow routing decision.
 */
const WorkflowDecisionSchema = z.object({
  workflow: z.enum(['import', 'greenfield']).describe(
    'The detected workflow type. "import" for cloning existing websites, "greenfield" for creating new sites from scratch.'
  ),
  importUrl: z.string().optional().describe(
    'If workflow is "import", the URL to import. Should be a valid HTTP/HTTPS URL.'
  ),
  reasoning: z.string().describe(
    'Brief explanation of why this workflow was chosen.'
  ),
  confidence: z.number().min(0).max(1).describe(
    'Confidence score from 0.0 to 1.0 for this decision.'
  )
})

type WorkflowDecision = z.infer<typeof WorkflowDecisionSchema>

/**
 * System prompt for the workflow router LLM.
 */
const WORKFLOW_ROUTER_SYSTEM_PROMPT = `You are a workflow router for a website building platform. Your job is to analyze user requests and determine which workflow to use.

## Workflows

1. **IMPORT workflow**: User wants to clone, copy, import, remake, or recreate an EXISTING website from a URL.
   - Trigger phrases: "import", "clone", "copy", "remake", "recreate", "rebuild"
   - User provides a URL they want to import
   - User might just paste a bare URL with no other text
   - Examples:
     * "import https://example.com"
     * "clone www.company.com"
     * "https://mysite.org" (just a URL)
     * "copy this site: https://example.com"

2. **GREENFIELD workflow**: User wants to create a NEW website from scratch based on a description, PRD, or specification.
   - User describes what they want to build
   - User might upload a PRD (Product Requirements Document) or design spec
   - User asks for a specific type of site (portfolio, blog, e-commerce, etc.)
   - Examples:
     * "Create a portfolio site for a photographer"
     * "Build an e-commerce store for selling handmade jewelry"
     * "[Uploaded PRD content describing features]"
     * "I need a landing page for my SaaS product"

## Important Rules

1. If the user's prompt contains a URL AND explicit import intent (import, clone, copy, etc.), choose IMPORT.
2. If the user's prompt is JUST a URL with minimal other text, choose IMPORT.
3. If the user mentions a URL as an EXAMPLE or INSPIRATION but describes building something new, choose GREENFIELD.
4. If there's uploaded document content (PRD, spec), that's typically GREENFIELD unless it explicitly instructs to import.
5. URLs mentioned within PRD/spec content as examples should NOT trigger IMPORT.

## Response

Return a JSON object with:
- workflow: "import" or "greenfield"
- importUrl: The URL to import (only if workflow is "import")
- reasoning: Brief explanation of your decision
- confidence: How confident you are (0.0 to 1.0)`

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { userPrompt } = body

    if (!userPrompt || typeof userPrompt !== 'string') {
      return NextResponse.json(
        { error: 'userPrompt is required and must be a string' },
        { status: 400 }
      )
    }

    // TKT-088: Use helper that respects OPENROUTER_BASE_URL for xAI direct API
    const model = createWorkflowRouterModel()

    // Build the user message with context about uploaded content
    let userMessage = userPrompt
    if (userPrompt.includes('--- Uploaded Document Content ---')) {
      // Add explicit context that there's uploaded content
      userMessage = `[User has uploaded a document. The prompt includes their message and the document content.]

${userPrompt}`
    }

    console.log('[workflow-route] Analyzing prompt...', {
      promptLength: userPrompt.length,
      hasUploadedContent: userPrompt.includes('--- Uploaded Document Content ---')
    })

    const result = await generateObject({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      model: model as any,
      schema: WorkflowDecisionSchema,
      system: WORKFLOW_ROUTER_SYSTEM_PROMPT,
      prompt: userMessage,
      temperature: 0.1 // Low temperature for consistent routing
    })

    const decision = result.object as WorkflowDecision

    console.log('[workflow-route] Decision:', {
      workflow: decision.workflow,
      importUrl: decision.importUrl,
      confidence: decision.confidence,
      reasoning: decision.reasoning
    })

    // Normalize the import URL if present
    if (decision.workflow === 'import' && decision.importUrl) {
      decision.importUrl = normalizeUrl(decision.importUrl)
    }

    return NextResponse.json(decision)
  } catch (error) {
    const providerStatusCode =
      error && typeof error === 'object' && 'statusCode' in error
        ? Number((error as { statusCode?: unknown }).statusCode)
        : null
    const providerBody =
      error && typeof error === 'object' && 'responseBody' in error
        ? String((error as { responseBody?: unknown }).responseBody ?? '')
        : ''

    if (providerStatusCode === 401 || providerStatusCode === 403) {
      console.warn('[workflow-route] AI router unavailable; using greenfield fallback', {
        statusCode: providerStatusCode,
        reason: providerBody.includes('credits') || providerBody.includes('spending limit')
          ? 'provider credits or spending limit'
          : 'provider authorization',
      })
    } else {
      console.error('[workflow-route] Error:', error)
    }

    // Return a fallback decision on error - default to greenfield
    return NextResponse.json({
      workflow: 'greenfield',
      reasoning: providerStatusCode === 401 || providerStatusCode === 403
        ? 'AI workflow routing is unavailable because the configured provider rejected the request; defaulting to greenfield workflow.'
        : 'LLM routing failed, defaulting to greenfield workflow',
      confidence: 0.5,
      error: providerStatusCode === 401 || providerStatusCode === 403
        ? 'AI provider unavailable'
        : error instanceof Error ? error.message : 'Unknown error'
    })
  }
}

/**
 * Normalize a URL by ensuring it has a protocol.
 */
function normalizeUrl(rawUrl: string): string {
  const trimmed = rawUrl.trim().replace(/[<>'"]+/g, '')
  const cleaned = trimmed.replace(/[.,;!?]+$/, '')

  if (/^https?:\/\//i.test(cleaned)) {
    return cleaned
  }
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(cleaned)) {
    return cleaned // Non-HTTP protocol, pass through
  }
  if (cleaned.startsWith('www.')) {
    return `https://${cleaned}`
  }
  return `https://${cleaned}`
}
