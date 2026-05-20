/**
 * Context Provider
 * 
 * Loads and manages website metadata and content structures
 * for AI tool execution with performance optimization.
 */

import { WebsiteService } from '@/lib/services/website-service';
import { getContentTypes } from '@/lib/services/content-type-service';
import type { Website, ContentType } from '@/lib/generated/prisma';
import type { BuildDetectionPromptOptions } from '@/lib/studio/ai/component-catalog';

let cachedTemplateCompliancePrompt: string | null | undefined;

async function loadTemplateCompliancePrompt(): Promise<string | null> {
  if (cachedTemplateCompliancePrompt !== undefined) {
    return cachedTemplateCompliancePrompt;
  }

  try {
    const [{ buildTemplateComplianceSection }, { getPageCatalogSummary }] = await Promise.all([
      import('@/lib/studio/ai/component-catalog'),
      import('@/lib/studio/ai/page-catalog')
    ]);
    const summary = await getPageCatalogSummary();
    cachedTemplateCompliancePrompt = buildTemplateComplianceSection(summary) ?? null;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn('[ContextProvider] Failed to load template compliance guidance', { message });
    cachedTemplateCompliancePrompt = null;
  }

  return cachedTemplateCompliancePrompt;
}

/**
 * Website context for AI operations
 */
export interface WebsiteContext {
  website: Website;
  contentTypes: ContentType[];
  businessRules?: BusinessRules;
  metadata: {
    loadTime: number;
    pruned: boolean;
    tokenEstimate?: number;
  };
  componentLibrary?: ComponentLibraryContext;
}

export interface ComponentLibraryComponentProperty {
  name: string;
  type: string;
  required: boolean;
  description?: string;
  allowedTypes?: string[];
}

export interface ComponentLibraryComponent {
  type: string;
  category: string;
  description?: string;
  keywords: string[];
  patterns: string[];
  confidence: number;
  metadata?: Record<string, any>;
  properties?: ComponentLibraryComponentProperty[];
}

export interface ComponentLibrarySubComponent {
  type: string;
  description?: string;
  properties?: ComponentLibraryComponentProperty[];
}

export interface ComponentLibrarySummary {
  total: number;
  generatedAt: string;
  components: ComponentLibraryComponent[];
  categories: Array<{ name: string; components: ComponentLibraryComponent[] }>;
  topLevelTypes: string[];
  subComponentTypes: string[];
  subComponents: ComponentLibrarySubComponent[];
}

export interface ComponentLibraryPromptOptions {
  chatPrompt?: {
    includeGuidelines?: boolean;
    maxComponentsPerCategory?: number;
    maxPropertiesPerComponent?: number;
  };
  detectionPrompt?: Omit<BuildDetectionPromptOptions, 'schemaSummary'>;
}

export interface ComponentLibraryContext {
  summary: ComponentLibrarySummary;
  prompts: {
    chat?: string;
    detection?: string;
  };
}


/**
 * Business rules for different website types
 */
export interface BusinessRules {
  websiteType: string;
  rules: string[];
  constraints: Record<string, any>;
}

/**
 * Context loading options
 */
export interface ContextLoadOptions {
  includeContentTypes?: boolean;
  includeBusinessRules?: boolean;
  maxTokens?: number;
  pruneForTokens?: boolean;
  includeComponentLibrary?: boolean;
  componentLibraryOptions?: ComponentLibraryPromptOptions;
}

/**
 * Performance monitoring
 */
class PerformanceMonitor {
  private startTime: number = 0;

  start(): void {
    this.startTime = performance.now();
  }

  end(): number {
    return performance.now() - this.startTime;
  }
}

/**
 * Context provider class
 */
export class ContextProvider {
  private websiteService: WebsiteService;
  private cache: Map<string, { context: WebsiteContext; timestamp: number }> = new Map();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  private readonly MAX_LOAD_TIME = 500; // 500ms requirement

  constructor() {
    this.websiteService = new WebsiteService();
  }

  /**
   * Load website context with performance monitoring
   */
  async loadWebsiteContext(
    websiteId: string,
    options: ContextLoadOptions = {}
  ): Promise<WebsiteContext> {
    const monitor = new PerformanceMonitor();
    monitor.start();

    try {
      // Check cache first
      const cached = this.getCachedContext(websiteId);
      if (cached) {
        if (options.includeComponentLibrary && !cached.componentLibrary) {
          await this.attachComponentLibrary(cached, options.componentLibraryOptions);
          this.cacheContext(websiteId, cached);
        }
        return cached;
      }

      // Load website data
      const website = await this.websiteService.getWebsite(websiteId);
      if (!website) {
        throw new Error(`Website not found: ${websiteId}`);
      }

      // Initialize context - ensure metadata and settings are defined
      const context: WebsiteContext = {
        website: {
          ...website,
          metadata: website.metadata || {},
          settings: website.settings || {}
        } as Website,
        contentTypes: [],
        metadata: {
          loadTime: 0,
          pruned: false
        }
      };

      // Load content types if requested
      if (options.includeContentTypes !== false) {
        context.contentTypes = await this.loadContentStructure(websiteId);
      }

      // Load business rules if requested
      if (options.includeBusinessRules) {
        context.businessRules = await this.getBusinessRules(website.category);
      }

      if (options.includeComponentLibrary) {
        await this.attachComponentLibrary(context, options.componentLibraryOptions);
      }

      // Prune context if needed
      if (options.pruneForTokens && options.maxTokens) {
        context.metadata.pruned = true;
        await this.pruneContext(context, options.maxTokens);
      }

      // Record load time
      const loadTime = monitor.end();
      context.metadata.loadTime = loadTime;

      // Warn if load time exceeds requirement
      if (loadTime > this.MAX_LOAD_TIME) {
        console.warn(`Context load time exceeded ${this.MAX_LOAD_TIME}ms: ${loadTime}ms`);
      }

      // Cache the context
      this.cacheContext(websiteId, context);

      return context;
    } catch (error) {
      const loadTime = monitor.end();
      console.error(`Failed to load context in ${loadTime}ms:`, error);
      throw error;
    }
  }

  /**
   * Load content structure for a website
   */
  async loadContentStructure(websiteId: string): Promise<ContentType[]> {
    try {
      const contentTypes = await getContentTypes(websiteId);
      // Cast to any then ContentType[] to bypass type incompatibility
      return (contentTypes as any as ContentType[]) || [];
    } catch (error) {
      console.error('Failed to load content structure:', error);
      return [];
    }
  }

  /**
   * Get business rules for a website type (stub for now)
   */
  async getBusinessRules(websiteType: string): Promise<BusinessRules> {
    // Stub implementation - will be fully implemented in Story 5.2+
    const businessRules: BusinessRules = {
      websiteType,
      rules: [
        'Content must be unique and relevant',
        'Navigation must be intuitive',
        'SEO best practices should be followed'
      ],
      constraints: {
        maxMenuDepth: 3,
        maxContentLength: 10000,
        requiredMetaTags: ['title', 'description']
      }
    };

    // Simulate async operation
    await new Promise(resolve => setTimeout(resolve, 10));
    
    return businessRules;
  }

  /**
   * Prune context to fit within token limit
   */
  private async pruneContext(context: WebsiteContext, maxTokens: number): Promise<void> {
    // Estimate tokens (rough approximation: 1 token ≈ 4 characters)
    const estimateTokens = (obj: any): number => {
      const str = JSON.stringify(obj);
      return Math.ceil(str.length / 4);
    };

    let currentTokens = estimateTokens(context);
    context.metadata.tokenEstimate = currentTokens;

    if (currentTokens <= maxTokens) {
      return;
    }

    // Pruning strategy: Remove less critical data
    // 1. Remove detailed content type fields
    if (context.contentTypes.length > 0) {
      context.contentTypes = context.contentTypes.map(ct => {
        const parsedFields = typeof ct.fields === 'string' ? JSON.parse(ct.fields) : ct.fields;
        const fieldCount = Array.isArray(parsedFields) ? parsedFields.length : 0;
        return {
          ...ct,
          fields: JSON.stringify({
            summary: `${fieldCount} fields`
          })
        } as ContentType;
      });
      
      currentTokens = estimateTokens(context);
      context.metadata.tokenEstimate = currentTokens;
      
      if (currentTokens <= maxTokens) {
        return;
      }
    }

    // 2. Remove business rules if present
    if (context.businessRules) {
      delete context.businessRules;
      currentTokens = estimateTokens(context);
      context.metadata.tokenEstimate = currentTokens;
      
      if (currentTokens <= maxTokens) {
        return;
      }
    }

    // 3. Limit content types to essential ones
    if (context.contentTypes.length > 5) {
      context.contentTypes = context.contentTypes.slice(0, 5);
      currentTokens = estimateTokens(context);
      context.metadata.tokenEstimate = currentTokens;
    }
  }

  private async attachComponentLibrary(context: WebsiteContext, options?: ContextLoadOptions['componentLibraryOptions']): Promise<void> {
    if (context.componentLibrary) {
      return;
    }

    try {
      const catalogModule = await import('@/lib/studio/ai/component-catalog')

      const summary = await catalogModule.getComponentCatalogSummary()
      const prompts: ComponentLibraryContext['prompts'] = {}
      try {
        prompts.chat = catalogModule.buildChatPrompt(summary, options?.chatPrompt)
      } catch (error) {
        console.error('Failed to build chat component prompt:', error)
      }

      if (options?.detectionPrompt) {
        try {
          const schemaBuilder = await import('@/lib/studio/ai/prompt-schema-builder')
          const schemaSummary = await schemaBuilder.buildPromptSchemaSummary()
          const detectionOptions: BuildDetectionPromptOptions = {
            ...options.detectionPrompt,
            schemaSummary
          }
          prompts.detection = catalogModule.buildDetectionPrompt(summary, detectionOptions)
        } catch (error) {
          console.error('Failed to build detection component prompt:', error)
        }
      }

      context.componentLibrary = {
        summary: summary as ComponentLibrarySummary,
        prompts
      }
    } catch (error) {
      console.error('Failed to load component library for context:', error)
    }
  }

  /**
   * Get cached context if still valid
   */
  private getCachedContext(websiteId: string): WebsiteContext | null {
    const cached = this.cache.get(websiteId);
    
    if (!cached) {
      return null;
    }

    const age = Date.now() - cached.timestamp;
    if (age > this.CACHE_TTL) {
      this.cache.delete(websiteId);
      return null;
    }

    return cached.context;
  }

  /**
   * Cache context for future use
   */
  private cacheContext(websiteId: string, context: WebsiteContext): void {
    this.cache.set(websiteId, {
      context,
      timestamp: Date.now()
    });

    // Clean up old cache entries
    if (this.cache.size > 100) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }
  }

  /**
   * Clear cache for a specific website or all
   */
  clearCache(websiteId?: string): void {
    if (websiteId) {
      this.cache.delete(websiteId);
    } else {
      this.cache.clear();
    }
  }

  /**
   * Generate system prompt from context (enforced explicit typing + guidance)
   */
  async generateSystemPrompt(context: WebsiteContext): Promise<string> {
    const parts: string[] = [
      `You are assisting with website: ${context.website.name}`,
      `Website category: ${context.website.category}`,
      `Active: ${context.website.isActive}`,
      '',
      '=== PRIMARY OBJECTIVE ===',
      '',
      'Help users manage their website content - this includes BOTH modifying existing content AND creating new pages.',
      '',
      '=== CRITICAL: MODIFICATION vs CREATION ===',
      '',
      'BEFORE taking any action, determine if the user wants to:',
      '',
      'A) MODIFY EXISTING CONTENT (use findAndUpdateComponent):',
      '   - Keywords: "change", "update", "edit", "modify", "fix", "replace", "set"',
      '   - Examples: "change the hero heading", "update the button text", "edit the footer"',
      '   - ACTION: Call findAndUpdateComponent with pageSearch and componentSearch parameters',
      '   - DO NOT use createPage for modifications!',
      '',
      'B) CREATE NEW CONTENT (use createPage):',
      '   - Keywords: "create", "add", "build", "make", "new", "generate"',
      '   - Examples: "create a new about page", "add a blog section", "build a contact form"',
      '   - ACTION: Use createPage to add new pages',
      '',
      '=== PAGE CREATION GUIDELINES ===',
      '',
      'When creating new pages, every page stores its layout inside content.components and must ship with fully-populated components.',
      '',
      '1. DISCOVER & PLAN:',
      '- Understand the business goal, audience, tone, and key offerings from the request.',
      '- Decide which pages are required (home, about, services, blog, contact, etc.) and what each page should communicate.',
      '- Share a short plan when helpful, then execute without pausing for confirmation.',
      '',
      '2. COMPONENT-FIRST PAGE CREATION:',
      '- Use listContentTypes/getContentType to locate the website page content type that exposes a components array.',
      '- Call createPage once per page. Do not craft raw ContentItems manually.',
      '- Populate params.content.components with an ordered array of component objects: { type: "<component-key>", ...fields }.',
      '- Respect allowedTypes for every nested content[] slot and always include the child type explicitly.',
      '- Keep components in visual order (navigation/header first, footers last).',
      '- Write domain-appropriate copy, media URLs, and CTA labels - never filler lorem ipsum.',
      '- Only introduce new content types when the user explicitly needs structured collections (e.g., blog posts, products).',
      '- When you must create a new content type, choose a PascalCase name (e.g., BlogPost) so validation passes.',
      '',
      '3. COMMUNICATION STYLE:',
      '- Be concise and action-focused (keep responses under about 10 lines unless details are requested).',
      '- Use short progress indicators like "- Created home page" immediately after running tools.',
      '- Group similar actions together to avoid noisy step-by-step chatter.',
      '',
      '4. PAGE QUALITY CHECKS:',
      '- Ensure each primary page has navigation, a hero or headline, supporting sections, and a clear CTA.',
      '- Link between pages when it improves UX (e.g., home -> blog).',
      '- Reflect branding cues from existing website metadata when available.',
      '',
      '5. TOOL EXECUTION:',
      '- When you commit to an action, execute the tool right away; never describe hypothetical steps.',
      '- Prefer assembling the full component tree before calling createPage for a page to minimize retries.',
      '- Inspect tool responses, handle validation errors, and retry with corrected data if needed.',
      '',
      '6. ERROR HANDLING:',
      '- Report issues in-line as "⚠ description" and continue executing remaining work when possible.',
      '- Include error counts and recovery notes in the closing summary if any failures occur.',
      '',
      '7. MODIFYING EXISTING CONTENT (REMINDER):',
      '- ALWAYS use findAndUpdateComponent for ANY request to change, update, edit, or modify existing content.',
      '- This tool accepts human-readable identifiers - no need to know exact IDs.',
      '- pageSearch: {title: "Home"} or {slug: "about"} or {fullPath: "/contact"}',
      '- componentSearch: {typePattern: "hero*"} or {position: "first"} or {containsText: "Get Started"}',
      '- NEVER use createPage, SearchImages, or ListContentTypes for modification requests.',
      '',
      '8. FINAL SUMMARY:',
      '- End with a one-line wrap-up such as "Your [type] website is ready with [N] pages."',
      '- Mention which pages were created and call out notable sections or CTAs.',
      '',
      '=== END OPERATING GUIDELINES ==='
    ];

    if (context.contentTypes.length > 0) {
      parts.push(`Available content types: ${context.contentTypes.map(ct => ct.name).join(', ')}`);
    }

    if (context.businessRules) {
      parts.push(`Business rules: ${context.businessRules.rules.join('; ')}`);
    }

    // Enrich with CMS component guidance and strict typing rules (runtime only)
    const componentLibraryPrompt = context.componentLibrary?.prompts?.chat;
    if (componentLibraryPrompt) {
      parts.push('', componentLibraryPrompt);
    } else {
      try {
        const { getRegisteredComponentTypeKeys, getAllContentAreaGuidance } = await import('@/lib/services/universal-types/type-guidance')
        const allTypes = new Set<string>((await getRegisteredComponentTypeKeys()) || [])
        const areaMap = await getAllContentAreaGuidance()
        const subTypes = new Set<string>()
        for (const [, fields] of Object.entries(areaMap)) {
          for (const f of fields) {
            for (const t of (f.allowedTypes || [])) subTypes.add(String(t))
          }
        }
        const topLevel = Array.from(allTypes).filter(t => !subTypes.has(t))
  
        // Derive explicitly marked sub-only types from the runtime registry
        let subOnlyList: string[] = []
        try {
          const { cmsComponentFactory } = await import('@/lib/studio/components/cms/_factory/factory')
          const catalog = cmsComponentFactory.getComponentCatalog()
          subOnlyList = Array.from(catalog.entries())
            .filter(([_, entry]) => (entry as any)?.subOnly)
            .map(([k]) => String(k))
        } catch {}
  
        parts.push('', '=== COMPONENT LIBRARY (FALLBACK) ===', '')
        parts.push('A. Page Content Structure:')
        parts.push('- Website pages store layout data in content.components (array).')
        parts.push('- Keep components in visual order and include a "type" field on every object.')
        parts.push('- For nested content[] slots, provide arrays of component objects whose type matches the allowedTypes list.')
        parts.push('- For single content references (content/contentReference), return an object with the correct type value set.')
        parts.push('')
        parts.push('B. Available Component Types:')
        parts.push(`- Top-level page components: ${topLevel.join(', ')}`)
        if (subTypes.size > 0) parts.push(`- Sub-component types (nested only): ${Array.from(subTypes).join(', ')}`)
        parts.push('')
        parts.push('C. Strict Sub-Only Policy:')
        if (subOnlyList.length > 0) parts.push(`- Sub-only types: ${subOnlyList.join(', ')}`)
        parts.push('- Never place sub-only types directly in page.components or in fields that do not explicitly list them.')
        parts.push('- Always include "type" for every item in any content[] array, no matter the depth.')
        parts.push('')
        parts.push('D. Content Slot Constraints:')
        if (Object.keys(areaMap).length === 0) {
          parts.push('- No explicit slot restrictions; if a field accepts content[], any registered type is allowed.')
        } else {
          for (const [comp, fields] of Object.entries(areaMap)) {
            if (!fields || fields.length === 0) continue
            const rows = fields.map(f => `  - ${f.name}: ${f.allowedTypes && f.allowedTypes.length > 0 ? f.allowedTypes.join('|') : 'any component type'}`)
            parts.push(`- ${comp}:\n${rows.join('\n')}`)
          }
        }
        parts.push('')
        parts.push('E. Assembly Tips:')
        parts.push('- Place navigation/headers first and footers last.')
        parts.push('- Use brand-appropriate copy, imagery, and CTAs; avoid placeholder lorem ipsum.')
      } catch {}
    }

    const templateCompliance = await loadTemplateCompliancePrompt();
    if (templateCompliance) {
      parts.push('', templateCompliance);
    }

    // Response format guidelines for clean conversational output
    parts.push(
      '',
      '=== RESPONSE FORMAT GUIDELINES ===',
      '',
      'When responding to user queries, follow these formatting rules:',
      '',
      '1. **Use Conversational Text**: Write responses in natural, conversational language. Do not wrap responses in code blocks, JSON, XML, or markdown formatting unless the user specifically requests code or technical output.',
      '',
      '2. **Avoid Technical Formatting**:',
      '   - Do NOT use ```json blocks for regular responses',
      '   - Do NOT use XML-style tags like <response> or <result>',
      '   - Do NOT use markdown headers (##, ###) in conversational replies',
      '   - Do NOT wrap responses in ``` code fences',
      '',
      '3. **When Technical Output IS Appropriate**:',
      '   - If user asks "show me the code" - provide code',
      '   - If user asks for JSON/data format - provide it',
      '   - Tool results (internal) should remain structured',
      '',
      '4. **Keep It Natural**:',
      '   - Write as you would speak to a colleague',
      '   - Use simple paragraphs and bullet points where helpful',
      '   - Be concise and direct',
      '',
      '=== END RESPONSE FORMAT GUIDELINES ==='
    );

    // Sanitize any garbled unicode sequences to ASCII for consistent rendering
    let output = parts.join('\n');
    try {
      output = output
        .replace(/âœ“/g, '-')   // checkmark
        .replace(/âš /g, 'ERROR:') // warning sign
        .replace(/â†’/g, '->')  // arrow
        .replace(/â€¢/g, '-')   // bullet
        .replace(/â€”/g, '-')   // em dash
    } catch {}
    return output;
  }
}

// Lazy initialization for singleton instance
let contextProviderInstance: ContextProvider | null = null;

const getContextProvider = (): ContextProvider => {
  if (!contextProviderInstance) {
    contextProviderInstance = new ContextProvider();
  }
  return contextProviderInstance;
};

// Export convenience functions
export const loadWebsiteContext = (websiteId: string, options?: ContextLoadOptions) => 
  getContextProvider().loadWebsiteContext(websiteId, options);

export const loadContentStructure = (websiteId: string) => 
  getContextProvider().loadContentStructure(websiteId);

export const getBusinessRules = (websiteType: string) => 
  getContextProvider().getBusinessRules(websiteType);

export const generateSystemPrompt = async (context: WebsiteContext) => 
  getContextProvider().generateSystemPrompt(context);

