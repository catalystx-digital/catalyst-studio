import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

// ============================================
// Component Types API (WebsiteComponentType)
// ============================================

export interface ComponentTypeQuery {
  category?: string;
  categories?: string;
  aiTag?: string;
  isActive?: boolean;
  page?: number;
  limit?: number;
}

export async function getComponentTypes(query?: ComponentTypeQuery) {
  const params = new URLSearchParams();
  
  if (query?.category) params.append('category', query.category);
  if (query?.categories) params.append('categories', query.categories);
  if (query?.aiTag) params.append('aiTag', query.aiTag);
  if (query?.isActive !== undefined) params.append('isActive', query.isActive.toString());
  if (query?.page) params.append('page', query.page.toString());
  if (query?.limit) params.append('limit', query.limit.toString());
  
  const response = await fetch(`/api/components/types?${params}`);
  
  if (!response.ok) {
    throw new Error('Failed to fetch component types');
  }
  
  return response.json();
}

export async function getComponentType(id: string) {
  const response = await fetch(`/api/components/types/${id}`);
  
  if (!response.ok) {
    throw new Error('Failed to fetch component type');
  }
  
  return response.json();
}

export async function createComponentType(data: any, websiteId: string) {
  const response = await fetch('/api/components/types', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-website-id': websiteId,
    },
    body: JSON.stringify(data),
  });
  
  if (!response.ok) {
    throw new Error('Failed to create component type');
  }
  
  return response.json();
}

export async function updateComponentType(id: string, data: any) {
  const response = await fetch(`/api/components/types/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  
  if (!response.ok) {
    throw new Error('Failed to update component type');
  }
  
  return response.json();
}

export async function deleteComponentType(id: string) {
  const response = await fetch(`/api/components/types/${id}`, {
    method: 'DELETE',
  });
  
  if (!response.ok) {
    throw new Error('Failed to delete component type');
  }
}

// ============================================
// Shared Components API (WebsiteSharedComponent)
// ============================================

export interface SharedComponentQuery {
  websiteId?: string;
  componentTypeId?: string;
  isActive?: boolean;
  page?: number;
  limit?: number;
}

export async function getSharedComponents(query?: SharedComponentQuery) {
  const params = new URLSearchParams();
  
  if (query?.websiteId) params.append('websiteId', query.websiteId);
  if (query?.componentTypeId) params.append('componentTypeId', query.componentTypeId);
  if (query?.isActive !== undefined) params.append('isActive', query.isActive.toString());
  if (query?.page) params.append('page', query.page.toString());
  if (query?.limit) params.append('limit', query.limit.toString());
  
  const response = await fetch(`/api/components/shared?${params}`);
  
  if (!response.ok) {
    throw new Error('Failed to fetch shared components');
  }
  
  return response.json();
}

export async function getSharedComponent(id: string) {
  const response = await fetch(`/api/components/shared/${id}`);
  
  if (!response.ok) {
    throw new Error('Failed to fetch shared component');
  }
  
  return response.json();
}

export async function createSharedComponent(data: any) {
  const response = await fetch('/api/components/shared', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  
  if (!response.ok) {
    throw new Error('Failed to create shared component');
  }
  
  return response.json();
}

export async function updateSharedComponent(id: string, data: any) {
  const response = await fetch(`/api/components/shared/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  
  if (!response.ok) {
    throw new Error('Failed to update shared component');
  }
  
  return response.json();
}

export async function deleteSharedComponent(id: string) {
  const response = await fetch(`/api/components/shared/${id}`, {
    method: 'DELETE',
  });
  
  if (!response.ok) {
    throw new Error('Failed to delete shared component');
  }
}

// ============================================
// React Query Hooks for Component Types
// ============================================

export function useComponentTypes(query?: ComponentTypeQuery) {
  return useQuery({
    queryKey: ['component-types', query],
    queryFn: () => getComponentTypes(query),
  });
}

export function useComponentType(id: string) {
  return useQuery({
    queryKey: ['component-type', id],
    queryFn: () => getComponentType(id),
    enabled: !!id,
  });
}

export function useCreateComponentType() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ data, websiteId }: { data: any; websiteId: string }) =>
      createComponentType(data, websiteId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['component-types'] });
    },
  });
}

export function useUpdateComponentType() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => 
      updateComponentType(id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['component-type', id] });
      queryClient.invalidateQueries({ queryKey: ['component-types'] });
    },
  });
}

export function useDeleteComponentType() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: deleteComponentType,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['component-types'] });
    },
  });
}

// ============================================
// React Query Hooks for Shared Components
// ============================================

export function useSharedComponents(query?: SharedComponentQuery) {
  return useQuery({
    queryKey: ['shared-components', query],
    queryFn: () => getSharedComponents(query),
  });
}

export function useSharedComponent(id: string) {
  return useQuery({
    queryKey: ['shared-component', id],
    queryFn: () => getSharedComponent(id),
    enabled: !!id,
  });
}

export function useCreateSharedComponent() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: createSharedComponent,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shared-components'] });
    },
  });
}

export function useUpdateSharedComponent() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => 
      updateSharedComponent(id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['shared-component', id] });
      queryClient.invalidateQueries({ queryKey: ['shared-components'] });
    },
  });
}

export function useDeleteSharedComponent() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: deleteSharedComponent,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shared-components'] });
    },
  });
}