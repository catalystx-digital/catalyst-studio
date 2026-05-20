'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { AlertCircle, CheckCircle, Clock, Loader2, XCircle } from 'lucide-react';

import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import type { AccountIntegrationRecord } from '@/lib/studio/types/integration';
import { getProviderMetadata } from '@/lib/studio/integrations/provider-config';
import {
  DeploymentJob,
  DeploymentLog,
  DeploymentStatus,
  LogLevel,
} from '@/lib/deployment/deployment-types';
import { withRetry, createDeploymentRetryOptions } from '@/lib/utils/retry-utils';
import {
  categorizeError,
  getRecoverySuggestions,
  logDeploymentError,
} from '@/lib/deployment/error-handler';

interface DeploymentProgressProps {
  job: DeploymentJob;
  integration: AccountIntegrationRecord;
  onComplete: (job: DeploymentJob) => void;
}

interface RemoteJobPayload {
  id: string;
  websiteId?: string;
  provider?: string;
  status?: DeploymentStatus;
  progress?: number;
  logs?: Array<{ timestamp: string | number | Date; level: LogLevel; message: string }>;
  startedAt?: string;
  completedAt?: string;
  error?: string;
}

const PROGRESS_STEPS = [
  { name: 'Validating configuration', threshold: 0 },
  { name: 'Connecting to CMS', threshold: 25 },
  { name: 'Uploading content', threshold: 50 },
  { name: 'Finalising deployment', threshold: 75 },
] as const;

export function DeploymentProgress({ job, integration, onComplete }: DeploymentProgressProps) {
  const [currentJob, setCurrentJob] = useState<DeploymentJob>(job);
  const [estimatedTime, setEstimatedTime] = useState<number>(45);
  const [elapsedTime, setElapsedTime] = useState<number>(0);
  const pollRef = useRef<NodeJS.Timeout | null>(null);
  const hasStartedRef = useRef(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  const metadata = getProviderMetadata(integration.provider);

  const cleanupPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!hasStartedRef.current && job.status === 'pending') {
      hasStartedRef.current = true;
      void startDeployment();
    }

    return () => {
      cleanupPolling();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job.id]);

  useEffect(() => {
    if (currentJob.status === 'running') {
      const interval = setInterval(() => {
        setElapsedTime(prev => prev + 1);
      }, 1000);
      return () => clearInterval(interval);
    }
    return undefined;
  }, [currentJob.status]);

  useEffect(() => {
    if (!scrollAreaRef.current) {
      return;
    }

    const viewport = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
    if (!viewport) {
      return;
    }

    viewport.scrollTop = viewport.scrollHeight;
  }, [currentJob.logs]);

  const mapRemoteJob = useCallback(
    (payload: RemoteJobPayload, baseJob: DeploymentJob): DeploymentJob => {
      const logEntries: DeploymentLog[] = (payload.logs ?? []).map(entry => ({
        timestamp: entry.timestamp instanceof Date
          ? entry.timestamp
          : new Date(entry.timestamp),
        level: entry.level ?? 'info',
        message: entry.message,
      }));

      return {
        ...baseJob,
        ...payload,
        id: payload.id ?? baseJob.id,
        providerId: (payload.provider as typeof baseJob.providerId) ?? baseJob.providerId,
        logs: logEntries.length ? logEntries : baseJob.logs,
        startedAt: payload.startedAt ? new Date(payload.startedAt) : baseJob.startedAt,
        completedAt: payload.completedAt ? new Date(payload.completedAt) : baseJob.completedAt,
        progress: payload.progress ?? baseJob.progress,
        status: payload.status ?? baseJob.status,
        error: payload.error ?? baseJob.error,
      };
    },
    [],
  );

  const startDeployment = useCallback(async () => {
    try {
      const retryOptions = createDeploymentRetryOptions(message => {
        const retryLog: DeploymentLog = {
          timestamp: new Date(),
          level: 'warning',
          message,
        };
        setCurrentJob(prev => ({ ...prev, logs: [...prev.logs, retryLog] }));
      });

      const startResponse = await withRetry(async () => {
        const response = await fetch('/api/sync/start-deployment', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            websiteId: job.websiteId,
            integrationId: job.integrationId,
            selectedTypes: job.selectedTypes ?? [],
          }),
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        return response.json();
      }, retryOptions);

      if (!startResponse?.success) {
        throw new Error(startResponse?.error || 'Failed to start deployment');
      }

      const deploymentId: string = startResponse.deploymentId ?? job.id;
      const runningJob: DeploymentJob = {
        ...job,
        id: deploymentId,
        status: 'running',
      };
      setCurrentJob(runningJob);
      setEstimatedTime(45 + Math.floor(Math.random() * 30));

      pollRef.current = setInterval(async () => {
        try {
          const response = await fetch(`/api/sync/start-deployment?id=${deploymentId}`);
          if (!response.ok) {
            throw new Error(`Status poll failed with ${response.status}`);
          }

          const payload = await response.json();
          if (!payload.success || !payload.job) {
            return;
          }

          setCurrentJob(prev => mapRemoteJob(payload.job as RemoteJobPayload, prev));

          const terminalStatuses: DeploymentStatus[] = ['completed', 'failed', 'cancelled'];
          if (terminalStatuses.includes(payload.job.status)) {
            cleanupPolling();
            const finalJob = mapRemoteJob(payload.job as RemoteJobPayload, runningJob);
            setCurrentJob(finalJob);
            onComplete(finalJob);
          }
        } catch (pollError) {
          if (process.env.NODE_ENV === 'development') {
          console.error('[DeploymentProgress] Polling failed:', pollError);
          }
        }
      }, 1500);
    } catch (error) {
      cleanupPolling();
      const deploymentError = categorizeError(error);
      logDeploymentError(deploymentError, {
        integrationId: job.integrationId,
        provider: integration.provider,
      });

      const suggestions = getRecoverySuggestions(deploymentError);
      const errorMessage = `${deploymentError.message}${suggestions.length ? ` - ${suggestions[0]}` : ''}`;

      const failedJob: DeploymentJob = {
        ...job,
        status: 'failed',
        error: errorMessage,
        completedAt: new Date(),
        logs: [
          ...job.logs,
          {
            timestamp: new Date(),
            level: 'error',
            message: errorMessage,
          },
        ],
      };

      setCurrentJob(failedJob);
      onComplete(failedJob);
    }
  }, [cleanupPolling, integration.provider, job, mapRemoteJob, onComplete]);

  const handleCancel = useCallback(async () => {
    try {
      cleanupPolling();
      await fetch(`/api/sync/start-deployment?id=${currentJob.id}`, { method: 'DELETE' });
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
      console.warn('[DeploymentProgress] Failed to cancel deployment', error);
      }
    } finally {
      const cancelledJob: DeploymentJob = {
        ...currentJob,
        status: 'cancelled',
        completedAt: new Date(),
        logs: [
          ...currentJob.logs,
          {
            timestamp: new Date(),
            level: 'warning',
            message: 'Deployment cancelled by user',
          },
        ],
      };
      setCurrentJob(cancelledJob);
      onComplete(cancelledJob);
    }
  }, [cleanupPolling, currentJob, onComplete]);

  const remainingTime = Math.max(0, estimatedTime - elapsedTime);
  const providerLabel = integration.displayName || metadata.label;

  const getStatusIcon = () => {
    switch (currentJob.status) {
      case 'running':
        return <Loader2 className="h-5 w-5 animate-spin text-blue-400" />;
      case 'completed':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'failed':
        return <XCircle className="h-5 w-5 text-rose-500" />;
      case 'cancelled':
        return <AlertCircle className="h-5 w-5 text-amber-400" />;
      default:
        return <Clock className="h-5 w-5 text-white/60" />;
    }
  };

  const getStatusText = () => {
    switch (currentJob.status) {
      case 'pending':
        return 'Preparing deployment…';
      case 'running':
        return 'Deployment in progress…';
      case 'completed':
        return 'Deployment completed successfully';
      case 'failed':
        return 'Deployment failed';
      case 'cancelled':
        return 'Deployment cancelled';
      default:
        return 'Deployment status unknown';
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getLogIcon = (level: LogLevel) => {
    switch (level) {
      case 'error':
        return <XCircle className="h-3 w-3 text-rose-400 mt-0.5" />;
      case 'warning':
        return <AlertCircle className="h-3 w-3 text-amber-300 mt-0.5" />;
      default:
        return <CheckCircle className="h-3 w-3 text-emerald-400 mt-0.5" />;
    }
  };

  return (
    <div className="space-y-6" data-testid="deployment-progress">
      <div className="rounded-xl bg-gradient-to-br from-white/5 to-white/10 border border-white/10 p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-sm text-white/60">
              {getStatusIcon()}
              <span>{getStatusText()}</span>
            </div>
            <h3 className="text-xl font-semibold text-white mt-2">Deploying to {providerLabel}</h3>
            <p className="text-white/50 text-sm">
              Estimated time remaining: {formatTime(remainingTime)}
            </p>
          </div>
          <div className="text-right text-sm text-white/50">
            <p>Integration: {integration.displayName || integration.provider}</p>
            <p>Started {currentJob.startedAt.toLocaleTimeString()}</p>
          </div>
        </div>
        <div className="mt-6 space-y-2">
          <div className="flex justify-between text-xs text-white/60">
            <span>Progress</span>
            <span className="font-mono text-white">{Math.round(currentJob.progress)}%</span>
          </div>
          <Progress
            value={currentJob.progress}
            className="h-2.5 bg-white/10"
            indicatorClassName={cn(
              'transition-all duration-500',
              currentJob.status === 'failed' && 'bg-rose-500',
              currentJob.status === 'completed' && 'bg-emerald-500',
              currentJob.status === 'running' && 'bg-gradient-to-r from-[#FF5500] to-[#FF8A4C]'
            )}
          />
        </div>
      </div>

      <div className="space-y-3">
        {PROGRESS_STEPS.map((step, index) => {
          const thresholds = [25, 50, 75, 100];
          const isActive = currentJob.progress >= step.threshold && currentJob.progress < thresholds[index];
          const isComplete = currentJob.progress >= thresholds[index];

          return (
            <motion.div
              key={step.name}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
              className={cn(
                'flex items-center gap-3 rounded-lg border px-4 py-3 text-sm transition-colors',
                isComplete && 'border-emerald-500/40 bg-emerald-500/10 text-emerald-100',
                isActive && 'border-white/20 bg-white/10 text-white',
                !isActive && !isComplete && 'border-white/10 bg-black/20 text-white/50',
              )}
            >
              {isComplete ? (
                <CheckCircle className="h-4 w-4" />
              ) : isActive ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <span className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-white/30 text-[10px]">
                  {index + 1}
                </span>
              )}
              <span>{step.name}</span>
            </motion.div>
          );
        })}
      </div>

      <div className="rounded-xl bg-black/40 border border-white/10 p-4">
        <h4 className="text-sm font-semibold text-white mb-3">Deployment logs</h4>
        <ScrollArea ref={scrollAreaRef} className="h-48" data-testid="deployment-logs">
          <div className="space-y-1">
            {currentJob.logs.map((log, index) => (
              <motion.div
                key={`${log.timestamp.toString()}-${index}`}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-start gap-2 text-xs"
              >
                {getLogIcon(log.level)}
                <span className="font-mono text-white/40">
                  {new Date(log.timestamp).toLocaleTimeString()}
                </span>
                <span className={cn(
                  'flex-1',
                  log.level === 'error' && 'text-rose-400',
                  log.level === 'warning' && 'text-amber-300',
                  log.level === 'info' && 'text-white/70'
                )}>
                  {log.message}
                </span>
              </motion.div>
            ))}
            {!currentJob.logs.length && (
              <p className="text-center text-xs text-white/40">Waiting for deployment activity…</p>
            )}
          </div>
        </ScrollArea>
      </div>

      {currentJob.status === 'running' && (
        <div className="flex justify-center">
          <Button
            variant="outline"
            onClick={handleCancel}
            className="bg-white/5 border-white/10 text-white hover:bg-white/10"
          >
            Cancel deployment
          </Button>
        </div>
      )}

      {currentJob.status === 'failed' && currentJob.error && (
        <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-4">
          <div className="flex items-start gap-2">
            <XCircle className="h-5 w-5 text-rose-400" />
            <div>
              <p className="font-semibold text-rose-300">Deployment error</p>
              <p className="text-sm text-rose-200/80 mt-1">{currentJob.error}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
