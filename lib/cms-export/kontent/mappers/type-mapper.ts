import type { UniversalContentType, UniversalField, UniversalValidation } from '@/lib/cms-export/universal/types';
import {
  KontentTypeMapperContext,
  KontentContentType,
  KontentContentTypeElement,
  KontentTypeMappingResult,
  KontentFieldMappingResult,
} from '../types';
import { asArray, sanitizeCodename, uniqueCodename, coerceBoolean } from '../utils';

const FIELD_TYPE_MAP: Record<string, KontentContentTypeElement['type']> = {
  text: 'text',
  slug: 'text',
  longText: 'text',
  richText: 'rich_text',
  number: 'number',
  decimal: 'number',
  boolean: 'multiple_choice',
  date: 'date_time',
  json: 'json',
  media: 'asset',
  component: 'modular_content',
  repeater: 'modular_content',
  collection: 'modular_content',
  select: 'multiple_choice',
  tags: 'text',
};

export class KontentTypeMapper {
  private resolveCodename: KontentTypeMapperContext['resolveTypeCodename'];

  constructor(context: KontentTypeMapperContext) {
    this.resolveCodename = context.resolveTypeCodename;
  }

  map(contentType: UniversalContentType): KontentTypeMappingResult {
    const usedCodenames = new Set<string>();
    const codename = sanitizeCodename(contentType.id || contentType.name);
    usedCodenames.add(codename);

    const elements: KontentContentTypeElement[] = [];
    const fieldMappings: KontentFieldMappingResult[] = [];

    for (const field of contentType.fields ?? []) {
      const mapping = this.mapField(contentType.type, field, usedCodenames);
      elements.push(mapping.element);
      fieldMappings.push(mapping);
    }

    if (contentType.type === 'component' && !elements.some(element => element.codename === 'payload')) {
      elements.push({
        name: 'Payload',
        codename: 'payload',
        type: 'text',
      });
    }

    if (!elements.some(element => element.codename === 'title')) {
      elements.unshift({
        name: 'Title',
        codename: 'title',
        type: 'text',
        is_required: true,
      });
    }

    const mapped: KontentContentType = {
      name: contentType.name || contentType.id || 'Content Type',
      codename,
      external_id: contentType.id,
      elements,
    };

    return {
      contentType: mapped,
      fieldMappings,
      source: contentType,
    };
  }

  private mapField(
    contentTypeCategory: UniversalContentType['type'],
    field: UniversalField,
    used: Set<string>
  ): KontentFieldMappingResult {
    const codenameBase = sanitizeCodename(field.id || field.name || 'field', 'field');
    const codename = uniqueCodename(codenameBase, used);
    const platformSpecific = (field.platformSpecific ?? {}) as Record<string, unknown>;

    const kontentType = this.resolveKontentFieldType(contentTypeCategory, field, platformSpecific);
    const validations = Array.isArray(field.validations)
      ? (field.validations as UniversalValidation[])
      : [];
    const element: KontentContentTypeElement = {
      name: field.name || field.id,
      codename,
      type: kontentType,
      guidelines: field.description,
      is_required: Boolean(
        field.required || validations.some(validation => validation?.type === 'required')
      ),
    };

    if (field.type === 'longText') {
      element.mode = 'multiline';
    }

    if (field.type === 'boolean') {
      element.options = [
        { name: 'Yes', codename: 'yes' },
        { name: 'No', codename: 'no' },
      ];
      element.mode = 'single';
      element.allow_multiple = false;
    }

    if (field.type === 'select') {
      const options = asArray(platformSpecific.options ?? platformSpecific.allowedValues);
      element.options = options
        .map(option => {
          if (!option) return null;
          const value = typeof option === 'string' ? option : (option as { value?: string }).value;
          if (!value) return null;
          const optionCodename = sanitizeCodename(String(value), 'option');
          return { name: String(value), codename: optionCodename };
        })
        .filter((option): option is { name: string; codename: string } => Boolean(option));

      const multiple =
        coerceBoolean((platformSpecific as Record<string, unknown>).multiple) ||
        coerceBoolean((platformSpecific as Record<string, unknown>).allowMultiple);
      element.mode = multiple ? 'multiple' : 'single';
      element.allow_multiple = multiple;
    }

    if (field.type === 'number' || field.type === 'decimal') {
      element.allow_decimal = field.type === 'decimal';
    }

    if (element.type === 'modular_content') {
      const allowedTypes = this.resolveAllowedTypes(field);
      if (allowedTypes.length > 0) {
        element.allowed_content_types = allowedTypes.map(codename => ({ codename }));
      }
      if (field.type === 'repeater' || field.type === 'collection') {
        element.item_count_limit = {
          condition: 'at_least',
          value: 0,
        };
      }
    }

    if (field.defaultValue !== undefined && field.defaultValue !== null) {
      element.default = field.defaultValue;
    }

    element.platformSpecific = platformSpecific;

    return {
      element,
      universalField: field,
    };
  }

  private resolveKontentFieldType(
    contentTypeCategory: UniversalContentType['type'],
    field: UniversalField,
    platform: Record<string, unknown>
  ): KontentContentTypeElement['type'] {
    let mapped = FIELD_TYPE_MAP[field.type] ?? 'rich_text';

    const typeHint = typeof platform.type === 'string' ? platform.type : undefined;
    if (field.type === 'content[]' || typeHint === 'content[]') {
      return 'modular_content';
    }
    const looksLikeContentArray =
      typeHint === 'content[]' ||
      typeHint === 'component[]' ||
      (Array.isArray(platform.allowedTypes) && platform.allowedTypes.length > 0);

    if (looksLikeContentArray && mapped !== 'modular_content') {
      mapped = 'modular_content';
    }

    if (contentTypeCategory === 'component' && field.type === 'json') {
      mapped = 'rich_text';
    }

    return mapped;
  }

  private resolveAllowedTypes(field: UniversalField): string[] {
    const platformSpecific = (field.platformSpecific ?? {}) as Record<string, unknown>;
    const allowed = new Set<string>();

    const inputs = [
      ...(Array.isArray(platformSpecific.allowedTypes) ? platformSpecific.allowedTypes : []),
      ...(Array.isArray(platformSpecific.allowedContentTypes) ? platformSpecific.allowedContentTypes : []),
    ];

    for (const raw of inputs) {
      if (!raw) continue;
      const key = typeof raw === 'string' ? raw : (raw as { id?: string; key?: string }).id ?? (raw as { id?: string; key?: string }).key;
      if (!key) continue;
      const resolved = this.resolveCodename(String(key));
      if (resolved) {
        allowed.add(resolved);
      }
    }

    const fallback = platformSpecific.fallbackType;
    if (fallback) {
      const resolved = this.resolveCodename(String(fallback));
      if (resolved) {
        allowed.add(resolved);
      }
    }

    return Array.from(allowed);
  }
}
