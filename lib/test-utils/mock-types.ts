// Type definitions for test mocks to fix @typescript-eslint/no-explicit-any errors

export type MockService<T = Record<string, unknown>> = {
  [K in keyof T]: T[K] extends (...args: unknown[]) => unknown 
    ? jest.MockedFunction<T[K]>
    : T[K];
}

export interface MockComponentService {
  createComponentType: jest.MockedFunction<(data: Record<string, unknown>) => Promise<MockWebsiteComponentType>>;
  getComponentType?: jest.MockedFunction<(id: string) => Promise<MockWebsiteComponentType | null>>;
  updateComponentType?: jest.MockedFunction<(id: string, data: Record<string, unknown>) => Promise<MockWebsiteComponentType>>;
  deleteComponentType?: jest.MockedFunction<(id: string) => Promise<void>>;
  getComponentTypes?: jest.MockedFunction<() => Promise<MockWebsiteComponentType[]>>;
}

export interface MockSharedComponentService {
  createSharedComponent: jest.MockedFunction<(data: Record<string, unknown>) => Promise<MockWebsiteSharedComponent>>;
  getSharedComponent?: jest.MockedFunction<(id: string) => Promise<MockWebsiteSharedComponent | null>>;
  updateSharedComponent?: jest.MockedFunction<(id: string, data: Record<string, unknown>) => Promise<MockWebsiteSharedComponent>>;
  deleteSharedComponent?: jest.MockedFunction<(id: string) => Promise<void>>;
  getSharedComponents?: jest.MockedFunction<() => Promise<MockWebsiteSharedComponent[]>>;
}

export interface MockContentDataService {
  createContentData: jest.MockedFunction<(data: Record<string, unknown>) => Promise<MockCustomContentData>>;
  getContentData?: jest.MockedFunction<(id: string) => Promise<MockCustomContentData | null>>;
  updateContentData?: jest.MockedFunction<(id: string, data: Record<string, unknown>) => Promise<MockCustomContentData>>;
  deleteContentData?: jest.MockedFunction<(id: string) => Promise<void>>;
  getContentDataList?: jest.MockedFunction<() => Promise<MockCustomContentData[]>>;
}

export interface MockPageService {
  getPage: jest.MockedFunction<(id: string) => Promise<MockPageData | null>>;
  updatePage?: jest.MockedFunction<(id: string, data: Record<string, unknown>) => Promise<MockPageData>>;
  deletePage?: jest.MockedFunction<(id: string) => Promise<void>>;
  createPage?: jest.MockedFunction<(data: Record<string, unknown>) => Promise<MockPageData>>;
  getPages?: jest.MockedFunction<() => Promise<MockPageData[]>>;
}

// Test data interfaces
export interface MockWebsiteSharedComponent {
  id: string;
  websiteId: string;
  websiteComponentTypeId: string;
  name: string;
  config: Record<string, unknown>;
  version: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  websiteComponentType?: {
    id: string;
    type: string;
    name: string;
  };
  website?: {
    id: string;
    name: string;
  };
}

export interface MockWebsiteComponentType {
  id: string;
  type: string;
  category: string;
  name: string;
  description?: string;
  icon?: string;
  defaultProperties: Record<string, unknown>;
  defaultContent: Record<string, unknown>;
  defaultStyles: Record<string, unknown>;
  aiMetadata: Record<string, unknown>;
  schema: Record<string, unknown>;
  version: string;
  isActive: boolean;
  isLocked: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface MockCustomContentData {
  id: string;
  contentTypeId: string;
  websiteId: string;
  title: string;
  data: Record<string, unknown>;
  metadata: Record<string, unknown>;
  status: string;
  publishedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  contentType?: {
    id: string;
    name: string;
  };
  website?: {
    id: string;
    name: string;
  };
}

export interface MockPageData {
  id: string;
  title: string;
  type: string;
  status: string;
  content?: {
    components: unknown[];
  };
  websiteId?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

// Constructor types for mocked classes
export interface MockedClass<T> {
  new (...args: unknown[]): T;
}

export interface MockConstructor<T> {
  new (...args: unknown[]): T;
}