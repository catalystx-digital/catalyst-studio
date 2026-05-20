/**
 * Input Sanitization Utilities
 * Provides security functions to sanitize user input
 */

/**
 * Sanitize type name to prevent injection attacks
 */
export function sanitizeTypeName(name: string): string {
  if (!name || typeof name !== 'string') {
    throw new Error('Type name must be a non-empty string');
  }

  // Remove any characters that aren't alphanumeric or underscore
  const sanitized = name.replace(/[^a-zA-Z0-9_]/g, '');
  
  // Ensure it starts with a letter
  if (!/^[A-Z]/.test(sanitized)) {
    throw new Error('Type name must start with an uppercase letter');
  }
  
  // Ensure it follows PascalCase
  if (!/^[A-Z][a-zA-Z0-9]*$/.test(sanitized)) {
    throw new Error('Type name must be in PascalCase (e.g., BlogPost)');
  }
  
  // Length validation
  if (sanitized.length < 2 || sanitized.length > 50) {
    throw new Error('Type name must be between 2 and 50 characters');
  }
  
  return sanitized;
}

/**
 * Sanitize field name to prevent injection
 */
export function sanitizeFieldName(name: string): string {
  if (!name || typeof name !== 'string') {
    throw new Error('Field name must be a non-empty string');
  }

  // Remove any characters that aren't alphanumeric or underscore
  const sanitized = name.replace(/[^a-zA-Z0-9_]/g, '');
  
  // Ensure it starts with a lowercase letter
  if (!/^[a-z]/.test(sanitized)) {
    throw new Error('Field name must start with a lowercase letter');
  }
  
  // Ensure it follows camelCase
  if (!/^[a-z][a-zA-Z0-9]*$/.test(sanitized)) {
    throw new Error('Field name must be in camelCase (e.g., fieldName)');
  }
  
  // Length validation
  if (sanitized.length < 1 || sanitized.length > 50) {
    throw new Error('Field name must be between 1 and 50 characters');
  }
  
  return sanitized;
}

/**
 * Sanitize user input for general text fields
 */
export function sanitizeTextInput(input: string): string {
  if (typeof input !== 'string') {
    return '';
  }
  
  // Remove control characters and trim
  return input
    .replace(/[\x00-\x1F\x7F]/g, '') // Remove control characters
    .replace(/[<>]/g, '') // Remove angle brackets to prevent HTML injection
    .trim()
    .substring(0, 1000); // Limit length
}

/**
 * Validate and sanitize website ID
 */
export function sanitizeWebsiteId(id: string): string {
  if (!id || typeof id !== 'string') {
    throw new Error('Website ID must be a non-empty string');
  }
  
  // Allow alphanumeric, hyphens, and underscores only
  const sanitized = id.replace(/[^a-zA-Z0-9\-_]/g, '');
  
  if (sanitized.length < 1 || sanitized.length > 100) {
    throw new Error('Website ID must be between 1 and 100 characters');
  }
  
  return sanitized;
}

/**
 * Sanitize path components to prevent directory traversal
 */
export function sanitizePathComponent(component: string): string {
  if (!component || typeof component !== 'string') {
    throw new Error('Path component must be a non-empty string');
  }
  
  // Remove any path traversal attempts
  const sanitized = component
    .replace(/\.\./g, '') // Remove ..
    .replace(/[\/\\]/g, '') // Remove slashes
    .replace(/^\.+/, '') // Remove leading dots
    .replace(/\0/g, ''); // Remove null bytes
  
  if (sanitized.length === 0) {
    throw new Error('Invalid path component after sanitization');
  }
  
  return sanitized;
}