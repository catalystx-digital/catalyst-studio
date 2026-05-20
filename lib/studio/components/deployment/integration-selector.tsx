'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { formatDistanceToNow } from 'date-fns';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Loader2,
  RefreshCcw,
  Pencil,
  TestTube2,
  Trash2,
  Plus,
  Plug,
} from 'lucide-react';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { getProviderMetadata, isIntegrationProviderEnabled } from '@/lib/studio/integrations/provider-config';
import {
  useAccountIntegrations,
  type UseAccountIntegrationsOptions,
} from '@/lib/studio/hooks/use-account-integrations';
import type { AccountIntegrationRecord } from '@/lib/studio/types/integration';

const statusClasses: Record<string, string> = {
  enabled: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400',
  disabled: 'border-amber-500/20 bg-amber-500/10 text-amber-400',
  error: 'border-rose-500/20 bg-rose-500/10 text-rose-400',
};

export interface IntegrationSelectorProps {
  selectedIntegrationId?: string | null;
  onSelect: (integration: AccountIntegrationRecord) => void;
  manageHref?: string;
  onCreateIntegration?: () => void;
  queryOptions?: UseAccountIntegrationsOptions;
  className?: string;
  onEditIntegration?: (integration: AccountIntegrationRecord) => void;
  onTestIntegration?: (integration: AccountIntegrationRecord) => void;
  onDeleteIntegration?: (integration: AccountIntegrationRecord) => void;
  testingIntegrationId?: string | null;
  deletingIntegrationId?: string | null;
}

export function IntegrationSelector({
  selectedIntegrationId,
  onSelect,
  manageHref = '/studio/settings',
  onCreateIntegration,
  queryOptions,
  className,
  onEditIntegration,
  onTestIntegration,
  onDeleteIntegration,
  testingIntegrationId,
  deletingIntegrationId,
}: IntegrationSelectorProps) {
  const {
    data,
    isLoading,
    isError,
    refetch,
  } = useAccountIntegrations(queryOptions);

  const enabledIntegrations = useMemo(
    () => (data ?? []).filter(item => item.status === 'enabled' && !item.providerDisabled && isIntegrationProviderEnabled(item.provider)),
    [data],
  );

  const disabledDueToConfig = useMemo(
    () => (data ?? []).filter(item => item.providerDisabled),
    [data],
  );

  if (isLoading) {
    return (
      <div className={cn('grid gap-4 md:grid-cols-2', className)} data-testid="integration-selector-loading">
        {[0, 1].map(index => (
          <Card key={index} className="border-white/10 bg-white/5">
            <CardContent className="space-y-4 py-6">
              <Skeleton className="h-6 w-1/2 bg-white/10" />
              <Skeleton className="h-4 w-3/4 bg-white/10" />
              <div className="flex gap-2">
                <Skeleton className="h-4 w-16 bg-white/10" />
                <Skeleton className="h-4 w-24 bg-white/10" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <Alert variant="destructive" data-testid="integration-selector-error">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription className="flex items-start justify-between gap-4">
          <span>We couldn't load your integrations. Please try again.</span>
          <Button variant="outline" size="sm" onClick={() => void refetch()}>
            <RefreshCcw className="mr-2 h-3 w-3" />
            Retry
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  if (!enabledIntegrations.length) {
    return (
      <Card className={cn('border-dashed border-white/20 bg-white/5 text-white', className)} data-testid="integration-selector-empty">
        <CardContent className="flex flex-col items-center justify-center py-10 text-center">
          <Plug className="h-12 w-12 text-white/40 mb-4" aria-hidden="true" />
          <CardTitle className="text-lg mb-2">No CMS Integration Configured</CardTitle>
          <CardDescription className="text-white/60 mb-6 max-w-md">
            To deploy your website, you need to connect a CMS platform like
            Optimizely, WordPress, or Contentful. This allows Catalyst Studio
            to sync your content and pages directly to your live site.
          </CardDescription>
          {onCreateIntegration ? (
            <Button onClick={onCreateIntegration} className="bg-[#FF5500] text-white hover:bg-[#FF5500]/80">
              <Plug className="mr-2 h-4 w-4" aria-hidden="true" />
              Set Up Integration
            </Button>
          ) : manageHref ? (
            <Button asChild className="bg-[#FF5500] text-white hover:bg-[#FF5500]/80">
              <Link href={`${manageHref}&tab=integrations`}>
                <Plug className="mr-2 h-4 w-4" aria-hidden="true" />
                Set Up Integration
              </Link>
            </Button>
          ) : null}
        </CardContent>
      </Card>
    );
  }

  const showListActions = Boolean(onCreateIntegration || manageHref);

  return (
    <div className={cn('space-y-4', className)} data-testid="integration-selector-list">
      {showListActions && (
        <div className="flex justify-end">
          {onCreateIntegration ? (
            <Button
              variant="ghost"
              size="icon"
              onClick={onCreateIntegration}
              className="size-11 rounded-full border border-white/10 bg-white/5 text-white hover:bg-white/10"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              <span className="sr-only">Connect integration</span>
            </Button>
          ) : manageHref ? (
            <Button
              asChild
              variant="ghost"
              size="icon"
              className="size-11 rounded-full border border-white/10 bg-white/5 text-white hover:bg-white/10"
            >
              <Link href={manageHref}>
                <Plus className="h-4 w-4" aria-hidden="true" />
                <span className="sr-only">Connect integration</span>
              </Link>
            </Button>
          ) : null}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {disabledDueToConfig.length > 0 && (
          <Alert className="md:col-span-2 border-amber-500/20 bg-amber-500/10 text-amber-200">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              One or more integrations are disabled by environment configuration. Update Account Settings or contact an administrator to re-enable them.
            </AlertDescription>
          </Alert>
        )}
        {enabledIntegrations.map(integration => {
          const metadata = getProviderMetadata(integration.provider);
          const isSelected = integration.id === selectedIntegrationId;
          const lastTestedLabel = integration.lastTestedAt
            ? formatDistanceToNow(new Date(integration.lastTestedAt), { addSuffix: true })
            : null;
          const isTesting = testingIntegrationId === integration.id;
          const isDeleting = deletingIntegrationId === integration.id;

          return (
            <Card
              key={integration.id}
              role="button"
              tabIndex={0}
              onClick={() => onSelect(integration)}
              onKeyDown={event => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  onSelect(integration);
                }
              }}
              data-testid="integration-card"
              data-integration-id={integration.id}
              className={cn(
                'cursor-pointer border border-white/10 bg-gradient-to-br from-white/10 to-white/5 text-white transition-all',
                'hover:border-white/40 focus-visible:border-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF5500] focus-visible:ring-offset-2 focus-visible:ring-offset-black',
                isSelected && 'ring-2 ring-[#FF5500] border-[#FF5500] shadow-lg',
              )}
            >
              <CardHeader className="space-y-1">
                <CardTitle className="flex items-center justify-between text-base">
                  <span>{integration.displayName || metadata.label}</span>
                  <div className="flex items-center gap-2">
                    <Badge className={cn('capitalize border', statusClasses[integration.status])}>
                      {integration.status}
                    </Badge>
                    {onEditIntegration ? (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-white/70 hover:text-white"
                        onClick={event => {
                          event.stopPropagation();
                          onEditIntegration(integration);
                        }}
                        aria-label="Edit integration"
                      >
                        <Pencil className="h-4 w-4" aria-hidden="true" />
                      </Button>
                    ) : null}
                    {onTestIntegration ? (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-white/70 hover:text-white"
                        onClick={event => {
                          event.stopPropagation();
                          onTestIntegration(integration);
                        }}
                        disabled={isTesting || isDeleting}
                        aria-label="Test integration"
                      >
                        {isTesting ? (
                          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                        ) : (
                          <TestTube2 className="h-4 w-4" aria-hidden="true" />
                        )}
                      </Button>
                    ) : null}
                    {onDeleteIntegration ? (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-white/70 hover:text-white"
                        onClick={event => {
                          event.stopPropagation();
                          onDeleteIntegration(integration);
                        }}
                        disabled={isDeleting || isTesting}
                        aria-label="Delete integration"
                      >
                        {isDeleting ? (
                          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                        ) : (
                          <Trash2 className="h-4 w-4" aria-hidden="true" />
                        )}
                      </Button>
                    ) : null}
                  </div>
                </CardTitle>
                <CardDescription className="text-white/60">
                  {metadata.label}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-white/70">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  <span>Secrets stored securely</span>
                </div>
                {lastTestedLabel ? (
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-blue-300" />
                    <span>Last tested {lastTestedLabel}</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-white/50">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>No test run yet</span>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
