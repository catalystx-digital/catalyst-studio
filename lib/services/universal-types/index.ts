/**
 * Universal Types Service Layer
 * Provides data loading, validation, and context building for universal type generation
 */

// Data Loaders
export { primitiveTypeLoader } from './primitive-type-loader';
export { databaseTypeLoader, type LoadedContentType } from './database-type-loader';
export { propertyLoader } from './property-loader';
export { universalTypeContextBuilder } from './universal-type-context';
export type { DynamicContext } from './universal-type-context';
export type { UniversalTypeContext } from '../../prompts/types';

// Examples and Templates
export { dynamicExamplesLoader, type TypeExample } from './examples/dynamic-loader';

// Validation Services
export {
  contentTypeValidator,
  confidenceScorer,
  checkDuplicateFieldName,
  validateFieldName,
  validateContentTypeName,
  type ValidationResult,
  type ValidationError,
  type ValidationWarning,
  type ValidationSuggestion,
  type DuplicateCheckResult,
  type ContentTypeDefinition,
  type ConfidenceScore,
  type ConfidenceThreshold
} from './validation';

// Import validation utilities for local use
import { validateFieldName, checkDuplicateFieldName } from './validation';

/**
 * Initialize all services for a website
 */
export async function initializeUniversalTypeServices(websiteId: string): Promise<void> {
  const { contentTypeValidator } = await import('./validation/validator');
  const { confidenceScorer } = await import('./validation/confidence-scorer');
  const { databaseTypeLoader } = await import('./database-type-loader');
  
  // Initialize services with website context
  await contentTypeValidator.initialize(websiteId);
  await confidenceScorer.initialize(websiteId);
  databaseTypeLoader.setWebsiteContext(websiteId);
}

/**
 * Quick validation for UI components
 */
export async function validateContentTypeField(
  fieldName: string,
  fieldType: string,
  existingFields: Array<{ name: string }>
): Promise<{ valid: boolean; errors: string[] }> {
  const errors: string[] = [];
  
  // Check field name format
  const nameValidation = validateFieldName(fieldName);
  if (!nameValidation.valid && nameValidation.error) {
    errors.push(nameValidation.error);
  }
  
  // Check for duplicates
  if (checkDuplicateFieldName(fieldName, existingFields)) {
    errors.push(`Field "${fieldName}" already exists`);
  }
  
  // Check if field type is valid
  const { primitiveTypeLoader } = await import('./primitive-type-loader');
  const validTypes = await primitiveTypeLoader.loadAllPrimitiveTypes();
  const validTypeNames = validTypes.map(t => t.name);
  
  if (!validTypeNames.includes(fieldType)) {
    errors.push(`Invalid field type "${fieldType}". Must be one of: ${validTypeNames.join(', ')}`);
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}