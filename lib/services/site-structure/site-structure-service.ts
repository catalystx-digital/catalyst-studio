import { PrismaClient, WebsiteStructure, Prisma } from '@/lib/generated/prisma';
import { prisma } from '@/lib/prisma';
import {
  CircularReferenceError,
  NodeNotFoundError,
  InvalidOperationError
} from './errors';
import { invalidateLayoutOnStructureChange } from '@/lib/studio/services/layout/layout-invalidation';
import { PathManager } from './path-manager';
import { WebsiteStructureRepository } from './site-structure-repository';
import { redirectService } from '@/lib/services/redirect-service';
import { 
  CreateNodeInput,
  UpdateNodeInput,
  MoveNodeInput,
  BulkMoveInput,
  TreeNode,
  ValidationReport,
  BreadcrumbItem
} from '@/lib/types/site-structure.types';

export interface ISiteStructureService {
  // Tree operations
  getTree(websiteId: string): Promise<TreeNode>;
  getAncestors(nodeId: string): Promise<WebsiteStructure[]>;
  getDescendants(nodeId: string): Promise<WebsiteStructure[]>;
  getSiblings(nodeId: string): Promise<WebsiteStructure[]>;
  getBreadcrumbs(nodeId: string): Promise<BreadcrumbItem[]>;
  
  // CRUD operations
  create(input: CreateNodeInput): Promise<WebsiteStructure>;
  update(id: string, updates: UpdateNodeInput): Promise<WebsiteStructure>;
  delete(id: string, tx?: Prisma.TransactionClient): Promise<void>;
  runPendingCleanup(): Promise<void>;

  // Move operations
  moveNode(nodeId: string, newParentId: string | null): Promise<WebsiteStructure>;
  validateMove(nodeId: string, targetParentId: string | null): Promise<boolean>;
  wouldCreateCycle(nodeId: string, targetParentId: string | null): Promise<boolean>;
  
  // Position management
  reorderSiblings(parentId: string | null, websiteId: string, positions: { id: string; position: number }[]): Promise<void>;
  insertAtPosition(nodeId: string, position: number): Promise<WebsiteStructure>;
  swapPositions(nodeId1: string, nodeId2: string): Promise<void>;
  
  // Bulk operations
  bulkCreate(nodes: CreateNodeInput[]): Promise<WebsiteStructure[]>;
  bulkUpdate(updates: { id: string; updates: UpdateNodeInput }[]): Promise<WebsiteStructure[]>;
  bulkDelete(nodeIds: string[]): Promise<void>;
  bulkMove(moves: BulkMoveInput[]): Promise<WebsiteStructure[]>;
  
  // Validation
  validateTree(websiteId: string): Promise<ValidationReport>;
  findOrphanedNodes(websiteId: string): Promise<WebsiteStructure[]>;
  validatePaths(websiteId: string): Promise<ValidationReport>;
  repairTree(websiteId: string): Promise<ValidationReport>;
}

export class SiteStructureService implements ISiteStructureService {
  private readonly pathManager: PathManager;
  private readonly repository: WebsiteStructureRepository;
  
  constructor(
    private readonly db: PrismaClient = prisma
  ) {
    this.pathManager = new PathManager(db);
    this.repository = new WebsiteStructureRepository(db);
  }
  
  // Tree operations
  /**
   * Get complete tree structure for a website
   * Time Complexity: O(n) where n is the number of nodes
   * Space Complexity: O(n) for storing the tree structure
   */
  async getTree(websiteId: string): Promise<TreeNode> {
    const nodes = await this.repository.findByWebsiteId(websiteId);
    return this.buildTreeFromNodes(nodes);
  }
  
  /**
   * Get all ancestor nodes from a node up to the root
   * Time Complexity: O(d) where d is the depth of the node
   * Space Complexity: O(d) for storing ancestors
   */
  async getAncestors(nodeId: string): Promise<WebsiteStructure[]> {
    const ancestors: WebsiteStructure[] = [];
    let currentNode = await this.repository.findById(nodeId);
    
    if (!currentNode) {
      throw new NodeNotFoundError(nodeId);
    }
    
    while (currentNode.parentId) {
      const parent = await this.repository.findById(currentNode.parentId);
      if (!parent) break;
      ancestors.push(parent);
      currentNode = parent;
    }
    
    return ancestors.reverse();
  }
  
  /**
   * Get all descendant nodes recursively
   * Time Complexity: O(s) where s is the size of the subtree
   * Space Complexity: O(s) for storing descendants
   */
  async getDescendants(nodeId: string): Promise<WebsiteStructure[]> {
    const node = await this.repository.findById(nodeId);
    if (!node) {
      throw new NodeNotFoundError(nodeId);
    }
    
    const descendants: WebsiteStructure[] = [];
    const queue = [nodeId];
    
    while (queue.length > 0) {
      const currentId = queue.shift()!;
      const children = await this.repository.findChildren(currentId);
      descendants.push(...children);
      queue.push(...children.map(c => c.id));
    }
    
    return descendants;
  }
  
  async getSiblings(nodeId: string): Promise<WebsiteStructure[]> {
    const node = await this.repository.findById(nodeId);
    if (!node) {
      throw new NodeNotFoundError(nodeId);
    }
    
    const siblings = await this.repository.findChildren(node.parentId);
    return siblings.filter(s => s.id !== nodeId);
  }
  
  async getBreadcrumbs(nodeId: string): Promise<BreadcrumbItem[]> {
    const node = await this.repository.findById(nodeId);
    if (!node) {
      throw new NodeNotFoundError(nodeId);
    }
    
    const ancestors = await this.getAncestors(nodeId);
    const breadcrumbs: BreadcrumbItem[] = ancestors.map(ancestor => ({
      id: ancestor.id,
      title: ancestor.slug, // Using slug as title since SiteStructure doesn't have title field
      path: ancestor.fullPath
    }));
    
    breadcrumbs.push({
      id: node.id,
      title: node.slug, // Using slug as title since SiteStructure doesn't have title field
      path: node.fullPath
    });
    
    return breadcrumbs;
  }
  
  // CRUD operations
  async create(input: CreateNodeInput): Promise<WebsiteStructure> {
    const node = await this.db.$transaction(async (tx: Prisma.TransactionClient) => {
      // Calculate position
      const siblings = await this.repository.findChildren(input.parentId || null, tx as any);
      const position = siblings.length > 0
        ? Math.max(...siblings.map(s => s.position)) + 1
        : 0;

      // Build path
      const parentPath = input.parentId
        ? (await this.repository.findById(input.parentId, tx as any))?.fullPath || ''
        : '';
      const fullPath = this.pathManager.buildPath(parentPath, input.slug);
      const pathDepth = this.pathManager.getDepth(fullPath);

      // Create node
      return await tx.websiteStructure.create({
        data: {
          websiteId: input.websiteId,
          websitePageId: input.websitePageId,
          parentId: input.parentId,
          slug: input.slug,
          fullPath,
          pathDepth,
          position,
          weight: input.weight || 0
        }
      });
    });

    // Invalidate layout positions after structure change
    await invalidateLayoutOnStructureChange(input.websiteId);

    return node;
  }
  
  async update(id: string, updates: UpdateNodeInput): Promise<WebsiteStructure> {
    return await this.db.$transaction(async (tx: Prisma.TransactionClient) => {
      const node = await this.repository.findById(id, tx as any);
      if (!node) {
        throw new NodeNotFoundError(id);
      }
      
      // Filter out title field as it's not in the SiteStructure database
      const { title, ...dbUpdates } = updates;
      
      // Update title in ContentItem if provided and node has content
      if (title && node.websitePageId) {
        await tx.websitePage.update({
          where: { id: node.websitePageId },
          data: { title }
        });
      }
      
      // If slug changed, recalculate paths
      if (updates.slug && updates.slug !== node.slug) {
        const parent = node.parentId 
          ? await this.repository.findById(node.parentId, tx as any)
          : null;
        const parentPath = parent?.fullPath || '';
        const newPath = this.pathManager.buildPath(parentPath, updates.slug);
        
        // Update node and cascade to descendants
        await this.pathManager.recalculatePaths(id, newPath, tx as any);
        
        return await tx.websiteStructure.update({
          where: { id },
          data: {
            ...dbUpdates,
            fullPath: newPath,
            pathDepth: this.pathManager.getDepth(newPath)
          }
        });
      }
      
      return await tx.websiteStructure.update({
        where: { id },
        data: dbUpdates
      });
    });
  }
  
  /**
   * Delete result containing cleanup tasks to run after transaction completes
   */
  private pendingCleanup: { websiteId: string; paths: string[]; parentId: string | null }[] = [];

  async delete(id: string, tx?: Prisma.TransactionClient): Promise<void> {
    // OPTIMIZATION: Fetch all data BEFORE transaction to minimize in-transaction queries
    // Prisma Accelerate charges network overhead per query inside interactive transactions

    const node = await this.repository.findById(id);
    if (!node) {
      throw new NodeNotFoundError(id);
    }
    const websiteId = node.websiteId;
    const parentId = node.parentId;

    // Get descendants BEFORE transaction
    const descendants = await this.db.websiteStructure.findMany({
      where: {
        websiteId,
        fullPath: { startsWith: node.fullPath + '/' },
        id: { not: id }
      },
      select: { id: true, fullPath: true }
    });

    const descendantIds = descendants.map(d => d.id);
    const pathsToCleanup = [
      ...descendants.map(d => d.fullPath).filter(Boolean),
      node.fullPath
    ].filter((p): p is string => !!p);

    // MINIMAL transaction - only deletions, no queries
    const performDeletion = async (dbClient: Prisma.TransactionClient | PrismaClient) => {
      if (descendantIds.length > 0) {
        await (dbClient as PrismaClient).websiteStructure.deleteMany({
          where: { id: { in: descendantIds } }
        });
      }
      await (dbClient as PrismaClient).websiteStructure.delete({ where: { id } });
    };

    if (tx) {
      await performDeletion(tx);
      // Store cleanup tasks including sibling normalization
      this.pendingCleanup.push({ websiteId, paths: pathsToCleanup, parentId });
    } else {
      await this.db.$transaction(async (newTx) => {
        await performDeletion(newTx);
      });
      // Normalize siblings AFTER transaction (not inside)
      await this.normalizeSiblingPositions(parentId);
      await this.runCleanup(websiteId, pathsToCleanup);
    }
  }

  /**
   * Normalize sibling positions after a delete
   */
  private async normalizeSiblingPositions(parentId: string | null): Promise<void> {
    const siblings = await this.repository.findChildren(parentId);
    if (siblings.length > 0) {
      await this.normalizePositions(siblings);
    }
  }

  /**
   * Run pending cleanup tasks after transaction completes
   */
  async runPendingCleanup(): Promise<void> {
    const tasks = [...this.pendingCleanup];
    this.pendingCleanup = [];

    for (const { websiteId, paths, parentId } of tasks) {
      // Normalize sibling positions AFTER transaction
      await this.normalizeSiblingPositions(parentId);
      await this.runCleanup(websiteId, paths);
    }
  }

  private async runCleanup(websiteId: string, pathsToCleanup: string[]): Promise<void> {
    // Clean up redirects (non-critical, fire-and-forget)
    Promise.all(
      pathsToCleanup.map(fullPath =>
        redirectService.removePageRedirect({ websiteId, sourcePath: fullPath })
          .catch(err => console.error('Failed to cleanup redirect:', fullPath, err))
      )
    ).catch(() => {}); // Don't await, don't fail

    // Invalidate layout positions
    await invalidateLayoutOnStructureChange(websiteId);
  }
  
  // Move operations
  /**
   * Move a node to a new parent, updating all descendant paths
   * Time Complexity: O(d) where d is the number of descendants
   * Space Complexity: O(d) for path updates
   */
  async moveNode(nodeId: string, newParentId: string | null): Promise<WebsiteStructure> {
    // Validate move
    if (!(await this.validateMove(nodeId, newParentId))) {
      throw new CircularReferenceError('Move would create circular reference');
    }

    const updatedNode = await this.db.$transaction(async (tx: Prisma.TransactionClient) => {
      const node = await this.repository.findById(nodeId, tx as any);
      if (!node) {
        throw new NodeNotFoundError(nodeId);
      }

      // Get new parent path
      const newParent = newParentId
        ? await this.repository.findById(newParentId, tx as any)
        : null;
      const newParentPath = newParent?.fullPath || '';

      // Calculate new path
      const newPath = this.pathManager.buildPath(newParentPath, node.slug);
      const newDepth = this.pathManager.getDepth(newPath);

      // Get new position
      const newSiblings = await this.repository.findChildren(newParentId, tx as any);
      const newPosition = newSiblings.length > 0
        ? Math.max(...newSiblings.map(s => s.position)) + 1
        : 0;

      // Update node
      const updated = await tx.websiteStructure.update({
        where: { id: nodeId },
        data: {
          parentId: newParentId,
          fullPath: newPath,
          pathDepth: newDepth,
          position: newPosition
        }
      });

      // Recalculate paths for descendants
      await this.pathManager.recalculatePaths(nodeId, newPath, tx as any);

      // Reorder old siblings
      const oldSiblings = await this.repository.findChildren(node.parentId, tx as any);
      await this.normalizePositions(oldSiblings, tx as any);

      return updated;
    });

    // Invalidate layout positions after structure change
    await invalidateLayoutOnStructureChange(updatedNode.websiteId);

    return updatedNode;
  }
  
  async validateMove(nodeId: string, targetParentId: string | null): Promise<boolean> {
    if (nodeId === targetParentId) {
      return false;
    }
    
    if (!targetParentId) {
      return true; // Moving to root is always valid
    }
    
    return !(await this.wouldCreateCycle(nodeId, targetParentId));
  }
  
  /**
   * Check if moving a node would create a circular reference
   * Time Complexity: O(s) where s is the size of the subtree
   * Space Complexity: O(s) for descendant storage
   */
  async wouldCreateCycle(nodeId: string, targetParentId: string | null): Promise<boolean> {
    if (!targetParentId) {
      return false;
    }
    
    const descendants = await this.getDescendants(nodeId);
    return descendants.some(d => d.id === targetParentId);
  }
  
  // Position management
  async reorderSiblings(
    parentId: string | null,
    websiteId: string,
    positions: { id: string; position: number }[]
  ): Promise<void> {
    await this.db.$transaction(async (tx: Prisma.TransactionClient) => {
      // Validate all nodes belong to same parent
      const nodes = await tx.websiteStructure.findMany({
        where: {
          id: { in: positions.map(p => p.id) },
          parentId,
          websiteId
        }
      });

      if (nodes.length !== positions.length) {
        throw new InvalidOperationError('Some nodes do not belong to the specified parent');
      }

      // Update positions
      for (const { id, position } of positions) {
        await tx.websiteStructure.update({
          where: { id },
          data: { position }
        });
      }
    });

    // Invalidate layout positions after structure change
    await invalidateLayoutOnStructureChange(websiteId);
  }
  
  async insertAtPosition(nodeId: string, position: number): Promise<WebsiteStructure> {
    return await this.db.$transaction(async (tx: Prisma.TransactionClient) => {
      const node = await this.repository.findById(nodeId, tx as any);
      if (!node) {
        throw new NodeNotFoundError(nodeId);
      }
      
      // Get siblings
      const siblings = await this.repository.findChildren(node.parentId, tx as any);
      
      // Shift positions of nodes at or after target position
      for (const sibling of siblings) {
        if (sibling.position >= position && sibling.id !== nodeId) {
          await tx.websiteStructure.update({
            where: { id: sibling.id },
            data: { position: sibling.position + 1 }
          });
        }
      }
      
      // Update node position
      return await tx.websiteStructure.update({
        where: { id: nodeId },
        data: { position }
      });
    });
  }
  
  async swapPositions(nodeId1: string, nodeId2: string): Promise<void> {
    await this.db.$transaction(async (tx) => {
      const node1 = await this.repository.findById(nodeId1, tx as any);
      const node2 = await this.repository.findById(nodeId2, tx as any);
      
      if (!node1 || !node2) {
        throw new NodeNotFoundError('One or both nodes not found');
      }
      
      if (node1.parentId !== node2.parentId) {
        throw new InvalidOperationError('Nodes must have the same parent');
      }
      
      // Swap positions
      const tempPosition = node1.position;
      await tx.websiteStructure.update({
        where: { id: nodeId1 },
        data: { position: node2.position }
      });
      await tx.websiteStructure.update({
        where: { id: nodeId2 },
        data: { position: tempPosition }
      });
    });
  }
  
  // Bulk operations
  /**
   * Create multiple nodes in a single transaction
   * Time Complexity: O(n) where n is the number of nodes
   * Space Complexity: O(n) for storing created nodes
   */
  async bulkCreate(nodes: CreateNodeInput[]): Promise<WebsiteStructure[]> {
    return await this.db.$transaction(async (tx) => {
      const created: WebsiteStructure[] = [];
      
      for (const node of nodes) {
        const result = await this.create(node);
        created.push(result);
      }
      
      return created;
    });
  }
  
  async bulkUpdate(updates: { id: string; updates: UpdateNodeInput }[]): Promise<WebsiteStructure[]> {
    return await this.db.$transaction(async (tx) => {
      const updated: WebsiteStructure[] = [];
      
      for (const { id, updates: nodeUpdates } of updates) {
        const result = await this.update(id, nodeUpdates);
        updated.push(result);
      }
      
      return updated;
    });
  }
  
  async bulkDelete(nodeIds: string[]): Promise<void> {
    await this.db.$transaction(async (tx) => {
      for (const nodeId of nodeIds) {
        await this.delete(nodeId);
      }
    });
  }
  
  async bulkMove(moves: BulkMoveInput[]): Promise<WebsiteStructure[]> {
    return await this.db.$transaction(async (tx) => {
      const moved: WebsiteStructure[] = [];
      
      // Validate all moves first
      for (const move of moves) {
        if (!(await this.validateMove(move.nodeId, move.newParentId))) {
          throw new CircularReferenceError(`Move of ${move.nodeId} would create circular reference`);
        }
      }
      
      // Execute moves
      for (const move of moves) {
        const result = await this.moveNode(move.nodeId, move.newParentId);
        moved.push(result);
      }
      
      return moved;
    });
  }
  
  // Validation
  async validateTree(websiteId: string): Promise<ValidationReport> {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    const nodes = await this.repository.findByWebsiteId(websiteId);
    
    // Check for orphaned nodes
    const orphaned = await this.findOrphanedNodes(websiteId);
    if (orphaned.length > 0) {
      errors.push(`Found ${orphaned.length} orphaned nodes`);
    }
    
    // Check for path consistency
    const pathReport = await this.validatePaths(websiteId);
    errors.push(...pathReport.errors);
    warnings.push(...pathReport.warnings);
    
    // Check for duplicate slugs at same level
    const slugMap = new Map<string, string[]>();
    for (const node of nodes) {
      const key = `${node.parentId || 'root'}-${node.slug}`;
      if (!slugMap.has(key)) {
        slugMap.set(key, []);
      }
      slugMap.get(key)!.push(node.id);
    }
    
    for (const [key, nodeIds] of slugMap.entries()) {
      if (nodeIds.length > 1) {
        errors.push(`Duplicate slug "${key}" for nodes: ${nodeIds.join(', ')}`);
      }
    }
    
    return {
      valid: errors.length === 0,
      errors,
      warnings,
      summary: `Found ${errors.length} errors and ${warnings.length} warnings`
    };
  }
  
  async findOrphanedNodes(websiteId: string): Promise<WebsiteStructure[]> {
    const nodes = await this.repository.findByWebsiteId(websiteId);
    const nodeIds = new Set(nodes.map(n => n.id));
    const orphaned: WebsiteStructure[] = [];
    
    for (const node of nodes) {
      if (node.parentId && !nodeIds.has(node.parentId)) {
        orphaned.push(node);
      }
    }
    
    return orphaned;
  }
  
  async validatePaths(websiteId: string): Promise<ValidationReport> {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    const nodes = await this.repository.findByWebsiteId(websiteId);
    
    for (const node of nodes) {
      // Reconstruct expected path
      let expectedPath = '';
      if (node.parentId) {
        const parent = nodes.find(n => n.id === node.parentId);
        if (parent) {
          expectedPath = this.pathManager.buildPath(parent.fullPath, node.slug);
        }
      } else {
        expectedPath = `/${node.slug}`;
      }
      
      // Compare with actual path
      if (node.fullPath !== expectedPath) {
        errors.push(`Path mismatch for node ${node.id}: expected "${expectedPath}", got "${node.fullPath}"`);
      }
      
      // Check depth
      const expectedDepth = this.pathManager.getDepth(node.fullPath);
      if (node.pathDepth !== expectedDepth) {
        warnings.push(`Depth mismatch for node ${node.id}: expected ${expectedDepth}, got ${node.pathDepth}`);
      }
    }
    
    return {
      valid: errors.length === 0,
      errors,
      warnings,
      summary: `Path validation: ${errors.length} errors, ${warnings.length} warnings`
    };
  }
  
  async repairTree(websiteId: string): Promise<ValidationReport> {
    const report = await this.validateTree(websiteId);
    const repairs: string[] = [];
    
    await this.db.$transaction(async (tx) => {
      // Fix orphaned nodes by moving to root
      const orphaned = await this.findOrphanedNodes(websiteId);
      for (const node of orphaned) {
        await tx.websiteStructure.update({
          where: { id: node.id },
          data: { parentId: null }
        });
        repairs.push(`Moved orphaned node ${node.id} to root`);
      }
      
      // Fix path inconsistencies
      const nodes = await this.repository.findByWebsiteId(websiteId, tx as any);
      for (const node of nodes) {
        const parent = node.parentId 
          ? nodes.find(n => n.id === node.parentId)
          : null;
        const parentPath = parent?.fullPath || '';
        const correctPath = this.pathManager.buildPath(parentPath, node.slug);
        const correctDepth = this.pathManager.getDepth(correctPath);
        
        if (node.fullPath !== correctPath || node.pathDepth !== correctDepth) {
          await tx.websiteStructure.update({
            where: { id: node.id },
            data: {
              fullPath: correctPath,
              pathDepth: correctDepth
            }
          });
          repairs.push(`Fixed path for node ${node.id}`);
        }
      }
      
      // Normalize positions
      const parentGroups = new Map<string | null, WebsiteStructure[]>();
      for (const node of nodes) {
        const key = node.parentId;
        if (!parentGroups.has(key)) {
          parentGroups.set(key, []);
        }
        parentGroups.get(key)!.push(node);
      }
      
      for (const [parentId, children] of parentGroups.entries()) {
        await this.normalizePositions(children, tx as any);
        if (children.length > 0) {
          repairs.push(`Normalized positions for ${children.length} children of ${parentId || 'root'}`);
        }
      }
    });
    
    return {
      valid: true,
      errors: [],
      warnings: repairs,
      summary: `Repaired ${repairs.length} issues`
    };
  }
  
  // Helper methods
  private buildTreeFromNodes(nodes: WebsiteStructure[]): TreeNode {
    const nodeMap = new Map<string | null, WebsiteStructure[]>();
    
    // Group nodes by parent
    for (const node of nodes) {
      const parentId = node.parentId;
      if (!nodeMap.has(parentId)) {
        nodeMap.set(parentId, []);
      }
      nodeMap.get(parentId)!.push(node);
    }
    
    // Build tree recursively
    const buildNode = (node: WebsiteStructure): TreeNode => {
      const children = nodeMap.get(node.id) || [];
      return {
        ...node,
        children: children
          .sort((a, b) => a.position - b.position)
          .map(child => buildNode(child))
      };
    };
    
    // Find root nodes and build tree
    const roots = nodeMap.get(null) || [];
    if (roots.length === 0) {
      return {
        id: 'root',
        websiteId: nodes[0]?.websiteId || '',
        title: 'Root',
        slug: '',
        fullPath: '/',
        pathDepth: 0,
        position: 0,
        weight: 0,
        parentId: null,
        websitePageId: null,
        children: [],
        createdAt: new Date(),
        updatedAt: new Date()
      } as any;
    }

    if (roots.length === 1) {
      return buildNode(roots[0]);
    }

    // Multiple roots: prefer the homepage as the true root if present
    const homeRoot = roots.find(r => r.fullPath === '/' || r.slug?.toLowerCase() === 'home') || roots[0]
    const builtHome = buildNode(homeRoot)

    // Attach any other root nodes under Home in the returned tree (presentation-only)
    const extraRoots = roots
      .filter(r => r.id !== homeRoot.id)
      .sort((a, b) => a.position - b.position)
      .map(r => buildNode(r))

    return {
      ...builtHome,
      // Merge existing children with extra root subtrees
      children: [...(builtHome.children || []), ...extraRoots]
    } as TreeNode
  }
  
  private async normalizePositions(
    nodes: WebsiteStructure[], 
    tx?: PrismaClient
  ): Promise<void> {
    const db = tx || this.db;
    const sorted = nodes.sort((a, b) => a.position - b.position);
    
    for (let i = 0; i < sorted.length; i++) {
      if (sorted[i].position !== i) {
        await db.websiteStructure.update({
          where: { id: sorted[i].id },
          data: { position: i }
        });
      }
    }
  }
}

// Export singleton instance
export const siteStructureService = new SiteStructureService();
