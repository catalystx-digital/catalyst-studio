/**
 * Migrations Module - Barrel Export
 *
 * Data migration utilities for converting existing values to new formats.
 */

// Link value migration
export {
  detectLinkType,
  migrateLinkValue,
  migrateLinkValuesInObject,
  linkValueToString,
  validateLinkValue,
  type PageLookupResult,
  type LinkMigrationOptions,
  type LinkMigrationResult,
} from './link-value-migration'

// Media value migration
export {
  isMediaLibraryUrl,
  detectMediaType,
  extractFilename,
  migrateImageValue,
  migrateFileValue,
  migrateVideoValue,
  migrateMediaValuesInObject,
  mediaValueToString,
  validateMediaImageValue,
  type MediaLookupResult,
  type MediaMigrationOptions,
  type MediaMigrationResult,
} from './media-value-migration'
