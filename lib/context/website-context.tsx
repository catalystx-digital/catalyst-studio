'use client';

import { createContext, useContext, useState, useCallback, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@/lib/supabase/hooks';
import { useWebsite, useUpdateWebsite, useDeleteWebsite, DeleteWebsiteResult } from '@/lib/api/hooks/use-websites';
import { Website, UpdateWebsiteRequest } from '@/types/api';

interface WebsiteContextValue {
  websiteId: string | null;
  website: Website | null;
  isLoading: boolean;
  error: Error | null;

  updateWebsite: (updates: UpdateWebsiteRequest) => Promise<void>;
  deleteWebsite: () => Promise<DeleteWebsiteResult>;
  switchWebsite: (id: string) => void;
  refreshWebsite: () => Promise<void>;
  isDeletingWebsite: boolean;
  deleteError: Error | null;
  resetDeleteState: () => void;
}

const WebsiteContext = createContext<WebsiteContextValue | null>(null);

const sanitizeWebsiteId = (id: string | null): string | null => {
  if (!id) {
    return null;
  }

  if (!/^[a-zA-Z0-9-_]+$/.test(id)) {
    console.warn(`Invalid website ID: ${id}`);
    return null;
  }

  if (id.length > 50) {
    console.warn(`Website ID exceeds maximum length: ${id}`);
    return null;
  }

  return id;
};

export function WebsiteContextProvider({
  websiteId,
  children
}: {
  websiteId: string | null;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const user = useUser();
  const isAuthenticated = Boolean(user);
  const [currentWebsiteId, setCurrentWebsiteId] = useState<string | null>(websiteId ?? null);

  // CRITICAL FIX (NEW-001): Sync internal state when websiteId prop changes from URL
  // This ensures the context updates when user switches websites via the dropdown
  useEffect(() => {
    if (websiteId !== currentWebsiteId) {
      setCurrentWebsiteId(websiteId);
    }
  }, [websiteId, currentWebsiteId]);

  const validatedWebsiteId = useMemo(() => sanitizeWebsiteId(currentWebsiteId), [currentWebsiteId]);
  const shouldFetchWebsite = isAuthenticated && !!validatedWebsiteId;

  const { data: website = null, isLoading, error: queryError, refetch } = useWebsite(
    validatedWebsiteId ?? undefined,
    { enabled: shouldFetchWebsite }
  );
  const updateMutation = useUpdateWebsite(validatedWebsiteId ?? undefined);
  const deleteMutation = useDeleteWebsite();

  const error = queryError instanceof Error ? queryError : queryError ? new Error(String(queryError)) : null;

  const updateWebsite = useCallback(async (updates: UpdateWebsiteRequest) => {
    if (!validatedWebsiteId) {
      throw new Error('Cannot update website without a selected website ID');
    }

    try {
      await updateMutation.mutateAsync(updates);
    } catch (err) {
      console.error('Failed to update website:', err);
      throw err;
    }
  }, [updateMutation, validatedWebsiteId]);

  const deleteWebsite = useCallback(async () => {
    if (!validatedWebsiteId) {
      throw new Error('Cannot delete website without a selected website ID');
    }

    try {
      const result = await deleteMutation.mutateAsync(validatedWebsiteId);
      router.push('/dashboard');
      return result;
    } catch (err) {
      console.error('Failed to delete website:', err);
      throw err;
    }
  }, [deleteMutation, validatedWebsiteId, router]);

  const switchWebsite = useCallback((id: string) => {
    setCurrentWebsiteId(id);
    router.push(`/studio/site-builder?websiteId=${id}`);
  }, [router]);

  const refreshWebsite = useCallback(async () => {
    if (!shouldFetchWebsite) {
      return;
    }

    await refetch();
  }, [refetch, shouldFetchWebsite]);

  const deleteError = deleteMutation.error instanceof Error
    ? deleteMutation.error
    : deleteMutation.error
    ? new Error(String(deleteMutation.error))
    : null;

  const contextValue = useMemo(
    () => ({
      websiteId: validatedWebsiteId,
      website,
      isLoading,
      error,
      updateWebsite,
      deleteWebsite,
      switchWebsite,
      refreshWebsite,
      isDeletingWebsite: deleteMutation.isPending,
      deleteError,
      resetDeleteState: deleteMutation.reset
    }),
    [validatedWebsiteId, website, isLoading, error,
     updateWebsite, deleteWebsite, switchWebsite, refreshWebsite,
     deleteMutation.isPending, deleteMutation.reset, deleteError]
  );

  return (
    <WebsiteContext.Provider value={contextValue}>
      {children}
    </WebsiteContext.Provider>
  );
}

export const useWebsiteContext = () => {
  const context = useContext(WebsiteContext);
  if (!context) {
    throw new Error('useWebsiteContext must be used within WebsiteContextProvider');
  }
  return context;
};

export const useCurrentWebsite = () => {
  const context = useWebsiteContext();
  return {
    website: context.website,
    isLoading: context.isLoading,
    error: context.error
  };
};

