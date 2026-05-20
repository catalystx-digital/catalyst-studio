/**
 * Dagre Auto-Layout Engine for Sitemap Builder
 * 
 * This module provides automatic layout positioning for sitemap nodes using the dagre library.
 * It calculates optimal positions for nodes based on their hierarchical relationships.
 * 
 * @module @/lib/studio/components/sitemap/layout
 */

export { calculateLayout } from './dagre-layout';

export type {
  LayoutNode,
  LayoutEdge,
  LayoutConfig,
  LayoutResult
} from './types';

export {
  DEFAULT_LAYOUT_CONFIG,
  NODE_DIMENSIONS,
  NODE_WIDTH,
  NODE_HEIGHT
} from './config';

export {
  getNodeType,
  validateRelationships,
  findOrphanedNodes,
  detectCircularDependencies,
  handleCircularDependencies,
  measurePerformance
} from './utils';