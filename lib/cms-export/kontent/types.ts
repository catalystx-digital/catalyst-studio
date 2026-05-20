import type { UniversalContentType, UniversalField } from '@/lib/cms-export/universal/types';

export interface KontentClientConfig {
  environmentId?: string;
  managementApiKey?: string;
  languageCodename?: string;
  baseUrl?: string;
  rateLimitMs?: number;
  maxRetries?: number;
  maxConcurrency?: number;
}

export interface KontentElementOption {
  name: string;
  codename: string;
}

export interface KontentContentTypeElement {
  name: string;
  codename: string;
  type:
    | 'text'
    | 'rich_text'
    | 'number'
    | 'date_time'
    | 'asset'
    | 'modular_content'
    | 'multiple_choice'
    | 'json';
  guidelines?: string;
  is_required?: boolean;
  item_count_limit?: {
    condition: 'at_most' | 'at_least';
    value: number;
  };
  allowed_content_types?: Array<{ codename: string }>;
  options?: KontentElementOption[];
  default?: unknown;
  mode?: 'singleline' | 'multiline' | 'single' | 'multiple';
  allow_multiple?: boolean;
  allows_duplicate_values?: boolean;
  allow_decimal?: boolean;
  platformSpecific?: Record<string, unknown>;
}

export interface KontentContentType {
  name: string;
  codename: string;
  external_id?: string;
  elements: KontentContentTypeElement[];
  content_group?: string;
  workflow?: {
    id?: string;
    codename?: string;
  };
  platformSpecific?: Record<string, unknown>;
}

export interface KontentItemPayload {
  name: string;
  codename: string;
  type: { codename: string };
  external_id?: string;
  collection?: { codename: string };
}

export interface KontentVariantElement {
  element: { codename: string };
  value?:
    | string
    | number
    | boolean
    | Array<{ codename: string }>
    | Array<{ id?: string; codename?: string }>
    | null;
}

export interface KontentVariantUpsert {
  elements: KontentVariantElement[];
}

export interface KontentContentItem {
  id: string;
  name: string;
  codename: string;
  type: { id?: string; codename?: string };
}

export interface KontentTypeMapperContext {
  resolveTypeCodename: (typeIdOrKey: string) => string | undefined;
}

export interface KontentFieldMappingResult {
  element: KontentContentTypeElement;
  universalField: UniversalField;
}

export interface KontentTypeMappingResult {
  contentType: KontentContentType;
  fieldMappings: KontentFieldMappingResult[];
  source: UniversalContentType;
}

export type KontentElementValue =
  | string
  | number
  | boolean
  | Array<{ codename: string }>
  | null
  | undefined;

export interface KontentItemUpsertResult {
  item: KontentContentItem;
  variant: KontentVariantUpsert;
}
