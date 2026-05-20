/**
 * Output Sanitizer
 *
 * Post-processes AI responses to remove unwanted formatting like JSON blocks,
 * XML tags, and markdown code fences while preserving legitimate content.
 */

export interface SanitizeOptions {
  /** Remove ```json blocks from output */
  stripJsonBlocks?: boolean;
  /** Remove <tag> XML-style content */
  stripXmlTags?: boolean;
  /** Remove ``` code blocks */
  stripCodeBlocks?: boolean;
  /** Keep tool-related content (default: true) */
  preserveToolOutput?: boolean;
  /** Convert markdown to plain text */
  convertToPlainText?: boolean;
}

export interface DetectionResult {
  found: boolean;
  matches: string[];
  positions: Array<{ start: number; end: number }>;
}

/**
 * Default sanitization options for chat responses
 */
export const chatOutputOptions: SanitizeOptions = {
  stripJsonBlocks: true,
  stripXmlTags: true,
  stripCodeBlocks: false, // Keep code if user asks for code
  preserveToolOutput: true,
  convertToPlainText: false,
};

/**
 * Detects JSON blocks in text (both ```json fences and raw { })
 */
export function detectJsonBlocks(text: string): DetectionResult {
  const matches: string[] = [];
  const positions: Array<{ start: number; end: number }> = [];

  // Pattern 1: ```json ... ``` blocks
  const fencedJsonPattern = /```json\s*\n([\s\S]*?)\n```/g;
  let match;

  while ((match = fencedJsonPattern.exec(text)) !== null) {
    matches.push(match[0]);
    positions.push({ start: match.index, end: match.index + match[0].length });
  }

  // Pattern 2: Raw JSON objects { ... } (more conservative, requires newlines)
  // Only match if it looks like standalone JSON, not inline
  const rawJsonPattern = /(?:^|\n)(\{[\s\S]*?\n\})\s*(?:\n|$)/gm;

  while ((match = rawJsonPattern.exec(text)) !== null) {
    const content = match[1];
    // Validate it's likely JSON (has quotes, colons, proper braces)
    if (/["{:]/.test(content) && isBalancedBraces(content)) {
      matches.push(content);
      positions.push({
        start: match.index + match[0].indexOf(content),
        end: match.index + match[0].indexOf(content) + content.length
      });
    }
  }

  return {
    found: matches.length > 0,
    matches,
    positions,
  };
}

/**
 * Detects XML-style tags in text
 */
export function detectXmlTags(text: string): DetectionResult {
  const matches: string[] = [];
  const positions: Array<{ start: number; end: number }> = [];

  // Match XML-style tags: <tag>content</tag>
  // More conservative: only match common tool-related tags
  const xmlPattern = /<([a-zA-Z][a-zA-Z0-9_-]*)[^>]*>([\s\S]*?)<\/\1>/g;
  let match;

  while ((match = xmlPattern.exec(text)) !== null) {
    const tagName = match[1].toLowerCase();

    // Common tool/AI output tags to strip
    const tagsToStrip = [
      'thinking', 'thought', 'reasoning', 'reflection',
      'tool', 'function', 'call', 'result', 'response',
      'analysis', 'plan', 'step', 'note', 'internal'
    ];

    if (tagsToStrip.includes(tagName)) {
      matches.push(match[0]);
      positions.push({ start: match.index, end: match.index + match[0].length });
    }
  }

  return {
    found: matches.length > 0,
    matches,
    positions,
  };
}

/**
 * Detects markdown code blocks (``` fences)
 */
export function detectMarkdownCodeBlocks(text: string): DetectionResult {
  const matches: string[] = [];
  const positions: Array<{ start: number; end: number }> = [];

  // Match ``` code blocks with optional language
  const codeBlockPattern = /```[a-zA-Z0-9]*\s*\n([\s\S]*?)\n```/g;
  let match;

  while ((match = codeBlockPattern.exec(text)) !== null) {
    matches.push(match[0]);
    positions.push({ start: match.index, end: match.index + match[0].length });
  }

  return {
    found: matches.length > 0,
    matches,
    positions,
  };
}

/**
 * Main sanitization function
 */
export function sanitizeOutput(text: string, options: SanitizeOptions = chatOutputOptions): string {
  if (!text || typeof text !== 'string') {
    return text;
  }

  let sanitized = text;

  // Strip JSON blocks
  if (options.stripJsonBlocks) {
    // Remove ```json blocks
    sanitized = sanitized.replace(/```json\s*\n[\s\S]*?\n```/g, '');

    // Remove standalone JSON objects (conservative approach)
    sanitized = sanitized.replace(/(?:^|\n)\{[\s\S]*?\n\}\s*(?:\n|$)/gm, (match) => {
      const content = match.trim();
      // Only remove if it looks like AI metadata/tool output
      if (isLikelyToolJson(content)) {
        return '\n';
      }
      return match;
    });
  }

  // Strip XML tags
  if (options.stripXmlTags) {
    const xmlTags = [
      'thinking', 'thought', 'reasoning', 'reflection',
      'tool', 'function', 'call', 'result', 'response',
      'analysis', 'plan', 'step', 'note', 'internal'
    ];

    xmlTags.forEach(tag => {
      const pattern = new RegExp(`<${tag}[^>]*>[\\s\\S]*?<\\/${tag}>`, 'gi');
      sanitized = sanitized.replace(pattern, '');
    });
  }

  // Strip code blocks (but not JSON if already handled)
  if (options.stripCodeBlocks && !options.stripJsonBlocks) {
    sanitized = sanitized.replace(/```[a-zA-Z0-9]*\s*\n[\s\S]*?\n```/g, '');
  }

  // Convert markdown to plain text
  if (options.convertToPlainText) {
    sanitized = convertMarkdownToPlainText(sanitized);
  }

  // Clean up excessive whitespace
  sanitized = sanitized.replace(/\n{3,}/g, '\n\n');
  sanitized = sanitized.trim();

  return sanitized;
}

/**
 * Helper: Check if braces are balanced
 */
function isBalancedBraces(text: string): boolean {
  let count = 0;
  for (const char of text) {
    if (char === '{') count++;
    if (char === '}') count--;
    if (count < 0) return false;
  }
  return count === 0;
}

/**
 * Helper: Detect if JSON content looks like tool output
 */
function isLikelyToolJson(content: string): boolean {
  const toolIndicators = [
    '"type":', '"tool":', '"function":', '"name":',
    '"result":', '"output":', '"metadata":',
    '"thinking":', '"reasoning":', '"analysis":'
  ];

  return toolIndicators.some(indicator => content.includes(indicator));
}

/**
 * Helper: Convert basic markdown to plain text
 */
function convertMarkdownToPlainText(text: string): string {
  let plain = text;

  // Remove headers
  plain = plain.replace(/^#{1,6}\s+/gm, '');

  // Remove bold/italic
  plain = plain.replace(/(\*\*|__)(.*?)\1/g, '$2');
  plain = plain.replace(/(\*|_)(.*?)\1/g, '$2');

  // Remove links but keep text
  plain = plain.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');

  // Remove images
  plain = plain.replace(/!\[([^\]]*)\]\([^)]+\)/g, '');

  // Remove inline code
  plain = plain.replace(/`([^`]+)`/g, '$1');

  // Remove horizontal rules
  plain = plain.replace(/^[-*_]{3,}\s*$/gm, '');

  // Remove blockquotes
  plain = plain.replace(/^>\s+/gm, '');

  // Remove list markers
  plain = plain.replace(/^[\s]*[-*+]\s+/gm, '');
  plain = plain.replace(/^[\s]*\d+\.\s+/gm, '');

  return plain;
}
