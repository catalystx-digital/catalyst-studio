/**
 * Safe JSON parsing utilities to prevent crashes from malformed JSON
 */

/**
 * Safely parse JSON with error handling
 * @param jsonString - The JSON string to parse
 * @param fallback - Optional fallback value if parsing fails
 * @returns Parsed object or fallback value
 */
export function safeJsonParse<T = unknown>(
  jsonString: string | null | undefined,
  fallback: T | null = null
): T | null {
  if (!jsonString) {
    return fallback;
  }

  try {
    return JSON.parse(jsonString) as T;
  } catch (error) {
    console.error('JSON parsing error:', error);
    return fallback;
  }
}

/**
 * Safely stringify JSON with error handling
 * @param obj - The object to stringify
 * @param space - Optional formatting space
 * @returns JSON string or empty string on error
 */
export function safeJsonStringify(
  obj: unknown,
  space?: string | number
): string {
  try {
    return JSON.stringify(obj, null, space);
  } catch (error) {
    console.error('JSON stringify error:', error);
    return '';
  }
}

/**
 * Parse JSON with validation against a schema
 * @param jsonString - The JSON string to parse
 * @param validator - Optional validation function
 * @returns Parsed and validated object or null
 */
export function parseAndValidate<T>(
  jsonString: string,
  validator?: (data: unknown) => data is T
): T | null {
  const parsed = safeJsonParse(jsonString);
  
  if (!parsed) {
    return null;
  }

  if (validator && !validator(parsed)) {
    console.error('JSON validation failed');
    return null;
  }

  return parsed as T;
}