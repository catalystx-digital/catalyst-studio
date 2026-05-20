# Dagre Auto-Layout Engine

## Overview
The Dagre Auto-Layout Engine provides automatic positioning for sitemap nodes using hierarchical graph layout algorithms. It ensures optimal visual organization without manual positioning.

## Installation
```bash
npm install dagre@^0.8.5
npm install --save-dev @types/dagre@^0.7.53
```

## Usage

### Basic Example
```typescript
import { calculateLayout } from '@/lib/studio/components/sitemap/layout';

const nodes = [
  { id: '1', type: 'folder', data: { label: 'Home' } },
  { id: '2', type: 'page', data: { label: 'About' } },
  { id: '3', type: 'page', data: { label: 'Contact' } }
];

const edges = [
  { id: 'e1', source: '1', target: '2' },
  { id: 'e2', source: '1', target: '3' }
];

const result = calculateLayout(nodes, edges);

if (result.success) {
  console.log('Positioned nodes:', result.nodes);
  // Each node now has a position: { x: number, y: number }
}
```

### React Flow Integration
```typescript
import { calculateLayout } from '@/lib/studio/components/sitemap/layout';
import { Node as ReactFlowNode, Edge as ReactFlowEdge } from 'reactflow';

// Convert React Flow nodes to layout format
const layoutNodes = reactFlowNodes.map(node => ({
  id: node.id,
  type: node.type as 'page' | 'folder',
  data: node.data
}));

// Convert React Flow edges to layout format
const layoutEdges = reactFlowEdges.map(edge => ({
  id: edge.id,
  source: edge.source,
  target: edge.target
}));

// Calculate layout
const result = calculateLayout(layoutNodes, layoutEdges);

if (result.success) {
  // Update React Flow nodes with new positions
  const updatedNodes = reactFlowNodes.map((node, index) => ({
    ...node,
    position: result.nodes[index].position
  }));
  
  setNodes(updatedNodes);
}
```

### Custom Configuration
```typescript
const result = calculateLayout(nodes, edges, {
  rankdir: 'TB',    // Top-to-bottom layout
  nodesep: 100,     // Horizontal spacing between nodes
  ranksep: 150,     // Vertical spacing between ranks
  marginx: 50,      // Horizontal margin
  marginy: 50       // Vertical margin
});
```

## API Reference

### Types

#### LayoutNode
```typescript
interface LayoutNode {
  id: string;
  type: 'page' | 'folder';
  data: {
    label: string;
    [key: string]: any;
  };
  position?: {
    x: number;
    y: number;
  };
}
```

#### LayoutEdge
```typescript
interface LayoutEdge {
  id: string;
  source: string;
  target: string;
}
```

#### LayoutConfig
```typescript
interface LayoutConfig {
  rankdir: 'TB' | 'BT' | 'LR' | 'RL';
  nodesep: number;
  ranksep: number;
  marginx: number;
  marginy: number;
}
```

### Functions

#### calculateLayout
Main function to calculate node positions.
```typescript
calculateLayout(
  nodes: LayoutNode[],
  edges: LayoutEdge[],
  config?: Partial<LayoutConfig>
): LayoutResult
```

#### Utility Functions
- `validateRelationships(nodes, edges)` - Validate edge relationships
- `findOrphanedNodes(nodes, edges)` - Find disconnected nodes
- `detectCircularDependencies(edges)` - Check for circular references
- `handleCircularDependencies(edges)` - Remove circular dependencies

## Configuration

### Default Settings
- **Node Width**: 320px
- **Node Height**: 200px
- **Layout Direction**: Top-to-bottom (TB)
- **Horizontal Spacing**: 100px
- **Vertical Spacing**: 150px
- **Margins**: 50px

## Performance

- Handles up to 100 nodes in under 500ms
- Automatic performance warnings for slow operations
- Efficient handling of complex hierarchies

## Error Handling

The layout engine gracefully handles:
- Invalid node/edge references
- Circular dependencies
- Orphaned nodes
- Missing data

All errors are logged to console and the function returns a safe fallback layout.

## Testing

Run tests with:
```bash
npm test -- lib/studio/components/sitemap/layout/__tests__/dagre-layout.test.ts
```

## Input/Output Format Examples

### Input
```json
{
  "nodes": [
    { "id": "1", "type": "folder", "data": { "label": "Root" } },
    { "id": "2", "type": "page", "data": { "label": "Child" } }
  ],
  "edges": [
    { "id": "e1", "source": "1", "target": "2" }
  ]
}
```

### Output
```json
{
  "success": true,
  "nodes": [
    { 
      "id": "1", 
      "type": "folder", 
      "data": { "label": "Root" },
      "position": { "x": 160, "y": 50 }
    },
    { 
      "id": "2", 
      "type": "page", 
      "data": { "label": "Child" },
      "position": { "x": 160, "y": 300 }
    }
  ]
}
```