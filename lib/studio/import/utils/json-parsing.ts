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

export function parseFirstJsonValue(input: string, onTrailingCharacters?: (count: number) => void): unknown {
  const source = input.trimStart()
  if (source[0] !== '{' && source[0] !== '[') return JSON.parse(input)

  let depth = 0
  let inString = false
  let escapeNext = false
  for (let i = 0; i < source.length; i++) {
    const char = source[i]
    if (inString) {
      if (escapeNext) escapeNext = false
      else if (char === '\\') escapeNext = true
      else if (char === '"') inString = false
      continue
    }
    if (char === '"') inString = true
    else if (char === '{' || char === '[') depth++
    else if (char === '}' || char === ']') {
      depth--
      if (depth === 0) {
        const value = JSON.parse(source.slice(0, i + 1))
        if (source.slice(i + 1).trim()) onTrailingCharacters?.(source.length - i - 1)
        return value
      }
    }
  }
  return JSON.parse(input)
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

/**
 * Result of salvaging a response the model cut off mid-JSON.
 */
export interface TruncatedJsonSalvage {
  /** Re-closed JSON text, parseable by JSON.parse */
  text: string
  /** Number of container levels that had to be closed artificially */
  closedContainers: number
  /**
   * Characters dropped from the end of the REPLY THAT ARRIVED — the element the
   * model was still writing. This is not a measure of how much content was
   * lost: the rest of the document never arrived, so it cannot be counted. It
   * is a log detail, not a quality signal, and nothing decides on it.
   */
  droppedChars: number
}

/**
 * Re-closes a JSON document that stops part-way through, keeping every element
 * the model actually finished and discarding the one it was still writing.
 *
 * Why this exists: detection sends one DOM section per request and the reply is
 * a single JSON object. Providers do not always report a cut-off reply as
 * finish_reason="length" — one site's footer came back with unclosed brackets
 * and finish_reason="stop" against a 90,000-token cap on a 6,486-byte section,
 * so the cap was never the constraint and retrying the same request does not
 * help. Without this, every component the reply did finish was thrown away
 * along with the half-written one.
 *
 * Only elements the model finished are kept. The cut is taken at the outermost
 * array that closed at least one element, so a unit that was still being
 * written is dropped whole rather than re-closed with whatever fraction of its
 * content had arrived.
 *
 * Returns null when the input is not truncated (nothing open at the end) — a
 * document that merely fails to parse is a syntax error, not a cut-off, and
 * must keep surfacing as one — and when the cut-off left no finished element
 * at the outermost repetition level, which means nothing is recoverable.
 *
 * @param input - Raw model response
 * @returns Salvage result, or null when there is nothing to salvage
 *
 * @example
 * salvageTruncatedJson('{"items":[{"a":1},{"a"')
 * // { text: '{"items":[{"a":1}]}', closedContainers: 2, droppedChars: 5 }
 */
export function salvageTruncatedJson(input: string): TruncatedJsonSalvage | null {
  if (!input) return null
  const source = input.trim()
  if (!source) return null

  type Frame = { closer: '}' | ']'; openIndex: number; lastComplete: number }
  const stack: Frame[] = []
  let inString = false
  let escapeNext = false

  for (let i = 0; i < source.length; i++) {
    const char = source[i]

    if (escapeNext) {
      escapeNext = false
      continue
    }
    if (inString) {
      if (char === '\\') escapeNext = true
      else if (char === '"') inString = false
      continue
    }
    if (char === '"') {
      inString = true
      continue
    }

    if (char === '{' || char === '[') {
      stack.push({ closer: char === '{' ? '}' : ']', openIndex: i, lastComplete: i + 1 })
      continue
    }
    if (char === '}' || char === ']') {
      stack.pop()
      // The value that just closed is complete, so its parent is complete up to here.
      const parent = stack[stack.length - 1]
      if (parent) parent.lastComplete = i + 1
      continue
    }
    if (char === ',') {
      const top = stack[stack.length - 1]
      // Everything before the separator is a finished element; the comma itself
      // is not, because what follows it may be the truncated tail.
      if (top) top.lastComplete = i
    }
  }

  if (stack.length === 0) return null

  const hasFinishedMember = (frame: Frame) => frame.lastComplete > frame.openIndex + 1

  // Cut at the OUTERMOST array that finished at least one element.
  //
  // Arrays are where the repeated units live — components, links, cards, menu
  // items — and an element that closed on its own is one the model actually
  // finished writing. Descending past the outermost array to a deeper one keeps
  // the unit that was still in flight, re-closed as an object missing most of
  // its keys, and hands it downstream as if it were whole. Measured on
  // realistic replies: a 20-link navbar cut at link 3 re-closes to a navbar
  // with 2 links, and a footer cut inside its logo re-closes to links with no
  // logo. Both keep every byte that arrived except the half-written tail, so
  // the size of that tail (droppedChars: 5% and 10% of the reply here) cannot
  // detect the damage — the content that was lost never arrived to be counted.
  // What can be checked exactly is the structural fact that the unit never
  // closed, so that is what this bounds.
  //
  // When the outermost array finished nothing, every repeated unit in the
  // document was still in flight and there is nothing to salvage. Documents
  // with no array in flight fall back to the deepest object that finished a
  // member; those carry no repeated units, so no unit can be kept half-built.
  const firstArrayDepth = stack.findIndex(frame => frame.closer === ']')
  let cutFrame: number
  if (firstArrayDepth !== -1) {
    if (!hasFinishedMember(stack[firstArrayDepth])) return null
    cutFrame = firstArrayDepth
  } else {
    const deepestObject = stack
      .map((frame, depth) => ({ frame, depth }))
      .filter(entry => hasFinishedMember(entry.frame))
      .pop()
    if (!deepestObject) return null
    cutFrame = deepestObject.depth
  }

  const closers = stack
    .slice(0, cutFrame + 1)
    .map(frame => frame.closer)
    .reverse()
    .join('')
  const text = `${source.slice(0, stack[cutFrame].lastComplete)}${closers}`

  // Strict parse only: sanitizing fallbacks would hide a salvage that did not work.
  try {
    JSON.parse(text)
  } catch {
    return null
  }

  return {
    text,
    closedContainers: closers.length,
    droppedChars: source.length - stack[cutFrame].lastComplete
  }
}
