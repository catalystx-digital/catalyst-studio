/**
 * Slug Manager - Core slug generation utilities for site structure
 * Converts titles to URL-safe slugs following SEO best practices
 */

/**
 * Reserved slugs that cannot be used for site structure pages
 * These are typically system routes or reserved paths
 */
export const RESERVED_SLUGS = [
  'api',
  'admin',
  'static',
  '_next',
  'public',
  'favicon.ico',
  'robots.txt',
  'sitemap.xml'
] as const;

export type ReservedSlug = typeof RESERVED_SLUGS[number];

export interface SlugOptions {
  maxLength?: number;
  lowercase?: boolean;
  trim?: boolean;
}

/**
 * Generates a URL-safe slug from a title string
 * @param title - The title to convert to a slug
 * @param options - Optional configuration for slug generation
 * @returns A URL-safe slug string
 * 
 * @example
 * generateSlug("Hello World!") // returns "hello-world"
 * generateSlug("Products & Services") // returns "products-services"
 * generateSlug("2024 Annual Report") // returns "2024-annual-report"
 */
export function generateSlug(title: string, options: SlugOptions = {}): string {
  const { 
    maxLength = 255,
    lowercase = true,
    trim = true 
  } = options;

  if (!title || typeof title !== 'string') {
    return '';
  }

  let slug = title;

  // Convert to lowercase if specified
  if (lowercase) {
    slug = slug.toLowerCase();
  }

  // Replace accented characters with their non-accented equivalents
  slug = slug.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  // Replace spaces and special characters with hyphens
  slug = slug.replace(/[^a-z0-9]+/gi, '-');

  // Remove consecutive hyphens
  slug = slug.replace(/-+/g, '-');

  // Trim hyphens from start and end if specified
  if (trim) {
    slug = slug.replace(/^-+|-+$/g, '');
  }

  // Enforce max length
  if (slug.length > maxLength) {
    slug = slug.substring(0, maxLength);
    // Remove trailing hyphen if truncation created one
    if (trim) {
      slug = slug.replace(/-+$/g, '');
    }
  }

  return slug;
}

/**
 * Sanitizes an existing slug to ensure it follows URL-safe patterns
 * @param slug - The slug to sanitize
 * @returns A sanitized slug string
 */
export function sanitizeSlug(slug: string): string {
  if (!slug || typeof slug !== 'string') {
    return '';
  }

  // Ensure lowercase
  slug = slug.toLowerCase();

  // Remove any non-alphanumeric characters except hyphens
  slug = slug.replace(/[^a-z0-9-]/g, '');

  // Remove consecutive hyphens
  slug = slug.replace(/-+/g, '-');

  // Trim hyphens from start and end
  slug = slug.replace(/^-+|-+$/g, '');

  return slug;
}

/**
 * Checks if a slug contains only valid characters
 * @param slug - The slug to validate
 * @returns True if the slug contains only valid characters
 */
export function isValidSlugFormat(slug: string): boolean {
  if (!slug || typeof slug !== 'string') {
    return false;
  }

  // Check regex pattern: only lowercase letters, numbers, and hyphens
  const slugPattern = /^[a-z0-9-]+$/;
  return slugPattern.test(slug);
}

/**
 * Extracts the base slug and numeric suffix from a slug
 * @param slug - The slug to parse
 * @returns An object with baseSlug and suffix (or null if no suffix)
 * 
 * @example
 * parseSlugSuffix("about-us-2") // returns { baseSlug: "about-us", suffix: 2 }
 * parseSlugSuffix("contact") // returns { baseSlug: "contact", suffix: null }
 */
export function parseSlugSuffix(slug: string): { baseSlug: string; suffix: number | null } {
  const match = slug.match(/^(.+)-(\d+)$/);
  
  if (match) {
    return {
      baseSlug: match[1],
      suffix: parseInt(match[2], 10)
    };
  }

  return {
    baseSlug: slug,
    suffix: null
  };
}

/**
 * Creates a slug with a numeric suffix
 * @param baseSlug - The base slug without suffix
 * @param suffix - The numeric suffix to append
 * @returns A slug with the suffix appended
 * 
 * @example
 * createSlugWithSuffix("about-us", 2) // returns "about-us-2"
 */
export function createSlugWithSuffix(baseSlug: string, suffix: number): string {
  if (suffix <= 0) {
    return baseSlug;
  }
  return `${baseSlug}-${suffix}`;
}

/**
 * Validates a slug against system rules and constraints
 * @param slug - The slug to validate
 * @returns True if the slug is valid according to all rules
 */
export function validateSlug(slug: string): boolean {
  if (!slug || typeof slug !== 'string') {
    return false;
  }

  // Check regex pattern: only lowercase letters, numbers, and hyphens
  const slugPattern = /^[a-z0-9-]+$/;
  if (!slugPattern.test(slug)) {
    return false;
  }

  // Verify max length (255 characters)
  if (slug.length > 255) {
    return false;
  }

  // Check against reserved slugs (case-insensitive)
  const slugLower = slug.toLowerCase();
  if (RESERVED_SLUGS.includes(slugLower as ReservedSlug)) {
    return false;
  }

  return true;
}

/**
 * Checks if a slug is reserved by the system
 * @param slug - The slug to check
 * @returns True if the slug is reserved
 */
export function isReservedSlug(slug: string): boolean {
  if (!slug || typeof slug !== 'string') {
    return false;
  }
  
  const slugLower = slug.toLowerCase();
  return RESERVED_SLUGS.includes(slugLower as ReservedSlug);
}

/**
 * Gets a detailed validation result for a slug
 * @param slug - The slug to validate
 * @returns An object with validation details
 */
export function getSlugValidationDetails(slug: string): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!slug || typeof slug !== 'string') {
    errors.push('Invalid slug: cannot be empty');
    return { valid: false, errors };
  }

  // Check for uppercase letters
  if (slug !== slug.toLowerCase()) {
    errors.push(`Invalid slug: '${slug}' contains uppercase letters`);
  }

  // Check regex pattern
  const slugPattern = /^[a-z0-9-]+$/;
  if (!slugPattern.test(slug)) {
    const invalidChars = slug.match(/[^a-z0-9-]/g);
    if (invalidChars) {
      const uniqueChars = [...new Set(invalidChars)].join('", "');
      errors.push(`Invalid slug: '${slug}' contains invalid character(s) "${uniqueChars}"`);
    }
  }

  // Check max length
  if (slug.length > 255) {
    errors.push(`Invalid slug: exceeds maximum length of 255 characters`);
  }

  // Check reserved slugs
  if (isReservedSlug(slug)) {
    errors.push(`Invalid slug: '${slug}' is a reserved system slug`);
  }

  return {
    valid: errors.length === 0,
    errors
  };
}