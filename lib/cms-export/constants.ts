/**
 * Provider validation and configuration constants
 */

/**
 * Validation limits for content items and metadata
 */
export const VALIDATION_LIMITS = {
  MAX_TITLE_LENGTH: 200,
  MAX_SLUG_LENGTH: 100,
  MAX_METADATA_SIZE: 10000,
  MIN_DESCRIPTION_LENGTH: 50,
  MAX_DESCRIPTION_LENGTH: 160,
  MIN_TITLE_SEO_LENGTH: 10,
  MAX_TITLE_SEO_LENGTH: 60
} as const;

/**
 * Default retry configuration for provider operations
 */
export const RETRY_CONFIG = {
  MAX_RETRIES: 3,
  INITIAL_DELAY_MS: 1000,
  MAX_DELAY_MS: 10000,
  BACKOFF_MULTIPLIER: 2
} as const;

/**
 * Valid content statuses
 */
export const CONTENT_STATUSES = ['draft', 'published', 'archived'] as const;
export type ContentStatusType = typeof CONTENT_STATUSES[number];

/**
 * Valid relationship types
 */
export const RELATIONSHIP_TYPES = ['parent', 'child', 'reference', 'component'] as const;
export type RelationshipType = typeof RELATIONSHIP_TYPES[number];

/**
 * Status transition rules
 */
export const STATUS_TRANSITIONS: Record<ContentStatusType, ContentStatusType[]> = {
  'draft': ['published', 'archived'],
  'published': ['draft', 'archived'],
  'archived': ['draft']
} as const;