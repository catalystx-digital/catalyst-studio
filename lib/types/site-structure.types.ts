import { WebsiteStructure } from '@/lib/generated/prisma';

export interface CreateNodeInput {
  websiteId: string;
  websitePageId?: string | null;
  parentId?: string | null;
  slug: string;
  title: string;
  weight?: number;
}

export interface UpdateNodeInput {
  slug?: string;
  title?: string;
  weight?: number;
  websitePageId?: string | null;
}

export interface MoveNodeInput {
  nodeId: string;
  newParentId: string | null;
}

export interface BulkMoveInput {
  nodeId: string;
  newParentId: string | null;
}

export interface TreeNode extends WebsiteStructure {
  children: TreeNode[];
}

export interface BreadcrumbItem {
  id: string;
  title: string;
  path: string;
}

export interface ValidationReport {
  valid: boolean;
  errors: string[];
  warnings: string[];
  summary: string;
}

export interface PositionUpdate {
  id: string;
  position: number;
}

export interface PathUpdate {
  nodeId: string;
  oldPath: string;
  newPath: string;
  affectedDescendants: number;
}

export interface TreeStatistics {
  totalNodes: number;
  maxDepth: number;
  averageChildrenPerNode: number;
  orphanedNodes: number;
  pathInconsistencies: number;
}

export interface NodeWithMetadata extends WebsiteStructure {
  childCount?: number;
  descendantCount?: number;
  ancestorCount?: number;
  isLeaf?: boolean;
}

export interface TreeOperationResult {
  success: boolean;
  affectedNodes: string[];
  errors?: string[];
  warnings?: string[];
}

export interface BulkOperationResult {
  totalRequested: number;
  totalSucceeded: number;
  totalFailed: number;
  succeeded: string[];
  failed: Array<{
    id?: string;
    error: string;
  }>;
  executionTimeMs: number;
}

export interface TreeValidationOptions {
  checkOrphans?: boolean;
  checkPaths?: boolean;
  checkPositions?: boolean;
  checkDuplicateSlugs?: boolean;
  checkCircularReferences?: boolean;
  autoRepair?: boolean;
}

export interface TreeRepairOptions {
  fixOrphans?: boolean;
  fixPaths?: boolean;
  fixPositions?: boolean;
  removeDuplicates?: boolean;
  dryRun?: boolean;
}

export interface TreeExportOptions {
  includeContent?: boolean;
  includeMetadata?: boolean;
  format?: 'json' | 'yaml' | 'xml';
  maxDepth?: number;
}

export interface TreeImportOptions {
  websiteId: string;
  parentId?: string | null;
  overwrite?: boolean;
  preserveIds?: boolean;
  validateBeforeImport?: boolean;
}

export interface TreeSearchOptions {
  query: string;
  searchIn?: ('title' | 'slug' | 'path')[];
  maxResults?: number;
  websiteId?: string;
  parentId?: string | null;
  minDepth?: number;
  maxDepth?: number;
}

export interface TreeFilterOptions {
  websiteId?: string;
  parentId?: string | null;
  minDepth?: number;
  maxDepth?: number;
  hasContent?: boolean;
  modifiedAfter?: Date;
  modifiedBefore?: Date;
}

export interface TreeSortOptions {
  sortBy: 'position' | 'title' | 'slug' | 'createdAt' | 'updatedAt';
  sortOrder: 'asc' | 'desc';
  applyToChildren?: boolean;
}

export interface TreeCopyOptions {
  sourceNodeId: string;
  targetParentId: string | null;
  targetWebsiteId?: string;
  includeDescendants?: boolean;
  preserveSlugs?: boolean;
  suffix?: string;
}

export interface TreeMergeOptions {
  sourceWebsiteId: string;
  targetWebsiteId: string;
  targetParentId?: string | null;
  conflictResolution?: 'skip' | 'overwrite' | 'rename';
  preserveIds?: boolean;
}

export interface TreeDiffResult {
  added: WebsiteStructure[];
  removed: WebsiteStructure[];
  modified: Array<{
    node: WebsiteStructure;
    changes: Partial<WebsiteStructure>;
  }>;
  moved: Array<{
    node: WebsiteStructure;
    oldParentId: string | null;
    newParentId: string | null;
  }>;
}

export interface TreeSnapshot {
  websiteId: string;
  timestamp: Date;
  nodeCount: number;
  maxDepth: number;
  rootNodes: TreeNode[];
  metadata?: Record<string, unknown>;
}

export interface TreePermissions {
  canRead: boolean;
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  canMove: boolean;
  canReorder: boolean;
}

export interface TreeEventPayload {
  eventType: 'created' | 'updated' | 'deleted' | 'moved' | 'reordered';
  nodeId: string;
  websiteId: string;
  parentId?: string | null;
  changes?: Partial<WebsiteStructure>;
  timestamp: Date;
  userId?: string;
}