import { getClient } from '@/lib/db/client';
import { Website, CreateWebsiteRequest, UpdateWebsiteRequest, WebsiteSettings, WebsiteIconValue } from '@/types/api';
import { ApiError } from '@/lib/api/errors';
import { Prisma } from '@/lib/generated/prisma';
import type { PrismaClient } from '@/lib/generated/prisma';
import type { Website as PrismaWebsite } from '@/lib/generated/prisma';
import { deleteWebsiteWithDependencies } from '@/lib/services/website-delete-service';

export interface WebsiteConnectionOptions {
  accountId: string;
  first: number;
  after?: string | null;
  websiteId?: string | null;
  includeInactive?: boolean;
}

export interface WebsiteConnectionEdge {
  cursor: string;
  node: Website;
}

export interface WebsiteConnectionPayload {
  edges: WebsiteConnectionEdge[];
  pageInfo: {
    endCursor: string | null;
    hasNextPage: boolean;
  };
  totalCount: number;
}


function normalizeWebsiteIcon(value: unknown): WebsiteIconValue | undefined {
  if (value === null || value === undefined) {
    return undefined;
  }
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const mediaId = typeof record.mediaId === 'string' ? record.mediaId : undefined;
    if (mediaId) {
      const normalized: Record<string, unknown> = { mediaId };
      if (typeof record.originalUrl === 'string') {
        normalized.originalUrl = record.originalUrl;
      }
      if (typeof record.signedUrl === 'string') {
        normalized.signedUrl = record.signedUrl;
      }
      if (typeof record.publicUrl === 'string') {
        normalized.publicUrl = record.publicUrl;
      }
      if (typeof record.altText === 'string') {
        normalized.altText = record.altText;
      }
      for (const [key, val] of Object.entries(record)) {
        if (key in normalized) {
          continue;
        }
        normalized[key] = val;
      }
      return normalized as WebsiteIconValue;
    }
  }
  return undefined;
}

/**
 * Service layer for website operations
 */
export class WebsiteService {
  private _prisma: PrismaClient | null = null;

  constructor(prisma?: PrismaClient) {
    if (prisma) {
      this._prisma = prisma;
    }
  }

  // Lazy initialization of Prisma client
  private get prisma(): PrismaClient {
    if (!this._prisma) {
      this._prisma = getClient();
    }
    return this._prisma;
  }

  /**
   * Get all active websites
   */
  async getWebsites(): Promise<Website[]> {
    const websites = await this.prisma.website.findMany({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' }
    });

    return websites.map(this.formatWebsite);
  }

  async getWebsitesConnection(options: WebsiteConnectionOptions): Promise<WebsiteConnectionPayload> {
    const limit = Math.min(Math.max(options.first, 1), 50);
    const where: Prisma.WebsiteWhereInput = {
      accountId: options.accountId,
      ...(options.websiteId ? { id: options.websiteId } : {}),
      ...(options.includeInactive ? {} : { isActive: true })
    };

    const cursor = options.after ? this.decodeCursor(options.after) : null;

    const query: Prisma.WebsiteFindManyArgs = {
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1
    };

    if (cursor) {
      query.cursor = { id: cursor.id };
      query.skip = 1;
    }

    const [rows, totalCount] = await Promise.all([
      this.prisma.website.findMany(query),
      this.prisma.website.count({ where })
    ]);

    const hasNextPage = rows.length > limit;
    const visibleRows = hasNextPage ? rows.slice(0, limit) : rows;
    const edges: WebsiteConnectionEdge[] = visibleRows.map(record => ({
      cursor: this.encodeCursor(record),
      node: this.formatWebsite(record)
    }));

    const endCursor = edges.length ? edges[edges.length - 1].cursor : null;

    return {
      edges,
      pageInfo: {
        endCursor,
        hasNextPage
      },
      totalCount
    };
  }

  /**
   * Get a single website by ID
   */
  async getWebsite(id: string): Promise<Website> {
    const website = await this.prisma.website.findUnique({
      where: { id }
    });

    if (!website) {
      throw new ApiError(404, 'Website not found', 'NOT_FOUND');
    }

    return this.formatWebsite(website);
  }

  /**
   * Create a new website
   */
  async createWebsite(data: CreateWebsiteRequest): Promise<Website> {
    const dataToStore = {
      ...data,
      metadata: data.metadata || {},
      settings: data.settings || {}
    };

    const metadataValue = this.normalizeJsonValue(dataToStore.metadata);
    const settingsValue = this.normalizeJsonValue(dataToStore.settings);

    const createData: Prisma.WebsiteCreateInput = {
      name: dataToStore.name,
      category: dataToStore.category,
      ...(metadataValue !== undefined ? { metadata: metadataValue } : {}),
      ...(settingsValue !== undefined ? { settings: settingsValue } : {})
    };

    if (dataToStore.isActive !== undefined) {
      createData.isActive = dataToStore.isActive;
    }

    if (dataToStore.description !== undefined) {
      createData.description = dataToStore.description;
    }
    if (dataToStore.icon !== undefined) {
      const iconValue = this.normalizeJsonValue(dataToStore.icon);
      if (iconValue !== undefined) {
        createData.icon = iconValue;
      }
    }

    const website = await this.prisma.website.create({
      data: createData
    });

    return this.formatWebsite(website);
  }

  /**
   * Update an existing website
   */
  async updateWebsite(id: string, data: UpdateWebsiteRequest): Promise<Website> {
    // Check if website exists
    const existing = await this.prisma.website.findUnique({
      where: { id }
    });

    if (!existing) {
      throw new ApiError(404, 'Website not found', 'NOT_FOUND');
    }

    const updateData: Prisma.WebsiteUpdateInput = {};
    if (data.name !== undefined) {
      updateData.name = data.name;
    }
    if (data.description !== undefined) {
      updateData.description = data.description;
    }
    if (data.category !== undefined) {
      updateData.category = data.category;
    }
    if (data.icon !== undefined) {
      updateData.icon = this.normalizeJsonValue(data.icon);
    }
    if (data.isActive !== undefined) {
      updateData.isActive = data.isActive;
    }
    if (data.metadata !== undefined) {
      updateData.metadata = this.normalizeJsonValue(data.metadata);
    }
    if (data.settings !== undefined) {
      updateData.settings = this.normalizeJsonValue(data.settings);
    }

    const website = await this.prisma.website.update({
      where: { id },
      data: updateData
    });

    return this.formatWebsite(website);
  }

  /**
   * Permanently delete a website and its dependent data
   */
  async deleteWebsite(id: string): Promise<void> {
    try {
      await deleteWebsiteWithDependencies(this.prisma, id);
    } catch (error) {
      if ((error as { code?: string })?.code === 'P2025') {
        throw new ApiError(404, 'Website not found', 'NOT_FOUND');
      }
      throw error;
    }
  }

  /**
   * Get website settings
   */
  async getWebsiteSettings(id: string): Promise<WebsiteSettings | null> {
    const website = await this.getWebsite(id);
    return website.settings || null;
  }

  private normalizeJsonValue(
    value: unknown
  ): Prisma.InputJsonValue | Prisma.JsonNullValueInput | undefined {
    if (value === undefined) {
      return undefined;
    }
    if (value === null) {
      return Prisma.JsonNull;
    }
    return value as Prisma.InputJsonValue;
  }

  /**
   * Format website data from database
   */
  private formatWebsite(website: PrismaWebsite): Website {
    return {
      id: website.id,
      accountId: website.accountId ?? undefined,
      name: website.name,
      description: website.description || undefined,
      category: website.category,
      icon: normalizeWebsiteIcon(website.icon),
      isActive: website.isActive,
      createdAt: website.createdAt,
      updatedAt: website.updatedAt,
      metadata: (website.metadata as Record<string, unknown>) || undefined,
      settings: (website.settings as Record<string, unknown>) || undefined
    };
  }

  private encodeCursor(website: PrismaWebsite): string {
    return Buffer.from(`${website.id}:${website.createdAt.toISOString()}`).toString('base64');
  }

  private decodeCursor(cursor: string): { id: string; createdAt: Date } {
    try {
      const decoded = Buffer.from(cursor, 'base64').toString('utf8');
      const [id, createdAtIso] = decoded.split(':');
      if (!id || !createdAtIso) {
        throw new Error('Invalid cursor');
      }
      const createdAt = new Date(createdAtIso);
      if (Number.isNaN(createdAt.getTime())) {
        throw new Error('Invalid cursor');
      }
      return { id, createdAt };
    } catch (error) {
      throw new Error('Invalid pagination cursor');
    }
  }
}

// Export singleton instance for production use
export const websiteService = new WebsiteService();
