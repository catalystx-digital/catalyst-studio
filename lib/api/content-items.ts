import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { 
  ContentItem, 
  ContentItemsResponse, 
  ContentItemsQuery,
  CreateContentItemRequest,
  UpdateContentItemRequest 
} from '@/types/api';

// API client functions
export async function getContentItems(query?: ContentItemsQuery): Promise<ContentItemsResponse> {
  const params = new URLSearchParams();
  
  if (query?.page) params.append('page', query.page.toString());
  if (query?.limit) params.append('limit', query.limit.toString());
  if (query?.status) params.append('status', query.status);
  if (query?.contentTypeId) params.append('contentTypeId', query.contentTypeId);
  if (query?.websiteId) params.append('websiteId', query.websiteId);
  if (query?.sortBy) params.append('sortBy', query.sortBy);
  if (query?.sortOrder) params.append('sortOrder', query.sortOrder);
  
  const response = await fetch(`/api/content-items?${params}`);
  
  if (!response.ok) {
    throw new Error('Failed to fetch content items');
  }
  
  return response.json();
}

export async function getContentItem(id: string): Promise<ContentItem> {
  const response = await fetch(`/api/content-items/${id}`);
  
  if (!response.ok) {
    throw new Error('Failed to fetch content item');
  }
  
  const result = await response.json();
  return result.data;
}

export async function createPage(data: CreateContentItemRequest): Promise<ContentItem> {
  const response = await fetch('/api/content-items', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...data,
      source: 'ui' // Default to UI source for direct API calls
    }),
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to create page');
  }
  
  const result = await response.json();
  return result.data;
}

export async function updateContentItem({ id, data }: { id: string; data: UpdateContentItemRequest }): Promise<ContentItem> {
  const response = await fetch(`/api/content-items/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  
  if (!response.ok) {
    throw new Error('Failed to update content item');
  }
  
  const result = await response.json();
  return result.data;
}

export async function deleteContentItem(id: string): Promise<void> {
  const response = await fetch(`/api/content-items/${id}`, {
    method: 'DELETE',
  });
  
  if (!response.ok) {
    throw new Error('Failed to delete content item');
  }
}

export async function bulkCreateContentItems(items: CreateContentItemRequest[]): Promise<ContentItem[]> {
  const response = await fetch('/api/content-items/bulk', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items }),
  });
  
  if (!response.ok) {
    throw new Error('Failed to bulk create content items');
  }
  
  const result = await response.json();
  return result.data;
}

export async function bulkDeleteContentItems(ids: string[]): Promise<void> {
  const response = await fetch('/api/content-items/bulk', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids }),
  });
  
  if (!response.ok) {
    throw new Error('Failed to bulk delete content items');
  }
}

// React Query hooks
export function useContentItems(query?: ContentItemsQuery) {
  return useQuery({
    queryKey: ['content-items', query],
    queryFn: () => getContentItems(query),
    staleTime: 30000, // Consider data fresh for 30 seconds
  });
}

export function useContentItem(id: string | null | undefined) {
  return useQuery({
    queryKey: ['content-items', id],
    queryFn: () => getContentItem(id!),
    enabled: !!id,
    staleTime: 30000,
  });
}

export function useCreatePage() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: createPage,
    onMutate: async (newItem) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['content-items'] });
      
      // Snapshot the previous value
      const previousItems = queryClient.getQueryData(['content-items']);
      
      // Optimistically update to the new value
      queryClient.setQueryData(['content-items'], (old: ContentItemsResponse | undefined) => {
        if (!old) return old;
        
        // Create a temporary item with a fake ID
        const tempItem: ContentItem = {
          id: `temp-${Date.now()}`,
          title: newItem.title || 'Untitled',
          slug: newItem.slug,
          websiteId: newItem.websiteId,
          contentTypeId: newItem.contentTypeId,
          content: newItem.content || {},
          status: newItem.status || 'draft',
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        
        return {
          ...old,
          data: [tempItem, ...old.data],
          pagination: {
            ...old.pagination,
            total: old.pagination.total + 1,
          },
        };
      });
      
      // Return a context object with the snapshotted value
      return { previousItems };
    },
    onError: (err, newItem, context) => {
      // If the mutation fails, use the context returned from onMutate to roll back
      if (context?.previousItems) {
        queryClient.setQueryData(['content-items'], context.previousItems);
      }
    },
    onSettled: () => {
      // Always refetch after error or success
      queryClient.invalidateQueries({ queryKey: ['content-items'] });
    },
  });
}

export function useUpdateContentItem() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: updateContentItem,
    onMutate: async ({ id, data }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['content-items'] });
      await queryClient.cancelQueries({ queryKey: ['content-items', id] });
      
      // Snapshot the previous values
      const previousItems = queryClient.getQueryData(['content-items']);
      const previousItem = queryClient.getQueryData(['content-items', id]);
      
      // Optimistically update the item
      queryClient.setQueryData(['content-items', id], (old: ContentItem | undefined) => {
        if (!old) return old;
        return { ...old, ...data };
      });
      
      // Also update in the list
      queryClient.setQueryData(['content-items'], (old: ContentItemsResponse | undefined) => {
        if (!old) return old;
        return {
          ...old,
          data: old.data.map(item => 
            item.id === id ? { ...item, ...data } : item
          ),
        };
      });
      
      // Return a context with the snapshots
      return { previousItems, previousItem };
    },
    onError: (err, variables, context) => {
      // Roll back on error
      if (context?.previousItems) {
        queryClient.setQueryData(['content-items'], context.previousItems);
      }
      if (context?.previousItem) {
        queryClient.setQueryData(['content-items', variables.id], context.previousItem);
      }
    },
    onSettled: (data, error, variables) => {
      // Refetch after error or success
      queryClient.invalidateQueries({ queryKey: ['content-items'] });
      queryClient.invalidateQueries({ queryKey: ['content-items', variables.id] });
    },
  });
}

export function useDeleteContentItem() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: deleteContentItem,
    onMutate: async (id) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['content-items'] });
      
      // Snapshot the previous value
      const previousItems = queryClient.getQueryData(['content-items']);
      
      // Optimistically update by setting status to archived
      queryClient.setQueryData(['content-items'], (old: ContentItemsResponse | undefined) => {
        if (!old) return old;
        return {
          ...old,
          data: old.data.map(item => 
            item.id === id ? { ...item, status: 'archived' as const } : item
          ),
        };
      });
      
      // Return a context with the snapshot
      return { previousItems };
    },
    onError: (err, id, context) => {
      // Roll back on error
      if (context?.previousItems) {
        queryClient.setQueryData(['content-items'], context.previousItems);
      }
    },
    onSettled: () => {
      // Refetch after error or success
      queryClient.invalidateQueries({ queryKey: ['content-items'] });
    },
  });
}