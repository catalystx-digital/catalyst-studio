/**
 * Umbraco Compose CMS Export Provider
 *
 * Public exports for the Umbraco Compose provider.
 */

// Main provider
export { UmbracoComposeProvider } from './provider';

// Client (for advanced usage)
export { UmbracoComposeClient } from './client';

// Auth (for testing)
export { UmbracoAuthManager } from './auth';

// Types
export type {
  UmbracoComposeClientConfig,
  UmbracoComposeProviderConfig,
  UmbracoIngestionEntry,
  UmbracoIngestionResult,
  UmbracoJsonSchema,
  UmbracoSchemaProperty,
  UmbracoMappedTypeSchema,
  UmbracoTypeSchemaNode,
  UmbracoCollectionNode,
} from './types';

// Errors
export {
  UmbracoComposeError,
  UmbracoAuthError,
  UmbracoValidationError,
  UmbracoRateLimitError,
  UmbracoIngestionError,
  UmbracoConnectionError,
} from './types';

// Constants
export {
  UMBRACO_COMPOSE_PROVIDER_ID,
  UMBRACO_COMPOSE_DISPLAY_NAME,
  UMBRACO_MANAGEMENT_URL,
  DEFAULT_ENVIRONMENT,
  DEFAULT_COLLECTION,
  ENV_VARS,
} from './constants';

// Utilities
export {
  generateContentId,
  generatePageId,
  generateSharedComponentId,
  sanitizeForId,
} from './utils/id-generator';

export {
  mapContentTypeToSchema,
  createPageSchema,
  createComponentSchema,
  sanitizeSchemaAlias,
} from './utils/schema-mapper';

export {
  transformPageToEntry,
  transformSharedComponentToEntry,
  extractSharedComponents,
  resolveSlug,
} from './utils/content-transformer';
