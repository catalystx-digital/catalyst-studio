import { Node, Edge } from 'reactflow';
import { TreeNode } from '@/lib/types/site-structure.types';
import { ContentTypeCategory } from '@/lib/generated/prisma';

// Component data structure for global components
export interface ComponentData {
  id: string;
  type: string;
  props: Record<string, unknown>;
  content?: any;
  styles?: any;
  metadata?: any;
  parentId?: string | null;
  position?: number;
  [key: string]: any;
}

export interface SitemapNodeData {
  id?: string;
  label: string;
  slug: string;
  type?: string;
  contentTypeId?: string;
  fullPath?: string;
  parentId?: string | null;
  websitePageId?: string | null;
  components?: ComponentData[];
  childCount: number;
  metadata?: Record<string, unknown>;
  contentTypeCategory?: ContentTypeCategory;
  hasContent: boolean;
  // TKT-001: Weight for sibling ordering
  weight?: number;
  // Style properties
  backgroundColor?: string;
  textColor?: string;
  padding?: string;
  className?: string;
  // Redirect properties (stored in metadata, exposed for convenience)
  redirectUrl?: string;
  redirectType?: number;
  showInNav?: boolean;
  navLabel?: string;
  openInNewTab?: boolean;
}

/**
 * Fields that are stored in metadata but exposed as top-level properties
 * for easier access in the UI. These are automatically synced between
 * node.data and node.data.metadata.
 */
export const METADATA_BACKED_FIELDS = [
  'redirectUrl',
  'redirectType',
  'showInNav',
  'navLabel',
  'openInNewTab',
  'weight'  // ISS-SB-001: Include weight for node reordering
] as const;

export type MetadataBackedField = typeof METADATA_BACKED_FIELDS[number];

export type SitemapNode = Node<SitemapNodeData>;
export type SitemapEdge = Edge;

export interface TransformResult {
  nodes: SitemapNode[];
  edges: SitemapEdge[];
}

// Node operation data structures
export interface CreateNodeData {
  title: string;
  slug: string;
  parentId?: string | null;
  contentTypeId?: string;
  contentItemId?: string;
  weight?: number;
  metadata?: Record<string, unknown>;
}

export interface UpdateNodeData {
  title?: string;
  slug?: string;
  weight?: number;
  metadata?: Record<string, unknown>;
  status?: string;
}

export interface Operation {
  type: 'CREATE' | 'UPDATE' | 'DELETE' | 'MOVE';
  nodeId?: string;
  data?: CreateNodeData | UpdateNodeData;
  newParentId?: string;
}

export interface SaveRequest {
  websiteId: string;
  operations: Operation[];
  baseWebsiteRevision?: number | null;
}

export interface OperationResult {
  operationType: string;
  nodeId?: string;
  success: boolean;
  error?: string;
}

export interface SaveResponse {
  success: boolean;
  results?: OperationResult[];
  error?: string;
  currentWebsiteRevision?: number;
}
