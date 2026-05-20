'use client';

import React, { useCallback, useMemo, useState } from 'react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { AlertCircle, CheckCircle2, ChevronRight, Loader2, RefreshCw } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { cn } from '@/lib/utils';
import type { AccountIntegrationRecord, UpdateIntegrationRequest } from '@/lib/studio/types/integration';
import { IntegrationSelector } from '@/lib/studio/components/deployment/integration-selector';
import {
  IntegrationFormDialog,
  type IntegrationFormDialogState,
} from '@/lib/studio/components/integrations/integration-form-dialog';
import { ENABLED_PROVIDER_SLUGS, FALLBACK_PROVIDER } from '@/lib/studio/components/integrations/integration-form-helpers';
import type { IntegrationProviderSlug } from '@/lib/studio/integrations/provider-config';
import { useCreateIntegration, useUpdateIntegration, useTestIntegration, useRemoveIntegration } from '@/lib/studio/hooks/use-account-integrations';
import { DeploymentProgress } from '@/lib/studio/components/deployment/deployment-progress';
import { ContentMapping } from '@/components/deployment/content-mapping';
import type { DeploymentJob, DeploymentMetrics } from '@/lib/deployment/deployment-types';

interface DeploymentWizardProps {
  websiteId?: string;
  onComplete?: (job: DeploymentJob) => void;
  onCancel?: () => void;
}

type WizardStep = 'integration' | 'mapping' | 'deploying' | 'complete';

interface ContentType {
  id: string;
}

const STEPS: Array<{ id: WizardStep; label: string; description: string }> = [
  { id: 'integration', label: 'Select Integration', description: 'Choose a connected CMS integration' },
  { id: 'mapping', label: 'Content Mapping', description: 'Review content types before syncing' },
  { id: 'deploying', label: 'Deployment', description: 'Track deployment progress' },
  { id: 'complete', label: 'Complete', description: 'Review deployment outcome' },
];

export function DeploymentWizard({ websiteId = '', onComplete, onCancel }: DeploymentWizardProps) {
  const [currentStep, setCurrentStep] = useState<WizardStep>('integration');
  const [selectedIntegration, setSelectedIntegration] = useState<AccountIntegrationRecord | null>(null);
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [deploymentJob, setDeploymentJob] = useState<DeploymentJob | null>(null);
  const [lastJob, setLastJob] = useState<DeploymentJob | null>(null);
  const [metrics, setMetrics] = useState<DeploymentMetrics | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [createModal, setCreateModal] = useState<IntegrationFormDialogState>(null);
  const [createError, setCreateError] = useState<string | undefined>();
  const [testingIntegrationId, setTestingIntegrationId] = useState<string | null>(null);
  const [deletingIntegrationId, setDeletingIntegrationId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AccountIntegrationRecord | null>(null);

  const createIntegration = useCreateIntegration();
  const updateIntegration = useUpdateIntegration();
  const testIntegration = useTestIntegration();
  const removeIntegration = useRemoveIntegration();
  const isIntegrationModalSubmitting =
    createModal?.mode === 'edit' ? updateIntegration.isPending : createIntegration.isPending;

  const currentStepIndex = useMemo(() => STEPS.findIndex(step => step.id === currentStep), [currentStep]);
  const manageIntegrationsHref = useMemo(() => {
    const params = new URLSearchParams({ from: 'deployment' });
    if (websiteId) {
      params.set('websiteId', websiteId);
    }
    return `/studio/settings?${params.toString()}`;
  }, [websiteId]);


  const handleIntegrationSelect = useCallback((integration: AccountIntegrationRecord) => {
    if (integration.providerDisabled) {
      setSelectedIntegration(null);
      setErrorMessage('This integration is disabled by configuration. Choose another provider.');
      return;
    }

    setSelectedIntegration(integration);
    setErrorMessage(null);
  }, []);

  const handleEditIntegration = useCallback((integration: AccountIntegrationRecord) => {
    setCreateError(undefined);
    setCreateModal({ mode: 'edit', integration, formKey: Date.now() });
  }, []);

  const handleOpenCreateModal = useCallback(() => {
    if (ENABLED_PROVIDER_SLUGS.length === 0) {
      setErrorMessage('No deployment providers are enabled. Update your environment configuration.');
      return;
    }

    const provider = ENABLED_PROVIDER_SLUGS[0] ?? FALLBACK_PROVIDER;
    setCreateError(undefined);
    setCreateModal({ mode: 'create', provider, formKey: Date.now() });
  }, [setErrorMessage]);

  const handleCloseCreateModal = useCallback(() => {
    if (createIntegration.isPending || updateIntegration.isPending) {
      return;
    }

    setCreateModal(null);
    setCreateError(undefined);
    createIntegration.reset();
    updateIntegration.reset();
  }, [createIntegration, updateIntegration]);

  const handleCreateIntegration = useCallback((input: { provider: IntegrationProviderSlug; displayName: string; config: Record<string, unknown> }) => {
    setCreateError(undefined);
    createIntegration.mutate(input, {
      onSuccess: integration => {
        setSelectedIntegration(integration);
        setErrorMessage(null);
        setCreateModal(null);
        toast.success(`Integration "${integration.displayName}" connected`);
      },
      onError: err => {
        const message = err instanceof Error ? err.message : 'Failed to create integration';
        setCreateError(message);
        toast.error(message);
      },
    });
  }, [createIntegration, setErrorMessage]);

  const handleUpdateIntegration = useCallback((input: { id: string; displayName: string; config: Record<string, unknown> }) => {
    setCreateError(undefined);

    const payload: UpdateIntegrationRequest = {};
    const trimmedName = input.displayName.trim();

    if (trimmedName) {
      payload.displayName = trimmedName;
    }

    if (Object.keys(input.config).length > 0) {
      payload.config = input.config;
    }

    updateIntegration.mutate(
      { id: input.id, payload },
      {
        onSuccess: result => {
          if (selectedIntegration?.id === result.id) {
            setSelectedIntegration(result);
          }
          setErrorMessage(null);
          setCreateModal(null);
          toast.success(`Integration "${result.displayName}" updated`);
        },
        onError: err => {
          const message = err instanceof Error ? err.message : 'Failed to update integration';
          setCreateError(message);
          toast.error(message);
        },
      },
    );
  }, [selectedIntegration, updateIntegration]);

  const handleTestIntegration = useCallback((integration: AccountIntegrationRecord) => {
    setTestingIntegrationId(integration.id);

    testIntegration.mutate(integration.id, {
      onSuccess: result => {
        const message = typeof result?.message === 'string' ? result.message : 'Connection test succeeded';
        toast.success(message);
      },
      onError: err => {
        const message = err instanceof Error ? err.message : 'Failed to test integration';
        toast.error(message);
      },
      onSettled: () => {
        setTestingIntegrationId(null);
      },
    });
  }, [testIntegration]);

  const handleDeleteIntegrationRequest = useCallback((integration: AccountIntegrationRecord) => {
    setDeleteTarget(integration);
  }, []);

  const handleCancelDeleteIntegration = useCallback(() => {
    if (deletingIntegrationId) {
      return;
    }
    setDeleteTarget(null);
  }, [deletingIntegrationId]);

  const handleConfirmDeleteIntegration = useCallback(() => {
    if (!deleteTarget) {
      return;
    }

    setDeletingIntegrationId(deleteTarget.id);
    removeIntegration.mutate(
      { id: deleteTarget.id, options: { hardDelete: true } },
      {
        onSuccess: () => {
          toast.success(`Integration "${deleteTarget.displayName}" deleted`);
          if (selectedIntegration?.id === deleteTarget.id) {
            setSelectedIntegration(null);
          }
        },
        onError: err => {
          const message = err instanceof Error ? err.message : 'Failed to delete integration';
          toast.error(message);
        },
        onSettled: () => {
          setDeletingIntegrationId(null);
          setDeleteTarget(null);
        },
      },
    );
  }, [deleteTarget, removeIntegration, selectedIntegration]);

  const handleMappingComplete = useCallback((types: ContentType[]) => {
    setSelectedTypes(types.map(type => type.id));
  }, []);

  const handleDeploymentComplete = useCallback((job: DeploymentJob) => {
    setLastJob(job);
    setDeploymentJob(job);

    if (job.status === 'completed') {
      const durationSeconds = job.completedAt && job.startedAt
        ? Math.max(1, Math.round((job.completedAt.getTime() - job.startedAt.getTime()) / 1000))
        : undefined;

      setMetrics({
        timeTaken: durationSeconds ?? 0,
        contentItemsProcessed: job.selectedTypes?.length ?? 0,
        bytesTransferred: 0,
        successRate: 1,
      });
      setErrorMessage(null);
      setCurrentStep('complete');
      onComplete?.(job);
    } else if (job.status === 'failed' || job.status === 'cancelled') {
      setErrorMessage(job.error ?? 'Deployment did not complete');
      setCurrentStep('complete');
    }
  }, [onComplete]);

  const moveToStep = useCallback((step: WizardStep) => {
    setCurrentStep(step);
  }, []);

  const goToNextStep = useCallback(() => {
    const nextIndex = Math.min(currentStepIndex + 1, STEPS.length - 1);
    moveToStep(STEPS[nextIndex].id);
  }, [currentStepIndex, moveToStep]);

  const handleAdvanceFromIntegration = useCallback(() => {
    if (!selectedIntegration) {
      setErrorMessage('Select an integration before continuing.');
      return;
    }

    if (selectedIntegration.providerDisabled) {
      setErrorMessage('The selected integration is disabled. Choose another provider.');
      return;
    }

    moveToStep('mapping');
  }, [moveToStep, selectedIntegration]);

  const handleAdvanceFromMapping = useCallback(() => {
    if (!selectedIntegration) {
      setErrorMessage('Select an integration before deploying.');
      moveToStep('integration');
      return;
    }

    if (selectedIntegration.providerDisabled) {
      setErrorMessage('The selected integration is no longer available. Return to integration selection.');
      moveToStep('integration');
      return;
    }

    const newJob: DeploymentJob = {
      id: `temp-${Date.now()}`,
      providerId: selectedIntegration.provider as DeploymentJob['providerId'],
      integrationId: selectedIntegration.id,
      integrationDisplayName: selectedIntegration.displayName,
      providerDisplayName: selectedIntegration.displayName,
      websiteId,
      selectedTypes,
      status: 'pending',
      progress: 0,
      startedAt: new Date(),
      logs: [],
    };

    setDeploymentJob(newJob);
    setErrorMessage(null);
    moveToStep('deploying');
  }, [moveToStep, selectedIntegration, selectedTypes, websiteId]);

  const handleRestart = useCallback(() => {
    setSelectedTypes([]);
    setDeploymentJob(null);
    setLastJob(null);
    setMetrics(null);
    setErrorMessage(null);
    moveToStep('integration');
  }, [moveToStep]);

  return (
    <div className="space-y-8" data-testid="deployment-wizard">
      <div className="grid gap-4 md:grid-cols-4">
        {STEPS.map((step, index) => {
          const isActive = index === currentStepIndex;
          const isComplete = index < currentStepIndex;

          return (
            <motion.div
              key={step.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className={cn(
                'rounded-xl border bg-white/5 p-4 text-white transition-colors',
                isActive && 'border-[#FF5500] bg-[#FF5500]/10 shadow-lg',
                isComplete && 'border-emerald-500/60 bg-emerald-500/10',
                !isActive && !isComplete && 'border-white/10',
              )}
            >
              <div className="flex items-center gap-2 text-sm font-semibold">
                {isComplete ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                ) : (
                  <span className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-white/40 text-[10px]">
                    {index + 1}
                  </span>
                )}
                {step.label}
              </div>
              <p className="mt-2 text-xs text-white/60">{step.description}</p>
            </motion.div>
          );
        })}
      </div>

      {errorMessage && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      )}

      {currentStep === 'integration' && (
        <div className="space-y-4">
          <IntegrationSelector
            selectedIntegrationId={selectedIntegration?.id}
            onSelect={handleIntegrationSelect}
            manageHref={manageIntegrationsHref}
            onCreateIntegration={handleOpenCreateModal}
            onEditIntegration={handleEditIntegration}
            onTestIntegration={handleTestIntegration}
            onDeleteIntegration={handleDeleteIntegrationRequest}
            testingIntegrationId={testingIntegrationId}
            deletingIntegrationId={deletingIntegrationId}
          />
        </div>
      )}

      {currentStep === 'mapping' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-semibold text-white">Content mapping</h2>
              <p className="text-white/60 text-sm mt-2">
                Review the content types that will be deployed to {selectedIntegration?.displayName || selectedIntegration?.provider}.
              </p>
            </div>
            <div className="text-sm text-white/50">
              Selected integration: <span className="text-white font-medium">{selectedIntegration?.displayName}</span>
            </div>
          </div>
          <ContentMapping
            providerId={selectedIntegration?.provider ?? 'mock'}
            websiteId={websiteId}
            onMappingComplete={handleMappingComplete}
          />
        </div>
      )}

      {currentStep === 'deploying' && deploymentJob && selectedIntegration && (
        <DeploymentProgress
          job={deploymentJob}
          integration={selectedIntegration}
          onComplete={handleDeploymentComplete}
        />
      )}

      {currentStep === 'complete' && lastJob && (
        <div className="rounded-xl border border-white/10 bg-white/5 p-6 text-white">
          <div className="flex items-center gap-3">
            {lastJob.status === 'completed' ? (
              <CheckCircle2 className="h-6 w-6 text-emerald-400" />
            ) : lastJob.status === 'failed' ? (
              <AlertCircle className="h-6 w-6 text-rose-400" />
            ) : (
              <Loader2 className="h-6 w-6 text-white/60" />
            )}
            <div>
              <h2 className="text-xl font-semibold">
                {lastJob.status === 'completed' ? 'Deployment successful' : 'Deployment finished with issues'}
              </h2>
              <p className="text-sm text-white/60">Integration: {selectedIntegration?.displayName}</p>
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <div className="rounded-lg border border-white/10 bg-black/20 p-4">
              <p className="text-xs uppercase tracking-wide text-white/40">Deployment ID</p>
              <p className="mt-1 font-mono text-sm text-white/80">{lastJob.id}</p>
            </div>
            <div className="rounded-lg border border-white/10 bg-black/20 p-4">
              <p className="text-xs uppercase tracking-wide text-white/40">Status</p>
              <p className="mt-1 text-sm font-semibold">
                {lastJob.status.charAt(0).toUpperCase() + lastJob.status.slice(1)}
              </p>
            </div>
            <div className="rounded-lg border border-white/10 bg-black/20 p-4">
              <p className="text-xs uppercase tracking-wide text-white/40">Duration</p>
              <p className="mt-1 text-sm">
                {metrics?.timeTaken
                  ? `${Math.floor(metrics.timeTaken / 60)}m ${(metrics.timeTaken % 60).toString().padStart(2, '0')}s`
                  : '-'}
              </p>
            </div>
            <div className="rounded-lg border border-white/10 bg-black/20 p-4">
              <p className="text-xs uppercase tracking-wide text-white/40">Content types</p>
              <p className="mt-1 text-sm">{lastJob.selectedTypes?.length ?? 0}</p>
            </div>
          </div>

          {lastJob.error && (
            <div className="mt-6 rounded-lg border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200">
              {lastJob.error}
            </div>
          )}
        </div>
      )}

      <div className="flex justify-between">
        <Button
          variant="outline"
          onClick={() => {
            if (currentStep === 'integration') {
              onCancel?.();
            } else {
              const prevIndex = Math.max(currentStepIndex - 1, 0);
              moveToStep(STEPS[prevIndex].id);
            }
          }}
          disabled={currentStep === 'deploying'}
          className="bg-white/5 border-white/10 text-white hover:bg-white/10"
        >
          {currentStep === 'integration' ? 'Cancel' : 'Previous'}
        </Button>

        {currentStep === 'integration' && (
          <Button
            onClick={handleAdvanceFromIntegration}
            disabled={!selectedIntegration}
            className="bg-[#FF5500] text-white hover:bg-[#FF5500]/80"
          >
            Next
            <ChevronRight className="ml-2 h-4 w-4" />
          </Button>
        )}

        {currentStep === 'mapping' && (
          <Button
            onClick={handleAdvanceFromMapping}
            disabled={!selectedIntegration}
            className="bg-[#FF5500] text-white hover:bg-[#FF5500]/80"
          >
            Start deployment
            <ChevronRight className="ml-2 h-4 w-4" />
          </Button>
        )}

        {currentStep === 'complete' && (
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={handleRestart}
              className="bg-white/5 border-white/10 text-white hover:bg-white/10"
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Deploy again
            </Button>
            <Button
              className="bg-[#FF5500] text-white hover:bg-[#FF5500]/80"
              onClick={() => {
                if (lastJob) {
                  onComplete?.(lastJob);
                }
                onCancel?.();
              }}
            >
              Close
            </Button>
          </div>
        )}

        {currentStep === 'deploying' && (
          <div className="h-10" />
        )}
      </div>
      <IntegrationFormDialog
        modal={createModal}
        onClose={handleCloseCreateModal}
        onCreate={handleCreateIntegration}
        onUpdate={handleUpdateIntegration}
        isSubmitting={isIntegrationModalSubmitting}
        submitError={createError}
      />
      <AlertDialog
        open={Boolean(deleteTarget)}
        onOpenChange={open => {
          if (!open) {
            handleCancelDeleteIntegration();
          }
        }}
      >
        <AlertDialogContent className="border border-white/10 bg-black/90 text-white">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete integration</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove {deleteTarget?.displayName ?? 'this integration'} and its stored credentials.
              Deployments referencing it will need a new connection.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={handleCancelDeleteIntegration}
              disabled={Boolean(deletingIntegrationId)}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDeleteIntegration}
              disabled={Boolean(deletingIntegrationId)}
              className="bg-rose-600 hover:bg-rose-500 text-white"
            >
              {deletingIntegrationId ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
              ) : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>

  );
}
