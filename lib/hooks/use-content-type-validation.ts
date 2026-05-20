/**
 * React Hook for Content Type Validation
 * Provides real-time validation for content type forms
 */

import { useState, useCallback, useEffect } from 'react';
import { 
  checkDuplicateFieldName,
  validateFieldName,
  validateContentTypeName,
  validateContentTypeField
} from '@/lib/services/universal-types/client';

export interface FieldValidationError {
  field: string;
  message: string;
}

export interface UseContentTypeValidationOptions {
  existingFields?: Array<{ name: string }>;
  existingContentTypes?: Array<{ name: string }>;
  validateOnChange?: boolean;
}

export function useContentTypeValidation(options: UseContentTypeValidationOptions = {}) {
  const { 
    existingFields = [], 
    existingContentTypes = [],
    validateOnChange = true 
  } = options;

  const [errors, setErrors] = useState<FieldValidationError[]>([]);
  const [warnings, setWarnings] = useState<FieldValidationError[]>([]);

  /**
   * Validate content type name
   */
  const validateTypeName = useCallback((name: string): boolean => {
    const validation = validateContentTypeName(name);
    
    if (!validation.valid) {
      setErrors(prev => [
        ...prev.filter(e => e.field !== 'typeName'),
        { field: 'typeName', message: validation.error || 'Invalid type name' }
      ]);
      return false;
    }

    // Check for duplicate content types
    const isDuplicate = existingContentTypes.some(
      ct => ct.name.toLowerCase() === name.toLowerCase()
    );

    if (isDuplicate) {
      setErrors(prev => [
        ...prev.filter(e => e.field !== 'typeName'),
        { field: 'typeName', message: `Content type "${name}" already exists` }
      ]);
      return false;
    }

    // Clear errors for this field
    setErrors(prev => prev.filter(e => e.field !== 'typeName'));
    return true;
  }, [existingContentTypes]);

  /**
   * Validate field name
   */
  const validateField = useCallback((fieldName: string, fieldIndex?: string | number): boolean => {
    const fieldKey = fieldIndex !== undefined ? `field_${fieldIndex}` : `field_${fieldName}`;
    
    // Validate field name format
    const validation = validateFieldName(fieldName);
    
    if (!validation.valid) {
      setErrors(prev => [
        ...prev.filter(e => e.field !== fieldKey),
        { field: fieldKey, message: validation.error || 'Invalid field name' }
      ]);
      return false;
    }

    // Check for duplicate field names
    const isDuplicate = checkDuplicateFieldName(fieldName, existingFields);
    
    if (isDuplicate) {
      setErrors(prev => [
        ...prev.filter(e => e.field !== fieldKey),
        { field: fieldKey, message: `Field "${fieldName}" already exists` }
      ]);
      return false;
    }

    // Clear errors for this field
    setErrors(prev => prev.filter(e => e.field !== fieldKey));
    return true;
  }, [existingFields]);

  /**
   * Validate complete field with type
   */
  const validateCompleteField = useCallback(async (
    fieldName: string,
    fieldType: string,
    fieldIndex?: string | number
  ): Promise<boolean> => {
    const fieldKey = fieldIndex !== undefined ? `field_${fieldIndex}` : `field_${fieldName}`;
    
    try {
      const validation = await validateContentTypeField(
        fieldName,
        fieldType,
        existingFields
      );

      if (!validation.valid) {
        setErrors(prev => [
          ...prev.filter(e => e.field !== fieldKey),
          ...validation.errors.map(err => ({
            field: fieldKey,
            message: err
          }))
        ]);
        return false;
      }

      // Clear errors for this field
      setErrors(prev => prev.filter(e => e.field !== fieldKey));
      return true;
    } catch (error) {
      console.error('Field validation error:', error);
      return false;
    }
  }, [existingFields]);

  /**
   * Validate all fields
   */
  const validateAllFields = useCallback(async (
    fields: Array<{ name: string; type: string }>
  ): Promise<boolean> => {
    const fieldErrors: FieldValidationError[] = [];
    const fieldNames = new Set<string>();

    for (let i = 0; i < fields.length; i++) {
      const field = fields[i];
      
      // Check field name format
      const nameValidation = validateFieldName(field.name);
      if (!nameValidation.valid) {
        fieldErrors.push({
          field: `field_${i}`,
          message: nameValidation.error || 'Invalid field name'
        });
      }

      // Check for duplicates within the form
      if (fieldNames.has(field.name.toLowerCase())) {
        fieldErrors.push({
          field: `field_${i}`,
          message: `Duplicate field name: ${field.name}`
        });
      }
      fieldNames.add(field.name.toLowerCase());

      // Validate field type
      const validation = await validateContentTypeField(
        field.name,
        field.type,
        existingFields
      );

      if (!validation.valid) {
        validation.errors.forEach(err => {
          fieldErrors.push({
            field: `field_${i}`,
            message: err
          });
        });
      }
    }

    setErrors(fieldErrors);
    return fieldErrors.length === 0;
  }, [existingFields]);

  /**
   * Clear all errors
   */
  const clearErrors = useCallback(() => {
    setErrors([]);
    setWarnings([]);
  }, []);

  /**
   * Clear errors for a specific field
   */
  const clearFieldError = useCallback((fieldKey: string) => {
    setErrors(prev => prev.filter(e => e.field !== fieldKey));
    setWarnings(prev => prev.filter(w => w.field !== fieldKey));
  }, []);

  /**
   * Get error for a specific field
   */
  const getFieldError = useCallback((fieldKey: string): string | undefined => {
    const error = errors.find(e => e.field === fieldKey);
    return error?.message;
  }, [errors]);

  /**
   * Get warning for a specific field
   */
  const getFieldWarning = useCallback((fieldKey: string): string | undefined => {
    const warning = warnings.find(w => w.field === fieldKey);
    return warning?.message;
  }, [warnings]);

  return {
    errors,
    warnings,
    validateTypeName,
    validateField,
    validateCompleteField,
    validateAllFields,
    clearErrors,
    clearFieldError,
    getFieldError,
    getFieldWarning,
    hasErrors: errors.length > 0,
    hasWarnings: warnings.length > 0
  };
}

export default useContentTypeValidation;