'use client';

import Link from 'next/link';
import { useCallback, useMemo, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';
import {
  AlertCircle,
  Check,
  Clock,
  Loader2,
  Pencil,
  Plus,
  ShieldAlert,
  TestTube2,
  Trash2,
} from 'lucide-react';

import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

import {
  INTEGRATION_PROVIDER_METADATA,
  IntegrationProviderSlug,
  getProviderMetadata,
  isIntegrationProviderEnabled,
} from '@/lib/studio/integrations/provider-config';
import {
  IntegrationFormDialog,
  type IntegrationFormDialogState,
} from '@/lib/studio/components/integrations/integration-form-dialog';
import { ENABLED_PROVIDER_SLUGS } from '@/lib/studio/components/integrations/integration-form-helpers';
import {
  useAccountIntegrations,
  useCreateIntegration,
  useRemoveIntegration,
  useTestIntegration,
  useUpdateIntegration,
} from '@/lib/studio/hooks/use-account-integrations';
import type {
  AccountIntegrationRecord,
  IntegrationStatus,
  UpdateIntegrationRequest,
} from '@/lib/studio/types/integration';

type ConfirmationState =
  | { type: 'disable'; integration: AccountIntegrationRecord }
  | { type: 'delete'; integration: AccountIntegrationRecord }
  | null;
const statusClasses: Record<IntegrationStatus, string> = {
  enabled: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400',
  disabled: 'border-amber-500/20 bg-amber-500/10 text-amber-400',
  error: 'border-red-500/20 bg-red-500/10 text-red-400',
};

export function IntegrationManager() {
  const [modal, setModal] = useState<IntegrationFormDialogState>(null);
  const [confirmation, setConfirmation] = useState<ConfirmationState>(null);
  const [statusTargetId, setStatusTargetId] = useState<string | null>(null);
  const [testTargetId, setTestTargetId] = useState<string | null>(null);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  const {
    data: integrations = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useAccountIntegrations({ includeDisabled: true });

  const createMutation = useCreateIntegration();
  const updateMutation = useUpdateIntegration();
  const statusMutation = useUpdateIntegration();
  const removeMutation = useRemoveIntegration();
  const testMutation = useTestIntegration();

  const openCreateModal = useCallback(() => {
    if (ENABLED_PROVIDER_SLUGS.length === 0) {
      toast.error('No deployment providers are enabled. Update your environment configuration.');
      return;
    }

    setModal({ mode: 'create', provider: ENABLED_PROVIDER_SLUGS[0], formKey: Date.now() });
  }, []);

  const openEditModal = useCallback((integration: AccountIntegrationRecord) => {
    setModal({ mode: 'edit', integration, formKey: Date.now() });
  }, []);

  const closeModal = useCallback(() => {
    setModal(null);
    createMutation.reset();
    updateMutation.reset();
  }, [createMutation, updateMutation]);

  const handleCreate = useCallback(
    (input: { provider: IntegrationProviderSlug; displayName: string; config: Record<string, unknown> }) => {
      createMutation.mutate(input, {
        onSuccess: result => {
          toast.success(`Integration "${result.displayName}" connected`);
          closeModal();
        },
        onError: err => {
          const message = err instanceof Error ? err.message : 'Failed to create integration';
          toast.error(message);
        },
      });
    },
    [closeModal, createMutation],
  );

  const handleFormUpdate = useCallback(
    (input: { id: string; displayName: string; config: Record<string, unknown> }) => {
      const payload: UpdateIntegrationRequest = {};
      const trimmedName = input.displayName.trim();

      if (trimmedName) {
        payload.displayName = trimmedName;
      }

      if (Object.keys(input.config).length > 0) {
        payload.config = input.config;
      }

      updateMutation.mutate(
        { id: input.id, payload },
        {
          onSuccess: result => {
            toast.success(`Integration "${result.displayName}" updated`);
            closeModal();
          },
          onError: err => {
            const message = err instanceof Error ? err.message : 'Failed to update integration';
            toast.error(message);
          },
        },
      );
    },
    [closeModal, updateMutation],
  );

  const runStatusUpdate = useCallback(
    (
      id: string,
      payload: UpdateIntegrationRequest,
      options?: { successMessage?: string; onSettled?: () => void },
    ) => {
      setStatusTargetId(id);
      statusMutation.mutate(
        { id, payload },
        {
          onSuccess: result => {
            const message =
              options?.successMessage ?? `Integration "${result.displayName}" updated`;
            toast.success(message);
          },
          onError: err => {
            const message = err instanceof Error ? err.message : 'Failed to update integration';
            toast.error(message);
          },
          onSettled: () => {
            setStatusTargetId(null);
            options?.onSettled?.();
          },
        },
      );
    },
    [statusMutation],
  );

  const handleEnable = useCallback(
    (integration: AccountIntegrationRecord) => {
      if (integration.providerDisabled) {
        toast.error('This provider is disabled by configuration. Update the environment to enable it.');
        return;
      }

      runStatusUpdate(integration.id, { status: 'enabled' }, {
        successMessage: `Integration "${integration.displayName}" enabled`,
      });
    },
    [runStatusUpdate],
  );

  const handleDisableRequest = useCallback(
    (integration: AccountIntegrationRecord) => {
      setConfirmation({ type: 'disable', integration });
    },
    [],
  );

  const handleDeleteRequest = useCallback(
    (integration: AccountIntegrationRecord) => {
      setConfirmation({ type: 'delete', integration });
    },
    [],
  );

  const handleDisableConfirm = useCallback(() => {
    if (!confirmation || confirmation.type !== 'disable') {
      return;
    }

    const { integration } = confirmation;
    runStatusUpdate(
      integration.id,
      { status: 'disabled' },
      {
        successMessage: `Integration "${integration.displayName}" disabled`,
        onSettled: () => setConfirmation(null),
      },
    );
  }, [confirmation, runStatusUpdate]);

  const handleDeleteConfirm = useCallback(() => {
    if (!confirmation || confirmation.type !== 'delete') {
      return;
    }

    const { integration } = confirmation;
    setDeleteTargetId(integration.id);
    removeMutation.mutate(
      { id: integration.id, options: { hardDelete: true } },
      {
        onSuccess: () => {
          toast.success(`Integration "${integration.displayName}" deleted`);
        },
        onError: err => {
          const message = err instanceof Error ? err.message : 'Failed to delete integration';
          toast.error(message);
        },
        onSettled: () => {
          setDeleteTargetId(null);
          setConfirmation(null);
        },
      },
    );
  }, [confirmation, removeMutation]);

  const handleTest = useCallback(
    (integration: AccountIntegrationRecord) => {
      if (integration.providerDisabled) {
        toast.error('This provider is disabled by configuration.');
        return;
      }

      setTestTargetId(integration.id);
      testMutation.mutate(integration.id, {
        onSuccess: result => {
          const message = result?.message ?? 'Connection test succeeded';
          toast.success(message);
        },
        onError: err => {
          const message = err instanceof Error ? err.message : 'Failed to test integration';
          toast.error(message);
        },
        onSettled: () => {
          setTestTargetId(null);
        },
      });
    },
    [testMutation],
  );

  const modalSubmitting =
    modal?.mode === 'create'
      ? createMutation.isPending
      : modal?.mode === 'edit'
      ? updateMutation.isPending
      : false;

  const modalError =
    modal?.mode === 'create'
      ? (createMutation.error as Error | null)
      : modal?.mode === 'edit'
      ? (updateMutation.error as Error | null)
      : null;

  const isDeletePending =
    confirmation?.type === 'delete' &&
    removeMutation.isPending &&
    confirmation.integration.id === deleteTargetId;

  const isDisablePending =
    confirmation?.type === 'disable' &&
    statusMutation.isPending &&
    confirmation.integration.id === statusTargetId;

  let content: React.ReactNode;

  if (isError) {
    const message = error instanceof Error ? error.message : 'Unable to load integrations';

    content = (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" aria-hidden="true" />
        <AlertDescription className="flex flex-wrap items-center gap-3">
          <span>{message}</span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            className="border-gray-700 text-gray-200 hover:text-white"
          >
            Retry
          </Button>
        </AlertDescription>
      </Alert>
    );
  } else if (isLoading) {
    content = <IntegrationListSkeleton />;
  } else if (!integrations.length) {
    content = <IntegrationEmptyState onCreate={openCreateModal} />;
  } else {
    content = (
      <div className="grid gap-4 md:grid-cols-2">
        {integrations.map(integration => (
          <IntegrationCard
            key={integration.id}
            integration={integration}
            onEdit={openEditModal}
            onTest={handleTest}
            onDisable={handleDisableRequest}
            onEnable={handleEnable}
            onDelete={handleDeleteRequest}
            isTesting={testTargetId === integration.id && testMutation.isPending}
            isStatusUpdating={statusTargetId === integration.id && statusMutation.isPending}
            isDeleting={deleteTargetId === integration.id && removeMutation.isPending}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold text-white">Integration Manager</h1>
          <p className="text-sm text-gray-400">
            Connect deployment providers and manage encrypted secrets for your studio workspace.
          </p>
        </div>
        <Button onClick={openCreateModal} size="sm" className="self-start bg-orange-500 hover:bg-orange-600">
          <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
          Add Integration
        </Button>
      </header>

      {content}

      <IntegrationFormDialog
        key={modal?.formKey ?? 'closed'}
        modal={modal}
        onClose={closeModal}
        onCreate={handleCreate}
        onUpdate={handleFormUpdate}
        isSubmitting={Boolean(modal) && modalSubmitting}
        submitError={modalError?.message}
      />

      <AlertDialog open={Boolean(confirmation)} onOpenChange={open => !open && setConfirmation(null)}>
        <AlertDialogContent className="bg-gray-900 border-gray-700">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">
              {confirmation?.type === 'delete' ? 'Delete integration' : 'Disable integration'}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-gray-400">
              {confirmation?.type === 'delete'
                ? `This will permanently remove "${confirmation?.integration.displayName}". Deployments linked to this integration will not be able to run.`
                : `Requests using "${confirmation?.integration.displayName}" will fail until the integration is re-enabled.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-gray-700 text-gray-300 hover:text-white">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmation?.type === 'delete' ? handleDeleteConfirm : handleDisableConfirm}
              className="bg-red-600 hover:bg-red-700"
              disabled={isDeletePending || isDisablePending}
            >
              {(isDeletePending || isDisablePending) && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
              )}
              {confirmation?.type === 'delete' ? 'Delete' : 'Disable'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

interface IntegrationCardProps {
  integration: AccountIntegrationRecord;
  onEdit: (integration: AccountIntegrationRecord) => void;
  onTest: (integration: AccountIntegrationRecord) => void;
  onDisable: (integration: AccountIntegrationRecord) => void;
  onEnable: (integration: AccountIntegrationRecord) => void;
  onDelete: (integration: AccountIntegrationRecord) => void;
  isTesting: boolean;
  isStatusUpdating: boolean;
  isDeleting: boolean;
}

function IntegrationCard({
  integration,
  onEdit,
  onTest,
  onDisable,
  onEnable,
  onDelete,
  isTesting,
  isStatusUpdating,
  isDeleting,
}: IntegrationCardProps) {
  const metadata = getProviderMetadata(integration.provider as IntegrationProviderSlug);
  const nonSecretFields = metadata.fields.filter(field => !field.secret);
  const secretFields = metadata.fields.filter(field => field.secret);
  const providerDisabled = integration.providerDisabled || !isIntegrationProviderEnabled(integration.provider);
  const derivedStatus: IntegrationStatus = providerDisabled && integration.status === 'enabled'
    ? 'disabled'
    : integration.status;
  const badgeLabel = providerDisabled ? 'disabled (env)' : derivedStatus;

  const lastTestedText = integration.lastTestedAt
    ? `Tested ${formatDistanceToNow(new Date(integration.lastTestedAt), { addSuffix: true })}`
    : 'Never tested';

  const updatedText = `Updated ${formatDistanceToNow(new Date(integration.updatedAt), { addSuffix: true })}`;

  return (
    <Card className="flex h-full flex-col border-gray-700 bg-gray-800/60">
      <CardHeader className="space-y-2">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-white">{integration.displayName}</CardTitle>
            <CardDescription className="text-gray-400">
              {INTEGRATION_PROVIDER_METADATA[integration.provider as IntegrationProviderSlug].label}
            </CardDescription>
          </div>
          <Badge variant="outline" className={`${statusClasses[derivedStatus]} capitalize`}>
            {badgeLabel}
          </Badge>
        </div>
        {providerDisabled ? (
          <div className="text-xs text-amber-300">
            Provider disabled by CMS configuration. Re-enable the provider to deploy.
          </div>
        ) : null}
        <div className="flex flex-wrap items-center gap-3 text-xs text-gray-400">
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" aria-hidden="true" />
            {lastTestedText}
          </span>
          <span aria-hidden="true">•</span>
          <span>{updatedText}</span>
        </div>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-4">
        <div className="grid gap-3 text-sm text-gray-300">
          {nonSecretFields.length === 0 ? (
            <p className="text-gray-400">No visible configuration fields.</p>
          ) : (
            nonSecretFields.map(field => {
              const value = integration.config[field.name];
              const displayValue =
                value === null || value === undefined || value === ''
                  ? 'Not set'
                  : typeof value === 'string'
                  ? value
                  : JSON.stringify(value);

              return (
                <div key={field.name} className="flex items-start justify-between gap-3">
                  <span className="text-gray-400">{field.label}</span>
                  <span className="max-w-[260px] break-words text-right">{displayValue}</span>
                </div>
              );
            })
          )}
        </div>

        <div className="space-y-2">
          <span className="text-sm font-medium text-gray-200">Secrets</span>
          {secretFields.length === 0 ? (
            <p className="text-sm text-gray-400">No credential secrets required.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {secretFields.map(field => {
                const present = integration.secretFields[field.name];
                return (
                  <Badge
                    key={field.name}
                    variant="outline"
                    className={
                      present
                        ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400'
                        : 'border-amber-500/20 bg-amber-500/10 text-amber-400'
                    }
                  >
                    {present ? (
                      <Check className="mr-1 h-3 w-3" aria-hidden="true" />
                    ) : (
                      <AlertCircle className="mr-1 h-3 w-3" aria-hidden="true" />
                    )}
                    {field.label}
                  </Badge>
                );
              })}
            </div>
          )}
        </div>

        <div className="mt-auto flex flex-wrap gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => onTest(integration)}
            disabled={isTesting || providerDisabled}
            className="bg-gray-700 text-gray-100 hover:bg-gray-600"
            title={providerDisabled ? 'Provider disabled by configuration' : undefined}
          >
            {isTesting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <TestTube2 className="mr-2 h-4 w-4" aria-hidden="true" />
            )}
            Test connection
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onEdit(integration)}
            className="border-gray-600 text-gray-200 hover:text-white"
          >
            <Pencil className="mr-2 h-4 w-4" aria-hidden="true" />
            Edit
          </Button>
          {derivedStatus === 'disabled' ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onEnable(integration)}
              disabled={isStatusUpdating || providerDisabled}
              className="border-emerald-500/30 text-emerald-400 hover:text-emerald-300"
              title={providerDisabled ? 'Provider disabled by configuration' : undefined}
            >
              {isStatusUpdating ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Check className="mr-2 h-4 w-4" aria-hidden="true" />
              )}
              Enable
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onDisable(integration)}
              disabled={isStatusUpdating}
              className="border-amber-500/30 text-amber-400 hover:text-amber-300"
            >
              {isStatusUpdating ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <ShieldAlert className="mr-2 h-4 w-4" aria-hidden="true" />
              )}
              Disable
            </Button>
          )}
          <Button
            variant="destructive"
            size="sm"
            onClick={() => onDelete(integration)}
            disabled={isDeleting}
          >
            {isDeleting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <Trash2 className="mr-2 h-4 w-4" aria-hidden="true" />
            )}
            Delete
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function IntegrationEmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <Card className="border-gray-700 bg-gray-800/60">
      <CardHeader>
        <CardTitle className="text-white">Connect your first integration</CardTitle>
        <CardDescription className="text-gray-400">
          Deployments and exports resolve credentials server-side once an integration is connected.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-3">
        <Button onClick={onCreate} className="bg-orange-500 hover:bg-orange-600">
          <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
          Add integration
        </Button>
        <Button variant="outline" className="border-gray-600 text-gray-200 hover:text-white" asChild>
          <Link href="/studio/site-builder">Go to deployment workspace</Link>
        </Button>
      </CardContent>
    </Card>
  );
}

function IntegrationListSkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {[0, 1, 2, 3].map(item => (
        <Card key={item} className="border-gray-700 bg-gray-800/60">
          <CardHeader className="space-y-3">
            <Skeleton className="h-6 w-1/2 bg-gray-700" />
            <Skeleton className="h-4 w-1/3 bg-gray-700" />
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Skeleton className="h-4 w-full bg-gray-700" />
              <Skeleton className="h-4 w-2/3 bg-gray-700" />
            </div>
            <div className="flex gap-2">
              <Skeleton className="h-9 w-24 bg-gray-700" />
              <Skeleton className="h-9 w-24 bg-gray-700" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
