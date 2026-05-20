/**
 * Unified Response Types for Cross-System Compatibility
 * 
 * These types ensure consistent responses across UI, AI, and Sync systems
 * to prevent orphaned content and provide better error recovery.
 */

/**
 * Standard response format for all page operations
 */
export interface StandardResponse<T = unknown> {
  success: boolean;
  data: T | null;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  metadata?: {
    executionTime: string;
    source: 'ui' | 'ai' | 'sync';
    requestId: string;
    version: string;
  };
}

/**
 * Validation error with recovery suggestions
 */
export interface ValidationError {
  code: ErrorCode;
  field?: string;
  message: string;
  severity: 'error' | 'critical';
  recovery?: RecoverySuggestion;
}

/**
 * Recovery suggestion for AI-friendly error handling
 */
export interface RecoverySuggestion {
  action: 'regenerate_slug' | 'select_parent' | 'use_existing' | 'retry';
  suggestion: string;
  alternativeValues?: string[];
}

/**
 * Validation warning (non-blocking)
 */
export interface ValidationWarning {
  code: string;
  field?: string;
  message: string;
  severity: 'warning' | 'info';
}

/**
 * Error codes for consistent error handling
 */
export enum ErrorCode {
  SLUG_CONFLICT = 'SLUG_CONFLICT',
  DUPLICATE_ID = 'DUPLICATE_ID',
  INVALID_SLUG = 'INVALID_SLUG',
  ORPHANED_NODE = 'ORPHANED_NODE',
  CIRCULAR_REF = 'CIRCULAR_REF',
  PARENT_NOT_FOUND = 'PARENT_NOT_FOUND',
  CONTENT_TYPE_NOT_FOUND = 'CONTENT_TYPE_NOT_FOUND',
  VALIDATION_FAILED = 'VALIDATION_FAILED',
  WEBSITE_NOT_FOUND = 'WEBSITE_NOT_FOUND',
  UNAUTHORIZED = 'UNAUTHORIZED',
  INTERNAL_ERROR = 'INTERNAL_ERROR'
}

/**
 * Page creation request DTO
 */
export interface CreatePageRequest {
  websiteId: string;
  contentTypeId: string;
  title: string;
  content: Record<string, unknown>;
  parentId?: string;
  slug?: string;
  metadata?: Record<string, unknown>;
  status?: 'draft' | 'published';
  templateKey?: string;
  templateProps?: Record<string, unknown>;
}

/**
 * Page update request DTO
 */
export interface UpdatePageRequest {
  title?: string;
  content?: Record<string, unknown>;
  slug?: string;
  parentId?: string;
  metadata?: Record<string, unknown>;
  status?: 'draft' | 'published';
  templateKey?: string;
  templateProps?: Record<string, unknown>;
}

/**
 * Page result including both ContentItem and SiteStructure
 */
export interface PageResult {
  contentItem: {
    id: string;
    title: string;
    slug: string;
    websiteId: string;
    contentTypeId: string;
    content: Record<string, unknown>;
    status: string;
    templateKey?: string | null;
    templateProps?: Record<string, unknown> | null;
    createdAt: Date;
    updatedAt: Date;
  };
  siteStructure: {
    id: string;
    websiteId: string;
    contentItemId: string;
    parentId: string | null;
    slug: string;
    fullPath: string;
    pathDepth: number;
    position: number;
  };
  url: string;
}

/**
 * Delete options
 */
export interface DeleteOptions {
  cascade?: boolean;
  force?: boolean;
}

