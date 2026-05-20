/**
 * Import Planner Service
 *
 * Main service that orchestrates the LLM tool-calling loop for strategy selection.
 * This service analyzes user requests and determines the best import strategy.
 *
 * @module import-planner/service
 */

import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions'
import { createLLMClient, validateLLMApiKey } from '../llm-client'
import { PLANNER_TOOLS, TOOL_NAMES } from './tools'
import { checkSitemap, probePageLinks } from './tool-handlers'
import {
  IMPORT_PLANNER_SYSTEM_PROMPT,
  buildUserPrompt,
} from './prompt'
import type {
  ImportPlan,
  ImportPlannerInput,
  SetImportPlanArgs,
} from '../../types/import-planner.types'
import {
  ModelConfig,
  ConcurrencyConfig,
  LoggingConfig,
} from '../../config'

/**
 * Extended tool call type to handle OpenAI/OpenRouter response format.
 */
interface ToolCall {
  id: string
  type: string
  function?: {
    name: string
    arguments: string
  }
}

/** Maximum tool-calling iterations before forcing a fallback */
const MAX_TOOL_ITERATIONS = 5

/**
 * Import Planner Service
 *
 * Analyzes user requests and determines the optimal import strategy.
 * Uses LLM with tools for natural language requests, or deterministic logic for structured input.
 */
export class ImportPlannerService {
  private apiKey: string

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.OPENROUTER_API_KEY || ''
  }

  /**
   * Analyze user request and determine import strategy.
   *
   * For structured input (multiple URLs, single URL without request),
   * returns a deterministic plan without LLM call.
   *
   * For natural language requests, uses LLM with tools to analyze
   * the site and determine the best strategy.
   *
   * @param input - The import planner input
   * @returns The import plan with strategy and configuration
   */
  async planImport(input: ImportPlannerInput): Promise<ImportPlan> {
    // Try deterministic planning first for unambiguous inputs
    const deterministicPlan = this.tryDeterministicPlan(input)
    if (deterministicPlan) {
      if (LoggingConfig.observe) {
        console.log(
          `[ImportPlanner] Deterministic plan: ${deterministicPlan.strategy}`
        )
      }
      return deterministicPlan
    }

    // Use LLM for natural language requests
    return this.planWithLLM(input)
  }

  /**
   * Try to create a plan without LLM if input is unambiguous.
   *
   * @param input - The import planner input
   * @returns A plan if deterministic planning is possible, null otherwise
   */
  private tryDeterministicPlan(input: ImportPlannerInput): ImportPlan | null {
    const maxPages = ConcurrencyConfig.maxUrls

    // Multiple URLs provided → specific_urls strategy
    if (input.urls && input.urls.length > 1) {
      return {
        strategy: 'specific_urls',
        urls: input.urls,
        followLinks: input.followSubpages ?? true,
        linkScope: input.followSubpages ? 'same_path' : 'none',
        maxPages,
        reasoning: 'Multiple specific URLs provided by user',
      }
    }

    // Single URL without natural language request
    if (input.url && !input.request) {
      try {
        const parsed = new URL(input.url)
        const isRoot = parsed.pathname === '/' || parsed.pathname === ''

        // Root URL without request → use sitemap strategy
        if (isRoot) {
          return {
            strategy: 'sitemap',
            urls: [input.url],
            followLinks: false,
            linkScope: 'none',
            maxPages,
            reasoning: 'Root URL provided, using sitemap discovery',
          }
        }

        // Subsection URL → crawl from that path
        // Respect followSubpages setting
        const shouldFollow = input.followSubpages ?? true
        return {
          strategy: 'crawl_from_root',
          urls: [input.url],
          followLinks: shouldFollow,
          linkScope: shouldFollow ? 'same_path' : 'none',
          maxPages,
          reasoning: 'Subsection URL provided, crawling within path',
        }
      } catch {
        // Invalid URL, fall through to LLM
      }
    }

    // Single URL in urls array without natural language request
    if (input.urls && input.urls.length === 1 && !input.request) {
      try {
        const parsed = new URL(input.urls[0])
        const isRoot = parsed.pathname === '/' || parsed.pathname === ''

        if (isRoot) {
          return {
            strategy: 'sitemap',
            urls: input.urls,
            followLinks: false,
            linkScope: 'none',
            maxPages,
            reasoning: 'Root URL provided, using sitemap discovery',
          }
        }

        // Respect followSubpages setting
        const shouldFollow = input.followSubpages ?? true
        return {
          strategy: 'crawl_from_root',
          urls: input.urls,
          followLinks: shouldFollow,
          linkScope: shouldFollow ? 'same_path' : 'none',
          maxPages,
          reasoning: 'Subsection URL provided, crawling within path',
        }
      } catch {
        // Invalid URL, fall through to LLM
      }
    }

    // Natural language request → need LLM
    return null
  }

  /**
   * Use LLM with tools to determine strategy.
   *
   * @param input - The import planner input
   * @returns The import plan determined by the LLM
   */
  private async planWithLLM(input: ImportPlannerInput): Promise<ImportPlan> {
    const validatedApiKey = validateLLMApiKey(this.apiKey)
    const client = createLLMClient({
      apiKey: validatedApiKey,
      title: 'Catalyst Import Planner',
    })
    const maxPages = ConcurrencyConfig.maxUrls

    // Build user prompt
    const userPrompt = buildUserPrompt({
      request: input.request || 'Not provided',
      urls: input.urls?.join(', ') || input.url || 'None',
      followSubpages: input.followSubpages ?? true,
      maxDepth: input.maxDepth ?? 3,
      maxPages,
    })

    const messages: ChatCompletionMessageParam[] = [
      { role: 'system', content: IMPORT_PLANNER_SYSTEM_PROMPT },
      { role: 'user', content: userPrompt },
    ]

    let plan: ImportPlan | null = null
    let iterations = 0

    while (!plan && iterations < MAX_TOOL_ITERATIONS) {
      iterations++

      if (LoggingConfig.observe) {
        console.log(`[ImportPlanner] LLM iteration ${iterations}`)
      }

      const response = await client.chat.completions.create({
        model: ModelConfig.primary,
        messages,
        tools: PLANNER_TOOLS,
        temperature: 0,
        max_tokens: 1000,
      })

      const choice = response.choices[0]
      const assistantMessage = choice.message

      // Add assistant message to conversation
      messages.push(assistantMessage as ChatCompletionMessageParam)

      // Process tool calls
      const toolCalls = assistantMessage.tool_calls as ToolCall[] | undefined
      if (toolCalls && toolCalls.length > 0) {
        for (const toolCall of toolCalls) {
          if (toolCall.type !== 'function' || !toolCall.function) {
            continue
          }

          let result: unknown
          const funcName = toolCall.function.name
          const funcArgs = toolCall.function.arguments || '{}'

          try {
            const args = JSON.parse(funcArgs)

            switch (funcName) {
              case TOOL_NAMES.CHECK_SITEMAP:
                result = await checkSitemap(args.url)
                break

              case TOOL_NAMES.PROBE_PAGE_LINKS:
                result = await probePageLinks(args.url)
                break

              case TOOL_NAMES.SET_IMPORT_PLAN:
                const planArgs = args as SetImportPlanArgs
                plan = {
                  strategy: planArgs.strategy,
                  urls: planArgs.urls,
                  followLinks: planArgs.followLinks,
                  linkScope: planArgs.linkScope,
                  maxPages,
                  reasoning: planArgs.reasoning,
                }
                result = { success: true, plan }
                break

              default:
                result = { error: `Unknown tool: ${funcName}` }
            }
          } catch (error) {
            const message =
              error instanceof Error ? error.message : String(error)
            result = { error: message }
          }

          if (LoggingConfig.observe) {
            const resultStr = JSON.stringify(result)
            console.log(
              `[ImportPlanner] Tool ${funcName}: ${resultStr.slice(0, 200)}${resultStr.length > 200 ? '...' : ''}`
            )
          }

          messages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: JSON.stringify(result),
          })
        }
      }

      // If no tool calls and no plan, LLM finished without setting plan
      if (
        !assistantMessage.tool_calls ||
        assistantMessage.tool_calls.length === 0
      ) {
        if (LoggingConfig.observe) {
          console.log('[ImportPlanner] LLM finished without setting plan')
        }
        break
      }
    }

    // Fallback if LLM didn't set a plan
    if (!plan) {
      console.warn('[ImportPlanner] LLM did not set a plan, using fallback')
      const url = input.urls?.[0] || input.url || ''
      plan = {
        strategy: 'crawl_from_root',
        urls: url ? [url] : [],
        followLinks: true,
        linkScope: 'same_domain',
        maxPages,
        reasoning: 'Fallback: LLM did not determine strategy',
      }
    }

    return plan
  }
}

// =============================================================================
// Singleton Instance
// =============================================================================

let instance: ImportPlannerService | null = null

/**
 * Get the singleton instance of the ImportPlannerService.
 */
export function getImportPlannerService(): ImportPlannerService {
  if (!instance) {
    instance = new ImportPlannerService()
  }
  return instance
}

/**
 * Reset the singleton instance (for testing).
 * @internal
 */
export function resetImportPlannerService(): void {
  instance = null
}
