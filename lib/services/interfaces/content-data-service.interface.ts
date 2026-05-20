import { WebsiteCustomContentData, ContentType, Prisma } from '@/lib/generated/prisma';

/**
 * Data transfer object for creating custom content data
 * @interface CreateContentDataDto
 */
export interface CreateContentDataDto {
  websiteId: string;
  title: string;
  data: any;
  contentTypeId: string;
  publishedAt?: Date;
  createdBy?: string;
  updatedBy?: string;
}

/**
 * Data transfer object for updating custom content data
 * @interface UpdateContentDataDto
 */
export interface UpdateContentDataDto {
  title?: string;
  data?: any;
  contentTypeId?: string;
  status?: string;
  publishedAt?: Date | null;
  updatedBy?: string;
}

/**
 * Extended custom content data interface with content type information
 * @interface ContentDataWithType
 * @extends {WebsiteCustomContentData}
 */
export interface ContentDataWithType extends WebsiteCustomContentData {
  contentType?: ContentType | null;
}

/**
 * Filter options for querying content data
 * @interface ContentDataFilter
 */
export interface ContentDataFilter {
  websiteId?: string;
  contentTypeId?: string;
  publishedOnly?: boolean;
  search?: string;
}

/**
 * Result of bulk operations on content data
 * @interface BulkOperationResult
 */
export interface BulkOperationResult {
  success: number;
  failed: number;
  errors?: Array<{ id: string; error: string }>;
}

/**
 * Service interface for WebsiteCustomContentData operations
 * Handles all custom content data business logic including CRUD operations and bulk processing
 * @interface IContentDataService
 */
export interface IContentDataService {
  /**
   * Create a new content data record
   * @param {CreateContentDataDto} data - Content data to create
   * @returns {Promise<WebsiteCustomContentData>} Created content data
   * @throws {Error} If content type doesn't exist or validation fails
   */
  createContentData(data: CreateContentDataDto): Promise<WebsiteCustomContentData>;

  /**
   * Get content data by ID
   */
  getContentData(id: string): Promise<WebsiteCustomContentData | null>;

  /**
   * Get content data with its type information
   */
  getContentDataWithType(id: string): Promise<ContentDataWithType | null>;

  /**
   * Update content data
   */
  updateContentData(id: string, data: UpdateContentDataDto): Promise<WebsiteCustomContentData>;

  /**
   * Delete content data
   */
  deleteContentData(id: string): Promise<void>;

  /**
   * Get all content data with filters
   */
  getContentDataList(filter: ContentDataFilter): Promise<ContentDataWithType[]>;

  /**
   * Validate content data against its type schema
   */
  validateContentData(data: any, contentTypeId: string): Promise<boolean>;

  /**
   * Bulk create content data records
   */
  bulkCreateContentData(records: CreateContentDataDto[]): Promise<BulkOperationResult>;

  /**
   * Bulk update content data records
   */
  bulkUpdateContentData(updates: Array<{ id: string; data: UpdateContentDataDto }>): Promise<BulkOperationResult>;

  /**
   * Bulk delete content data records
   */
  bulkDeleteContentData(ids: string[]): Promise<BulkOperationResult>;

  /**
   * Publish content data
   */
  publishContentData(id: string, userId: string): Promise<WebsiteCustomContentData>;

  /**
   * Unpublish content data
   */
  unpublishContentData(id: string): Promise<WebsiteCustomContentData>;

  /**
   * Search content data
   */
  searchContentData(websiteId: string, query: string, contentTypeId?: string): Promise<ContentDataWithType[]>;

  /**
   * Export content data to JSON
   */
  exportContentData(filter: ContentDataFilter): Promise<any[]>;

  /**
   * Import content data from JSON
   */
  importContentData(websiteId: string, data: any[]): Promise<BulkOperationResult>;
}