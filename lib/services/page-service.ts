import { PrismaClient, Prisma } from '@/lib/generated/prisma';
import type { WebsitePage, WebsiteStructure } from '@/lib/generated/prisma';
import {
  IPageService,
  CreatePageDto,
  UpdatePageDto,
  PageWithStructure
} from './interfaces/page-service.interface';

export class PageService implements IPageService {
  constructor(private prisma: PrismaClient) {}

  async createPage(data: CreatePageDto): Promise<PageWithStructure> {
    const { slug, parentId, ...pageData } = data;

    return await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const {
        websiteId,
        type,
        title,
        content,
        description,
        seoTitle,
        seoDescription,
        seoKeywords,
        ogImage,
      } = pageData;

      const metadataPatch = this.buildMetadataPatch({
        description,
        seoTitle,
        seoDescription,
        seoKeywords,
        ogImage,
      });
      const metadataValue = this.mergeMetadata(undefined, metadataPatch);
      const contentValue = this.normalizeJsonInput(content);

      const defaultContentType = await tx.contentType.findFirst({
        where: { websiteId, category: 'page' },
        orderBy: { createdAt: 'asc' }
      });

      if (!defaultContentType) {
        throw new Error('No content type available for pages');
      }

      // Create the page
      const page = await tx.websitePage.create({
        data: {
          websiteId,
          type,
          title,
          contentTypeId: defaultContentType.id,
          ...(contentValue !== undefined ? { content: contentValue } : {}),
          ...(metadataValue !== undefined ? { metadata: metadataValue } : {}),
        }
      });

      // Create the structure entry
      const structure = await tx.websiteStructure.create({
        data: {
          websiteId,
          websitePageId: page.id,
          slug: slug || this.generateSlugFromTitle(title),
          fullPath: '',  // Will be updated below
          parentId: parentId || null,
          position: await this.getNextPosition(tx, websiteId, parentId || null),
        }
      });

      // Update full path
      const fullPath = await this.generateFullPath(tx, structure);
      const updatedStructure = await tx.websiteStructure.update({
        where: { id: structure.id },
        data: { fullPath }
      });

      return { ...page, structure: updatedStructure };
    });
  }

  async getPage(id: string): Promise<WebsitePage | null> {
    return await this.prisma.websitePage.findUnique({
      where: { id }
    });
  }

  async getPageWithStructure(id: string): Promise<PageWithStructure | null> {
    const page = await this.prisma.websitePage.findUnique({
      where: { id },
    });

    if (!page) return null;

    const structure = await this.prisma.websiteStructure.findFirst({
      where: { websitePageId: id }
    });

    return { ...page, structure };
  }

  async updatePage(id: string, data: UpdatePageDto): Promise<PageWithStructure> {
    const { slug, parentId, ...pageData } = data;

    return await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const existingPage = await tx.websitePage.findUnique({
        where: { id },
        select: { metadata: true }
      });

      if (!existingPage) {
        throw new Error('Page not found');
      }

      const {
        title: updatedTitle,
        content: updatedContent,
        status,
        publishedAt,
        description,
        seoTitle,
        seoDescription,
        seoKeywords,
        ogImage,
        isPublished,
      } = pageData;

      const metadataPatch = this.buildMetadataPatch({
        description,
        seoTitle,
        seoDescription,
        seoKeywords,
        ogImage,
      });
      const metadataValue = this.mergeMetadata(existingPage.metadata, metadataPatch);

      const updateData: Prisma.WebsitePageUpdateInput = {};

      if (updatedTitle !== undefined) {
        updateData.title = updatedTitle;
      }
      if (updatedContent !== undefined) {
        const normalizedContent = this.normalizeJsonInput(updatedContent);
        updateData.content = normalizedContent === undefined ? Prisma.JsonNull : normalizedContent;
      }
      if (status !== undefined) {
        updateData.status = status;
      }
      if (publishedAt !== undefined) {
        updateData.publishedAt = publishedAt;
      }
      if (metadataValue !== undefined) {
        updateData.metadata = metadataValue;
      }
      if (isPublished !== undefined) {
        updateData.status = isPublished ? 'published' : 'draft';
        updateData.publishedAt = isPublished ? new Date() : null;
      }

      const page = await tx.websitePage.update({
        where: { id },
        data: updateData
      });

      // Update structure if needed
      let structure = await tx.websiteStructure.findFirst({
        where: { websitePageId: id }
      });

      if (structure && (slug !== undefined || parentId !== undefined)) {
        const updateData: any = {};
        
        if (slug !== undefined) {
          updateData.slug = slug;
        }
        
        if (parentId !== undefined) {
          updateData.parentId = parentId;
          updateData.position = await this.getNextPosition(tx, structure.websiteId, parentId);
        }

        structure = await tx.websiteStructure.update({
          where: { id: structure.id },
          data: updateData
        });

        // Regenerate full path if slug or parent changed
        const fullPath = await this.generateFullPath(tx, structure);
        structure = await tx.websiteStructure.update({
          where: { id: structure.id },
          data: { fullPath }
        });
      }

      return { ...page, structure };
    });
  }

  async deletePage(id: string): Promise<void> {
    await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // Delete structure first (due to foreign key)
      await tx.websiteStructure.deleteMany({
        where: { websitePageId: id }
      });

      // Delete the page
      await tx.websitePage.delete({
        where: { id }
      });
    });
  }

  async getPagesByWebsite(websiteId: string): Promise<WebsitePage[]> {
    return await this.prisma.websitePage.findMany({
      where: { websiteId },
      orderBy: { createdAt: 'desc' }
    });
  }

  async getPagesHierarchy(websiteId: string): Promise<PageWithStructure[]> {
    const pages = await this.prisma.websitePage.findMany({
      where: { websiteId }
    });

    const structures = await this.prisma.websiteStructure.findMany({
      where: { websiteId },
      orderBy: [
        { parentId: 'asc' },
        { position: 'asc' }
      ]
    });

    // Map structures to pages
    const structureMap = new Map(structures.map((s: WebsiteStructure) => [s.websitePageId!, s]));

    return pages.map((page: WebsitePage) => ({
      ...page,
      structure: structureMap.get(page.id) || null
    }));
  }

  async movePage(pageId: string, newParentId: string | null): Promise<PageWithStructure> {
    return await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const structure = await tx.websiteStructure.findFirst({
        where: { websitePageId: pageId }
      });

      if (!structure) {
        throw new Error('Page structure not found');
      }

      const position = await this.getNextPosition(tx, structure.websiteId, newParentId);

      const updatedStructure = await tx.websiteStructure.update({
        where: { id: structure.id },
        data: {
          parentId: newParentId,
          position
        }
      });

      // Regenerate full path
      const fullPath = await this.generateFullPath(tx, updatedStructure);
      await tx.websiteStructure.update({
        where: { id: structure.id },
        data: { fullPath }
      });

      const page = await tx.websitePage.findUnique({
        where: { id: pageId }
      });

      return { ...page!, structure: updatedStructure };
    });
  }

  async duplicatePage(pageId: string, newTitle?: string): Promise<PageWithStructure> {
    return await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const originalPage = await tx.websitePage.findUnique({
        where: { id: pageId }
      });

      if (!originalPage) {
        throw new Error('Page not found');
      }

      const originalStructure = await tx.websiteStructure.findFirst({
        where: { websitePageId: pageId }
      });

      const originalMetadata = this.parseMetadata(originalPage.metadata);
      const contentValue = this.normalizeJsonInput(originalPage.content);
      const templatePropsValue = this.normalizeJsonInput(originalPage.templateProps);
      const metadataValue = this.normalizeJsonInput(originalMetadata);

      // Create duplicate page
      const duplicatedPage = await tx.websitePage.create({
        data: {
          websiteId: originalPage.websiteId,
          type: originalPage.type,
          title: newTitle || `${originalPage.title} (Copy)`,
          contentTypeId: originalPage.contentTypeId,
          ...(contentValue !== undefined ? { content: contentValue } : {}),
          ...(metadataValue !== undefined ? { metadata: metadataValue } : {}),
          ...(templatePropsValue !== undefined ? { templateProps: templatePropsValue } : {}),
          templateKey: originalPage.templateKey ?? undefined,
          status: 'draft',
          publishedAt: null
        }
      });

      // Create duplicate structure
      let structure = null;
      if (originalStructure) {
        const baseSlug = this.generateSlugFromTitle(duplicatedPage.title);
        const uniqueSlug = await this.generateUniqueSlug(tx, originalPage.websiteId, baseSlug);
        
        structure = await tx.websiteStructure.create({
          data: {
            websiteId: originalPage.websiteId,
            websitePageId: duplicatedPage.id,
            slug: uniqueSlug,
            fullPath: '',
            parentId: originalStructure.parentId,
            position: await this.getNextPosition(tx, originalPage.websiteId, originalStructure.parentId),
          }
        });

        // Update full path
        const fullPath = await this.generateFullPath(tx, structure);
        structure = await tx.websiteStructure.update({
          where: { id: structure.id },
          data: { fullPath }
        });
      }

      return { ...duplicatedPage, structure };
    });
  }

  async setPagePublished(pageId: string, isPublished: boolean): Promise<WebsitePage> {
    return await this.prisma.websitePage.update({
      where: { id: pageId },
      data: {
        status: isPublished ? 'published' : 'draft',
        publishedAt: isPublished ? new Date() : null
      }
    });
  }

  async getPageBySlug(websiteId: string, slug: string): Promise<PageWithStructure | null> {
    const structure = await this.prisma.websiteStructure.findFirst({
      where: {
        websiteId,
        slug
      }
    });

    if (!structure || !structure.websitePageId) return null;

    const page = await this.prisma.websitePage.findUnique({
      where: { id: structure.websitePageId }
    });

    if (!page) return null;

    return { ...page, structure };
  }

  // Helper methods
  private buildMetadataPatch(input: {
    description?: string;
    seoTitle?: string;
    seoDescription?: string;
    seoKeywords?: string;
    ogImage?: string;
  }): Record<string, string> {
    const metadata: Record<string, string> = {};
    if (input.description !== undefined) metadata.description = input.description;
    if (input.seoTitle !== undefined) metadata.seoTitle = input.seoTitle;
    if (input.seoDescription !== undefined) metadata.seoDescription = input.seoDescription;
    if (input.seoKeywords !== undefined) metadata.seoKeywords = input.seoKeywords;
    if (input.ogImage !== undefined) metadata.ogImage = input.ogImage;
    return metadata;
  }

  private mergeMetadata(
    existing: unknown,
    patch: Record<string, string>
  ): Prisma.InputJsonValue | Prisma.JsonNullValueInput | undefined {
    if (Object.keys(patch).length === 0) {
      return undefined;
    }

    const base =
      existing && typeof existing === 'object' && !Array.isArray(existing)
        ? { ...(existing as Record<string, unknown>) }
        : {};

    for (const [key, value] of Object.entries(patch)) {
      if (value === undefined) {
        continue;
      }
      base[key] = value;
    }

    if (Object.keys(base).length === 0) {
      return Prisma.JsonNull;
    }

    return base as Prisma.InputJsonValue;
  }

  private parseMetadata(metadata: unknown): Record<string, unknown> | undefined {
    if (metadata && typeof metadata === 'object' && !Array.isArray(metadata)) {
      return { ...(metadata as Record<string, unknown>) };
    }
    return undefined;
  }

  private normalizeJsonInput(
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

  private generateSlugFromTitle(title: string): string {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  private async generateUniqueSlug(tx: Prisma.TransactionClient, websiteId: string, baseSlug: string): Promise<string> {
    let slug = baseSlug;
    let counter = 1;

    while (true) {
      const existing = await tx.websiteStructure.findFirst({
        where: { websiteId, slug }
      });

      if (!existing) break;

      slug = `${baseSlug}-${counter}`;
      counter++;
    }

    return slug;
  }

  private async getNextPosition(tx: Prisma.TransactionClient, websiteId: string, parentId: string | null): Promise<number> {
    const lastItem = await tx.websiteStructure.findFirst({
      where: {
        websiteId,
        parentId: parentId || null
      },
      orderBy: { position: 'desc' }
    });

    return lastItem ? lastItem.position + 1 : 0;
  }

  private async generateFullPath(tx: any, structure: WebsiteStructure): Promise<string> {
    if (!structure.parentId) {
      return `/${structure.slug}`;
    }

    const parent = await tx.websiteStructure.findUnique({
      where: { id: structure.parentId }
    });

    if (!parent) {
      return `/${structure.slug}`;
    }

    return `${parent.fullPath}/${structure.slug}`.replace(/\/+/g, '/');
  }
}
