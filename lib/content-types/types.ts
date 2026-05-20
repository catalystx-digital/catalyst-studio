import { z } from 'zod';

// Field Types Enum
export enum FieldType {
  TEXT = 'text',
  NUMBER = 'number',
  BOOLEAN = 'boolean',
  DATE = 'date',
  IMAGE = 'image',
  RICH_TEXT = 'richText',
  REFERENCE = 'reference',
}

// Relationship Types
export enum RelationshipType {
  ONE_TO_ONE = 'oneToOne',
  ONE_TO_MANY = 'oneToMany',
  MANY_TO_ONE = 'manyToOne',
  MANY_TO_MANY = 'manyToMany',
}

// Validation Rules using Zod
export const TextValidationSchema = z.object({
  minLength: z.number().optional(),
  maxLength: z.number().optional(),
  pattern: z.string().optional(),
});

export const NumberValidationSchema = z.object({
  min: z.number().optional(),
  max: z.number().optional(),
  precision: z.number().optional(),
});

export const DateValidationSchema = z.object({
  minDate: z.string().optional(),
  maxDate: z.string().optional(),
  format: z.string().optional(),
});

export const ImageValidationSchema = z.object({
  maxSize: z.number().optional(), // in bytes
  allowedTypes: z.array(z.string()).optional(),
  dimensions: z.object({
    minWidth: z.number().optional(),
    maxWidth: z.number().optional(),
    minHeight: z.number().optional(),
    maxHeight: z.number().optional(),
  }).optional(),
});

// Field Configuration Options
export interface FieldConfigOption {
  label: string;
  value: string | number | boolean;
  description?: string;
}

// Validation Rules Type
export type ValidationRules = 
  | z.infer<typeof TextValidationSchema>
  | z.infer<typeof NumberValidationSchema>
  | z.infer<typeof DateValidationSchema>
  | z.infer<typeof ImageValidationSchema>
  | Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

// Field Model
export interface Field {
  id: string;
  name: string; // camelCase
  label: string; // Display label
  type: FieldType;
  required: boolean;
  defaultValue?: any; // eslint-disable-line @typescript-eslint/no-explicit-any
  validation?: ValidationRules;
  helpText?: string;
  placeholder?: string;
  options?: FieldConfigOption[]; // For select/radio fields
  order: number; // For drag-and-drop ordering
}

// Relationship Model
export interface Relationship {
  id: string;
  name: string;
  type: RelationshipType;
  sourceContentTypeId: string;
  targetContentTypeId: string;
  sourceFieldName?: string; // Field name on source content type
  targetFieldName?: string; // Field name on target content type
  fieldName?: string; // Simple field name for UI
  isRequired: boolean;
}

// ContentType Model
export interface ContentType {
  id: string;
  name: string; // e.g., "BlogPost"
  pluralName: string; // e.g., "BlogPosts"
  icon: string; // Emoji icon
  description?: string;
  category: 'page' | 'component' | 'folder'; // Distinguishes routable pages from reusable components
  fields: Field[];
  relationships: Relationship[];
  createdAt: Date;
  updatedAt: Date;
}

// Content Item (actual content based on ContentType)
export interface ContentItem {
  id: string;
  contentTypeId: string;
  title: string; // Required title field for all content items (CMS industry standard)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: Record<string, any>; // Field name -> value
  createdAt: Date;
  updatedAt: Date;
}

// Utility types for field configuration
export interface FieldCategory {
  name: string;
  label: string;
  fields: FieldTypeInfo[];
}

export interface FieldTypeInfo {
  type: FieldType;
  label: string;
  icon: string;
  description: string;
  defaultConfig: Partial<Field>;
}

// Field categories for UI
export const FIELD_CATEGORIES: FieldCategory[] = [
  {
    name: 'basic',
    label: 'Basic',
    fields: [
      {
        type: FieldType.TEXT,
        label: 'Text',
        icon: '📝',
        description: 'Single line text input',
        defaultConfig: {
          required: false,
          placeholder: 'Enter text...',
        },
      },
      {
        type: FieldType.NUMBER,
        label: 'Number',
        icon: '🔢',
        description: 'Numeric input',
        defaultConfig: {
          required: false,
          defaultValue: 0,
        },
      },
      {
        type: FieldType.BOOLEAN,
        label: 'Boolean',
        icon: '✓',
        description: 'True/False checkbox',
        defaultConfig: {
          required: false,
          defaultValue: false,
        },
      },
      {
        type: FieldType.DATE,
        label: 'Date',
        icon: '📅',
        description: 'Date picker',
        defaultConfig: {
          required: false,
        },
      },
    ],
  },
  {
    name: 'media',
    label: 'Media',
    fields: [
      {
        type: FieldType.IMAGE,
        label: 'Image',
        icon: '🖼️',
        description: 'Image upload',
        defaultConfig: {
          required: false,
          validation: {
            maxSize: 5242880, // 5MB
            allowedTypes: ['image/jpeg', 'image/png', 'image/webp'],
          },
        },
      },
    ],
  },
  {
    name: 'advanced',
    label: 'Advanced',
    fields: [
      {
        type: FieldType.RICH_TEXT,
        label: 'Rich Text',
        icon: '📄',
        description: 'Rich text editor',
        defaultConfig: {
          required: false,
          placeholder: 'Enter content...',
        },
      },
    ],
  },
  {
    name: 'relationship',
    label: 'Relationship',
    fields: [
      {
        type: FieldType.REFERENCE,
        label: 'Reference',
        icon: '🔗',
        description: 'Link to another content type',
        defaultConfig: {
          required: false,
        },
      },
    ],
  },
];

// Helper function to generate unique IDs
export function generateId(): string {
  return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Helper function to create a new field
export function createField(type: FieldType, order: number): Field {
  const fieldInfo = FIELD_CATEGORIES
    .flatMap(c => c.fields)
    .find(f => f.type === type);

  return {
    id: generateId(),
    name: `field_${Date.now()}`,
    label: 'New Field',
    type,
    required: false,
    order,
    ...fieldInfo?.defaultConfig,
  };
}

// Helper function to create a new content type
export function createContentType(name: string, category: 'page' | 'component' | 'folder' = 'page'): ContentType {
  return {
    id: generateId(),
    name,
    pluralName: `${name}s`,
    icon: category === 'page' ? '📄' : category === 'component' ? '🧩' : '📁',
    category,
    fields: [],
    relationships: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

// Validation schemas for forms
export const FieldFormSchema = z.object({
  name: z.string().min(1, 'Field name is required').regex(/^[a-zA-Z][a-zA-Z0-9]*$/, 'Must start with letter and contain only alphanumeric characters'),
  label: z.string().min(1, 'Field label is required'),
  type: z.nativeEnum(FieldType),
  required: z.boolean(),
  helpText: z.string().optional(),
  placeholder: z.string().optional(),
});

export const ContentTypeFormSchema = z.object({
  name: z.string().min(1, 'Content type name is required').regex(/^[A-Z][a-zA-Z0-9]*$/, 'Must be PascalCase'),
  pluralName: z.string().min(1, 'Plural name is required'),
  icon: z.string().min(1, 'Icon is required'),
  description: z.string().optional(),
});