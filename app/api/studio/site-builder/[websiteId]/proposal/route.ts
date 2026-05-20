import { NextRequest, NextResponse } from 'next/server'
import { performance } from 'node:perf_hooks'
import { createAIModel } from '@/lib/studio/ai/ai-sdk-provider'
import { generateObject } from 'ai'
import { prisma } from '@/lib/prisma'
import { getAuthContext } from '@/lib/auth/context'
import { ProposalContextBuilder } from '@/lib/studio/site-builder/proposal/proposal-context-builder'
import {
  ProposalNarrativeSchema,
  sanitizeNarrativePayload,
  validateNarrativePayload
} from '@/lib/studio/site-builder/proposal/narrative-schema'
import { ProposalApiResponse } from '@/lib/studio/site-builder/proposal/types'

const RATE_LIMIT_WINDOW_MS = 60_000
const RATE_LIMIT_MAX_REQUESTS = 2
const rateLimitBuckets = new Map<string, { count: number; reset: number }>()

class RateLimitError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'RateLimitError'
  }
}

function assertRateLimit(key: string) {
  const now = Date.now()
  const bucket = rateLimitBuckets.get(key)
  if (!bucket || bucket.reset <= now) {
    rateLimitBuckets.set(key, { count: 1, reset: now + RATE_LIMIT_WINDOW_MS })
    return
  }
  if (bucket.count >= RATE_LIMIT_MAX_REQUESTS) {
    throw new RateLimitError('Too many proposal exports, try again in a minute.')
  }
  bucket.count += 1
}

const builder = new ProposalContextBuilder()

export async function POST(request: NextRequest, context: { params: Promise<{ websiteId: string }> }) {
  try {
    const { websiteId } = await context.params
    if (!websiteId) {
      return NextResponse.json({ error: 'Website ID is required' }, { status: 400 })
    }

    const auth = await getAuthContext(request)
    const website = await prisma.website.findUnique({
      where: { id: websiteId },
      select: { id: true, accountId: true }
    })

    if (!website) {
      return NextResponse.json({ error: 'Website not found' }, { status: 404 })
    }

    if (!website.accountId || website.accountId !== auth.accountId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    assertRateLimit(`${websiteId}:${auth.accountId}`)

    const body = await request.json().catch(() => ({}))
    const { conceptId, includeAlternates, proposalTitle, importJobId, tagline } = body ?? {}

    let contextResult
    try {
      contextResult = await builder.build({
        websiteId,
        conceptId,
        includeAlternates,
        importJobId,
        proposalTitle,
        tagline
      })
    } catch (contextError) {
      if (contextError instanceof Error) {
        return NextResponse.json({ error: contextError.message }, { status: 400 })
      }
      throw contextError
    }

    // TKT-088: Use helper that respects OPENROUTER_BASE_URL for xAI direct API
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const model = createAIModel(process.env.OPENROUTER_PROPOSAL_MODEL) as any
    const prompt = buildPrompt(contextResult.llmContext)

    const start = performance.now()
    const generation = await withRetry(() =>
      generateObject({
        model,
        schema: ProposalNarrativeSchema,
        prompt,
        abortSignal: AbortSignal.timeout(45_000)
      })
    )
    const durationMs = performance.now() - start
    const narrative = validateNarrativePayload(sanitizeNarrativePayload(generation.object))

    console.info('[proposal-export] openrouter usage', {
      websiteId,
      model: process.env.OPENROUTER_PROPOSAL_MODEL ?? process.env.OPENROUTER_MODEL ?? 'default',
      durationMs: Math.round(durationMs),
      usage: generation.usage
    })

    const payload: ProposalApiResponse = {
      narrative,
      context: contextResult.context,
      assets: { designConcepts: contextResult.designConcepts }
    }

    return NextResponse.json(payload)
  } catch (error) {
    if (error instanceof RateLimitError) {
      return NextResponse.json({ error: error.message }, { status: 429 })
    }
    if (error instanceof Error && error.name === 'AbortError') {
      return NextResponse.json({ error: 'Proposal generation timed out' }, { status: 504 })
    }

    console.error('[proposal-export] failed', error)
    const message = error instanceof Error ? error.message : 'Unexpected error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

function buildPrompt(contextPayload: Record<string, unknown>) {
  return [
    "You are Catalyst Studio's proposal author. Craft concise, executive-ready narratives following B2B RFP best practices.",
    'Focus on IA insights, content type readiness, and design concept posture. Avoid SEO or error audits.',
    'Return JSON that matches the provided schema exactly. If critical data is missing, output "project_summary": "INSUFFICIENT_DATA".',
    'Field length ceilings (hard limits, do not exceed): project_summary ≤ 900 characters, call_to_action ≤ 300, each uplift_plan item ≤ 200, design_concepts[].positioning ≤ 280, design_concepts[].paletteAngle ≤ 180, bestUseCases strings ≤ 120.',
    '',
    '## Writing Style Requirements',
    '- Write ALL content for a non-technical client audience. Avoid technical jargon like "content types", "IA", "schema", "metadata".',
    '- Use plain language a business owner would understand. Instead of "Hero component" say "main banner section".',
    '- Content type summaries should explain what each section DOES for the business, not what it IS technically.',
    '',
    '## Best Use Cases Requirements',
    '- bestUseCases must be SPECIFIC to THIS website\'s industry, audience, and detected content.',
    '- Reference actual page names, services, or products found in the site structure.',
    '- AVOID generic phrases like "marketing purposes", "showcase services", "engage visitors".',
    '- Example: For a law firm, say "Highlight the 5 practice areas with attorney profiles" not "Showcase professional services".',
    '',
    '## Uplift Plan Requirements',
    '- Each uplift_plan item must reference SPECIFIC findings from the analysis.',
    '- Cite actual page names, content gaps, or structural issues detected.',
    '- AVOID generic advice like "Improve site structure" or "Enhance user experience".',
    '- Example: "Consolidate the 3 separate contact pages into a single Contact hub" or "Add testimonials section - none detected on current site".',
    '- Base recommendations on: detected pages, missing content types, IA depth issues, and content gaps found.',
    '',
    'Context JSON:',
    JSON.stringify(contextPayload, null, 2)
  ].join('\n')
}

async function withRetry<T>(fn: () => Promise<T>, retries = 2): Promise<T> {
  try {
    return await fn()
  } catch (error) {
    if (retries <= 0) {
      throw error
    }
    await new Promise((resolve) => setTimeout(resolve, 500 * (3 - retries)))
    return withRetry(fn, retries - 1)
  }
}
