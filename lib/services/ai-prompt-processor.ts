import { monitoring } from '@/lib/monitoring'
import { getBuilderAssistantSessionId } from '@/lib/studio/components/site-builder/assistant-session'

interface ProcessedPrompt {
  websiteName: string;
  description: string;
  category: 'page' | 'component';
  suggestedFeatures: string[];
  technicalRequirements: string[];
  targetAudience: string;
  /** URL to extract design system from (for "inspired by" prompts) */
  inspirationUrl?: string;
}

type ImportJobStatus = 'pending' | 'processing' | 'queued' | 'completed' | 'failed' | 'cancelled'

type ImportJobLifecycleState = 'active' | 'queued' | 'completed'

const debugAIPromptProcessor = (...args: unknown[]) => {
  if (process.env.NODE_ENV !== 'production') {
    console.log(...args)
  }
}

const warnAIPromptProcessor = (...args: unknown[]) => {
  if (process.env.NODE_ENV !== 'production') {
    console.warn(...args)
  }
}

const errorAIPromptProcessor = (...args: unknown[]) => {
  if (process.env.NODE_ENV !== 'production') {
    console.error(...args)
  }
}

export interface ImportJobSnapshot {
  id: string
  websiteId: string
  url: string
  status: ImportJobStatus
  state: ImportJobLifecycleState
  progress: number
  stage: string
  message: string | null
  mode: 'new' | 'merge'
  startedAt: string | null
  updatedAt: string
  completedAt: string | null
  createdAt: string
  queuePosition: number | null
  estimatedStartSeconds: number | null
  metadata?: Record<string, unknown> | null
  website: {
    id: string
    name: string | null
    icon: string | null
  } | null
}

type CreateWebsiteResult =
  | { type: 'import'; job: ImportJobSnapshot; prompt: ProcessedPrompt; url: string }
  | { type: 'ai'; websiteId: string; prompt: ProcessedPrompt; jobId?: string }

/**
 * Result from LLM-based workflow routing.
 */
interface WorkflowRoutingResult {
  workflow: 'import' | 'greenfield'
  importUrl?: string
  reasoning: string
  confidence: number
  /** True if this was determined by regex fallback (LLM unavailable) */
  usedFallback?: boolean
}

export class AIPromptProcessor {
  constructor() {
    // No longer using local storage
  }
  
  async processPrompt(userPrompt: string): Promise<ProcessedPrompt> {
    // Analyze prompt using pattern matching and heuristics
    const processed = await this.analyzePrompt(userPrompt);
    const candidateName = (processed.name ?? '').trim();
    const isCandidateValid =
      candidateName.length > 0 &&
      !/(?:https?:\/\/|www\.)/i.test(candidateName) &&
      !/[.@]/.test(candidateName) &&
      !/\b(import|please)\b/i.test(candidateName);

    // Extract inspiration URL (separate from import URL)
    // This is for "inspired by" prompts where we want the design but not the content
    const inspirationUrl = this.extractInspirationUrl(userPrompt);

    return {
      websiteName: isCandidateValid ? candidateName : this.generateDefaultName(userPrompt),
      description: processed.description || userPrompt,
      category: this.detectCategory(userPrompt),
      suggestedFeatures: this.extractFeatures(userPrompt),
      technicalRequirements: this.extractTechnicalNeeds(userPrompt),
      targetAudience: this.identifyAudience(userPrompt),
      inspirationUrl,
    };
  }
  
  async createWebsiteFromPrompt(userPrompt: string, processedPrompt?: ProcessedPrompt): Promise<CreateWebsiteResult> {
    const prompt = processedPrompt ?? (await this.processPrompt(userPrompt))

    // Use LLM-based workflow routing with regex fallback
    const routingResult = await this.detectWorkflowIntent(userPrompt)

    debugAIPromptProcessor('[AIPromptProcessor] Workflow routing decision:', {
      workflow: routingResult.workflow,
      importUrl: routingResult.importUrl,
      confidence: routingResult.confidence,
      usedFallback: routingResult.usedFallback,
      reasoning: routingResult.reasoning
    })

    if (routingResult.workflow === 'import' && routingResult.importUrl) {
      return this.startImportFromPrompt(routingResult.importUrl, userPrompt, prompt)
    }

    const websiteId = await this.createWebsiteViaApi(prompt, userPrompt)
    const jobId = await this.bootstrapGreenfieldWebsite({
      websiteId,
      originalPrompt: userPrompt,
      processedPrompt: prompt
    })
    return { type: 'ai', websiteId, prompt, jobId }
  }

  /**
   * Detect workflow intent using LLM with regex fallback.
   *
   * Calls the /api/studio/workflow-route endpoint to get LLM-based decision.
   * Falls back to regex-based extraction if LLM is unavailable.
   */
  private async detectWorkflowIntent(userPrompt: string): Promise<WorkflowRoutingResult> {
    try {
      const response = await fetch('/api/studio/workflow-route', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({ userPrompt })
      })

      if (!response.ok) {
        warnAIPromptProcessor('[AIPromptProcessor] Workflow routing API failed, using regex fallback', {
          status: response.status,
        })
        return this.detectWorkflowIntentFallback(userPrompt)
      }

      const result = await response.json()

      // Validate response structure
      if (!result.workflow || !['import', 'greenfield'].includes(result.workflow)) {
        warnAIPromptProcessor('[AIPromptProcessor] Invalid workflow routing response, using fallback')
        return this.detectWorkflowIntentFallback(userPrompt)
      }

      return {
        workflow: result.workflow,
        importUrl: result.importUrl,
        reasoning: result.reasoning || 'LLM-based decision',
        confidence: typeof result.confidence === 'number' ? result.confidence : 0.8,
        usedFallback: false
      }
    } catch (error) {
      warnAIPromptProcessor('[AIPromptProcessor] Workflow routing error, using fallback', {
        error: error instanceof Error ? error.message : String(error),
      })
      return this.detectWorkflowIntentFallback(userPrompt)
    }
  }

  /**
   * Fallback to regex-based workflow detection.
   * Used when LLM routing is unavailable.
   */
  private detectWorkflowIntentFallback(userPrompt: string): WorkflowRoutingResult {
    const importUrl = this.extractImportUrl(userPrompt)

    if (importUrl) {
      return {
        workflow: 'import',
        importUrl,
        reasoning: 'Regex fallback detected import URL pattern',
        confidence: 0.9,
        usedFallback: true
      }
    }

    return {
      workflow: 'greenfield',
      reasoning: 'Regex fallback - no import URL detected',
      confidence: 0.7,
      usedFallback: true
    }
  }



  private async bootstrapGreenfieldWebsite(input: {
    websiteId: string
    originalPrompt: string
    processedPrompt: ProcessedPrompt
  }): Promise<string | undefined> {
    try {
      const response = await fetch('/api/studio/site-builder/bootstrap', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          websiteId: input.websiteId,
          originalPrompt: input.originalPrompt,
          processedPrompt: input.processedPrompt,
          sessionId: getBuilderAssistantSessionId(input.websiteId)
        })
      })

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}))
        errorAIPromptProcessor('[AIPromptProcessor] Bootstrap request failed', {
          status: response.status,
          websiteId: input.websiteId,
          payload,
        })
        return undefined
      }

      const result = await response.json()
      const jobId = result.jobId as string | undefined
      if (!jobId) {
        warnAIPromptProcessor('[AIPromptProcessor] Bootstrap returned no jobId - progress tracking disabled')
      }

      // Check for error in data (legacy response format)
      const data = result.data
      if (data && !data.success) {
        warnAIPromptProcessor('[AIPromptProcessor] Bootstrap generation failed', {
          websiteId: input.websiteId,
          error: data.error,
          populatedPages: data.populatedPages,
        })
        // Don't throw - let UI handle the error gracefully
        // Store error message in sessionStorage for UI to display
        if (typeof window !== 'undefined') {
          try {
            sessionStorage.setItem(`bootstrap_error_${input.websiteId}`, JSON.stringify({
              error: data.error,
              timestamp: new Date().toISOString()
            }))
          } catch {
            // ignore storage errors
          }
        }
      }

      return jobId
    } catch (error) {
      errorAIPromptProcessor('[AIPromptProcessor] Bootstrap request error', {
        websiteId: input.websiteId,
        error: error instanceof Error ? error.message : String(error),
      })
      return undefined
    }
  }


  
  private async startImportFromPrompt(url: string, userPrompt: string, prompt: ProcessedPrompt): Promise<CreateWebsiteResult> {
    const normalizedUrl = this.normalizeImportUrl(url)
    const trimmedWebsiteName = prompt.websiteName?.trim() ?? ''
    const payload: { url: string; websiteName?: string } = { url: normalizedUrl }

    if (trimmedWebsiteName.length > 0) {
      payload.websiteName = trimmedWebsiteName
    }

    const response = await fetch('/api/studio/import/start', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}))
      const errorMessage = typeof errorBody.error === 'string'
        ? errorBody.error
        : errorBody.error?.message || 'Failed to start import'
      const error = new Error(errorMessage) as Error & { code?: string; details?: unknown; status?: number }
      if (errorBody.error && typeof errorBody.error === 'object') {
        error.code = typeof errorBody.error.code === 'string' ? errorBody.error.code : undefined
        error.details = errorBody.error.details
      }
      error.status = response.status
      throw error
    }

    const data = await response.json()
    const timestamp = new Date().toISOString()
    const lifecycleState = data.state === 'queued' ? 'queued' : 'active'
    const status: ImportJobStatus = lifecycleState === 'queued' ? 'queued' : 'pending'
    const queuePosition = typeof data.queuePosition === 'number' ? data.queuePosition : null
    const estimatedStartSeconds =
      typeof data.estimatedStartSeconds === 'number' ? data.estimatedStartSeconds : null
    const initialMessage =
      typeof data.message === 'string' && data.message.trim().length > 0
        ? data.message
        : lifecycleState === 'queued'
        ? 'Queued - waiting for an available import slot'
        : 'Import requested via AI assistant'

    const job: ImportJobSnapshot = {
      id: data.jobId,
      websiteId: data.websiteId,
      url: normalizedUrl,
      status,
      state: lifecycleState,
      progress: 0,
      stage: lifecycleState === 'queued' ? 'queued' : 'initializing',
      message: initialMessage,
      mode: data.mode ?? 'new',
      startedAt: lifecycleState === 'queued' ? null : timestamp,
      updatedAt: timestamp,
      completedAt: null,
      createdAt: timestamp,
      queuePosition,
      estimatedStartSeconds,
      website: null,
    }

    monitoring.logPerformance('import_llm_start', 0, {
      jobId: data.jobId,
      websiteId: data.websiteId,
      mode: data.mode ?? 'new',
      url: normalizedUrl,
      promptLength: userPrompt.length,
      features: prompt.suggestedFeatures,
      audience: prompt.targetAudience,
      state: lifecycleState,
      queuePosition,
    })

    return { type: 'import', job, prompt, url: normalizedUrl }
  }

  private async createWebsiteViaApi(prompt: ProcessedPrompt, userPrompt: string): Promise<string> {
    const response = await fetch('/api/websites', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: prompt.websiteName,
        description: prompt.description,
        category: prompt.category,
        icon: this.getCategoryIcon(prompt.category),
        settings: {
          features: {
            blog: prompt.suggestedFeatures.includes('blog'),
            shop:
              prompt.suggestedFeatures.includes('ecommerce') || prompt.suggestedFeatures.includes('payments'),
            analytics: prompt.suggestedFeatures.includes('analytics'),
          },
          theme: this.suggestTheme(prompt.category),
          techStack: this.suggestTechStack(prompt),
          suggestedFeatures: prompt.suggestedFeatures,
        },
        metadata: {
          targetAudience: prompt.targetAudience,
          technicalRequirements: prompt.technicalRequirements,
          createdViaAI: true,
          originalPrompt: userPrompt,
        },
      }),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error?.message || 'Failed to create website in database')
    }

    const { data: dbWebsite } = await response.json()
    return dbWebsite.id
  }
  /**
   * Extract import URL using regex patterns.
   * This is the fallback method used when LLM routing is unavailable.
   * @deprecated Use detectWorkflowIntent() for LLM-based routing
   */
  private extractImportUrl(userPrompt: string): string | null {
    // FIX 1: Only search in user's direct input, not uploaded file content
    const uploadedContentSeparator = '--- Uploaded Document Content ---'
    const searchText = userPrompt.includes(uploadedContentSeparator)
      ? userPrompt.split(uploadedContentSeparator)[0]
      : userPrompt

    // FIX 2: Check for import-intent phrases first (explicit import commands)
    const importIntentPattern = /(?:import|clone|copy|remake|recreate|rebuild)\s+(https?:\/\/[\w\-._~:/?#[\]@!$&'()*+,;=%]+)/i
    const intentMatch = searchText.match(importIntentPattern)
    if (intentMatch) {
      return this.normalizeImportUrl(intentMatch[1])
    }

    // Also check import-intent with www URLs
    const importIntentWwwPattern = /(?:import|clone|copy|remake|recreate|rebuild)\s+(www\.[\w\-._~:/?#[\]@!$&'()*+,;=%]+)/i
    const intentWwwMatch = searchText.match(importIntentWwwPattern)
    if (intentWwwMatch) {
      return this.normalizeImportUrl(intentWwwMatch[1])
    }

    // FIX 2 continued: Check if prompt is essentially just a URL (minimal other content)
    const trimmed = searchText.trim()

    // URL-only pattern: prompt is just a URL with optional whitespace
    const urlOnlyPattern = /^(https?:\/\/[\w\-._~:/?#[\]@!$&'()*+,;=%]+)\s*$/i
    const urlOnlyMatch = trimmed.match(urlOnlyPattern)
    if (urlOnlyMatch) {
      return this.normalizeImportUrl(urlOnlyMatch[1])
    }

    // www URL-only pattern
    const wwwOnlyPattern = /^(www\.[\w\-._~:/?#[\]@!$&'()*+,;=%]+)\s*$/i
    const wwwOnlyMatch = trimmed.match(wwwOnlyPattern)
    if (wwwOnlyMatch) {
      return this.normalizeImportUrl(wwwOnlyMatch[1])
    }

    // Bare domain-only pattern (e.g., "example.com" as the whole prompt)
    const domainOnlyPattern = /^(([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}(?:\/[\w\-._~:/?#[\]@!$&'()*+,;=%]*)?)\s*$/i
    const domainOnlyMatch = trimmed.match(domainOnlyPattern)
    if (domainOnlyMatch) {
      const candidate = domainOnlyMatch[1].replace(/[.,;!?]+$/, '')
      if (!candidate.includes(' ')) {
        return this.normalizeImportUrl(candidate)
      }
    }

    // No import URL detected - use greenfield workflow
    return null
  }

  private normalizeImportUrl(rawUrl: string): string {
    const trimmed = rawUrl.trim().replace(/[<>'"]+/g, '')
    const cleaned = trimmed.replace(/[.,;!?]+$/, '')
    // Already has HTTP/HTTPS protocol
    if (/^https?:\/\//i.test(cleaned)) {
      return cleaned
    }
    // Has a non-HTTP protocol (ftp://, file://, etc.) - pass through for API to reject
    if (/^[a-z][a-z0-9+.-]*:\/\//i.test(cleaned)) {
      return cleaned
    }
    // Has a malformed protocol-like prefix (ftp//, file//) - pass through for API to reject
    if (/^[a-z][a-z0-9+.-]*\/\//i.test(cleaned)) {
      return cleaned
    }
    if (cleaned.startsWith('www.')) {
      return `https://${cleaned}`
    }
    return `https://${cleaned}`
  }

  /**
   * Extract inspiration URL from prompts like:
   * - "inspired by https://..."
   * - "like https://..."
   * - "similar to https://..."
   * - "design like https://..."
   * - "style from https://..."
   *
   * This is distinct from import URL - inspiration URL extracts only design,
   * not content. If user just provides a bare URL without inspiration keywords,
   * it's treated as an import URL instead.
   */
  private extractInspirationUrl(userPrompt: string): string | undefined {
    // Patterns that indicate design inspiration (not full import)
    const inspirationPatterns = [
      // "inspired by https://..." or "inspired by www.example.com"
      /(?:inspired?\s+by|inspiration\s+from)\s+(https?:\/\/[\w\-._~:/?#[\]@!$&'()*+,;=%]+)/i,
      /(?:inspired?\s+by|inspiration\s+from)\s+(www\.[\w\-._~:/?#[\]@!$&'()*+,;=%]+)/i,
      // "like https://..." or "similar to https://..."
      /(?:look(?:ing)?|style[sd]?)\s+like\s+(https?:\/\/[\w\-._~:/?#[\]@!$&'()*+,;=%]+)/i,
      /(?:look(?:ing)?|style[sd]?)\s+like\s+(www\.[\w\-._~:/?#[\]@!$&'()*+,;=%]+)/i,
      /similar\s+to\s+(https?:\/\/[\w\-._~:/?#[\]@!$&'()*+,;=%]+)/i,
      /similar\s+to\s+(www\.[\w\-._~:/?#[\]@!$&'()*+,;=%]+)/i,
      // "design from https://..." or "style from https://..."
      /(?:design|style|colors?|theme)\s+(?:from|of)\s+(https?:\/\/[\w\-._~:/?#[\]@!$&'()*+,;=%]+)/i,
      /(?:design|style|colors?|theme)\s+(?:from|of)\s+(www\.[\w\-._~:/?#[\]@!$&'()*+,;=%]+)/i,
      // "based on https://..." (design context)
      /(?:design(?:ed)?|style[sd]?)\s+based\s+on\s+(https?:\/\/[\w\-._~:/?#[\]@!$&'()*+,;=%]+)/i,
      /(?:design(?:ed)?|style[sd]?)\s+based\s+on\s+(www\.[\w\-._~:/?#[\]@!$&'()*+,;=%]+)/i,
    ]

    for (const pattern of inspirationPatterns) {
      const match = userPrompt.match(pattern)
      if (match && match[1]) {
        return this.normalizeImportUrl(match[1])
      }
    }

    return undefined
  }

  private async analyzePrompt(prompt: string): Promise<{ name?: string; description?: string }> {
    // Check if this is a PRD-style document first
    const prdName = this.extractNameFromPRD(prompt);
    if (prdName) {
      return {
        name: prdName,
        description: prompt
      };
    }

    // Basic pattern analysis for name extraction
    const namePatterns = [
      /(?:create|build|make)\s+(?:a|an)?\s*([^,\.]+?)(?:\s+for|\s+with|\s+that|$)/i,
      /^([^,\.]+?)(?:\s+for|\s+with|\s+that)/i,
      /(?:want|need)\s+(?:a|an)?\s*([^,\.]+?)(?:\s+for|\s+with|\s+that|$)/i
    ];

    let extractedName = '';
    for (const pattern of namePatterns) {
      const match = prompt.match(pattern);
      if (match && match[1]) {
        extractedName = match[1].trim();
        break;
      }
    }

    return {
      name: this.cleanExtractedName(extractedName),
      description: prompt
    };
  }

  /**
   * Extract website name from PRD-style documents.
   * Looks for patterns like:
   * - "# Project Name PRD" or "# Project Name Website PRD"
   * - "Website Name: Something"
   * - "## Overview" followed by project description
   */
  private extractNameFromPRD(prompt: string): string | null {
    // Pattern 1: Markdown title "# Something PRD" or "# Something Website PRD"
    const titleMatch = prompt.match(/^#\s+(.+?)(?:\s+(?:Website\s+)?PRD|$)/im);
    if (titleMatch && titleMatch[1]) {
      const name = titleMatch[1].trim().replace(/\s+PRD$/i, '').replace(/\s+Website$/i, '');
      if (name.length > 0 && name.length < 100) {
        return this.formatAsTitle(name);
      }
    }

    // Pattern 2: "Website Name: Something" in PRD
    const websiteNameMatch = prompt.match(/Website\s*Name\s*:\s*([^\n]+)/i);
    if (websiteNameMatch && websiteNameMatch[1]) {
      const name = websiteNameMatch[1].trim();
      if (name.length > 0 && name.length < 100) {
        return this.formatAsTitle(name);
      }
    }

    // Pattern 3: "Project: Something" at the start
    const projectMatch = prompt.match(/Project\s*:\s*([^\n]+)/i);
    if (projectMatch && projectMatch[1]) {
      const name = projectMatch[1].trim();
      if (name.length > 0 && name.length < 100) {
        return this.formatAsTitle(name);
      }
    }

    return null;
  }
  
  private cleanExtractedName(name: string): string {
    // Remove common filler words and clean up the name
    const fillerWords = ['website', 'site', 'app', 'application', 'platform', 'system', 'tool', 'import', 'please', 'create', 'build', 'make'];
    let cleanedName = name;

    cleanedName = cleanedName.replace(/https?:\/\/|www\./gi, ' ');

    fillerWords.forEach(word => {
      const regex = new RegExp(`\\b${word}\\b`, 'gi');
      cleanedName = cleanedName.replace(regex, ' ').trim();
    });

    cleanedName = cleanedName.replace(/[-_.]+/g, ' ').replace(/\s+/g, ' ').trim();

    if (cleanedName.length === 0) {
      return '';
    }

    const tokens = cleanedName.split(' ').filter(Boolean);
    const filteredTokens = tokens.filter(token => !['com', 'net', 'org', 'edu', 'gov', 'au', 'co', 'io', 'us', 'uk'].includes(token.toLowerCase()));



    if (filteredTokens.length === 0) {
      return '';
    }

    return this.formatAsTitle(filteredTokens.join(' '));
  }

  private detectCategory(prompt: string): 'page' | 'component' {
    // PRIORITY 1: Check for strong website/PRD indicators FIRST
    // These override component patterns because they indicate a full website project
    const strongPageIndicators = [
      /sitemap|site\s*map/i,                          // PRD sitemap section
      /home\s*page|contact\s*page|about\s*page/i,     // Explicit page references
      /page\s*specification|page\s*spec/i,            // PRD page specs
      /website\s*prd|prd.*website/i,                  // PRD document
      /^\s*#.*website/im,                             // Markdown header with "website"
      /multiple\s*pages|several\s*pages/i,            // Multi-page intent
      /navigation\s*structure|site\s*structure/i,    // Site-level structure
      /\/\s*\(home\)|\/contact|\/about/i,            // URL paths in PRD
    ];

    for (const pattern of strongPageIndicators) {
      if (pattern.test(prompt)) return 'page';
    }

    // PRIORITY 2: Check for explicit component-only requests
    // These are for building individual reusable components, NOT pages
    const explicitComponentPatterns = [
      /^(?:create|build|make)\s+(?:a\s+)?(?:single\s+)?component/i,  // "create a component"
      /^(?:create|build|make)\s+(?:a\s+)?(?:single\s+)?widget/i,     // "create a widget"
      /reusable\s+(?:ui\s+)?component/i,                              // "reusable component"
      /standalone\s+component/i,                                       // "standalone component"
      /component\s+library/i,                                          // "component library"
    ];

    for (const pattern of explicitComponentPatterns) {
      if (pattern.test(prompt)) return 'component';
    }

    // PRIORITY 3: Check for page-specific patterns (broader)
    const pagePatterns = [
      /website|site|landing/i,
      /home|about|contact|services|portfolio/i,
      /blog\s*post|article|product\s*page|profile/i,
      /full\s*page|complete\s*page/i,
      /seo|meta\s*title|meta\s*description/i,
    ];

    for (const pattern of pagePatterns) {
      if (pattern.test(prompt)) return 'page';
    }

    // Default to page for most content types
    // This is safer - websites are more common than standalone components
    return 'page';
  }
  
  private extractFeatures(prompt: string): string[] {
    const features = [];
    
    // Feature detection patterns
    const featurePatterns = {
      authentication: /auth|login|sign|user|account|register|password/i,
      payments: /payment|billing|subscription|checkout|stripe|paypal|invoice/i,
      notifications: /email|notification|alert|remind|notify|message/i,
      analytics: /analytics|dashboard|metrics|report|chart|graph|statistics/i,
      api: /api|integration|webhook|rest|graphql|endpoint/i,
      search: /search|find|filter|query|lookup/i,
      messaging: /chat|message|comment|discussion|conversation|forum/i,
      media: /image|video|upload|gallery|media|photo|file/i,
      forms: /form|survey|quiz|questionnaire|feedback|input/i,
      calendar: /calendar|schedule|event|appointment|booking|date/i,
      maps: /map|location|address|geo|gps|direction/i,
      social: /share|like|follow|comment|social|feed/i,
      blog: /blog|article|post|content|writing|journal|news/i,
      ecommerce: /store|shop|ecommerce|e-commerce|product|cart|checkout|catalog/i
    };
    
    for (const [feature, pattern] of Object.entries(featurePatterns)) {
      if (pattern.test(prompt)) {
        features.push(feature);
      }
    }
    
    return features;
  }
  
  private extractTechnicalNeeds(prompt: string): string[] {
    const needs = [];
    
    const techPatterns = {
      'real-time': /real-time|realtime|live|instant|websocket/i,
      'database': /database|storage|data|crud|persist/i,
      'security': /secure|security|encrypt|protect|safe/i,
      'responsive': /responsive|mobile|tablet|device|screen/i,
      'performance': /fast|performance|optimize|speed|efficient/i,
      'scalable': /scale|scalable|growth|expand|large/i,
      'multilingual': /language|multilingual|i18n|translation|locale/i,
      'offline': /offline|pwa|cache|sync/i,
      'seo': /seo|search engine|optimize|ranking|meta/i,
      'accessibility': /accessible|a11y|wcag|disability|screen reader/i
    };
    
    for (const [need, pattern] of Object.entries(techPatterns)) {
      if (pattern.test(prompt)) {
        needs.push(need);
      }
    }
    
    return needs;
  }
  
  private identifyAudience(prompt: string): string {
    const audiencePatterns = {
      'small businesses': /small business|smb|startup|entrepreneur/i,
      'enterprises': /enterprise|corporate|large company|organization/i,
      'developers': /developer|programmer|engineer|coder|technical/i,
      'students': /student|education|school|university|learn/i,
      'professionals': /professional|business|consultant|agency|freelance/i,
      'consumers': /consumer|customer|user|public|everyone/i,
      'creators': /creator|artist|designer|writer|content/i,
      'teams': /team|collaboration|group|department|company/i
    };
    
    for (const [audience, pattern] of Object.entries(audiencePatterns)) {
      if (pattern.test(prompt)) return audience;
    }
    
    return 'general users';
  }
  
  private generateDefaultName(prompt: string): string {
    const promptText = prompt ?? '';
    const skipSegments = new Set(['www', 'com', 'net', 'org', 'io', 'co', 'dev', 'app', 'edu', 'gov', 'us', 'uk', 'au']);
    const importUrl = this.extractImportUrl(promptText);

    if (importUrl) {
      try {
        const host = new URL(importUrl).hostname.replace(/\.+$/, '');
        const segments = host.split('.').filter(segment => segment.length > 0);
        const candidateSegments = segments.filter(segment => !skipSegments.has(segment.toLowerCase()));

        if (candidateSegments.length > 0) {
          const nameFromHost = candidateSegments
            .slice(0, Math.min(candidateSegments.length, 2))
            .map(segment => this.formatAsTitle(segment.replace(/[-_]+/g, ' ')))
            .join(' ');

          if (nameFromHost.trim().length > 0) {
            return nameFromHost.trim();
          }
        }

        const fallbackHostName = this.formatAsTitle(host.replace(/[-_]+/g, ' '));
        if (fallbackHostName.length > 0) {
          return fallbackHostName;
        }
      } catch {
        // Ignore URL parsing errors and continue to prompt-based fallback
      }
    }

    const words = promptText
      .split(/\s+/)
      .map(word => word.replace(/^[^a-z0-9]+|[^a-z0-9]+$/gi, ''))
      .filter(word => word.length > 3 && !/^(with|that|for|and|the|this|please|make|build)$/i.test(word))
      .slice(0, 3);

    if (words.length > 0) {
      const domainWord = words.find(word => word.includes('.'));
      if (domainWord) {
        const normalizedDomain = domainWord.replace(/^[^a-z0-9]+|[^a-z0-9]+$/gi, '');
        const domainSegments = normalizedDomain.split('.').filter(segment => segment.length > 0);
        const domainCandidates = domainSegments.filter(segment => !skipSegments.has(segment.toLowerCase()));

        if (domainCandidates.length > 0) {
          return domainCandidates
            .slice(0, Math.min(domainCandidates.length, 2))
            .map(segment => this.formatAsTitle(segment.replace(/[-_]+/g, ' ')))
            .join(' ');
        }
      }

      return words
        .map(word => this.formatAsTitle(word.replace(/[-_]+/g, ' ')))
        .join(' ');
    }

    return 'Untitled Website';
  }

  private formatAsTitle(text: string): string {
    return text
      .split(/\s+/)
      .filter(part => part.length > 0)
      .map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
      .join(' ');
  }

  private suggestTechStack(prompt: ProcessedPrompt): string[] {
    const stack = ['React', 'TypeScript', 'Tailwind CSS', 'Next.js'];
    
    if (prompt.suggestedFeatures.includes('authentication')) {
      stack.push('NextAuth.js');
    }
    if (prompt.suggestedFeatures.includes('payments')) {
      stack.push('Stripe');
    }
    if (prompt.suggestedFeatures.includes('messaging')) {
      stack.push('Socket.io');
    }
    if (prompt.suggestedFeatures.includes('database')) {
      stack.push('Prisma', 'PostgreSQL');
    }
    if (prompt.suggestedFeatures.includes('ecommerce')) {
      stack.push('Commerce.js');
    }
    if (prompt.technicalRequirements.includes('real-time')) {
      stack.push('WebSockets');
    }
    
    return [...new Set(stack)]; // Remove duplicates
  }
  
  private suggestTheme(category: 'page' | 'component'): { primary: string; secondary: string; style: string; darkMode: boolean } {
    // Theme should be consistent for the entire website, not based on content type
    return { 
      primary: '#3B82F6', // blue
      secondary: '#1E40AF',
      style: 'professional',
      darkMode: true
    };
  }
  
  private generateTagline(prompt: ProcessedPrompt): string {
    // Generate tagline based on features and audience, not content type category
    if (prompt.suggestedFeatures.includes('ecommerce')) {
      return 'Build your online store';
    }
    if (prompt.suggestedFeatures.includes('blog')) {
      return 'Share your stories with the world';
    }
    if (prompt.targetAudience.includes('business')) {
      return 'Grow your business online';
    }
    
    return 'Build something amazing';
  }
  
  private extractTopics(prompt: string): string[] {
    // Extract key topics from the prompt
    const stopWords = new Set(['a', 'an', 'the', 'with', 'for', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'of']);
    const words = prompt.toLowerCase()
      .split(/\s+/)
      .filter(word => word.length > 3 && !stopWords.has(word));
    
    // Get unique meaningful words as topics
    return [...new Set(words)].slice(0, 10);
  }
  
  private detectTone(category: 'page' | 'component'): string {
    // Tone should be based on website purpose, not content type
    // For now, return a professional tone suitable for most websites
    return 'professional';
  }

  private getCategoryIcon(category: 'page' | 'component'): string {
    const icons: Record<'page' | 'component', string> = {
      page: '📄',
      component: '🧩'
    };
    
    return icons[category];
  }
}
