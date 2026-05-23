// Base response types
export type ApiResponse<T> =
  | { data: T }
  | { error: ApiError };

export interface ApiError {
  message: string;
  code?: string;
  details?: any;
}

// Design System types
export interface DesignSystem {
  palette: {
    primary: Array<{
      value: string;
      name?: string;
      confidence: number;
      source: string;
      usageCount?: number;
      hex?: string;
    }>;
    secondary: Array<{
      value: string;
      name?: string;
      confidence: number;
      source: string;
      usageCount?: number;
      hex?: string;
    }>;
    accent: Array<{
      value: string;
      name?: string;
      confidence: number;
      source: string;
      usageCount?: number;
      hex?: string;
    }>;
    neutral: Array<{
      value: string;
      name?: string;
      confidence: number;
      source: string;
      usageCount?: number;
      hex?: string;
    }>;
    surface: Array<{
      value: string;
      name?: string;
      confidence: number;
      source: string;
      usageCount?: number;
      hex?: string;
    }>;
  };
  typography: {
    heading: Array<{
      fontFamily: string;
      fontSize?: string;
      fontWeight?: number | string;
      lineHeight?: string;
      letterSpacing?: string;
      name?: string;
      confidence: number;
      source: string;
      usageCount?: number;
    }>;
    body: Array<{
      fontFamily: string;
      fontSize?: string;
      fontWeight?: number | string;
      lineHeight?: string;
      letterSpacing?: string;
      name?: string;
      confidence: number;
      source: string;
      usageCount?: number;
    }>;
    ui: Array<{
      fontFamily: string;
      fontSize?: string;
      fontWeight?: number | string;
      lineHeight?: string;
      letterSpacing?: string;
      name?: string;
      confidence: number;
      source: string;
      usageCount?: number;
    }>;
  };
  spacing: {
    name: string;
    values: Array<{
      step: number;
      value: number;
      name?: string;
    }>;
    unit: string;
    base?: number;
    confidence: number;
    source: string;
  };
  radii: {
    name: string;
    values: Array<{
      step: number;
      value: number;
      name?: string;
    }>;
    unit: string;
    confidence: number;
    source: string;
  };
  shadows: Array<{
    name?: string;
    value: string;
    confidence: number;
    source: string;
    usageCount?: number;
  }>;
  effects: Array<{
    name?: string;
    type: string;
    value: string;
    confidence: number;
    source: string;
  }>;
  metadata: {
    sourceUrls: string[];
    capturedAt: string;
    confidence: number;
    extractionMethod: string;
    version: string;
  };
  diagnostics: Array<{
    type: string;
    code: string;
    message: string;
    source: string;
    severity: string;
    tokenRef?: string;
  }>;
  version: string;
}

// Website model types
export interface WebsiteMediaReference {
  mediaId: string;
  originalUrl?: string | null;
  signedUrl?: string | null;
  publicUrl?: string | null;
  altText?: string | null;
  [key: string]: unknown;
}

export type WebsiteIconValue = string | WebsiteMediaReference;

export interface WebsiteSettings {
  primaryColor?: string;
  secondaryColor?: string;
  features?: {
    blog?: boolean;
    shop?: boolean;
    analytics?: boolean;
  };
  [key: string]: any;
}

export interface Website {
  id: string;
  accountId?: string;
  name: string;
  description?: string;
  category: string;
  metadata?: Record<string, any>;
  icon?: WebsiteIconValue;
  settings?: WebsiteSettings;
  designSystem?: DesignSystem;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type AccountApiKeyScope = 'ACCOUNT_READ' | 'WEBSITE_READ';
export type AccountApiKeyStatus = 'active' | 'revoked';

export interface AccountApiKeySummary {
  id: string;
  accountId: string;
  websiteId: string | null;
  label: string;
  scopes: AccountApiKeyScope[];
  status: AccountApiKeyStatus;
  issuedAt: Date;
  issuedBy: string | null;
  expiresAt: Date | null;
  lastUsedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  keyPreview: string;
  hasSecondaryKey: boolean;
}

export interface AccountApiKeyAuditEvent {
  id: string;
  apiKeyId: string;
  accountId: string;
  websiteId: string | null;
  action: 'issued' | 'rotated' | 'revoked' | 'usage';
  actorId: string | null;
  metadata: Record<string, unknown> | null;
  occurredAt: Date;
}

export interface CreateAccountApiKeyRequest {
  label: string;
  websiteId?: string;
  scopes?: AccountApiKeyScope[];
  expiresAt?: string;
}

export interface CreateAccountApiKeyResponse {
  key: AccountApiKeySummary;
  plaintextKey: string;
}

export interface RotateAccountApiKeyResponse {
  key: AccountApiKeySummary;
  plaintextKey: string;
}

export interface CreateWebsiteRequest {
  name: string;
  description?: string;
  category: string;
  metadata?: Record<string, any>;
  icon?: WebsiteIconValue;
  settings?: WebsiteSettings;
  isActive?: boolean;
}

export interface UpdateWebsiteRequest extends Partial<CreateWebsiteRequest> {}

// ContentType model types
export interface ContentType {
  id: string;
  websiteId: string;
  name: string;
  fields: any;
  settings?: any;
  category?: 'page' | 'component' | 'folder';
  createdAt: Date;
  updatedAt: Date;
}

// ContentItem model types
export type ContentStatus = 'draft' | 'published' | 'archived';

export interface ContentItem {
  id: string;
  contentTypeId: string;
  websiteId: string;
  title: string;
  slug: string;
  content: Record<string, any>;
  metadata?: Record<string, any>;
  status: ContentStatus;
  publishedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
  contentType?: ContentType;
  website?: Website;
  modelType?: 'websitePage';
}

// New model types for refactored API
export interface WebsitePage {
  id: string;
  websiteId: string;
  type: string;
  title: string;
  content?: Record<string, any>;
  metadata?: Record<string, any>;
  contentTypeId: string;
  status: string;
  publishedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
  contentType?: ContentType;
  website?: Website;
}

export interface PageContentResponse {
  page?: WebsitePage;
  modelType?: 'websitePage';
}

export interface CreateContentItemRequest {
  contentTypeId: string;
  websiteId: string;
  title: string;
  slug: string;
  content: Record<string, any>;
  metadata?: Record<string, any>;
  status?: ContentStatus;
  publishedAt?: Date | string | null;
}

export interface UpdateContentItemRequest {
  title?: string;
  slug?: string;
  content?: Record<string, any>;
  metadata?: Record<string, any>;
  status?: ContentStatus;
  publishedAt?: Date | string | null;
}

export interface ContentItemsQuery extends PaginationParams {
  status?: ContentStatus;
  contentTypeId?: string;
  websiteId?: string;
}

export interface ContentItemsResponse extends PaginatedResponse<ContentItem> {
  data: ContentItem[];
}

// Pagination types for future use
export interface PaginationParams {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

