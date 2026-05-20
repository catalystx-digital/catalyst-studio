import { PrismaClient, Prisma } from '@/lib/generated/prisma';
import type { WebsiteStructure } from '@/lib/generated/prisma';
import { prisma } from '@/lib/prisma';
import { generateUniqueSlug, validateAndSuggestSlug } from './slug-validator';

// Create a wrapper for slug operations
const slugManager = {
  async generateSlug(title: string, websiteId: string, parentId: string | null = null): Promise<string> {
    return await generateUniqueSlug(title, { websiteId, parentId });
  },
  
  async validateSlug(slug: string): Promise<{ isValid: boolean; error?: string }> {
    const { getSlugValidationDetails } = await import('./slug-manager');
    const validation = getSlugValidationDetails(slug);
    return {
      isValid: validation.valid,
      error: validation.errors[0]
    };
  }
};
import { 
  OrphanedNodeError, 
  CircularReferenceError,
  InvalidSlugError,
  DuplicateSlugError 
} from './errors';
import {
  CreatePageDto,
  UpdatePageDto,
  PageResult,
  DeleteOptions,
  MovePageDto,
  IPageOrchestrator
} from '@/lib/types/page-orchestrator.types';

export class PageOrchestrator implements IPageOrchestrator {
  private prisma: PrismaClient;

  constructor(prismaClient?: PrismaClient) {
    this.prisma = prismaClient || prisma;
  }

  async createPage(dto: CreatePageDto, websiteId: string): Promise<PageResult> {
    return await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // Validate content type exists
      const contentType = await tx.contentType.findUnique({
        where: { id: dto.contentTypeId }
      });

      if (!contentType) {
        throw new Error(`Content type ${dto.contentTypeId} not found`);
      }

      // Generate slug if not provided
      const slug = dto.slug || await slugManager.generateSlug(dto.title, websiteId, dto.parentId);
      
      // Validate slug
      const slugValidation = await slugManager.validateSlug(slug);
      if (!slugValidation.isValid) {
        throw new InvalidSlugError(slug, [slugValidation.error || 'Invalid slug']);
      }

      // Check slug uniqueness within website
      const existingSlug = await tx.websiteStructure.findFirst({
        where: {
          websiteId,
          slug: slug
        }
      });

      if (existingSlug) {
        throw new DuplicateSlugError(`Slug "${slug}" already exists`);
      }

      // Get parent structure if parentId provided
      let parentStructure: WebsiteStructure | null = null;
      let pathDepth = 0;
      // Special case: home page gets root path "/"
      let fullPath = (slug === 'home') ? '/' : `/${slug}`;

      if (dto.parentId) {
        parentStructure = await tx.websiteStructure.findUnique({
          where: { id: dto.parentId }
        });

        if (!parentStructure) {
          throw new Error(`Parent structure ${dto.parentId} not found`);
        }

        pathDepth = parentStructure.pathDepth + 1;
        // Handle root parent path "/" to avoid double slashes
        fullPath = parentStructure.fullPath === '/'
          ? `/${slug}`
          : `${parentStructure.fullPath}/${slug}`;
      }

      // Calculate position if not provided
      let position = dto.position;
      if (position === undefined) {
        const lastSibling = await tx.websiteStructure.findFirst({
          where: {
            websiteId,
            parentId: dto.parentId || null
          },
          orderBy: { position: 'desc' }
        });
        position = lastSibling ? lastSibling.position + 1 : 0;
      }

      // Create ContentItem (source of truth for slug)
      const websitePage = await tx.websitePage.create({
        data: {
          websiteId,
          contentTypeId: dto.contentTypeId,
          type: 'page',
          title: dto.title,
          content: dto.content || {},
          metadata: dto.metadata || {},
          templateKey: dto.templateKey ?? null,
          templateProps: dto.templateProps ?? Prisma.JsonNull,
          status: dto.status || 'draft'
        }
      });

      // Create SiteStructure (mirrors slug for path construction)
      const websiteStructure = await tx.websiteStructure.create({
        data: {
          websiteId,
          websitePageId: websitePage.id,
          parentId: dto.parentId || null,
          slug, // Mirror from ContentItem
          position,
          pathDepth,
          fullPath,
          weight: 0
        }
      });

      // Get breadcrumbs
      const breadcrumbs = await this.getBreadcrumbs(tx, websiteStructure.id);

      return {
        websitePage,
        websiteStructure,
        fullPath,
        breadcrumbs
      };
    });
  }

  async updatePage(id: string, dto: UpdatePageDto): Promise<PageResult> {
    return await this.prisma.$transaction(async (tx) => {
      // Find existing structure
      const existingStructure = await tx.websiteStructure.findUnique({
        where: { id },
        include: { websitePage: true }
      });

      if (!existingStructure || !existingStructure.websitePage) {
        throw new Error(`Page ${id} not found`);
      }

      const websitePage = existingStructure.websitePage;
      let newSlug = existingStructure.slug;
      let pathUpdateNeeded = false;

      // Handle slug update
      if (dto.slug && dto.slug !== existingStructure.slug) {
        // Validate new slug
        const slugValidation = await slugManager.validateSlug(dto.slug);
        if (!slugValidation.isValid) {
          throw new InvalidSlugError(dto.slug, [slugValidation.error || 'Invalid slug']);
        }

        // Check uniqueness
        const duplicate = await tx.websiteStructure.findFirst({
          where: {
            websiteId: websitePage.websiteId,
            slug: dto.slug,
            websitePageId: { not: websitePage.id }
          }
        });

        if (duplicate) {
          throw new DuplicateSlugError(`Slug "${dto.slug}" already exists`);
        }

        newSlug = dto.slug;
        pathUpdateNeeded = true;
      } else if (dto.title && dto.title !== websitePage.title && !dto.slug) {
        // Generate new slug from title if title changed
        newSlug = await slugManager.generateSlug(dto.title, websitePage.websiteId, existingStructure.parentId);
        
        // Check uniqueness
        const duplicate = await tx.websiteStructure.findFirst({
          where: {
            websiteId: websitePage.websiteId,
            slug: newSlug,
            websitePageId: { not: websitePage.id }
          }
        });

        if (!duplicate) {
          pathUpdateNeeded = true;
        } else {
          newSlug = existingStructure.slug; // Keep existing if conflict
        }
      }

      // Update ContentItem
      const updatePayload: Prisma.WebsitePageUpdateInput = {
        title: dto.title || websitePage.title,
        status: dto.status || websitePage.status
      }

      if (dto.content !== undefined) {
        updatePayload.content = dto.content as Prisma.InputJsonValue
      }
      if (dto.metadata !== undefined) {
        updatePayload.metadata = dto.metadata as Prisma.InputJsonValue
      }
      if (dto.templateKey !== undefined) {
        updatePayload.templateKey = dto.templateKey
      }
      if (dto.templateProps !== undefined) {
        updatePayload.templateProps = dto.templateProps ?? Prisma.JsonNull
      }

      const updatedContentItem = await tx.websitePage.update({
        where: { id: websitePage.id },
        data: updatePayload
      });

      // Calculate new fullPath
      let newFullPath = existingStructure.fullPath;
      if (pathUpdateNeeded) {
        if (existingStructure.parentId) {
          const parent = await tx.websiteStructure.findUnique({
            where: { id: existingStructure.parentId }
          });
          newFullPath = parent ? `${parent.fullPath}/${newSlug}` : `/${newSlug}`;
        } else {
          newFullPath = `/${newSlug}`;
        }
      }

      // Update SiteStructure
      const updatedStructure = await tx.websiteStructure.update({
        where: { id },
        data: {
          slug: newSlug,
          fullPath: newFullPath
        }
      });

      // If path changed, update all descendants
      if (pathUpdateNeeded) {
        await this.updateDescendantPaths(tx, id, existingStructure.fullPath, newFullPath);
      }

      // Get breadcrumbs
      const breadcrumbs = await this.getBreadcrumbs(tx, id);

      return {
        websitePage: updatedContentItem,
        websiteStructure: updatedStructure,
        fullPath: newFullPath,
        breadcrumbs
      };
    });
  }

  async deletePage(id: string, options?: DeleteOptions): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const structure = await tx.websiteStructure.findUnique({
        where: { id },
        include: { 
          websitePage: true,
          children: true
        }
      });

      if (!structure) {
        throw new Error(`Page ${id} not found`);
      }

      // Handle children based on options
      if (structure.children.length > 0) {
        if (options?.cascade) {
          // Cascade delete all descendants
          await this.cascadeDelete(tx, id);
        } else if (options?.orphanChildren) {
          // Move children to parent or root
          await tx.websiteStructure.updateMany({
            where: { parentId: id },
            data: { 
              parentId: structure.parentId,
              pathDepth: structure.pathDepth
            }
          });
        } else {
          throw new Error('Page has children. Use cascade or orphanChildren option.');
        }
      }

      // Delete SiteStructure
      await tx.websiteStructure.delete({
        where: { id }
      });

      // Delete ContentItem if requested (default: true)
      if (options?.deleteContent !== false && structure.websitePage) {
        await tx.websitePage.delete({
          where: { id: structure.websitePage.id }
        });
      }
    });
  }

  async movePage(id: string, dto: MovePageDto): Promise<PageResult> {
    return await this.prisma.$transaction(async (tx) => {
      const structure = await tx.websiteStructure.findUnique({
        where: { id },
        include: { websitePage: true }
      });

      if (!structure || !structure.websitePage) {
        throw new Error(`Page ${id} not found`);
      }

      // Validate no circular reference
      if (dto.newParentId) {
        const isCircular = await this.checkCircularReference(tx, id, dto.newParentId);
        if (isCircular) {
          throw new CircularReferenceError('Cannot move page to its own descendant');
        }
      }

      // Get new parent info
      let newPathDepth = 0;
      let newFullPath = `/${structure.slug}`;

      if (dto.newParentId) {
        const newParent = await tx.websiteStructure.findUnique({
          where: { id: dto.newParentId }
        });

        if (!newParent) {
          throw new Error(`Parent ${dto.newParentId} not found`);
        }

        newPathDepth = newParent.pathDepth + 1;
        newFullPath = `${newParent.fullPath}/${structure.slug}`;
      }

      // Calculate position
      let position = dto.position;
      if (position === undefined) {
        const lastSibling = await tx.websiteStructure.findFirst({
          where: {
            websiteId: structure.websiteId,
            parentId: dto.newParentId || null,
            id: { not: id }
          },
          orderBy: { position: 'desc' }
        });
        position = lastSibling ? lastSibling.position + 1 : 0;
      }

      // Update structure
      const updatedStructure = await tx.websiteStructure.update({
        where: { id },
        data: {
          parentId: dto.newParentId || null,
          position,
          pathDepth: newPathDepth,
          fullPath: newFullPath
        }
      });

      // Update all descendants
      await this.updateDescendantPaths(tx, id, structure.fullPath, newFullPath);
      await this.updateDescendantDepths(tx, id, structure.pathDepth, newPathDepth);

      // Get breadcrumbs
      const breadcrumbs = await this.getBreadcrumbs(tx, id);

      return {
        websitePage: structure.websitePage,
        websiteStructure: updatedStructure,
        fullPath: newFullPath,
        breadcrumbs
      };
    });
  }

  async getPage(id: string): Promise<PageResult | null> {
    const structure = await this.prisma.websiteStructure.findUnique({
      where: { id },
      include: { websitePage: true }
    });

    if (!structure || !structure.websitePage) {
      return null;
    }

    const breadcrumbs = await this.getBreadcrumbs(this.prisma, structure.id);

    return {
      websitePage: structure.websitePage,
      websiteStructure: structure,
      fullPath: structure.fullPath,
      breadcrumbs
    };
  }

  async listPages(
    websiteId: string,
    options?: { 
      parentId?: string | null; 
      limit?: number; 
      offset?: number;
      includeContent?: boolean;
    }
  ): Promise<{ pages: PageResult[]; total: number }> {
    const where = {
      websiteId,
      ...(options?.parentId !== undefined && { parentId: options.parentId })
    };

    const [structures, total] = await Promise.all([
      this.prisma.websiteStructure.findMany({
        where,
        include: { websitePage: options?.includeContent !== false },
        take: options?.limit,
        skip: options?.offset,
        orderBy: [
          { position: 'asc' },
          { createdAt: 'asc' }
        ]
      }),
      this.prisma.websiteStructure.count({ where })
    ]);

    const pages = await Promise.all(
      structures.map(async (structure) => {
        if (!structure.websitePage) {
          throw new OrphanedNodeError(`Site structure ${structure.id} has no content item`);
        }
        
        const breadcrumbs = await this.getBreadcrumbs(this.prisma, structure.id);
        
        return {
          websitePage: structure.websitePage,
          websiteStructure: structure,
          fullPath: structure.fullPath,
          breadcrumbs
        };
      })
    );

    return { pages, total };
  }

  async resolveUrl(path: string, websiteId: string): Promise<PageResult | null> {
    // Normalize path
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;

    const structure = await this.prisma.websiteStructure.findFirst({
      where: {
        websiteId,
        fullPath: normalizedPath
      },
      include: { websitePage: true }
    });

    if (!structure || !structure.websitePage) {
      return null;
    }

    const breadcrumbs = await this.getBreadcrumbs(this.prisma, structure.id);

    return {
      websitePage: structure.websitePage,
      websiteStructure: structure,
      fullPath: structure.fullPath,
      breadcrumbs
    };
  }

  private async getBreadcrumbs(
    tx: Prisma.TransactionClient | PrismaClient,
    structureId: string
  ): Promise<Array<{ id: string; title: string; slug: string }>> {
    const structure = await tx.websiteStructure.findUnique({
      where: { id: structureId },
      include: { websitePage: true }
    });

    if (!structure) return [];

    const breadcrumbs: Array<{ id: string; title: string; slug: string }> = [];
    
    // Walk up the parent chain to build breadcrumbs
    let currentParentId = structure.parentId;
    const parentChain: Array<{ id: string; title: string; slug: string }> = [];
    
    while (currentParentId) {
      const parent = await tx.websiteStructure.findUnique({
        where: { id: currentParentId },
        include: { websitePage: true }
      });
      
      if (parent && parent.websitePage) {
        parentChain.unshift({
          id: parent.id,
          title: parent.websitePage.title,
          slug: parent.slug
        });
        currentParentId = parent.parentId;
      } else {
        break;
      }
    }
    
    breadcrumbs.push(...parentChain);

    // Add current page
    if (structure.websitePage) {
      breadcrumbs.push({
        id: structure.id,
        title: structure.websitePage.title,
        slug: structure.slug
      });
    }

    return breadcrumbs;
  }

  private async updateDescendantPaths(
    tx: Prisma.TransactionClient,
    parentId: string,
    oldPath: string,
    newPath: string
  ): Promise<void> {
    // Find all descendants by checking if their fullPath starts with the old path
    const descendants = await tx.websiteStructure.findMany({
      where: {
        fullPath: { startsWith: oldPath + '/' }
      }
    });

    // Update each descendant's fullPath by replacing the old path prefix with the new one
    for (const descendant of descendants) {
      const updatedFullPath = descendant.fullPath.replace(oldPath, newPath);
      await tx.websiteStructure.update({
        where: { id: descendant.id },
        data: { fullPath: updatedFullPath }
      });
    }
  }

  private async updateDescendantDepths(
    tx: Prisma.TransactionClient,
    parentId: string,
    oldDepth: number,
    newDepth: number
  ): Promise<void> {
    const depthDiff = newDepth - oldDepth;
    
    // Get the parent structure to find its fullPath
    const parentStructure = await tx.websiteStructure.findUnique({
      where: { id: parentId }
    });
    
    if (!parentStructure) return;
    
    // Find all descendants by checking if their fullPath starts with the parent's fullPath
    const descendants = await tx.websiteStructure.findMany({
      where: {
        fullPath: { startsWith: parentStructure.fullPath + '/' }
      }
    });

    // Update each descendant's depth
    for (const descendant of descendants) {
      await tx.websiteStructure.update({
        where: { id: descendant.id },
        data: { pathDepth: descendant.pathDepth + depthDiff }
      });
    }
  }

  private async cascadeDelete(
    tx: Prisma.TransactionClient,
    parentId: string
  ): Promise<void> {
    const children = await tx.websiteStructure.findMany({
      where: { parentId }
    });

    for (const child of children) {
      await this.cascadeDelete(tx, child.id);
      
      // Delete structure
      await tx.websiteStructure.delete({
        where: { id: child.id }
      });

      // Delete content
      if (child.websitePageId) {
        await tx.websitePage.delete({
          where: { id: child.websitePageId }
        });
      }
    }
  }

  private async checkCircularReference(
    tx: Prisma.TransactionClient,
    nodeId: string,
    potentialParentId: string
  ): Promise<boolean> {
    if (nodeId === potentialParentId) return true;

    const potentialParent = await tx.websiteStructure.findUnique({
      where: { id: potentialParentId }
    });

    if (!potentialParent) return false;
    
    // Check if potential parent is a descendant of node by checking paths
    const node = await tx.websiteStructure.findUnique({
      where: { id: nodeId }
    });
    
    if (!node) return false;
    
    return potentialParent.fullPath.startsWith(node.fullPath + '/');
  }
}

export const pageOrchestrator = new PageOrchestrator();
