// Universal Type System Definitions

/**
 * Type metadata for AI tracking and generation history
 */
export interface TypeMetadata {
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string;
  updatedBy?: string;
  aiGenerated?: boolean;
  aiModel?: string;
  aiPrompt?: string;
  version?: string;
  tags?: string[];
  contentType?: string;
  componentType?: string;
  platformSpecific?: Record<string, unknown>;
}

/**
 * Content type classification
 */
export type ContentTypeClassification = 'page' | 'component';

/**
 * Field layer classification in the three-layer system
 */
export type FieldLayer = 'primitive' | 'common' | 'extension';

/**
 * Field types across all layers
 */
export type FieldType = 
  // Layer 1: Primitives
  | 'text' 
  | 'longText' 
  | 'number' 
  | 'boolean' 
  | 'date' 
  | 'json' 
  | 'decimal'
  // Layer 2: Common Patterns
  | 'richText' 
  | 'media' 
  | 'collection' 
  | 'component' 
  | 'select' 
  | 'repeater' 
  | 'slug' 
  | 'tags'
  // Layer 3: Extensions (platform-specific, added dynamically)
  | string;

/**
 * Field validation rules
 */
export interface UniversalValidation {
  type: 'required' | 'min' | 'max' | 'pattern' | 'unique' | 'custom';
  value?: string | number | boolean | RegExp;
  message?: string;
  code?: string;
}

/**
 * Fallback strategy for missing field support
 */
export type FallbackStrategy = 
  | 'ignore'           // Skip the field
  | 'text'            // Convert to text
  | 'json'            // Store as JSON
  | 'custom';         // Platform-specific handling

/**
 * Universal field definition
 */
export interface UniversalField {
  id: string;
  name: string;
  layer: FieldLayer;
  type: FieldType;
  description?: string;
  required?: boolean;
  defaultValue?: string | number | boolean | null;
  validations?: UniversalValidation[];
  fallbackStrategy?: FallbackStrategy;
  platformSpecific?: Record<string, unknown>;
  metadata?: TypeMetadata;
}

/**
 * Universal content type definition
 */
export interface UniversalContentType {
  version: string;
  id: string;
  name: string;
  type: ContentTypeClassification;
  description?: string;
  isRoutable: boolean;
  fields: UniversalField[];
  metadata: TypeMetadata;
  validations?: UniversalValidation[];
  platformSpecific?: Record<string, unknown>;
}

/**
 * Content status types
 */
export type ContentStatus = 'draft' | 'published' | 'archived';

/**
 * Content relationship definition
 */
export interface ContentRelationship {
  type: 'parent' | 'child' | 'reference' | 'component';
  targetId: string;
  targetType?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Universal media asset metadata shared across providers
 */
export interface UniversalMediaAsset {
  id: string;
  contentId?: string | null;
  mimeType?: string | null;
  width?: number | null;
  height?: number | null;
  duration?: number | null;
  altText?: string | null;
  originalUrl?: string | null;
  signedUrl?: string | null;
  publicUrl?: string | null;
  providerHints?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  renditions?: Array<{
    width?: number | null;
    height?: number | null;
    publicUrl?: string | null;
    signedUrl?: string | null;
    storageKey?: string;
  }>;
}

/**
 * Universal media service contract used by shared modules.
 */
export interface UniversalMediaService {
  getAssetsForWebsiteByIds(
    websiteId: string,
    mediaIds: Set<string>,
    context?: { altTextByMediaId?: Map<string, string | null> }
  ): Promise<Map<string, UniversalMediaAsset>>;
}

/**
 * Universal content item representation
 */
export interface UniversalContentItem {
  id: string;
  contentTypeId: string;
  name: string;
  title: string;
  slug: string;
  content: Record<string, unknown>;
  contentType: string;
  fields: Record<string, unknown>;
  parentId?: string;
  language?: string;
  metadata?: Record<string, unknown>;
  mediaAssets?: UniversalMediaAsset[];
  status: ContentStatus;
  relationships?: ContentRelationship[];
  publishedAt?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
  version?: string;
  platformSpecific?: Record<string, unknown>;
}

/**
 * Content filter for querying items
 */
export interface ContentFilter {
  contentTypeId?: string;
  status?: ContentStatus | ContentStatus[];
  ids?: string[];
  slug?: string;
  search?: string;
  metadata?: Record<string, unknown>;
  createdAfter?: Date;
  createdBefore?: Date;
  updatedAfter?: Date;
  updatedBefore?: Date;
  publishedAfter?: Date;
  publishedBefore?: Date;
  hasRelationship?: {
    type?: string;
    targetId?: string;
  };
}

/**
 * Pagination options for bulk operations
 */
export interface PaginationOptions {
  limit: number;
  offset?: number;
  cursor?: string;
  orderBy?: {
    field: string;
    direction: 'asc' | 'desc';
  };
}

/**
 * Validation result for content items
 */
export interface ContentValidationResult {
  valid: boolean;
  errors?: Array<{
    field?: string;
    code: string;
    message: string;
    severity: 'error' | 'warning';
  }>;
  warnings?: Array<{
    field?: string;
    code: string;
    message: string;
  }>;
}
