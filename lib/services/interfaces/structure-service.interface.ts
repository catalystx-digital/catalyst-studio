import { Prisma } from '@/lib/generated/prisma';
import type { WebsiteStructure } from '@/lib/generated/prisma';

export interface CreateStructureDto {
  websiteId: string;
  slug: string;
  websitePageId?: string;
  parentId?: string | null;
  position?: number;
}

export interface UpdateStructureDto {
  slug?: string;
  parentId?: string | null;
  position?: number;
}

export interface StructureNode extends WebsiteStructure {
  children?: StructureNode[];
  parent?: WebsiteStructure | null;
}

export interface MoveStructureDto {
  structureId: string;
  newParentId: string | null;
  position?: number;
}

export interface BulkReorderDto {
  structures: Array<{
    id: string;
    position: number;
  }>;
}

/**
 * Service interface for WebsiteStructure operations
 */
export interface IStructureService {
  /**
   * Create a new structure entry
   */
  createStructure(data: CreateStructureDto): Promise<WebsiteStructure>;

  /**
   * Get structure by ID
   */
  getStructure(id: string): Promise<WebsiteStructure | null>;

  /**
   * Get structure by page ID
   */
  getStructureByPageId(websitePageId: string): Promise<WebsiteStructure | null>;

  /**
   * Update structure
   */
  updateStructure(id: string, data: UpdateStructureDto): Promise<WebsiteStructure>;

  /**
   * Delete structure
   */
  deleteStructure(id: string): Promise<void>;

  /**
   * Get website structure tree
   */
  getStructureTree(websiteId: string): Promise<StructureNode[]>;

  /**
   * Get structure with ancestors
   */
  getStructureWithAncestors(id: string): Promise<StructureNode>;

  /**
   * Get structure children
   */
  getStructureChildren(parentId: string): Promise<WebsiteStructure[]>;

  /**
   * Move structure to new parent
   */
  moveStructure(data: MoveStructureDto): Promise<WebsiteStructure>;

  /**
   * Bulk reorder structures at same level
   */
  bulkReorderStructures(data: BulkReorderDto): Promise<void>;

  /**
   * Generate unique slug for structure
   */
  generateUniqueSlug(websiteId: string, baseSlug: string, parentId?: string | null): Promise<string>;

  /**
   * Generate full path for structure
   */
  generateFullPath(websiteId: string, slug: string, parentId?: string | null): Promise<string>;

  /**
   * Validate structure path
   */
  validatePath(websiteId: string, path: string): Promise<boolean>;

  /**
   * Find structure by full path
   */
  findByFullPath(websiteId: string, fullPath: string): Promise<WebsiteStructure | null>;

  /**
   * Rebuild full paths for all structures
   */
  rebuildFullPaths(websiteId: string): Promise<void>;

  /**
   * Check if structure has children
   */
  hasChildren(structureId: string): Promise<boolean>;

  /**
   * Get breadcrumbs for structure
   */
  getBreadcrumbs(structureId: string): Promise<Array<{ id: string; slug: string; fullPath: string }>>;

  /**
   * Duplicate structure subtree
   */
  duplicateStructureSubtree(structureId: string, newParentId?: string | null): Promise<WebsiteStructure>;
}
