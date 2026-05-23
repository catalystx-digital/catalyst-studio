import { TreeNode } from '@/lib/types/site-structure.types';
import { ContentTypeCategory } from '@/lib/generated/prisma';
import { normalizePageContent, type PageContentDiagnostic } from '@/lib/studio/page-content';

/**
 * TreeNode with populated relations for transform operations
 * Properly typed to avoid @ts-ignore statements
 */
export interface PopulatedTreeNode {
  id: string;
  slug: string;
  title: string;
  websiteId: string;
  parentId?: string | null;
  websitePageId?: string | null;
  position: number;
  createdAt: Date;
  updatedAt: Date;
  contentType?: {
    category: ContentTypeCategory;
  };
  websitePage?: {
    title: string;
    content: any | null;
    metadata: any | null;
    type: string;
  };
  children?: PopulatedTreeNode[];
}

/**
 * Type guard to check if a node has populated content
 */
export function hasPopulatedContent(node: PopulatedTreeNode): boolean {
  return node.websitePageId !== null && node.websitePageId !== undefined;
}

/**
 * Safe accessor for node type with proper fallback
 */
export function getNodeType(node: PopulatedTreeNode): ContentTypeCategory {
  if (node.contentType?.category) {
    return node.contentType.category;
  }
  // Use websitePage.type to determine if it's a page or folder
  if (node.websitePage?.type === 'page') {
    return 'page';
  }
  return node.websitePageId ? 'page' : 'folder';
}

/**
 * Safe accessor for node label with fallback chain
 */
export function getNodeLabel(node: PopulatedTreeNode): string {
  return node.title || node.websitePage?.title || node.slug;
}

/**
 * Safe accessor for components array
 */
export function getNodeComponents(node: PopulatedTreeNode & { components?: unknown[] }): unknown[] {
  // First check if components exist directly on the node (from React Flow data)
  if (node.components) {
    return node.components;
  }
  
  // Then check websitePage content
  if (hasPopulatedContent(node) && node.websitePage?.content) {
    return normalizePageContent(node.websitePage.content, { mode: 'strict-read' }).pageContent.components;
  }
  return [];
}

/**
 * Safe accessor for page-content read diagnostics
 */
export function getNodeContentDiagnostics(node: PopulatedTreeNode): PageContentDiagnostic[] {
  if (hasPopulatedContent(node) && node.websitePage?.content) {
    return normalizePageContent(node.websitePage.content, { mode: 'strict-read' }).diagnostics;
  }
  return [];
}

/**
 * Safe accessor for metadata
 */
export function getNodeMetadata(node: PopulatedTreeNode): Record<string, unknown> | undefined {
  if (hasPopulatedContent(node)) {
    return node.websitePage?.metadata;
  }
  return undefined;
}
