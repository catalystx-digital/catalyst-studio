#!/usr/bin/env npx tsx
/**
 * Standalone reproduction script for LLM truncation issue
 *
 * PURPOSE: Reproduce and diagnose the issue where grok-4.1-fast returns
 * incomplete JSON with finish_reason="stop" instead of "length"
 *
 * KEY INSIGHT from analysis:
 * - The actual import has a MASSIVE system prompt (~49K tokens)
 * - This includes: template overview, compliance rules, component contracts
 * - Truncation happens after tool calls when generating final JSON
 * - finish_reason is "stop" but JSON is incomplete
 * - Only ~58 completion tokens are generated despite 30K max
 *
 * This script simulates the exact scenario with a large prompt.
 *
 * Usage:
 *   npx tsx scripts/reproduce-llm-truncation.ts
 *   npx tsx scripts/reproduce-llm-truncation.ts --model anthropic/claude-haiku-4.5
 *   npx tsx scripts/reproduce-llm-truncation.ts --verbose
 *   npx tsx scripts/reproduce-llm-truncation.ts --prompt-size large
 */

import 'dotenv/config';

// Types for OpenRouter API with function calling
interface Message {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
  name?: string;
}

interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

interface Tool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

interface OpenRouterResponse {
  id: string;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string | null;
      tool_calls?: ToolCall[];
    };
    finish_reason: string | null;
    native_finish_reason?: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

// Parse CLI args first (needed for config)
const args = process.argv.slice(2);
const DIRECT_XAI = args.includes('--direct-xai'); // Use xAI API directly, bypass OpenRouter

// Configuration
const API_KEY = DIRECT_XAI
  ? process.env.XAI_API_KEY
  : process.env.OPENROUTER_API_KEY;
const BASE_URL = DIRECT_XAI
  ? 'https://api.x.ai/v1'
  : 'https://openrouter.ai/api/v1';
const DEFAULT_MODEL = DIRECT_XAI
  ? 'grok-4-fast'  // xAI direct model name
  : (process.env.IMPORT_MODEL_CHAIN || 'x-ai/grok-4.1-fast');
const MAX_TOKENS = parseInt(process.env.IMPORT_DETECT_MAX_TOKENS || '90000', 10);

const modelArg = args.find(a => a.startsWith('--model='))?.split('=')[1];
const MODEL = modelArg || DEFAULT_MODEL;
const VERBOSE = args.includes('--verbose') || args.includes('-v');
const LARGE_PROMPT = args.includes('--prompt-size=large') || args.includes('--large');
const FIX_PROVIDER = args.includes('--fix-provider'); // Test explicit provider routing
const FIX_REASONING = args.includes('--fix-reasoning'); // Test max_tokens: 0 on reasoning
const DEBUG_UPSTREAM = args.includes('--debug-upstream'); // Enable echo_upstream_body debugging

// Tools that the import flow uses
const TOOLS: Tool[] = [
  {
    type: 'function',
    function: {
      name: 'fetch_outline',
      description: 'Fetch the outline/structure of a webpage. Returns a handle and section keys.',
      parameters: {
        type: 'object',
        properties: {
          url: { type: 'string', description: 'The URL to fetch' }
        },
        required: ['url']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_section',
      description: 'Get the content of a section by handle and key.',
      parameters: {
        type: 'object',
        properties: {
          handle: { type: 'string', description: 'The handle from fetch_outline' },
          key: { type: 'string', description: 'The section key (header, main:0-N, footer)' }
        },
        required: ['handle', 'key']
      }
    }
  }
];

// Mock tool responses - simulating what the actual import returns
const MOCK_HANDLE = 'mock-handle-123';

// This simulates the HTML structure returned by the tools
const MOCK_OUTLINE = {
  handle: MOCK_HANDLE,
  sections: {
    header: { key: 'header', charCount: 2500 },
    'main:0-23175': { key: 'main:0-23175', charCount: 23175 },
    footer: { key: 'footer', charCount: 1500 }
  },
  url: 'https://www.tio.com.au/'
};

// This is the actual nav structure from tio.com.au that causes truncation
const MOCK_HEADER_HTML = `
<header class="region region-header">
  <div class="site-branding">
    <a href="/" title="Home" rel="home">
      <img src="https://www.tio.com.au/themes/custom/tio/logo.svg" alt="Telecommunication Industry Ombudsman">
    </a>
  </div>
  <nav class="menu--main">
    <ul class="menu">
      <li class="menu-item--expanded">
        <a href="/complaints">Complaints</a>
        <ul class="menu">
          <li><a href="/complaints/who-we-can-help">Who we can help</a></li>
          <li><a href="/complaints/what-we-can-help-with">What we can help with</a></li>
          <li><a href="/complaints/what-expect">What to expect</a></li>
          <li><a href="/complaints/making-complaint-someone-else">Making a complaint for someone else</a></li>
          <li><a href="/complaints/help-for-people-and-businesses-at-risk">Help for people and businesses at risk</a></li>
          <li><a href="https://www.tioonline.com.au/update" data-external="true">Update your complaint</a></li>
          <li><a href="/complaints/how-work-your-telco">How to work with your telco</a></li>
          <li><a href="/other-complaint-bodies">Other complaint bodies</a></li>
        </ul>
      </li>
      <li class="menu-item--expanded">
        <a href="/common-issues">Common issues</a>
        <ul class="menu">
          <li><a href="/common-issues/billing">Billing</a></li>
          <li><a href="/common-issues/compensation">Compensation</a></li>
          <li><a href="/common-issues/credit-management">Credit Management</a></li>
          <li><a href="/common-issues/customer-service">Customer Service</a></li>
          <li><a href="/common-issues/domestic-family-violence">Domestic, Family and Sexual Violence</a></li>
          <li><a href="/common-issues/faults">Faults</a></li>
          <li><a href="/common-issues/financial-hardship">Financial Hardship</a></li>
          <li><a href="/common-issues/privacy">Privacy</a></li>
        </ul>
      </li>
      <li class="menu-item--expanded">
        <a href="/about-tio">About TIO</a>
        <ul class="menu">
          <li><a href="/about-tio/news">News</a></li>
          <li><a href="/about-tio/reports-submissions">Reports &amp; submissions</a></li>
          <li><a href="/about-tio/careers">Careers</a></li>
          <li><a href="/about-tio/contact-us">Contact us</a></li>
        </ul>
      </li>
      <li class="menu-item--expanded">
        <a href="/for-providers">For providers</a>
        <ul class="menu">
          <li><a href="/for-providers/member-resources">Member resources</a></li>
          <li><a href="/for-providers/joining">Joining TIO</a></li>
          <li><a href="/for-providers/training">Training</a></li>
        </ul>
      </li>
    </ul>
  </nav>
  <div class="search-block">
    <form action="/search">
      <input type="search" placeholder="Search...">
      <button type="submit">Search</button>
    </form>
  </div>
</header>
`;

const MOCK_MAIN_HTML = `
<main class="layout-main-content">
  <article>
    <h1 class="page-title">Welcome to TIO</h1>
    <div class="field--name-body">
      <p>The Telecommunications Industry Ombudsman (TIO) is a free and independent service for residential consumers and small businesses who have an unresolved complaint about their phone or internet service.</p>
      <h2>Our services</h2>
      <p>We help resolve complaints about phone and internet services in Australia.</p>
      <ul>
        <li>Free service for consumers</li>
        <li>Independent dispute resolution</li>
        <li>Handles complaints about phone and internet providers</li>
      </ul>
    </div>
  </article>
</main>
`;

const MOCK_FOOTER_HTML = `
<footer class="site-footer">
  <div class="region-footer-first">
    <nav class="menu--footer">
      <ul class="menu">
        <li><a href="/privacy-policy">Privacy Policy</a></li>
        <li><a href="/terms-of-use">Terms of use</a></li>
        <li><a href="/accessibility">Accessibility</a></li>
        <li><a href="/sitemap">Sitemap</a></li>
      </ul>
    </nav>
  </div>
  <div class="region-footer-second">
    <p class="copyright">&copy; 2024 Telecommunications Industry Ombudsman</p>
  </div>
</footer>
`;

/**
 * Generate a massive system prompt similar to the actual import flow.
 * The actual prompt is ~49K tokens, which includes:
 * - Rules and instructions (~500 tokens)
 * - PAGE TEMPLATE OVERVIEW with 6 templates (~2000 tokens)
 * - TEMPLATE COMPLIANCE RULES (~5000 tokens)
 * - COMPONENT CONTRACTS (53 components) (~40000 tokens)
 */
function generateLargeSystemPrompt(): string {
  const baseRules = `You are a component extraction engine that must use the provided tools to fetch and analyze pages.
Rules:
1) Use tools to fetch page data; do not browse yourself.
2) Preserve strict top-to-bottom order of components in output.
3) For any URL attributes (href/src/etc), extract verbatim as in HTML, including all query params. Do not modify or simplify URLs.
4) Call fetch_outline first; then fetch header/footer and multiple main slices (not just the first) until all visible sections are covered—news/list blocks often sit mid-page.
5) Keep token use low, but never stop before you have inspected enough main slices to capture every rendered section.
6) Apply CONTENT REFERENCE RULES (content[] elements must include a type; single content must include type).
7) Follow TEMPLATE COMPLIANCE guidance to collapse granular fragments into required canonical components (e.g., blog-post, blog-list) before returning JSON.
8) Return only a JSON object with fields "components" and "pageMetadata" as specified.
9) IMPORTANT: DOM nodes may have a "bgImage" field containing a CSS background-image URL. When you see bgImage on a card, section, or container element, use it as the image source (image.src) for that component.
10) DOM nodes may also have a "bgColor" field containing a CSS background-color in hex format (e.g., "#008ccc"). Use this for card/section styling.
11) IMPORTANT: Watch for linked-image + text-block patterns. When you see <a><img src="..."></a> immediately followed by a text container, these form a SINGLE card.
12) Before finalizing, run this completeness checklist and backfill any gaps.

`;

  // Generate 53 component contracts similar to the actual import
  const componentContracts = generateComponentContracts();

  // Generate template compliance rules
  const templateRules = generateTemplateRules();

  return baseRules + templateRules + '\n\n' + componentContracts + '\n\nCRITICAL: Return COMPLETE, VALID JSON with all brackets closed.';
}

function generateComponentContracts(): string {
  const components = [
    'navbar', 'footer', 'hero-simple', 'hero-with-image', 'hero-video', 'hero-carousel',
    'hero-banner', 'hero-split', 'hero-minimal', 'text-block', 'two-column', 'image-gallery',
    'video-player', 'video-embed', 'accordion', 'tabs', 'card-grid', 'content-feed',
    'html-block', 'quote-block', 'feature-grid', 'feature-list', 'feature-showcase',
    'feature-comparison', 'cta-simple', 'cta-with-form', 'cta-banner', 'cta-button-group',
    'testimonials', 'logo-cloud', 'reviews', 'case-study', 'contact-form', 'contact-info',
    'location-map', 'simple-form', 'team-grid', 'about-section', 'timeline', 'mission',
    'blog-post', 'blog-list', 'article-header', 'author-bio', 'related-posts',
    'pricing-table', 'pricing-card', 'pricing-comparison', 'data-table', 'chart',
    'statistics', 'breadcrumbs', 'sidemenu'
  ];

  let contracts = '=== COMPONENT CONTRACTS (53) ===\nOnly emit documented fields; omit any legacy or unsupported keys.\n\n';

  for (const comp of components) {
    contracts += `${comp} — Component description for ${comp}. This is a ${comp} component that renders specific UI elements.
  Fields:
    - heading: string (required) — Main heading for the ${comp} section
    - subheading: string (optional) — Supporting subheading
    - content: string (optional) — Rich text content (HTML allowed)
    - items: array (optional) — List of child items
    - image: object (optional) — Image with src, alt, width, height
    - cta: object (optional) — Call to action with text, href, variant
    - layout: select (optional) — Layout style (default, centered, wide)
    - theme: select (optional) — Color theme (light, dark, brand)
    - showBackground: boolean (optional) — Whether to show background
    - columns: number (optional) — Number of columns for grid layouts
    - spacing: select (optional) — Spacing between elements (compact, normal, relaxed)
    - animation: select (optional) — Animation style (none, fade, slide)
    - alignment: select (optional) — Content alignment (left, center, right)
    - maxWidth: string (optional) — Maximum width constraint
    - paddingTop: string (optional) — Top padding
    - paddingBottom: string (optional) — Bottom padding

`;
  }

  return contracts;
}

function generateTemplateRules(): string {
  const templates = [
    { key: 'marketing/home-default', name: 'Marketing Home', homeEligible: true },
    { key: 'core/generic-default', name: 'Generic Content Page', homeEligible: false },
    { key: 'core/folder', name: 'Navigation Folder', homeEligible: false },
    { key: 'blog/index-standard', name: 'Blog Index', homeEligible: false },
    { key: 'blog/post-standard', name: 'Blog Post', homeEligible: false },
    { key: 'commerce/product-detail', name: 'Product Detail', homeEligible: false }
  ];

  let rules = '=== PAGE TEMPLATE OVERVIEW ===\nTemplates available: 6\nHome-eligible template keys: marketing/home-default\n\n';
  rules += 'SELECTION RULES:\n';
  rules += '- You MUST set pageTemplate.templateKey to one of the registered keys.\n';
  rules += '- When analyzing the site root (path `/`), choose a template marked home eligible.\n';
  rules += '- Match required regions and allowed components to the detected layout before selecting.\n\n';

  for (const template of templates) {
    rules += `Template: ${template.key} (${template.name})
  Category: ${template.key.split('/')[0]} | Home eligible: ${template.homeEligible ? 'yes' : 'no'}
  Required regions: header -> [navbar, breadcrumbs, sidemenu] min=1 | footer -> [footer] min=1
  Optional regions: hero -> [hero-simple, hero-with-image, hero-video, hero-carousel, hero-banner, hero-split, hero-minimal] | main -> [feature-grid, feature-list, card-grid, content-feed, text-block, accordion, tabs, testimonials, cta-simple, cta-banner, pricing-table, contact-form, team-grid, about-section, timeline, blog-list, blog-post, html-block, quote-block, image-gallery, video-player, video-embed]
  Template props: primaryHeroVariant: enum (optional values=[hero-simple, hero-with-image, hero-video, hero-carousel]) | featuredHighlights: content-reference[] (optional) | supportingSocialProof: content-reference (optional)
  Content schema: components: content[] (required)
  Layout tips: Always render navigation before the hero to anchor the brand. | Hero should include headline, supporting text, and a clear primary CTA.
  Content tip: Use benefit-led copy with concise paragraphs and scannable bullet points.
  Recommended components: feature-grid, testimonials, pricing-table, cta-banner
  Route hints: ${template.key === 'marketing/home-default' ? '/, /home' : template.key.includes('blog') ? '/blog, /resources' : '/page, /content'}

=== TEMPLATE COMPLIANCE RULES FOR ${template.key} ===
Always emit the canonical components required by the selected template before validation.
Collapse granular detections (article-header, text-block, teaser cards, etc.) into the canonical type allowed for each region.
Do not emit a "region" field; the importer assigns regions automatically. Keep the component order identical to the page.

Region "header" canonical types:
  - navbar - Primary site navigation with logo, menu items, and optional call-to-action.
    Collapse fragments: logo, menu, cta-button
    Typical cues: navigation, menu, site header, global nav
  - breadcrumbs - Breadcrumb trail reflecting the current page hierarchy.
    Collapse fragments: breadcrumb-trail, breadcrumb-item
    Typical cues: breadcrumbs, navigation trail, page hierarchy
  - sidemenu - Vertical navigation menu for secondary pages.
    Collapse fragments: menu-section, menu-link
    Typical cues: side navigation, sidebar menu, secondary navigation

Region "footer" canonical types:
  - footer - Site footer with navigation columns, social links, and compliance details.
    Collapse fragments: footer-column, social-links, legal-links
    Typical cues: footer, copyright, contact information, bottom navigation

Region "main" canonical types:
  - hero-with-image - Hero section pairing narrative copy with a prominent supporting image.
    Collapse fragments: hero-heading, hero-subheading, hero-image, cta-button
    Typical cues: hero image, above the fold, marketing hero
  - feature-grid - Feature highlights arranged in a responsive grid.
    Collapse fragments: feature-card, icon-text, supporting-copy
    Typical cues: feature grid, benefit highlights, columns of features
  - card-grid - Grid of cards for features, case studies, or resources.
    Collapse fragments: card, image, card-cta
    Typical cues: cards, tile grid, resource cards
  - text-block - Rich text block for headings and paragraphs.
    Collapse fragments: heading, subheading, rich-text
    Typical cues: text block, rich text, content section
  - testimonials - Carousel or grid of customer testimonials.
    Collapse fragments: testimonial-quote, author-card
    Typical cues: testimonial, customer quote, social proof
  - cta-banner - Full-width call-to-action section.
    Collapse fragments: headline, supporting-copy, primary-button
    Typical cues: cta banner, full-width cta, promo strip

`;
  }

  return rules;
}

const SMALL_SYSTEM_PROMPT = `You are a component extraction engine that must use the provided tools to fetch and analyze pages.
Rules:
1) Use tools to fetch page data; do not browse yourself.
2) Preserve strict top-to-bottom order of components in output.
3) For any URL attributes (href/src/etc), extract verbatim as in HTML.
4) Call fetch_outline first; then fetch header/footer and main sections.
5) Return only a JSON object with fields "pageTemplate" and "components".

=== PAGE TEMPLATE OVERVIEW ===
Templates available: marketing/home-default, core/generic-default
Home-eligible template keys: marketing/home-default

OUTPUT FORMAT:
{
  "pageTemplate": { "templateKey": "...", "confidence": 0.95, "reason": "..." },
  "components": [
    ["navbar", 0.98, {
      "logo": { "src": "...", "alt": "...", "href": "/" },
      "search": { "enabled": true/false, "placeholder": "..." },
      "menuItems": [
        { "type": "nav-menu-item", "id": "...", "label": "...", "href": "...", "external": false, "children": [...] }
      ]
    }],
    ["footer", 0.9, { ... }]
  ]
}

=== COMPONENT CONTRACTS ===
navbar fields: logo (object), search (object), menuItems (array), cta (optional)
nav-menu-item fields: type ("nav-menu-item"), id, label, href, external (boolean), children (optional array)
footer fields: columns (array), socialLinks (array), legalLinks (array), copyright (string)

CRITICAL: Return COMPLETE, VALID JSON with all brackets closed.`;

async function callOpenRouter(
  messages: Message[],
  options: {
    maxTokens?: number;
    temperature?: number;
    tools?: Tool[];
  } = {}
): Promise<OpenRouterResponse> {
  const { maxTokens = MAX_TOKENS, temperature = 0.1, tools } = options;

  const requestBody: Record<string, unknown> = {
    model: MODEL,
    messages,
    max_tokens: maxTokens,
    temperature,
  };

  // Test FIX: Add max_tokens: 0 to reasoning config to explicitly reserve 0 tokens
  if (FIX_REASONING) {
    requestBody.reasoning = { enabled: false, max_tokens: 0 };
  } else {
    // Original: just enabled: false (may not work due to provider bug)
    requestBody.reasoning = { enabled: false };
  }

  // Test FIX: Explicit provider routing to ensure x-ai handles the request directly
  if (FIX_PROVIDER) {
    // Extract provider from model ID (e.g., 'x-ai/grok-4.1-fast' -> 'x-ai')
    const provider = MODEL.split('/')[0];
    requestBody.provider = { order: [provider] };
  }

  if (tools && tools.length > 0) {
    requestBody.tools = tools;
    requestBody.tool_choice = 'auto';
  }

  // Debug mode: Enable echo_upstream_body to see what OpenRouter sends to the provider
  // NOTE: This requires streaming mode!
  if (DEBUG_UPSTREAM) {
    requestBody.stream = true;
    requestBody.debug = { echo_upstream_body: true };
  }

  if (VERBOSE || DEBUG_UPSTREAM) {
    console.log('\n📤 REQUEST:');
    console.log('  Model:', MODEL);
    console.log('  Max Tokens:', maxTokens);
    console.log('  Messages:', messages.length);
    console.log('  Tools:', tools ? tools.length : 0);
    console.log('  Provider fix:', FIX_PROVIDER ? '✅ ENABLED' : '❌ DISABLED');
    console.log('  Reasoning fix:', FIX_REASONING ? '✅ ENABLED (max_tokens: 0)' : '❌ DISABLED');
    console.log('  Debug upstream:', DEBUG_UPSTREAM ? '✅ ENABLED (streaming)' : '❌ DISABLED');
    console.log('  Request body:', JSON.stringify({
      reasoning: requestBody.reasoning,
      provider: requestBody.provider,
      debug: requestBody.debug
    }));
  }

  const response = await fetch(`${BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${API_KEY}`,
      'HTTP-Referer': 'http://localhost:3000',
      'X-Title': 'LLM Truncation Reproduction',
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API error: ${response.status} - ${errorText}`);
  }

  // Handle streaming response for debug mode
  if (DEBUG_UPSTREAM) {
    const reader = response.body?.getReader();
    if (!reader) throw new Error('No response body');

    const decoder = new TextDecoder();
    let fullContent = '';
    let debugInfo: unknown = null;
    let finalResponse: OpenRouterResponse | null = null;
    let buffer = ''; // Buffer for incomplete SSE lines

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      buffer += chunk;

      // Split on newlines but keep incomplete lines in buffer
      const lines = buffer.split('\n');
      buffer = lines.pop() || ''; // Keep last incomplete line

      for (const line of lines) {
        if (!line.trim()) continue;

        // Log first few SSE events to see the structure
        if (DEBUG_UPSTREAM && fullContent.length < 100) {
          console.log('  SSE:', line.substring(0, 200));
        }

        if (!line.startsWith('data: ')) continue;
        const data = line.slice(6);
        if (data === '[DONE]') continue;

        try {
          const parsed = JSON.parse(data);

          // Debug chunk has empty choices and debug field
          if (parsed.debug) {
            debugInfo = parsed.debug;
            console.log('\n🔍 UPSTREAM DEBUG INFO (echo_upstream_body):');
            console.log('═'.repeat(60));
            // Show key upstream parameters
            const upstream = parsed.debug.echo_upstream_body;
            if (upstream) {
              console.log('  Stream:', upstream.stream);
              console.log('  Model:', upstream.model);
              console.log('  Max Tokens:', upstream.max_tokens);
              console.log('  Temperature:', upstream.temperature);
              console.log('  Reasoning:', JSON.stringify(upstream.reasoning));
              console.log('  Tools count:', upstream.tools?.length || 0);
              console.log('  Messages count:', upstream.messages?.length || 0);
              // Check if there's anything unusual
              const knownKeys = ['stream', 'model', 'max_tokens', 'temperature', 'reasoning', 'tools', 'messages', 'tool_choice'];
              const extraKeys = Object.keys(upstream).filter(k => !knownKeys.includes(k));
              if (extraKeys.length > 0) {
                console.log('  Extra params:', extraKeys.join(', '));
                for (const key of extraKeys) {
                  console.log(`    ${key}:`, JSON.stringify(upstream[key]).substring(0, 100));
                }
              }
            } else {
              console.log(JSON.stringify(parsed.debug, null, 2));
            }
            console.log('═'.repeat(60));
            continue;
          }

          // Accumulate content from streaming chunks
          const delta = parsed.choices?.[0]?.delta;
          if (delta?.content) {
            fullContent += delta.content;
          }

          // Check for tool calls
          if (delta?.tool_calls) {
            // Build final response structure
            if (!finalResponse) {
              finalResponse = {
                id: parsed.id,
                model: parsed.model,
                choices: [{
                  index: 0,
                  message: { role: 'assistant', content: null, tool_calls: [] },
                  finish_reason: null
                }],
                usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 }
              };
            }
            // Accumulate tool calls
            for (const tc of delta.tool_calls) {
              const existingIdx = finalResponse.choices[0].message.tool_calls?.findIndex(
                (t: ToolCall) => t.index === tc.index
              );
              if (existingIdx === -1 || existingIdx === undefined) {
                finalResponse.choices[0].message.tool_calls?.push({
                  ...tc,
                  function: { name: tc.function?.name || '', arguments: tc.function?.arguments || '' }
                });
              } else {
                const existing = finalResponse.choices[0].message.tool_calls![existingIdx];
                if (tc.function?.arguments) {
                  existing.function.arguments += tc.function.arguments;
                }
              }
            }
          }

          // Capture finish_reason and usage
          if (parsed.choices?.[0]?.finish_reason) {
            if (!finalResponse) {
              finalResponse = {
                id: parsed.id,
                model: parsed.model,
                choices: [{
                  index: 0,
                  message: { role: 'assistant', content: fullContent || null },
                  finish_reason: parsed.choices[0].finish_reason
                }],
                usage: parsed.usage || { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 }
              };
            } else {
              finalResponse.choices[0].finish_reason = parsed.choices[0].finish_reason;
              finalResponse.choices[0].message.content = fullContent || null;
              if (parsed.usage) finalResponse.usage = parsed.usage;
            }
          }
        } catch {
          // Skip non-JSON lines
        }
      }
    }

    if (!finalResponse) {
      finalResponse = {
        id: 'stream',
        model: MODEL,
        choices: [{
          index: 0,
          message: { role: 'assistant', content: fullContent || null },
          finish_reason: 'stop'
        }],
        usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 }
      };
    }

    return finalResponse;
  }

  return await response.json() as OpenRouterResponse;
}

function handleToolCall(toolCall: ToolCall): string {
  const args = JSON.parse(toolCall.function.arguments);

  if (toolCall.function.name === 'fetch_outline') {
    if (VERBOSE) console.log(`  📡 Tool: fetch_outline(${args.url})`);
    return JSON.stringify(MOCK_OUTLINE);
  }

  if (toolCall.function.name === 'get_section') {
    if (VERBOSE) console.log(`  📡 Tool: get_section(${args.handle}, ${args.key})`);
    if (args.key === 'header') return MOCK_HEADER_HTML;
    if (args.key.startsWith('main')) return MOCK_MAIN_HTML;
    if (args.key === 'footer') return MOCK_FOOTER_HTML;
    return `<div>Unknown section: ${args.key}</div>`;
  }

  return '{}';
}

function analyzeResponse(response: OpenRouterResponse, iteration: number): { isComplete: boolean; hasToolCalls: boolean } {
  const choice = response.choices[0];
  const content = choice.message.content || '';
  const hasToolCalls = (choice.message.tool_calls?.length || 0) > 0;

  console.log(`\n📥 RESPONSE #${iteration}:`);
  console.log('  Finish reason:', choice.finish_reason);
  if (choice.native_finish_reason) {
    console.log('  Native finish reason:', choice.native_finish_reason);
  }
  console.log('  Has tool_calls:', hasToolCalls);
  console.log('  Content length:', content.length, 'chars');
  console.log('  Prompt tokens:', response.usage.prompt_tokens);
  console.log('  Completion tokens:', response.usage.completion_tokens);
  console.log('  Total tokens:', response.usage.total_tokens);

  if (hasToolCalls) {
    console.log('  Tool calls:');
    for (const tc of choice.message.tool_calls || []) {
      console.log(`    - ${tc.function.name}(${tc.function.arguments})`);
    }
    return { isComplete: false, hasToolCalls: true };
  }

  if (content) {
    console.log('\n🔍 JSON ANALYSIS:');

    // Count brackets
    const openBraces = (content.match(/\{/g) || []).length;
    const closeBraces = (content.match(/\}/g) || []).length;
    const openBrackets = (content.match(/\[/g) || []).length;
    const closeBrackets = (content.match(/\]/g) || []).length;

    console.log('  Open braces {:', openBraces);
    console.log('  Close braces }:', closeBraces);
    console.log('  Open brackets [:', openBrackets);
    console.log('  Close brackets ]:', closeBrackets);

    const isComplete = openBraces === closeBraces && openBrackets === closeBrackets;
    console.log('  JSON appears complete:', isComplete ? '✅ YES' : '❌ NO');

    if (!isComplete) {
      console.log('  Missing:',
        openBraces - closeBraces, 'braces,',
        openBrackets - closeBrackets, 'brackets'
      );

      // Show truncation point
      const lastChars = content.slice(-150);
      console.log('\n  ⚠️ TRUNCATION POINT (last 150 chars):');
      console.log('  ', JSON.stringify(lastChars));
    }

    // Try to parse
    try {
      JSON.parse(content);
      console.log('  JSON.parse:', '✅ SUCCESS');
    } catch (e) {
      console.log('  JSON.parse:', '❌ FAILED -', (e as Error).message);
    }

    if (VERBOSE || !isComplete) {
      console.log('\n📄 CONTENT:');
      console.log('─'.repeat(60));
      console.log(content);
      console.log('─'.repeat(60));
    }

    return { isComplete, hasToolCalls: false };
  }

  return { isComplete: false, hasToolCalls: false };
}

async function runTest(): Promise<void> {
  console.log('═'.repeat(60));
  console.log('🔬 LLM TRUNCATION REPRODUCTION TEST');
  console.log('═'.repeat(60));
  console.log('Date:', new Date().toISOString());
  console.log('Mode:', DIRECT_XAI ? '🚀 DIRECT xAI API (bypassing OpenRouter)' : '🔀 OpenRouter');
  console.log('Base URL:', BASE_URL);
  console.log('API Key:', API_KEY ? '✅ Set' : '❌ Missing');
  console.log('Model:', MODEL);
  console.log('Max Tokens:', MAX_TOKENS);
  console.log('Verbose:', VERBOSE);
  console.log('Prompt Size:', LARGE_PROMPT ? 'LARGE (~50K tokens)' : 'SMALL (~1K tokens)');
  console.log('Fix: Provider routing:', FIX_PROVIDER ? '✅ ENABLED' : '❌ DISABLED');
  console.log('Fix: Reasoning max_tokens:', FIX_REASONING ? '✅ ENABLED' : '❌ DISABLED');
  console.log('Debug: Upstream body:', DEBUG_UPSTREAM ? '✅ ENABLED (streaming mode)' : '❌ DISABLED');

  if (!API_KEY) {
    console.error(DIRECT_XAI
      ? '❌ XAI_API_KEY not set in .env.local'
      : '❌ OPENROUTER_API_KEY not set in .env.local');
    process.exit(1);
  }

  const systemPrompt = LARGE_PROMPT ? generateLargeSystemPrompt() : SMALL_SYSTEM_PROMPT;
  console.log('System prompt length:', systemPrompt.length, 'chars (~', Math.round(systemPrompt.length / 4), 'tokens approx)');

  // Start with initial messages
  const messages: Message[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: 'Extract components from: https://www.tio.com.au/. Do not rely on memory; use the tools to fetch the page. Then return only the required JSON.' },
  ];

  let iteration = 0;
  const maxIterations = 10;

  while (iteration < maxIterations) {
    iteration++;
    console.log(`\n${'─'.repeat(60)}`);
    console.log(`🔄 ITERATION ${iteration}`);
    console.log('─'.repeat(60));

    const response = await callOpenRouter(messages, { tools: TOOLS });
    const { isComplete, hasToolCalls } = analyzeResponse(response, iteration);

    // Add assistant message to conversation
    messages.push({
      role: 'assistant',
      content: response.choices[0].message.content,
      tool_calls: response.choices[0].message.tool_calls,
    });

    if (hasToolCalls) {
      // Process tool calls and add tool responses
      for (const toolCall of response.choices[0].message.tool_calls || []) {
        const result = handleToolCall(toolCall);
        messages.push({
          role: 'tool',
          content: result,
          tool_call_id: toolCall.id,
          name: toolCall.function.name,
        });
      }
      continue;
    }

    if (isComplete) {
      console.log('\n✅ JSON is complete!');
      break;
    }

    // JSON is incomplete - this is the bug we're trying to reproduce
    console.log('\n❌ JSON IS INCOMPLETE - BUG REPRODUCED!');
    console.log('  finish_reason:', response.choices[0].finish_reason);
    console.log('  This confirms the model stopped prematurely.');
    break;
  }

  console.log('\n═'.repeat(60));
  console.log('🏁 TEST COMPLETE');
  console.log('═'.repeat(60));

  console.log(`
📋 DIAGNOSIS SUMMARY:
${'─'.repeat(60)}

If finish_reason is "stop" but JSON is incomplete:
  → The model thinks it's done but didn't complete the output
  → This is a MODEL BUG or OpenRouter not forwarding the real reason
  → May be related to prompt size (large prompts cause truncation)

If finish_reason is "length":
  → Token limit was hit (expected behavior)
  → Need to increase max_tokens or reduce prompt size

If finish_reason is "tool_calls":
  → Model wants to call more tools (expected during multi-turn)

NEXT STEPS:
  1. Try with --prompt-size=large to simulate actual import prompt
  2. Compare with other models to isolate model-specific behavior
  3. Check if OpenRouter is forwarding the real finish_reason

COMMANDS TO TRY:
  # Reproduce the bug
  npx tsx scripts/reproduce-llm-truncation.ts --large

  # Test with fixes
  npx tsx scripts/reproduce-llm-truncation.ts --large --fix-reasoning
  npx tsx scripts/reproduce-llm-truncation.ts --large --fix-provider
  npx tsx scripts/reproduce-llm-truncation.ts --large --fix-reasoning --fix-provider

  # Debug: See what OpenRouter sends to upstream provider
  npx tsx scripts/reproduce-llm-truncation.ts --large --debug-upstream

  # Test alternative models
  npx tsx scripts/reproduce-llm-truncation.ts --large --model=anthropic/claude-haiku-4.5
  npx tsx scripts/reproduce-llm-truncation.ts --large --model=openai/gpt-4o-mini
  npx tsx scripts/reproduce-llm-truncation.ts --large --model=google/gemini-2.5-flash
`);
}

runTest().catch(console.error);
