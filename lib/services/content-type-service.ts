import { CreateContentTypeRequest, UpdateContentTypeRequest } from '@/lib/api/validation/content-type';
import prisma from '@/lib/db/prisma';
// Versioning features removed with old sync system
import { 
  contentTypeValidator, 
  validateContentTypeName,
  validateFieldName,
  type ContentTypeDefinition 
} from '@/lib/services/universal-types/validation';

export interface ContentTypeFields {
  name?: string;
  pluralName?: string;
  icon?: string;
  description?: string;
  fields?: Array<{
    id: string;
    name: string;
    label: string;
    type: string;
    required: boolean;
    defaultValue?: unknown;
    validation?: Record<string, unknown>;
    helpText?: string;
    placeholder?: string;
    options?: Array<{
      label: string;
      value: string | number | boolean;
      description?: string;
    }>;
    order: number;
  }>;
  relationships?: Array<{
    id: string;
    name: string;
    type: 'oneToOne' | 'oneToMany' | 'manyToOne' | 'manyToMany';
    sourceContentTypeId: string;
    targetContentTypeId: string;
    sourceFieldName?: string;
    targetFieldName?: string;
    fieldName?: string;
    isRequired: boolean;
  }>;
}

export interface ContentTypeSettings {
  pluralName?: string;
  icon?: string;
  description?: string;
  [key: string]: unknown;
}

export interface ContentTypeWithParsedFields {
  id: string;
  websiteId: string;
  name: string;
  category: string;
  fields: ContentTypeFields;
  settings: ContentTypeSettings;
  createdAt: Date;
  updatedAt: Date;
}

function parseJsonField<T = ContentTypeFields | ContentTypeSettings>(field: string | null): T | null {
  if (!field) return null;
  try {
    return JSON.parse(field) as T;
  } catch {
    return null;
  }
}

function stringifyJsonField(field: ContentTypeFields | ContentTypeSettings | null | undefined): string {
  if (field === null || field === undefined) return '{}';
  return JSON.stringify(field);
}

/**
 * Validates content type data (name, fields, and relationships)
 * Used by both create and update operations
 */
async function validateContentTypeData(
  name: string,
  fields: CreateContentTypeRequest['fields'] | undefined,
  relationships: CreateContentTypeRequest['relationships'] | undefined,
  websiteId: string | undefined,
  existingName?: string, // For update operations, to check if name is changing
  category?: 'page' | 'component' | 'folder' // New category parameter
): Promise<void> {
  // Validate content type name
  const nameValidation = validateContentTypeName(name);
  if (!nameValidation.valid) {
    throw new Error(`Invalid content type name: ${nameValidation.error}`);
  }

  // Validate fields
  if (fields && fields.length > 0) {
    const fieldNames = new Set<string>();
    for (const field of fields) {
      // Validate field name format
      const fieldNameValidation = validateFieldName(field.name);
      if (!fieldNameValidation.valid) {
        throw new Error(`Invalid field name "${field.name}": ${fieldNameValidation.error}`);
      }

      // Check for duplicate field names
      if (fieldNames.has(field.name.toLowerCase())) {
        throw new Error(`Duplicate field name: ${field.name}`);
      }
      fieldNames.add(field.name.toLowerCase());
    }
  }

  // Initialize validator and perform comprehensive validation
  if (websiteId) {
    await contentTypeValidator.initialize(websiteId);
    
    // Create a definition for validation
    const definition: ContentTypeDefinition = {
      name,
      category: category || 'page', // Use provided category or default to page
      fields: fields?.map(f => ({
        name: f.name,
        type: f.type,
        required: f.required,
        validation: f.validation
      })) || [],
      relationships: relationships?.map(r => ({
        name: r.fieldName || r.name,
        type: r.type,
        targetType: r.targetContentTypeId
      }))
    };

    const validationResult = await contentTypeValidator.validate(definition);
    
    // Check for duplicates
    // For create: always check
    // For update: only check if name is changing
    const isCreating = !existingName;
    const isRenaming = existingName && name !== existingName;
    
    if ((isCreating || isRenaming) && validationResult.duplicateCheck.isDuplicate) {
      throw new Error(`Content type "${name}" already exists or is too similar to "${validationResult.duplicateCheck.matchType}"`);
    }

    // Log warnings but don't block operation
    if (validationResult.warnings.length > 0) {
      console.warn('Content type validation warnings:', validationResult.warnings);
    }
  }
}

export async function getContentTypes(websiteId?: string): Promise<ContentTypeWithParsedFields[]> {
  const contentTypes = await prisma.contentType.findMany({
    where: websiteId ? { websiteId } : undefined,
    orderBy: { updatedAt: 'desc' },
  });

  return contentTypes.map(ct => ({
    ...ct,
    fields: (ct.fields as ContentTypeFields) || {},
    settings: {} as ContentTypeSettings,
  }));
}

export async function getContentType(id: string): Promise<ContentTypeWithParsedFields | null> {
  const contentType = await prisma.contentType.findUnique({
    where: { id },
  });

  if (!contentType) {
    return null;
  }

  return {
    ...contentType,
    fields: (contentType.fields as ContentTypeFields) || {},
    settings: {} as ContentTypeSettings,
  };
}

export async function createContentType(data: CreateContentTypeRequest, source: 'UI' | 'AI' | 'SYNC' = 'UI'): Promise<ContentTypeWithParsedFields> {
  const { websiteId, fields, relationships, ...contentTypeData } = data;

  if (!websiteId) {
    throw new Error('Website ID is required to create a content type');
  }

  // Use the shared validation function
  await validateContentTypeData(
    contentTypeData.name,
    fields,
    relationships,
    websiteId,
    undefined,
    contentTypeData.category
  );

  // Generate a key from the name (lowercase, replace spaces with underscores)
  const key = contentTypeData.name.toLowerCase().replace(/\s+/g, '_');

  const contentTypeFields = {
    name: contentTypeData.name,
    pluralName: contentTypeData.pluralName,
    icon: contentTypeData.icon,
    description: contentTypeData.description,
    fields,
    relationships,
  };

  const settings = {
    pluralName: contentTypeData.pluralName,
    icon: contentTypeData.icon,
    description: contentTypeData.description,
  };

  const contentType = await prisma.contentType.create({
    data: {
      websiteId,
      key,
      name: contentTypeData.name,
      pluralName: contentTypeData.pluralName,
      displayField: fields && fields.length > 0 ? fields[0].name : null,
      category: contentTypeData.category,
      fields: contentTypeFields as any,
    },
  });

  // Version tracking removed with old sync system

  return {
    ...contentType,
    fields: contentTypeFields as any,
    settings: settings as any,
  };
}

export async function updateContentType(id: string, data: UpdateContentTypeRequest, source: 'UI' | 'AI' | 'SYNC' = 'UI'): Promise<ContentTypeWithParsedFields> {
  const existing = await getContentType(id);
  if (!existing) {
    throw new Error(`Content type with ID '${id}' not found`);
  }

  const currentFields = existing.fields || {};
  const currentSettings = existing.settings || {};

  const { fields, relationships, ...contentTypeData } = data;

  // Use the shared validation function
  // Pass existing name to check if name is changing (for duplicate detection)
  if (contentTypeData.name || fields || relationships || data.category) {
    await validateContentTypeData(
      contentTypeData.name || existing.name,
      fields,
      relationships,
      existing.websiteId,
      existing.name, // Pass existing name for update operations
      data.category
    );
  }

  // Fix: Properly merge fields array instead of nesting it  
  let updatedFields = {
    ...currentFields,
    ...(contentTypeData.name && { name: contentTypeData.name }),
    ...(contentTypeData.pluralName && { pluralName: contentTypeData.pluralName }),
    ...(contentTypeData.icon && { icon: contentTypeData.icon }),
    ...(contentTypeData.description !== undefined && { description: contentTypeData.description }),
    fields: fields !== undefined ? fields : (currentFields.fields || []),
    relationships: relationships !== undefined ? relationships : (currentFields.relationships || []),
  };

  const updatedSettings = {
    ...currentSettings,
    ...(contentTypeData.pluralName && { pluralName: contentTypeData.pluralName }),
    ...(contentTypeData.icon && { icon: contentTypeData.icon }),
    ...(contentTypeData.description !== undefined && { description: contentTypeData.description }),
    ...(data.settings && data.settings),
  };

  const contentType = await prisma.contentType.update({
    where: { id },
    data: {
      ...(contentTypeData.name && { name: contentTypeData.name }),
      ...(contentTypeData.pluralName && { pluralName: contentTypeData.pluralName }),
      ...(data.category && { category: data.category }),
      fields: updatedFields as any,
    },
  });

  // Version tracking removed with old sync system

  return {
    ...contentType,
    fields: updatedFields as any,
    settings: updatedSettings as any,
  };
}

// =============================================================================
// Delete Impact Analysis
// =============================================================================

export interface ContentTypeImpact {
  contentTypeId: string;
  contentTypeName: string;
  canDelete: boolean;
  impact: {
    totalAffectedItems: number;
    websitePages: {
      count: number;
      items: Array<{
        id: string;
        title: string;
        path: string;
        websiteName: string;
      }>;
    };
  };
  warnings: string[];
}

export interface DeleteContentTypeOptions {
  confirm: boolean;
  acknowledgement: string;
}

export interface DeleteContentTypeResult {
  success: true;
  deleted: {
    contentType: { id: string; name: string };
    websitePages: number;
  };
}

/**
 * Error thrown when delete requires user confirmation
 */
export class ConfirmationRequiredError extends Error {
  public readonly code = 'CONFIRMATION_REQUIRED';
  public readonly requiresConfirmation = true;
  public readonly impact: ContentTypeImpact;

  constructor(impact: ContentTypeImpact) {
    super(`This content type has ${impact.impact.totalAffectedItems} items that will be deleted. Please confirm deletion.`);
    this.name = 'ConfirmationRequiredError';
    this.impact = impact;
  }
}

/**
 * Get impact analysis for deleting a content type
 */
export async function getDeleteImpact(contentTypeId: string): Promise<ContentTypeImpact> {
  // Get the content type first
  const contentType = await prisma.contentType.findUnique({
    where: { id: contentTypeId },
    select: { id: true, name: true },
  });

  if (!contentType) {
    throw new Error(`Content type with ID '${contentTypeId}' not found`);
  }

  // Query counts and sample items in parallel
  const [pagesCount, pages] = await Promise.all([
    prisma.websitePage.count({ where: { contentTypeId } }),
    prisma.websitePage.findMany({
      where: { contentTypeId },
      select: {
        id: true,
        title: true,
        structures: { select: { fullPath: true }, take: 1 },
        website: { select: { name: true } },
      },
      take: 10, // Limit for display
    }),
  ]);

  const totalAffectedItems = pagesCount;

  // Build warnings
  const warnings: string[] = [];
  if (pagesCount > 0) {
    warnings.push(`${pagesCount} ${pagesCount === 1 ? 'page' : 'pages'} will be permanently deleted`);
  }
  if (totalAffectedItems > 0) {
    warnings.push('This action cannot be undone');
  }

  return {
    contentTypeId,
    contentTypeName: contentType.name,
    canDelete: true, // Always true; we just warn about impact
    impact: {
      totalAffectedItems,
      websitePages: {
        count: pagesCount,
        items: pages.map((p) => ({
          id: p.id,
          title: p.title || 'Untitled',
          path: p.structures[0]?.fullPath || '/',
          websiteName: p.website?.name || 'Unknown',
        })),
      },
    },
    warnings,
  };
}

/**
 * Delete a content type with optional cascade delete
 * Requires confirmation when there are affected items
 */
export async function deleteContentType(
  id: string,
  options?: DeleteContentTypeOptions
): Promise<DeleteContentTypeResult | void> {
  // Get the content type first
  const contentType = await prisma.contentType.findUnique({
    where: { id },
    select: { id: true, name: true },
  });

  if (!contentType) {
    throw new Error(`Content type with ID '${id}' not found`);
  }

  // Get impact analysis
  const impact = await getDeleteImpact(id);

  // If there are affected items, require confirmation
  if (impact.impact.totalAffectedItems > 0) {
    if (!options?.confirm || options?.acknowledgement !== 'DELETE_ALL_CONTENT') {
      throw new ConfirmationRequiredError(impact);
    }
  }

  // Perform cascade delete in transaction
  return prisma.$transaction(async (tx) => {
    // Delete dependent records first
    const deletedPages = await tx.websitePage.deleteMany({
      where: { contentTypeId: id },
    });

    // Delete content type
    await tx.contentType.delete({
      where: { id },
    });

    return {
      success: true as const,
      deleted: {
        contentType: { id: contentType.id, name: contentType.name },
        websitePages: deletedPages.count,
      },
    };
  });
}

/**
 * Get version history for a content type
 * @param typeKey - The content type ID or key
 * @param options - Options for filtering version history
 * @returns Array of version records
 */
// Version history removed with old sync system

// Version tree removed with old sync system

// Version comparison removed with old sync system

// Version lineage removed with old sync system
