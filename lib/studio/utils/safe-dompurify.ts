type AllowedConfig = {
  ALLOWED_TAGS?: string[];
  ALLOWED_ATTR?: string[];
  ALLOW_DATA_ATTR?: boolean;
  KEEP_CONTENT?: boolean;
};

type SanitizeOptions = AllowedConfig & Record<string, unknown>;

const DEFAULT_ALLOWED_TAGS = [
  'a',
  'abbr',
  'b',
  'blockquote',
  'br',
  'code',
  'em',
  'i',
  'li',
  'ol',
  'p',
  'span',
  'strong',
  'ul',
];

const DEFAULT_ALLOWED_ATTR = ['href', 'title', 'target', 'rel', 'aria-label'];

const URL_ATTRS = new Set(['href', 'src', 'cite']);
const SAFE_URL_PROTOCOLS = new Set(['http', 'https', 'mailto', 'tel']);

const STRIP_CONTENT_TAGS = [
  'script',
  'style',
  'iframe',
  'object',
  'embed',
  'template',
];

function escapeAttribute(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function sanitizeUrlAttribute(name: string, value: string): string | null {
  if (!URL_ATTRS.has(name)) {
    return value;
  }

  const trimmed = value.trim().replace(/[\u0000-\u001F\u007F-\u009F]/g, '');

  if (trimmed.startsWith('//')) {
    return null;
  }

  const protocolMatch = trimmed.match(/^([a-z0-9+.-]+):/i);
  if (!protocolMatch) {
    return trimmed;
  }

  const protocol = protocolMatch[1].toLowerCase();
  if (SAFE_URL_PROTOCOLS.has(protocol)) {
    return trimmed;
  }

  return null;
}

function removeDangerousBlocks(input: string): string {
  let output = input;
  for (const tag of STRIP_CONTENT_TAGS) {
    const pattern = new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?<\\/${tag}>`, 'gi');
    output = output.replace(pattern, '');
  }

  return output.replace(
    /<\/?(script|style|iframe|object|embed|template|meta|link|base)[^>]*>/gi,
    '',
  );
}

function sanitizeAttributes(
  attributesSource: string,
  allowedAttributes: Set<string>,
  allowDataAttr: boolean,
): string {
  const cleaned: string[] = [];
  const attrRegex =
    /([^\s=\/>]+)(?:\s*=\s*(\"([^\"]*)\"|'([^']*)'|([^\s"'>/]+)))?/g;

  let match: RegExpExecArray | null;
  while ((match = attrRegex.exec(attributesSource)) !== null) {
    const rawName = match[1];
    const name = rawName.toLowerCase();

    if (name.startsWith('on')) {
      continue;
    }

    if (!allowedAttributes.has(name)) {
      if (!(allowDataAttr && name.startsWith('data-'))) {
        continue;
      }
    }

    const rawValue = match[3] ?? match[4] ?? match[5] ?? '';
    const sanitizedValue = sanitizeUrlAttribute(name, rawValue);

    if (sanitizedValue === null) {
      continue;
    }

    if (rawValue === '') {
      cleaned.push(name);
    } else {
      cleaned.push(`${name}="${escapeAttribute(sanitizedValue)}"`);
    }
  }

  return cleaned.length ? ` ${cleaned.join(' ')}` : '';
}

function sanitizeHtmlString(
  input: string,
  options?: SanitizeOptions,
): string {
  if (!input) {
    return '';
  }

  const allowedTags = new Set(
    (options?.ALLOWED_TAGS ?? DEFAULT_ALLOWED_TAGS).map((tag) =>
      tag.toLowerCase(),
    ),
  );
  const allowedAttributes = new Set(
    (options?.ALLOWED_ATTR ?? DEFAULT_ALLOWED_ATTR).map((attr) =>
      attr.toLowerCase(),
    ),
  );
  const allowDataAttr = Boolean(options?.ALLOW_DATA_ATTR);

  const stripped = removeDangerousBlocks(input);

  return stripped.replace(/<[^>]+>/gi, (rawTag) => {
    const isClosing = /^<\s*\//.test(rawTag);
    const tagMatch = rawTag.match(/^<\s*\/?\s*([a-z0-9-]+)/i);
    if (!tagMatch) {
      return '';
    }

    const tagName = tagMatch[1].toLowerCase();
    if (!allowedTags.has(tagName)) {
      return '';
    }

    if (isClosing) {
      return `</${tagName}>`;
    }

    const selfClosing = /\/\s*>$/.test(rawTag);
    const attributesSource = rawTag
      .replace(/^<\s*[a-z0-9-]+\s*/i, '')
      .replace(/\/?\s*>$/, '');

    const sanitizedAttributes = sanitizeAttributes(
      attributesSource,
      allowedAttributes,
      allowDataAttr,
    );

    return `<${tagName}${sanitizedAttributes}${selfClosing ? ' />' : '>'}`;
  });
}

export interface SafeDOMPurify {
  sanitize(input: string, options?: SanitizeOptions): string;
}

const DOMPurifyShim: SafeDOMPurify = {
  sanitize(input: string, options?: SanitizeOptions) {
    return sanitizeHtmlString(input, options);
  },
};

export type { SanitizeOptions as DOMPurifyConfig };
export default DOMPurifyShim;
