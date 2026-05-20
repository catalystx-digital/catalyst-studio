'use client';

import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle2, XCircle, AlertCircle, Clock, Loader2 } from 'lucide-react';

interface SyncStatus {
  status: 'in_progress' | 'completed' | 'failed' | 'pending' | 'idle';
  progress: number;
  currentStep: string;
  totalSteps: number;
  startedAt?: string;
  completedAt?: string;
  estimatedCompletion?: string;
  errors: Array<{
    code: string;
    message: string;
    severity: 'error' | 'warning' | 'info';
    timestamp: string;
  }>;
  validationResults?: {
    passed: boolean;
    errors: number;
    warnings: number;
    details: Array<{
      field: string;
      message: string;
      severity: 'error' | 'warning';
    }>;
  };
}

export function SyncStatusDisplay({ websiteId }: { websiteId?: string }) {
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let active = true;

    const fetchStatus = async (options?: { suppressLoading?: boolean }) => {
      if (!options?.suppressLoading) {
        setLoading(true);
      }

      try {
        const url = websiteId
          ? `/api/sync/status?websiteId=${encodeURIComponent(websiteId)}`
          : '/api/sync/status';
        const response = await fetch(url);
        if (response.ok) {
          const data: SyncStatus = await response.json();
          if (active) {
            setSyncStatus(data);
          }
          return data;
        }
      } catch (error) {
        console.error('Failed to fetch sync status:', error);
      } finally {
        if (!options?.suppressLoading) {
          setLoading(false);
        }
      }

      return null;
    };

    const determineInterval = (status: SyncStatus['status'] | undefined) => {
      if (status === 'in_progress') {
        return 2_000;
      }
      if (status === 'pending' || status === 'idle') {
        return 10_000;
      }
      return null;
    };

    const scheduleNext = (status: SyncStatus['status'] | undefined) => {
      if (!active) {
        return;
      }

      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
        return;
      }

      const interval = determineInterval(status);
      if (!interval) {
        return;
      }

      timeoutId = setTimeout(async () => {
        const nextStatus = await fetchStatus({ suppressLoading: true });
        scheduleNext(nextStatus?.status);
      }, interval);
    };

    const start = async () => {
      const status = await fetchStatus();
      scheduleNext(status?.status);
    };

    const handleVisibility = () => {
      if (!active || typeof document === 'undefined') {
        return;
      }

      if (document.visibilityState === 'hidden') {
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }
        return;
      }

      fetchStatus({ suppressLoading: true }).then((status) => {
        scheduleNext(status?.status);
      });
    };

    start();
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibility);
    }

    return () => {
      active = false;
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', handleVisibility);
      }
    };
  }, [websiteId]);

  const getStatusIcon = () => {
    if (!syncStatus) return null;

    switch (syncStatus.status) {
      case 'completed':
        return <CheckCircle2 className="h-5 w-5 text-green-500" />;
      case 'failed':
        return <XCircle className="h-5 w-5 text-red-500" />;
      case 'in_progress':
        return <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />;
      case 'pending':
        return <Clock className="h-5 w-5 text-yellow-500" />;
      default:
        return <AlertCircle className="h-5 w-5 text-gray-500" />;
    }
  };

  const getStatusBadgeVariant = () => {
    if (!syncStatus) return 'secondary';

    switch (syncStatus.status) {
      case 'completed':
        return 'success';
      case 'failed':
        return 'destructive';
      case 'in_progress':
        return 'default';
      case 'pending':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  const formatTime = (isoString?: string) => {
    if (!isoString) return '--';
    return new Date(isoString).toLocaleTimeString();
  };

  const calculateDuration = () => {
    if (!syncStatus?.startedAt) return '--';
    const start = new Date(syncStatus.startedAt).getTime();
    const end = syncStatus.completedAt ? new Date(syncStatus.completedAt).getTime() : Date.now();
    const duration = Math.floor((end - start) / 1000);
    return `${Math.floor(duration / 60)}m ${duration % 60}s`;
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-6">
          <Loader2 className="h-6 w-6 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  if (!syncStatus) {
    return (
      <Card>
        <CardContent className="p-6">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>No sync status available</AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {getStatusIcon()}
            <CardTitle>Sync Status</CardTitle>
          </div>
          <Badge variant={getStatusBadgeVariant() as any}>
            {syncStatus.status.replace('_', ' ').toUpperCase()}
          </Badge>
        </div>
        <CardDescription>Real-time synchronization status and progress</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {syncStatus.status === 'in_progress' && (
          <>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Progress</span>
                <span>{syncStatus.progress}%</span>
              </div>
              <Progress value={syncStatus.progress} className="h-2" />
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Current Step:</span>
                <p className="font-medium">{syncStatus.currentStep || '--'}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Step:</span>
                <p className="font-medium">
                  {syncStatus.totalSteps > 0
                    ? `${Math.ceil(syncStatus.progress / (100 / syncStatus.totalSteps))} of ${syncStatus.totalSteps}`
                    : '--'}
                </p>
              </div>
            </div>
          </>
        )}

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-muted-foreground">Started:</span>
            <p className="font-medium">{formatTime(syncStatus.startedAt)}</p>
          </div>
          <div>
            <span className="text-muted-foreground">Duration:</span>
            <p className="font-medium">{calculateDuration()}</p>
          </div>
          {syncStatus.estimatedCompletion && (
            <div>
              <span className="text-muted-foreground">Est. Completion:</span>
              <p className="font-medium">{formatTime(syncStatus.estimatedCompletion)}</p>
            </div>
          )}
          {syncStatus.completedAt && (
            <div>
              <span className="text-muted-foreground">Completed:</span>
              <p className="font-medium">{formatTime(syncStatus.completedAt)}</p>
            </div>
          )}
        </div>

        {syncStatus.validationResults && (
          <div className="space-y-2">
            <div className="text-sm font-medium">Validation Results</div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-muted-foreground">Passed:</span>
                <span className="ml-1 font-medium">
                  {syncStatus.validationResults.passed ? 'Yes' : 'No'}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Errors:</span>
                <span className="ml-1 font-medium">{syncStatus.validationResults.errors}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Warnings:</span>
                <span className="ml-1 font-medium">{syncStatus.validationResults.warnings}</span>
              </div>
            </div>
          </div>
        )}

        {syncStatus.errors.length > 0 && (
          <div className="space-y-2">
            <div className="text-sm font-medium">Recent Issues</div>
            <div className="space-y-2">
              {syncStatus.errors.map((error, index) => (
                <Alert key={`${error.code}-${index}`} variant={error.severity === 'error' ? 'destructive' : 'default'}>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <div className="font-medium">{error.message}</div>
                    <div className="text-xs text-muted-foreground">
                      {error.code} — {new Date(error.timestamp).toLocaleTimeString()}
                    </div>
                  </AlertDescription>
                </Alert>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
