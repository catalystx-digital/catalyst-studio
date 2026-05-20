/**
 * Slug Validator - Database-level slug uniqueness validation
 * Ensures slugs are unique within their parent context
 */

import { prisma } from '@/lib/prisma';
import { generateSlug, createSlugWithSuffix, validateSlug, getSlugValidationDetails } from './slug-manager';
import { SlugGenerationError, InvalidSlugError } from './errors';

export interface SlugValidationOptions {
  websiteId: string;
  parentId: string | null;
  excludeId?: string; // For updates, exclude current record
  maxAttempts?: number;
}

/**
 * Checks if a slug is unique at the specified parent level
 * @param slug - The slug to check for uniqueness
 * @param options - Validation options including websiteId and parentId
 * @returns Promise<boolean> - True if the slug is unique
 */
export async function checkSlugUniqueness(
  slug: string,
  options: SlugValidationOptions
): Promise<boolean> {
  const { websiteId, parentId, excludeId } = options;

  // Build the where clause for the query
  const whereClause: any = {
    websiteId,
    parentId: parentId || null,
    slug: {
      equals: slug,
      mode: 'insensitive' // Case-insensitive comparison
    }
  };

  // Exclude current record if updating
  if (excludeId) {
    whereClause.id = {
      not: excludeId
    };
  }

  // Query for existing slug
  const existing = await prisma.websiteStructure.findFirst({
    where: whereClause,
    select: { id: true }
  });

  return !existing;
}

/**
 * Ensures a unique slug by appending numeric suffixes if needed
 * @param baseSlug - The base slug to start with
 * @param options - Validation options including websiteId and parentId
 * @returns Promise<string> - A guaranteed unique slug
 * @throws Error if unable to generate unique slug after maxAttempts
 */
export async function ensureUniqueSlug(
  baseSlug: string,
  options: SlugValidationOptions
): Promise<string> {
  const { websiteId, parentId, excludeId, maxAttempts = 100 } = options;

  // Validate the base slug format
  if (!validateSlug(baseSlug)) {
    const validation = getSlugValidationDetails(baseSlug);
    throw new InvalidSlugError(baseSlug, validation.errors);
  }

  // Use a transaction for atomic slug conflict resolution
  return await prisma.$transaction(async (tx) => {
    let slugToTry = baseSlug;
    let suffix = 0;

    while (suffix <= maxAttempts) {
      // Build where clause
      const whereClause: any = {
        websiteId,
        parentId: parentId || null,
        slug: {
          equals: slugToTry,
          mode: 'insensitive'
        }
      };

      // Exclude current record if updating
      if (excludeId) {
        whereClause.id = {
          not: excludeId
        };
      }

      // Check if this slug exists
      const existing = await tx.websiteStructure.findFirst({
        where: whereClause,
        select: { id: true }
      });

      if (!existing) {
        return slugToTry; // This slug is available
      }

      // Try next suffix
      suffix++;
      slugToTry = createSlugWithSuffix(baseSlug, suffix);
    }

    throw new SlugGenerationError(baseSlug, maxAttempts);
  });
}

/**
 * Generates a unique slug from a title
 * @param title - The title to convert to a unique slug
 * @param options - Validation options including websiteId and parentId
 * @returns Promise<string> - A unique slug generated from the title
 */
export async function generateUniqueSlug(
  title: string,
  options: SlugValidationOptions
): Promise<string> {
  // Generate base slug from title
  const baseSlug = generateSlug(title);

  if (!baseSlug) {
    throw new InvalidSlugError(title, ['Unable to generate slug from title - title may be empty or contain only special characters']);
  }

  // Ensure uniqueness
  return await ensureUniqueSlug(baseSlug, options);
}

/**
 * Batch checks multiple slugs for uniqueness
 * @param slugs - Array of slugs to check
 * @param options - Validation options including websiteId and parentId
 * @returns Promise<Map<string, boolean>> - Map of slug to uniqueness status
 */
export async function batchCheckSlugUniqueness(
  slugs: string[],
  options: Pick<SlugValidationOptions, 'websiteId' | 'parentId'>
): Promise<Map<string, boolean>> {
  const { websiteId, parentId } = options;

  // Query for all existing slugs at once
  const existingSlugs = await prisma.websiteStructure.findMany({
    where: {
      websiteId,
      parentId: parentId || null,
      slug: {
        in: slugs,
        mode: 'insensitive'
      }
    },
    select: { slug: true }
  });

  // Create a set of existing slugs (lowercase for comparison)
  const existingSet = new Set(existingSlugs.map(s => s.slug.toLowerCase()));

  // Build result map
  const result = new Map<string, boolean>();
  for (const slug of slugs) {
    result.set(slug, !existingSet.has(slug.toLowerCase()));
  }

  return result;
}

/**
 * Gets all existing slugs at a specific parent level
 * @param websiteId - The website ID
 * @param parentId - The parent ID (null for root level)
 * @returns Promise<string[]> - Array of existing slugs
 */
export async function getExistingSlugs(
  websiteId: string,
  parentId: string | null
): Promise<string[]> {
  const slugs = await prisma.websiteStructure.findMany({
    where: {
      websiteId,
      parentId: parentId || null
    },
    select: { slug: true }
  });

  return slugs.map(s => s.slug);
}

/**
 * Validates and suggests a slug for a new page
 * @param title - The page title
 * @param options - Validation options
 * @returns Promise with validation result and suggested slug
 */
export async function validateAndSuggestSlug(
  title: string,
  options: SlugValidationOptions
): Promise<{
  originalSlug: string;
  suggestedSlug: string;
  isUnique: boolean;
  validationErrors: string[];
}> {
  const originalSlug = generateSlug(title);
  
  // Get validation details
  const validation = getSlugValidationDetails(originalSlug);

  if (!validation.valid) {
    return {
      originalSlug,
      suggestedSlug: '',
      isUnique: false,
      validationErrors: validation.errors
    };
  }

  // Check uniqueness
  const isUnique = await checkSlugUniqueness(originalSlug, options);
  
  let suggestedSlug = originalSlug;
  if (!isUnique) {
    suggestedSlug = await ensureUniqueSlug(originalSlug, options);
  }

  return {
    originalSlug,
    suggestedSlug,
    isUnique,
    validationErrors: []
  };
}