import { PrismaClient } from '@/lib/generated/prisma';
import { prisma } from '@/lib/prisma';

export interface IPathManager {
  buildPath(parentPath: string, slug: string): string;
  recalculatePaths(nodeId: string, newPath: string, tx?: PrismaClient): Promise<void>;
  getDepth(path: string): number;
  extractSlugFromPath(path: string): string;
  getParentPath(path: string): string;
}

export class PathManager implements IPathManager {
  constructor(private readonly db: PrismaClient = prisma) {}
  
  /**
   * Build a full path from parent path and slug
   * @param parentPath The parent's full path (empty string for root)
   * @param slug The node's slug
   * @returns The full path
   */
  buildPath(parentPath: string, slug: string): string {
    if (!slug) {
      return '/';
    }
    
    // Ensure slug doesn't contain slashes
    const cleanSlug = slug.replace(/\//g, '-');
    
    if (!parentPath || parentPath === '/') {
      return `/${cleanSlug}`;
    }
    
    // Remove trailing slash from parent path if present
    const cleanParentPath = parentPath.endsWith('/') 
      ? parentPath.slice(0, -1) 
      : parentPath;
    
    return `${cleanParentPath}/${cleanSlug}`;
  }
  
  /**
   * Recalculate paths for a node and all its descendants
   * @param nodeId The node whose path changed
   * @param newPath The node's new path
   * @param tx Optional transaction client
   */
  async recalculatePaths(
    nodeId: string, 
    newPath: string, 
    tx?: PrismaClient
  ): Promise<void> {
    const db = tx || this.db;
    
    // Get the node
    const node = await db.websiteStructure.findUnique({
      where: { id: nodeId }
    });
    
    if (!node) {
      return;
    }
    
    // Update the node's path and depth
    const newDepth = this.getDepth(newPath);
    await db.websiteStructure.update({
      where: { id: nodeId },
      data: {
        fullPath: newPath,
        pathDepth: newDepth
      }
    });
    
    // Get all direct children
    const children = await db.websiteStructure.findMany({
      where: { parentId: nodeId }
    });
    
    // Recursively update children's paths
    for (const child of children) {
      const childNewPath = this.buildPath(newPath, child.slug);
      await this.recalculatePaths(child.id, childNewPath, db);
    }
  }
  
  /**
   * Calculate the depth of a path
   * @param path The full path
   * @returns The depth (number of levels)
   */
  getDepth(path: string): number {
    if (!path || path === '/') {
      return 0;
    }
    
    // Remove leading and trailing slashes, then count segments
    const cleanPath = path.replace(/^\/|\/$/g, '');
    if (!cleanPath) {
      return 0;
    }
    
    return cleanPath.split('/').length;
  }
  
  /**
   * Extract the slug from a full path
   * @param path The full path
   * @returns The slug (last segment of the path)
   */
  extractSlugFromPath(path: string): string {
    if (!path || path === '/') {
      return '';
    }
    
    const segments = path.split('/').filter(s => s.length > 0);
    return segments[segments.length - 1] || '';
  }
  
  /**
   * Get the parent path from a full path
   * @param path The full path
   * @returns The parent path
   */
  getParentPath(path: string): string {
    if (!path || path === '/') {
      return '';
    }
    
    const lastSlashIndex = path.lastIndexOf('/');
    if (lastSlashIndex <= 0) {
      return '/';
    }
    
    return path.substring(0, lastSlashIndex) || '/';
  }
  
  /**
   * Validate a path format
   * @param path The path to validate
   * @returns True if valid
   */
  isValidPath(path: string): boolean {
    // Path must start with /
    if (!path.startsWith('/')) {
      return false;
    }
    
    // Path cannot have consecutive slashes
    if (path.includes('//')) {
      return false;
    }
    
    // Path cannot end with / unless it's the root
    if (path !== '/' && path.endsWith('/')) {
      return false;
    }
    
    // Path segments cannot be empty (except for root)
    const segments = path.split('/').slice(1);
    if (path !== '/' && segments.some(s => s.length === 0)) {
      return false;
    }
    
    return true;
  }
  
  /**
   * Normalize a path to ensure correct format
   * @param path The path to normalize
   * @returns The normalized path
   */
  normalizePath(path: string): string {
    if (!path) {
      return '/';
    }
    
    // Ensure path starts with /
    if (!path.startsWith('/')) {
      path = '/' + path;
    }
    
    // Remove consecutive slashes
    path = path.replace(/\/+/g, '/');
    
    // Remove trailing slash unless it's root
    if (path !== '/' && path.endsWith('/')) {
      path = path.slice(0, -1);
    }
    
    return path;
  }
  
  /**
   * Check if one path is an ancestor of another
   * @param ancestorPath The potential ancestor path
   * @param descendantPath The potential descendant path
   * @returns True if ancestorPath is an ancestor of descendantPath
   */
  isAncestorPath(ancestorPath: string, descendantPath: string): boolean {
    if (ancestorPath === descendantPath) {
      return false;
    }
    
    if (ancestorPath === '/') {
      return descendantPath !== '/';
    }
    
    return descendantPath.startsWith(ancestorPath + '/');
  }
  
  /**
   * Get all ancestor paths from a given path
   * @param path The path to get ancestors for
   * @returns Array of ancestor paths (from root to immediate parent)
   */
  getAncestorPaths(path: string): string[] {
    if (!path || path === '/') {
      return [];
    }
    
    const ancestors: string[] = [];
    const segments = path.split('/').filter(s => s.length > 0);
    
    let currentPath = '';
    for (let i = 0; i < segments.length - 1; i++) {
      currentPath += '/' + segments[i];
      ancestors.push(currentPath);
    }
    
    return ancestors;
  }
  
  /**
   * Calculate the relative path between two paths
   * @param fromPath The source path
   * @param toPath The target path
   * @returns The relative path
   */
  getRelativePath(fromPath: string, toPath: string): string {
    if (fromPath === toPath) {
      return '.';
    }
    
    const fromSegments = fromPath.split('/').filter(s => s.length > 0);
    const toSegments = toPath.split('/').filter(s => s.length > 0);
    
    // Find common prefix
    let commonLength = 0;
    for (let i = 0; i < Math.min(fromSegments.length, toSegments.length); i++) {
      if (fromSegments[i] === toSegments[i]) {
        commonLength++;
      } else {
        break;
      }
    }
    
    // Build relative path
    const upCount = fromSegments.length - commonLength;
    const relativeParts: string[] = [];
    
    for (let i = 0; i < upCount; i++) {
      relativeParts.push('..');
    }
    
    for (let i = commonLength; i < toSegments.length; i++) {
      relativeParts.push(toSegments[i]);
    }
    
    return relativeParts.join('/') || '.';
  }
}

// Export singleton instance
export const pathManager = new PathManager();
