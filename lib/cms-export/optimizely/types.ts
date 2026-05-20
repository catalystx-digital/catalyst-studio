export interface OptimizelyContentType {
  key: string;
  name: string;
  guid: string;
  displayName: string;
  description: string;
  baseType: string;
  source: string;
  sortOrder: number;
  mayContainTypes: string[];
  properties: Record<string, OptimizelyProperty>;
  etag?: string | null;
}

export interface OptimizelyProperty {
  type: string;
  displayName: string;
  required: boolean;
  description?: string;
  contentType?: string; // Required when type is 'component'
  // Support for content area (array of content) and richer property metadata
  items?: {
    type: string; // e.g., 'content'
    allowedTypes?: string[];
    restrictedTypes?: string[];
  };
  allowedTypes?: string[];
  restrictedTypes?: string[];
  localized?: boolean;
  group?: string;
  sortOrder?: number;
}

export interface OptimizelyContentTypeResponse extends OptimizelyContentType {
  etag: string | null;
}

export interface OptimizelyValidation {
  required?: boolean;
  pattern?: string;
  minLength?: number;
  maxLength?: number;
  minValue?: number;
  maxValue?: number;
  customValidators?: string[];
  errorMessage?: string;
}

export interface OptimizelyResponse<T = unknown> {
  data?: T;
  error?: OptimizelyError;
  metadata?: {
    total?: number;
    page?: number;
    pageSize?: number;
  };
}

export interface OptimizelyErrorDetails {
  field?: string;
  reason?: string;
  value?: unknown;
}

export interface OptimizelyError {
  code: string;
  message: string;
  details?: OptimizelyErrorDetails | OptimizelyErrorDetails[];
  statusCode?: number;
}

export class OptimizelyConnectionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OptimizelyConnectionError';
  }
}

export class OptimizelyValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OptimizelyValidationError';
  }
}

export class OptimizelyTransformationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OptimizelyTransformationError';
  }
}

export type OptimizelyPropertyValue = 
  | string 
  | number 
  | boolean 
  | Date 
  | null
  | undefined
  | OptimizelyPropertyValue[]
  | { [key: string]: OptimizelyPropertyValue };

export interface OptimizelyContentItem {
  contentGuid: string;
  contentTypeGuid: string;
  name: string;
  displayName?: string;
  urlSegment: string;
  language: string;
  properties: Record<string, OptimizelyPropertyValue>;
  status: OptimizelyContentStatus;
  created: string;
  changed: string;
  published?: string;
  parentLink?: string;
  routeSegment?: string;
  contentLink?: {
    id: number;
    workId?: number;
    guidValue: string;
    providerName?: string;
    url?: string;
  };
}

export type OptimizelyContentStatus = 
  | 'CheckedOut'
  | 'Published' 
  | 'PreviouslyPublished'
  | 'Rejected'
  | 'CheckedIn'
  | 'DelayedPublish'
  | 'AwaitingApproval';

export interface OptimizelyContentFilter {
  contentTypeId?: string;
  language?: string;
  status?: OptimizelyContentStatus[];
  parentLink?: string;
  searchText?: string;
  modifiedAfter?: string;
  modifiedBefore?: string;
  publishedAfter?: string;
  publishedBefore?: string;
}

export interface OptimizelyPaginationOptions {
  top?: number;
  skip?: number;
  orderby?: string;
  select?: string[];
  expand?: string[];
}

export interface OptimizelyListResponse<T> {
  items: T[];
  total?: number;
  totalCount?: number;
  continuationToken?: string;
}

export interface OptimizelyValidationResponse {
  isValid: boolean;
  errors?: Array<{
    field?: string;
    message: string;
    code?: string;
  }>;
  warnings?: Array<{
    field?: string;
    message: string;
    code?: string;
  }>;
}
