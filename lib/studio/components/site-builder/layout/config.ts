/**
 * Layout configuration for React Flow / Dagre client-side layout
 *
 * IMPORTANT: All values are imported from the single source of truth.
 * @see lib/studio/constants/layout-constants.ts
 */

import { LAYOUT, DAGRE_CONFIG } from '@/lib/studio/constants/layout-constants';
import { LayoutConfig } from './types';

// Re-export constants for backwards compatibility
export const NODE_WIDTH = LAYOUT.NODE_WIDTH;
export const NODE_HEIGHT = LAYOUT.NODE_HEIGHT;

export const DEFAULT_LAYOUT_CONFIG: LayoutConfig = {
  rankdir: DAGRE_CONFIG.rankdir,
  nodesep: DAGRE_CONFIG.nodesep,
  ranksep: DAGRE_CONFIG.ranksep,
  marginx: DAGRE_CONFIG.marginx,
  marginy: DAGRE_CONFIG.marginy,
};

export const NODE_DIMENSIONS = {
  width: NODE_WIDTH,
  height: NODE_HEIGHT,
} as const;
