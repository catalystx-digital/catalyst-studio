/**
 * Field Validators
 *
 * Validation functions for all field types in the primitive editor system.
 * These are used by editors to validate input before updating values.
 */

import type {
  FieldSchema,
  FieldValidationResult,
  FieldValidator,
} from './types'

// ============================================================================
// Core Validators
// ============================================================================

/**
 * Validate required fields
 */
export function validateRequired(
  value: unknown,
  schema: FieldSchema
): FieldValidationResult {
  if (!schema.required) {
    return { valid: true }
  }

  const isEmpty =
    value === undefined ||
    value === null ||
    value === '' ||
    (Array.isArray(value) && value.length === 0)

  if (isEmpty) {
    return {
      valid: false,
      message: `${schema.label || schema.name} is required`,
      severity: 'error',
    }
  }

  return { valid: true }
}

// ============================================================================
// String Validators
// ============================================================================

/**
 * Validate string length constraints
 */
export function validateStringLength(
  value: unknown,
  schema: FieldSchema
): FieldValidationResult {
  if (typeof value !== 'string') {
    return { valid: true }
  }

  if (schema.minLength !== undefined && value.length < schema.minLength) {
    return {
      valid: false,
      message: `Must be at least ${schema.minLength} characters`,
      severity: 'error',
    }
  }

  if (schema.maxLength !== undefined && value.length > schema.maxLength) {
    return {
      valid: false,
      message: `Must be no more than ${schema.maxLength} characters`,
      severity: 'error',
    }
  }

  return { valid: true }
}

/**
 * Validate string pattern (regex)
 */
export function validatePattern(
  value: unknown,
  schema: FieldSchema
): FieldValidationResult {
  if (typeof value !== 'string' || !schema.pattern) {
    return { valid: true }
  }

  try {
    const regex = new RegExp(schema.pattern)
    if (!regex.test(value)) {
      return {
        valid: false,
        message: schema.patternMessage || 'Invalid format',
        severity: 'error',
      }
    }
  } catch {
    // Invalid regex pattern in schema - skip validation
    return { valid: true }
  }

  return { valid: true }
}

// ============================================================================
// Numeric Validators
// ============================================================================

/**
 * Validate numeric range
 */
export function validateNumericRange(
  value: unknown,
  schema: FieldSchema
): FieldValidationResult {
  if (typeof value !== 'number' || isNaN(value)) {
    return { valid: true }
  }

  if (schema.min !== undefined && value < schema.min) {
    return {
      valid: false,
      message: `Must be at least ${schema.min}`,
      severity: 'error',
    }
  }

  if (schema.max !== undefined && value > schema.max) {
    return {
      valid: false,
      message: `Must be no more than ${schema.max}`,
      severity: 'error',
    }
  }

  return { valid: true }
}

/**
 * Validate integer (no decimals)
 */
export function validateInteger(
  value: unknown,
  schema: FieldSchema
): FieldValidationResult {
  if (schema.type !== 'integer') {
    return { valid: true }
  }

  if (typeof value !== 'number' || !Number.isInteger(value)) {
    return {
      valid: false,
      message: 'Must be a whole number',
      severity: 'error',
    }
  }

  return { valid: true }
}

// ============================================================================
// URL/Email/Phone Validators
// ============================================================================

/**
 * Validate URL format
 */
export function validateUrl(
  value: unknown,
  schema: FieldSchema
): FieldValidationResult {
  if (schema.type !== 'externalUrl' || typeof value !== 'string' || !value) {
    return { valid: true }
  }

  try {
    new URL(value)
    return { valid: true }
  } catch {
    // Try with https:// prefix
    try {
      new URL(`https://${value}`)
      return { valid: true }
    } catch {
      return {
        valid: false,
        message: 'Must be a valid URL',
        severity: 'error',
      }
    }
  }
}

/**
 * Validate email format
 */
export function validateEmail(
  value: unknown,
  schema: FieldSchema
): FieldValidationResult {
  if (schema.type !== 'email' || typeof value !== 'string' || !value) {
    return { valid: true }
  }

  // Basic email regex - not exhaustive but covers most cases
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(value)) {
    return {
      valid: false,
      message: 'Must be a valid email address',
      severity: 'error',
    }
  }

  return { valid: true }
}

/**
 * Validate phone format
 */
export function validatePhone(
  value: unknown,
  schema: FieldSchema
): FieldValidationResult {
  if (schema.type !== 'phone' || typeof value !== 'string' || !value) {
    return { valid: true }
  }

  // Allow digits, spaces, dashes, parentheses, and plus sign
  const phoneRegex = /^[+]?[\d\s\-()]+$/
  if (!phoneRegex.test(value)) {
    return {
      valid: false,
      message: 'Must be a valid phone number',
      severity: 'error',
    }
  }

  return { valid: true }
}

// ============================================================================
// Slug Validator
// ============================================================================

/**
 * Validate slug format (URL-safe)
 */
export function validateSlug(
  value: unknown,
  schema: FieldSchema
): FieldValidationResult {
  if (schema.type !== 'slug' || typeof value !== 'string' || !value) {
    return { valid: true }
  }

  // Slug should only contain lowercase letters, numbers, and hyphens
  const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
  if (!slugRegex.test(value)) {
    return {
      valid: false,
      message: 'Must contain only lowercase letters, numbers, and hyphens',
      severity: 'error',
    }
  }

  return { valid: true }
}

// ============================================================================
// Array Validators
// ============================================================================

/**
 * Validate array length constraints
 */
export function validateArrayLength(
  value: unknown,
  schema: FieldSchema
): FieldValidationResult {
  if (!Array.isArray(value)) {
    return { valid: true }
  }

  if (schema.minItems !== undefined && value.length < schema.minItems) {
    return {
      valid: false,
      message: `Must have at least ${schema.minItems} items`,
      severity: 'error',
    }
  }

  if (schema.maxItems !== undefined && value.length > schema.maxItems) {
    return {
      valid: false,
      message: `Must have no more than ${schema.maxItems} items`,
      severity: 'error',
    }
  }

  return { valid: true }
}

// ============================================================================
// Select Validators
// ============================================================================

/**
 * Validate select value is in options
 */
export function validateSelectOption(
  value: unknown,
  schema: FieldSchema
): FieldValidationResult {
  if (!['select', 'radio'].includes(schema.type) || !schema.options || value === undefined || value === null) {
    return { valid: true }
  }

  const validValues = schema.options.map((opt) => opt.value)
  if (!validValues.includes(value as string | number)) {
    return {
      valid: false,
      message: 'Invalid selection',
      severity: 'error',
    }
  }

  return { valid: true }
}

// ============================================================================
// Composite Validator
// ============================================================================

/**
 * Run all applicable validators for a field
 */
export function validateField(
  value: unknown,
  schema: FieldSchema,
  data: Record<string, unknown> = {}
): FieldValidationResult {
  // List of validators to run based on field type
  const validators: FieldValidator[] = [
    validateRequired,
  ]

  // Add type-specific validators
  switch (schema.type) {
    case 'string':
    case 'text':
    case 'richText':
    case 'markdown':
    case 'code':
      validators.push(validateStringLength, validatePattern)
      break

    case 'slug':
      validators.push(validateSlug)
      break

    case 'number':
      validators.push(validateNumericRange)
      break

    case 'integer':
      validators.push(validateNumericRange, validateInteger)
      break

    case 'externalUrl':
      validators.push(validateUrl)
      break

    case 'email':
      validators.push(validateEmail)
      break

    case 'phone':
      validators.push(validatePhone)
      break

    case 'select':
    case 'radio':
      validators.push(validateSelectOption)
      break

    case 'array':
    case 'componentArray':
      validators.push(validateArrayLength)
      break
  }

  // Run all validators, return first failure
  for (const validator of validators) {
    const result = validator(value, schema, data)
    if (!result.valid) {
      return result
    }
  }

  return { valid: true }
}

/**
 * Validate all fields in a schema array
 */
export function validateFields(
  data: Record<string, unknown>,
  schemas: FieldSchema[]
): Map<string, FieldValidationResult> {
  const results = new Map<string, FieldValidationResult>()

  for (const schema of schemas) {
    const value = data[schema.name]
    const result = validateField(value, schema, data)
    if (!result.valid) {
      results.set(schema.name, result)
    }

    // Recursively validate object fields
    if (schema.type === 'object' && schema.fields && typeof value === 'object' && value !== null) {
      const nestedResults = validateFields(value as Record<string, unknown>, schema.fields)
      for (const [nestedName, nestedResult] of nestedResults) {
        results.set(`${schema.name}.${nestedName}`, nestedResult)
      }
    }

    // Recursively validate array items
    if (schema.type === 'array' && schema.items && Array.isArray(value)) {
      value.forEach((item, index) => {
        if (schema.items!.type === 'object' && schema.items!.fields) {
          const itemResults = validateFields(item as Record<string, unknown>, schema.items!.fields)
          for (const [itemName, itemResult] of itemResults) {
            results.set(`${schema.name}[${index}].${itemName}`, itemResult)
          }
        } else {
          const itemResult = validateField(item, schema.items!, data)
          if (!itemResult.valid) {
            results.set(`${schema.name}[${index}]`, itemResult)
          }
        }
      })
    }
  }

  return results
}
