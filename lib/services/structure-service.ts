import { PrismaClient, Prisma } from '@/lib/generated/prisma';
import type { WebsiteStructure } from '@/lib/generated/prisma';
import {
  IStructureService,
  CreateStructureDto,
  UpdateStructureDto,
  StructureNode,
  MoveStructureDto,
  BulkReorderDto
} from './interfaces/structure-service.interface';

export class StructureService implements IStructureService {
  constructor(private prisma: PrismaClient) {}

  async createStructure(data: CreateStructureDto): Promise<WebsiteStructure> {
    const position = data.position ?? await this.getNextPosition(data.websiteId, data.parentId || null);
    const fullPath = await this.generateFullPath(data.websiteId, data.slug, data.parentId);

    return await this.prisma.websiteStructure.create({
      data: {
        websiteId: data.websiteId,
        slug: data.slug,
        fullPath,
        websitePageId: data.websitePageId || null,
        parentId: data.parentId || null,
        position
      }
    });
  }

  async getStructure(id: string): Promise<WebsiteStructure | null> {
    return await this.prisma.websiteStructure.findUnique({
      where: { id }
    });
  }

  async getStructureByPageId(websitePageId: string): Promise<WebsiteStructure | null> {
    return await this.prisma.websiteStructure.findFirst({
      where: { websitePageId }
    });
  }

  async updateStructure(id: string, data: UpdateStructureDto): Promise<WebsiteStructure> {
    const structure = await this.prisma.websiteStructure.findUnique({
      where: { id }
    });

    if (!structure) {
      throw new Error('Structure not found');
    }

    // If slug or parent is changing, regenerate full path
    let fullPath = structure.fullPath;
    if (data.slug !== undefined || data.parentId !== undefined) {
      fullPath = await this.generateFullPath(
        structure.websiteId,
        data.slug || structure.slug,
        data.parentId !== undefined ? data.parentId : structure.parentId
      );
    }

    return await this.prisma.websiteStructure.update({
      where: { id },
      data: {
        ...data,
        fullPath
      }
    });
  }

  async deleteStructure(id: string): Promise<void> {
    // Check for children
    const hasChildren = await this.hasChildren(id);
    if (hasChildren) {
      throw new Error('Cannot delete structure with children');
    }

    await this.prisma.websiteStructure.delete({
      where: { id }
    });
  }

  async getStructureTree(websiteId: string): Promise<StructureNode[]> {
    const structures = await this.prisma.websiteStructure.findMany({
      where: { websiteId },
      orderBy: [
        { parentId: 'asc' },
        { position: 'asc' }
      ]
    });

    // Build tree structure
    const nodeMap = new Map<string, StructureNode>();
    const rootNodes: StructureNode[] = [];

    // First pass: create all nodes
    for (const structure of structures) {
      nodeMap.set(structure.id, { ...structure, children: [] });
    }

    // Second pass: build hierarchy
    for (const structure of structures) {
      const node = nodeMap.get(structure.id)!;
      
      if (structure.parentId) {
        const parent = nodeMap.get(structure.parentId);
        if (parent) {
          parent.children = parent.children || [];
          parent.children.push(node);
          node.parent = parent;
        }
      } else {
        rootNodes.push(node);
      }
    }

    return rootNodes;
  }

  async getStructureWithAncestors(id: string): Promise<StructureNode> {
    const structure = await this.prisma.websiteStructure.findUnique({
      where: { id }
    });

    if (!structure) {
      throw new Error('Structure not found');
    }

    const node: StructureNode = { ...structure, children: [] };
    
    // Get ancestors
    let currentParentId = structure.parentId;
    let currentNode = node;
    
    while (currentParentId) {
      const parent = await this.prisma.websiteStructure.findUnique({
        where: { id: currentParentId }
      });
      
      if (parent) {
        currentNode.parent = parent;
        currentParentId = parent.parentId;
        currentNode = parent as StructureNode;
      } else {
        break;
      }
    }

    // Get children
    const children = await this.getStructureChildren(id);
    node.children = children.map(child => ({ ...child, children: [] }));

    return node;
  }

  async getStructureChildren(parentId: string): Promise<WebsiteStructure[]> {
    return await this.prisma.websiteStructure.findMany({
      where: { parentId },
      orderBy: { position: 'asc' }
    });
  }

  async moveStructure(data: MoveStructureDto): Promise<WebsiteStructure> {
    return await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const structure = await tx.websiteStructure.findUnique({
        where: { id: data.structureId }
      });

      if (!structure) {
        throw new Error('Structure not found');
      }

      // Prevent moving to own descendant
      if (data.newParentId) {
        const isDescendant = await this.isDescendant(tx, data.structureId, data.newParentId);
        if (isDescendant) {
          throw new Error('Cannot move structure to its own descendant');
        }
      }

      const position = data.position ?? await this.getNextPositionTx(tx, structure.websiteId, data.newParentId);
      const fullPath = await this.generateFullPathTx(tx, structure.websiteId, structure.slug, data.newParentId);

      // Update the structure
      const updated = await tx.websiteStructure.update({
        where: { id: data.structureId },
        data: {
          parentId: data.newParentId,
          position,
          fullPath
        }
      });

      // Update full paths of all descendants
      await this.updateDescendantPaths(tx, data.structureId, fullPath);

      return updated;
    });
  }

  async bulkReorderStructures(data: BulkReorderDto): Promise<void> {
    await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      for (const item of data.structures) {
        await tx.websiteStructure.update({
          where: { id: item.id },
          data: { position: item.position }
        });
      }
    });
  }

  async generateUniqueSlug(websiteId: string, baseSlug: string, parentId?: string | null): Promise<string> {
    let slug = baseSlug;
    let counter = 1;

    while (true) {
      const existing = await this.prisma.websiteStructure.findFirst({
        where: {
          websiteId,
          slug,
          parentId: parentId || null
        }
      });

      if (!existing) break;

      slug = `${baseSlug}-${counter}`;
      counter++;
    }

    return slug;
  }

  async generateFullPath(websiteId: string, slug: string, parentId?: string | null): Promise<string> {
    if (!parentId) {
      return `/${slug}`;
    }

    const parent = await this.prisma.websiteStructure.findUnique({
      where: { id: parentId }
    });

    if (!parent) {
      return `/${slug}`;
    }

    return `${parent.fullPath}/${slug}`.replace(/\/+/g, '/');
  }

  async validatePath(websiteId: string, path: string): Promise<boolean> {
    // Validate path format
    if (!path.startsWith('/')) {
      return false;
    }

    // Check if path exists
    const structure = await this.prisma.websiteStructure.findFirst({
      where: {
        websiteId,
        fullPath: path
      }
    });

    return !!structure;
  }

  async findByFullPath(websiteId: string, fullPath: string): Promise<WebsiteStructure | null> {
    return await this.prisma.websiteStructure.findFirst({
      where: {
        websiteId,
        fullPath
      }
    });
  }

  async rebuildFullPaths(websiteId: string): Promise<void> {
    await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // Get all structures ordered by hierarchy
      const structures = await tx.websiteStructure.findMany({
        where: { websiteId },
        orderBy: [
          { parentId: 'asc' },
          { position: 'asc' }
        ]
      });

      // Build parent map
      const parentMap = new Map<string | null, WebsiteStructure[]>();
      for (const structure of structures) {
        const key = structure.parentId;
        if (!parentMap.has(key)) {
          parentMap.set(key, []);
        }
        parentMap.get(key)!.push(structure);
      }

      // Rebuild paths recursively
      const rebuildNode = async (structure: WebsiteStructure, parentPath: string = '') => {
        const fullPath = parentPath ? `${parentPath}/${structure.slug}` : `/${structure.slug}`;
        
        await tx.websiteStructure.update({
          where: { id: structure.id },
          data: { fullPath }
        });

        // Process children
        const children = parentMap.get(structure.id) || [];
        for (const child of children) {
          await rebuildNode(child, fullPath);
        }
      };

      // Start with root nodes
      const rootNodes = parentMap.get(null) || [];
      for (const root of rootNodes) {
        await rebuildNode(root);
      }
    });
  }

  async hasChildren(structureId: string): Promise<boolean> {
    const child = await this.prisma.websiteStructure.findFirst({
      where: { parentId: structureId }
    });

    return !!child;
  }

  async getBreadcrumbs(structureId: string): Promise<Array<{ id: string; slug: string; fullPath: string }>> {
    const breadcrumbs: Array<{ id: string; slug: string; fullPath: string }> = [];
    
    let currentId: string | null = structureId;
    
    while (currentId) {
      const structure: any = await this.prisma.websiteStructure.findUnique({
        where: { id: currentId }
      });
      
      if (!structure) break;
      
      breadcrumbs.unshift({
        id: structure.id,
        slug: structure.slug,
        fullPath: structure.fullPath
      });
      
      currentId = structure.parentId;
    }
    
    return breadcrumbs;
  }

  async duplicateStructureSubtree(structureId: string, newParentId?: string | null): Promise<WebsiteStructure> {
    return await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const original = await tx.websiteStructure.findUnique({
        where: { id: structureId }
      });

      if (!original) {
        throw new Error('Structure not found');
      }

      // Create duplicate of root node
      const baseSlug = `${original.slug}-copy`;
      const uniqueSlug = await this.generateUniqueSlugTx(tx, original.websiteId, baseSlug, newParentId);
      const position = await this.getNextPositionTx(tx, original.websiteId, newParentId || null);
      const fullPath = await this.generateFullPathTx(tx, original.websiteId, uniqueSlug, newParentId || null);

      const duplicate = await tx.websiteStructure.create({
        data: {
          websiteId: original.websiteId,
          slug: uniqueSlug,
          fullPath,
          websitePageId: original.websitePageId,  // This might need special handling
          parentId: newParentId || null,
          position
        }
      });

      // Recursively duplicate children
      await this.duplicateChildren(tx, structureId, duplicate.id, duplicate.fullPath);

      return duplicate;
    });
  }

  // Helper methods
  private async getNextPosition(websiteId: string, parentId: string | null): Promise<number> {
    const lastItem = await this.prisma.websiteStructure.findFirst({
      where: {
        websiteId,
        parentId: parentId || null
      },
      orderBy: { position: 'desc' }
    });

    return lastItem ? lastItem.position + 1 : 0;
  }

  private async getNextPositionTx(tx: Prisma.TransactionClient, websiteId: string, parentId: string | null): Promise<number> {
    const lastItem = await tx.websiteStructure.findFirst({
      where: {
        websiteId,
        parentId: parentId || null
      },
      orderBy: { position: 'desc' }
    });

    return lastItem ? lastItem.position + 1 : 0;
  }

  private async generateFullPathTx(tx: Prisma.TransactionClient, websiteId: string, slug: string, parentId?: string | null): Promise<string> {
    if (!parentId) {
      return `/${slug}`;
    }

    const parent = await tx.websiteStructure.findUnique({
      where: { id: parentId }
    });

    if (!parent) {
      return `/${slug}`;
    }

    return `${parent.fullPath}/${slug}`.replace(/\/+/g, '/');
  }

  private async generateUniqueSlugTx(tx: Prisma.TransactionClient, websiteId: string, baseSlug: string, parentId?: string | null): Promise<string> {
    let slug = baseSlug;
    let counter = 1;

    while (true) {
      const existing = await tx.websiteStructure.findFirst({
        where: {
          websiteId,
          slug,
          parentId: parentId || null
        }
      });

      if (!existing) break;

      slug = `${baseSlug}-${counter}`;
      counter++;
    }

    return slug;
  }

  private async isDescendant(tx: Prisma.TransactionClient, parentId: string, potentialDescendantId: string): Promise<boolean> {
    let currentId: string | null = potentialDescendantId;
    
    while (currentId) {
      if (currentId === parentId) {
        return true;
      }
      
      const structure: any = await tx.websiteStructure.findUnique({
        where: { id: currentId }
      });
      
      currentId = structure?.parentId || null;
    }
    
    return false;
  }

  private async updateDescendantPaths(tx: Prisma.TransactionClient, structureId: string, newParentPath: string): Promise<void> {
    const children = await tx.websiteStructure.findMany({
      where: { parentId: structureId }
    });

    for (const child of children) {
      const newFullPath = `${newParentPath}/${child.slug}`.replace(/\/+/g, '/');
      
      await tx.websiteStructure.update({
        where: { id: child.id },
        data: { fullPath: newFullPath }
      });

      // Recursively update children
      await this.updateDescendantPaths(tx, child.id, newFullPath);
    }
  }

  private async duplicateChildren(tx: Prisma.TransactionClient, originalParentId: string, newParentId: string, parentPath: string): Promise<void> {
    const children = await tx.websiteStructure.findMany({
      where: { parentId: originalParentId },
      orderBy: { position: 'asc' }
    });

    for (const child of children) {
      const newFullPath = `${parentPath}/${child.slug}`.replace(/\/+/g, '/');
      
      const duplicateChild = await tx.websiteStructure.create({
        data: {
          websiteId: child.websiteId,
          slug: child.slug,
          fullPath: newFullPath,
          websitePageId: child.websitePageId,  // This might need special handling
          parentId: newParentId,
          position: child.position
        }
      });

      // Recursively duplicate children
      await this.duplicateChildren(tx, child.id, duplicateChild.id, newFullPath);
    }
  }
}
