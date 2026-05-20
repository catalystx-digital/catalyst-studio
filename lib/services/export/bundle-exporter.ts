import { FolderExporter, FolderHierarchy, FolderStatistics } from './folder-exporter'
import { EnhancedExportValidator } from './export-validator'
import { ContentOrchestrator } from './content-orchestrator'
import { ComponentInstanceExtractor } from './component-instance-extractor'
import { prisma } from '@/lib/prisma'
import { ICMSProvider } from '@/lib/cms-export/types'

// Import shared types
import {
  ContentTypeExport,
  ContentItemExport,
  StandardExport,
  ComponentExport,
  ExportMetadata,
  UnifiedExportBundle,
  UnifiedBundleSyncResult,
  CSSAssets
} from './types'
export type { ContentTypeExport, ContentItemExport, StandardExport, ComponentExport, ExportMetadata, CSSAssets }

/**
 * CSS generation is now handled by the generate-head pipeline using design-system.css.
 * These stub functions maintain backward compatibility for the legacy export service
 * but return minimal content. New exports should use the generate-head pipeline.
 */
function generateExportCSS(_options?: Record<string, unknown>): string {
  return '/* CSS now generated via design-system.css in generate-head pipeline */\n'
}
function generateCriticalCSS(): string {
  return '/* Critical CSS now handled by design-system.css */\n'
}
function generateThemeHeadHTML(theme: 'light' | 'dark' | 'auto' = 'light'): string {
  return `<!-- Theme: ${theme}. CSS variables provided by design-system.css -->\n`
}

import { extractComponentsFromUnifiedContent } from './helpers/component-extraction'
import { fetchContentTypes, maybeEmitTypeDependencyPlan } from './helpers/content-type-helpers'
import { attachMediaAssetsToContentItems, transformUnifiedContentToExport } from './helpers/content-item-helpers'
import { computeValueObjectCreationOrder } from './helpers/value-object-order'

// ComponentExport interface is imported from types.ts

// ExportMetadata interface is imported from types.ts

// StandardExport interface moved to types.ts to avoid circular dependency

export interface ExportOptions {
  includeComponents?: boolean
  includeFolders?: boolean
  includeContentItems?: boolean
  selectedFolders?: string[]
  includeFolderChildren?: boolean
  stopOnCriticalErrors?: boolean
  /** Include CSS assets for exported site styling (default: true) */
  includeCSSAssets?: boolean
  /** Theme mode for CSS export (default: 'light') */
  theme?: 'light' | 'dark' | 'auto'
  /** Publish content after export instead of leaving as draft (default: false) */
  publish?: boolean
}

// Export validator is now in export-validator.ts as EnhancedExportValidator

export class BundleExporter {
  private folderExporter: FolderExporter
  private validator: EnhancedExportValidator
  private contentOrchestrator: ContentOrchestrator
  private componentExtractor: ComponentInstanceExtractor
  private provider?: ICMSProvider
  
  constructor(provider?: ICMSProvider) {
    this.folderExporter = new FolderExporter()
    this.validator = new EnhancedExportValidator()
    this.contentOrchestrator = new ContentOrchestrator(prisma)
    this.componentExtractor = new ComponentInstanceExtractor(prisma)
    this.provider = provider
  }

  private async prepareExportBundle(
    websiteId: string,
    options: ExportOptions = {}
  ): Promise<{
    exportData: StandardExport
    bundle: UnifiedExportBundle
  }> {
    const startTime = Date.now()

    const website = await prisma.website.findUnique({ where: { id: websiteId } })
    if (!website) {
      throw new Error(`Website not found: ${websiteId}`)
    }

    const unifiedContent = await this.contentOrchestrator.gatherAllContent(websiteId)
    console.log(`BundleExporter: Orchestrated ${unifiedContent.length} unified content items`)

    const componentExtraction = await extractComponentsFromUnifiedContent({
      unifiedContent,
      websiteId,
      extractor: this.componentExtractor
    })

    const componentsByPage = new Map<string, Array<{
      id: string
      type: string
      position?: number
      parentId: string | null
      properties: any
      isShared: boolean
      sharedId?: string
    }>>()

    for (const component of componentExtraction.components) {
      const metadata = component.metadata as Record<string, any> | undefined
      const pageId = metadata?.pageId
      if (!pageId) continue
      const bucket = componentsByPage.get(pageId) ?? []
      bucket.push({
        id: component.id,
        type: component.type,
        position: metadata?.position,
        parentId: metadata?.parentId ?? null,
        properties: component.props,
        isShared: Boolean(metadata?.isShared),
        sharedId: metadata?.sharedId
      })
      componentsByPage.set(pageId, bucket)
    }

    const enrichedUnified = unifiedContent.map(item => {
      if (item.type === 'page') {
        const pageComponents = componentsByPage.get(item.id) ?? []
        return { ...item, components: pageComponents }
      }
      return { ...item, components: item.components ?? [] }
    })

    const includeContentItems = options.includeContentItems !== false
    const includeComponents = options.includeComponents === true

    const baseContentItems = includeContentItems ? transformUnifiedContentToExport(enrichedUnified) : []
    const contentItems = includeContentItems
      ? await attachMediaAssetsToContentItems(enrichedUnified, baseContentItems)
      : []

    const contentTypes = await fetchContentTypes({
      websiteId,
      componentUsage: componentExtraction.usage,
      provider: this.provider
    })

    let folders: FolderHierarchy = {
      root: [],
      totalFolders: 0,
      maxDepth: 0,
      pathMappings: {}
    }

    if (options.includeFolders !== false) {
      if (options.selectedFolders && options.selectedFolders.length > 0) {
        folders = await this.folderExporter.exportSelectedFolders(
          websiteId,
          options.selectedFolders,
          options.includeFolderChildren !== false
        )
      } else {
        folders = await this.folderExporter.exportFolders(websiteId)
      }
    }

    const componentsForExport = includeComponents ? componentExtraction.components : []

    const endTime = Date.now()

    const metadata: ExportMetadata = {
      exportDate: new Date().toISOString(),
      websiteId,
      websiteName: website.name,
      version: '1.0.0',
      statistics: {
        contentTypes: contentTypes.length,
        contentItems: contentItems.length,
        components: componentsForExport.length,
        folders: folders.totalFolders,
        totalExportTime: endTime - startTime
      }
    }

    // Generate CSS assets for exported site styling
    const includeCSSAssets = options.includeCSSAssets !== false
    const theme = options.theme || 'light'
    let cssAssets: CSSAssets | undefined

    if (includeCSSAssets) {
      cssAssets = {
        full: generateExportCSS({
          includeLight: true,
          includeDark: true,
          includeUtilities: true,
          includeTypography: true,
          includeFonts: true,
          minify: false
        }),
        critical: generateCriticalCSS(),
        themeScript: generateThemeHeadHTML(theme),
        theme
      }
      console.log(`BundleExporter: Generated CSS assets (${cssAssets.full.length} bytes full, ${cssAssets.critical.length} bytes critical)`)
    }

    // Compute value object creation order for export
    const valueObjects = computeValueObjectCreationOrder()
    console.log(`  Computed creation order for ${valueObjects.length} value objects`)

    const exportData: StandardExport = {
      contentTypes,
      contentItems,
      components: componentsForExport,
      folders,
      metadata,
      cssAssets
    }

    const bundle: UnifiedExportBundle = {
      website: {
        id: websiteId,
        name: website.name
      },
      contentTypes,
      unifiedContent: enrichedUnified,
      componentUsage: Array.from(componentExtraction.usage),
      components: componentExtraction.components,
      valueObjects,
      folders,
      metadata,
      cssAssets
    }

    return { exportData, bundle }
  }

  private async applyValidation(
    exportData: StandardExport,
    options: ExportOptions = {}
  ): Promise<void> {
    const validation = await this.validator.validateExportData(exportData)

    exportData.metadata.validation = {
      performed: true,
      valid: validation.valid,
      errorCount: validation.errors.length,
      warningCount: validation.warnings.length,
      timestamp: new Date().toISOString()
    }

    if (!validation.valid) {
      console.error('Export validation failed:', validation.errors)

      if (options.stopOnCriticalErrors) {
        const criticalErrors = validation.errors.filter(e => e.severity === 'error')
        if (criticalErrors.length > 0) {
          throw new Error(`Export validation failed with ${criticalErrors.length} critical error(s): ${criticalErrors[0].message}`)
        }
      }
    }

    if (validation.warnings.length > 0) {
      console.warn('Export warnings:', validation.warnings)
    }

    if (!validation.valid || validation.warnings.length > 0) {
      (exportData.metadata as any).validationReport = {
        errors: validation.errors,
        warnings: validation.warnings,
        summary: validation.summary
      }
    }
  }

  private async emitTypeDependencyPlan(exportData: StandardExport): Promise<void> {
    try {
      await maybeEmitTypeDependencyPlan({
        contentItems: exportData.contentItems || [],
        contentTypes: exportData.contentTypes,
        provider: this.provider
      })
    } catch (e) {
      console.warn('TypeDependency plan emission failed (non-fatal):', (e as Error)?.message)
    }
  }

  /**
   * Export website data with optional provider sync
   */
  async export(
    websiteId: string,
    options: ExportOptions = {}
  ): Promise<{
    exportData: StandardExport
    syncResults?: {
      unifiedContent?: UnifiedBundleSyncResult
    }
  }> {
    const { exportData, bundle } = await this.prepareExportBundle(websiteId, options)
    await this.applyValidation(exportData, options)
    await this.emitTypeDependencyPlan(exportData)

    if (!this.provider) {
      return { exportData }
    }

    console.log(`🚀 Starting provider bundle sync for website ${websiteId}`)

    // ONE call - provider handles everything internally
    const unifiedContentSync = await this.provider.syncUnifiedBundle(bundle, {
      publish: options.publish === true,
    })
    console.log(`✅ Unified content sync complete: ${unifiedContentSync.successCount} successful, ${unifiedContentSync.failureCount} failed${options.publish ? ' (published)' : ' (draft)'}`)

    return {
      exportData,
      syncResults: {
        unifiedContent: unifiedContentSync
      }
    }
  }

}
