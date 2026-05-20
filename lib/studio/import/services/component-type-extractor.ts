import { PrismaClient, Prisma } from '@/lib/generated/prisma'
import { 
  IComponentTypeExtractor, 
  DetectionResult, 
  ComponentPattern, 
  ComponentType 
} from './interfaces/component-type-extractor.interface'
import { calculatePatternSimilarity, normalizeStructure } from '../utils/pattern-analysis'
import {
  canonicalizeImportType,
  getCanonicalContractMetadata,
  resolveCategoryForCanonicalType,
  safeClone
} from './canonical-type-utils'
import { applyAllowedProviders, createLLMClient, validateLLMApiKey } from './llm-client'
import { ModelConfig, TokenConfig, ConfidenceConfig, OpenRouterConfig } from '../config'

// Use centralized model configuration
const DEFAULT_MODEL = ModelConfig.typeExtraction
const TEMPERATURE = ModelConfig.temperature.typeExtraction
const MAX_TOKENS = TokenConfig.typeExtraction

interface ComponentTypeExtractionOptions {
  model?: string
  apiKey?: string
  baseUrl?: string
  confidenceThreshold?: number
  enableAIEnhancement?: boolean
}

export class ComponentTypeExtractor implements IComponentTypeExtractor {
  private confidenceThreshold: number = ConfidenceConfig.patternClustering
  private prisma: PrismaClient

  constructor(prismaClient: PrismaClient) {
    this.prisma = prismaClient
  }

  /**
   * Extract patterns from detection results to identify component types
   */
  async extractPatterns(detectionResults: DetectionResult[]): Promise<ComponentPattern[]> {
    const patterns: Map<string, ComponentPattern> = new Map()

    // Flatten the detection tree so we register patterns for child components too
    const allDetections: DetectionResult[] = []
    const traverse = (node: DetectionResult | undefined) => {
      if (!node) return
      allDetections.push(node)
      if (node.children && node.children.length) {
        for (const child of node.children) traverse(child)
      }
    }
    for (const root of detectionResults) traverse(root)

    for (const result of allDetections) {
      const structure = this.analyzeStructure(result)
      const patternKey = this.generatePatternKey(structure)
      
      if (patterns.has(patternKey)) {
        const pattern = patterns.get(patternKey)!
        pattern.instances.push(result)
        pattern.frequency += 1
        // Update confidence based on consistency
        pattern.confidence = Math.min(1, pattern.confidence + 0.1)
      } else {
        const newPattern: ComponentPattern = {
          type: this.inferType(result),
          category: this.inferCategory(result),
          structure,
          instances: [result],
          frequency: 1,
          confidence: result.confidence || 0.5,
          defaultConfig: {},
          placeholderData: {}
        }
        patterns.set(patternKey, newPattern)
      }
    }

    return Array.from(patterns.values())
  }

  /**
   * Extract component types from detection results.
   * Convenience method that wraps extractPatterns for use in the import orchestrator.
   */
  async extractComponentTypes(params: {
    detectionResults: DetectionResult[]
    websiteId: string
  }): Promise<ComponentPattern[]> {
    const { detectionResults, websiteId } = params
    if (!websiteId) {
      console.warn('[ComponentTypeExtractor] extractComponentTypes called without websiteId')
    }
    return this.extractPatterns(detectionResults)
  }

  /**
   * Reduce patterns to unique component types (target: <15 types from 50+ instances)
   */
  async reduceToTypes(patterns: ComponentPattern[], websiteId: string): Promise<ComponentType[]> {
    if (!websiteId) {
      throw new Error('Website ID is required to generate component types');
    }

    if (!patterns || patterns.length === 0) {
      return []
    }

    const canonicalGroups = new Map<string, ComponentPattern[]>()

    for (const pattern of patterns) {
      const canonicalType = canonicalizeImportType(pattern.type)
      if (!canonicalType || canonicalType === 'page') {
        continue
      }

      const normalizedInstances = Array.isArray(pattern.instances)
        ? pattern.instances.map(instance => ({
            ...instance,
            type: canonicalizeImportType(instance.type) ?? instance.type
          }))
        : []

      const normalizedPattern: ComponentPattern = {
        ...pattern,
        type: canonicalType,
        instances: normalizedInstances
      }

      const existing = canonicalGroups.get(canonicalType)
      if (existing) {
        existing.push(normalizedPattern)
      } else {
        canonicalGroups.set(canonicalType, [normalizedPattern])
      }
    }

    const componentTypes: ComponentType[] = []

    for (const [canonicalType, groupedPatterns] of canonicalGroups.entries()) {
      const clusters = this.clusterSimilarPatterns(groupedPatterns)
      const representativeCluster = clusters[0] ?? groupedPatterns
      const representativePattern = this.selectRepresentativePattern(representativeCluster)
      const contractMetadata = getCanonicalContractMetadata(canonicalType)

      const confidence = groupedPatterns.reduce(
        (max, pattern) => Math.max(max, typeof pattern.confidence === 'number' ? pattern.confidence : 0),
        0
      )
      const instanceCount = groupedPatterns.reduce(
        (count, pattern) => count + (Array.isArray(pattern.instances) ? pattern.instances.length : 0),
        0
      )

      const category =
        contractMetadata?.category ??
        (typeof representativePattern.category === 'string'
          ? representativePattern.category
          : resolveCategoryForCanonicalType(canonicalType))

      const defaultConfig = contractMetadata?.sampleContent
        ? {
            props: safeClone(contractMetadata.sampleContent),
            responsive: {
              mobile: {},
              tablet: {},
              desktop: {}
            }
          }
        : this.generateDefaultConfig(representativePattern)

      const placeholderData = contractMetadata?.sampleContent
        ? safeClone(contractMetadata.sampleContent)
        : this.generatePlaceholderData(representativePattern)

      const baseAiMetadata: Record<string, unknown> = contractMetadata?.aiMetadata
        ? {
            ...safeClone(contractMetadata.aiMetadata),
            source: 'canonical-registry'
          }
        : (() => {
            const generated = this.generateAIMetadata(representativePattern)
            if (generated && typeof generated === 'object') {
              return { ...(generated as Record<string, unknown>) }
            }
            return {}
          })()

      baseAiMetadata.canonicalType = canonicalType
      baseAiMetadata.patternCount = instanceCount

      const componentType: ComponentType = {
        websiteId,
        type: canonicalType,
        category,
        version: '1.0.0',
        placeholderData: placeholderData as Prisma.JsonValue,
        defaultConfig: defaultConfig as Prisma.JsonValue,
        styles: this.generateStyles(representativePattern),
        aiMetadata: baseAiMetadata as Prisma.JsonValue,
        confidence: confidence > 0 ? confidence : representativePattern.confidence ?? 0.8,
        isGlobal: false,
        createdBy: null,
        updatedBy: null,
        patterns: groupedPatterns
      }
      componentTypes.push(componentType)
    }

    return componentTypes
  }

  /**
   * Generate default configuration for a component pattern
   */
  generateDefaultConfig(pattern: ComponentPattern): Record<string, unknown> {
    const config: Record<string, unknown> = {}
    
    // Extract common properties from instances
    const commonProps = this.extractCommonProperties(pattern.instances)
    
    // Add responsive configuration
    config.responsive = {
      mobile: { display: 'block' },
      tablet: { display: 'block' },
      desktop: { display: 'block' }
    }

    // Add structural properties
    if (pattern.structure.hasText) {
      config.text = commonProps.text || 'Sample text content'
    }
    
    if (pattern.structure.hasImage) {
      config.image = commonProps.image || '/placeholder-image.jpg'
    }
    
    if (pattern.structure.hasButton) {
      config.buttons = commonProps.buttons || [{ text: 'Click here', href: '#' }]
    }

    if (pattern.structure.hasInput) {
      config.inputs = commonProps.inputs || [{ type: 'text', placeholder: 'Enter text' }]
    }

    return config
  }

  /**
   * Generate placeholder data for component previews
   */
  generatePlaceholderData(pattern: ComponentPattern): Record<string, unknown> {
    const placeholderData: Record<string, unknown> = {}

    if (pattern.structure.hasText) {
      placeholderData.title = 'Lorem Ipsum Header'
      placeholderData.description = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.'
    }

    if (pattern.structure.hasImage) {
      // Placeholder URL - will be converted to mediaReference during reference resolution
      placeholderData.image = 'https://via.placeholder.com/800x400'
    }

    if (pattern.structure.hasButton) {
      placeholderData.links = [
        { text: 'Get Started', href: '#' },
        { text: 'Learn More', href: '#' }
      ]
    }

    return placeholderData
  }

  /**
   * Calculate similarity between two patterns for deduplication
   */
  calculatePatternSimilarity(pattern1: ComponentPattern, pattern2: ComponentPattern): number {
    return calculatePatternSimilarity(pattern1, pattern2)
  }

  /**
   * Normalize pattern data for consistent comparison
   */
  normalizePattern(pattern: ComponentPattern): ComponentPattern {
    return {
      ...pattern,
      structure: normalizeStructure(pattern.structure)
    }
  }

  /**
   * Set confidence thresholds for pattern matching
   */
  setConfidenceThreshold(threshold: number): void {
    this.confidenceThreshold = Math.max(0, Math.min(1, threshold))
  }

  /**
   * Get current confidence threshold
   */
  getConfidenceThreshold(): number {
    return this.confidenceThreshold
  }

  /**
   * Enhance component type extraction with AI (optional)
   * Follows the same pattern as web-detection.ts
   *
   * @returns Object containing enhanced component types and optional token usage data
   * Token usage is tracked when AI enhancement is enabled and can be aggregated
   * by the caller (e.g., ImportService) for usage reporting and limits.
   */
  async enhanceWithAI(
    componentTypes: ComponentType[],
    options: ComponentTypeExtractionOptions = {}
  ): Promise<{
    componentTypes: ComponentType[]
    tokenUsage?: {
      promptTokens: number
      completionTokens: number
      totalTokens: number
      modelUsed: string
    }
  }> {
    const {
      model = DEFAULT_MODEL,
      apiKey = process.env.OPENROUTER_API_KEY,
      baseUrl = OpenRouterConfig.baseUrl,
      enableAIEnhancement = false
    } = options

    if (!enableAIEnhancement) {
      return { componentTypes }
    }

    let resolvedApiKey: string
    try {
      resolvedApiKey = validateLLMApiKey(apiKey, {
        missing: 'AI enhancement requires an API key. Set OPENROUTER_API_KEY or provide apiKey in options.',
        invalid: 'Invalid API key for AI enhancement, skipping'
      })
    } catch (error) {
      console.warn(error instanceof Error ? error.message : String(error))
      return { componentTypes }
    }

    try {
      // Initialize OpenAI client (same pattern as web-detection.ts)
      const client = createLLMClient({
        apiKey: resolvedApiKey,
        baseURL: baseUrl,
        title: 'Component Type Extraction Service'
      })

      const prompt = `Analyze these component types and suggest improvements:

${componentTypes.map(ct => `
Type: ${ct.type}
Category: ${ct.category}
Pattern Count: ${ct.patterns.length}
`).join('\n')}

Suggest better naming and categorization. Respond with JSON:
{
  "suggestions": [
    {"originalType": "type", "suggestedType": "better-type", "suggestedCategory": "category"}
  ]
}
`

      const payload = {
        model,
        messages: [
          {
            role: 'system' as const,
            content: 'You are a web component naming expert. Provide JSON responses only.'
          },
          {
            role: 'user' as const,
            content: prompt
          }
        ],
        temperature: TEMPERATURE,
        max_tokens: MAX_TOKENS
      }
      applyAllowedProviders(payload as Record<string, unknown>)
      const response = await client.chat.completions.create(payload)

      // Capture token usage from response
      const tokenUsage = response.usage ? {
        promptTokens: response.usage.prompt_tokens || 0,
        completionTokens: response.usage.completion_tokens || 0,
        totalTokens: response.usage.total_tokens || 0,
        modelUsed: model
      } : undefined

      const aiResponse = response.choices[0]?.message?.content
      if (aiResponse) {
        const suggestions = JSON.parse(aiResponse)

        // Apply suggestions
        const enhancedTypes = componentTypes.map(ct => {
          const suggestion = suggestions.suggestions?.find((s: { originalType: string; suggestedType: string; suggestedCategory: string }) => s.originalType === ct.type)
          if (suggestion) {
            const aiMeta = (ct.aiMetadata && typeof ct.aiMetadata === 'object') ? (ct.aiMetadata as Record<string, unknown>) : {}
            return {
              ...ct,
              type: suggestion.suggestedType || ct.type,
              category: suggestion.suggestedCategory || ct.category,
              aiMetadata: {
                ...aiMeta,
                aiEnhanced: true,
                modelVersion: model,
                enhancementTimestamp: new Date().toISOString()
              } as Prisma.JsonValue
            }
          }
          return ct
        })

        return { componentTypes: enhancedTypes, tokenUsage }
      }

      return { componentTypes, tokenUsage }
    } catch (error) {
      console.warn('AI enhancement failed, using original types:', error)
    }

    return { componentTypes }
  }

  // Private helper methods

  private analyzeStructure(result: DetectionResult): ComponentPattern['structure'] {
    const hasText = typeof result.content === 'string' && result.content.trim().length > 0
    const hasImage = Boolean(result.metadata?.hasImage || 
      (result.styles && Object.keys(result.styles).some(key => key.includes('background-image'))))
    const hasButton = Boolean(result.metadata?.hasButton || result.type === 'button')
    const hasInput = Boolean(result.metadata?.hasInput || result.type === 'input')
    const childCount = result.children?.length || 0
    const depth = this.calculateDepth(result)

    return {
      hasText,
      hasImage,
      hasButton,
      hasInput,
      childCount,
      depth
    }
  }

  private calculateDepth(result: DetectionResult, currentDepth: number = 0): number {
    if (!result.children || result.children.length === 0) {
      return currentDepth
    }
    
    let maxDepth = currentDepth
    for (const child of result.children) {
      const childDepth = this.calculateDepth(child, currentDepth + 1)
      maxDepth = Math.max(maxDepth, childDepth)
    }
    
    return maxDepth
  }

  private generatePatternKey(structure: ComponentPattern['structure']): string {
    return `${structure.hasText}-${structure.hasImage}-${structure.hasButton}-${structure.hasInput}-${structure.childCount}-${structure.depth}`
  }

  private inferType(result: DetectionResult): string {
    if (result.type) return result.type

    // Infer from structure
    if (result.metadata?.hasButton && result.metadata?.hasText) return 'hero'
    if (result.metadata?.hasImage && result.metadata?.hasText) return 'card'
    if (result.metadata?.hasInput) return 'form'
    if (result.children && result.children.length > 3) return 'section'
    
    return 'generic'
  }

  private inferCategory(result: DetectionResult): string {
    const type = this.inferType(result)
    
    switch (type) {
      case 'hero':
      case 'banner':
        return 'hero'
      case 'nav':
      case 'navigation':
        return 'navigation'
      case 'card':
      case 'article':
        return 'content'
      case 'form':
      case 'input':
        return 'form'
      case 'footer':
        return 'footer'
      default:
        return 'layout'
    }
  }

  private clusterSimilarPatterns(patterns: ComponentPattern[]): ComponentPattern[][] {
    const clusters: ComponentPattern[][] = []
    const processed = new Set<number>()

    for (let i = 0; i < patterns.length; i++) {
      if (processed.has(i)) continue

      const cluster: ComponentPattern[] = [patterns[i]]
      processed.add(i)

      for (let j = i + 1; j < patterns.length; j++) {
        if (processed.has(j)) continue

        const similarity = this.calculatePatternSimilarity(patterns[i], patterns[j])
        if (similarity >= this.confidenceThreshold) {
          cluster.push(patterns[j])
          processed.add(j)
        }
      }

      clusters.push(cluster)
    }

    return clusters
  }

  private selectRepresentativePattern(cluster: ComponentPattern[]): ComponentPattern {
    // Select pattern with highest frequency and confidence
    return cluster.reduce((best, current) => 
      (current.frequency * current.confidence) > (best.frequency * best.confidence) 
        ? current 
        : best
    )
  }

  private generateStyles(pattern: ComponentPattern): Prisma.JsonValue {
    
    // Extract common styles from instances
    const commonStyles = this.extractCommonStyles(pattern.instances)
    
    return {
      ...commonStyles,
      responsive: {
        mobile: {},
        tablet: {},
        desktop: {}
      }
    }
  }

  private generateAIMetadata(pattern: ComponentPattern): Prisma.JsonValue {
    return {
      confidence: pattern.confidence,
      modelVersion: 'openai/gpt-4o-mini',
      detectionTimestamp: new Date().toISOString(),
      patternCount: pattern.instances.length,
      frequency: pattern.frequency
    }
  }

  private extractCommonProperties(instances: DetectionResult[]): Record<string, unknown> {
    const commonProps: Record<string, unknown> = {}
    
    // Find properties that appear in most instances
    const propertyCount: Record<string, number> = {}
    const propertyValues: Record<string, unknown[]> = {}

    instances.forEach(instance => {
      if (instance.content) {
        propertyCount.text = (propertyCount.text || 0) + 1
        propertyValues.text = propertyValues.text || []
        propertyValues.text.push(instance.content)
      }

      if (instance.metadata) {
        Object.keys(instance.metadata).forEach(key => {
          propertyCount[key] = (propertyCount[key] || 0) + 1
          propertyValues[key] = propertyValues[key] || []
          propertyValues[key].push(instance.metadata![key])
        })
      }
    })

    // Include properties that appear in >50% of instances
    const threshold = Math.ceil(instances.length * 0.5)
    Object.keys(propertyCount).forEach(key => {
      if (propertyCount[key] >= threshold) {
        // Use most common value
        const values = propertyValues[key]
        const mostCommon = values.reduce((a, b, i, arr) =>
          arr.filter(v => v === a).length >= arr.filter(v => v === b).length ? a : b
        )
        commonProps[key] = mostCommon
      }
    })

    return commonProps
  }

  private extractCommonStyles(instances: DetectionResult[]): Record<string, unknown> {
    const commonStyles: Record<string, unknown> = {}
    const styleCount: Record<string, number> = {}
    const styleValues: Record<string, unknown[]> = {}

    instances.forEach(instance => {
      if (instance.styles) {
        Object.keys(instance.styles).forEach(key => {
          styleCount[key] = (styleCount[key] || 0) + 1
          styleValues[key] = styleValues[key] || []
          styleValues[key].push(instance.styles![key])
        })
      }
    })

    // Include styles that appear in >50% of instances
    const threshold = Math.ceil(instances.length * 0.5)
    Object.keys(styleCount).forEach(key => {
      if (styleCount[key] >= threshold) {
        const values = styleValues[key]
        const mostCommon = values.reduce((a, b, i, arr) =>
          arr.filter(v => v === a).length >= arr.filter(v => v === b).length ? a : b
        )
        commonStyles[key] = mostCommon
      }
    })

    return commonStyles
  }
}

