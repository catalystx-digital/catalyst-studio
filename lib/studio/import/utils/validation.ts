export const MAX_JSON_SIZE = 52428800 // 50MB in bytes - increased to support large multi-page imports (9000+ pages)
export const MAX_JSON_DEPTH = 5
const MAX_IMPORT_JSON_DEPTH = 20 // Higher limit for import detection results with nested components

/**
 * Calculates the size of a JSON object in bytes
 */
export function getJSONSizeInBytes(data: unknown): number {
  const jsonStr = JSON.stringify(data)
  return Buffer.byteLength(jsonStr, 'utf8')
}

/**
 * Validates that JSON data doesn't exceed the size limit
 */
export function validateJSONSize(data: unknown): boolean {
  return getJSONSizeInBytes(data) <= MAX_JSON_SIZE
}

/**
 * Validates JSON depth doesn't exceed maximum allowed depth
 */
export function validateJSONDepth(obj: unknown, depth = 0): boolean {
  if (depth > MAX_JSON_DEPTH) return false
  
  if (obj === null || typeof obj !== 'object') {
    return true
  }
  
  if (Array.isArray(obj)) {
    for (const item of obj) {
      if (!validateJSONDepth(item, depth + 1)) {
        return false
      }
    }
  } else {
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        if (!validateJSONDepth((obj as Record<string, unknown>)[key], depth + 1)) {
          return false
        }
      }
    }
  }
  
  return true
}

/**
 * Validates both size and depth of JSON data
 */
export function validateJSON(data: unknown): { valid: boolean; error?: string } {
  // Check size
  const sizeInBytes = getJSONSizeInBytes(data)
  if (sizeInBytes > MAX_JSON_SIZE) {
    return {
      valid: false,
      error: `JSON size (${sizeInBytes} bytes) exceeds maximum allowed size (${MAX_JSON_SIZE} bytes)`
    }
  }
  
  // Check depth
  if (!validateJSONDepth(data)) {
    return {
      valid: false,
      error: `JSON depth exceeds maximum allowed depth (${MAX_JSON_DEPTH})`
    }
  }
  
  return { valid: true }
}

/**
 * Validates both size and depth of import detection results JSON data (higher depth limit)
 */
export function validateImportJSON(data: unknown): { valid: boolean; error?: string } {
  // Check size
  const sizeInBytes = getJSONSizeInBytes(data)
  if (sizeInBytes > MAX_JSON_SIZE) {
    return {
      valid: false,
      error: `JSON size (${sizeInBytes} bytes) exceeds maximum allowed size (${MAX_JSON_SIZE} bytes)`
    }
  }
  
  // Check depth with higher limit for import data
  if (!validateJSONDepthWithLimit(data, MAX_IMPORT_JSON_DEPTH)) {
    return {
      valid: false,
      error: `JSON depth exceeds maximum allowed depth (${MAX_IMPORT_JSON_DEPTH})`
    }
  }
  
  return { valid: true }
}

/**
 * Validates JSON depth doesn't exceed specified maximum depth
 */
function validateJSONDepthWithLimit(obj: unknown, maxDepth: number, depth = 0): boolean {
  if (depth > maxDepth) return false
  
  if (obj === null || typeof obj !== 'object') {
    return true
  }
  
  if (Array.isArray(obj)) {
    for (const item of obj) {
      if (!validateJSONDepthWithLimit(item, maxDepth, depth + 1)) {
        return false
      }
    }
  } else {
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        if (!validateJSONDepthWithLimit((obj as Record<string, unknown>)[key], maxDepth, depth + 1)) {
          return false
        }
      }
    }
  }
  
  return true
}

/**
 * Formats bytes into human-readable format
 */
export function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === 0) return '0 Bytes'
  
  const k = 1024
  const dm = decimals < 0 ? 0 : decimals
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`
}
