/**
 * Umbraco Compose Schema Mapper
 *
 * Maps CMS content types to Umbraco JSON Schema format.
 * Based on Umbraco Compose schema specification.
 *
 * Schema format:
 * {
 *   "$schema": "https://umbracocompose.com/v1/schema",
 *   "allOf": [{ "$ref": "https://umbracocompose.com/v1/node" }],
 *   "properties": { ... }
 * }
 */

import {
  UMBRACO_SCHEMA_BASE,
  UMBRACO_NODE_REF,
} from '../constants';
import type {
  UmbracoJsonSchema,
  UmbracoSchemaProperty,
  UmbracoMappedTypeSchema,
} from '../types';
import type { UniversalContentType } from '../../types';

/**
 * Map a universal content type to Umbraco JSON Schema format
 */
export function mapContentTypeToSchema(contentType: UniversalContentType): UmbracoMappedTypeSchema {
  const alias = sanitizeSchemaAlias(contentType.id || contentType.name);
  const properties = mapFieldsToProperties(contentType.fields || []);

  const schema: UmbracoJsonSchema = {
    $schema: UMBRACO_SCHEMA_BASE,
    allOf: [{ $ref: UMBRACO_NODE_REF }],
    properties,
  };

  return {
    typeSchemaAlias: alias,
    schema,
  };
}

/**
 * Map universal fields to Umbraco schema properties
 */
export function mapFieldsToProperties(
  fields: UniversalContentType['fields']
): Record<string, UmbracoSchemaProperty> {
  const properties: Record<string, UmbracoSchemaProperty> = {};

  for (const field of fields) {
    const key = sanitizePropertyKey(field.id || field.name);
    properties[key] = mapFieldToProperty(field);
  }

  return properties;
}

/**
 * Map a single field to an Umbraco schema property
 */
export function mapFieldToProperty(
  field: UniversalContentType['fields'][number]
): UmbracoSchemaProperty {
  switch (field.type) {
    case 'text':
    case 'slug':
      return { type: 'string' };

    case 'longText':
      return { type: 'string', format: 'textarea' };

    case 'richText':
      return { type: 'string', format: 'html' };

    case 'number':
    case 'decimal':
      return { type: 'number' };

    case 'boolean':
      return { type: 'boolean' };

    case 'date':
      return { type: 'string', format: 'date-time' };

    case 'media':
      return {
        type: 'object',
        properties: {
          src: { type: 'string', format: 'uri' },
          alt: { type: 'string' },
          width: { type: 'number' },
          height: { type: 'number' },
        },
      };

    case 'component':
      return mapComponentField(field);

    case 'repeater':
    case 'collection':
      return mapArrayField(field);

    case 'json':
      return { type: 'object' };

    case 'tags':
      return {
        type: 'array',
        items: { type: 'string' },
      };

    default:
      return { type: 'string' };
  }
}

/**
 * Map a component field (reference to another type)
 */
function mapComponentField(field: UniversalContentType['fields'][number]): UmbracoSchemaProperty {
  const platformSpecific = field.platformSpecific as Record<string, unknown> | undefined;
  const allowedTypes = platformSpecific?.allowedTypes as string[] | undefined;

  if (allowedTypes && allowedTypes.length > 0) {
    const refType = sanitizeSchemaAlias(allowedTypes[0]);
    return {
      type: 'object',
      $ref: refType,
    };
  }

  return { type: 'object' };
}

/**
 * Map an array/repeater field
 */
function mapArrayField(field: UniversalContentType['fields'][number]): UmbracoSchemaProperty {
  const platformSpecific = field.platformSpecific as Record<string, unknown> | undefined;
  const allowedTypes = platformSpecific?.allowedTypes as string[] | undefined;
  const itemSchema = platformSpecific?.itemSchema as Record<string, unknown> | undefined;

  // If we have allowed types, reference them
  if (allowedTypes && allowedTypes.length > 0) {
    const refType = sanitizeSchemaAlias(allowedTypes[0]);
    return {
      type: 'array',
      items: {
        type: 'object',
        $ref: refType,
      },
    };
  }

  // If we have an item schema, use it
  if (itemSchema) {
    return {
      type: 'array',
      items: mapObjectSchema(itemSchema),
    };
  }

  // Default to array of objects
  return {
    type: 'array',
    items: { type: 'object' },
  };
}

/**
 * Map an object schema definition
 */
function mapObjectSchema(schema: Record<string, unknown>): UmbracoSchemaProperty {
  const properties: Record<string, UmbracoSchemaProperty> = {};

  for (const [key, value] of Object.entries(schema)) {
    if (typeof value === 'object' && value !== null) {
      properties[key] = inferPropertyType(value as Record<string, unknown>);
    } else {
      properties[key] = { type: 'string' };
    }
  }

  return {
    type: 'object',
    properties,
  };
}

/**
 * Infer property type from a value schema
 */
function inferPropertyType(schema: Record<string, unknown>): UmbracoSchemaProperty {
  if (schema.type) {
    const type = schema.type as string;
    if (type === 'string' || type === 'number' || type === 'boolean' || type === 'object' || type === 'array') {
      return { type };
    }
  }

  // Default to string
  return { type: 'string' };
}

/**
 * Sanitize a schema alias
 * - Lowercase
 * - Replace non-alphanumeric with hyphens
 * - Remove leading/trailing hyphens
 */
export function sanitizeSchemaAlias(input: string): string {
  let value = (input || '').toString().toLowerCase();
  value = value.replace(/[^a-z0-9-]+/g, '-');
  value = value.replace(/^-+|-+$/g, '');
  if (!value) value = 'schema';
  if (/^[0-9]/.test(value)) value = `s-${value}`;
  return value.slice(0, 50);
}

/**
 * Sanitize a property key
 * - camelCase preferred
 * - No special characters
 */
export function sanitizePropertyKey(input: string): string {
  let value = (input || '').toString();

  // Convert kebab-case or snake_case to camelCase
  value = value.replace(/[-_]+(.)?/g, (_, char) => char ? char.toUpperCase() : '');

  // Remove non-alphanumeric
  value = value.replace(/[^a-zA-Z0-9]/g, '');

  // Ensure starts with lowercase letter
  if (value.length > 0) {
    value = value[0].toLowerCase() + value.slice(1);
  }

  if (!value) value = 'field';
  if (/^[0-9]/.test(value)) value = `f${value}`;

  return value;
}

/**
 * Create a page schema with references to shared components
 */
export function createPageSchema(
  alias: string,
  contentFields: Record<string, UmbracoSchemaProperty>,
  options?: {
    navbarRef?: boolean;
    footerRef?: boolean;
  }
): UmbracoMappedTypeSchema {
  const properties: Record<string, UmbracoSchemaProperty> = {
    title: { type: 'string' },
    slug: { type: 'string' },
    ...contentFields,
  };

  // Add shared component references
  if (options?.navbarRef !== false) {
    properties.navbarRef = { type: 'object', $ref: 'navbar' };
  }
  if (options?.footerRef !== false) {
    properties.footerRef = { type: 'object', $ref: 'footer' };
  }

  return {
    typeSchemaAlias: sanitizeSchemaAlias(alias),
    schema: {
      $schema: UMBRACO_SCHEMA_BASE,
      allOf: [{ $ref: UMBRACO_NODE_REF }],
      properties,
    },
  };
}

/**
 * Create a component schema
 */
export function createComponentSchema(
  alias: string,
  properties: Record<string, UmbracoSchemaProperty>
): UmbracoMappedTypeSchema {
  return {
    typeSchemaAlias: sanitizeSchemaAlias(alias),
    schema: {
      $schema: UMBRACO_SCHEMA_BASE,
      allOf: [{ $ref: UMBRACO_NODE_REF }],
      properties,
    },
  };
}
