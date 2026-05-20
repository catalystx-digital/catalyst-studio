import { prisma } from '@/lib/prisma'
import { WebsiteComponentType, Prisma } from '@/lib/generated/prisma'
import { performanceMonitor } from '@/lib/studio/components/cms/_import/performance'
import { CMSTemplate } from '../template-generator'
import { ComponentType } from '@/lib/studio/components/cms/_core/types'
import { ContentTypeCategory } from '@/lib/generated/prisma'

interface SaveTemplatesResult {
  success: boolean
  savedTemplateIds: string[]
  failedTemplates?: Array<{ id: string; error: string }>
  totalSaved: number
  totalFailed: number
}

interface TemplateStorageOptions {
  batchSize?: number
  validateBeforeSave?: boolean
  overwriteExisting?: boolean
  autoApproveThreshold?: number
}

/**
 * @deprecated This service is deprecated as of Story 17.6. Use ImportOrchestrator instead.
 * Will be removed in a future version.
 */
export class TemplateStorageService {
  private options: Required<TemplateStorageOptions>

  constructor(options: TemplateStorageOptions = {}) {
    console.warn('TemplateStorageService is deprecated. Use ImportOrchestrator from lib/studio/import/services/import-orchestrator.ts instead.')
    
    this.options = {
      batchSize: 10,
      validateBeforeSave: true,
      overwriteExisting: false,
      autoApproveThreshold: 0.7,
      ...options
    }
  }

  /**
   * Save imported templates to CMS database
   */
  async saveImportedTemplates(
    templates: CMSTemplate[],
    websiteId: string,
    importJobId?: string
  ): Promise<SaveTemplatesResult> {
    return performanceMonitor.measure('templateStorage.saveImportedTemplates', async () => {
      const savedTemplateIds: string[] = []
      const failedTemplates: Array<{ id: string; error: string }> = []
      
      // Filter templates by confidence if auto-approve threshold is set
      const templatesToSave = templates.filter(t => 
        !this.options.autoApproveThreshold || 
        (t.metadata.confidence && t.metadata.confidence >= this.options.autoApproveThreshold)
      )
      
      // Process templates in batches
      for (let i = 0; i < templatesToSave.length; i += this.options.batchSize) {
        const batch = templatesToSave.slice(i, i + this.options.batchSize)
        
        try {
          const batchResults = await this.saveBatch(batch, websiteId, importJobId)
          savedTemplateIds.push(...batchResults.savedIds)
          failedTemplates.push(...batchResults.failures)
        } catch (error) {
          console.error(`Batch save failed for templates ${i}-${i + batch.length}:`, error)
          // Add all templates in failed batch to failures
          batch.forEach(template => {
            failedTemplates.push({
              id: template.id,
              error: error instanceof Error ? error.message : 'Batch save failed'
            })
          })
        }
      }
      
      return {
        success: failedTemplates.length === 0,
        savedTemplateIds,
        failedTemplates: failedTemplates.length > 0 ? failedTemplates : undefined,
        totalSaved: savedTemplateIds.length,
        totalFailed: failedTemplates.length
      }
    }, { templateCount: templates.length })
  }

  /**
   * Save a batch of templates
   */
  private async saveBatch(
    templates: CMSTemplate[],
    websiteId: string,
    importJobId?: string
  ): Promise<{ savedIds: string[]; failures: Array<{ id: string; error: string }> }> {
    const savedIds: string[] = []
    const failures: Array<{ id: string; error: string }> = []
    
    // Use transaction for batch operations
    await prisma.$transaction(async (tx) => {
      for (const template of templates) {
        try {
          // Validate template if enabled
          if (this.options.validateBeforeSave && !this.validateTemplate(template)) {
            failures.push({
              id: template.id,
              error: 'Template validation failed'
            })
            continue
          }
          
          // Convert template to WebsiteComponentType format
          const componentData = this.mapTemplateToWebsiteComponentType(template, websiteId, importJobId)
          
          // Check for existing component
          const existing = await tx.websiteComponentType.findFirst({
            where: {
              websiteId,
              type: componentData.type,
              category: componentData.category
            }
          })
          
          let savedComponent: WebsiteComponentType
          
          if (existing && this.options.overwriteExisting) {
            // Update existing component
            savedComponent = await tx.websiteComponentType.update({
              where: { id: existing.id },
              data: {
                ...componentData,
                version: this.incrementVersion(existing.version),
                aiMetadata: {
                  ...(existing.aiMetadata as any),
                  ...(componentData.aiMetadata as any),
                  updatedAt: new Date().toISOString()
                }
              }
            })
          } else if (!existing) {
            // Create new component
            savedComponent = await tx.websiteComponentType.create({
              data: componentData
            })
          } else {
            // Skip if exists and not overwriting
            failures.push({
              id: template.id,
              error: 'Component already exists'
            })
            continue
          }
          
          savedIds.push(savedComponent.id)
        } catch (error) {
          console.error(`Failed to save template ${template.id}:`, error)
          failures.push({
            id: template.id,
            error: error instanceof Error ? error.message : 'Unknown error'
          })
        }
      }
    })
    
    return { savedIds, failures }
  }

  /**
   * Map CMSTemplate to WebsiteComponentType structure
   */
  private mapTemplateToWebsiteComponentType(
    template: CMSTemplate,
    websiteId: string,
    importJobId?: string
  ): Prisma.WebsiteComponentTypeCreateInput {
    const timestamp = new Date().toISOString()
    
    // Map template category to component category
    const categoryMapping: Record<ContentTypeCategory, string> = {
      page: 'pages',
      component: 'content',
      folder: 'navigation'
    }
    
    return {
      type: this.sanitizeType(template.name),
      category: categoryMapping[template.category] || 'content',
      version: String(template.metadata.version || '1.0.0'),
      website: {
        connect: { id: websiteId }
      },
      isGlobal: false,
      confidence: template.metadata.confidence || 0.7,
      
      // Convert fields to defaultConfig structure (renamed from props)
      defaultConfig: {
        fields: template.fields,
        key: template.key,
        originalId: template.id,
        category: template.category
      } as unknown as Prisma.InputJsonValue,
      
      // Generate placeholderData for previews (renamed from content)
      placeholderData: this.generateDefaultContent(template.fields) as Prisma.InputJsonValue,
      
      // Optional styles with design tokens
      styles: template.metadata.designTokens ? ({
        tokens: template.metadata.designTokens,
        theme: 'imported'
      } as unknown as Prisma.InputJsonValue) : undefined,
      
      // AI metadata for imported templates
      aiMetadata: {
        ...template.metadata,
        importedAt: timestamp,
        importJobId,
        source: template.metadata.source || 'import',
        sourceUrl: template.metadata.sourcePages?.[0] || null,
        patterns: template.metadata.patterns || [],
        templateId: template.id,
        templateKey: template.key,
        autoApproved: template.metadata.confidence ? 
          template.metadata.confidence >= this.options.autoApproveThreshold : false
      } as unknown as Prisma.InputJsonValue
    }
  }

  /**
   * Handle conversion from CMSTemplate to WebsiteComponentType format
   */
  async convertAndSaveTemplates(
    templates: CMSTemplate[],
    websiteId: string
  ): Promise<string[]> {
    const savedIds: string[] = []
    
    for (const template of templates) {
      try {
        const component = await this.convertTemplate(template, websiteId)
        if (component) {
          savedIds.push(component.id)
        }
      } catch (error) {
        console.error(`Failed to convert template ${template.id}:`, error)
      }
    }
    
    return savedIds
  }

  /**
   * Convert a single template to CMS component
   */
  private async convertTemplate(
    template: CMSTemplate,
    websiteId: string
  ): Promise<WebsiteComponentType | null> {
    try {
      const componentData = this.mapTemplateToWebsiteComponentType(template, websiteId)
      return await prisma.websiteComponentType.create({
        data: componentData
      })
    } catch (error) {
      console.error(`Failed to convert template:`, error)
      return null
    }
  }

  /**
   * Include website association for templates
   */
  async associateTemplatesWithWebsite(
    templateIds: string[],
    websiteId: string
  ): Promise<void> {
    await prisma.websiteComponentType.updateMany({
      where: {
        id: { in: templateIds }
      },
      data: {
        websiteId
      }
    })
  }

  /**
   * Validate template structure before saving
   */
  private validateTemplate(template: CMSTemplate): boolean {
    // Check required fields
    if (!template.id || !template.name || !template.key) {
      return false
    }
    
    // Check category is valid
    const validCategories: ContentTypeCategory[] = ['page', 'component', 'folder']
    if (!validCategories.includes(template.category)) {
      return false
    }
    
    // Check fields array exists and has content
    if (!Array.isArray(template.fields) || template.fields.length === 0) {
      return false
    }
    
    // Validate each field has required properties
    for (const field of template.fields) {
      if (!field.name || !field.type) {
        return false
      }
    }
    
    // Check metadata exists
    if (!template.metadata) {
      return false
    }
    
    return true
  }

  /**
   * Handle duplicate templates gracefully
   */
  async handleDuplicates(
    templates: CMSTemplate[],
    websiteId: string
  ): Promise<{ unique: CMSTemplate[]; duplicates: CMSTemplate[] }> {
    const unique: CMSTemplate[] = []
    const duplicates: CMSTemplate[] = []
    
    for (const template of templates) {
      const exists = await this.checkTemplateExists(template, websiteId)
      if (exists) {
        duplicates.push(template)
      } else {
        unique.push(template)
      }
    }
    
    return { unique, duplicates }
  }

  /**
   * Check if template already exists
   */
  private async checkTemplateExists(
    template: CMSTemplate,
    websiteId: string
  ): Promise<boolean> {
    const existing = await prisma.websiteComponentType.findFirst({
      where: {
        websiteId,
        type: this.sanitizeType(template.name),
        category: this.mapCategory(template.category)
      }
    })
    
    return existing !== null
  }

  /**
   * Implement rollback on batch save failure
   */
  async rollbackBatchSave(savedIds: string[]): Promise<void> {
    if (savedIds.length === 0) return
    
    try {
      await prisma.websiteComponentType.deleteMany({
        where: {
          id: { in: savedIds }
        }
      })
      console.log(`Rolled back ${savedIds.length} templates`)
    } catch (error) {
      console.error('Failed to rollback template save:', error)
      throw error
    }
  }

  /**
   * Generate default content structure from fields
   */
  private generateDefaultContent(fields: any[]): any {
    const content: Record<string, any> = {}
    
    for (const field of fields) {
      content[field.name] = field.defaultValue || this.getDefaultValueForType(field.type)
    }
    
    return content
  }

  /**
   * Get default value based on field type
   */
  private getDefaultValueForType(type: string): any {
    switch (type) {
      case 'string':
      case 'text':
        return ''
      case 'number':
        return 0
      case 'boolean':
        return false
      case 'array':
        return []
      case 'object':
        return {}
      case 'image':
        return null
      case 'link':
        return '#'
      default:
        return null
    }
  }

  /**
   * Sanitize component type name
   */
  private sanitizeType(name: string): string {
    return name
      .toLowerCase()
      .replace(/\s+template$/i, '') // Remove "template" suffix
      .replace(/[^a-z0-9-]/g, '-')   // Replace non-alphanumeric with hyphens
      .replace(/-+/g, '-')            // Replace multiple hyphens with single
      .replace(/^-|-$/g, '')          // Remove leading/trailing hyphens
  }

  /**
   * Map template category to component category
   */
  private mapCategory(category: ContentTypeCategory): string {
    const mapping: Record<ContentTypeCategory, string> = {
      page: 'pages',
      component: 'content',
      folder: 'navigation'
    }
    return mapping[category] || 'content'
  }

  /**
   * Increment version string
   */
  private incrementVersion(version: string): string {
    const parts = version.split('.')
    const patch = parseInt(parts[2] || '0', 10) + 1
    return `${parts[0] || '1'}.${parts[1] || '0'}.${patch}`
  }
}

export default TemplateStorageService
