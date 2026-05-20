/**
 * Schema Module - Barrel Export
 *
 * Exports all schema types, utilities, and migration functions.
 */

// Core types
export * from './types'

// Migration utilities
export {
  migratePropsMeta,
  batchMigratePropsMeta,
  generateSchemaCode,
  validateMigratedSchema,
  type PropertyMeta,
  type PropsMeta,
  type MigrationResult,
  type MigrationWarning,
} from './migrate-propsmeta'

// Validators
export {
  validateRequired,
  validateStringLength,
  validatePattern,
  validateNumericRange,
  validateInteger,
  validateUrl,
  validateEmail,
  validatePhone,
  validateSlug,
  validateArrayLength,
  validateSelectOption,
  validateField,
  validateFields,
} from './validators'
