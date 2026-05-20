import dagre from 'dagre';
import { LayoutNode, LayoutEdge, LayoutConfig, LayoutResult } from './types';
import { LAYOUT, DAGRE_CONFIG } from '@/lib/studio/constants/layout-constants';

// Use shared constants
const DEFAULT_LAYOUT_CONFIG = DAGRE_CONFIG;
const NODE_DIMENSIONS = {
  width: LAYOUT.NODE_WIDTH,
  height: LAYOUT.NODE_HEIGHT,
} as const;

export function calculateLayout(
  nodes: LayoutNode[],
  edges: LayoutEdge[],
  config?: Partial<LayoutConfig>
): LayoutResult {
  // Input validation
  if (!Array.isArray(nodes)) {
    throw new Error('Nodes parameter must be an array');
  }
  
  if (!Array.isArray(edges)) {
    throw new Error('Edges parameter must be an array');
  }
  
  try {
    const startTime = performance.now();
    
    const g = new dagre.graphlib.Graph();
    
    const layoutConfig = {
      ...DEFAULT_LAYOUT_CONFIG,
      ...config
    };
    
    g.setGraph({
      rankdir: layoutConfig.rankdir,
      nodesep: layoutConfig.nodesep,
      ranksep: layoutConfig.ranksep,
      marginx: layoutConfig.marginx,
      marginy: layoutConfig.marginy
    });
    
    g.setDefaultEdgeLabel(() => ({}));
    
    nodes.forEach(node => {
      g.setNode(node.id, {
        width: NODE_DIMENSIONS.width,
        height: NODE_DIMENSIONS.height
      });
    });
    
    edges.forEach(edge => {
      try {
        g.setEdge(edge.source, edge.target);
      } catch (error) {
        if (process.env.NODE_ENV === 'development') {
        console.warn(`Failed to add edge from ${edge.source} to ${edge.target}:`, error);
        }
      }
    });
    
    dagre.layout(g);
    
    const positionedNodes = nodes.map(node => {
      const dagreNode = g.node(node.id);
      if (!dagreNode) {
        if (process.env.NODE_ENV === 'development') {
        console.warn(`Node ${node.id} not found in layout`);
        }
        return {
          ...node,
          position: { x: 0, y: 0 }
        };
      }
      
      return {
        ...node,
        position: {
          x: dagreNode.x - NODE_DIMENSIONS.width / 2,
          y: dagreNode.y - NODE_DIMENSIONS.height / 2
        }
      };
    });
    
    const duration = performance.now() - startTime;
    
    if (duration > 500 && nodes.length <= 100) {
      if (process.env.NODE_ENV === 'development') {
      console.warn(`Layout calculation took ${duration}ms for ${nodes.length} nodes`);
      }
    }
    
    return {
      nodes: positionedNodes,
      success: true
    };
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
    console.error('Layout calculation failed:', error);
    }
    return {
      nodes: nodes.map(node => ({
        ...node,
        position: node.position || { x: 0, y: 0 }
      })),
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
}