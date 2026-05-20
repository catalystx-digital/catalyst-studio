import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CreateContentTypeRequest, UpdateContentTypeRequest } from '@/lib/api/validation/content-type';

interface ContentTypeResponse {
  id: string;
  websiteId: string;
  name: string;
  fields: any;
  settings: any;
  createdAt: string;
  updatedAt: string;
}

async function fetchContentTypes(websiteId?: string): Promise<ContentTypeResponse[]> {
  const params = websiteId ? `?websiteId=${websiteId}` : '';
  const response = await fetch(`/api/content-types${params}`);
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'Failed to fetch content types');
  }
  
  const result = await response.json();
  return result.data;
}

async function fetchContentType(id: string): Promise<ContentTypeResponse> {
  const response = await fetch(`/api/content-types/${id}`);
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'Failed to fetch content type');
  }
  
  const result = await response.json();
  return result.data;
}

async function createContentType(data: CreateContentTypeRequest): Promise<ContentTypeResponse> {
  const response = await fetch('/api/content-types', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'Failed to create content type');
  }
  
  const result = await response.json();
  return result.data;
}

async function updateContentType({ id, data }: { id: string; data: UpdateContentTypeRequest }): Promise<ContentTypeResponse> {
  const response = await fetch(`/api/content-types/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'Failed to update content type');
  }
  
  const result = await response.json();
  return result.data;
}

async function deleteContentType(id: string): Promise<void> {
  const response = await fetch(`/api/content-types/${id}`, {
    method: 'DELETE',
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'Failed to delete content type');
  }
}

export function useContentTypes(websiteId?: string) {
  const hasWebsiteId = typeof websiteId === 'string' && websiteId.length > 0;

  return useQuery({
    queryKey: ['content-types', websiteId],
    queryFn: () => fetchContentTypes(websiteId),
    enabled: hasWebsiteId,
    staleTime: 30000,
    gcTime: 300000,
  });
}

export function useContentType(id: string) {
  return useQuery({
    queryKey: ['content-types', id],
    queryFn: () => fetchContentType(id),
    enabled: !!id,
    staleTime: 30000,
    gcTime: 300000,
  });
}

export function useCreateContentType() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: createContentType,
    onSuccess: (data) => {
      // Invalidate all content-types queries for all websites
      queryClient.invalidateQueries({ queryKey: ['content-types'] });
      queryClient.setQueryData(['content-types', data.id], data);
      // Also invalidate queries with websiteId parameter
      const websiteId = data?.websiteId;
      if (websiteId) {
        queryClient.invalidateQueries({ queryKey: ['content-types', websiteId] });
      }
    },
  });
}

export function useUpdateContentType() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: updateContentType,
    onMutate: async ({ id, data }) => {
      await queryClient.cancelQueries({ queryKey: ['content-types', id] });
      const previousContentType = queryClient.getQueryData(['content-types', id]);
      
      queryClient.setQueryData(['content-types', id], (old: any) => ({
        ...old,
        ...data,
      }));
      
      return { previousContentType };
    },
    onError: (err, { id }, context) => {
      if (context?.previousContentType) {
        queryClient.setQueryData(['content-types', id], context.previousContentType);
      }
    },
    onSettled: (data, error, { id }) => {
      // Invalidate all content-types queries for all websites
      queryClient.invalidateQueries({ queryKey: ['content-types'] });
      queryClient.invalidateQueries({ queryKey: ['content-types', id] });
      // Also invalidate queries with websiteId parameter
      const websiteId = data?.websiteId;
      if (websiteId) {
        queryClient.invalidateQueries({ queryKey: ['content-types', websiteId] });
      }
    },
  });
}

export function useDeleteContentType() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: deleteContentType,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['content-types'] });
    },
  });
}