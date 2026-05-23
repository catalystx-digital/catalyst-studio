import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { 
  ContentItem, 
  ContentItemsResponse, 
  ContentItemsQuery,
  CreateContentItemRequest,
  UpdateContentItemRequest 
} from '@/types/api';

// ============================================
// Pages API (WebsitePage)
// ============================================

export async function getPages(query?: ContentItemsQuery): Promise<ContentItemsResponse> {
  const params = new URLSearchParams();
  
  if (query?.page) params.append('page', query.page.toString());
  if (query?.limit) params.append('limit', query.limit.toString());
  if (query?.status) params.append('status', query.status);
  if (query?.contentTypeId) params.append('contentTypeId', query.contentTypeId);
  if (query?.websiteId) params.append('websiteId', query.websiteId);
  if (query?.sortBy) params.append('sortBy', query.sortBy);
  if (query?.sortOrder) params.append('sortOrder', query.sortOrder);
  
  const response = await fetch(`/api/content/pages?${params}`);
  
  if (!response.ok) {
    throw new Error('Failed to fetch pages');
  }
  
  return response.json();
}

export async function getPage(id: string): Promise<ContentItem> {
  const response = await fetch(`/api/content/pages/${id}`);
  
  if (!response.ok) {
    throw new Error('Failed to fetch page');
  }
  
  return response.json();
}

export async function createPage(data: CreateContentItemRequest): Promise<ContentItem> {
  const response = await fetch('/api/content/pages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  
  if (!response.ok) {
    throw new Error('Failed to create page');
  }
  
  return response.json();
}

export async function updatePage(id: string, data: UpdateContentItemRequest): Promise<ContentItem> {
  const response = await fetch(`/api/content/pages/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  
  if (!response.ok) {
    throw new Error('Failed to update page');
  }
  
  return response.json();
}

export async function deletePage(id: string): Promise<void> {
  const response = await fetch(`/api/content/pages/${id}`, {
    method: 'DELETE',
  });
  
  if (!response.ok) {
    throw new Error('Failed to delete page');
  }
}

// ============================================
// Structure API (WebsiteStructure)
// ============================================

export async function getStructure(websiteId: string, parentId?: string) {
  const params = new URLSearchParams({ websiteId });
  if (parentId) params.append('parentId', parentId);
  
  const response = await fetch(`/api/structure?${params}`);
  
  if (!response.ok) {
    throw new Error('Failed to fetch structure');
  }
  
  return response.json();
}

export async function getStructureTree(websiteId: string, rootId?: string, maxDepth?: number) {
  const params = new URLSearchParams({ websiteId });
  if (rootId) params.append('rootId', rootId);
  if (maxDepth) params.append('maxDepth', maxDepth.toString());
  
  const response = await fetch(`/api/structure/tree?${params}`);
  
  if (!response.ok) {
    throw new Error('Failed to fetch structure tree');
  }
  
  return response.json();
}

export async function resolveUrl(websiteId: string, path: string) {
  const params = new URLSearchParams({ websiteId, path });
  
  const response = await fetch(`/api/structure/resolve?${params}`);
  
  if (!response.ok) {
    if (response.status === 404) {
      return null;
    }
    throw new Error('Failed to resolve URL');
  }
  
  return response.json();
}

// ============================================
// React Query Hooks for Pages
// ============================================

export function usePages(query?: ContentItemsQuery) {
  return useQuery({
    queryKey: ['pages', query],
    queryFn: () => getPages(query),
  });
}

export function usePage(id: string) {
  return useQuery({
    queryKey: ['page', id],
    queryFn: () => getPage(id),
    enabled: !!id,
  });
}

export function useCreatePage() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: createPage,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pages'] });
    },
  });
}

export function useUpdatePage() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateContentItemRequest }) => 
      updatePage(id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['page', id] });
      queryClient.invalidateQueries({ queryKey: ['pages'] });
    },
  });
}

export function useDeletePage() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: deletePage,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pages'] });
    },
  });
}

// ============================================
// React Query Hooks for Structure
// ============================================

export function useStructure(websiteId: string, parentId?: string) {
  return useQuery({
    queryKey: ['structure', websiteId, parentId],
    queryFn: () => getStructure(websiteId, parentId),
    enabled: !!websiteId,
  });
}

export function useStructureTree(websiteId: string, rootId?: string, maxDepth?: number) {
  return useQuery({
    queryKey: ['structure-tree', websiteId, rootId, maxDepth],
    queryFn: () => getStructureTree(websiteId, rootId, maxDepth),
    enabled: !!websiteId,
  });
}

export function useResolveUrl(websiteId: string, path: string) {
  return useQuery({
    queryKey: ['resolve-url', websiteId, path],
    queryFn: () => resolveUrl(websiteId, path),
    enabled: !!websiteId && !!path,
  });
}
