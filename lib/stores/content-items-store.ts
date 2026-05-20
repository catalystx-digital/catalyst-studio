import { create } from 'zustand';
import { 
  ContentItem
} from '@/types/api';

interface ContentItemsStore {
  // State
  items: ContentItem[];
  isLoading: boolean;
  error: Error | null;
  selectedWebsiteId: string | null;
  
  // Optimistic updates tracking
  optimisticUpdates: Map<string, ContentItem>;
  
  // Actions
  setItems: (items: ContentItem[]) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: Error | null) => void;
  setSelectedWebsiteId: (id: string | null) => void;
  
  // Optimistic CRUD operations
  addItemOptimistically: (item: ContentItem) => void;
  updateItemOptimistically: (id: string, updates: Partial<ContentItem>) => void;
  deleteItemOptimistically: (id: string) => void;
  
  // Rollback operations
  rollbackOptimisticUpdate: (id: string) => void;
  clearOptimisticUpdates: () => void;
  
  // Selectors
  getItemById: (id: string) => ContentItem | undefined;
  getItemsByType: (contentTypeId: string) => ContentItem[];
  getItemsByWebsite: (websiteId: string) => ContentItem[];
}

export const useContentItemsStore = create<ContentItemsStore>((set, get) => ({
  // Initial state
  items: [],
  isLoading: false,
  error: null,
  selectedWebsiteId: null,
  optimisticUpdates: new Map(),
  
  // Actions
  setItems: (items) => set({ items }),
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),
  setSelectedWebsiteId: (selectedWebsiteId) => set({ selectedWebsiteId }),
  
  // Optimistic CRUD operations
  addItemOptimistically: (item) => set((state) => {
    const updates = new Map(state.optimisticUpdates);
    updates.set(item.id, item);
    
    return {
      items: [...state.items, item],
      optimisticUpdates: updates,
    };
  }),
  
  updateItemOptimistically: (id, updates) => set((state) => {
    const optimisticUpdates = new Map(state.optimisticUpdates);
    const existingItem = state.items.find(item => item.id === id);
    
    if (existingItem) {
      const updatedItem = { ...existingItem, ...updates };
      optimisticUpdates.set(id, updatedItem);
      
      return {
        items: state.items.map(item => 
          item.id === id ? updatedItem : item
        ),
        optimisticUpdates,
      };
    }
    
    return state;
  }),
  
  deleteItemOptimistically: (id) => set((state) => {
    const optimisticUpdates = new Map(state.optimisticUpdates);
    const existingItem = state.items.find(item => item.id === id);
    
    if (existingItem) {
      // Mark as archived instead of removing
      const archivedItem = { ...existingItem, status: 'archived' as const };
      optimisticUpdates.set(id, archivedItem);
      
      return {
        items: state.items.map(item => 
          item.id === id ? archivedItem : item
        ),
        optimisticUpdates,
      };
    }
    
    return state;
  }),
  
  // Rollback operations
  rollbackOptimisticUpdate: (id) => set((state) => {
    const optimisticUpdates = new Map(state.optimisticUpdates);
    const originalItem = state.items.find(item => item.id === id);
    
    if (optimisticUpdates.has(id)) {
      optimisticUpdates.delete(id);
      
      // If we have the original item, restore it
      if (originalItem) {
        return {
          items: state.items,
          optimisticUpdates,
        };
      }
    }
    
    return state;
  }),
  
  clearOptimisticUpdates: () => set({ optimisticUpdates: new Map() }),
  
  // Selectors
  getItemById: (id) => {
    const state = get();
    return state.items.find(item => item.id === id);
  },
  
  getItemsByType: (contentTypeId) => {
    const state = get();
    return state.items.filter(item => item.contentTypeId === contentTypeId);
  },
  
  getItemsByWebsite: (websiteId) => {
    const state = get();
    return state.items.filter(item => item.websiteId === websiteId);
  },
}));