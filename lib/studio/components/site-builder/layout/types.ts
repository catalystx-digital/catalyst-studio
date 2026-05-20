export interface LayoutNode {
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

export interface LayoutEdge {
  id: string;
  source: string;
  target: string;
}

export interface LayoutConfig {
  rankdir: 'TB' | 'BT' | 'LR' | 'RL';
  nodesep: number;
  ranksep: number;
  marginx: number;
  marginy: number;
}

export interface LayoutResult {
  nodes: LayoutNode[];
  success: boolean;
  error?: string;
}