/**
 * JSON Parsing Utilities
 *
 * Centralized JSON extraction and sanitization for LLM responses.
 * Extracted from detection/response-parser.ts for broader use.
 *
 * @module json-parsing
 */

/**
 * Result of JSON extraction attempt.
 */
export interface JsonExtractionResult<T = unknown> {
  /** Whether extraction was successful */
  success: boolean

  /** Extracted and parsed value */
  value?: T

  /** Raw extracted string before parsing */
  rawString?: string

  /** Error message if extraction failed */
  error?: string
}

/**
 * Sanitizes a string for JSON parsing by normalizing quotes and removing code blocks.
 *
 * @param input - Raw string to sanitize
 * @returns Sanitized string ready for JSON extraction
 *
 * @example
 * sanitizeForJson('```json\n{"key": "value"}\n```')
 * // '{"key": "value"}'
 */
export function sanitizeForJson(input: string): string {
  if (!input) return ''

  let s = input.trim()

  // Remove markdown code blocks
  s = s.replace(/```json\s*/gi, '')
  s = s.replace(/```\w*\s*/gi, '')
  s = s.replace(/```/g, '')

  // Normalize smart quotes to standard quotes
  s = s.replace(/[""]/g, '"')
  s = s.replace(/['']/g, "'")

  // Remove any remaining backticks
  s = s.replace(/`+/g, '')

  return s
}

/**
 * Extracts and sanitizes a JSON array from a string.
 *
 * @param input - String containing a JSON array
 * @returns Extracted array string or null if not found
 *
 * @example
 * extractJsonArray('Here is the data: [1, 2, 3]')
 * // '[1, 2, 3]'
 */
export function extractJsonArray(input: string): string | null {
  try {
    const s = sanitizeForJson(input)

    const start = s.indexOf('[')
    const end = s.lastIndexOf(']')

    if (start === -1 || end === -1 || end < start) {
      return null
    }

    return s.slice(start, end + 1)
  } catch {
    return null
  }
}

/**
 * Extracts and sanitizes a JSON object from a string.
 *
 * @param input - String containing a JSON object
 * @returns Extracted object string or null if not found
 *
 * @example
 * extractJsonObject('Here is the data: {"key": "value"}')
 * // '{"key": "value"}'
 */
export function extractJsonObject(input: string): string | null {
  try {
    const s = sanitizeForJson(input)

    const start = s.indexOf('{')
    const end = s.lastIndexOf('}')

    if (start === -1 || end === -1 || end < start) {
      return null
    }

    return s.slice(start, end + 1)
  } catch {
    return null
  }
}

/**
 * Extracts a JSON array that appears after a specific key in the text.
 * Useful for parsing responses like: "components: [...]"
 *
 * @param input - String to search
 * @param key - Key to look for before the array
 * @returns Extracted array string or null if not found
 *
 * @example
 * extractArrayAfterKey('{"components": [1, 2], "other": [3]}', 'components')
 * // '[1, 2]'
 */
export function extractArrayAfterKey(input: string, key: string): string | null {
  try {
    const s = sanitizeForJson(input)

    // Look for key followed by optional whitespace, colon, optional whitespace, then array
    const patterns = [
      new RegExp(`"${key}"\\s*:\\s*\\[`, 'i'),
      new RegExp(`${key}\\s*:\\s*\\[`, 'i')
    ]

    for (const pattern of patterns) {
      const match = s.match(pattern)
      if (match && match.index !== undefined) {
        const arrayStart = s.indexOf('[', match.index)
        if (arrayStart === -1) continue

        // Find matching closing bracket
        let depth = 0
        for (let i = arrayStart; i < s.length; i++) {
          if (s[i] === '[') depth++
          if (s[i] === ']') depth--
          if (depth === 0) {
            return s.slice(arrayStart, i + 1)
          }
        }
      }
    }

    return null
  } catch {
    return null
  }
}

/**
 * Safely parses a JSON string, returning undefined on failure.
 *
 * @param input - JSON string to parse
 * @returns Parsed value or undefined
 *
 * @example
 * safeJsonParse('{"key": "value"}') // { key: 'value' }
 * safeJsonParse('invalid') // undefined
 */
export function safeJsonParse<T = unknown>(input: string): T | undefined {
  try {
    return JSON.parse(input) as T
  } catch {
    return undefined
  }
}

/**
 * Attempts to parse JSON from various formats in a string.
 * Tries multiple extraction strategies in order of reliability.
 *
 * @param input - String potentially containing JSON
 * @returns Extraction result with success status
 *
 * @example
 * const result = tryParseJson('```json\n{"key": "value"}\n```')
 * if (result.success) {
 *   console.log(result.value)
 * }
 */
export function tryParseJson<T = unknown>(input: string): JsonExtractionResult<T> {
  if (!input) {
    return { success: false, error: 'Empty input' }
  }

  // Try 1: Direct parse after sanitization
  const sanitized = sanitizeForJson(input)
  try {
    const value = JSON.parse(sanitized) as T
    return { success: true, value, rawString: sanitized }
  } catch {
    // Continue to other strategies
  }

  // Try 2: Extract and parse object
  const objString = extractJsonObject(input)
  if (objString) {
    try {
      const value = JSON.parse(objString) as T
      return { success: true, value, rawString: objString }
    } catch {
      // Continue to array extraction
    }
  }

  // Try 3: Extract and parse array
  const arrString = extractJsonArray(input)
  if (arrString) {
    try {
      const value = JSON.parse(arrString) as T
      return { success: true, value, rawString: arrString }
    } catch {
      // Continue to error
    }
  }

  return { success: false, error: 'Failed to extract valid JSON' }
}

/**
 * Extracts all valid JSON objects from a string containing multiple objects.
 * Useful for parsing streaming responses or logs.
 *
 * @param input - String containing multiple JSON objects
 * @returns Array of parsed objects
 *
 * @example
 * extractAllJsonObjects('{"a":1} some text {"b":2}')
 * // [{ a: 1 }, { b: 2 }]
 */
export function extractAllJsonObjects<T = unknown>(input: string): T[] {
  const results: T[] = []
  const s = sanitizeForJson(input)

  let pos = 0
  while (pos < s.length) {
    const start = s.indexOf('{', pos)
    if (start === -1) break

    // Find matching closing brace
    let depth = 0
    let end = -1

    for (let i = start; i < s.length; i++) {
      if (s[i] === '{') depth++
      if (s[i] === '}') depth--
      if (depth === 0) {
        end = i
        break
      }
    }

    if (end === -1) break

    const objStr = s.slice(start, end + 1)
    try {
      const obj = JSON.parse(objStr) as T
      results.push(obj)
    } catch {
      // Skip invalid JSON
    }

    pos = end + 1
  }

  return results
}

/**
 * Extracts tuple-style items from LLM responses.
 * Handles format: ["type", confidence, {content}]
 *
 * @param input - String containing tuple arrays
 * @returns Array of extracted items
 *
 * @example
 * extractTupleItems('["hero", 0.9, {"title": "Hello"}]')
 * // [{ type: 'hero', confidence: 0.9, content: { title: 'Hello' } }]
 */
export function extractTupleItems(input: string): Array<{
  type: string
  confidence: number
  content: Record<string, unknown>
}> {
  const items: Array<{
    type: string
    confidence: number
    content: Record<string, unknown>
  }> = []

  try {
    const s = sanitizeForJson(input)

    // Match pattern: ["type", number, {...}]
    const pattern = /\[\s*"([^"]+)"\s*,\s*([0-9]+(?:\.[0-9]+)?)\s*,\s*(\{[\s\S]*?\})\s*\]/g
    let match: RegExpExecArray | null

    while ((match = pattern.exec(s)) !== null) {
      const [, type, confidenceStr, contentStr] = match
      const confidence = parseFloat(confidenceStr)

      try {
        const content = JSON.parse(contentStr) as Record<string, unknown>
        items.push({ type, confidence, content })
      } catch {
        // Skip invalid content JSON
      }
    }
  } catch {
    // Return empty array on failure
  }

  return items
}

/**
 * Safely stringifies a value, handling circular references.
 *
 * @param value - Value to stringify
 * @param space - Indentation space (default: 2)
 * @returns JSON string or error message
 *
 * @example
 * safeStringify({ key: 'value' }) // '{\n  "key": "value"\n}'
 */
export function safeStringify(value: unknown, space: number = 2): string {
  const seen = new WeakSet()

  try {
    return JSON.stringify(
      value,
      (_, val) => {
        if (typeof val === 'object' && val !== null) {
          if (seen.has(val)) {
            return '[Circular]'
          }
          seen.add(val)
        }
        return val
      },
      space
    )
  } catch (error) {
    return `[Unserializable: ${error instanceof Error ? error.message : 'unknown error'}]`
  }
}

/**
 * Deep clones a JSON-serializable value.
 *
 * @param value - Value to clone
 * @returns Cloned value or undefined if not serializable
 *
 * @example
 * const clone = deepClone({ a: { b: 1 } })
 */
export function deepClone<T>(value: T): T | undefined {
  try {
    return JSON.parse(JSON.stringify(value)) as T
  } catch {
    return undefined
  }
}

/**
 * Checks if a string contains valid JSON.
 *
 * @param input - String to check
 * @returns True if string contains valid JSON
 *
 * @example
 * isValidJson('{"key": "value"}') // true
 * isValidJson('not json') // false
 */
export function isValidJson(input: string): boolean {
  return tryParseJson(input).success
}
