import { ComponentType } from '../_core/types'
import { CMSComponentProps } from '../_core/types'
import { CMSComponentFactory } from '../_factory/factory'
import { performanceMonitor } from './performance'

export interface BatchImportItem {
  type: ComponentType
  props: CMSComponentProps
  metadata?: Record<string, any>
}

export interface BatchImportResult {
  success: boolean
  totalItems: number
  successCount: number
  failureCount: number
  errors: BatchImportError[]
  importedComponents: string[]
  duration: number
}

export interface BatchImportError {
  index: number
  type: ComponentType
  error: string
  details?: any
}

export interface BatchImportOptions {
  validateBeforeImport?: boolean
  stopOnError?: boolean
  transactional?: boolean
  chunkSize?: number
  onProgress?: (progress: BatchImportProgress) => void
}

export interface BatchImportProgress {
  current: number
  total: number
  percentage: number
  currentItem?: BatchImportItem
  errors: number
}

export class BatchImportAPI {
  private factory: CMSComponentFactory
  private readonly defaultOptions: BatchImportOptions = {
    validateBeforeImport: true,
    stopOnError: false,
    transactional: true,
    chunkSize: 10
  }

  constructor() {
    this.factory = CMSComponentFactory.getInstance()
  }

  private chunkArray<T>(items: T[], size: number): T[][] {
    if (!Array.isArray(items) || items.length === 0) {
      return []
    }

    const normalizedSize = Math.max(1, size)
    const result: T[][] = []

    for (let index = 0; index < items.length; index += normalizedSize) {
      result.push(items.slice(index, index + normalizedSize))
    }

    return result
  }

  private async processChunk(
    chunk: BatchImportItem[],
    processedOffset: number,
    totalItems: number,
    options: BatchImportOptions
  ): Promise<{ imported: string[]; errors: BatchImportError[] }> {
    const imported: string[] = []
    const errors: BatchImportError[] = []

    for (let localIndex = 0; localIndex < chunk.length; localIndex++) {
      const item = chunk[localIndex]
      const globalIndex = processedOffset + localIndex

      const validation = this.validateItem(item, globalIndex)
      if (!validation.valid) {
        errors.push({
          index: globalIndex,
          type: item.type,
          error: validation.error || 'Validation failed',
          details: validation.details
        })
        if (options.stopOnError) {
          break
        }
        continue
      }

      try {
        await this.factory.loadComponent(item.type)
        const generatedId = `${item.type}-${Date.now()}-${globalIndex}`
        imported.push(generatedId)
      } catch (error) {
        errors.push({
          index: globalIndex,
          type: item.type,
          error: error instanceof Error ? error.message : 'Failed to import component',
          details: error
        })
        if (options.stopOnError) {
          break
        }
      }
    }

    return { imported, errors }
  }

  private async rollback(componentIds: string[]): Promise<void> {
    if (!Array.isArray(componentIds) || componentIds.length === 0) {
      return
    }

    const deleteFn = (this.factory as unknown as { deleteComponents?: (ids: string[]) => Promise<void> }).deleteComponents
    if (typeof deleteFn === 'function') {
      try {
        await deleteFn(componentIds)
      } catch (error) {
        if (process.env.NODE_ENV === 'development') {
          console.warn('[BatchImportAPI] rollback failed', error)
        }
      }
    }
  }

  /**
   * Batch create multiple components with transaction support
   */
  public async batchCreateComponents(
    items: BatchImportItem[],
    options?: BatchImportOptions
  ): Promise<BatchImportResult> {
    const opts = { ...this.defaultOptions, ...options }
    const startTime = Date.now()
    const errors: BatchImportError[] = []
    const importedComponents: string[] = []
    
    // Pre-validation phase
    if (opts.validateBeforeImport) {
      const validationErrors = await this.validateBatch(items)
      if (validationErrors.length > 0 && opts.stopOnError) {
        return {
          success: false,
          totalItems: items.length,
          successCount: 0,
          failureCount: validationErrors.length,
          errors: validationErrors,
          importedComponents: [],
          duration: Date.now() - startTime
        }
      }
      errors.push(...validationErrors)
    }

    // Process in chunks
    const chunks = this.chunkArray(items, opts.chunkSize || 10)
    let processedCount = 0

    for (const chunk of chunks) {
      const chunkResults = await this.processChunk(chunk, processedCount, items.length, opts)
      
      processedCount += chunk.length
      importedComponents.push(...chunkResults.imported)
      errors.push(...chunkResults.errors)

      // Report progress
      if (opts.onProgress) {
        opts.onProgress({
          current: processedCount,
          total: items.length,
          percentage: (processedCount / items.length) * 100,
          errors: errors.length
        })
      }

      // Stop on error if configured
      if (opts.stopOnError && chunkResults.errors.length > 0) {
        break
      }
    }

    // Rollback if transactional and there were errors
    if (opts.transactional && errors.length > 0) {
      await this.rollback(importedComponents)
      return {
        success: false,
        totalItems: items.length,
        successCount: 0,
        failureCount: items.length,
        errors,
        importedComponents: [],
        duration: Date.now() - startTime
      }
    }

    const successCount = importedComponents.length
    const failureCount = errors.length

    return {
      success: failureCount === 0,
      totalItems: items.length,
      successCount,
      failureCount,
      errors,
      importedComponents,
      duration: Date.now() - startTime
    }
  }

  /**
   * Validate all items before import
   */
  private async validateBatch(items: BatchImportItem[]): Promise<BatchImportError[]> {
    const errors: BatchImportError[] = []

    for (let i = 0; i < items.length; i++) {
      const item = items[i]
      const validationResult = this.validateItem(item, i)
      
      if (!validationResult.valid) {
        errors.push({
          index: i,
          type: item.type,
          error: validationResult.error || 'Validation failed',
          details: validationResult.details
        })
      }
    }

    return errors
  }

  /**
   * Validate a single import item
   */
  private validateItem(
    item: BatchImportItem,
    index: number
  ): { valid: boolean; error?: string; details?: any } {
    // Check component type is registered
    if (!this.factory.hasComponent(item.type)) {
      return {
        valid: false,
        error: `Component type ${item.type} is not registered`,
        details: { availableTypes: Array.from(this.factory.getRegistry().keys()) }
      }
    }

    // Validate required props
    if (!item.props) {
      return {
        valid: false,
        error: 'Component props are required'
      }
    }

    // Validate props structure
    if (!item.props.type || !item.props.content) {
      return {
        valid: false,
        error: 'Component props must include type and content',
        details: { providedProps: Object.keys(item.props) }
      }
    }

    // Type-specific validation
    const typeValidation = this.validateTypeSpecificProps(item.type, item.props)
    if (!typeValidation.valid) {
      return typeValidation
    }

    return { valid: true }
  }

  /**
   * Validate type-specific props
   */
  private validateTypeSpecificProps(
    type: ComponentType,
    props: CMSComponentProps
  ): { valid: boolean; error?: string; details?: any } {
    const content = props.content as Record<string, any>

    // Type-specific validation rules
    switch (type) {
      case ComponentType.HeroMinimal:
      case ComponentType.HeroWithImage:
        if (!content.headline) {
          return {
            valid: false,
            error: 'Hero components require a headline',
            details: { missingField: 'headline' }
          }
        }
        break

      case ComponentType.PricingTable:
      case ComponentType.PricingCard:
        if (!content.plans || !Array.isArray(content.plans) || content.plans.length === 0) {
          return {
            valid: false,
            error: 'Pricing components require at least one plan',
            details: { missingField: 'plans' }
          }
        }
        break

      case ComponentType.ContactForm:
      case ComponentType.ContactInfo:
        if (!content.fields || !Array.isArray(content.fields) || content.fields.length === 0) {
          return {
            valid: false,
            error: 'Form components require at least one field',
            details: { missingField: 'fields' }
          }
        }
        break

      case ComponentType.DataTable:
        if (!content.headers || !content.rows) {
          return {
            valid: false,
            error: 'Data table requires headers and rows',
            details: { missingFields: ['headers', 'rows'] }
          }
        }
        break

      case ComponentType.BlogPost:
        if (!content || (!content.bodyHtml && !content.body)) {
          return {
            valid: false,
            error: 'Blog posts require rich body content',
            details: { missingField: 'bodyHtml' }
          }
        }
        if (!content.title && !content.excerpt) {
          return {
            valid: false,
            error: 'Blog posts require at least a title or excerpt',
            details: { missingFields: ['title', 'excerpt'] }
          }
        }
        break
    }

    return { valid: true }
  }
}
export const batchImportAPI = new BatchImportAPI()
