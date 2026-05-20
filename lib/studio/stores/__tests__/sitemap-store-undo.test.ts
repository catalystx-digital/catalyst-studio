import { describe, it, expect, beforeEach, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useSitemapStore } from '../sitemap-store';
import { undoManager } from '../../components/sitemap/undo-manager';

describe('Sitemap Store Undo/Redo Integration', () => {
  beforeEach(() => {
    // Reset store and undo manager before each test
    act(() => {
      useSitemapStore.setState({
        nodes: [],
        edges: [],
        canUndo: false,
        canRedo: false,
        isUndoRedoInProgress: false
      });
    });
    undoManager.clear();
  });

  describe('State Capture', () => {
    it('should capture state after adding a node', () => {
      const { result } = renderHook(() => useSitemapStore());
      
      act(() => {
        result.current.addNode(null, {
          title: 'Test Page',
          slug: 'test-page',
          contentTypeId: 'test'
        });
      });

      expect(undoManager.canUndo()).toBe(true);
      expect(result.current.canUndo).toBe(true);
    });

    it('should capture state after updating a node', () => {
      const { result } = renderHook(() => useSitemapStore());
      
      // Add initial node
      act(() => {
        useSitemapStore.setState({
          nodes: [{
            id: 'node-1',
            type: 'page',
            position: { x: 0, y: 0 },
            data: { label: 'Original', slug: 'original', components: [], childCount: 0, hasContent: true, contentTypeCategory: 'page' as any }
          }],
          edges: []
        });
      });
      
      // Clear initial state from undo manager
      undoManager.clear();
      
      // Update node
      act(() => {
        result.current.updateNode('node-1', {
          data: { label: 'Updated', slug: 'updated', components: [], childCount: 0, hasContent: true, contentTypeCategory: 'page' as any }
        });
      });

      expect(undoManager.canUndo()).toBe(true);
      expect(result.current.canUndo).toBe(true);
    });

    it('should capture state after deleting nodes', () => {
      const { result } = renderHook(() => useSitemapStore());
      
      // Add initial nodes
      act(() => {
        useSitemapStore.setState({
          nodes: [
            {
              id: 'node-1',
              type: 'page',
              position: { x: 0, y: 0 },
              data: { label: 'Page 1', slug: 'page-1', components: [], childCount: 0, hasContent: true, contentTypeCategory: 'page' as any }
            },
            {
              id: 'node-2',
              type: 'page',
              position: { x: 100, y: 0 },
              data: { label: 'Page 2', slug: 'page-2', components: [], childCount: 0, hasContent: true, contentTypeCategory: 'page' as any }
            }
          ],
          edges: []
        });
      });
      
      // Clear initial state
      undoManager.clear();
      
      // Delete a node
      act(() => {
        result.current.deleteNodes(['node-1']);
      });

      expect(undoManager.canUndo()).toBe(true);
      expect(result.current.canUndo).toBe(true);
      expect(result.current.nodes).toHaveLength(1);
      expect(result.current.nodes[0].id).toBe('node-2');
    });

    it('should capture state after moving a node', () => {
      const { result } = renderHook(() => useSitemapStore());
      
      // Setup initial state with parent and child
      act(() => {
        useSitemapStore.setState({
          nodes: [
            {
              id: 'parent',
              type: 'folder',
              position: { x: 0, y: 0 },
              data: { label: 'Parent', slug: '', components: [], childCount: 1, hasContent: false, contentTypeCategory: 'folder' as any }
            },
            {
              id: 'child',
              type: 'page',
              position: { x: 0, y: 100 },
              data: { label: 'Child', slug: 'child', components: [], childCount: 0, hasContent: true, contentTypeCategory: 'page' as any }
            }
          ],
          edges: []
        });
      });
      
      // Clear initial state
      undoManager.clear();
      
      // Move child to new parent
      act(() => {
        result.current.moveNode('child', 'parent');
      });

      expect(undoManager.canUndo()).toBe(true);
      expect(result.current.canUndo).toBe(true);
    });
  });

  describe('Undo Operation', () => {
    it('should restore previous state on undo', () => {
      const { result } = renderHook(() => useSitemapStore());
      
      const initialNodes = [{
        id: 'node-1',
        type: 'page' as const,
        position: { x: 0, y: 0 },
        data: { label: 'Original', slug: 'original', components: [], childCount: 0, hasContent: true, contentTypeCategory: 'page' as any }
      }];
      
      // Set initial state
      act(() => {
        useSitemapStore.setState({ nodes: initialNodes, edges: [] });
        undoManager.initialize(initialNodes, []);
      });
      
      // Make a change
      act(() => {
        result.current.updateNode('node-1', {
          data: { label: 'Updated', slug: 'updated', components: [], childCount: 0, hasContent: true, contentTypeCategory: 'page' as any }
        });
      });
      
      expect(result.current.nodes[0].data.label).toBe('Updated');
      
      // Undo the change
      act(() => {
        result.current.undo();
      });
      
      expect(result.current.nodes[0].data.label).toBe('Original');
      expect(result.current.canUndo).toBe(false);
      expect(result.current.canRedo).toBe(true);
    });

    it('should set isUndoRedoInProgress during undo', () => {
      const { result } = renderHook(() => useSitemapStore());
      
      // Initialize with some state
      act(() => {
        useSitemapStore.setState({
          nodes: [{
            id: 'node-1',
            type: 'page',
            position: { x: 0, y: 0 },
            data: { label: 'Test', slug: 'test', components: [], childCount: 0, hasContent: true, contentTypeCategory: 'page' as any }
          }],
          edges: []
        });
        undoManager.initialize(
          useSitemapStore.getState().nodes,
          useSitemapStore.getState().edges
        );
      });
      
      // Make a change to have something to undo
      act(() => {
        result.current.captureState();
      });
      
      // Check that isUndoRedoInProgress is properly managed
      expect(result.current.isUndoRedoInProgress).toBe(false);
      
      act(() => {
        result.current.undo();
      });
      
      // After undo completes, it should be false again
      expect(result.current.isUndoRedoInProgress).toBe(false);
    });
  });

  describe('Redo Operation', () => {
    it('should restore next state on redo', () => {
      const { result } = renderHook(() => useSitemapStore());
      
      const initialNodes = [{
        id: 'node-1',
        type: 'page' as const,
        position: { x: 0, y: 0 },
        data: { label: 'Original', slug: 'original', components: [], childCount: 0, hasContent: true, contentTypeCategory: 'page' as any }
      }];
      
      // Set initial state
      act(() => {
        useSitemapStore.setState({ nodes: initialNodes, edges: [] });
        undoManager.initialize(initialNodes, []);
      });
      
      // Make a change
      act(() => {
        result.current.updateNode('node-1', {
          data: { label: 'Updated', slug: 'updated', components: [], childCount: 0, hasContent: true, contentTypeCategory: 'page' as any }
        });
      });
      
      // Undo
      act(() => {
        result.current.undo();
      });
      
      expect(result.current.nodes[0].data.label).toBe('Original');
      
      // Redo
      act(() => {
        result.current.redo();
      });
      
      expect(result.current.nodes[0].data.label).toBe('Updated');
      expect(result.current.canUndo).toBe(true);
      expect(result.current.canRedo).toBe(false);
    });

    it('should clear future history when new action is performed after undo', () => {
      const { result } = renderHook(() => useSitemapStore());
      
      // Initialize
      act(() => {
        useSitemapStore.setState({
          nodes: [{
            id: 'node-1',
            type: 'page',
            position: { x: 0, y: 0 },
            data: { label: 'Step 1', slug: 'step-1', components: [], childCount: 0, hasContent: true, contentTypeCategory: 'page' as any }
          }],
          edges: []
        });
        undoManager.initialize(
          useSitemapStore.getState().nodes,
          useSitemapStore.getState().edges
        );
      });
      
      // Change 1
      act(() => {
        result.current.updateNode('node-1', {
          data: { label: 'Step 2', slug: 'step-2', components: [], childCount: 0, hasContent: true, contentTypeCategory: 'page' as any }
        });
      });
      
      // Change 2
      act(() => {
        result.current.updateNode('node-1', {
          data: { label: 'Step 3', slug: 'step-3', components: [], childCount: 0, hasContent: true, contentTypeCategory: 'page' as any }
        });
      });
      
      // Undo to Step 2
      act(() => {
        result.current.undo();
      });
      
      expect(result.current.nodes[0].data.label).toBe('Step 2');
      expect(result.current.canRedo).toBe(true);
      
      // Make a new change (should clear redo history)
      act(() => {
        result.current.updateNode('node-1', {
          data: { label: 'New Branch', slug: 'new-branch', components: [], childCount: 0, hasContent: true, contentTypeCategory: 'page' as any }
        });
      });
      
      expect(result.current.nodes[0].data.label).toBe('New Branch');
      expect(result.current.canRedo).toBe(false); // Future history should be cleared
    });
  });

  describe('Save Prevention During Undo/Redo', () => {
    it('should not trigger saves during undo operation', () => {
      const saveManagerSpy = vi.spyOn(require('../../components/sitemap/save-manager').saveManager, 'addOperations');
      const { result } = renderHook(() => useSitemapStore());
      
      // Initialize
      act(() => {
        useSitemapStore.setState({
          nodes: [{
            id: 'node-1',
            type: 'page',
            position: { x: 0, y: 0 },
            data: { label: 'Original', slug: 'original', components: [], childCount: 0, hasContent: true, contentTypeCategory: 'page' as any }
          }],
          edges: [],
          websiteId: 'test-website'
        });
        undoManager.initialize(
          useSitemapStore.getState().nodes,
          useSitemapStore.getState().edges
        );
      });
      
      // Make a change (should trigger save)
      act(() => {
        result.current.updateNode('node-1', {
          data: { label: 'Updated', slug: 'updated', components: [], childCount: 0, hasContent: true, contentTypeCategory: 'page' as any }
        });
      });
      
      const callCountAfterUpdate = saveManagerSpy.mock.calls.length;
      
      // Undo (should NOT trigger save)
      act(() => {
        result.current.undo();
      });
      
      expect(saveManagerSpy.mock.calls.length).toBe(callCountAfterUpdate);
      
      saveManagerSpy.mockRestore();
    });

    it('should not trigger saves during redo operation', () => {
      const saveManagerSpy = vi.spyOn(require('../../components/sitemap/save-manager').saveManager, 'addOperations');
      const { result } = renderHook(() => useSitemapStore());
      
      // Initialize
      act(() => {
        useSitemapStore.setState({
          nodes: [{
            id: 'node-1',
            type: 'page',
            position: { x: 0, y: 0 },
            data: { label: 'Original', slug: 'original', components: [], childCount: 0, hasContent: true, contentTypeCategory: 'page' as any }
          }],
          edges: [],
          websiteId: 'test-website'
        });
        undoManager.initialize(
          useSitemapStore.getState().nodes,
          useSitemapStore.getState().edges
        );
      });
      
      // Make a change and then undo
      act(() => {
        result.current.updateNode('node-1', {
          data: { label: 'Updated', slug: 'updated', components: [], childCount: 0, hasContent: true, contentTypeCategory: 'page' as any }
        });
      });
      
      act(() => {
        result.current.undo();
      });
      
      const callCountBeforeRedo = saveManagerSpy.mock.calls.length;
      
      // Redo (should NOT trigger save)
      act(() => {
        result.current.redo();
      });
      
      expect(saveManagerSpy.mock.calls.length).toBe(callCountBeforeRedo);
      
      saveManagerSpy.mockRestore();
    });
  });

  describe('History Limit', () => {
    it('should enforce 50-state history limit', () => {
      const { result } = renderHook(() => useSitemapStore());
      
      // Initialize
      act(() => {
        useSitemapStore.setState({
          nodes: [{
            id: 'node-1',
            type: 'page',
            position: { x: 0, y: 0 },
            data: { label: 'Initial', slug: 'initial', components: [], childCount: 0, hasContent: true, contentTypeCategory: 'page' as any }
          }],
          edges: []
        });
        undoManager.initialize(
          useSitemapStore.getState().nodes,
          useSitemapStore.getState().edges
        );
      });
      
      // Make 51 changes (more than the limit)
      for (let i = 1; i <= 51; i++) {
        act(() => {
          result.current.updateNode('node-1', {
            data: { label: `Step ${i}`, slug: `step-${i}`, components: [], childCount: 0, hasContent: true, contentTypeCategory: 'page' as any }
          });
        });
      }
      
      // Try to undo 50 times (should work)
      for (let i = 0; i < 49; i++) {
        act(() => {
          result.current.undo();
        });
        expect(result.current.canUndo).toBe(true);
      }
      
      // Undo one more time (50th undo)
      act(() => {
        result.current.undo();
      });
      
      // Should not be able to undo anymore (oldest state was dropped)
      expect(result.current.canUndo).toBe(false);
    });
  });

  describe('State Consistency', () => {
    it('should maintain parent-child relationships through undo/redo', () => {
      const { result } = renderHook(() => useSitemapStore());
      
      // Initialize with parent-child structure
      const initialNodes = [
        {
          id: 'parent',
          type: 'folder' as const,
          position: { x: 0, y: 0 },
          data: { label: 'Parent', slug: '', components: [], childCount: 1, hasContent: false, contentTypeCategory: 'folder' as any }
        },
        {
          id: 'child',
          type: 'page' as const,
          position: { x: 0, y: 100 },
          data: { label: 'Child', slug: 'child', components: [], childCount: 0, hasContent: true, contentTypeCategory: 'page' as any }
        }
      ];
      const initialEdges = [
        { id: 'parent-child', source: 'parent', target: 'child', type: 'smoothstep' as const }
      ];
      
      act(() => {
        useSitemapStore.setState({ nodes: initialNodes, edges: initialEdges });
        undoManager.initialize(initialNodes, initialEdges);
      });
      
      // Delete the child
      act(() => {
        result.current.deleteNodes(['child']);
      });
      
      expect(result.current.nodes).toHaveLength(1);
      expect(result.current.edges).toHaveLength(0);
      
      // Undo deletion
      act(() => {
        result.current.undo();
      });
      
      expect(result.current.nodes).toHaveLength(2);
      expect(result.current.edges).toHaveLength(1);
      expect(result.current.edges[0].source).toBe('parent');
      expect(result.current.edges[0].target).toBe('child');
    });

    it('should preserve component configurations in history', () => {
      const { result } = renderHook(() => useSitemapStore());
      
      const initialNodes = [{
        id: 'node-1',
        type: 'page' as const,
        position: { x: 0, y: 0 },
        data: { 
          label: 'Page',
          slug: 'page',
          components: ['Header', 'Hero', 'Footer'],
          childCount: 0,
          hasContent: true,
          contentTypeCategory: 'page' as any
        }
      }];
      
      act(() => {
        useSitemapStore.setState({ nodes: initialNodes, edges: [] });
        undoManager.initialize(initialNodes, []);
      });
      
      // Update components
      act(() => {
        result.current.updateNode('node-1', {
          data: {
            label: 'Page',
            slug: 'page',
            components: ['Header', 'Hero', 'Features', 'Testimonials', 'Footer'],
            childCount: 0,
            hasContent: true,
            contentTypeCategory: 'page' as any
          }
        });
      });
      
      expect(result.current.nodes[0].data.components).toHaveLength(5);
      
      // Undo
      act(() => {
        result.current.undo();
      });
      
      expect(result.current.nodes[0].data.components).toHaveLength(3);
      expect(result.current.nodes[0].data.components).toEqual(['Header', 'Hero', 'Footer']);
    });
  });
});