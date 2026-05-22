import { PrismaClient } from '@/lib/generated/prisma';

/**
 * Component storage access layer.
 *
 * CMS component types are stored only in WebsiteComponentType.
 */
export class ComponentCompatibilityLayer {
  private prisma: PrismaClient;

  constructor(prisma?: PrismaClient) {
    this.prisma = prisma || new PrismaClient();
  }

  async readComponent(websiteId: string, componentId: string): Promise<any> {
    const component = await this.prisma.websiteComponentType.findFirst({
      where: {
        websiteId,
        id: componentId
      }
    });

    return component ? this.mapComponentType(component) : null;
  }

  async writeComponent(websiteId: string, componentData: any): Promise<any> {
    const component = await this.prisma.websiteComponentType.create({
      data: {
        type: componentData.type,
        category: componentData.category,
        version: componentData.version || '1.0.0',
        defaultConfig: componentData.defaultConfig ?? {},
        placeholderData: componentData.placeholderData ?? {},
        styles: componentData.styles || null,
        aiMetadata: componentData.aiMetadata || {},
        confidence: componentData.confidence || 0,
        isGlobal: componentData.isGlobal || false,
        websiteId,
        createdBy: componentData.createdBy,
        updatedBy: componentData.updatedBy
      }
    });

    return this.mapComponentType(component);
  }

  async listComponents(websiteId: string, category?: string): Promise<any[]> {
    const components = await this.prisma.websiteComponentType.findMany({
      where: {
        websiteId,
        ...(category && { category })
      },
      orderBy: {
        createdAt: 'asc'
      }
    });

    return components.map(component => this.mapComponentType(component));
  }

  async getMigrationStats(websiteId: string): Promise<any> {
    const [componentCount, categories] = await Promise.all([
      this.prisma.websiteComponentType.count({
        where: { websiteId }
      }),
      this.prisma.websiteComponentType.groupBy({
        by: ['category'],
        where: { websiteId },
        _count: {
          _all: true
        }
      })
    ]);

    return {
      storage: 'websiteComponentType',
      counts: {
        components: componentCount,
        categories: Object.fromEntries(
          categories.map(category => [category.category, category._count._all])
        )
      }
    };
  }

  async consistencyCheck(websiteId: string): Promise<any> {
    const components = await this.prisma.websiteComponentType.findMany({
      where: { websiteId },
      select: {
        id: true,
        type: true,
        category: true,
        version: true
      }
    });

    const issues: Array<{
      type: string
      componentId?: string
      componentType?: string
      version?: string
      category?: string
    }> = [];
    const componentKeys = new Map<string, string>();

    for (const component of components) {
      if (!component.type.trim()) {
        issues.push({ type: 'missing_type', componentId: component.id });
      }

      if (!component.category.trim()) {
        issues.push({ type: 'missing_category', componentId: component.id });
      }

      const key = `${component.type}:${component.version}:${component.category}`;
      const existingId = componentKeys.get(key);
      if (existingId) {
        issues.push({
          type: 'duplicate_component_type',
          componentId: component.id,
          componentType: component.type,
          version: component.version,
          category: component.category
        });
      } else {
        componentKeys.set(key, component.id);
      }
    }

    return {
      consistent: issues.length === 0,
      issues,
      componentCount: components.length
    };
  }

  private mapComponentType(component: any): any {
    return {
      id: component.id,
      websiteId: component.websiteId,
      type: component.type,
      category: component.category,
      version: component.version,
      defaultConfig: component.defaultConfig,
      placeholderData: component.placeholderData,
      styles: component.styles,
      aiMetadata: component.aiMetadata,
      confidence: component.confidence,
      isGlobal: component.isGlobal,
      createdAt: component.createdAt,
      updatedAt: component.updatedAt,
      createdBy: component.createdBy,
      updatedBy: component.updatedBy,
      _source: 'WebsiteComponentType'
    };
  }
}
