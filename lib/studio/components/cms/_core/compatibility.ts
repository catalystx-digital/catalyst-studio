import { PrismaClient } from '@/lib/generated/prisma';
type MigrationConfigModule = {
  useCMSComponentForRead?: () => boolean
  useCMSComponentForWrite?: () => boolean
  useLegacyComponentForRead?: () => boolean
  useLegacyComponentForWrite?: () => boolean
  getCurrentPhase?: () => string
}

let migrationConfig: MigrationConfigModule = {}
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  migrationConfig = require('@/lib/studio/config/migration') as MigrationConfigModule
} catch {
  migrationConfig = {}
}

const useCMSComponentForRead = migrationConfig.useCMSComponentForRead ?? (() => false)
const useCMSComponentForWrite = migrationConfig.useCMSComponentForWrite ?? (() => false)
const useLegacyComponentForRead = migrationConfig.useLegacyComponentForRead ?? (() => true)
const useLegacyComponentForWrite = migrationConfig.useLegacyComponentForWrite ?? (() => true)
const getCurrentPhase = migrationConfig.getCurrentPhase ?? (() => 'legacy')

/**
 * Backward compatibility layer for CMS components
 * Handles dual-read/write operations during migration period
 */
export class ComponentCompatibilityLayer {
  private prisma: PrismaClient;
  private deprecationWarnings: Set<string> = new Set();

  constructor(prisma?: PrismaClient) {
    this.prisma = prisma || new PrismaClient();
  }

  /**
   * Read a component with backward compatibility
   * Attempts to read from appropriate storage based on migration phase
   */
  async readComponent(websiteId: string, componentId: string): Promise<any> {
    const phase = getCurrentPhase();
    
    // Try reading from new storage first if enabled
    if (useCMSComponentForRead()) {
      try {
        const component = await this.prisma.websiteComponentType.findFirst({
          where: {
            websiteId,
            id: componentId
          }
        });

        if (component) {
          return this.mapCMSComponentToLegacy(component);
        }
      } catch (error) {
        if (process.env.NODE_ENV === 'development') {
        console.error('[Compatibility] Error reading from CMSComponent:', error);
        }
      }
    }

    // Fallback to legacy storage
    if (useLegacyComponentForRead()) {
      this.logDeprecationWarning('readComponent', 'Reading from legacy ContentItem storage');
      
      const legacyComponent = await this.prisma.websitePage.findFirst({
        where: {
          websiteId,
          id: componentId,
          contentType: {
            category: 'component'
          }
        },
        include: {
          contentType: true
        }
      });

      if (legacyComponent) {
        return legacyComponent;
      }
    }

    return null;
  }

  /**
   * Write a component with backward compatibility
   * Writes to appropriate storage based on migration phase
   */
  async writeComponent(websiteId: string, componentData: any): Promise<any> {
    const results: any = {};

    // Write to new storage if enabled
    if (useCMSComponentForWrite()) {
      try {
        const cmsComponent = await this.prisma.websiteComponentType.create({
          data: {
            type: componentData.type,
            category: componentData.category,
            version: componentData.version || '1.0.0',
            defaultConfig: componentData.props || {},
            placeholderData: componentData.content || {},
            styles: componentData.styles || null,
            aiMetadata: componentData.aiMetadata || {},
            confidence: componentData.confidence || 0,
            websiteId,
            createdBy: componentData.createdBy,
            updatedBy: componentData.updatedBy
          }
        });
        results.cmsComponent = cmsComponent;
      } catch (error) {
        if (process.env.NODE_ENV === 'development') {
        console.error('[Compatibility] Error writing to CMSComponent:', error);
        }
      }
    }

    // Write to legacy storage if enabled
    if (useLegacyComponentForWrite()) {
      this.logDeprecationWarning('writeComponent', 'Writing to legacy ContentItem storage');
      
      try {
        // Find or create component content type
        const contentType = await this.findOrCreateComponentContentType(
          websiteId,
          componentData.type
        );

        const contentItem = await this.prisma.websitePage.create({
          data: {
            contentTypeId: contentType.id,
            websiteId,
            type: 'page',
            title: componentData.title || componentData.type,
            status: 'published',
            content: {
              props: componentData.props,
              content: componentData.content,
              styles: componentData.styles
            },
            metadata: componentData.metadata
          }
        });
        results.contentItem = contentItem;
      } catch (error) {
        if (process.env.NODE_ENV === 'development') {
        console.error('[Compatibility] Error writing to ContentItem:', error);
        }
      }
    }

    return results;
  }

  /**
   * List components with backward compatibility
   */
  async listComponents(websiteId: string, category?: string): Promise<any[]> {
    const components: any[] = [];

    // Read from new storage if enabled
    if (useCMSComponentForRead()) {
      try {
        const cmsComponents = await this.prisma.websiteComponentType.findMany({
          where: {
            websiteId,
            ...(category && { category })
          }
        });
        components.push(...cmsComponents.map(c => this.mapCMSComponentToLegacy(c)));
      } catch (error) {
        if (process.env.NODE_ENV === 'development') {
        console.error('[Compatibility] Error listing from CMSComponent:', error);
        }
      }
    }

    // Read from legacy storage if enabled (and not already using new)
    if (useLegacyComponentForRead() && !useCMSComponentForRead()) {
      this.logDeprecationWarning('listComponents', 'Listing from legacy ContentItem storage');
      
      const legacyComponents = await this.prisma.websitePage.findMany({
        where: {
          websiteId,
          contentType: {
            category: 'component'
          }
        },
        include: {
          contentType: true
        }
      });
      components.push(...legacyComponents);
    }

    return components;
  }

  /**
   * Map CMSComponent to legacy ContentItem format
   */
  private mapCMSComponentToLegacy(cmsComponent: any): any {
    return {
      id: cmsComponent.id,
      websiteId: cmsComponent.websiteId,
      title: cmsComponent.type,
      slug: this.generateSlug(cmsComponent.type),
      status: 'published',
      content: {
        props: cmsComponent.props,
        content: cmsComponent.content,
        styles: cmsComponent.styles
      },
      metadata: {
        aiMetadata: cmsComponent.aiMetadata,
        confidence: cmsComponent.confidence,
        version: cmsComponent.version
      },
      createdAt: cmsComponent.createdAt,
      updatedAt: cmsComponent.updatedAt,
      // Mark as migrated for identification
      _migrated: true,
      _source: 'CMSComponent'
    };
  }

  /**
   * Find or create a component content type
   */
  private async findOrCreateComponentContentType(websiteId: string, componentType: string) {
    const existing = await this.prisma.contentType.findFirst({
      where: {
        websiteId,
        key: componentType,
        category: 'component'
      }
    });

    if (existing) {
      return existing;
    }

    return await this.prisma.contentType.create({
      data: {
        websiteId,
        key: componentType,
        name: this.formatComponentName(componentType),
        pluralName: this.formatComponentName(componentType) + 's',
        category: 'component',
        fields: {
          props: { type: 'json' },
          content: { type: 'json' },
          styles: { type: 'json', optional: true }
        }
      }
    });
  }

  /**
   * Generate a URL-safe slug from component type
   */
  private generateSlug(type: string): string {
    return type
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  /**
   * Format component type as display name
   */
  private formatComponentName(type: string): string {
    return type
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  /**
   * Log deprecation warning (only once per warning type)
   */
  private logDeprecationWarning(operation: string, message: string): void {
    const warningKey = `${operation}:${message}`;
    if (!this.deprecationWarnings.has(warningKey)) {
      if (process.env.NODE_ENV === 'development') {
      console.warn(`[DEPRECATION] ${message} - This will be removed after 6-month transition period`);
      }
      this.deprecationWarnings.add(warningKey);
    }
  }

  /**
   * Get migration statistics
   */
  async getMigrationStats(websiteId: string): Promise<any> {
    const stats: any = {
      phase: getCurrentPhase(),
      counts: {}
    };

    // Count new components
    if (useCMSComponentForRead()) {
      stats.counts.cmsComponents = await this.prisma.websiteComponentType.count({
        where: { websiteId }
      });
    }

    // Count legacy components
    if (useLegacyComponentForRead()) {
      stats.counts.legacyComponents = await this.prisma.websitePage.count({
        where: {
          websiteId,
          contentType: {
            category: 'component'
          }
        }
      });
    }

    stats.migrationProgress = stats.counts.cmsComponents 
      ? (stats.counts.cmsComponents / (stats.counts.legacyComponents || 1)) * 100 
      : 0;

    return stats;
  }

  /**
   * Perform consistency check between storages
   */
  async consistencyCheck(websiteId: string): Promise<any> {
    if (getCurrentPhase() !== 'dual') {
      return { 
        skipped: true, 
        reason: 'Consistency check only runs in dual mode' 
      };
    }

    const issues: any[] = [];

    // Get components from both storages
    const cmsComponents = await this.prisma.websiteComponentType.findMany({
      where: { websiteId }
    });

    const legacyComponents = await this.prisma.websitePage.findMany({
      where: {
        websiteId,
        contentType: {
          category: 'component'
        }
      }
    });

    // Check for mismatches
    const cmsIds = new Set(cmsComponents.map(c => c.id));
    const legacyIds = new Set(legacyComponents.map(c => c.id));

    // Components only in CMS
    for (const id of Array.from(cmsIds)) {
      if (!legacyIds.has(id)) {
        issues.push({
          type: 'missing_in_legacy',
          componentId: id
        });
      }
    }

    // Components only in legacy
    for (const id of Array.from(legacyIds)) {
      if (!cmsIds.has(id)) {
        issues.push({
          type: 'missing_in_cms',
          componentId: id
        });
      }
    }

    return {
      consistent: issues.length === 0,
      issues,
      cmsCount: cmsComponents.length,
      legacyCount: legacyComponents.length
    };
  }
}
