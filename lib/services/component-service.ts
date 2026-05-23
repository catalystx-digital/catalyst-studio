import { PrismaClient, WebsiteComponentType, WebsiteSharedComponent, Prisma } from '@/lib/generated/prisma';
import {
  IComponentService,
  ISharedComponentService,
  CreateComponentTypeDto,
  UpdateComponentTypeDto,
  CreateSharedComponentDto,
  UpdateSharedComponentDto,
  ComponentTypeWithShared
} from './interfaces/component-service.interface';

function hasOwn(value: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function validateSharedComponentConfig(config: unknown): Prisma.InputJsonValue {
  if (!config || typeof config !== 'object' || Array.isArray(config)) {
    return {} as Prisma.InputJsonValue;
  }

  const metadata = config as Record<string, unknown>;
  if (hasOwn(metadata, 'defaultProps')) {
    throw new Error('Shared component config.defaultProps is not accepted; store shared defaults in content.');
  }
  return metadata as Prisma.InputJsonValue;
}

function componentTreeUsesSharedComponent(components: unknown, sharedComponentId: string): boolean {
  if (!Array.isArray(components)) {
    return false;
  }

  return components.some((component) => {
    if (!component || typeof component !== 'object') {
      return false;
    }

    const record = component as Record<string, unknown>;
    const props = record.props && typeof record.props === 'object' && !Array.isArray(record.props)
      ? record.props as Record<string, unknown>
      : {};

    if (props.sharedComponentId === sharedComponentId) {
      return true;
    }

    return componentTreeUsesSharedComponent(record.children, sharedComponentId);
  });
}

export class ComponentService implements IComponentService {
  constructor(private prisma: PrismaClient) {}

  async createComponentType(data: CreateComponentTypeDto): Promise<WebsiteComponentType> {
    return await this.prisma.websiteComponentType.create({
      data: {
        type: data.type,
        category: data.category,
        version: data.version || '1.0.0',
        websiteId: data.websiteId,
        defaultConfig: data.defaultConfig || {},
        placeholderData: data.placeholderData || {},
        styles: data.styles || {},
        aiMetadata: data.aiMetadata || {},
        confidence: data.confidence || 0,
        isGlobal: data.isGlobal ?? false,
        createdBy: data.createdBy,
        updatedBy: data.updatedBy
      }
    });
  }

  async getComponentType(id: string): Promise<WebsiteComponentType | null> {
    return await this.prisma.websiteComponentType.findUnique({
      where: { id }
    });
  }

  async getComponentTypeByType(type: string, category?: string): Promise<WebsiteComponentType | null> {
    const where: Prisma.WebsiteComponentTypeWhereInput = { type };
    
    if (category) {
      where.category = category;
    }

    return await this.prisma.websiteComponentType.findFirst({
      where
    });
  }

  async updateComponentType(id: string, data: UpdateComponentTypeDto): Promise<WebsiteComponentType> {
    return await this.prisma.websiteComponentType.update({
      where: { id },
      data
    });
  }

  async deleteComponentType(id: string): Promise<void> {
    // Check if there are shared components using this type
    const sharedComponents = await this.prisma.websiteSharedComponent.findFirst({
      where: { websiteComponentTypeId: id }
    });

    if (sharedComponents) {
      throw new Error('Cannot delete component type that has shared components');
    }

    await this.prisma.websiteComponentType.delete({
      where: { id }
    });
  }

  async getAllComponentTypes(includeInactive: boolean = false): Promise<WebsiteComponentType[]> {
    return await this.prisma.websiteComponentType.findMany({
      orderBy: [
        { category: 'asc' },
        { type: 'asc' }
      ]
    });
  }

  async getComponentTypesByCategory(category: string): Promise<WebsiteComponentType[]> {
    return await this.prisma.websiteComponentType.findMany({
      where: {
        category
      },
      orderBy: { type: 'asc' }
    });
  }

  async cloneComponentType(id: string, newType: string): Promise<WebsiteComponentType> {
    const original = await this.prisma.websiteComponentType.findUnique({
      where: { id }
    });

    if (!original) {
      throw new Error('Component type not found');
    }

    return await this.prisma.websiteComponentType.create({
      data: {
        type: newType,
        category: original.category,
        version: '1.0.0',
        websiteId: original.websiteId,
        defaultConfig: original.defaultConfig as Prisma.InputJsonValue,
        placeholderData: original.placeholderData as Prisma.InputJsonValue,
        styles: original.styles as Prisma.InputJsonValue,
        aiMetadata: original.aiMetadata as Prisma.InputJsonValue,
        confidence: original.confidence,
        isGlobal: original.isGlobal
      }
    });
  }

  async setComponentTypeLocked(id: string, isLocked: boolean): Promise<WebsiteComponentType> {
    // This method is no longer applicable since isLocked field doesn't exist
    throw new Error('Component type locking is not supported in the current schema');
  }

  async setComponentTypeActive(id: string, isActive: boolean): Promise<WebsiteComponentType> {
    // This method is no longer applicable since isActive field doesn't exist
    throw new Error('Component type activation is not supported in the current schema');
  }

  async validateComponentProperties(componentTypeId: string, properties: any): Promise<boolean> {
    const componentType = await this.prisma.websiteComponentType.findUnique({
      where: { id: componentTypeId }
    });

    if (!componentType) {
      throw new Error('Component type not found');
    }

    // Basic validation - for now just check if properties is a valid object
    if (properties && typeof properties === 'object') {
      return true;
    }

    throw new Error('Properties must be a valid object');
  }
}

export class SharedComponentService implements ISharedComponentService {
  constructor(private prisma: PrismaClient) {}

  async createSharedComponent(data: CreateSharedComponentDto): Promise<WebsiteSharedComponent> {
    // Validate component type exists
    const componentType = await this.prisma.websiteComponentType.findUnique({
      where: { id: data.websiteComponentTypeId }
    });

    if (!componentType) {
      throw new Error('Component type not found');
    }

    return await this.prisma.websiteSharedComponent.create({
      data: {
        websiteId: data.websiteId,
        websiteComponentTypeId: data.websiteComponentTypeId,
        name: data.name,
        content: data.content as Prisma.InputJsonValue,
        config: validateSharedComponentConfig(data.config),
        createdBy: data.createdBy,
        updatedBy: data.updatedBy
      }
    });
  }

  async getSharedComponent(id: string): Promise<WebsiteSharedComponent | null> {
    return await this.prisma.websiteSharedComponent.findUnique({
      where: { id }
    });
  }

  async getSharedComponentWithType(id: string): Promise<WebsiteSharedComponent & { componentType?: WebsiteComponentType | null }> {
    const sharedComponent = await this.prisma.websiteSharedComponent.findUnique({
      where: { id }
    });

    if (!sharedComponent) {
      throw new Error('Shared component not found');
    }

    const componentType = await this.prisma.websiteComponentType.findUnique({
      where: { id: sharedComponent.websiteComponentTypeId }
    });

    return { ...sharedComponent, componentType };
  }

  async updateSharedComponent(id: string, data: UpdateSharedComponentDto): Promise<WebsiteSharedComponent> {
    const updateData: Prisma.WebsiteSharedComponentUpdateInput = {};
    if (data.name !== undefined) {
      updateData.name = data.name;
    }
    if (data.updatedBy !== undefined) {
      updateData.updatedBy = data.updatedBy;
    }
    if (data.content !== undefined) {
      updateData.content = data.content as Prisma.InputJsonValue;
    }
    if (data.config !== undefined) {
      updateData.config = validateSharedComponentConfig(data.config);
    }

    return await this.prisma.websiteSharedComponent.update({
      where: { id },
      data: updateData
    });
  }

  async deleteSharedComponent(id: string): Promise<void> {
    // Check usage before deletion
    const usageCount = await this.getSharedComponentUsageCount(id);
    if (usageCount > 0) {
      throw new Error(`Cannot delete shared component that is used in ${usageCount} pages`);
    }

    await this.prisma.websiteSharedComponent.delete({
      where: { id }
    });
  }

  async getSharedComponentsByWebsite(websiteId: string): Promise<WebsiteSharedComponent[]> {
    return await this.prisma.websiteSharedComponent.findMany({
      where: { websiteId },
      orderBy: { name: 'asc' }
    });
  }

  async getSharedComponentsByType(websiteId: string, componentTypeId: string): Promise<WebsiteSharedComponent[]> {
    return await this.prisma.websiteSharedComponent.findMany({
      where: {
        websiteId,
        websiteComponentTypeId: componentTypeId
      },
      orderBy: { name: 'asc' }
    });
  }

  async cloneSharedComponent(id: string, newName?: string): Promise<WebsiteSharedComponent> {
    const original = await this.prisma.websiteSharedComponent.findUnique({
      where: { id }
    });

    if (!original) {
      throw new Error('Shared component not found');
    }

    return await this.prisma.websiteSharedComponent.create({
      data: {
        websiteId: original.websiteId,
        websiteComponentTypeId: original.websiteComponentTypeId,
        name: newName || `${original.name} (Clone)`,
        content: original.content as Prisma.InputJsonValue,
        config: validateSharedComponentConfig(original.config),
        createdBy: original.createdBy ?? undefined,
        updatedBy: original.updatedBy ?? undefined
      }
    });
  }

  async getSharedComponentUsageCount(id: string): Promise<number> {
    const sharedComponent = await this.prisma.websiteSharedComponent.findUnique({
      where: { id }
    });

    if (!sharedComponent) {
      return 0;
    }

    const pages = await this.prisma.websitePage.findMany({
      where: {
        websiteId: sharedComponent.websiteId,
        content: { not: Prisma.DbNull }
      },
      select: { content: true }
    });

    let count = 0;
    for (const page of pages) {
      const content = page.content as any;
      if (componentTreeUsesSharedComponent(content?.components, id)) {
        count++;
      }
    }

    return count;
  }

  async findPagesUsingSharedComponent(id: string): Promise<string[]> {
    const sharedComponent = await this.prisma.websiteSharedComponent.findUnique({
      where: { id }
    });

    if (!sharedComponent) {
      return [];
    }

    const pages = await this.prisma.websitePage.findMany({
      where: {
        websiteId: sharedComponent.websiteId,
        content: { not: Prisma.DbNull }
      },
      select: { id: true, content: true }
    });

    const pageIds: string[] = [];
    for (const page of pages) {
      const content = page.content as any;
      if (componentTreeUsesSharedComponent(content?.components, id)) {
        pageIds.push(page.id);
      }
    }

    return pageIds;
  }

  async updateSharedComponentVersion(id: string, version: string): Promise<WebsiteSharedComponent> {
    // Version field no longer exists in WebsiteSharedComponent
    throw new Error('Shared component versioning is not supported in the current schema');
  }

  async setSharedComponentActive(id: string, isActive: boolean): Promise<WebsiteSharedComponent> {
    // isActive field no longer exists in WebsiteSharedComponent
    throw new Error('Shared component activation is not supported in the current schema');
  }
}
