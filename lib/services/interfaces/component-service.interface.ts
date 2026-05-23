import { WebsiteComponentType, WebsiteSharedComponent, Prisma } from '@/lib/generated/prisma';

export interface CreateComponentTypeDto {
  type: string;
  category: string;
  version?: string;
  websiteId: string;
  defaultConfig?: any;
  placeholderData?: any;
  styles?: any;
  aiMetadata?: any;
  confidence?: number;
  isGlobal?: boolean;
  createdBy?: string;
  updatedBy?: string;
}

export interface UpdateComponentTypeDto {
  type?: string;
  category?: string;
  version?: string;
  defaultConfig?: any;
  placeholderData?: any;
  styles?: any;
  aiMetadata?: any;
  confidence?: number;
  isGlobal?: boolean;
  updatedBy?: string;
}

export interface CreateSharedComponentDto {
  websiteId: string;
  websiteComponentTypeId: string;
  name: string;
  content: Record<string, unknown>;
  config?: Record<string, unknown>;
  createdBy?: string;
  updatedBy?: string;
}

export interface UpdateSharedComponentDto {
  name?: string;
  content?: Record<string, unknown>;
  config?: Record<string, unknown>;
  updatedBy?: string;
}

export interface ComponentTypeWithShared extends WebsiteComponentType {
  sharedComponents?: WebsiteSharedComponent[];
}

/**
 * Service interface for WebsiteComponentType operations
 */
export interface IComponentService {
  /**
   * Create a new component type
   */
  createComponentType(data: CreateComponentTypeDto): Promise<WebsiteComponentType>;

  /**
   * Get component type by ID
   */
  getComponentType(id: string): Promise<WebsiteComponentType | null>;

  /**
   * Get component type by type and category
   */
  getComponentTypeByType(type: string, category?: string): Promise<WebsiteComponentType | null>;

  /**
   * Update component type
   */
  updateComponentType(id: string, data: UpdateComponentTypeDto): Promise<WebsiteComponentType>;

  /**
   * Delete component type
   */
  deleteComponentType(id: string): Promise<void>;

  /**
   * Get all component types
   */
  getAllComponentTypes(includeInactive?: boolean): Promise<WebsiteComponentType[]>;

  /**
   * Get component types by category
   */
  getComponentTypesByCategory(category: string): Promise<WebsiteComponentType[]>;

  /**
   * Clone a component type
   */
  cloneComponentType(id: string, newType: string): Promise<WebsiteComponentType>;

  /**
   * Lock/unlock component type for editing
   */
  setComponentTypeLocked(id: string, isLocked: boolean): Promise<WebsiteComponentType>;

  /**
   * Activate/deactivate component type
   */
  setComponentTypeActive(id: string, isActive: boolean): Promise<WebsiteComponentType>;

  /**
   * Validate component properties against schema
   */
  validateComponentProperties(componentTypeId: string, properties: any): Promise<boolean>;
}

/**
 * Service interface for WebsiteSharedComponent operations
 */
export interface ISharedComponentService {
  /**
   * Create a new shared component
   */
  createSharedComponent(data: CreateSharedComponentDto): Promise<WebsiteSharedComponent>;

  /**
   * Get shared component by ID
   */
  getSharedComponent(id: string): Promise<WebsiteSharedComponent | null>;

  /**
   * Get shared component with its type
   */
  getSharedComponentWithType(id: string): Promise<WebsiteSharedComponent & { componentType?: WebsiteComponentType | null }>;

  /**
   * Update shared component
   */
  updateSharedComponent(id: string, data: UpdateSharedComponentDto): Promise<WebsiteSharedComponent>;

  /**
   * Delete shared component
   */
  deleteSharedComponent(id: string): Promise<void>;

  /**
   * Get all shared components for a website
   */
  getSharedComponentsByWebsite(websiteId: string): Promise<WebsiteSharedComponent[]>;

  /**
   * Get shared components by type
   */
  getSharedComponentsByType(websiteId: string, componentTypeId: string): Promise<WebsiteSharedComponent[]>;

  /**
   * Clone a shared component
   */
  cloneSharedComponent(id: string, newName?: string): Promise<WebsiteSharedComponent>;

  /**
   * Get usage count for a shared component
   */
  getSharedComponentUsageCount(id: string): Promise<number>;

  /**
   * Find pages using a shared component
   */
  findPagesUsingSharedComponent(id: string): Promise<string[]>;

  /**
   * Update shared component version
   */
  updateSharedComponentVersion(id: string, version: string): Promise<WebsiteSharedComponent>;

  /**
   * Activate/deactivate shared component
   */
  setSharedComponentActive(id: string, isActive: boolean): Promise<WebsiteSharedComponent>;
}
