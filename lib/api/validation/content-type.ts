import { z } from 'zod';

export const ContentTypeFieldValidationSchema = z.object({
  minLength: z.number().optional(),
  maxLength: z.number().optional(),
  pattern: z.string().optional(),
  min: z.number().optional(),
  max: z.number().optional(),
  precision: z.number().optional(),
  minDate: z.string().optional(),
  maxDate: z.string().optional(),
  format: z.string().optional(),
  maxSize: z.number().optional(),
  allowedTypes: z.array(z.string()).optional(),
  dimensions: z.object({
    minWidth: z.number().optional(),
    maxWidth: z.number().optional(),
    minHeight: z.number().optional(),
    maxHeight: z.number().optional(),
  }).optional(),
});

export const ContentTypeFieldOptionSchema = z.object({
  label: z.string(),
  value: z.union([z.string(), z.number(), z.boolean()]),
  description: z.string().optional(),
});

export const ContentTypeFieldSchema = z.object({
  id: z.string().optional(), // Auto-generated if not provided
  name: z.string().regex(/^[a-zA-Z][a-zA-Z0-9_]*$/, 'Field name must start with letter and contain only alphanumeric characters or underscores'),
  label: z.string().min(1, 'Field label is required').optional(), // Can be derived from name
  type: z.enum(['text', 'textarea', 'richtext', 'number', 'boolean', 'date', 'image', 'reference', 'select', 'gallery', 'tags', 'json', 'url', 'array', 'markdown']),
  required: z.boolean(),
  defaultValue: z.any().optional(),
  validation: ContentTypeFieldValidationSchema.optional(),
  helpText: z.string().optional(),
  placeholder: z.string().optional(),
  options: z.array(ContentTypeFieldOptionSchema).optional(),
  order: z.number().optional(), // Auto-calculated based on position
});

export const ContentTypeRelationshipSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum(['oneToOne', 'oneToMany', 'manyToOne', 'manyToMany']),
  sourceContentTypeId: z.string(),
  targetContentTypeId: z.string(),
  sourceFieldName: z.string().optional(),
  targetFieldName: z.string().optional(),
  fieldName: z.string().optional(),
  isRequired: z.boolean(),
});

export const CreateContentTypeSchema = z.object({
  websiteId: z.string().min(1, 'Website ID is required'),
  name: z.string().min(1, 'Content type name is required').regex(/^[A-Z][a-zA-Z0-9 ]*$/, 'Must start with capital letter'),
  pluralName: z.string().min(1, 'Plural name is required'),
  icon: z.string().min(1, 'Icon is required'),
  description: z.string().optional(),
  category: z.enum(['page', 'component', 'folder']),
  fields: z.array(ContentTypeFieldSchema),
  relationships: z.array(ContentTypeRelationshipSchema),
});

export const UpdateContentTypeSchema = z.object({
  name: z.string().min(1, 'Content type name is required').regex(/^[A-Z][a-zA-Z0-9 ]*$/, 'Must start with capital letter').optional(),
  pluralName: z.string().min(1, 'Plural name is required').optional(),
  icon: z.string().min(1, 'Icon is required').optional(),
  description: z.string().optional(),
  category: z.enum(['page', 'component']).optional(),
  fields: z.array(ContentTypeFieldSchema).optional(),
  relationships: z.array(ContentTypeRelationshipSchema).optional(),
  settings: z.record(z.any()).optional(),
});

export type CreateContentTypeRequest = z.infer<typeof CreateContentTypeSchema>;
export type UpdateContentTypeRequest = z.infer<typeof UpdateContentTypeSchema>;