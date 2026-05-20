import { SitemapNode, SitemapEdge } from './types';

export interface HistoryState {
  nodes: SitemapNode[];
  edges: SitemapEdge[];
  timestamp: number;
}

export interface UndoManagerOptions {
  maxHistorySize?: number;
  onStateChange?: (canUndo: boolean, canRedo: boolean) => void;
}

/**
 * Manages undo/redo history for the sitemap
 */
export class UndoManager {
  private history: HistoryState[] = [];
  private currentIndex = -1;
  private maxHistorySize: number;
  private onStateChange?: (canUndo: boolean, canRedo: boolean) => void;
  
  constructor(options: UndoManagerOptions = {}) {
    this.maxHistorySize = options.maxHistorySize || 50;
    this.onStateChange = options.onStateChange;
  }
  
  /**
   * Push a new state to history
   */
  pushState(nodes: SitemapNode[], edges: SitemapEdge[]) {
    // Remove any states after current index (for branching history)
    this.history = this.history.slice(0, this.currentIndex + 1);
    
    // Create new state with deep copy
    const newState: HistoryState = {
      nodes: JSON.parse(JSON.stringify(nodes)),
      edges: JSON.parse(JSON.stringify(edges)),
      timestamp: Date.now()
    };
    
    // Add new state
    this.history.push(newState);
    this.currentIndex++;
    
    // Enforce max history size
    if (this.history.length > this.maxHistorySize) {
      this.history.shift();
      this.currentIndex--;
    }
    
    this.notifyStateChange();
  }
  
  /**
   * Get the previous state
   */
  undo(): HistoryState | null {
    if (!this.canUndo()) {
      return null;
    }
    
    this.currentIndex--;
    this.notifyStateChange();
    return this.getCurrentState();
  }
  
  /**
   * Get the next state
   */
  redo(): HistoryState | null {
    if (!this.canRedo()) {
      return null;
    }
    
    this.currentIndex++;
    this.notifyStateChange();
    return this.getCurrentState();
  }
  
  /**
   * Check if undo is available
   */
  canUndo(): boolean {
    return this.currentIndex > 0;
  }
  
  /**
   * Check if redo is available
   */
  canRedo(): boolean {
    return this.currentIndex < this.history.length - 1;
  }
  
  /**
   * Get the current state
   */
  getCurrentState(): HistoryState | null {
    if (this.currentIndex >= 0 && this.currentIndex < this.history.length) {
      return this.history[this.currentIndex];
    }
    return null;
  }
  
  /**
   * Clear all history
   */
  clear() {
    this.history = [];
    this.currentIndex = -1;
    this.notifyStateChange();
  }
  
  /**
   * Get history statistics
   */
  getStats() {
    return {
      historySize: this.history.length,
      currentIndex: this.currentIndex,
      canUndo: this.canUndo(),
      canRedo: this.canRedo(),
      oldestTimestamp: this.history[0]?.timestamp,
      newestTimestamp: this.history[this.history.length - 1]?.timestamp
    };
  }
  
  /**
   * Initialize with a state
   */
  initialize(nodes: SitemapNode[], edges: SitemapEdge[]) {
    this.clear();
    this.pushState(nodes, edges);
  }
  
  private notifyStateChange() {
    this.onStateChange?.(this.canUndo(), this.canRedo());
  }
}

// Export singleton instance for global use
export const undoManager = new UndoManager();