/**
 * Umbraco Compose Provider Constants
 *
 * Configuration constants and defaults for Umbraco Compose integration.
 */

// ============================================================================
// API Endpoints
// ============================================================================

/** Base URL for Management API */
export const UMBRACO_MANAGEMENT_URL = 'https://management.umbracocompose.com';

/** Ingestion API URL pattern (replace {region}) */
export const UMBRACO_INGESTION_URL_PATTERN = 'https://ingest.{region}.umbracocompose.com';

/** GraphQL API URL pattern (replace {region}) */
export const UMBRACO_GRAPHQL_URL_PATTERN = 'https://graphql.{region}.umbracocompose.com';

// ============================================================================
// Default Configuration
// ============================================================================

/** Default environment alias */
export const DEFAULT_ENVIRONMENT = 'production';

/** Default collection name */
export const DEFAULT_COLLECTION = 'pages';

/** Default rate limit delay in milliseconds */
export const DEFAULT_RATE_LIMIT_MS = 200;

/** Default request timeout in milliseconds */
export const DEFAULT_TIMEOUT_MS = 30000;

/** Default maximum retry attempts */
export const DEFAULT_MAX_RETRIES = 3;

/** Token refresh buffer in milliseconds (refresh 60s before expiry) */
export const TOKEN_REFRESH_BUFFER_MS = 60000;

// ============================================================================
// API Paths
// ============================================================================

/** OAuth token endpoint */
export const AUTH_TOKEN_PATH = '/v1/auth/token';

/** Path pattern for type schemas (replace {project} and {env}) */
export const TYPE_SCHEMAS_PATH_PATTERN = '/v1/projects/{project}/environments/{env}/type-schemas';

/** Path pattern for collections (replace {project} and {env}) */
export const COLLECTIONS_PATH_PATTERN = '/v1/projects/{project}/environments/{env}/collections';

/** Path pattern for project info (replace {project}) */
export const PROJECT_PATH_PATTERN = '/v1/projects/{project}';

// ============================================================================
// JSON Schema Constants
// ============================================================================

/** Umbraco Compose JSON Schema base URL */
export const UMBRACO_SCHEMA_BASE = 'https://umbracocompose.com/v1/schema';

/** Umbraco Compose node reference */
export const UMBRACO_NODE_REF = 'https://umbracocompose.com/v1/node';

// ============================================================================
// HTTP Status Codes
// ============================================================================

export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  BAD_GATEWAY: 502,
  SERVICE_UNAVAILABLE: 503,
  GATEWAY_TIMEOUT: 504,
} as const;

// ============================================================================
// Error Codes
// ============================================================================

export const ERROR_CODES = {
  AUTH_FAILED: 'AUTH_FAILED',
  INVALID_CONFIG: 'INVALID_CONFIG',
  TYPE_SCHEMA_EXISTS: 'TYPE_SCHEMA_EXISTS',
  TYPE_SCHEMA_NOT_FOUND: 'TYPE_SCHEMA_NOT_FOUND',
  COLLECTION_EXISTS: 'COLLECTION_EXISTS',
  COLLECTION_NOT_FOUND: 'COLLECTION_NOT_FOUND',
  INGESTION_FAILED: 'INGESTION_FAILED',
  RATE_LIMITED: 'RATE_LIMITED',
  NETWORK_ERROR: 'NETWORK_ERROR',
  TIMEOUT: 'TIMEOUT',
} as const;

// ============================================================================
// Provider Metadata
// ============================================================================

/** Provider identifier */
export const UMBRACO_COMPOSE_PROVIDER_ID = 'umbraco-compose';

/** Provider display name */
export const UMBRACO_COMPOSE_DISPLAY_NAME = 'Umbraco Compose';

/** Provider version */
export const UMBRACO_COMPOSE_PROVIDER_VERSION = '1.0.0';

// ============================================================================
// Environment Variables
// ============================================================================

export const ENV_VARS = {
  PROJECT_ALIAS: 'UMBRACO_PROJECT_ALIAS',
  REGION: 'UMBRACO_REGION',
  ENVIRONMENT: 'UMBRACO_ENVIRONMENT',
  CLIENT_ID: 'UMBRACO_CLIENT_ID',
  CLIENT_SECRET: 'UMBRACO_CLIENT_SECRET',
  PAT: 'UMBRACO_PAT',
  COLLECTION: 'UMBRACO_COLLECTION',
} as const;
