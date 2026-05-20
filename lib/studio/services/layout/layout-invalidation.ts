/**
 * Layout Invalidation Utilities
 *
 * Call these functions after any operation that changes tree structure:
 * - Node created
 * - Node deleted
 * - Node moved (parent change)
 * - Node reordered (position change)
 */

import { unifiedLayoutService } from './unified-layout-service';

/**
 * Invalidate positions for a website
 * Positions will be recalculated on next request
 */
export async function invalidateLayoutOnStructureChange(websiteId: string): Promise<void> {
  await unifiedLayoutService.invalidatePositions(websiteId);
}

/**
 * Force recalculate positions for a website
 * Use when you need positions immediately after a structure change
 */
export async function recalculateLayout(websiteId: string): Promise<void> {
  await unifiedLayoutService.calculateAndPersistLayout(websiteId);
}

/**
 * Ensure positions exist, calculating if needed
 * This is the most common call - used by API routes
 */
export async function ensureLayoutExists(websiteId: string): Promise<boolean> {
  return unifiedLayoutService.ensurePositionsExist(websiteId);
}
