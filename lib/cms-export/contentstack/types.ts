export interface ContentstackClientConfig {
  baseUrl?: string;
  stackApiKey?: string;
  managementToken?: string;
  environment?: string;
  locale?: string;
  branch?: string;
  rateLimitMs?: number;
  maxRetries?: number;
  verifyDelayMs?: number;
}

export interface ContentstackContentTypeField {
  display_name: string;
  uid: string;
  data_type: string;
  mandatory?: boolean;
  multiple?: boolean;
  unique?: boolean;
  field_metadata?: Record<string, unknown>;
  reference_to?: string[];
  schema?: ContentstackContentTypeField[];
}

export interface ContentstackContentTypeDefinition {
  title: string;
  uid: string;
  description?: string;
  schema: ContentstackContentTypeField[];
  options?: Record<string, unknown>;
}

export interface ContentstackEntryReference {
  uid: string;
  _content_type_uid: string;
}

export type ContentstackEntryData = Record<string, unknown>;

