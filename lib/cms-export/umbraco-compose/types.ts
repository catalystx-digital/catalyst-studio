/**
 * Umbraco Compose Provider Types
 *
 * Type definitions for Umbraco Compose API integration.
 * Based on POC validation (scripts/poc/umbraco-poc.js).
 */

// ============================================================================
// Configuration Types
// ============================================================================

/**
 * Configuration for Umbraco Compose client
 */
export interface UmbracoComposeClientConfig {
  /** Project alias (e.g., "royal-childrens-hospital") */
  projectAlias?: string;
  /** Region (e.g., "germanywestcentral") */
  region?: string;
  /** Environment alias (default: "production") */
  environment?: string;
  /** OAuth client ID for Management API */
  clientId?: string;
  /** OAuth client secret for Management API */
  clientSecret?: string;
  /** Personal Access Token for Ingestion API */
  personalAccessToken?: string;
  /** Default collection (default: "pages") */
  collection?: string;
  /** Rate limit delay in milliseconds (default: 200) */
  rateLimitMs?: number;
  /** Request timeout in milliseconds (default: 30000) */
  timeout?: number;
  /** Maximum retry attempts (default: 3) */
  maxRetries?: number;
}

/**
 * Provider-specific configuration (extends base config)
 */
export interface UmbracoComposeProviderConfig extends UmbracoComposeClientConfig {
  /** Enable debug logging */
  debug?: boolean;
  /** Cache enabled */
  cacheEnabled?: boolean;
  /** Cache TTL in seconds */
  cacheTTL?: number;
}

// ============================================================================
// API Response Types
// ============================================================================

/**
 * OAuth token response from Management API
 */
export interface UmbracoAuthTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

/**
 * GraphQL-style edge wrapper for list responses
 */
export interface UmbracoEdge<T> {
  node: T;
}

/**
 * GraphQL-style connection wrapper for list responses
 */
export interface UmbracoConnection<T> {
  edges: UmbracoEdge<T>[];
  pageInfo?: {
    hasNextPage: boolean;
    endCursor?: string;
  };
}

/**
 * Type schema definition as stored in Umbraco
 */
export interface UmbracoTypeSchemaNode {
  typeSchemaAlias: string;
  schema: UmbracoJsonSchema;
}

/**
 * Collection definition as stored in Umbraco
 */
export interface UmbracoCollectionNode {
  collectionAlias: string;
  description?: string;
}

// ============================================================================
// JSON Schema Types (Umbraco Compose format)
// ============================================================================

/**
 * Umbraco Compose JSON Schema format
 * Based on: https://umbracocompose.com/v1/schema
 */
export interface UmbracoJsonSchema {
  $schema: 'https://umbracocompose.com/v1/schema';
  allOf: [{ $ref: 'https://umbracocompose.com/v1/node' }];
  properties: Record<string, UmbracoSchemaProperty>;
}

/**
 * Individual property in a JSON Schema
 */
export interface UmbracoSchemaProperty {
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  format?: string;
  $ref?: string;
  items?: UmbracoSchemaProperty | { type: string; properties?: Record<string, UmbracoSchemaProperty> };
  properties?: Record<string, UmbracoSchemaProperty>;
}

// ============================================================================
// Ingestion API Types
// ============================================================================

/**
 * Entry for batch ingestion
 */
export interface UmbracoIngestionEntry {
  /** Unique content ID */
  id: string;
  /** Type schema alias */
  type: string;
  /** Action to perform */
  action: 'upsert' | 'delete';
  /** Content data */
  data: Record<string, unknown>;
}

/**
 * Result from ingestion API
 */
export interface UmbracoIngestionResult {
  success: boolean;
  processed?: number;
  errors?: UmbracoIngestionErrorDetail[];
}

/**
 * Error from ingestion API response
 */
export interface UmbracoIngestionErrorDetail {
  id: string;
  message: string;
  code?: string;
}

// ============================================================================
// Internal Types
// ============================================================================

/**
 * Cached authentication token
 */
export interface UmbracoCachedToken {
  token: string;
  expiresAt: number;
}

/**
 * Progress callback for sync operations
 */
export type UmbracoSyncProgressCallback = (progress: {
  step: string;
  current: number;
  total: number;
  message: string;
}) => void;

/**
 * Content reference (for shared components)
 */
export interface UmbracoContentReference {
  id: string;
  type: string;
}

/**
 * Mapped type schema for creation
 */
export interface UmbracoMappedTypeSchema {
  typeSchemaAlias: string;
  schema: UmbracoJsonSchema;
}

// ============================================================================
// Error Types
// ============================================================================

/**
 * Base error for Umbraco Compose operations
 */
export class UmbracoComposeError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode?: number,
    public details?: unknown
  ) {
    super(message);
    this.name = 'UmbracoComposeError';
  }
}

/**
 * Authentication error
 */
export class UmbracoAuthError extends UmbracoComposeError {
  constructor(message: string, statusCode?: number) {
    super(message, 'AUTH_ERROR', statusCode);
    this.name = 'UmbracoAuthError';
  }
}

/**
 * API validation error
 */
export class UmbracoValidationError extends UmbracoComposeError {
  constructor(message: string, details?: unknown) {
    super(message, 'VALIDATION_ERROR', 400, details);
    this.name = 'UmbracoValidationError';
  }
}

/**
 * Rate limit error
 */
export class UmbracoRateLimitError extends UmbracoComposeError {
  constructor(retryAfter?: number) {
    super(
      `Rate limit exceeded${retryAfter ? `. Retry after ${retryAfter}s` : ''}`,
      'RATE_LIMIT_ERROR',
      429
    );
    this.name = 'UmbracoRateLimitError';
  }
}

/**
 * Ingestion error
 */
export class UmbracoIngestionError extends UmbracoComposeError {
  constructor(message: string, public failedEntries?: UmbracoIngestionErrorDetail[]) {
    super(message, 'INGESTION_ERROR', 500, failedEntries);
    this.name = 'UmbracoIngestionError';
  }
}

/**
 * Connection error
 */
export class UmbracoConnectionError extends UmbracoComposeError {
  constructor(message: string, public cause?: Error) {
    super(message, 'CONNECTION_ERROR');
    this.name = 'UmbracoConnectionError';
  }
}
