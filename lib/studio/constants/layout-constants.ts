/**
 * SINGLE SOURCE OF TRUTH for all layout calculations
 *
 * CRITICAL: All layout-related constants MUST come from this file.
 * Used by: Server (unified-layout-service), Client (auto-layout, dagre-layout),
 * CSS (professional-nodes), Hooks (use-jump-to-node), APIs (viewport, sitemap)
 *
 * @see docs/prd-layout-system-unification.md for rationale
 */

export const LAYOUT = {
  // ============================================
  // NODE DIMENSIONS
  // ============================================
  // These must match CSS render dimensions
  // Actual rendered: 320-380px wide, ~400px tall
  NODE_WIDTH: 340, // Middle of rendered range
  NODE_HEIGHT: 400, // Estimated for layout (actual varies with content)

  // ============================================
  // DYNAMIC HEIGHT CALCULATION
  // ============================================
  // For calculating level-based node heights based on component count
  HEIGHT_CALC: {
    BASE_HEIGHT: 120, // Header (title, status badge, metadata row)
    COMPONENT_ROW_HEIGHT: 40, // Each component item (icon + label + summary)
    MAX_VISIBLE_COMPONENTS: 5, // UI truncates after 5 components
    EMPTY_STATE_HEIGHT: 80, // "No components" + "Add First Component" button
    MIN_NODE_HEIGHT: 160, // Absolute minimum for any node
  },

  // ============================================
  // SPACING (Dagre-compatible)
  // ============================================
  HORIZONTAL_GAP: 80, // nodesep equivalent - space between sibling nodes
  VERTICAL_GAP: 100, // ranksep equivalent - space between parent/child levels

  // ============================================
  // MARGINS
  // ============================================
  MARGIN_X: 100,
  MARGIN_Y: 100,

  // ============================================
  // GRID CELL SIZING (for spatial indexing)
  // ============================================
  // Approximately one viewport (1920x1080 adjusted for node sizes)
  // ~4 nodes wide: 4 * (340 + 80) = 1680px
  // ~2 nodes tall: 2 * (400 + 100) = 1000px
  GRID_CELL_WIDTH: 4 * (340 + 80), // 1680px
  GRID_CELL_HEIGHT: 2 * (400 + 100), // 1000px

  // ============================================
  // THRESHOLDS
  // ============================================
  LARGE_SITE_THRESHOLD: 50, // Switch to skeleton mode above this

  // ============================================
  // HOME POSITION
  // ============================================
  // Server centers home node at (0, 0) for predictable viewport
  HOME_X: 0,
  HOME_Y: 0,
} as const;

/**
 * Dagre-compatible configuration object
 * Use this directly with dagre.setGraph()
 */
export const DAGRE_CONFIG = {
  rankdir: 'TB' as const,
  nodesep: LAYOUT.HORIZONTAL_GAP,
  ranksep: LAYOUT.VERTICAL_GAP,
  marginx: LAYOUT.MARGIN_X,
  marginy: LAYOUT.MARGIN_Y,
} as const;

/**
 * Calculate grid cell coordinates from x,y position
 * Used for spatial indexing in viewport queries
 */
export function calculateGridCell(x: number, y: number): { cellX: number; cellY: number } {
  return {
    cellX: Math.floor(x / LAYOUT.GRID_CELL_WIDTH),
    cellY: Math.floor(y / LAYOUT.GRID_CELL_HEIGHT),
  };
}

// ============================================
// TYPE EXPORTS
// ============================================
export type LayoutConstants = typeof LAYOUT;
export type DagreConfig = typeof DAGRE_CONFIG;

/**
 * Calculate the height needed for a level based on max component count
 * All nodes at the same level use the same height (level-max approach)
 *
 * @param maxComponentCount - Maximum number of components for any node at this level
 * @returns Height in pixels for nodes at this level
 *
 * Acceptance criteria:
 * - calculateLevelHeight(0) returns 200 (BASE_HEIGHT + EMPTY_STATE_HEIGHT)
 * - calculateLevelHeight(3) returns 240 (120 + 3*40)
 * - calculateLevelHeight(5) returns 320 (120 + 5*40)
 * - calculateLevelHeight(10) returns 320 (capped at 5 visible)
 */
export function calculateLevelHeight(maxComponentCount: number): number {
  const { HEIGHT_CALC } = LAYOUT;

  if (maxComponentCount === 0) {
    return Math.max(
      HEIGHT_CALC.BASE_HEIGHT + HEIGHT_CALC.EMPTY_STATE_HEIGHT,
      HEIGHT_CALC.MIN_NODE_HEIGHT
    );
  }

  const visibleComponents = Math.min(maxComponentCount, HEIGHT_CALC.MAX_VISIBLE_COMPONENTS);
  const contentHeight = HEIGHT_CALC.BASE_HEIGHT + visibleComponents * HEIGHT_CALC.COMPONENT_ROW_HEIGHT;

  return Math.max(contentHeight, HEIGHT_CALC.MIN_NODE_HEIGHT);
}
