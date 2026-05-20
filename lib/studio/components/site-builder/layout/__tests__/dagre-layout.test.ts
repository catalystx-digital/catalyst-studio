import { calculateLayout, validateRelationships, findOrphanedNodes, detectCircularDependencies, handleCircularDependencies } from '../index';
import { LayoutNode, LayoutEdge } from '../types';

describe('Dagre Layout Engine', () => {
  describe('calculateLayout', () => {
    it('should calculate positions for simple tree', () => {
      const nodes: LayoutNode[] = [
        { id: '1', type: 'folder', data: { label: 'Root' } },
        { id: '2', type: 'page', data: { label: 'Page 1' } },
        { id: '3', type: 'page', data: { label: 'Page 2' } }
      ];
      
      const edges: LayoutEdge[] = [
        { id: 'e1', source: '1', target: '2' },
        { id: 'e2', source: '1', target: '3' }
      ];
      
      const result = calculateLayout(nodes, edges);
      
      expect(result.success).toBe(true);
      expect(result.nodes).toHaveLength(3);
      expect(result.nodes[0].position).toBeDefined();
      expect(result.nodes[0].position!.x).toBeGreaterThanOrEqual(0);
      expect(result.nodes[0].position!.y).toBeGreaterThanOrEqual(0);
    });
    
    it('should ensure no nodes overlap', () => {
      const nodes: LayoutNode[] = [
        { id: '1', type: 'folder', data: { label: 'Root' } },
        { id: '2', type: 'page', data: { label: 'Page 1' } },
        { id: '3', type: 'page', data: { label: 'Page 2' } },
        { id: '4', type: 'folder', data: { label: 'Folder 1' } },
        { id: '5', type: 'page', data: { label: 'Page 3' } }
      ];
      
      const edges: LayoutEdge[] = [
        { id: 'e1', source: '1', target: '2' },
        { id: 'e2', source: '1', target: '3' },
        { id: 'e3', source: '1', target: '4' },
        { id: 'e4', source: '4', target: '5' }
      ];
      
      const result = calculateLayout(nodes, edges);
      
      expect(result.success).toBe(true);
      
      for (let i = 0; i < result.nodes.length; i++) {
        for (let j = i + 1; j < result.nodes.length; j++) {
          const node1 = result.nodes[i];
          const node2 = result.nodes[j];
          
          const overlap = 
            node1.position!.x < node2.position!.x + 320 &&
            node1.position!.x + 320 > node2.position!.x &&
            node1.position!.y < node2.position!.y + 200 &&
            node1.position!.y + 200 > node2.position!.y;
          
          expect(overlap).toBe(false);
        }
      }
    });
    
    it('should maintain top-to-bottom hierarchy', () => {
      const nodes: LayoutNode[] = [
        { id: '1', type: 'folder', data: { label: 'Root' } },
        { id: '2', type: 'page', data: { label: 'Child 1' } },
        { id: '3', type: 'page', data: { label: 'Child 2' } },
        { id: '4', type: 'page', data: { label: 'Grandchild' } }
      ];
      
      const edges: LayoutEdge[] = [
        { id: 'e1', source: '1', target: '2' },
        { id: 'e2', source: '1', target: '3' },
        { id: 'e3', source: '2', target: '4' }
      ];
      
      const result = calculateLayout(nodes, edges, { rankdir: 'TB' });
      
      expect(result.success).toBe(true);
      
      const rootNode = result.nodes.find(n => n.id === '1');
      const child1 = result.nodes.find(n => n.id === '2');
      const child2 = result.nodes.find(n => n.id === '3');
      const grandchild = result.nodes.find(n => n.id === '4');
      
      expect(rootNode!.position!.y).toBeLessThan(child1!.position!.y);
      expect(rootNode!.position!.y).toBeLessThan(child2!.position!.y);
      expect(child1!.position!.y).toBeLessThan(grandchild!.position!.y);
    });
    
    it('should respect spacing configuration', () => {
      const nodes: LayoutNode[] = [
        { id: '1', type: 'page', data: { label: 'Node 1' } },
        { id: '2', type: 'page', data: { label: 'Node 2' } },
        { id: '3', type: 'page', data: { label: 'Node 3' } }
      ];
      
      const edges: LayoutEdge[] = [
        { id: 'e1', source: '1', target: '2' },
        { id: 'e2', source: '1', target: '3' }
      ];
      
      const result = calculateLayout(nodes, edges, {
        nodesep: 100,
        ranksep: 150
      });
      
      expect(result.success).toBe(true);
      
      const node1 = result.nodes.find(n => n.id === '1');
      const node2 = result.nodes.find(n => n.id === '2');
      const node3 = result.nodes.find(n => n.id === '3');
      
      const horizontalSpacing = Math.abs(node2!.position!.x - node3!.position!.x) - 320;
      expect(horizontalSpacing).toBeGreaterThanOrEqual(100);
      
      const verticalSpacing = Math.abs(node2!.position!.y - node1!.position!.y) - 200;
      expect(verticalSpacing).toBeGreaterThanOrEqual(150);
    });
    
    it('should handle both pages and folders', () => {
      const nodes: LayoutNode[] = [
        { id: '1', type: 'folder', data: { label: 'Folder 1' } },
        { id: '2', type: 'page', data: { label: 'Page 1' } },
        { id: '3', type: 'folder', data: { label: 'Folder 2' } },
        { id: '4', type: 'page', data: { label: 'Page 2' } }
      ];
      
      const edges: LayoutEdge[] = [
        { id: 'e1', source: '1', target: '2' },
        { id: 'e2', source: '1', target: '3' },
        { id: 'e3', source: '3', target: '4' }
      ];
      
      const result = calculateLayout(nodes, edges);
      
      expect(result.success).toBe(true);
      expect(result.nodes).toHaveLength(4);
      
      const folder1 = result.nodes.find(n => n.id === '1');
      const page1 = result.nodes.find(n => n.id === '2');
      const folder2 = result.nodes.find(n => n.id === '3');
      const page2 = result.nodes.find(n => n.id === '4');
      
      expect(folder1!.type).toBe('folder');
      expect(page1!.type).toBe('page');
      expect(folder2!.type).toBe('folder');
      expect(page2!.type).toBe('page');
      
      expect(folder1!.position).toBeDefined();
      expect(page1!.position).toBeDefined();
      expect(folder2!.position).toBeDefined();
      expect(page2!.position).toBeDefined();
    });
    
    it('should handle complex nested structures', () => {
      const nodes: LayoutNode[] = [];
      const edges: LayoutEdge[] = [];
      
      for (let i = 0; i < 20; i++) {
        nodes.push({
          id: `node-${i}`,
          type: i % 3 === 0 ? 'folder' : 'page',
          data: { label: `Node ${i}` }
        });
      }
      
      edges.push({ id: 'e0', source: 'node-0', target: 'node-1' });
      edges.push({ id: 'e1', source: 'node-0', target: 'node-2' });
      edges.push({ id: 'e2', source: 'node-0', target: 'node-3' });
      edges.push({ id: 'e3', source: 'node-3', target: 'node-4' });
      edges.push({ id: 'e4', source: 'node-3', target: 'node-5' });
      edges.push({ id: 'e5', source: 'node-3', target: 'node-6' });
      edges.push({ id: 'e6', source: 'node-6', target: 'node-7' });
      edges.push({ id: 'e7', source: 'node-6', target: 'node-8' });
      edges.push({ id: 'e8', source: 'node-6', target: 'node-9' });
      
      for (let i = 10; i < 20; i++) {
        edges.push({
          id: `e${i}`,
          source: `node-${Math.floor(i / 2)}`,
          target: `node-${i}`
        });
      }
      
      const result = calculateLayout(nodes, edges);
      
      expect(result.success).toBe(true);
      expect(result.nodes).toHaveLength(20);
      
      result.nodes.forEach(node => {
        expect(node.position).toBeDefined();
        expect(node.position!.x).toBeGreaterThanOrEqual(0);
        expect(node.position!.y).toBeGreaterThanOrEqual(0);
      });
    });
    
    it('should complete layout in under 500ms for 100 nodes', () => {
      const nodes: LayoutNode[] = [];
      const edges: LayoutEdge[] = [];
      
      for (let i = 0; i < 100; i++) {
        nodes.push({
          id: `node-${i}`,
          type: i % 2 === 0 ? 'folder' : 'page',
          data: { label: `Node ${i}` }
        });
      }
      
      for (let i = 1; i < 100; i++) {
        edges.push({
          id: `edge-${i}`,
          source: `node-${Math.floor((i - 1) / 3)}`,
          target: `node-${i}`
        });
      }
      
      const startTime = performance.now();
      const result = calculateLayout(nodes, edges);
      const duration = performance.now() - startTime;
      
      expect(result.success).toBe(true);
      expect(result.nodes).toHaveLength(100);
      expect(duration).toBeLessThan(500);
    });
    
    it('should handle circular dependencies gracefully', () => {
      const nodes: LayoutNode[] = [
        { id: '1', type: 'page', data: { label: 'Node 1' } },
        { id: '2', type: 'page', data: { label: 'Node 2' } },
        { id: '3', type: 'page', data: { label: 'Node 3' } }
      ];
      
      const edges: LayoutEdge[] = [
        { id: 'e1', source: '1', target: '2' },
        { id: 'e2', source: '2', target: '3' },
        { id: 'e3', source: '3', target: '1' }
      ];
      
      const result = calculateLayout(nodes, edges);
      
      expect(result.success).toBe(true);
      expect(result.nodes).toHaveLength(3);
      
      result.nodes.forEach(node => {
        expect(node.position).toBeDefined();
      });
    });
  });
  
  describe('utilities', () => {
    it('should validate relationships correctly', () => {
      const nodes: LayoutNode[] = [
        { id: '1', type: 'folder', data: { label: 'Node 1' } },
        { id: '2', type: 'page', data: { label: 'Node 2' } }
      ];
      
      const validEdges: LayoutEdge[] = [
        { id: 'e1', source: '1', target: '2' }
      ];
      
      const invalidEdges: LayoutEdge[] = [
        { id: 'e1', source: '1', target: '3' }
      ];
      
      const validResult = validateRelationships(nodes, validEdges);
      expect(validResult.valid).toBe(true);
      expect(validResult.errors).toHaveLength(0);
      
      const invalidResult = validateRelationships(nodes, invalidEdges);
      expect(invalidResult.valid).toBe(false);
      expect(invalidResult.errors).toHaveLength(1);
      expect(invalidResult.errors[0]).toContain('not found');
    });
    
    it('should find orphaned nodes', () => {
      const nodes: LayoutNode[] = [
        { id: '1', type: 'folder', data: { label: 'Connected 1' } },
        { id: '2', type: 'page', data: { label: 'Connected 2' } },
        { id: '3', type: 'page', data: { label: 'Orphan' } }
      ];
      
      const edges: LayoutEdge[] = [
        { id: 'e1', source: '1', target: '2' }
      ];
      
      const orphans = findOrphanedNodes(nodes, edges);
      expect(orphans).toHaveLength(1);
      expect(orphans[0].id).toBe('3');
    });
    
    it('should detect circular dependencies', () => {
      const circularEdges: LayoutEdge[] = [
        { id: 'e1', source: '1', target: '2' },
        { id: 'e2', source: '2', target: '3' },
        { id: 'e3', source: '3', target: '1' }
      ];
      
      const linearEdges: LayoutEdge[] = [
        { id: 'e1', source: '1', target: '2' },
        { id: 'e2', source: '2', target: '3' }
      ];
      
      expect(detectCircularDependencies(circularEdges)).toBe(true);
      expect(detectCircularDependencies(linearEdges)).toBe(false);
    });
    
    it('should handle circular dependencies by removing problematic edges', () => {
      const edges: LayoutEdge[] = [
        { id: 'e1', source: '1', target: '2' },
        { id: 'e2', source: '2', target: '3' },
        { id: 'e3', source: '3', target: '1' }
      ];
      
      const result = handleCircularDependencies(edges);
      
      expect(result.hasCircular).toBe(true);
      expect(result.cleanedEdges.length).toBeLessThan(edges.length);
      expect(result.removedEdges.length).toBeGreaterThan(0);
      expect(detectCircularDependencies(result.cleanedEdges)).toBe(false);
    });
  });
});