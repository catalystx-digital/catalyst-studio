'use client';

/**
 * Unified Settings Page
 *
 * Consolidated settings page that handles both contexts:
 * - Website Settings (when websiteId is provided): General, Integrations, API Access tabs
 * - Account Settings (when no websiteId): Usage & Quotas only
 *
 * This consolidation addresses user confusion between separate settings pages.
 */

import { useState, useCallback, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Loader2, Key, Settings, BarChart3 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DeleteWebsiteDialog } from '@/components/ui/delete-website-dialog';
import { useToast } from '@/components/ui/use-toast';
import { ApiAccessTab } from '@/lib/studio/components/settings/api-access-tab';
import { UsageOverview } from '@/lib/studio/components/settings/usage-overview';

interface Website {
  id: string;
  name: string;
}

export default function UnifiedSettingsPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const websiteId = searchParams?.get('websiteId') ?? null;
  const defaultTab = searchParams?.get('tab') || (websiteId ? 'general' : 'usage');

  const { toast } = useToast();
  const [website, setWebsite] = useState<Website | null>(null);
  const [isLoading, setIsLoading] = useState(!!websiteId);
  const [error, setError] = useState<Error | null>(null);
  const [isDeleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isDeletingWebsite, setIsDeletingWebsite] = useState(false);
  const [deleteError, setDeleteError] = useState<Error | null>(null);

  // Fetch website data when websiteId is provided
  useEffect(() => {
    if (!websiteId) {
      setIsLoading(false);
      return;
    }

    const fetchWebsite = async () => {
      try {
        const res = await fetch(`/api/websites/${websiteId}`);
        if (!res.ok) {
          throw new Error('Failed to load website');
        }
        const data = await res.json();
        setWebsite(data.data);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Unknown error'));
      } finally {
        setIsLoading(false);
      }
    };

    fetchWebsite();
  }, [websiteId]);

  const handleDialogOpenChange = useCallback((open: boolean) => {
    setDeleteDialogOpen(open);
    if (!open) {
      setDeleteError(null);
    }
  }, []);

  const handleDeleteWebsite = useCallback(async () => {
    if (!websiteId) return;

    setIsDeletingWebsite(true);
    setDeleteError(null);

    try {
      const res = await fetch(`/api/websites/${websiteId}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error?.message || 'Failed to delete website');
      }

      toast({
        title: 'Website deleted',
        description: `"${website?.name || 'Website'}" has been removed.`,
      });

      handleDialogOpenChange(false);
      router.push('/dashboard');
    } catch (err) {
      const errorInstance = err instanceof Error ? err : new Error('An unexpected error occurred.');
      setDeleteError(errorInstance);
      toast({
        title: 'Unable to delete website',
        description: errorInstance.message,
        variant: 'destructive',
      });
    } finally {
      setIsDeletingWebsite(false);
    }
  }, [websiteId, website?.name, toast, handleDialogOpenChange, router]);

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="text-muted-foreground flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          <p>Loading settings...</p>
        </div>
      </div>
    );
  }

  if (error && websiteId) {
    return (
      <div className="p-6">
        <div className="text-destructive">
          <h2 className="text-xl font-bold mb-2">Error Loading Website</h2>
          <p>{error.message}</p>
        </div>
      </div>
    );
  }

  const websiteName = website?.name ?? 'this website';
  const isWebsiteContext = !!websiteId;

  return (
    <div className="h-full overflow-y-auto">
      {/* Header */}
      <div className="p-6 border-b border-border bg-card">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">
          {isWebsiteContext ? 'Website Settings' : 'Account Settings'}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {isWebsiteContext
            ? `Configure settings for: ${websiteName}`
            : 'Review your Catalyst Studio usage and account preferences.'}
        </p>
      </div>

      <div className="p-6">
        <Tabs defaultValue={defaultTab} className="space-y-6">
          <TabsList className="flex-wrap">
            {/* Website-specific tabs */}
            {isWebsiteContext && (
              <>
                <TabsTrigger value="general" className="gap-2">
                  <Settings className="h-4 w-4" />
                  General
                </TabsTrigger>
                <TabsTrigger value="api" className="gap-2">
                  <Key className="h-4 w-4" />
                  API Access
                </TabsTrigger>
              </>
            )}
            {/* Account-wide tab - only show when no website context (accessed via sidebar Account section) */}
            {!isWebsiteContext && (
              <TabsTrigger value="usage" className="gap-2">
                <BarChart3 className="h-4 w-4" />
                Usage & Quotas
              </TabsTrigger>
            )}
          </TabsList>

          {/* Website-specific tab contents */}
          {isWebsiteContext && (
            <>
              <TabsContent value="general" className="space-y-6">
                {/* Website Information */}
                <section className="rounded-lg border border-border bg-card p-6">
                  <h2 className="text-lg font-semibold text-foreground mb-4">Website Information</h2>
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Website Name</label>
                      <p className="text-foreground mt-1">{websiteName}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Website ID</label>
                      <p className="text-foreground mt-1 font-mono text-sm">{websiteId}</p>
                    </div>
                  </div>
                </section>

                {/* Danger Zone */}
                <section
                  className="rounded-lg border border-destructive/40 bg-destructive/5 p-6"
                  aria-label="Danger zone"
                >
                  <div className="flex flex-col gap-4">
                    <div>
                      <h2 className="text-lg font-semibold text-destructive">Danger zone</h2>
                      <p className="text-sm text-destructive/80">
                        Permanently delete {websiteName}. All pages, content, and integrations will be
                        removed and cannot be restored.
                      </p>
                    </div>

                    {deleteError && (
                      <p className="rounded-md border border-destructive/60 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                        {deleteError.message}
                      </p>
                    )}

                    <div className="flex flex-wrap items-center gap-3">
                      <Button
                        variant="destructive"
                        onClick={() => setDeleteDialogOpen(true)}
                        disabled={isDeletingWebsite}
                      >
                        {isDeletingWebsite && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Delete website
                      </Button>
                      <span className="text-xs text-destructive/80">
                        Make sure you have exported any data you want to keep before deleting.
                      </span>
                    </div>
                  </div>
                </section>
              </TabsContent>

              <TabsContent value="api">
                <ApiAccessTab websiteId={websiteId} websiteName={website?.name} />
              </TabsContent>
            </>
          )}

          {/* Usage tab - only when no website context (accessed via sidebar Account section) */}
          {!isWebsiteContext && (
            <TabsContent value="usage" className="space-y-6">
              <UsageOverview />
            </TabsContent>
          )}
        </Tabs>
      </div>

      {isWebsiteContext && (
        <DeleteWebsiteDialog
          open={isDeleteDialogOpen}
          onOpenChange={handleDialogOpenChange}
          websiteName={websiteName}
          onConfirm={handleDeleteWebsite}
          isDeleting={isDeletingWebsite}
          errorMessage={deleteError?.message}
        />
      )}
    </div>
  );
}
