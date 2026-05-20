import { LayoutNode, LayoutEdge } from './types';

export function getNodeType(node: LayoutNode): 'page' | 'folder' {
  return node.type;
}

export function validateRelationships(nodes: LayoutNode[], edges: LayoutEdge[]): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  const nodeIds = new Set(nodes.map(n => n.id));
  
  edges.forEach(edge => {
    if (!nodeIds.has(edge.source)) {
      errors.push(`Edge source '${edge.source}' not found in nodes`);
    }
    if (!nodeIds.has(edge.target)) {
      errors.push(`Edge target '${edge.target}' not found in nodes`);
    }
  });
  
  return {
    valid: errors.length === 0,
    errors
  };
}

export function findOrphanedNodes(nodes: LayoutNode[], edges: LayoutEdge[]): LayoutNode[] {
  const connectedNodes = new Set<string>();
  
  edges.forEach(edge => {
    connectedNodes.add(edge.source);
    connectedNodes.add(edge.target);
  });
  
  const rootNodes = nodes.filter(node => {
    const hasIncomingEdge = edges.some(edge => edge.target === node.id);
    return !hasIncomingEdge;
  });
  
  if (rootNodes.length === 1) {
    connectedNodes.add(rootNodes[0].id);
  }
  
  return nodes.filter(node => !connectedNodes.has(node.id));
}

export function detectCircularDependencies(edges: LayoutEdge[]): boolean {
  const adjacencyList = new Map<string, string[]>();
  
  edges.forEach(edge => {
    if (!adjacencyList.has(edge.source)) {
      adjacencyList.set(edge.source, []);
    }
    adjacencyList.get(edge.source)!.push(edge.target);
  });
  
  const visited = new Set<string>();
  const recursionStack = new Set<string>();
  
  function hasCycle(node: string): boolean {
    visited.add(node);
    recursionStack.add(node);
    
    const neighbors = adjacencyList.get(node) || [];
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        if (hasCycle(neighbor)) {
          return true;
        }
      } else if (recursionStack.has(neighbor)) {
        return true;
      }
    }
    
    recursionStack.delete(node);
    return false;
  }
  
  for (const node of adjacencyList.keys()) {
    if (!visited.has(node)) {
      if (hasCycle(node)) {
        return true;
      }
    }
  }
  
  return false;
}

export function handleCircularDependencies(edges: LayoutEdge[]): {
  hasCircular: boolean;
  cleanedEdges: LayoutEdge[];
  removedEdges: LayoutEdge[];
} {
  const removedEdges: LayoutEdge[] = [];
  const cleanedEdges: LayoutEdge[] = [];
  const hasCircular = detectCircularDependencies(edges);
  
  if (!hasCircular) {
    return {
      hasCircular: false,
      cleanedEdges: edges,
      removedEdges: []
    };
  }
  
  const tempEdges = [...edges];
  for (let i = tempEdges.length - 1; i >= 0; i--) {
    const testEdges = [...tempEdges.slice(0, i), ...tempEdges.slice(i + 1)];
    if (!detectCircularDependencies(testEdges)) {
      removedEdges.push(tempEdges[i]);
      tempEdges.splice(i, 1);
    }
  }
  
  return {
    hasCircular: true,
    cleanedEdges: tempEdges,
    removedEdges
  };
}

export function measurePerformance<T>(
  fn: () => T,
  operationName: string,
  warnThreshold: number = 500
): T {
  const startTime = performance.now();
  const result = fn();
  const duration = performance.now() - startTime;
  
  if (duration > warnThreshold) {
    if (process.env.NODE_ENV === 'development') {
    console.warn(`${operationName} took ${duration.toFixed(2)}ms (threshold: ${warnThreshold}ms)`);
    }
  }
  
  return result;
}