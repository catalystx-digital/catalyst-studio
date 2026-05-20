import { describe, it, expect, beforeEach } from 'vitest';
import { UndoManager } from '../undo-manager';
import type { SitemapNode, SitemapEdge } from '../types';

describe('UndoManager Performance', () => {
  let undoManager: UndoManager;
  
  beforeEach(() => {
    undoManager = new UndoManager({ maxHistorySize: 50 });
  });

  describe('Performance Benchmarks', () => {
    it('should complete undo operation in less than 100ms', () => {
      // Create large state with many nodes
      const nodes: SitemapNode[] = Array.from({ length: 100 }, (_, i) => ({
        id: `node-${i}`,
        type: 'page',
        position: { x: i * 100, y: i * 50 },
        data: {
          label: `Page ${i}`,
          slug: `page-${i}`,
          components: ['Header', 'Hero', 'Features', 'Footer'],
          childCount: 0,
          hasContent: true,
          contentTypeCategory: 'page' as any
        }
      }));
      
      const edges: SitemapEdge[] = Array.from({ length: 99 }, (_, i) => ({
        id: `edge-${i}`,
        source: `node-0`,
        target: `node-${i + 1}`,
        type: 'smoothstep'
      }));
      
      // Push multiple states
      for (let i = 0; i < 10; i++) {
        undoManager.pushState(nodes, edges);
      }
      
      // Measure undo performance
      const startTime = performance.now();
      const result = undoManager.undo();
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      expect(result).not.toBeNull();
      expect(duration).toBeLessThan(100);
      console.log(`Undo operation took ${duration.toFixed(2)}ms`);
    });

    it('should complete redo operation in less than 100ms', () => {
      const nodes: SitemapNode[] = Array.from({ length: 100 }, (_, i) => ({
        id: `node-${i}`,
        type: 'page',
        position: { x: i * 100, y: i * 50 },
        data: {
          label: `Page ${i}`,
          slug: `page-${i}`,
          components: ['Header', 'Hero', 'Features', 'Footer'],
          childCount: 0,
          hasContent: true,
          contentTypeCategory: 'page' as any
        }
      }));
      
      const edges: SitemapEdge[] = Array.from({ length: 99 }, (_, i) => ({
        id: `edge-${i}`,
        source: `node-0`,
        target: `node-${i + 1}`,
        type: 'smoothstep'
      }));
      
      // Push states and undo
      for (let i = 0; i < 10; i++) {
        undoManager.pushState(nodes, edges);
      }
      undoManager.undo();
      undoManager.undo();
      
      // Measure redo performance
      const startTime = performance.now();
      const result = undoManager.redo();
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      expect(result).not.toBeNull();
      expect(duration).toBeLessThan(100);
      console.log(`Redo operation took ${duration.toFixed(2)}ms`);
    });

    it('should handle 50 operations efficiently', () => {
      const nodes: SitemapNode[] = [{
        id: 'node-1',
        type: 'page',
        position: { x: 0, y: 0 },
        data: {
          label: 'Page',
          slug: 'page',
          components: [],
          childCount: 0,
          hasContent: true,
          contentTypeCategory: 'page' as any
        }
      }];
      
      const startTime = performance.now();
      
      // Push 50 states (max history)
      for (let i = 0; i < 50; i++) {
        const updatedNodes = [{
          ...nodes[0],
          data: { ...nodes[0].data, label: `Page ${i}` }
        }];
        undoManager.pushState(updatedNodes, []);
      }
      
      // Undo all 49 possible times
      for (let i = 0; i < 49; i++) {
        undoManager.undo();
      }
      
      // Redo all 49 possible times
      for (let i = 0; i < 49; i++) {
        undoManager.redo();
      }
      
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      // All operations should complete in reasonable time
      expect(duration).toBeLessThan(1000); // 1 second for all operations
      console.log(`50 push + 49 undo + 49 redo operations took ${duration.toFixed(2)}ms`);
    });

    it('should not grow memory unboundedly with history limit', () => {
      const createLargeState = (index: number) => {
        const nodes: SitemapNode[] = Array.from({ length: 100 }, (_, i) => ({
          id: `node-${index}-${i}`,
          type: 'page',
          position: { x: i * 100, y: i * 50 },
          data: {
            label: `Page ${index}-${i}`,
            slug: `page-${index}-${i}`,
            components: Array.from({ length: 10 }, (_, j) => `Component${j}`),
            childCount: 0,
            hasContent: true,
            contentTypeCategory: 'page' as any,
            // Add some extra data to make state larger
            metadata: {
              status: 'published',
              seoScore: 85,
              lastModified: new Date().toISOString(),
              author: `Author ${i}`,
              tags: Array.from({ length: 5 }, (_, k) => `tag-${k}`),
              customData: { field1: 'value1', field2: 'value2', field3: 'value3' }
            }
          }
        }));
        
        const edges: SitemapEdge[] = Array.from({ length: 99 }, (_, i) => ({
          id: `edge-${index}-${i}`,
          source: `node-${index}-0`,
          target: `node-${index}-${i + 1}`,
          type: 'smoothstep'
        }));
        
        return { nodes, edges };
      };
      
      // Get initial stats
      const initialStats = undoManager.getStats();
      expect(initialStats.historySize).toBe(0);
      
      // Push 100 large states (twice the limit)
      for (let i = 0; i < 100; i++) {
        const { nodes, edges } = createLargeState(i);
        undoManager.pushState(nodes, edges);
      }
      
      // Check that history is limited to 50
      const finalStats = undoManager.getStats();
      expect(finalStats.historySize).toBe(50);
      expect(finalStats.canUndo).toBe(true);
      
      // Verify oldest states were dropped
      // The oldest timestamp should be from state 50 (0-49 were dropped)
      const oldestTimestamp = finalStats.oldestTimestamp;
      const newestTimestamp = finalStats.newestTimestamp;
      expect(oldestTimestamp).toBeLessThan(newestTimestamp!);
      
      console.log(`History limited to ${finalStats.historySize} states`);
    });

    it('should use deep copying to prevent mutations', () => {
      const nodes: SitemapNode[] = [{
        id: 'node-1',
        type: 'page',
        position: { x: 0, y: 0 },
        data: {
          label: 'Original',
          slug: 'original',
          components: ['Header', 'Footer'],
          childCount: 0,
          hasContent: true,
          contentTypeCategory: 'page' as any
        }
      }];
      
      // Push state
      undoManager.pushState(nodes, []);
      
      // Mutate original array
      nodes[0].data.label = 'Mutated';
      nodes[0].data.components.push('NewComponent');
      
      // Undo to get previous state
      undoManager.undo();
      const state = undoManager.getCurrentState();
      
      // State should not be affected by mutations
      expect(state).not.toBeNull();
      expect(state!.nodes[0].data.label).toBe('Original');
      expect(state!.nodes[0].data.components).toHaveLength(2);
      expect(state!.nodes[0].data.components).not.toContain('NewComponent');
    });
  });

  describe('Structural Sharing Verification', () => {
    it('should create independent copies of state', () => {
      const nodes: SitemapNode[] = [{
        id: 'node-1',
        type: 'page',
        position: { x: 0, y: 0 },
        data: {
          label: 'Test',
          slug: 'test',
          components: ['Component1'],
          childCount: 0,
          hasContent: true,
          contentTypeCategory: 'page' as any
        }
      }];
      
      // Push first state
      undoManager.pushState(nodes, []);
      
      // Modify and push second state
      const modifiedNodes = [...nodes];
      modifiedNodes[0] = {
        ...nodes[0],
        data: {
          ...nodes[0].data,
          label: 'Modified'
        }
      };
      undoManager.pushState(modifiedNodes, []);
      
      // Get both states
      const currentState = undoManager.getCurrentState();
      undoManager.undo();
      const previousState = undoManager.getCurrentState();
      
      // States should be independent
      expect(currentState!.nodes[0].data.label).toBe('Modified');
      expect(previousState!.nodes[0].data.label).toBe('Test');
      
      // But they should not share references
      expect(currentState!.nodes[0]).not.toBe(previousState!.nodes[0]);
      expect(currentState!.nodes[0].data).not.toBe(previousState!.nodes[0].data);
    });
  });
});