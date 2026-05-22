import { 
  ICMSProvider, 
  UniversalContentType,
  UniversalContentItem,
  ContentValidationResult,
  ProviderCapabilities,
  ValidationResult
} from '../types';
import type { ContentFilter, PaginationOptions } from '../universal/types';
import type {
  CompiledTypeIndex,
  ContentTypeExport,
  UnifiedExportBundle,
  UnifiedBundleSyncResult,
  UnifiedBundleSyncOptions
} from '@/lib/services/export/types';
import { buildUniversalContentType } from '@/lib/services/export/helpers/content-type-builder';
import { formatUnifiedBundleSyncResult } from '@/lib/cms-export/helpers/unified-bundle-result';
import type { UnifiedContent } from '../../services/export/content-orchestrator';

// Additional types that might not be exported yet
interface ContentInstance {
  id: string;
  typeId: string;
  data: Record<string, unknown>;
  metadata?: {
    createdAt?: Date;
    updatedAt?: Date;
    version?: string;
    status?: string;
  };
}

interface TransformationResult {
  success: boolean;
  data: unknown;
  warnings?: string[];
  errors?: string[];
}

interface ProviderMetadata {
  provider: string;
  version: string;
  connected: boolean;
  lastSync?: Date;
  capabilities?: ProviderCapabilities;
}

/**
 * Mock provider for testing without a real CMS
 * Provides deterministic responses and tracks method calls
 */
export class MockProvider implements ICMSProvider {
  readonly id = 'mock';
  readonly name = 'Mock CMS Provider';
  readonly version = '1.0.0';
  
  private contentTypes: Map<string, UniversalContentType> = new Map();
  private contentInstances: Map<string, ContentInstance[]> = new Map();
  private contentItems: Map<string, UniversalContentItem> = new Map();
  private methodCalls: Array<{ method: string; args: unknown[]; timestamp: Date }> = [];
  private simulateDelay: number = 0;
  private shouldFail: boolean = false;
  private failureMessage: string = 'Mock provider simulated failure';
  private compiledIndex?: CompiledTypeIndex;
  private contentTypeMapping: Map<string, string> = new Map();

  constructor() {
    this.initializeTestData();
  }

  /**
   * Initialize with test data fixtures
   */
  private initializeTestData(): void {
    // Add some default test content types
    const blogPost: UniversalContentType = {
      version: '1.0.0',
      id: 'blog-post',
      name: 'Blog Post',
      type: 'page',
      isRoutable: true,
      fields: [
        {
          id: 'title',
          name: 'title',
          layer: 'primitive',
          type: 'text',
          required: true,
          validations: [
            { type: 'required', message: 'Title is required' },
            { type: 'max', value: 200, message: 'Title must be less than 200 characters' }
          ]
        },
        {
          id: 'content',
          name: 'content',
          layer: 'primitive',
          type: 'longText',
          required: true,
          validations: [
            { type: 'required', message: 'Content is required' }
          ]
        },
        {
          id: 'author',
          name: 'author',
          layer: 'primitive',
          type: 'text',
          required: false
        },
        {
          id: 'publishDate',
          name: 'publishDate',
          layer: 'primitive',
          type: 'date',
          required: false
        }
      ],
      metadata: {
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
        version: '1.0.0'
      }
    };

    const heroSection: UniversalContentType = {
      version: '1.0.0',
      id: 'hero-section',
      name: 'Hero Section',
      type: 'component',
      isRoutable: false,
      fields: [
        {
          id: 'heading',
          name: 'heading',
          layer: 'primitive',
          type: 'text',
          required: true,
          validations: [
            { type: 'required', message: 'Heading is required' },
            { type: 'max', value: 100, message: 'Heading must be less than 100 characters' }
          ]
        },
        {
          id: 'subheading',
          name: 'subheading',
          layer: 'primitive',
          type: 'text',
          required: false
        },
        {
          id: 'backgroundImage',
          name: 'backgroundImage',
          layer: 'common',
          type: 'media',
          required: false
        },
        {
          id: 'ctaText',
          name: 'ctaText',
          layer: 'primitive',
          type: 'text',
          required: false
        },
        {
          id: 'ctaUrl',
          name: 'ctaUrl',
          layer: 'primitive',
          type: 'text',
          required: false
        }
      ],
      metadata: {
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
        version: '1.0.0'
      }
    };

    this.contentTypes.set('blog-post', blogPost);
    this.contentTypes.set('hero-section', heroSection);

    // Add test content instances
    this.contentInstances.set('blog-post', [
      {
        id: 'blog-1',
        typeId: 'blog-post',
        data: {
          title: 'Test Blog Post',
          content: 'This is test content',
          author: 'Test Author',
          publishDate: new Date('2024-01-15')
        },
        metadata: {
          createdAt: new Date('2024-01-15'),
          updatedAt: new Date('2024-01-15'),
          version: '1.0.0',
          status: 'published'
        }
      }
    ]);

    // Add test content items
    const testItem1: UniversalContentItem = {
      id: 'item-1',
      contentTypeId: 'blog-post',
      name: 'First Blog Post',
      title: 'First Blog Post',
      slug: 'first-blog-post',
      content: {
        title: 'First Blog Post',
        content: 'This is the first blog post content',
        author: 'John Doe',
        publishDate: new Date('2024-01-15')
      },
      contentType: 'blog-post',
      fields: {
        title: 'First Blog Post',
        content: 'This is the first blog post content',
        author: 'John Doe',
        publishDate: new Date('2024-01-15')
      },
      metadata: { tags: ['test', 'blog'] },
      status: 'published',
      publishedAt: new Date('2024-01-15'),
      createdAt: new Date('2024-01-15'),
      updatedAt: new Date('2024-01-15'),
      version: '1.0'
    };

    const testItem2: UniversalContentItem = {
      id: 'item-2',
      contentTypeId: 'blog-post',
      name: 'Draft Post',
      title: 'Draft Post',
      slug: 'draft-post',
      content: {
        title: 'Draft Post',
        content: 'Work in progress',
        author: 'Jane Smith'
      },
      contentType: 'blog-post',
      fields: {
        title: 'Draft Post',
        content: 'Work in progress',
        author: 'Jane Smith'
      },
      status: 'draft',
      createdAt: new Date('2024-01-20'),
      updatedAt: new Date('2024-01-20'),
      version: '1.0'
    };

    this.contentItems.set('item-1', testItem1);
    this.contentItems.set('item-2', testItem2);
  }

  /**
   * Track method calls for test assertions
   */
  private trackCall(method: string, args: unknown[]): void {
    this.methodCalls.push({
      method,
      args,
      timestamp: new Date()
    });
  }

  /**
   * Simulate network delay if configured
   */
  private async simulateLatency(): Promise<void> {
    if (this.simulateDelay > 0) {
      await new Promise(resolve => setTimeout(resolve, this.simulateDelay));
    }
  }

  /**
   * Check if should simulate failure
   */
  private checkFailure(): void {
    if (this.shouldFail) {
      throw new Error(this.failureMessage);
    }
  }

  // ICMSProvider Implementation
  
  // Optional compiled types capability to mirror production path
  public getCompiledTypeSupport() {
    return {
      compile: (contentTypes: ContentTypeExport[]) => {
        const byKey: Record<string, { universal: UniversalContentType }> = {};
        const all = contentTypes.map(ct => {
          const universal = buildUniversalContentType(ct);
          byKey[universal.id] = { universal };
          return {
            key: universal.id,
            name: universal.name,
            baseType: universal.type,
            fields: (universal.fields || []).map(field => ({
              name: field.id || field.name,
              valueType: field.type,
            })),
          };
        });
        const compiled = { byKey, all } as CompiledTypeIndex;
        this.compiledIndex = compiled;
        return compiled;
      },
      configure: (compiled: CompiledTypeIndex) => {
        this.compiledIndex = compiled;
      },
      ensure: async (_compiled: CompiledTypeIndex) => {
        // no-op for mock
      },
      registerContentTypeMapping: (dbId: string, safeKey: string) => {
        if (!dbId || !safeKey) return;
        this.contentTypeMapping.set(dbId, safeKey);
        this.contentTypeMapping.set(safeKey, safeKey);
      }
    };
  }

  async getContentTypes(): Promise<UniversalContentType[]> {
    this.trackCall('getContentTypes', []);
    await this.simulateLatency();
    this.checkFailure();
    
    return Array.from(this.contentTypes.values());
  }

  async getContentType(id: string): Promise<UniversalContentType | null> {
    this.trackCall('getContentType', [id]);
    await this.simulateLatency();
    this.checkFailure();
    
    return this.contentTypes.get(id) || null;
  }

  async createContentType(type: UniversalContentType): Promise<UniversalContentType> {
    this.trackCall('createContentType', [type]);
    await this.simulateLatency();
    this.checkFailure();
    
    if (this.contentTypes.has(type.id)) {
      throw new Error(`Content type '${type.id}' already exists in MockProvider. Unable to create duplicate. Existing type: ${this.contentTypes.get(type.id)?.name}`);
    }
    
    const newType = {
      ...type,
      metadata: {
        ...type.metadata,
        createdAt: new Date(),
        updatedAt: new Date(),
        version: '1.0.0'
      }
    };
    
    this.contentTypes.set(type.id, newType);
    return newType;
  }

  async updateContentType(id: string, type: Partial<UniversalContentType>): Promise<UniversalContentType> {
    this.trackCall('updateContentType', [id, type]);
    await this.simulateLatency();
    this.checkFailure();
    
    const existing = this.contentTypes.get(id);
    if (!existing) {
      throw new Error(`Content type '${id}' not found in MockProvider. Available types: ${Array.from(this.contentTypes.keys()).join(', ')}`);
    }
    
    const updatedType = {
      ...existing,
      ...type,
      id, // Ensure ID doesn't change
      metadata: {
        ...existing.metadata,
        ...type.metadata,
        updatedAt: new Date()
      }
    };
    
    this.contentTypes.set(id, updatedType);
    return updatedType;
  }

  async deleteContentType(id: string): Promise<boolean> {
    this.trackCall('deleteContentType', [id]);
    await this.simulateLatency();
    this.checkFailure();
    
    if (!this.contentTypes.has(id)) {
      throw new Error(`Content type '${id}' not found in MockProvider. Cannot delete non-existent type. Available types: ${Array.from(this.contentTypes.keys()).join(', ')}`);
    }
    
    this.contentTypes.delete(id);
    this.contentInstances.delete(id);
    return true;
  }

  async getContentInstances(typeId: string): Promise<ContentInstance[]> {
    this.trackCall('getContentInstances', [typeId]);
    await this.simulateLatency();
    this.checkFailure();
    
    return this.contentInstances.get(typeId) || [];
  }

  async getContentInstance(typeId: string, instanceId: string): Promise<ContentInstance | null> {
    this.trackCall('getContentInstance', [typeId, instanceId]);
    await this.simulateLatency();
    this.checkFailure();
    
    const instances = this.contentInstances.get(typeId) || [];
    return instances.find(i => i.id === instanceId) || null;
  }

  async createContentInstance(instance: ContentInstance): Promise<string> {
    this.trackCall('createContentInstance', [instance]);
    await this.simulateLatency();
    this.checkFailure();
    
    const instances = this.contentInstances.get(instance.typeId) || [];
    const newId = `mock-${Date.now()}`;
    
    instances.push({
      ...instance,
      id: newId,
      metadata: {
        ...instance.metadata,
        createdAt: new Date(),
        updatedAt: new Date(),
        version: '1.0.0'
      }
    });
    
    this.contentInstances.set(instance.typeId, instances);
    return newId;
  }

  async updateContentInstance(
    typeId: string, 
    instanceId: string, 
    data: Partial<ContentInstance>
  ): Promise<void> {
    this.trackCall('updateContentInstance', [typeId, instanceId, data]);
    await this.simulateLatency();
    this.checkFailure();
    
    const instances = this.contentInstances.get(typeId) || [];
    const index = instances.findIndex(i => i.id === instanceId);
    
    if (index === -1) {
      throw new Error(`Content instance ${instanceId} not found`);
    }
    
    instances[index] = {
      ...instances[index],
      ...data,
      id: instanceId,
      typeId,
      metadata: {
        ...instances[index].metadata,
        ...data.metadata,
        updatedAt: new Date()
      }
    };
    
    this.contentInstances.set(typeId, instances);
  }

  async deleteContentInstance(typeId: string, instanceId: string): Promise<void> {
    this.trackCall('deleteContentInstance', [typeId, instanceId]);
    await this.simulateLatency();
    this.checkFailure();
    
    const instances = this.contentInstances.get(typeId) || [];
    const filtered = instances.filter(i => i.id !== instanceId);
    
    if (filtered.length === instances.length) {
      throw new Error(`Content instance ${instanceId} not found`);
    }
    
    this.contentInstances.set(typeId, filtered);
  }

  async transform(data: unknown): Promise<TransformationResult> {
    this.trackCall('transform', [data]);
    await this.simulateLatency();
    this.checkFailure();
    
    return {
      success: true,
      data: data,
      warnings: []
    };
  }

  mapToUniversal(providerSpecific: unknown): UniversalContentType {
    this.trackCall('mapToUniversal', [providerSpecific]);
    return providerSpecific as UniversalContentType;
  }

  mapFromUniversal(universal: UniversalContentType): unknown {
    this.trackCall('mapFromUniversal', [universal]);
    return universal;
  }

  getCapabilities(): ProviderCapabilities {
    return {
      supportsVersioning: true,
      supportsLocalizations: true,
      supportsComponents: true,
      supportsPages: true,
      supportsRichText: true,
      supportsMedia: true,
      supportsReferences: true,
      supportsScheduling: false,
      supportsWebhooks: false,
      supportsTemplateMetadata: true,
      customCapabilities: {
        supportsTestMode: true,
        supportsMockData: true,
        supportsWorkflow: false,
        supportsContentRelationships: true
      }
    };
  }

  getProviderCapabilities(): ProviderCapabilities {
    // Alias for getCapabilities to match interface
    return this.getCapabilities();
  }

  async validateContentType(type: UniversalContentType): Promise<ValidationResult> {
    this.trackCall('validateContentType', [type]);
    await this.simulateLatency();
    
    const errors: Array<{ field: string; message: string }> = [];
    
    if (!type.id) errors.push({ field: 'id', message: 'Content type ID is required' });
    if (!type.name) errors.push({ field: 'name', message: 'Content type name is required' });
    if (!type.fields || type.fields.length === 0) {
      errors.push({ field: 'fields', message: 'At least one field is required' });
    }
    
    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined
    };
  }

  async getMetadata(): Promise<ProviderMetadata> {
    return {
      provider: this.name,
      version: this.version,
      connected: true,
      lastSync: new Date(),
      capabilities: this.getCapabilities()
    };
  }

  async updateContentItem(id: string, item: UniversalContentItem): Promise<UniversalContentItem> {
    this.trackCall('updateContentItem', [id, item]);
    await this.simulateLatency();
    this.checkFailure();

    const existing = this.contentItems.get(id);
    if (!existing) {
      throw new Error(`Content item '${id}' not found in MockProvider. Total items: ${this.contentItems.size}. Use getContentItems() to list available items.`);
    }

    // Check for duplicate slugs (excluding current item)
    if (item.slug !== existing.slug) {
      const duplicateSlug = Array.from(this.contentItems.values()).find(
        other => other.id !== id && other.slug === item.slug && other.contentTypeId === item.contentTypeId
      );
      if (duplicateSlug) {
        throw new Error(`Content item with slug ${item.slug} already exists for type ${item.contentTypeId}`);
      }
    }

    const updatedItem: UniversalContentItem = {
      ...existing,
      ...item,
      id, // Ensure ID doesn't change
      updatedAt: new Date(),
      version: item.version || existing.version
    };

    this.contentItems.set(id, updatedItem);
    return updatedItem;
  }

  async deleteContentItem(id: string): Promise<boolean> {
    this.trackCall('deleteContentItem', [id]);
    await this.simulateLatency();
    this.checkFailure();

    if (!this.contentItems.has(id)) {
      throw new Error(`Content item '${id}' not found in MockProvider. Cannot delete non-existent item. Total items: ${this.contentItems.size}`);
    }

    // Handle cascade deletion for relationships
    const itemToDelete = this.contentItems.get(id);
    if (itemToDelete?.relationships) {
      // Remove references from other items
      Array.from(this.contentItems.values()).forEach(item => {
        if (item.relationships) {
          item.relationships = item.relationships.filter(
            rel => rel.targetId !== id
          );
        }
      });
    }

    this.contentItems.delete(id);
    return true;
  }

  async getContentItem(id: string): Promise<UniversalContentItem | null> {
    this.trackCall('getContentItem', [id]);
    await this.simulateLatency();
    this.checkFailure();

    const item = this.contentItems.get(id);
    if (!item) {
      return null;
    }

    // Resolve relationships if they exist
    if (item.relationships) {
      const resolvedRelationships = item.relationships.map(rel => {
        const target = this.contentItems.get(rel.targetId);
        return {
          ...rel,
          metadata: {
            ...rel.metadata,
            targetExists: !!target,
            targetTitle: target?.title
          }
        };
      });
      
      return {
        ...item,
        relationships: resolvedRelationships
      };
    }

    return item;
  }

  async getContentItems(
    filter?: ContentFilter, 
    pagination?: PaginationOptions
  ): Promise<{ items: UniversalContentItem[]; total: number }> {
    this.trackCall('getContentItems', [filter, pagination]);
    await this.simulateLatency();
    this.checkFailure();

    let items = Array.from(this.contentItems.values());

    // Apply filters
    if (filter) {
      if (filter.contentTypeId) {
        items = items.filter(item => item.contentTypeId === filter.contentTypeId);
      }
      
      if (filter.status) {
        const statuses = Array.isArray(filter.status) ? filter.status : [filter.status];
        items = items.filter(item => statuses.includes(item.status));
      }
      
      if (filter.ids && filter.ids.length > 0) {
        items = items.filter(item => filter.ids!.includes(item.id));
      }
      
      if (filter.slug) {
        items = items.filter(item => item.slug === filter.slug);
      }
      
      if (filter.search) {
        const searchLower = filter.search.toLowerCase();
        items = items.filter(item => 
          item.title.toLowerCase().includes(searchLower) ||
          JSON.stringify(item.content).toLowerCase().includes(searchLower)
        );
      }
      
      if (filter.metadata) {
        items = items.filter(item => {
          if (!item.metadata) return false;
          return Object.entries(filter.metadata!).every(([key, value]) => 
            item.metadata![key] === value
          );
        });
      }
      
      if (filter.createdAfter) {
        items = items.filter(item => 
          item.createdAt && item.createdAt >= filter.createdAfter!
        );
      }
      
      if (filter.createdBefore) {
        items = items.filter(item => 
          item.createdAt && item.createdAt <= filter.createdBefore!
        );
      }
      
      if (filter.updatedAfter) {
        items = items.filter(item => 
          item.updatedAt && item.updatedAt >= filter.updatedAfter!
        );
      }
      
      if (filter.updatedBefore) {
        items = items.filter(item => 
          item.updatedAt && item.updatedAt <= filter.updatedBefore!
        );
      }
      
      if (filter.publishedAfter) {
        items = items.filter(item => 
          item.publishedAt && item.publishedAt >= filter.publishedAfter!
        );
      }
      
      if (filter.publishedBefore) {
        items = items.filter(item => 
          item.publishedAt && item.publishedAt <= filter.publishedBefore!
        );
      }
      
      if (filter.hasRelationship) {
        items = items.filter(item => {
          if (!item.relationships) return false;
          return item.relationships.some(rel => 
            (!filter.hasRelationship!.type || rel.type === filter.hasRelationship!.type) &&
            (!filter.hasRelationship!.targetId || rel.targetId === filter.hasRelationship!.targetId)
          );
        });
      }
    }

    const total = items.length;

    // Apply sorting
    if (pagination?.orderBy) {
      const { field, direction } = pagination.orderBy;
      items.sort((a, b) => {
        const aValue = (a as unknown as Record<string, unknown>)[field];
        const bValue = (b as unknown as Record<string, unknown>)[field];
        
        if (aValue === bValue) return 0;
        if (aValue === null || aValue === undefined) return 1;
        if (bValue === null || bValue === undefined) return -1;
        
        const comparison = aValue < bValue ? -1 : 1;
        return direction === 'asc' ? comparison : -comparison;
      });
    }

    // Apply pagination
    if (pagination) {
      const start = pagination.offset || 0;
      const end = start + pagination.limit;
      items = items.slice(start, end);
    }

    return { items, total };
  }

  async validateContentItem(item: UniversalContentItem): Promise<ContentValidationResult> {
    this.trackCall('validateContentItem', [item]);
    await this.simulateLatency();

    const errors: Array<{
      field?: string;
      code: string;
      message: string;
      severity: 'error' | 'warning';
    }> = [];
    
    const warnings: Array<{
      field?: string;
      code: string;
      message: string;
    }> = [];

    // Required field validation
    if (!item.id) {
      errors.push({
        field: 'id',
        code: 'REQUIRED_FIELD',
        message: 'Content item ID is required',
        severity: 'error'
      });
    }

    if (!item.contentTypeId) {
      errors.push({
        field: 'contentTypeId',
        code: 'REQUIRED_FIELD',
        message: 'Content type ID is required',
        severity: 'error'
      });
    }

    if (!item.title) {
      errors.push({
        field: 'title',
        code: 'REQUIRED_FIELD',
        message: 'Title is required',
        severity: 'error'
      });
    }

    if (!item.slug) {
      errors.push({
        field: 'slug',
        code: 'REQUIRED_FIELD',
        message: 'Slug is required',
        severity: 'error'
      });
    }

    // Slug format validation
    if (item.slug && !/^[a-z0-9-]+$/.test(item.slug)) {
      errors.push({
        field: 'slug',
        code: 'INVALID_FORMAT',
        message: 'Slug must contain only lowercase letters, numbers, and hyphens',
        severity: 'error'
      });
    }

    // Status validation
    const validStatuses: Array<string> = ['draft', 'published', 'archived'];
    if (!validStatuses.includes(item.status)) {
      errors.push({
        field: 'status',
        code: 'INVALID_STATUS',
        message: `Status must be one of: ${validStatuses.join(', ')}`,
        severity: 'error'
      });
    }

    // Relationship validation
    if (item.relationships) {
      const seenIds = new Set<string>();
      item.relationships.forEach((rel, index) => {
        // Check for circular references
        if (rel.targetId === item.id) {
          errors.push({
            field: `relationships[${index}]`,
            code: 'CIRCULAR_REFERENCE',
            message: 'Content item cannot reference itself',
            severity: 'error'
          });
        }
        
        // Check for duplicate relationships
        if (seenIds.has(rel.targetId)) {
          warnings.push({
            field: `relationships[${index}]`,
            code: 'DUPLICATE_RELATIONSHIP',
            message: `Duplicate relationship to ${rel.targetId}`
          });
        }
        seenIds.add(rel.targetId);
        
        // Validate relationship type
        const validTypes = ['parent', 'child', 'reference', 'component'];
        if (!validTypes.includes(rel.type)) {
          errors.push({
            field: `relationships[${index}].type`,
            code: 'INVALID_RELATIONSHIP_TYPE',
            message: `Relationship type must be one of: ${validTypes.join(', ')}`,
            severity: 'error'
          });
        }
      });
    }

    // Content type validation
    const contentType = this.contentTypes.get(item.contentTypeId);
    if (contentType) {
      // Validate required fields
      contentType.fields.forEach(field => {
        if (field.required && !item.content[field.id]) {
          errors.push({
            field: `content.${field.id}`,
            code: 'REQUIRED_FIELD',
            message: `Field '${field.name}' is required`,
            severity: 'error'
          });
        }
      });
    } else if (item.contentTypeId) {
      warnings.push({
        code: 'UNKNOWN_CONTENT_TYPE',
        message: `Content type '${item.contentTypeId}' not found in provider`
      });
    }

    // SEO warnings
    if (!item.metadata?.description) {
      warnings.push({
        field: 'metadata.description',
        code: 'MISSING_SEO',
        message: 'Consider adding a meta description for better SEO'
      });
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
      warnings: warnings.length > 0 ? warnings : undefined
    };
  }

  async syncUnifiedBundle(
    bundle: UnifiedExportBundle,
    _options?: UnifiedBundleSyncOptions
  ): Promise<UnifiedBundleSyncResult> {
    const batchResult = await this.processBatchUnifiedContent(bundle.unifiedContent);
    return formatUnifiedBundleSyncResult(this.id, batchResult);
  }

  async processBatchUnifiedContent(unifiedItems: UnifiedContent[]): Promise<{
    successful: UniversalContentItem[];
    failed: { item: UnifiedContent; error: string }[];
  }> {
    this.trackCall('processBatchUnifiedContent', [unifiedItems]);
    await this.simulateLatency();

    const successful: UniversalContentItem[] = [];
    const failed: { item: UnifiedContent; error: string }[] = [];

    for (const u of unifiedItems) {
      try {
        // Very basic mapping for mock provider
        const slug = (u.title || String(u.id))
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/(^-|-$)/g, '');

        const item: UniversalContentItem = {
          id: `mock-${u.id}`,
          contentTypeId: u.contentTypeId,
          name: u.title,
          title: u.title,
          slug,
          content: u.content || {},
          contentType: u.contentTypeId,
          fields: u.content || {},
          parentId: u.parentId,
          metadata: u.metadata || {},
          status: u.status === 'published' ? 'published' : 'draft',
          publishedAt: u.publishedAt ?? null,
          createdAt: new Date(),
          updatedAt: new Date(),
          version: '1.0.0'
        };

        successful.push(item);
      } catch (err: any) {
        failed.push({ item: u, error: err?.message || 'Unknown error' });
      }
    }

    return { successful, failed };
  }

  // Test helper methods

  /**
   * Configure test behavior
   */
  configure(config: {
    simulateDelay?: number;
    shouldFail?: boolean;
    failureMessage?: string;
  }): void {
    if (config.simulateDelay !== undefined) {
      this.simulateDelay = config.simulateDelay;
    }
    if (config.shouldFail !== undefined) {
      this.shouldFail = config.shouldFail;
    }
    if (config.failureMessage !== undefined) {
      this.failureMessage = config.failureMessage;
    }
  }

  /**
   * Get method call history for test assertions
   */
  getMethodCalls(): Array<{ method: string; args: unknown[]; timestamp: Date }> {
    return [...this.methodCalls];
  }

  /**
   * Clear method call history
   */
  clearMethodCalls(): void {
    this.methodCalls = [];
  }

  /**
   * Reset to initial state
   */
  reset(): void {
    this.contentTypes.clear();
    this.contentInstances.clear();
    this.contentItems.clear();
    this.methodCalls = [];
    this.simulateDelay = 0;
    this.shouldFail = false;
    this.initializeTestData();
  }

  /**
   * Add test data
   */
  addTestData(types: UniversalContentType[], instances?: ContentInstance[]): void {
    types.forEach(type => {
      this.contentTypes.set(type.id, type);
    });
    
    if (instances) {
      instances.forEach(instance => {
        const existing = this.contentInstances.get(instance.typeId) || [];
        existing.push(instance);
        this.contentInstances.set(instance.typeId, existing);
      });
    }
  }
}
