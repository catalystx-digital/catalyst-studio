import { ComponentType, ComponentCategory } from '@/lib/studio/components/cms/_core/types'
import { ContentTypeCategory, WebsiteComponentType, Prisma } from '@/lib/generated/prisma'
// Types moved to avoid circular dependency
import type { ImportDetectionResult } from './web-detection'
import type { ImportPipelineResult } from './import-pipeline'
import type {
  NavigationHierarchy,
  Template,
  DesignTokens,
  ComponentUsagePattern
} from './types'
import type { CapturedDesignSystem } from './types/design-system.types'
import type { DetectedComponent } from './detection/types'
import { performanceMonitor } from '@/lib/studio/components/cms/_import/performance'
import type { ProgressCallback } from './types/progress.types'

// Re-export DetectedComponent for backwards compatibility
export type { DetectedComponent }
import { prisma } from '@/lib/prisma'

export interface CMSTemplate {
  id: string
  name: string
  key: string
  category: ContentTypeCategory
  fields: TemplateField[]
  metadata: TemplateMetadata
}

export interface TemplateField {
  name: string
  type: string
  required: boolean
  placeholder?: any
  defaultValue?: any
  validation?: any
  description?: string
  properties?: Record<string, any>
}

export interface TemplateMetadata {
  source?: string
  sourcePages?: string[]
  confidence?: number
  patterns?: string[]
  createdFrom?: string
  version?: number
  designTokens?: Partial<DesignTokens>
  designSystem?: CapturedDesignSystem
  designSystemReferences?: {
    palette?: string[]
    typography?: string[]
    spacing?: string[]
    radii?: string[]
  }
  duplicatedFrom?: string
  duplicatedAt?: string
  lastModified?: string
  tags?: string[]
  [key: string]: any  // Allow additional properties
}

interface PlaceholderContent {
  type: 'text' | 'image' | 'link' | 'number' | 'boolean' | 'object' | 'array'
  value: any
  metadata?: Record<string, any>
}

export interface TemplateGeneratorOptions {
  generatePlaceholders?: boolean
  preserveHierarchy?: boolean
  minConfidence?: number
  templatePrefix?: string
}

export class TemplateGenerator {
  private options: TemplateGeneratorOptions
  private templateCache: Map<string, CMSTemplate>
  private patternCache: Map<string, any>

  constructor(options: TemplateGeneratorOptions = {}) {
    this.options = {
      generatePlaceholders: true,
      preserveHierarchy: true,
      minConfidence: 0.6,
      templatePrefix: 'imported',
      ...options
    }
    this.templateCache = new Map()
    this.patternCache = new Map()
  }

  /**
   * Generate CMS templates from import pipeline results
   */
  generateFromPatterns(pipelineResult: ImportPipelineResult): CMSTemplate[] {
    return performanceMonitor.measureSync('templateGenerator.generateFromPatterns', () => {
      if (!pipelineResult.success || !pipelineResult.data) {
        throw new Error('Pipeline result is not successful or missing data')
      }

      const startTime = Date.now()
      const templates: CMSTemplate[] = []
      const { detectedComponents, navigation, templates: pageTemplates, designTokens, designSystem } = pipelineResult.data
      
      // Create page templates from detected templates (with batch processing)
      const cmsPageTemplates = this.batchCreatePageTemplates(
        pageTemplates,
        detectedComponents,
        designTokens,
        designSystem
      )
      templates.push(...cmsPageTemplates)

      // Create component templates from detected components (with caching)
      const componentTemplates = this.createComponentTemplates(
        detectedComponents,
        designTokens,
        designSystem
      )
      templates.push(...componentTemplates)
      
      // Create folder structure based on navigation
      const folderTemplate = this.createFolderTemplate(navigation)
      if (folderTemplate) {
        templates.push(folderTemplate)
      }
      
      const totalTime = Date.now() - startTime
      
      // Check performance requirement (< 30 seconds)
      if (totalTime > 30000) {
        console.warn(`Template generation exceeded 30 second target: ${totalTime}ms`)
      } else {
        console.log(`Template generation completed in ${totalTime}ms`)
      }
      
      return templates
    }, { templateCount: pipelineResult.data?.detectedComponents.length || 0 })
  }

  /**
   * Batch create page templates for performance
   */
  private batchCreatePageTemplates(
    pageTemplates: Template[],
    detectionResults: ImportDetectionResult[],
    designTokens: DesignTokens,
    designSystem?: CapturedDesignSystem
  ): CMSTemplate[] {
    return performanceMonitor.measureSync('templateGenerator.batchCreatePageTemplates', () => {
      const templates: CMSTemplate[] = []
      const batchSize = 5 // Process 5 templates at a time
      
      for (let i = 0; i < pageTemplates.length; i += batchSize) {
        const batch = pageTemplates.slice(i, i + batchSize)
        
        for (const pageTemplate of batch) {
          // Check cache first
          const cacheKey = `page_${pageTemplate.id}`
          const cached = this.templateCache.get(cacheKey)
          
          if (cached) {
            templates.push(cached)
            continue
          }
          
          // Get detection results for pages using this template
          const templateDetectionResults = detectionResults.filter(
            result => pageTemplate.pages.includes(result.pageUrl)
          )
          
          const cmsTemplate = this.createPageTemplate(
            pageTemplate.name,
            templateDetectionResults,
            designTokens,
            designSystem
          )
          
          if (cmsTemplate) {
            this.templateCache.set(cacheKey, cmsTemplate)
            templates.push(cmsTemplate)
          }
        }
      }
      
      return templates
    }, { batchCount: pageTemplates.length })
  }

  /**
   * Create a page template from detected components
   */
  createPageTemplate(
    templateName: string,
    detectionResults: ImportDetectionResult[],
    designTokens?: DesignTokens,
    designSystem?: CapturedDesignSystem
  ): CMSTemplate | null {
    // Gather all components from all detection results
    const allComponents: DetectedComponent[] = []
    const pageUrls: string[] = []
    
    for (const result of detectionResults) {
      if (result.components && result.components.length > 0) {
        // Filter by confidence threshold
        const highConfidenceComponents = result.components.filter(
          c => c.confidence >= (this.options.minConfidence || 0.6)
        )
        allComponents.push(...highConfidenceComponents)
        pageUrls.push(result.pageUrl)
      }
    }
    
    if (allComponents.length === 0) {
      return null
    }
    
    const template: CMSTemplate = {
      id: this.generateTemplateId('page', templateName),
      name: this.formatTemplateName(templateName, 'page'),
      key: this.generateTemplateKey('page', templateName),
      category: 'page' as ContentTypeCategory,
      fields: this.generatePageFields(allComponents, designTokens),
      metadata: {
        sourcePages: pageUrls,
        confidence: this.calculateAverageConfidence(allComponents),
        patterns: Array.from(new Set(allComponents.map(c => c.type))),
        createdFrom: 'import',
        version: 1,
        designTokens,
        designSystem,
        designSystemReferences: designSystem ? this.extractDesignSystemReferences(designSystem) : undefined
      }
    }
    
    return template
  }

  /**
   * Create a component template from detected components
   */
  createComponentComposition(
    componentType: ComponentType,
    detectionResults: ImportDetectionResult[],
    designTokens?: DesignTokens,
    designSystem?: CapturedDesignSystem
  ): CMSTemplate | null {
    // Gather all components of this type
    const relevantComponents: DetectedComponent[] = []
    
    for (const result of detectionResults) {
      const components = result.components.filter(
        c => c.type === componentType && c.confidence >= (this.options.minConfidence || 0.6)
      )
      relevantComponents.push(...components)
    }
    
    if (relevantComponents.length === 0) {
      return null
    }
    
    // Extract content patterns from all instances
    const contentPatterns = this.extractContentPatternsFromComponents(relevantComponents)
    
    const template: CMSTemplate = {
      id: this.generateTemplateId('component', componentType),
      name: this.formatTemplateName(componentType, 'component'),
      key: this.generateTemplateKey('component', componentType),
      category: 'component' as ContentTypeCategory,
      fields: this.generateComponentFieldsFromContent(componentType, contentPatterns, designTokens),
      metadata: {
        confidence: this.calculateAverageConfidence(relevantComponents),
        patterns: [componentType],
        createdFrom: 'import',
        version: 1,
        designTokens,
        designSystem,
        designSystemReferences: designSystem ? this.extractDesignSystemReferences(designSystem) : undefined
      }
    }
    
    return template
  }

  /**
   * Generate placeholder content for a field
   */
  generatePlaceholders(field: TemplateField, designTokens?: DesignTokens): PlaceholderContent {
    const fieldName = field.name.toLowerCase()
    
    switch (field.type) {
      case 'string':
      case 'text':
        return {
          type: 'text',
          value: this.generateTextPlaceholder(fieldName, designTokens),
          metadata: { fieldName: field.name }
        }
      
      case 'image':
      case 'media':
        return {
          type: 'image',
          value: this.generateImagePlaceholder(fieldName, designTokens?.images),
          metadata: { fieldName: field.name }
        }
      
      case 'link':
      case 'url':
        return {
          type: 'link',
          value: this.generateLinkPlaceholder(fieldName),
          metadata: { fieldName: field.name }
        }
      
      case 'object':
        return {
          type: 'object',
          value: this.generateObjectPlaceholder(field, designTokens),
          metadata: { fieldName: field.name }
        }
      
      case 'array':
        return {
          type: 'array',
          value: this.generateArrayPlaceholder(field, designTokens),
          metadata: { fieldName: field.name }
        }
      
      case 'number':
        return {
          type: 'number',
          value: Math.floor(Math.random() * 100),
          metadata: { fieldName: field.name }
        }
      
      case 'boolean':
        return {
          type: 'boolean',
          value: false,
          metadata: { fieldName: field.name }
        }
      
      default:
        return {
          type: 'text',
          value: `Placeholder for ${field.name}`,
          metadata: { fieldName: field.name }
        }
    }
  }

  private createPageTemplatesFromDetection(
    pageTemplates: Template[],
    detectionResults: ImportDetectionResult[],
    designTokens: DesignTokens
  ): CMSTemplate[] {
    const templates: CMSTemplate[] = []
    
    for (const pageTemplate of pageTemplates) {
      // Get detection results for pages using this template
      const templateDetectionResults = detectionResults.filter(
        result => pageTemplate.pages.includes(result.pageUrl)
      )
      
      const cmsTemplate = this.createPageTemplate(
        pageTemplate.name,
        templateDetectionResults,
        designTokens
      )
      
      if (cmsTemplate) {
        templates.push(cmsTemplate)
      }
    }
    
    return templates
  }

  private createComponentTemplates(
    detectionResults: ImportDetectionResult[],
    designTokens: DesignTokens,
    designSystem?: CapturedDesignSystem
  ): CMSTemplate[] {
    // Collect all unique component types first (for metrics)
    const componentTypes = new Set<ComponentType>()
    for (const result of detectionResults) {
      for (const component of result.components) {
        componentTypes.add(component.type)
      }
    }
    
    return performanceMonitor.measureSync('templateGenerator.createComponentTemplates', () => {
      const templates: CMSTemplate[] = []
      
      // Create template for each component type (with caching)
      for (const componentType of componentTypes) {
        const cacheKey = `component_${componentType}`
        const cached = this.templateCache.get(cacheKey)
        
        if (cached) {
          templates.push(cached)
          continue
        }
        
        const componentTemplate = this.createComponentComposition(
          componentType,
          detectionResults,
          designTokens,
          designSystem
        )
        
        if (componentTemplate) {
          this.templateCache.set(cacheKey, componentTemplate)
          templates.push(componentTemplate)
        }
      }
      
      return templates
    }, { componentTypeCount: componentTypes.size })
  }

  private createFolderTemplate(navigation: NavigationHierarchy): CMSTemplate | null {
    if (!navigation || navigation.pages.length === 0) {
      return null
    }
    
    return {
      id: this.generateTemplateId('folder', 'site-structure'),
      name: 'Site Structure',
      key: this.generateTemplateKey('folder', 'site-structure'),
      category: 'folder' as ContentTypeCategory,
      fields: [
        {
          name: 'name',
          type: 'string',
          required: true,
          placeholder: 'Folder Name',
          description: 'Name of the folder or section'
        },
        {
          name: 'description',
          type: 'text',
          required: false,
          placeholder: 'Folder description',
          description: 'Description of this folder\'s content'
        },
        {
          name: 'children',
          type: 'array',
          required: false,
          description: 'Child pages and folders',
          properties: {
            type: 'reference',
            to: ['page', 'component', 'folder']
          }
        }
      ],
      metadata: {
        createdFrom: 'import',
        version: 1,
        patterns: ['navigation-structure']
      }
    }
  }

  private extractContentPatternsFromComponents(
    components: DetectedComponent[]
  ): Record<string, any> {
    // Check pattern cache first
    const cacheKey = `patterns_${components.map(c => c.type).join('_')}`
    const cached = this.patternCache.get(cacheKey)
    if (cached) {
      return cached
    }
    
    const patterns: Record<string, any> = {}
    
    // Analyze content from all component instances
    for (const component of components) {
      if (component.content) {
        for (const [key, value] of Object.entries(component.content)) {
          if (!patterns[key]) {
            patterns[key] = []
          }
          patterns[key].push(value)
        }
      }
    }
    
    // Determine most common patterns
    const contentPattern: Record<string, any> = {}
    for (const [key, values] of Object.entries(patterns)) {
      if (Array.isArray(values) && values.length > 0) {
        // For arrays, use the first non-empty value as template
        contentPattern[key] = values.find(v => v !== null && v !== undefined) || values[0]
      }
    }
    
    // Cache the result
    this.patternCache.set(cacheKey, contentPattern)
    
    return contentPattern
  }

  private generatePageFields(
    components: DetectedComponent[],
    designTokens?: DesignTokens
  ): TemplateField[] {
    const fields: TemplateField[] = []
    
    // Add standard page fields
    fields.push({
      name: 'title',
      type: 'string',
      required: true,
      placeholder: 'Page Title',
      description: 'The main title of the page'
    })
    
    fields.push({
      name: 'slug',
      type: 'string',
      required: true,
      placeholder: 'page-slug',
      description: 'URL-friendly version of the page title'
    })
    
    fields.push({
      name: 'seoMeta',
      type: 'object',
      required: false,
      description: 'SEO metadata for the page',
      properties: {
        description: { type: 'text', placeholder: 'SEO description' },
        keywords: { type: 'array', itemType: 'string' },
        ogImage: { type: 'image' }
      }
    })
    
    // Group components by location
    const componentsByLocation = this.groupComponentsByLocation(components)
    
    for (const [location, locationComponents] of Object.entries(componentsByLocation)) {
      if (locationComponents.length > 0) {
        const fieldName = `${location}Components`
        fields.push({
          name: fieldName,
          type: 'array',
          required: false,
          description: `Components in the ${location} section`,
          properties: this.generatePropertiesFromComponents(locationComponents, designTokens)
        })
      }
    }
    
    // Add placeholders if enabled
    if (this.options.generatePlaceholders) {
      for (const field of fields) {
        const placeholder = this.generatePlaceholders(field, designTokens)
        field.defaultValue = placeholder.value
      }
    }
    
    return fields
  }

  private generateComponentFieldsFromContent(
    componentType: ComponentType,
    contentPattern: Record<string, any>,
    designTokens?: DesignTokens
  ): TemplateField[] {
    const fields: TemplateField[] = []
    
    // Generate fields based on actual content patterns found
    for (const [key, value] of Object.entries(contentPattern)) {
      const field = this.createFieldFromContent(key, value)
      
      // Add placeholder if enabled
      if (this.options.generatePlaceholders) {
        const placeholder = this.generatePlaceholders(field, designTokens)
        field.placeholder = placeholder.value
        field.defaultValue = placeholder.value
      }
      
      fields.push(field)
    }
    
    // Add any standard fields for this component type that weren't in content
    const standardFields = this.getStandardFieldsForComponent(componentType)
    for (const standardField of standardFields) {
      if (!fields.find(f => f.name === standardField.name)) {
        if (this.options.generatePlaceholders) {
          const placeholder = this.generatePlaceholders(standardField, designTokens)
          standardField.placeholder = placeholder.value
          standardField.defaultValue = placeholder.value
        }
        fields.push(standardField)
      }
    }
    
    return fields
  }

  private createFieldFromContent(key: string, value: any): TemplateField {
    const field: TemplateField = {
      name: key,
      type: 'string',
      required: false,
      description: `Field for ${key}`
    }
    
    // Determine field type based on value and key patterns
    if (Array.isArray(value)) {
      field.type = 'array'
      if (value.length > 0 && typeof value[0] === 'object') {
        field.properties = this.extractPropertiesFromObject(value[0])
      } else if (value.length > 0) {
        field.properties = { itemType: typeof value[0] }
      }
    } else if (typeof value === 'object' && value !== null) {
      field.type = 'object'
      field.properties = this.extractPropertiesFromObject(value)
    } else if (typeof value === 'boolean') {
      field.type = 'boolean'
    } else if (typeof value === 'number') {
      field.type = 'number'
    } else if (typeof value === 'string') {
      // For string values, check key patterns to determine specific types
      const lowerKey = key.toLowerCase()
      
      if (lowerKey.includes('image') || lowerKey.includes('img') || lowerKey.includes('photo')) {
        field.type = 'image'
      } else if (lowerKey.includes('url') || lowerKey.includes('link') || lowerKey.includes('href')) {
        field.type = 'link'
      } else if (lowerKey.includes('description') || lowerKey.includes('body') || 
                 lowerKey.includes('content') || lowerKey.includes('subtitle')) {
        field.type = 'text'
      } else if (value.startsWith('http://') || value.startsWith('https://') || value.startsWith('//')) {
        field.type = 'link'
      } else if (value.length > 100) {
        // Long text strings are likely text fields
        field.type = 'text'
      }
      // else remains 'string' for short text
    }
    
    return field
  }

  private extractPropertiesFromObject(obj: any): Record<string, any> {
    const properties: Record<string, any> = {}
    
    for (const [key, value] of Object.entries(obj)) {
      if (Array.isArray(value)) {
        properties[key] = { type: 'array' }
        if (value.length > 0) {
          properties[key].itemType = typeof value[0]
        }
      } else if (typeof value === 'object' && value !== null) {
        properties[key] = { type: 'object' }
      } else {
        properties[key] = { type: typeof value }
      }
    }
    
    return properties
  }

  private getStandardFieldsForComponent(componentType: ComponentType): TemplateField[] {
    // Map of minimum required fields for each component type
    const standardFields: Partial<Record<ComponentType, TemplateField[]>> = {
      [ComponentType.HeroBanner]: [
        { name: 'title', type: 'string', required: true, description: 'Hero title' },
        { name: 'subtitle', type: 'text', required: false, description: 'Hero subtitle' }
      ],
      [ComponentType.NavBar]: [
        { name: 'logo', type: 'image', required: false, description: 'Site logo' },
        { name: 'navigation', type: 'array', required: false, description: 'Navigation items' }
      ],
      [ComponentType.CTABanner]: [
        { name: 'heading', type: 'string', required: true, description: 'CTA heading' },
        { name: 'buttonText', type: 'string', required: true, description: 'Button text' },
        { name: 'buttonUrl', type: 'link', required: true, description: 'Button URL' }
      ],
      [ComponentType.Testimonials]: [
        { name: 'quote', type: 'text', required: true, description: 'Testimonial quote' },
        { name: 'author', type: 'string', required: true, description: 'Author name' }
      ],
      [ComponentType.Accordion]: [
        { name: 'questions', type: 'array', required: true, description: 'FAQ items' }
      ],
      [ComponentType.PricingTable]: [
        { name: 'plans', type: 'array', required: true, description: 'Pricing plans' }
      ],
      [ComponentType.Footer]: [
        { name: 'copyright', type: 'string', required: false, description: 'Copyright text' }
      ],
      [ComponentType.FeatureGrid]: [
        { name: 'items', type: 'array', required: true, description: 'Feature items' }
      ],
      [ComponentType.TeamGrid]: [
        { name: 'members', type: 'array', required: true, description: 'Team members' }
      ],
      [ComponentType.ImageGallery]: [
        { name: 'images', type: 'array', required: true, description: 'Gallery images' }
      ],
      [ComponentType.ContactForm]: [
        { name: 'fields', type: 'array', required: true, description: 'Form fields' }
      ],
      [ComponentType.BlogList]: [
        { name: 'posts', type: 'array', required: true, description: 'Blog posts' }
      ],
      [ComponentType.Statistics]: [
        { name: 'items', type: 'array', required: true, description: 'Statistics items' }
      ]
    }
    
    return standardFields[componentType] || []
  }

  private groupComponentsByLocation(
    components: DetectedComponent[]
  ): Record<string, DetectedComponent[]> {
    const grouped: Record<string, DetectedComponent[]> = {
      header: [],
      hero: [],
      main: [],
      footer: []
    }
    
    for (const component of components) {
      const location = component.location || 'main'
      if (grouped[location]) {
        grouped[location].push(component)
      } else {
        grouped.main.push(component)
      }
    }
    
    return grouped
  }

  private generatePropertiesFromComponents(
    components: DetectedComponent[],
    designTokens?: DesignTokens
  ): Record<string, any> {
    const properties: Record<string, any> = {}
    
    // Collect all unique content keys from components
    const contentKeys = new Set<string>()
    for (const component of components) {
      if (component.content) {
        Object.keys(component.content).forEach(key => contentKeys.add(key))
      }
    }
    
    // Create properties for each content key
    for (const key of contentKeys) {
      // Find the first non-null value to determine type
      let sampleValue = null
      for (const component of components) {
        if (component.content && component.content[key] !== null && component.content[key] !== undefined) {
          sampleValue = component.content[key]
          break
        }
      }
      
      if (sampleValue !== null) {
        properties[key] = this.inferPropertyType(key, sampleValue)
      }
    }
    
    // Add component type as a property
    properties.componentType = { 
      type: 'string', 
      enum: Array.from(new Set(components.map(c => c.type)))
    }
    
    return properties
  }

  private inferPropertyType(key: string, value: any): any {
    if (Array.isArray(value)) {
      return { type: 'array', itemType: value.length > 0 ? typeof value[0] : 'string' }
    } else if (typeof value === 'object' && value !== null) {
      return { type: 'object' }
    } else if (key.includes('image') || key.includes('img')) {
      return { type: 'image' }
    } else if (key.includes('url') || key.includes('link')) {
      return { type: 'link' }
    } else if (typeof value === 'boolean') {
      return { type: 'boolean' }
    } else if (typeof value === 'number') {
      return { type: 'number' }
    } else {
      return { type: 'string' }
    }
  }

  private generateTextPlaceholder(fieldName: string, designTokens?: DesignTokens): string {
    // Check if we have text patterns from design tokens
    if (designTokens && designTokens.textPatterns && designTokens.textPatterns.length > 0) {
      // Use existing text patterns as placeholders
      const relevantPattern = designTokens.textPatterns.find(p => 
        fieldName.includes(p.toLowerCase())
      )
      if (relevantPattern) {
        return `Sample ${relevantPattern} text`
      }
    }
    
    const placeholders: Record<string, string> = {
      'title': 'Lorem Ipsum Dolor Sit Amet',
      'heading': 'Section Heading',
      'subtitle': 'Consectetur Adipiscing Elit',
      'description': 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.',
      'body': 'Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.',
      'excerpt': 'Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.',
      'caption': 'Image caption goes here',
      'label': 'Label Text',
      'question': 'What is your question?',
      'answer': 'This is the answer to the question.',
      'quote': 'This is an inspiring testimonial quote from a satisfied customer.',
      'author': 'John Doe',
      'role': 'Software Engineer',
      'company': 'Acme Corp',
      'copyright': '© 2024 Your Company. All rights reserved.',
      'button': 'Click Here',
      'default': 'Sample text content'
    }
    
    for (const [key, value] of Object.entries(placeholders)) {
      if (fieldName.includes(key)) {
        return value
      }
    }
    
    return placeholders.default
  }

  private generateImagePlaceholder(fieldName: string, images?: string[]): string | Record<string, unknown> {
    // Use an actual image from design tokens if available
    // These will be converted to mediaReferences during reference resolution
    if (images && images.length > 0) {
      // Return the first image as placeholder (will be resolved to mediaReference)
      return images[0]
    }

    const dimensions: Record<string, { width: number, height: number }> = {
      'logo': { width: 200, height: 60 },
      'icon': { width: 64, height: 64 },
      'avatar': { width: 150, height: 150 },
      'profile': { width: 300, height: 300 },
      'hero': { width: 1920, height: 1080 },
      'background': { width: 1920, height: 1080 },
      'thumbnail': { width: 400, height: 300 },
      'gallery': { width: 800, height: 600 },
      'default': { width: 1200, height: 800 }
    }

    let size = dimensions.default
    for (const [key, dim] of Object.entries(dimensions)) {
      if (fieldName.includes(key)) {
        size = dim
        break
      }
    }

    // Return placeholder URL - will be converted to mediaReference during reference resolution
    return `https://via.placeholder.com/${size.width}x${size.height}?text=${encodeURIComponent(fieldName)}`
  }

  private generateLinkPlaceholder(fieldName: string): string {
    if (fieldName.includes('social')) {
      return 'https://example.com/social'
    }
    if (fieldName.includes('cta') || fieldName.includes('button')) {
      return '/contact'
    }
    if (fieldName.includes('home')) {
      return '/'
    }
    if (fieldName.includes('about')) {
      return '/about'
    }
    return `#${fieldName.toLowerCase().replace(/[^a-z0-9]/g, '-')}`
  }

  private generateObjectPlaceholder(field: TemplateField, designTokens?: DesignTokens): Record<string, any> {
    const obj: Record<string, any> = {}
    
    if (field.properties) {
      for (const [propName, propConfig] of Object.entries(field.properties)) {
        if (typeof propConfig === 'object' && propConfig.type) {
          const propField: TemplateField = {
            name: propName,
            type: propConfig.type,
            required: false
          }
          const placeholder = this.generatePlaceholders(propField, designTokens)
          obj[propName] = placeholder.value
        }
      }
    }
    
    return obj
  }

  private generateArrayPlaceholder(field: TemplateField, designTokens?: DesignTokens): any[] {
    const items: any[] = []
    const itemCount = 3 // Generate 3 sample items
    
    for (let i = 0; i < itemCount; i++) {
      if (field.properties) {
        const item: Record<string, any> = {}
        for (const [propName, propConfig] of Object.entries(field.properties)) {
          if (typeof propConfig === 'object' && propConfig.type) {
            const propField: TemplateField = {
              name: propName,
              type: propConfig.type,
              required: false
            }
            const placeholder = this.generatePlaceholders(propField, designTokens)
            item[propName] = placeholder.value
          }
        }
        items.push(item)
      } else {
        items.push(`Item ${i + 1}`)
      }
    }
    
    return items
  }

  private formatTemplateName(name: string, type: string): string {
    const formatted = name
      .replace(/_/g, ' ')
      .replace(/-/g, ' ')
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')
    return `${formatted} ${type.charAt(0).toUpperCase() + type.slice(1)} Template`
  }

  private generateTemplateId(type: string, name: string): string {
    return `${this.options.templatePrefix}_${type}_${name}_${Date.now()}`
  }

  private generateTemplateKey(type: string, name: string): string {
    return `${this.options.templatePrefix}_${type}_${name}`.toLowerCase().replace(/[^a-z0-9_]/g, '_')
  }

  private calculateAverageConfidence(components: DetectedComponent[]): number {
    if (components.length === 0) return 0
    const sum = components.reduce((acc, c) => acc + (c.confidence || 0), 0)
    return sum / components.length
  }

  /**
   * Clear all caches
   */
  clearCache(): void {
    this.templateCache.clear()
    this.patternCache.clear()
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { templateCacheSize: number; patternCacheSize: number } {
    return {
      templateCacheSize: this.templateCache.size,
      patternCacheSize: this.patternCache.size
    }
  }

  /**
   * Preload cache with common patterns
   */
  preloadCache(commonPatterns?: Record<string, any>): void {
    if (commonPatterns) {
      for (const [key, pattern] of Object.entries(commonPatterns)) {
        this.patternCache.set(key, pattern)
      }
    }
  }

  /**
   * Convert CMSTemplate to WebsiteComponentType format for database storage
   */
  convertToWebsiteComponentType(template: CMSTemplate, websiteId: string): Omit<WebsiteComponentType, 'id' | 'createdAt' | 'updatedAt' | 'createdBy' | 'updatedBy'> {
    const timestamp = new Date().toISOString()
    
    // Map template category to component category
    const categoryMapping: Record<ContentTypeCategory, string> = {
      page: 'pages',
      component: 'content',
      folder: 'navigation'
    }
    
    return {
      type: template.name.toLowerCase().replace(/\s+/g, '-'),
      category: categoryMapping[template.category] || 'content',
      version: String(template.metadata.version || '1.0.0'),
      websiteId,
      isGlobal: false,
      confidence: template.metadata.confidence || 0.7,
      
      // Convert fields to defaultConfig structure (renamed from props)
      defaultConfig: {
        fields: template.fields,
        key: template.key,
        originalId: template.id
      } as unknown as Prisma.JsonValue,
      
      // Generate placeholderData with sample content (renamed from content)
      placeholderData: this.generateContentFromFields(template.fields, template.metadata.designTokens),
      
      // Optional styles
      styles: template.metadata.designTokens ? {
        tokens: template.metadata.designTokens,
        theme: 'imported'
      } as unknown as Prisma.JsonValue : null,
      
      // AI metadata for imported templates
      aiMetadata: {
        ...template.metadata,
        importedAt: timestamp,
        source: template.metadata.source || 'import',
        sourceUrl: template.metadata.sourcePages?.[0] || null,
        patterns: template.metadata.patterns || [],
        templateId: template.id,
        templateKey: template.key
      } as unknown as Prisma.JsonValue
    }
  }

  /**
   * Generate content structure from template fields
   */
  private generateContentFromFields(fields: TemplateField[], designTokens?: Partial<DesignTokens>): any {
    const content: Record<string, any> = {}
    
    for (const field of fields) {
      if (this.options.generatePlaceholders) {
        const placeholder = this.generatePlaceholders(field, designTokens as DesignTokens)
        content[field.name] = placeholder.value
      } else {
        content[field.name] = field.defaultValue || null
      }
    }
    
    return content
  }

  /**
   * Save generated templates to CMS database
   */
  async saveToCMS(
    templates: CMSTemplate[],
    websiteId: string,
    onProgress?: ProgressCallback
  ): Promise<{ savedIds: string[], errors: Array<{ template: string, error: string }> }> {
    return performanceMonitor.measure('templateGenerator.saveToCMS', async () => {
      const savedIds: string[] = []
      const errors: Array<{ template: string, error: string }> = []

      // Report template save start
      onProgress?.({
        subsystemStart: {
          id: 'template_save',
          label: 'Saving templates',
          total: templates.length,
        },
        message: `Saving ${templates.length} templates to CMS`,
      })

      let savedCount = 0
      for (const template of templates) {
        try {
          // Report progress for each template
          onProgress?.({
            subsystemProgress: { id: 'template_save', current: savedCount, total: templates.length },
            message: `Saving template: ${template.name}`,
          })

          // Convert template to WebsiteComponentType format
          const componentData = this.convertToWebsiteComponentType(template, websiteId)

          // Check for existing component with same key
          const existing = await prisma.websiteComponentType.findFirst({
            where: {
              websiteId,
              type: componentData.type,
              category: componentData.category
            }
          })
          
          if (existing) {
            // Update existing component
            const updated = await prisma.websiteComponentType.update({
              where: { id: existing.id },
              data: {
                ...componentData,
                version: this.incrementVersion(existing.version),
                aiMetadata: {
                  ...(existing.aiMetadata as any),
                  ...(componentData.aiMetadata as any),
                  updatedAt: new Date().toISOString()
                } as Prisma.InputJsonValue
              } as any
            })
            savedIds.push(updated.id)
          } else {
            // Create new component
            const created = await prisma.websiteComponentType.create({
              data: componentData as any
            })
            savedIds.push(created.id)
          }
        } catch (error) {
          console.error(`Failed to save template ${template.name}:`, error)
          errors.push({
            template: template.name,
            error: error instanceof Error ? error.message : 'Unknown error'
          })
        }
        savedCount++
      }

      // Report template save complete
      onProgress?.({
        subsystemComplete: 'template_save',
        message: `Saved ${savedIds.length} templates (${errors.length} errors)`,
      })

      return { savedIds, errors }
    }, { templateCount: templates.length })
  }

  /**
   * Increment version string (e.g., "1.0.0" -> "1.0.1")
   */
  private incrementVersion(version: string): string {
    const parts = version.split('.')
    const patch = parseInt(parts[2] || '0', 10) + 1
    return `${parts[0] || '1'}.${parts[1] || '0'}.${patch}`
  }

  /**
   * Extract design system references from a captured design system
   */
  private extractDesignSystemReferences(designSystem: CapturedDesignSystem): {
    palette?: string[]
    typography?: string[]
    spacing?: string[]
    radii?: string[]
  } {
    const { designSystem: ds } = designSystem

    const references: {
      palette?: string[]
      typography?: string[]
      spacing?: string[]
      radii?: string[]
    } = {}

    // Extract palette references
    if (ds.palette) {
      references.palette = [
        ...ds.palette.primary.map(c => `palette.primary.${c.name || c.value}`),
        ...ds.palette.secondary.map(c => `palette.secondary.${c.name || c.value}`),
        ...ds.palette.accent.map(c => `palette.accent.${c.name || c.value}`),
        ...ds.palette.neutral.map(c => `palette.neutral.${c.name || c.value}`),
        ...ds.palette.surface.map(c => `palette.surface.${c.name || c.value}`)
      ]
    }

    // Extract typography references
    if (ds.typography) {
      references.typography = [
        ...ds.typography.heading.map(t => `typography.heading.${t.name || t.fontFamily}`),
        ...ds.typography.body.map(t => `typography.body.${t.name || t.fontFamily}`),
        ...ds.typography.ui.map(t => `typography.ui.${t.name || t.fontFamily}`)
      ]
    }

    // Extract spacing references
    if (ds.spacing && ds.spacing.values) {
      references.spacing = ds.spacing.values.map(v => `spacing.${v.name || v.step}`)
    }

    // Extract radii references
    if (ds.radii && ds.radii.values) {
      references.radii = ds.radii.values.map(v => `radii.${v.name || v.step}`)
    }

    return references
  }
}

export default TemplateGenerator
