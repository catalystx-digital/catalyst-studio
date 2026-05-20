'use client';

import { useCallback, useEffect, useRef } from 'react';
import { useReactFlow } from 'reactflow';
import { useSiteBuilderStore } from '../stores/site-builder-store';
import { LAYOUT } from '@/lib/studio/constants/layout-constants';

interface UseJumpToNodeResult {
  jumpToNode: (nodeId: string) => void;
  jumpToHome: () => Promise<void>;
  jumpToPosition: (x: number, y: number) => void;
  isJumping: boolean;
  focusedNodeId: string | null;
}

// Node dimensions from single source of truth
const NODE_WIDTH = LAYOUT.NODE_WIDTH;
const NODE_HEIGHT = LAYOUT.NODE_HEIGHT;

/**
 * Hook for jumping to nodes on the canvas
 * Integrates with React Flow for viewport navigation
 */
export function useJumpToNode(): UseJumpToNodeResult {
  const { setCenter, getZoom } = useReactFlow();
  const websiteId = useSiteBuilderStore((state) => state.websiteId);
  const nodePositionIndex = useSiteBuilderStore((state) => state.nodePositionIndex);
  const storeJumpToNode = useSiteBuilderStore((state) => state.jumpToNode);
  const isJumping = useSiteBuilderStore((state) => state.isJumping);
  const focusedNodeId = useSiteBuilderStore((state) => state.focusedNodeId);
  const setIsJumping = useSiteBuilderStore((state) => state.setIsJumping);

  // Reset jumping state after animation completes
  const jumpTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (jumpTimeoutRef.current) {
        clearTimeout(jumpTimeoutRef.current);
      }
    };
  }, []);

  /**
   * Jump to a specific node by ID
   */
  const jumpToNode = useCallback(
    (nodeId: string) => {
      const position = nodePositionIndex.get(nodeId);

      if (position) {
        // Center the viewport on the node
        // Add half the node size to center on the node, not its top-left corner
        const centerX = position.x + (position.width || NODE_WIDTH) / 2;
        const centerY = position.y + (position.height || NODE_HEIGHT) / 2;

        // Maintain current zoom level
        const currentZoom = getZoom();

        // Update store state
        storeJumpToNode(nodeId);

        // Animate to the position
        setCenter(centerX, centerY, { zoom: currentZoom, duration: 500 });

        // Reset jumping state after animation
        if (jumpTimeoutRef.current) {
          clearTimeout(jumpTimeoutRef.current);
        }
        jumpTimeoutRef.current = setTimeout(() => {
          setIsJumping(false);
        }, 600);
      } else {
        console.warn('[useJumpToNode] Node position not found:', nodeId);
      }
    },
    [nodePositionIndex, getZoom, setCenter, storeJumpToNode, setIsJumping]
  );

  /**
   * Jump to the home page
   */
  const jumpToHome = useCallback(async () => {
    if (!websiteId) {
      console.warn('[useJumpToNode] No websiteId available');
      return;
    }

    try {
      const response = await fetch(`/api/studio/sitemap/${websiteId}/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'findHome' }),
      });

      if (!response.ok) {
        throw new Error('Failed to find home page');
      }

      const data = await response.json();
      if (data.structureId) {
        jumpToNode(data.structureId);
      }
    } catch (error) {
      console.error('[useJumpToNode] Error finding home:', error);

      // Fallback: try to find any root node locally
      const firstNode = Array.from(nodePositionIndex.entries()).find(
        ([, pos]) => pos.y === 0 || pos.y < 100
      );
      if (firstNode) {
        jumpToNode(firstNode[0]);
      }
    }
  }, [websiteId, jumpToNode, nodePositionIndex]);

  /**
   * Jump to arbitrary canvas coordinates
   */
  const jumpToPosition = useCallback(
    (x: number, y: number) => {
      const currentZoom = getZoom();
      setCenter(x, y, { zoom: currentZoom, duration: 500 });
    },
    [getZoom, setCenter]
  );

  return {
    jumpToNode,
    jumpToHome,
    jumpToPosition,
    isJumping,
    focusedNodeId,
  };
}
