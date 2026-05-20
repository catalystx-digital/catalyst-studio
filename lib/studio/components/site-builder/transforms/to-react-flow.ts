import { TreeNode } from '@/lib/types/site-structure.types';
import { SitemapNode, SitemapEdge, TransformResult, ComponentData, METADATA_BACKED_FIELDS } from '../types';
import {
  PopulatedTreeNode,
  hasPopulatedContent,
  getNodeType,
  getNodeLabel,
  getNodeComponents,
  getNodeMetadata
} from '../types/populated-tree';

/**
 * Transform database tree structure to React Flow nodes and edges
 * @param treeData The tree data from the database
 * @returns Object containing React Flow nodes and edges arrays
 */
export function transformToReactFlow(treeData: TreeNode | TreeNode[] | PopulatedTreeNode | PopulatedTreeNode[]): TransformResult {
  const nodes: SitemapNode[] = [];
  const edges: SitemapEdge[] = [];
  
  if (process.env.NODE_ENV === 'development') {
  console.log('[Transform] Starting transform with treeData:', treeData);
  }
  
  function traverse(node: PopulatedTreeNode, parent?: string, parentPath: string = '') {
    // Validate required fields - allow empty slug for root node
    if (!node.id || (!node.slug && node.slug !== '')) {
      if (process.env.NODE_ENV === 'development') {
      console.warn('Skipping invalid node:', node);
      }
      return;
    }
    
    // Build fullPath from hierarchy traversal (NOT from node.fullPath which may be different)
    const fullPath = parentPath ? `${parentPath}/${node.slug}` : node.slug;
    
    // Safe type detection with proper type helpers
    const nodeType = getNodeType(node);
    const hasContent = hasPopulatedContent(node);
    const components = getNodeComponents(node);
    // Ensure plain JSON objects (avoid Proxies/non-enumerables leaking from DB/ORM)
    let componentsPlain: any[] = []
    try {
      componentsPlain = JSON.parse(JSON.stringify(components))
    } catch {
      componentsPlain = Array.isArray(components) ? components as any[] : []
    }
    if (process.env.NODE_ENV === 'development') {
    console.log('[Transform] Node:', node.id, 'Raw node.websitePage?.content:', node.websitePage?.content);
    }
    if (process.env.NODE_ENV === 'development') {
    console.log('[Transform] Node:', node.id, 'Components from getNodeComponents:', components);
    }
    const rawMetadata = getNodeMetadata(node);
    let metadata: Record<string, any> | undefined;
    if (rawMetadata && typeof rawMetadata === 'object' && !Array.isArray(rawMetadata)) {
      metadata = { ...(rawMetadata as Record<string, any>) };
    }

    const derivedImportStatus = (() => {
      if (metadata && typeof metadata.importStatus === 'string') {
        return metadata.importStatus as string;
      }
      const pageStatus = (node as any)?.websitePage?.status;
      if (typeof pageStatus === 'string' && pageStatus === 'invalid') {
        return 'invalid';
      }
      return undefined;
    })();

    if (derivedImportStatus) {
      if (!metadata) {
        metadata = {};
      }
      metadata.importStatus = derivedImportStatus;
      if (typeof metadata.status !== 'string') {
        metadata.status = `import-${derivedImportStatus}`;
      }
    } else if (metadata && typeof metadata.status === 'string' && metadata.status.startsWith('import-') && typeof metadata.importStatus !== 'string') {
      metadata.importStatus = metadata.status.replace('import-', '');
    }

    const label = getNodeLabel(node);

    // Extract metadata-backed fields from metadata for easier UI access
    // This creates a single source of truth (metadata) with convenient top-level access
    const metadataBackedData: Record<string, any> = {};
    if (metadata) {
      for (const field of METADATA_BACKED_FIELDS) {
        if (metadata[field] !== undefined) {
          metadataBackedData[field] = metadata[field];
        }
      }
    }

    // Create React Flow node with validated data
    const flowNode: SitemapNode = {
      id: node.id,
      type: nodeType,
      position: { x: 0, y: 0 }, // Dagre will calculate actual positions
      data: {
        label: label,
        slug: node.slug,
        websitePageId: (node as any).websitePageId ?? null,
        fullPath: fullPath,
        components: componentsPlain as ComponentData[],
        childCount: node.children?.length || 0,
        metadata: metadata,
        contentTypeCategory: nodeType,
        hasContent: hasContent,
        // Spread metadata-backed fields for convenient access
        ...metadataBackedData
      }
    };
    
    nodes.push(flowNode);
    
    // Create edge to parent with type specification
    if (parent) {
      edges.push({
        id: `${parent}-${node.id}`,
        source: parent,
        target: node.id,
        type: 'smoothstep' // Edge type for better visual
      });
    }
    
    // Recursively process children with accumulated path
    if (node.children && Array.isArray(node.children)) {
      node.children.forEach(child => traverse(child, node.id, fullPath));
    }
  }
  
  // Handle both single node and array of nodes (for multiple root nodes)
  if (Array.isArray(treeData)) {
    treeData.forEach(node => traverse(node as PopulatedTreeNode));
  } else {
    traverse(treeData as PopulatedTreeNode);
  }
  
  return { nodes, edges };
}
