/**
 * Optimizely Provider - Schema-First Architecture
 *
 * This provider uses the ValueObjectRegistry for type detection and mapping.
 * All value objects are exported as inline blocks (not shared blocks).
 *
 * Key principles:
 * 1. Schema-first type mapping (no pattern-based inference)
 * 2. Value objects → inline block content
 * 3. Preserve sync flow (Steps 0-4)
 * 4. Clean, maintainable code
 *
 * Naming Convention Boundary:
 * - UnifiedExportBundle contains CANONICAL hyphenated names (e.g., 'two-column')
 * - This provider transforms to Optimizely naming at its boundary (e.g., 'two_column')
 * - Uses sanitizeOptiKey() to apply hyphen → underscore transformation
 * - Component catalog lookups use original hyphenated names
 * - Optimizely API calls use underscored names
 */

import { z } from 'zod'
import { ICMSProvider } from '../types'
import { OptimizelyClient } from './client'
import { sanitizeOptiKey } from './utils/sanitize'
import { formatOptimizelyDisplayName, buildOptimizelyContentName } from './utils/display-name'
import { isRegisteredSchema } from '@/lib/studio/components/cms/_core/value-objects/registry-lookup'
import { getSchema, type ValueObjectName } from '@/lib/studio/components/cms/_core/value-objects'
import {
  unwrapZodSchema,
  getZodObjectShape,
  getZodArrayElement,
} from '../helpers/zod-schema-utils'
import type {
  UnifiedExportBundle,
  UnifiedBundleSyncResult,
  ContentTypeExport,
  CompiledTypeIndex,
  CompiledTypeSupport,
} from '@/lib/services/export/types'
import type { UnifiedContent } from '@/lib/services/export/content-orchestrator'
import type { OptimizelyContentType, OptimizelyProperty } from './types'
import { CMSComponentFactory } from '@/lib/studio/components/cms/_factory/factory'
import type { PropertyMeta } from '@/lib/studio/components/cms/_core/propsmeta'
import { stripAiMetadata } from '@/lib/services/export/helpers/strip-ai-metadata'
import { zodSchemaToTypeString } from '@/lib/studio/components/cms/_core/component-definition'
import { pickTypeKey } from '@/lib/services/export/helpers/content-type-builder'

// ============================================================================
// Primitive Type Mapping (ONLY mapping allowed - everything else via registry)
// ============================================================================

const PRIMITIVE_TYPE_MAP: Record<string, string> = {
  'string': 'string',
  'number': 'integer',    // Optimizely doesn't support 'number'
  'boolean': 'boolean',
  'date': 'dateTime',
} as const

// Reserved content type names in Optimizely that need prefixing with 'Cs'
const OPTIMIZELY_RESERVED_NAMES = new Set(['Link', 'Content', 'Page', 'Block', 'Media', 'Folder'])

// ============================================================================
// Internal Types
// ============================================================================

interface SyncStats {
  contentTypes: number
  sharedBlocks: number
  content: number  // pages + folders combined
  published: number
}

interface SyncError {
  id: string
  scope: 'contentType' | 'content'
  message: string
}

/**
 * Unified content item for creation - represents page, folder, or shared block
 */
interface UnifiedContentItem {
  id: string
  title: string
  contentType: string        // Optimizely content type key
  container: string          // Container ID (page container or block container)
  properties: unknown[]      // Recursive properties array
  status: string
  urlSegment?: string
  isSharedBlock?: boolean    // True for shared blocks
}

// ============================================================================
// Provider Implementation
// ============================================================================

export class OptimizelyProvider implements ICMSProvider {
  readonly id = 'optimizely'

  private client: OptimizelyClient
  private pageContainerId: string
  private blockContainerId: string
  private mediaContainerId: string

  constructor(config?: any) {
    this.client = new OptimizelyClient()
    if (config) {
      this.client.configure(config)
    }
    // Container IDs - prioritize config, then env, then throw
    // Strip dashes from GUIDs for Optimizely API compatibility
    this.pageContainerId = (config?.pageContainerId || process.env.OPTIMIZELY_PAGE_CONTAINER || '').replace(/-/g, '')
    this.blockContainerId = (config?.blockContainerId || process.env.OPTIMIZELY_BLOCK_CONTAINER || '').replace(/-/g, '')
    this.mediaContainerId = (config?.mediaContainerId || process.env.OPTIMIZELY_MEDIA_CONTAINER || '').replace(/-/g, '')
  }

  async testConnection(): Promise<boolean> {
    return this.client.testConnection()
  }

  /**
   * Configure the provider with credentials (called by ProviderFactory after construction)
   */
  configure(config: { clientId?: string; clientSecret?: string; projectId?: string; pageContainerId?: string; blockContainerId?: string; mediaContainerId?: string }): void {
    this.client.configure(config)
    if (config.pageContainerId) {
      this.pageContainerId = config.pageContainerId
    }
    if (config.blockContainerId) {
      this.blockContainerId = config.blockContainerId
    }
    if (config.mediaContainerId) {
      this.mediaContainerId = config.mediaContainerId
    }
  }

  // ============================================================================
  // Main Sync Method (Steps 0-4) - ICMSProvider.syncUnifiedBundle
  // ============================================================================

  async syncUnifiedBundle(
    bundle: UnifiedExportBundle,
    options?: { publish?: boolean }
  ): Promise<UnifiedBundleSyncResult> {
    // Local state for this sync - passed explicitly through call chain
    const createdContent = new Map<string, string>()
    const contentTypeKeys = new Map<string, { key: string; baseType: '_page' | '_component' }>()

    const startTime = Date.now()
    const errors: SyncError[] = []
    const stats: SyncStats = {
      contentTypes: 0,
      sharedBlocks: 0,
      content: 0,
      published: 0,
    }

    const contentStatus = options?.publish ? 'published' : 'Draft'

    // Validate container configuration
    if (!this.pageContainerId || !this.blockContainerId) {
      throw new Error(
        'Optimizely container IDs not configured. Set OPTIMIZELY_PAGE_CONTAINER and OPTIMIZELY_BLOCK_CONTAINER environment variables or provide pageContainerId/blockContainerId in config.'
      )
    }

    try {
      // ========================================================================
      // TYPE ORCHESTRATION (moved from bundle-exporter)
      // Compile, configure, ensure, and register content type mappings
      // ========================================================================
      console.log('\n📋 Step -1: Type orchestration...')
      const typeSupport = this.getCompiledTypeSupport(bundle, contentTypeKeys)
      const compiledTypes = typeSupport.compile(bundle.contentTypes || [])
      await typeSupport.configure?.(compiledTypes)
      await typeSupport.ensure?.(compiledTypes)

      // Register content type mappings for all types
      for (const ct of bundle.contentTypes || []) {
        const safeKey = pickTypeKey(ct.key, ct.name, ct.id) || ct.key || ct.name || ct.id
        const baseType: '_page' | '_component' = ct.category === 'page' ? '_page' : '_component'
        try {
          typeSupport.registerContentTypeMapping?.(ct.id, String(safeKey), baseType)
        } catch (error) {
          console.warn('[OptimizelyProvider] Failed to register mapping', {
            contentTypeId: ct.id,
            safeKey,
            error: error instanceof Error ? error.message : error
          })
        }
      }
      console.log('  Type orchestration complete')

      // Step 0: Resolve content references
      console.log('\n🔗 Step 0: Resolving content references...')
      const { resolveContentReferencesInBatch } = await import('@/lib/services/export/helpers/resolve-content-references')
      await resolveContentReferencesInBatch(bundle.unifiedContent || [])
      console.log('  Content references resolved')
      stats.contentTypes = (bundle.contentTypes || []).length

      // Step 0.5: Media upload (placeholder - handled separately in server-side code)
      // Media upload is not integrated here due to client/server bundle constraints.
      // For actual media upload, use the OptimizelyMediaUploader service directly
      // from server-side code (API routes, scripts, etc.)
      // See: lib/cms-export/optimizely/media-uploader.ts
      console.log('\n📷 Step 0.5: Media upload skipped (use media-uploader.ts for server-side media upload)')

      // Step 1: Create shared blocks (use block container)
      console.log('\n🧱 Step 1: Creating shared blocks...')
      const sharedBlockItems = this.buildSharedBlockItems(bundle, contentStatus, contentTypeKeys)
      for (const item of sharedBlockItems) {
        try {
          const response = await this.createContent(item)
          if (response) {
            createdContent.set(item.id, response)
            stats.sharedBlocks++
            console.log(`  ✓ Created shared block: ${item.title} -> ${response}`)
          }
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error)
          console.error(`  ✗ Failed to create shared block ${item.title}:`, errorMsg)
          errors.push({ id: item.id, scope: 'content', message: errorMsg })
        }
      }

      // Step 2: Create all content (pages + folders) with proper hierarchy
      // Process sequentially so parent's Optimizely ID is available for children
      console.log('\n📄 Step 2: Creating content (pages & folders)...')
      console.log(`  [DEBUG] bundle.unifiedContent has ${bundle.unifiedContent?.length ?? 0} items`)
      for (const content of bundle.unifiedContent || []) {
        try {
          const item = this.buildSingleContentItem(content, contentStatus, createdContent, contentTypeKeys)
          if (!item) continue

          const response = await this.createContent(item)
          if (response) {
            createdContent.set(item.id, response)
            stats.content++
            console.log(`  ✓ Created: ${item.title} -> ${response} (container: ${item.container})`)
          }
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error)
          console.error(`  ✗ Failed to create ${content.title}:`, errorMsg)
          errors.push({ id: content.id, scope: 'content', message: errorMsg })
        }
      }

      if (options?.publish) {
        stats.published = stats.sharedBlocks + stats.content
      }

      const duration = Date.now() - startTime
      console.log(`\n✅ Sync completed in ${(duration / 1000).toFixed(1)}s`)
      console.log(`   Content types: ${stats.contentTypes}`)
      console.log(`   Shared blocks: ${stats.sharedBlocks}`)
      console.log(`   Content (pages/folders): ${stats.content}`)

      return this.buildSyncResult(stats, errors)

    } catch (error) {
      const duration = Date.now() - startTime
      console.error(`\n❌ Sync failed after ${(duration / 1000).toFixed(1)}s:`, error)

      return {
        successCount: 0,
        failureCount: 1,
        details: [{
          scope: 'other',
          id: 'fatal',
          message: error instanceof Error ? error.message : String(error),
          success: false,
        }],
      }
    }
  }

  // ============================================================================
  // Unified Content Creation (NEW - Simplified Architecture)
  // ============================================================================

  /**
   * Build shared block items from bundle.
   * Shared blocks use the block container from .env
   */
  private buildSharedBlockItems(
    bundle: UnifiedExportBundle,
    status: string,
    contentTypeKeys: Map<string, { key: string; baseType: '_page' | '_component' }>
  ): UnifiedContentItem[] {
    const items: UnifiedContentItem[] = []
    const seen = new Set<string>() // Track processed sharedIds to deduplicate
    const factory = CMSComponentFactory.getInstance()
    const catalog = factory.getComponentCatalog()

    for (const page of bundle.unifiedContent || []) {
      for (const comp of page.components || []) {
        if (comp.isShared && comp.sharedId) {
          // Deduplicate: only process each shared component once
          if (seen.has(comp.sharedId)) continue
          seen.add(comp.sharedId)

          const contentTypeKey = contentTypeKeys.get(comp.type)?.key || sanitizeOptiKey(comp.type)
          if (!contentTypeKey) continue

          // Get schema for type-aware conversion
          const canonicalType = comp.type.replace(/_/g, '-')
          const entry = catalog.get(canonicalType as any)
          const schema = entry?.schema || null

          // Strip AI metadata and convert
          const cleanProps = stripAiMetadata(comp.properties || {}) as Record<string, unknown>
          const properties = this.convertObjectToOpti(cleanProps, schema, 0)

          items.push({
            id: comp.sharedId, // Use sharedId as the key for lookup
            title: `${comp.type} - ${page.title}`,
            contentType: contentTypeKey,
            container: this.blockContainerId,
            properties: properties as unknown[],
            status,
            isSharedBlock: true,
          })
        }
      }
    }

    return items
  }

  /**
   * Build a single content item with proper hierarchy.
   * Looks up parent's Optimizely ID from createdContent map.
   */
  private buildSingleContentItem(
    content: UnifiedContent,
    status: string,
    createdContent: Map<string, string>,
    contentTypeKeys: Map<string, { key: string; baseType: '_page' | '_component' }>
  ): UnifiedContentItem | null {
    // Resolve content type
    const contentTypeId = content.contentTypeId || content.templateKey || ''
    const contentTypeKey = contentTypeKeys.get(contentTypeId)?.key || sanitizeOptiKey(contentTypeId)

    // Determine container: use parent's Optimizely ID if available, otherwise root
    const parentOptiId = content.parentId
      ? createdContent.get(content.parentId)
      : null
    const container = parentOptiId || this.pageContainerId

    console.log(`  [DEBUG] Building: "${content.title}" | id=${content.id} | parentId=${content.parentId ?? 'null'} | parentOptiId=${parentOptiId ?? 'null'} | container=${container}`)

    if (!contentTypeKey) {
      console.warn(`  ⚠️ Skipping ${content.title}: no content type found for ${contentTypeId}`)
      return null
    }

    // Build properties recursively from components
    const properties = this.buildPageProperties(content, createdContent, contentTypeKeys)

    return {
      id: content.id,
      title: content.title,
      contentType: contentTypeKey,
      container,
      properties,
      status,
      urlSegment: content.url?.replace(/^\//, '').replace(/\/$/, '') || undefined,
    }
  }

  /**
   * Build page properties from its components.
   * This is the entry point that assembles the content area.
   */
  private buildPageProperties(
    page: any,
    createdContent: Map<string, string>,
    contentTypeKeys: Map<string, { key: string; baseType: '_page' | '_component' }>
  ): Record<string, unknown> {
    const components = page.components || []
    const contentArea: unknown[] = []

    for (const comp of components) {
      if (comp.isShared && comp.sharedId) {
        // Reference to shared block - lookup by sharedId (the actual shared component ID)
        const ref = createdContent.get(comp.sharedId)
        if (ref) {
          contentArea.push({ reference: `cms://content/${ref}` })
        }
      } else {
        // Inline block - build recursively
        const inlineBlock = this.buildInlineBlock(comp, createdContent, contentTypeKeys)
        if (inlineBlock) {
          contentArea.push(inlineBlock)
        }
      }
    }

    return { components: contentArea }
  }

  /**
   * Build an inline block from a component.
   * Format: { contentType: "type_name", content: { ...properties } }
   */
  private buildInlineBlock(
    comp: any,
    createdContent: Map<string, string>,
    contentTypeKeys: Map<string, { key: string; baseType: '_page' | '_component' }>
  ): unknown | null {
    const contentTypeKey = contentTypeKeys.get(comp.type)?.key || sanitizeOptiKey(comp.type)
    if (!contentTypeKey) {
      console.warn(`  ⚠️ Skipping inline block: no content type for ${comp.type}`)
      return null
    }

    // Get schema for type-aware conversion
    const canonicalType = comp.type.replace(/_/g, '-')
    const factory = CMSComponentFactory.getInstance()
    const catalog = factory.getComponentCatalog()
    const entry = catalog.get(canonicalType as any)
    const schema = entry?.schema || null

    // Strip AI metadata and convert recursively
    const cleanProps = stripAiMetadata(comp.properties || {}) as Record<string, unknown>
    const content = this.convertObjectToOpti(cleanProps, schema, 0)

    return {
      contentType: contentTypeKey,
      content,
    }
  }

  /**
   * Create content in Optimizely using unified item format.
   * Returns the created content ID.
   */
  private async createContent(item: UnifiedContentItem): Promise<string | null> {
    const request = {
      name: buildOptimizelyContentName(item.isSharedBlock ? 'Block' : 'Page', item.title),
      displayName: item.title,
      container: item.container,
      contentType: item.contentType,
      locale: 'en',
      properties: item.properties,
      status: item.status,
      urlSegment: item.urlSegment,
    }

    // Debug log for ALL content items (same format as content types)
    console.log(`\n========== CONTENT ITEM DEBUG (${item.title}) ==========`)
    console.log(`Endpoint: POST /content`)
    console.log(`Payload:`)
    console.log(JSON.stringify(request, null, 2))
    console.log(`==================================================\n`)

    const response = await this.client.createContent(request)
    // API returns 'key' directly, not nested under contentLink.id
    return response.key || response.contentLink?.id?.toString() || null
  }

  // ============================================================================
  // Content Type Management
  // ============================================================================

  // NOTE: ALL content type creation is now handled by ensure() in getCompiledTypeSupport()
  // which is called by bundle-exporter.ts BEFORE syncUnifiedBundle(). This includes:
  // 1. Value object types (Logo, MenuItem, etc.) - created FIRST
  // 2. Component types (navbar, footer, etc.) - created SECOND (can reference value objects)
  // 3. Page types (templates) - created LAST
  // This ensures single source of truth, correct order, and proper schema mapping.

  /**
   * Ensure value object content types exist - uses bundle.valueObjects for ordered creation
   * Called from ensure() BEFORE component types to satisfy allowedTypes references
   */
  private async ensureValueObjectContentTypesWithCache(
    errors: SyncError[],
    existingByKey: Map<string, OptimizelyContentType>,
    bundle: UnifiedExportBundle,
    contentTypeKeys: Map<string, { key: string; baseType: '_page' | '_component' }>
  ): Promise<void> {
    // Use pre-sorted valueObjects from bundle (if available, otherwise fallback to registry)
    const valueObjects = bundle.valueObjects || []

    if (valueObjects.length === 0) {
      console.log(`    No value objects in bundle, skipping ensureValueObjectContentTypes`)
      return
    }

    console.log(`    Ensuring ${valueObjects.length} value object content types (ordered by dependencies)...`)

    for (const vo of valueObjects) {
      const { schema, name, creationOrder } = vo

      try {
        // Prefix reserved names to avoid conflicts with Optimizely built-ins
        const safeName = OPTIMIZELY_RESERVED_NAMES.has(name) ? `Cs${name}` : name
        const key = sanitizeOptiKey(safeName) || safeName.toLowerCase()

        // Build properties from schema shape (handles ZodLazy via unwrapZodSchema)
        const properties: Record<string, OptimizelyProperty> = {}
        const shape = getZodObjectShape(schema)
        if (shape) {
          for (const [fieldName, fieldSchema] of Object.entries(shape)) {
            const sanitizedKey = sanitizeOptiKey(fieldName)
            if (!sanitizedKey) {
              continue
            }

            // Use schema mapping for fields - handles registered value objects as components
            properties[sanitizedKey] = this.mapSchemaToOptiProperty(fieldSchema)
            properties[sanitizedKey].displayName = formatOptimizelyDisplayName(fieldName)
          }
        }

        const contentType: OptimizelyContentType = {
          key,
          name: formatOptimizelyDisplayName(safeName),
          guid: '',
          displayName: formatOptimizelyDisplayName(safeName),
          description: `Value object: ${name}`,
          baseType: '_component',
          source: 'catalyst-studio',
          sortOrder: 100,
          mayContainTypes: [],
          properties,
        }

        // Check if exists using pre-fetched cache (no extra API call)
        const existing = existingByKey.get(key)
        if (existing) {
          console.log(`    [ValueObject] Already exists: ${key} (order: ${creationOrder})`)
        } else {
          await this.client.createContentType(contentType)
          // Add to cache so subsequent checks see it
          existingByKey.set(key, contentType)
          console.log(`    [ValueObject] Created: ${key} (order: ${creationOrder})`)
        }

        // Register in contentTypeKeys map - use ORIGINAL name as key (for lookups)
        // but store the sanitized key (for API calls)
        contentTypeKeys.set(name, { key, baseType: '_component' })

      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error)
        console.error(`    [ValueObject] Failed: ${name}`, errorMsg)
        errors.push({
          id: name,
          scope: 'contentType',
          message: errorMsg,
        })
      }
    }
  }

  // ============================================================================
  // Schema-First Type Mapping (NEW - Core Innovation)
  // ============================================================================

  /**
   * Map fields to Optimizely properties using schema-first detection
   */
  private async mapFieldsToProperties(
    fields: any[],
    componentType: string
  ): Promise<Record<string, OptimizelyProperty>> {
    const properties: Record<string, OptimizelyProperty> = {}

    // Get component definition to access propsMeta (schema-first)
    // Component catalog uses canonical hyphenated names (e.g., 'two-column')
    // but componentType may come from Optimizely with underscores (e.g., 'two_column')
    // Convert to canonical format for catalog lookup
    const canonicalType = componentType.replace(/_/g, '-')

    const factory = CMSComponentFactory.getInstance()
    const catalog = factory.getComponentCatalog()
    const entry = catalog.get(canonicalType as any)
    const propsMeta = this.extractPropsMetaFromSchema(entry?.schema) || {}

    // If fields array is empty but we have propsMeta from schema, use the schema
    // This ensures components like navbar get their menuItems field mapped correctly
    if (fields.length === 0 && Object.keys(propsMeta).length > 0) {
      for (const [fieldName, meta] of Object.entries(propsMeta)) {
        const sanitizedName = sanitizeOptiKey(fieldName)
        if (!sanitizedName) continue

        const optiProperty = this.mapPropertyMetaToOptiProperty(meta as PropertyMeta, { name: fieldName })
        properties[sanitizedName] = {
          ...optiProperty,
          displayName: formatOptimizelyDisplayName(fieldName),
          required: false,
        }
      }
      return properties
    }

    // Otherwise use the provided fields array
    for (const field of fields) {
      const fieldName = sanitizeOptiKey(field.name || field.id)
      if (!fieldName) continue

      // Get property metadata
      const meta = propsMeta[field.name] as PropertyMeta | undefined

      // Determine field type using schema-first approach
      const optiProperty = meta
        ? this.mapPropertyMetaToOptiProperty(meta, field)
        : this.mapFieldTypeToOptiProperty(field)

      properties[fieldName] = {
        ...optiProperty,
        displayName: formatOptimizelyDisplayName(field.name || field.id),
        required: false, // Always optional for flexibility
      }
    }

    return properties
  }

  /**
   * Map PropertyMeta to Optimizely property using schema detection
   */
  private mapPropertyMetaToOptiProperty(
    meta: PropertyMeta,
    field: any
  ): OptimizelyProperty {
    // Extract schema from meta.type (for Zod schemas)
    const schema = this.extractSchemaFromType(meta.type)

    if (schema) {
      return this.mapSchemaToOptiProperty(schema)
    }

    // Fallback: parse type string
    return this.mapTypeStringToOptiProperty(meta.type || 'string', field)
  }

  /**
   * Map Zod schema to Optimizely property
   */
  private mapSchemaToOptiProperty(schema: z.ZodTypeAny): OptimizelyProperty {
    // Check if this is a registered value object (single, not array)
    const registeredName = isRegisteredSchema(schema)

    if (registeredName) {
      // Single value object → component (inline block), NOT array
      // This is for fields like `logo: LogoSchema` (single object)
      // Arrays like `menuItems: z.array(MenuItemSchema)` are handled in mapZodTypeToOptiProperty
      const contentTypeName = this.getValueObjectContentTypeName(registeredName)
      return {
        type: 'component',
        displayName: registeredName,
        required: false,
        contentType: contentTypeName,
        allowedTypes: [contentTypeName],
      }
    }

    // Handle primitives and arrays
    return this.mapZodTypeToOptiProperty(schema)
  }

  /**
   * Map Zod primitive types to Optimizely types
   */
  private mapZodTypeToOptiProperty(schema: z.ZodTypeAny): OptimizelyProperty {
    // Unwrap optional/nullable
    let unwrapped = schema
    while (
      unwrapped instanceof z.ZodOptional ||
      unwrapped instanceof z.ZodNullable ||
      unwrapped instanceof z.ZodDefault
    ) {
      unwrapped = (unwrapped as any)._def.innerType
    }

    // String types
    if (unwrapped instanceof z.ZodString) {
      return { type: 'string', displayName: 'Text', required: false }
    }

    // Number types
    if (unwrapped instanceof z.ZodNumber) {
      return { type: 'integer', displayName: 'Number', required: false }
    }

    // Boolean types
    if (unwrapped instanceof z.ZodBoolean) {
      return { type: 'boolean', displayName: 'Boolean', required: false }
    }

    // Array types - use getZodArrayElement for proper unwrapping
    const arrayElement = getZodArrayElement(unwrapped)
    if (arrayElement) {
      const itemRegisteredName = isRegisteredSchema(arrayElement)

      if (itemRegisteredName) {
        // Array of value objects
        return {
          type: 'array',
          displayName: `${itemRegisteredName}s`,
          required: false,
          items: {
            type: 'content',
            allowedTypes: [this.getValueObjectContentTypeName(itemRegisteredName)],
            restrictedTypes: [],
          },
        }
      }

      // Array of primitives
      return {
        type: 'array',
        displayName: 'Array',
        required: false,
        items: { type: 'string' },
      }
    }

    // Object types (non-registered) - use getZodObjectShape for proper unwrapping
    if (getZodObjectShape(unwrapped)) {
      return { type: 'string', displayName: 'Object (JSON)', required: false }
    }

    // Default
    return { type: 'string', displayName: 'Text', required: false }
  }

  /**
   * Map type string to Optimizely property (fallback)
   */
  private mapTypeStringToOptiProperty(typeString: string, field: any): OptimizelyProperty {
    // Handle 'content[]' explicitly - represents inline blocks/components
    if (typeString === 'content[]') {
      return {
        type: 'array',
        displayName: 'Components',
        required: false,
        items: {
          type: 'content',
          allowedTypes: [],
          restrictedTypes: [],
        },
      }
    }

    // Handle arrays
    if (typeString.startsWith('Array<') || typeString.includes('[]')) {
      const itemType = typeString.replace(/^Array</, '').replace(/>$/, '').replace(/\[\]$/, '').trim()

      // Check if item type is a value object (PascalCase = value object from registry)
      const valueObjectMatch = itemType.match(/^[A-Z][a-zA-Z]+$/)
      if (valueObjectMatch) {
        // Use getValueObjectContentTypeName to handle reserved name prefixing (Link -> CsLink)
        const contentTypeKey = this.getValueObjectContentTypeName(itemType as ValueObjectName)
        return {
          type: 'array',
          displayName: `${itemType}s`,
          required: false,
          items: {
            type: 'content',
            allowedTypes: [contentTypeKey],
            restrictedTypes: [],
          },
        }
      }

      return {
        type: 'array',
        displayName: 'Array',
        required: false,
        items: { type: 'string' },
      }
    }

    // Use PRIMITIVE_TYPE_MAP for consistent mapping
    const optiType = PRIMITIVE_TYPE_MAP[typeString]
    if (optiType) {
      return { type: optiType, displayName: typeString, required: false }
    }

    // Default
    return { type: 'string', displayName: 'Text', required: false }
  }

  /**
   * Map field type to Optimizely property (delegates to mapTypeStringToOptiProperty)
   */
  private mapFieldTypeToOptiProperty(field: any): OptimizelyProperty {
    const fieldType = field.type || 'string'
    return this.mapTypeStringToOptiProperty(fieldType, field)
  }

  /**
   * Extract Zod schema from type string or object
   */
  private extractSchemaFromType(type: any): z.ZodTypeAny | null {
    // If type is already a Zod schema
    if (type && typeof type === 'object' && '_def' in type) {
      return type as z.ZodTypeAny
    }

    // If type is a string like "Logo", try to get schema from registry
    if (typeof type === 'string') {
      const valueObjectMatch = type.match(/^[A-Z][a-zA-Z]+$/)
      if (valueObjectMatch) {
        try {
          return getSchema(type as ValueObjectName)
        } catch {
          return null
        }
      }
    }

    return null
  }

  /**
   * Get content type name for a value object
   * Handles reserved name prefixing consistently with ensureValueObjectContentTypes
   */
  private getValueObjectContentTypeName(name: ValueObjectName): string {
    const safeName = OPTIMIZELY_RESERVED_NAMES.has(name) ? `Cs${name}` : name
    return sanitizeOptiKey(safeName) || safeName.toLowerCase()
  }

  /**
   * Check if content type needs update
   */
  private contentTypeNeedsUpdate(existing: any, newProperties: Record<string, any>): boolean {
    const existingProps = existing.properties || {}

    for (const [key, newProp] of Object.entries(newProperties)) {
      const existingProp = existingProps[key]

      // New field
      if (!existingProp) return true

      // Type change
      if (existingProp.type !== newProp.type) return true

      // Required change
      if (existingProp.required === true && newProp.required === false) return true

      // Array items type change
      if (newProp.type === 'array' && existingProp.type === 'array') {
        if (newProp.items?.type !== existingProp.items?.type) return true
      }
    }

    return false
  }

  // ============================================================================
  // Centralized Recursive Value → Optimizely Conversion
  // ============================================================================

  /**
   * Recursively convert a value to Optimizely format.
   * Central recursive function that handles all value types.
   *
   * @param value - The value to convert
   * @param schema - Zod schema for this value (if known)
   * @param depth - Current recursion depth (guard against infinite loops)
   * @param createdContent - Map of created content IDs for reference resolution
   */
  private convertValueToOpti(
    value: unknown,
    schema: z.ZodTypeAny | null,
    depth: number,
    createdContent: Map<string, string>
  ): unknown {
    // Guard against infinite recursion
    if (depth > 15) {
      console.warn('[convertValueToOpti] Max depth exceeded, returning value as-is')
      return value
    }

    // Null/undefined - pass through
    if (value == null) return value

    // Primitives - coerce and return
    if (typeof value !== 'object') {
      return this.coercePrimitive(value)
    }

    // Arrays - handle with schema awareness
    if (Array.isArray(value)) {
      return this.convertArrayToOpti(value, schema, depth, createdContent)
    }

    // Objects - could be value object, reference, or plain object
    return this.convertObjectValueToOpti(value as Record<string, unknown>, schema, depth, createdContent)
  }

  /**
   * Convert an array to Optimizely format.
   * If items are registered value objects, converts each to inline block format.
   */
  private convertArrayToOpti(
    arr: unknown[],
    schema: z.ZodTypeAny | null,
    depth: number,
    createdContent: Map<string, string>
  ): unknown[] {
    if (arr.length === 0) return []

    // Get item schema from array schema
    const itemSchema = this.getArrayItemSchema(schema)
    const itemTypeName = itemSchema ? isRegisteredSchema(itemSchema) : null

    return arr.map(item => {
      // If item is a registered value object, convert to inline block
      if (itemTypeName && typeof item === 'object' && item !== null && !Array.isArray(item)) {
        return this.createInlineBlockFromValue(
          item as Record<string, unknown>,
          itemTypeName,
          itemSchema,
          depth + 1,
          createdContent
        )
      }
      // Otherwise recurse
      return this.convertValueToOpti(item, itemSchema, depth + 1, createdContent)
    }).filter(Boolean)
  }

  /**
   * Convert an object value to Optimizely format.
   * Handles: registered value objects, references, plain objects.
   */
  private convertObjectValueToOpti(
    obj: Record<string, unknown>,
    schema: z.ZodTypeAny | null,
    depth: number,
    createdContent: Map<string, string>
  ): unknown {
    // =========================================================================
    // Handle content references and link types (TKT-033)
    // =========================================================================

    // Media reference: { mediaId, mediaType, ... }
    if ('mediaId' in obj && typeof obj.mediaId === 'string') {
      return this.convertMediaReference(obj, createdContent)
    }

    // Internal link (SmartLink): { type: 'internal', pageId, path }
    if (obj.type === 'internal' && obj.pageId) {
      return this.convertInternalLink(obj)
    }

    // External link (SmartLink): { type: 'external', url }
    if (obj.type === 'external' && obj.url) {
      return obj.url as string
    }

    // Email link: { type: 'email', href }
    if (obj.type === 'email' && obj.href) {
      return obj.href as string
    }

    // Phone link: { type: 'phone', href }
    if (obj.type === 'phone' && obj.href) {
      return obj.href as string
    }

    // Anchor link: { type: 'anchor', href }
    if (obj.type === 'anchor' && obj.href) {
      return obj.href as string
    }

    // Check if this object is a registered value object
    const unwrappedSchema = schema ? this.unwrapSchema(schema) : null
    const typeName = unwrappedSchema ? isRegisteredSchema(unwrappedSchema) : null

    if (typeName) {
      // It's a registered value object - create inline block
      return this.createInlineBlockFromValue(obj, typeName, unwrappedSchema, depth, createdContent)
    }

    // Image/Logo objects - extract URL (for non-registered image-like objects)
    if (obj.src || obj.url || obj.originalUrl) {
      return (obj.src || obj.url || obj.originalUrl) as string
    }

    // Plain object - convert properties recursively
    return this.convertObjectToOpti(obj, schema, depth, createdContent)
  }

  /**
   * Convert object properties to Optimizely format.
   * Iterates over each property and converts with schema awareness.
   */
  private convertObjectToOpti(
    obj: Record<string, unknown>,
    schema: z.ZodTypeAny | null,
    depth: number,
    createdContent: Map<string, string> = new Map()
  ): Record<string, unknown> {
    const result: Record<string, unknown> = {}
    const shape = this.getSchemaShape(schema)

    for (const [key, value] of Object.entries(obj)) {
      const sanitizedKey = sanitizeOptiKey(key)
      if (!sanitizedKey) continue
      if (value == null) continue

      // Get field schema if available
      const fieldSchema = shape?.[key] || null
      result[sanitizedKey] = this.convertValueToOpti(value, fieldSchema, depth + 1, createdContent)
    }

    return result
  }

  /**
   * Create an inline block from a value object (used in conversion chain).
   * Format: { contentType: "TypeName", content: { ...properties } }
   */
  private createInlineBlockFromValue(
    obj: Record<string, unknown>,
    typeName: ValueObjectName,
    schema: z.ZodTypeAny | null,
    depth: number,
    createdContent: Map<string, string>
  ): Record<string, unknown> {
    const contentTypeKey = this.getValueObjectContentTypeName(typeName)
    const content = this.convertObjectToOpti(obj, schema, depth, createdContent)

    return {
      contentType: contentTypeKey,
      content,
    }
  }

  /**
   * Get the shape (field schemas) from a Zod object schema.
   * Uses the centralized unwrapZodSchema utility which handles ZodLazy via public .schema property.
   */
  private getSchemaShape(schema: z.ZodTypeAny | null): Record<string, z.ZodTypeAny> | null {
    if (!schema) return null
    return getZodObjectShape(schema) || null
  }

  /**
   * Get the item schema from an array schema.
   * Uses the centralized getZodArrayElement utility.
   */
  private getArrayItemSchema(schema: z.ZodTypeAny | null): z.ZodTypeAny | null {
    if (!schema) return null
    return getZodArrayElement(schema) || null
  }

  /**
   * Unwrap Zod schema wrappers (Optional, Nullable, Default, Effects, Lazy).
   * Uses the centralized unwrapZodSchema utility.
   */
  private unwrapSchema(schema: z.ZodTypeAny): z.ZodTypeAny {
    return unwrapZodSchema(schema)
  }

  /**
   * Coerce primitive values to appropriate types for Optimizely.
   */
  private coercePrimitive(value: unknown): unknown {
    if (typeof value === 'string') {
      const trimmed = value.trim()
      if (/^-?\d+$/.test(trimmed)) return parseInt(trimmed, 10)
      if (/^-?\d*\.\d+$/.test(trimmed)) return parseFloat(trimmed)
      if (trimmed.toLowerCase() === 'true') return true
      if (trimmed.toLowerCase() === 'false') return false
    }
    return value
  }

  /**
   * Convert media reference to Optimizely format.
   * Format: { mediaId, mediaType, url?, alt? }
   */
  private convertMediaReference(
    obj: Record<string, unknown>,
    createdContent: Map<string, string>
  ): unknown {
    const mediaId = obj.mediaId as string | undefined
    if (mediaId) {
      const optiId = createdContent.get(mediaId)
      if (optiId) {
        return {
          reference: `cms://content/${optiId}`,
          displayOption: 'full',
        }
      }
    }
    return (obj.url || null) as string | null
  }

  /**
   * Convert SmartLink internal format to Optimizely format.
   * Format: { type: 'internal', pageId, path }
   * Returns the path as a string URL (not a reference object).
   */
  private convertInternalLink(obj: Record<string, unknown>): string | null {
    return (obj.path || null) as string | null
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  /**
   * Extract propsMeta from a Zod schema
   * Similar to the old provider's getPropsMetaForType logic.
   * Uses getZodObjectShape to handle ZodLazy schemas properly.
   */
  private extractPropsMetaFromSchema(schema: z.ZodTypeAny | undefined): Record<string, PropertyMeta> | undefined {
    if (!schema) return undefined

    const shape = getZodObjectShape(schema)
    if (!shape) return undefined

    const meta: Record<string, PropertyMeta> = {}

    for (const [fieldName, zodType] of Object.entries(shape)) {
      const field = zodType as z.ZodTypeAny
      const typeString = zodSchemaToTypeString(field)
      const isRequired = !((field as any).isOptional?.() || field instanceof z.ZodOptional)
      const description = (field as any)._def?.description || undefined

      meta[fieldName] = {
        type: typeString,
        required: isRequired,
        description,
      }
    }

    return meta
  }

  private buildSyncResult(stats: SyncStats, errors: SyncError[]): UnifiedBundleSyncResult {
    const successCount = stats.contentTypes + stats.sharedBlocks + stats.content
    const failureCount = errors.length

    return {
      successCount,
      failureCount,
      details: [
        ...errors.map(e => ({
          scope: e.scope,
          id: e.id,
          message: e.message,
          success: false,
        })),
        {
          scope: 'other' as const,
          id: 'summary',
          message: `Synced ${successCount} items successfully, ${failureCount} failed`,
          success: failureCount === 0,
        },
      ],
    }
  }

  // ============================================================================
  // Compiled Type Support (ICMSProvider interface requirement)
  // ============================================================================

  /**
   * Compiled type support implementation.
   * Called by syncUnifiedBundle() to orchestrate type creation.
   * Bundle and contentTypeKeys are captured via closure from the caller.
   */
  private getCompiledTypeSupport(
    bundle: UnifiedExportBundle,
    contentTypeKeys: Map<string, { key: string; baseType: '_page' | '_component' }>
  ): CompiledTypeSupport {
    return {
      compile: (contentTypes: ContentTypeExport[]): CompiledTypeIndex => {
        const byKey: Record<string, { fields: unknown[]; baseType: '_page' | '_component' }> = {}
        const all: Array<{ key: string; baseType?: string; fields?: Array<{ name: string; valueType?: string }> }> = []

        for (const ct of contentTypes) {
          // Apply Optimizely naming transformation: hyphens → underscores
          const key = sanitizeOptiKey(ct.key || ct.id || ct.name)
          // Check all possible fields: category (most common), type, baseType
          const isPage = ct.category === 'page' || ct.type === 'page' || ct.baseType === '_page'
          const baseType: '_page' | '_component' = isPage ? '_page' : '_component'
          const fields = ct.fields || []

          byKey[key] = { fields, baseType }
          all.push({
            key,
            baseType,
            fields: fields.map((f: { name?: string; key?: string; valueType?: string; type?: string }) => ({
              name: f.name || f.key || 'unknown',
              valueType: f.valueType || f.type || 'string',
            })),
          })

          // Register mapping: database ID/original key → Optimizely key
          // Store BOTH the original key and the sanitized key so lookups work
          const originalKey = ct.key || ct.id || ct.name
          contentTypeKeys.set(originalKey, { key, baseType })
          contentTypeKeys.set(ct.id || key, { key, baseType })
        }

        return { byKey, all }
      },

      configure: async (_compiled: CompiledTypeIndex): Promise<void> => {
        // No-op for Optimizely - configuration happens during sync
      },

      ensure: async (compiled: CompiledTypeIndex): Promise<void> => {
        // Create/update content types in Optimizely using the CORRECT mapping
        const errors: SyncError[] = []

        // Fetch ALL existing content types upfront (single API call instead of N calls)
        console.log(`  [ensure] Fetching all existing content types...`)
        const existingTypes = await this.client.getContentTypes()
        const existingByKey = new Map<string, OptimizelyContentType>()
        for (const ct of existingTypes) {
          existingByKey.set(ct.key, ct)
        }
        console.log(`  [ensure] Found ${existingByKey.size} existing content types`)

        // Step 1: Create value object content types FIRST (Logo, MenuItem, etc.)
        // These must exist before component types that reference them in allowedTypes
        console.log(`  [ensure] Creating value object content types...`)
        await this.ensureValueObjectContentTypesWithCache(errors, existingByKey, bundle, contentTypeKeys)

        // Build set of value object keys to skip in component type loop
        // This prevents collision between value objects (MediaReference) and
        // component types from usage (mediaReference) - see TKT-033 for architectural fix
        const createdValueObjectKeys = new Set<string>()
        for (const vo of bundle.valueObjects || []) {
          const safeName = OPTIMIZELY_RESERVED_NAMES.has(vo.name) ? `Cs${vo.name}` : vo.name
          const key = sanitizeOptiKey(safeName) || safeName.toLowerCase()
          createdValueObjectKeys.add(key.toLowerCase())
          createdValueObjectKeys.add(vo.name.toLowerCase())
        }

        for (const item of compiled.all) {
          // Skip if this matches a value object we just created
          // Prevents 409 Conflict from trying to create mediaReference/pageReference
          // with empty properties when MediaReference/PageReference already exist
          if (createdValueObjectKeys.has(item.key.toLowerCase())) {
            console.log(`  [ensure] Skipping ${item.key} (value object already created)`)
            continue
          }
          try {
            const key = item.key
            const baseType = (item.baseType as '_page' | '_component') || '_component'

            console.log(`  [ensure] Ensuring content type: ${key} (${baseType})`)

            // Map fields to Optimizely properties
            // Use mapFieldsToProperties which looks up the component schema from CMSComponentFactory
            // This handles value object arrays (like menuItems: MenuItem[]) correctly
            const properties = await this.mapFieldsToProperties(item.fields || [], key)

            // Add/override components content area for page types
            // ALWAYS set this for pages - mapFieldsToProperties may have incorrectly set it as 'string'
            if (baseType === '_page') {
              properties['components'] = {
                type: 'array',
                displayName: 'Components',
                required: false,
                items: {
                  type: 'content',
                  allowedTypes: [],
                  restrictedTypes: [],
                },
              }
            }

            const contentType: OptimizelyContentType = {
              key,
              name: formatOptimizelyDisplayName(key),
              displayName: formatOptimizelyDisplayName(key),
              description: `Catalyst Studio: ${formatOptimizelyDisplayName(key)}`,
              baseType,
              source: 'catalyst-studio',
              sortOrder: baseType === '_page' ? 20 : 10,
              mayContainTypes: baseType === '_page' ? ['*'] : [],
              properties,
            }

            // DEBUG: Log page type payloads
            // if (baseType === '_page') {
              console.log(`\n========== CONTENT TYPE DEBUG (${key}) ==========`);
              console.log(`Endpoint: POST /contenttypes`);
              console.log(`Payload:`);
              console.log(JSON.stringify(contentType, null, 2));
              console.log(`==================================================\n`);
            // }

            // Check if content type exists (from pre-fetched map)
            const existing = existingByKey.get(key)

            if (existing) {
              if (this.contentTypeNeedsUpdate(existing, properties)) {
                console.log(`  [ensure] Updating: ${key}`)
                await this.client.updateContentType(key, contentType, { ignoreDataLossWarnings: true })
              } else {
                console.log(`  [ensure] Already up to date: ${key}`)
              }
            } else {
              await this.client.createContentType(contentType)
              console.log(`  [ensure] Created: ${key}`)
            }

            // Register the mapping
            contentTypeKeys.set(key, { key, baseType })

          } catch (e) {
            errors.push({
              id: item.key,
              scope: 'contentType',
              message: e instanceof Error ? e.message : String(e),
            })
          }
        }

        if (errors.length > 0) {
          console.warn(`[OptimizelyProvider] ensure() had ${errors.length} errors:`, errors)
        }
      },

      registerContentTypeMapping: (dbId: string, safeKey: string, baseType: '_page' | '_component'): void => {
        // Sanitize the key for Optimizely (convert dashes to underscores, etc.)
        const sanitizedKey = sanitizeOptiKey(safeKey) || safeKey
        contentTypeKeys.set(dbId, { key: sanitizedKey, baseType })
      },
    }
  }

}
