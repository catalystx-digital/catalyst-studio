/**
 * Import Planner Tool Definitions
 *
 * OpenAI-compatible tool schemas for the LLM strategy planner.
 * These tools allow the LLM to probe the target site and decide on the best import strategy.
 *
 * @module import-planner/tools
 */

import type { ChatCompletionTool } from 'openai/resources/chat/completions'

/**
 * Tool definitions for the import planner LLM.
 *
 * Available tools:
 * - check_sitemap: Check if a URL has a sitemap.xml file
 * - probe_page_links: Fetch a page and analyze its links
 * - set_import_plan: Finalize the import strategy
 */
export const PLANNER_TOOLS: ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'check_sitemap',
      description:
        'Check if a URL has a sitemap.xml file available. Use this to determine if sitemap-based import is viable. Returns whether the sitemap exists and how many URLs it contains.',
      parameters: {
        type: 'object',
        properties: {
          url: {
            type: 'string',
            description:
              'The root URL to check for sitemap (e.g., https://example.com). The tool will check for sitemap.xml at this origin.',
          },
        },
        required: ['url'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'probe_page_links',
      description:
        'Fetch a page and analyze its links. Returns count of internal/external links and sample URLs. Use this to understand site structure and determine if crawling will be effective.',
      parameters: {
        type: 'object',
        properties: {
          url: {
            type: 'string',
            description: 'The page URL to probe for links',
          },
        },
        required: ['url'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'set_import_plan',
      description:
        'Finalize the import strategy. Call this once you have determined the best approach based on the user request and site analysis.',
      parameters: {
        type: 'object',
        properties: {
          strategy: {
            type: 'string',
            enum: ['sitemap', 'crawl_from_root', 'specific_urls'],
            description:
              'The import strategy to use: "sitemap" uses sitemap.xml, "crawl_from_root" follows links from starting URL, "specific_urls" imports only the provided URLs',
          },
          urls: {
            type: 'array',
            items: { type: 'string' },
            description: 'Starting URLs for the import. For sitemap strategy, this is the root URL. For crawl/specific, these are the URLs to process.',
          },
          followLinks: {
            type: 'boolean',
            description:
              'Whether to follow links from discovered pages. Set to true for crawl strategy, false for sitemap or when user wants only specific URLs.',
          },
          linkScope: {
            type: 'string',
            enum: ['same_path', 'same_domain', 'none'],
            description:
              'Scope for link following: "same_path" stays within the starting URL path, "same_domain" allows any path on the domain, "none" disables link following',
          },
          reasoning: {
            type: 'string',
            description:
              'Brief explanation (1-2 sentences) of why this strategy was chosen based on the user request and site analysis',
          },
        },
        required: ['strategy', 'urls', 'followLinks', 'linkScope', 'reasoning'],
      },
    },
  },
]

/**
 * Tool name constants for type-safe tool handling.
 */
export const TOOL_NAMES = {
  CHECK_SITEMAP: 'check_sitemap',
  PROBE_PAGE_LINKS: 'probe_page_links',
  SET_IMPORT_PLAN: 'set_import_plan',
} as const

export type ToolName = (typeof TOOL_NAMES)[keyof typeof TOOL_NAMES]
