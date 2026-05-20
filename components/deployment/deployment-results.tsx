'use client';

import React from 'react';
import { motion } from 'framer-motion';
import {
  CheckCircle,
  XCircle,
  AlertCircle,
  Clock,
  FileText,
  ExternalLink,
  Download,
  RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import {
  DeploymentJob,
  DeploymentMetrics,
  CMSProvider,
} from '@/lib/deployment/deployment-types';

interface DeploymentResultsProps {
  job: DeploymentJob;
  provider: CMSProvider;
  metrics?: DeploymentMetrics;
  onRetry?: () => void;
  onViewDetails?: () => void;
  onExportLogs?: () => void;
}

export function DeploymentResults({
  job,
  provider,
  metrics,
  onRetry,
  onViewDetails,
  onExportLogs,
}: DeploymentResultsProps) {
  const getDuration = () => {
    if (!job.completedAt) return 'N/A';
    const durationMs = new Date(job.completedAt).getTime() - new Date(job.startedAt).getTime();
    const seconds = Math.floor(durationMs / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return minutes > 0 
      ? `${minutes}m ${remainingSeconds}s`
      : `${seconds}s`;
  };

  const getStatusIcon = () => {
    switch (job.status) {
      case 'completed':
        return <CheckCircle className="h-8 w-8 text-green-500" />;
      case 'failed':
        return <XCircle className="h-8 w-8 text-red-500" />;
      case 'cancelled':
        return <AlertCircle className="h-8 w-8 text-yellow-500" />;
      default:
        return <Clock className="h-8 w-8 text-gray-400" />;
    }
  };

  const getStatusText = () => {
    switch (job.status) {
      case 'completed':
        return 'Deployment Successful';
      case 'failed':
        return 'Deployment Failed';
      case 'cancelled':
        return 'Deployment Cancelled';
      default:
        return 'Unknown Status';
    }
  };

  const getStatusColor = () => {
    switch (job.status) {
      case 'completed':
        return 'text-green-500';
      case 'failed':
        return 'text-red-500';
      case 'cancelled':
        return 'text-yellow-500';
      default:
        return 'text-gray-400';
    }
  };

  const mockUrl = `https://${provider.id}-preview.example.com/deployment/${job.id}`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="space-y-6"
    >
      {/* Status Header */}
      <div className="text-center">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 15 }}
          className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-white/5 to-white/10 backdrop-blur-md mb-4"
        >
          {getStatusIcon()}
        </motion.div>
        
        <h2 className={cn('text-2xl font-bold mb-2', getStatusColor())}>
          {getStatusText()}
        </h2>
        
        <p className="text-white/60">
          Deployment to {provider.name} {job.status === 'completed' ? 'completed' : 'ended'}
        </p>
      </div>

      {/* Deployment Summary Card */}
      <Card className="bg-gradient-to-br from-white/5 to-white/10 backdrop-blur-md border-white/10">
        <CardHeader>
          <CardTitle className="text-white">Deployment Summary</CardTitle>
          <CardDescription className="text-white/60">
            Details about your deployment
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Basic Info */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-white/60 mb-1">Deployment ID</p>
              <p className="font-mono text-sm text-white">{job.id}</p>
            </div>
            <div>
              <p className="text-sm text-white/60 mb-1">Provider</p>
              <p className="text-white">{provider.name}</p>
            </div>
            <div>
              <p className="text-sm text-white/60 mb-1">Started At</p>
              <p className="text-white">{job.startedAt.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-sm text-white/60 mb-1">Duration</p>
              <p className="text-white">{getDuration()}</p>
            </div>
          </div>

          {/* Metrics (if available) */}
          {metrics && job.status === 'completed' && (
            <div className="pt-4 border-t border-white/10">
              <h4 className="text-sm font-semibold text-white mb-3">Performance Metrics</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-white/60 mb-1">Content Items</p>
                  <p className="text-2xl font-bold text-white">
                    {metrics.contentItemsProcessed}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-white/60 mb-1">Success Rate</p>
                  <p className="text-2xl font-bold text-green-400">
                    {(metrics.successRate * 100).toFixed(1)}%
                  </p>
                </div>
                <div>
                  <p className="text-sm text-white/60 mb-1">Data Transferred</p>
                  <p className="text-white">
                    {(metrics.bytesTransferred / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
                <div>
                  <p className="text-sm text-white/60 mb-1">Avg. Processing Time</p>
                  <p className="text-white">
                    {(metrics.timeTaken / metrics.contentItemsProcessed).toFixed(2)}s per item
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Error Details (if failed) */}
          {job.status === 'failed' && job.error && (
            <div className="pt-4 border-t border-white/10">
              <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/30">
                <div className="flex items-start gap-2">
                  <XCircle className="h-5 w-5 text-red-400 mt-0.5" />
                  <div>
                    <p className="text-red-400 font-semibold mb-1">Error Details</p>
                    <p className="text-red-400/80 text-sm">{job.error}</p>
                    {job.retryCount !== undefined && job.maxRetries !== undefined && (
                      <p className="text-red-400/60 text-xs mt-2">
                        Failed after {job.retryCount} retry attempts
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Deployed URL (if successful) */}
          {job.status === 'completed' && (
            <div className="pt-4 border-t border-white/10">
              <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/30">
                <div className="flex items-start gap-2">
                  <CheckCircle className="h-5 w-5 text-green-400 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-green-400 font-semibold mb-1">Deployment URL</p>
                    <a
                      href={mockUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-green-400/80 text-sm hover:text-green-300 inline-flex items-center gap-1"
                    >
                      {mockUrl}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex flex-wrap gap-3 justify-center">
        {job.status === 'completed' && (
          <>
            <Button
              onClick={() => window.open(mockUrl, '_blank')}
              className="bg-[#FF5500] text-white hover:bg-[#FF5500]/80"
            >
              <ExternalLink className="mr-2 h-4 w-4" />
              View Deployed Content
            </Button>
            <Button
              variant="outline"
              onClick={onViewDetails}
              className="bg-white/5 border-white/10 text-white hover:bg-white/10"
            >
              <FileText className="mr-2 h-4 w-4" />
              View Details
            </Button>
          </>
        )}
        
        {job.status === 'failed' && onRetry && (
          <Button
            onClick={onRetry}
            className="bg-[#FF5500] text-white hover:bg-[#FF5500]/80"
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Retry Deployment
          </Button>
        )}
        
        <Button
          variant="outline"
          onClick={onExportLogs}
          className="bg-white/5 border-white/10 text-white hover:bg-white/10"
        >
          <Download className="mr-2 h-4 w-4" />
          Export Logs
        </Button>
      </div>

      {/* Deployment Logs Summary */}
      <Card className="bg-black/30 border-white/10">
        <CardHeader>
          <CardTitle className="text-white text-sm">Recent Logs</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {job.logs.slice(-5).map((log, index) => (
              <div key={index} className="flex items-start gap-2 text-xs">
                {log.level === 'error' ? (
                  <XCircle className="h-3 w-3 text-red-400 mt-0.5" />
                ) : log.level === 'warning' ? (
                  <AlertCircle className="h-3 w-3 text-yellow-400 mt-0.5" />
                ) : (
                  <CheckCircle className="h-3 w-3 text-green-400 mt-0.5" />
                )}
                <span className="text-white/40 font-mono">
                  {log.timestamp.toLocaleTimeString()}
                </span>
                <span className={cn(
                  'flex-1',
                  log.level === 'error' ? 'text-red-400' :
                  log.level === 'warning' ? 'text-yellow-400' :
                  'text-white/60'
                )}>
                  {log.message}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}