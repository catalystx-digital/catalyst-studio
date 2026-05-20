// ICMSProvider Interface and Related Types

import type {
  UnifiedExportBundle,
  UnifiedBundleSyncOptions,
  UnifiedBundleSyncResult,
} from '@/lib/services/export/types';

export type {
  UniversalContentType,
  UniversalContentItem,
  ContentStatus,
  ContentRelationship,
  ContentValidationResult
} from './universal/types';

/**
 * Validation result for content type operations
 */
export interface ValidationResult {
  valid: boolean;
  errors?: Array<{
    field: string;
    message: string;
    code?: string;
  }>;
  warnings?: Array<{
    field: string;
    message: string;
  }>;
}

/**
 * Provider capability matrix
 */
export interface ProviderCapabilities {
  supportsComponents: boolean;
  supportsPages: boolean;
  supportsRichText: boolean;
  supportsMedia: boolean;
  supportsReferences: boolean;
  supportsLocalizations: boolean;
  supportsVersioning: boolean;
  supportsScheduling: boolean;
  supportsWebhooks: boolean;
  supportsTemplateMetadata?: boolean;
  customCapabilities?: Record<string, boolean>;
}

/**
 * Core CMS Provider Interface
 * All CMS-specific implementations must implement this interface
 *
 * SIMPLIFIED: The provider handles ALL orchestration internally via syncUnifiedBundle().
 * Methods like getContentType(), createContentItem(), getCompiledTypeSupport() are
 * internal implementation details - NOT part of the public interface.
 */
export interface ICMSProvider {
  /** Unique identifier for the provider */
  readonly id: string;

  /**
   * SINGLE entry point - provider handles everything internally:
   * - Type compilation and schema creation
   * - Content item creation/updates
   * - Reference resolution
   * - Media uploads
   */
  syncUnifiedBundle(
    bundle: UnifiedExportBundle,
    options?: UnifiedBundleSyncOptions
  ): Promise<UnifiedBundleSyncResult>;

  /** Optional - for connection testing UI */
  testConnection?(): Promise<boolean>;
}

/**
 * Base error class for provider operations
 */
export class ProviderError extends Error {
  constructor(message: string, public code?: string) {
    super(message);
    this.name = 'ProviderError';
  }
}

/**
 * Error thrown when a provider is not found
 */
export class ProviderNotFoundError extends ProviderError {
  constructor(providerId: string) {
    super(`Provider '${providerId}' not found`, 'PROVIDER_NOT_FOUND');
    this.name = 'ProviderNotFoundError';
  }
}

/**
 * Error thrown when content type validation fails
 */
export class ProviderValidationError extends ProviderError {
  constructor(message: string, public validationResult?: ValidationResult) {
    super(message, 'VALIDATION_ERROR');
    this.name = 'ProviderValidationError';
  }
}

/**
 * Error thrown when provider connection fails
 */
export class ProviderConnectionError extends ProviderError {
  constructor(message: string, public cause?: Error) {
    super(message, 'CONNECTION_ERROR');
    this.name = 'ProviderConnectionError';
  }
}

/**
 * Error thrown when type transformation fails
 */
export class ProviderTransformationError extends ProviderError {
  constructor(message: string, public sourceType?: unknown) {
    super(message, 'TRANSFORMATION_ERROR');
    this.name = 'ProviderTransformationError';
  }
}

