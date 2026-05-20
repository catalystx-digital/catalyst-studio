import { PrismaClient, WebsiteCustomContentData, ContentType, Prisma } from '@/lib/generated/prisma';
import {
  IContentDataService,
  CreateContentDataDto,
  UpdateContentDataDto,
  ContentDataWithType,
  ContentDataFilter,
  BulkOperationResult
} from './interfaces/content-data-service.interface';

export class ContentDataService implements IContentDataService {
  constructor(private prisma: PrismaClient) {}

  async createContentData(data: CreateContentDataDto): Promise<WebsiteCustomContentData> {
    // Validate content against type schema
    await this.validateContentData(data.data, data.contentTypeId);

    return await this.prisma.websiteCustomContentData.create({
      data: {
        websiteId: data.websiteId,
        title: data.title,
        data: data.data,
        contentTypeId: data.contentTypeId,
        publishedAt: data.publishedAt,
        createdBy: data.createdBy,
        updatedBy: data.updatedBy
      }
    });
  }

  async getContentData(id: string): Promise<WebsiteCustomContentData | null> {
    return await this.prisma.websiteCustomContentData.findUnique({
      where: { id }
    });
  }

  async getContentDataWithType(id: string): Promise<ContentDataWithType | null> {
    const contentData = await this.prisma.websiteCustomContentData.findUnique({
      where: { id }
    });

    if (!contentData) return null;

    const contentType = await this.prisma.contentType.findUnique({
      where: { id: contentData.contentTypeId }
    });

    return { ...contentData, contentType };
  }

  async updateContentData(id: string, data: UpdateContentDataDto): Promise<WebsiteCustomContentData> {
    // If data is being updated, validate it
    if (data.data && data.contentTypeId) {
      await this.validateContentData(data.data, data.contentTypeId);
    } else if (data.data) {
      // Get current content type if not provided
      const current = await this.prisma.websiteCustomContentData.findUnique({
        where: { id }
      });
      if (current) {
        await this.validateContentData(data.data, current.contentTypeId);
      }
    }

    return await this.prisma.websiteCustomContentData.update({
      where: { id },
      data
    });
  }

  async deleteContentData(id: string): Promise<void> {
    await this.prisma.websiteCustomContentData.delete({
      where: { id }
    });
  }

  async getContentDataList(filter: ContentDataFilter): Promise<ContentDataWithType[]> {
    const where: Prisma.WebsiteCustomContentDataWhereInput = {};

    if (filter.websiteId) {
      where.websiteId = filter.websiteId;
    }

    if (filter.contentTypeId) {
      where.contentTypeId = filter.contentTypeId;
    }

    if (filter.publishedOnly) {
      where.publishedAt = { not: null };
    }

    if (filter.search) {
      where.OR = [
        { title: { contains: filter.search, mode: 'insensitive' } },
        // Note: Searching in JSON data field requires specific database support
      ];
    }

    const contentDataList = await this.prisma.websiteCustomContentData.findMany({
      where,
      orderBy: { createdAt: 'desc' }
    });

    // Get all unique content type IDs
    const contentTypeIds = [...new Set(contentDataList.map(cd => cd.contentTypeId))];
    
    // Fetch all content types at once
    const contentTypes = await this.prisma.contentType.findMany({
      where: { id: { in: contentTypeIds } }
    });

    const contentTypeMap = new Map(contentTypes.map(ct => [ct.id, ct]));

    return contentDataList.map(cd => ({
      ...cd,
      contentType: contentTypeMap.get(cd.contentTypeId) || null
    }));
  }

  async validateContentData(data: any, contentTypeId: string): Promise<boolean> {
    const contentType = await this.prisma.contentType.findUnique({
      where: { id: contentTypeId }
    });

    if (!contentType) {
      throw new Error('Content type not found');
    }

    // Basic validation - check if fields exists and validate against it
    if (contentType.fields) {
      const schema = contentType.fields as any;
      // Here you would implement actual JSON schema validation
      // For now, we'll do basic field presence check
      if (schema.required && Array.isArray(schema.required)) {
        for (const field of schema.required) {
          if (!(field in data)) {
            throw new Error(`Required field '${field}' is missing`);
          }
        }
      }
    }

    return true;
  }

  async bulkCreateContentData(records: CreateContentDataDto[]): Promise<BulkOperationResult> {
    let success = 0;
    let failed = 0;
    const errors: Array<{ id: string; error: string }> = [];

    // Process in transaction for atomicity
    await this.prisma.$transaction(async (tx) => {
      for (const record of records) {
        try {
          await this.validateContentData(record.data, record.contentTypeId);
          await tx.websiteCustomContentData.create({
            data: {
              websiteId: record.websiteId,
              title: record.title,
              data: record.data,
              contentTypeId: record.contentTypeId,
              publishedAt: record.publishedAt,
              createdBy: record.createdBy,
              updatedBy: record.updatedBy
            }
          });
          success++;
        } catch (error: any) {
          failed++;
          errors.push({ id: record.title, error: error.message });
        }
      }
    });

    return { success, failed, errors };
  }

  async bulkUpdateContentData(updates: Array<{ id: string; data: UpdateContentDataDto }>): Promise<BulkOperationResult> {
    let success = 0;
    let failed = 0;
    const errors: Array<{ id: string; error: string }> = [];

    await this.prisma.$transaction(async (tx) => {
      for (const update of updates) {
        try {
          // Validate if data is being updated
          if (update.data.data) {
            const current = await tx.websiteCustomContentData.findUnique({
              where: { id: update.id }
            });
            if (current) {
              await this.validateContentData(
                update.data.data,
                update.data.contentTypeId || current.contentTypeId
              );
            }
          }

          await tx.websiteCustomContentData.update({
            where: { id: update.id },
            data: update.data
          });
          success++;
        } catch (error: any) {
          failed++;
          errors.push({ id: update.id, error: error.message });
        }
      }
    });

    return { success, failed, errors };
  }

  async bulkDeleteContentData(ids: string[]): Promise<BulkOperationResult> {
    let success = 0;
    let failed = 0;
    const errors: Array<{ id: string; error: string }> = [];

    await this.prisma.$transaction(async (tx) => {
      for (const id of ids) {
        try {
          await tx.websiteCustomContentData.delete({
            where: { id }
          });
          success++;
        } catch (error: any) {
          failed++;
          errors.push({ id, error: error.message });
        }
      }
    });

    return { success, failed, errors };
  }

  async publishContentData(id: string, userId: string): Promise<WebsiteCustomContentData> {
    return await this.prisma.websiteCustomContentData.update({
      where: { id },
      data: {
        publishedAt: new Date(),
        updatedBy: userId
      }
    });
  }

  async unpublishContentData(id: string): Promise<WebsiteCustomContentData> {
    return await this.prisma.websiteCustomContentData.update({
      where: { id },
      data: {
        publishedAt: null
      }
    });
  }

  async searchContentData(websiteId: string, query: string, contentTypeId?: string): Promise<ContentDataWithType[]> {
    const filter: ContentDataFilter = {
      websiteId,
      search: query
    };

    if (contentTypeId) {
      filter.contentTypeId = contentTypeId;
    }

    return await this.getContentDataList(filter);
  }

  async exportContentData(filter: ContentDataFilter): Promise<any[]> {
    const contentDataList = await this.getContentDataList(filter);

    return contentDataList.map(cd => ({
      id: cd.id,
      title: cd.title,
      data: cd.data,
      contentType: cd.contentType?.name,
      contentTypeId: cd.contentTypeId,
      publishedAt: cd.publishedAt,
      createdAt: cd.createdAt,
      updatedAt: cd.updatedAt
    }));
  }

  async importContentData(websiteId: string, data: any[]): Promise<BulkOperationResult> {
    const records: CreateContentDataDto[] = data.map(item => ({
      websiteId,
      title: item.title,
      data: item.data,
      contentTypeId: item.contentTypeId,
      publishedAt: item.publishedAt ? new Date(item.publishedAt) : undefined,
      publishedById: item.publishedById,
      customFields: item.customFields
    }));

    return await this.bulkCreateContentData(records);
  }
}