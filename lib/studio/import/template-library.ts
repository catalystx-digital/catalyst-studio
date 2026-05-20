import { CMSTemplate, TemplateField } from './template-generator'
import { ContentTypeCategory, PrismaClient, Prisma } from '@/lib/generated/prisma'
import { performanceMonitor } from '@/lib/studio/components/cms/_import/performance'

interface TemplateLibraryOptions {
  cacheEnabled?: boolean
  cacheTTL?: number
  batchSize?: number
  maxTemplatesPerCategory?: number
}

export interface TemplateSearchCriteria {
  category?: ContentTypeCategory
  name?: string
  key?: string
  tags?: string[]
  minConfidence?: number
  sourcePages?: string[]
  componentTypes?: string[]
}

export interface TemplateExportData {
  version: string
  exportDate: string
  templates: CMSTemplate[]
  metadata?: Record<string, any>
}

interface TemplateImportResult {
  imported: number
  updated: number
  skipped: number
  errors: string[]
}

interface TemplateBatchResult {
  successful: string[]
  failed: Array<{ templateId: string; error: string }>
  totalTime: number
}

export class TemplateLibrary {
  private prisma: PrismaClient
  private options: TemplateLibraryOptions
  private templateCache: Map<string, CMSTemplate>
  private cacheTimestamps: Map<string, number>

  constructor(prisma: PrismaClient, options: TemplateLibraryOptions = {}) {
    this.prisma = prisma
    this.options = {
      cacheEnabled: true,
      cacheTTL: 300000, // 5 minutes
      batchSize: 10,
      maxTemplatesPerCategory: 100,
      ...options
    }
    this.templateCache = new Map()
    this.cacheTimestamps = new Map()
  }

  /**
   * Store a template in the database
   */
  async storeTemplate(template: CMSTemplate, websiteId: string): Promise<string> {
    return performanceMonitor.measure('templateLibrary.store', async () => {
      try {
        // Validate template before storing
        this.validateTemplateForStorage(template)
        
        // Generate unique key if not provided
        if (!template.key) {
          template.key = this.generateUniqueKey(template)
        }
        
        // Create ContentType record with metadata stored in fields
        const fieldsWithMetadata = {
          __fields: template.fields,
          __metadata: template.metadata || {}
        } as unknown as Prisma.JsonValue
        
        const contentType = await this.prisma.contentType.create({
          data: {
            id: template.id,
            key: template.key,
            name: template.name,
            pluralName: this.generatePluralName(template.name),
            category: template.category,
            fields: fieldsWithMetadata as Prisma.InputJsonValue,
            websiteId,
            displayField: this.determineDisplayField(template.fields)
          }
        })
        
        // Clear cache for this template
        this.invalidateCache(template.id)
        
        return contentType.id
      } catch (error) {
        throw new Error(`Failed to store template: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }
    })
  }

  /**
   * Store multiple templates in batch
   */
  async storeTemplatesBatch(
    templates: CMSTemplate[],
    websiteId: string
  ): Promise<TemplateBatchResult> {
    return performanceMonitor.measure('templateLibrary.storeBatch', async () => {
      const startTime = Date.now()
      const successful: string[] = []
      const failed: Array<{ templateId: string; error: string }> = []
      
      // Process in batches
      for (let i = 0; i < templates.length; i += this.options.batchSize!) {
        const batch = templates.slice(i, i + this.options.batchSize!)
        
        await Promise.all(
          batch.map(async (template) => {
            try {
              const id = await this.storeTemplate(template, websiteId)
              successful.push(id)
            } catch (error) {
              failed.push({
                templateId: template.id,
                error: error instanceof Error ? error.message : 'Unknown error'
              })
            }
          })
        )
      }
      
      return {
        successful,
        failed,
        totalTime: Date.now() - startTime
      }
    })
  }

  /**
   * Retrieve a template by ID
   */
  async getTemplate(templateId: string): Promise<CMSTemplate | null> {
    // Check cache first
    if (this.options.cacheEnabled) {
      const cached = this.getFromCache(templateId)
      if (cached) {
        return cached
      }
    }
    
    const contentType = await this.prisma.contentType.findUnique({
      where: { id: templateId }
    })
    
    if (!contentType) {
      return null
    }
    
    // Extract metadata and fields from stored data
    const fields = contentType.fields as any
    let metadata = {
      createdFrom: 'database',
      version: 1
    }
    
    // Check if metadata is stored in fields
    if (fields && typeof fields === 'object') {
      if (fields.__metadata) {
        metadata = { ...metadata, ...fields.__metadata }
      }
      // Also check if metadata is directly in fields for backwards compatibility
      if (fields.metadata) {
        metadata = { ...metadata, ...fields.metadata }
      }
    }
    
    // Filter out __metadata from actual fields
    const actualFields = Array.isArray(fields) ? fields : 
      (fields.__fields || fields.fields || [])
    
    const template: CMSTemplate = {
      id: contentType.id,
      key: contentType.key,
      name: contentType.name,
      category: contentType.category as ContentTypeCategory,
      fields: actualFields as TemplateField[],
      metadata
    }
    
    // Cache the template
    if (this.options.cacheEnabled) {
      this.addToCache(templateId, template)
    }
    
    return template
  }

  /**
   * Search templates based on criteria
   */
  async searchTemplates(criteria: TemplateSearchCriteria): Promise<CMSTemplate[]> {
    return performanceMonitor.measure('templateLibrary.search', async () => {
      const where: any = {}
      
      if (criteria.category) {
        where.category = criteria.category
      }
      
      if (criteria.name) {
        where.name = {
          contains: criteria.name,
          mode: 'insensitive'
        }
      }
      
      if (criteria.key) {
        where.key = {
          contains: criteria.key,
          mode: 'insensitive'
        }
      }
      
      const contentTypes = await this.prisma.contentType.findMany({
        where,
        take: this.options.maxTemplatesPerCategory
      })
      
      const templates = contentTypes.map(ct => {
        // Extract metadata from fields if it exists as a special __metadata field
        const fields = ct.fields as any
        let metadata = {
          createdFrom: 'database',
          version: 1
        }
        
        // Check if metadata is stored in fields
        if (fields && typeof fields === 'object') {
          if (fields.__metadata) {
            metadata = { ...metadata, ...fields.__metadata }
          }
          // Also check if metadata is directly in fields for backwards compatibility
          if (fields.metadata) {
            metadata = { ...metadata, ...fields.metadata }
          }
        }
        
        // Filter out __metadata from actual fields
        const actualFields = Array.isArray(fields) ? fields : 
          (fields.__fields || fields.fields || [])
        
        return {
          id: ct.id,
          key: ct.key,
          name: ct.name,
          category: ct.category as ContentTypeCategory,
          fields: actualFields as TemplateField[],
          metadata
        }
      })
      
      // Apply additional filters that can't be done in database query
      return this.applyAdditionalFilters(templates, criteria)
    })
  }

  /**
   * Get templates by category
   */
  async getTemplatesByCategory(category: ContentTypeCategory): Promise<CMSTemplate[]> {
    return this.searchTemplates({ category })
  }

  /**
   * Duplicate a template
   */
  async duplicateTemplate(
    templateId: string,
    newName: string,
    websiteId: string
  ): Promise<CMSTemplate> {
    const original = await this.getTemplate(templateId)
    
    if (!original) {
      throw new Error(`Template ${templateId} not found`)
    }
    
    const duplicated: CMSTemplate = {
      ...original,
      id: this.generateTemplateId(),
      name: newName,
      key: this.generateUniqueKey({ ...original, name: newName }),
      metadata: {
        ...original.metadata,
        duplicatedFrom: templateId,
        duplicatedAt: new Date().toISOString()
      }
    }
    
    await this.storeTemplate(duplicated, websiteId)
    
    return duplicated
  }

  /**
   * Modify a template
   */
  async modifyTemplate(
    templateId: string,
    updates: Partial<CMSTemplate>
  ): Promise<CMSTemplate> {
    const existing = await this.getTemplate(templateId)
    
    if (!existing) {
      throw new Error(`Template ${templateId} not found`)
    }
    
    const updated: CMSTemplate = {
      ...existing,
      ...updates,
      id: existing.id, // Preserve ID
      metadata: {
        ...existing.metadata,
        ...updates.metadata,
        lastModified: new Date().toISOString(),
        version: (existing.metadata?.version || 1) + 1
      }
    }
    
    // Update in database with metadata stored in fields
    const fieldsWithMetadata = {
      __fields: updated.fields,
      __metadata: updated.metadata || {}
    } as unknown as Prisma.JsonValue
    
    await this.prisma.contentType.update({
      where: { id: templateId },
      data: {
        name: updated.name,
        key: updated.key,
        category: updated.category,
        fields: fieldsWithMetadata as Prisma.InputJsonValue
      }
    })
    
    // Invalidate cache
    this.invalidateCache(templateId)
    
    return updated
  }

  /**
   * Delete a template
   */
  async deleteTemplate(templateId: string): Promise<boolean> {
    try {
      await this.prisma.contentType.delete({
        where: { id: templateId }
      })
      
      this.invalidateCache(templateId)
      
      return true
    } catch (error) {
      return false
    }
  }

  /**
   * Export templates to JSON
   */
  exportTemplates(templates: CMSTemplate[]): TemplateExportData {
    return {
      version: '1.0.0',
      exportDate: new Date().toISOString(),
      templates: templates.map(t => ({
        ...t,
        id: t.id, // Preserve ID for re-import
        metadata: {
          ...t.metadata,
          exportedAt: new Date().toISOString()
        }
      }))
    }
  }

  /**
   * Export templates to file
   */
  async exportTemplatesToFile(
    templates: CMSTemplate[],
    filePath: string
  ): Promise<void> {
    const exportData = this.exportTemplates(templates)
    const fs = await import('fs/promises')
    await fs.writeFile(filePath, JSON.stringify(exportData, null, 2))
  }

  /**
   * Import templates from JSON
   */
  async importTemplates(
    exportData: TemplateExportData,
    websiteId: string,
    overwrite: boolean = false
  ): Promise<TemplateImportResult> {
    const result: TemplateImportResult = {
      imported: 0,
      updated: 0,
      skipped: 0,
      errors: []
    }
    
    for (const template of exportData.templates) {
      try {
        const existing = await this.getTemplate(template.id)
        
        if (existing) {
          if (overwrite) {
            await this.modifyTemplate(template.id, template)
            result.updated++
          } else {
            result.skipped++
          }
        } else {
          await this.storeTemplate(template, websiteId)
          result.imported++
        }
      } catch (error) {
        result.errors.push(
          `Failed to import template ${template.id}: ${
            error instanceof Error ? error.message : 'Unknown error'
          }`
        )
      }
    }
    
    return result
  }

  /**
   * Import templates from file
   */
  async importTemplatesFromFile(
    filePath: string,
    websiteId: string,
    overwrite: boolean = false
  ): Promise<TemplateImportResult> {
    const fs = await import('fs/promises')
    const content = await fs.readFile(filePath, 'utf-8')
    const exportData = JSON.parse(content) as TemplateExportData
    
    return this.importTemplates(exportData, websiteId, overwrite)
  }

  /**
   * Get template statistics
   */
  async getTemplateStatistics(websiteId: string): Promise<Record<string, any>> {
    const stats = await this.prisma.contentType.groupBy({
      by: ['category'],
      where: { websiteId },
      _count: {
        category: true
      }
    })
    
    const totalTemplates = await this.prisma.contentType.count({
      where: { websiteId }
    })
    
    return {
      total: totalTemplates,
      byCategory: stats.reduce((acc, stat) => {
        acc[stat.category] = stat._count.category
        return acc
      }, {} as Record<string, number>),
      cacheSize: this.templateCache.size
    }
  }

  /**
   * Clear template cache
   */
  clearCache(): void {
    this.templateCache.clear()
    this.cacheTimestamps.clear()
  }

  private validateTemplateForStorage(template: CMSTemplate): void {
    if (!template.id) {
      throw new Error('Template must have an ID')
    }
    
    if (!template.name) {
      throw new Error('Template must have a name')
    }
    
    if (!template.category) {
      throw new Error('Template must have a category')
    }
    
    if (!template.fields || template.fields.length === 0) {
      throw new Error('Template must have at least one field')
    }
  }

  private generateUniqueKey(template: CMSTemplate): string {
    const baseKey = template.name
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '_')
      .replace(/_+/g, '_')
    
    return `${baseKey}_${Date.now()}`
  }

  private generateTemplateId(): string {
    return `template_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  private generatePluralName(name: string): string {
    if (name.endsWith('y')) {
      return name.slice(0, -1) + 'ies'
    }
    if (name.endsWith('s')) {
      return name + 'es'
    }
    return name + 's'
  }

  private determineDisplayField(fields: TemplateField[]): string | null {
    // Prefer title, then name, then first string field
    const titleField = fields.find(f => f.name === 'title')
    if (titleField) return 'title'
    
    const nameField = fields.find(f => f.name === 'name')
    if (nameField) return 'name'
    
    const stringField = fields.find(f => f.type === 'string')
    if (stringField) return stringField.name
    
    return null
  }

  private applyAdditionalFilters(
    templates: CMSTemplate[],
    criteria: TemplateSearchCriteria
  ): CMSTemplate[] {
    let filtered = [...templates]
    
    if (criteria.minConfidence) {
      filtered = filtered.filter(
        t => (t.metadata?.confidence || 0) >= criteria.minConfidence!
      )
    }
    
    if (criteria.tags && criteria.tags.length > 0) {
      filtered = filtered.filter(t => {
        const templateTags = t.metadata?.tags as string[] || []
        return criteria.tags!.some(tag => templateTags.includes(tag))
      })
    }
    
    if (criteria.sourcePages && criteria.sourcePages.length > 0) {
      filtered = filtered.filter(t => {
        const sources = t.metadata?.sourcePages as string[] || []
        return criteria.sourcePages!.some(page => sources.includes(page))
      })
    }
    
    if (criteria.componentTypes && criteria.componentTypes.length > 0) {
      filtered = filtered.filter(t => {
        const patterns = t.metadata?.patterns as string[] || []
        return criteria.componentTypes!.some(type => patterns.includes(type))
      })
    }
    
    return filtered
  }

  private getFromCache(templateId: string): CMSTemplate | null {
    const cached = this.templateCache.get(templateId)
    const timestamp = this.cacheTimestamps.get(templateId)
    
    if (cached && timestamp) {
      const age = Date.now() - timestamp
      if (age < this.options.cacheTTL!) {
        return cached
      }
      
      // Cache expired
      this.invalidateCache(templateId)
    }
    
    return null
  }

  private addToCache(templateId: string, template: CMSTemplate): void {
    this.templateCache.set(templateId, template)
    this.cacheTimestamps.set(templateId, Date.now())
  }

  private invalidateCache(templateId: string): void {
    this.templateCache.delete(templateId)
    this.cacheTimestamps.delete(templateId)
  }
}

export default TemplateLibrary
