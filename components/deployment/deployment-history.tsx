'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CheckCircle,
  XCircle,
  AlertCircle,
  Clock,
  MoreVertical,
  RefreshCw,
  Download,
  Trash2,
  ExternalLink,
  GitMerge,
  BarChart3,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  DeploymentJob,
  CMSProviderId,
} from '@/lib/deployment/deployment-types';
import { CMS_PROVIDERS } from '@/lib/deployment/cms-providers';

interface DeploymentHistoryProps {
  onRedeploy?: (job: DeploymentJob) => void;
  onViewSyncAnalytics?: (deploymentId: string) => void;
  className?: string;
}

export function DeploymentHistory({ onRedeploy, onViewSyncAnalytics, className }: DeploymentHistoryProps) {
  const [history, setHistory] = useState<DeploymentJob[]>([]);
  const [selectedJob, setSelectedJob] = useState<DeploymentJob | null>(null);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [syncRecords, setSyncRecords] = useState<Record<string, any>>({});

  useEffect(() => {
    loadHistory();
    
    // Also refresh on visibility change (when switching tabs)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        loadHistory();
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // Refresh periodically while visible
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        loadHistory();
      }
    }, 5000);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      clearInterval(interval);
    };
  }, []);

  const loadHistory = async () => {
    try {
      // Fetch real deployment history from API
      const response = await fetch('/api/sync/history');
      if (!response.ok) {
        console.error('Failed to load deployment history');
        setHistory([]);
        return;
      }
      
      const data = await response.json();
      const items = data.items || [];
      
      // Transform API response to DeploymentJob format
      const deploymentHistory: DeploymentJob[] = items.map((item: any) => ({
        id: item.id,
        providerId: (item.author as CMSProviderId) || 'mock',
        status: item.changeSource === 'SYNC' && item.description?.includes('completed') ? 'completed' : 
                item.description?.includes('failed') ? 'failed' : 'pending',
        progress: 100,
        startedAt: new Date(item.createdAt),
        completedAt: new Date(item.createdAt),
        config: {
          selectedTypes: []
        },
        result: {
          totalTypes: item.changes.added + item.changes.modified,
          created: item.changes.added,
          updated: item.changes.modified,
          skipped: 0,
          errors: []
        },
        logs: [] // Add empty logs array to prevent errors
      }));
      
      setHistory(deploymentHistory);
      
      // Load analytics data
      const analyticsResponse = await fetch('/api/sync/analytics');
      if (analyticsResponse.ok) {
        const analytics = await analyticsResponse.json();
        setSyncRecords({ global: analytics });
      }
    } catch (error) {
      console.error('Failed to load deployment history:', error);
      setHistory([]);
    }
  };

  const handleExportLogs = (job: DeploymentJob) => {
    const logs = job.logs?.map(log => 
      `[${log.timestamp.toISOString()}] [${log.level.toUpperCase()}] ${log.message}`
    ).join('\n') || 'No logs available';
    
    const blob = new Blob([logs], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `deployment-${job.id}-logs.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleClearHistory = () => {
    setHistory([]);
  };

  const getStatusIcon = (status: DeploymentJob['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'cancelled':
        return <AlertCircle className="h-4 w-4 text-yellow-500" />;
      case 'running':
        return <Clock className="h-4 w-4 text-blue-500 animate-pulse" />;
      default:
        return <Clock className="h-4 w-4 text-gray-400" />;
    }
  };

  const getStatusBadge = (status: DeploymentJob['status']) => {
    const variants: Record<DeploymentJob['status'], string> = {
      completed: 'bg-green-500/20 text-green-400 border-green-500/30',
      failed: 'bg-red-500/20 text-red-400 border-red-500/30',
      cancelled: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
      running: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
      pending: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
    };
    
    return (
      <Badge variant="outline" className={cn('capitalize', variants[status])}>
        {status}
      </Badge>
    );
  };

  const getDuration = (job: DeploymentJob) => {
    if (!job.completedAt) return 'In progress';
    const durationMs = new Date(job.completedAt).getTime() - new Date(job.startedAt).getTime();
    const seconds = Math.floor(durationMs / 1000);
    return `${seconds}s`;
  };

  const getProviderName = (providerId: CMSProviderId) => {
    return CMS_PROVIDERS[providerId]?.name || providerId;
  };

  return (
    <>
      <div className={cn('space-y-4', className)}>
        {/* Header */}
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white">Deployment History</h3>
          {history.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleClearHistory}
              className="bg-white/5 border-white/10 text-white hover:bg-white/10"
            >
              <Trash2 className="mr-2 h-3 w-3" />
              Clear History
            </Button>
          )}
        </div>

        {/* History List */}
        <ScrollArea className="h-[400px]">
          {history.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-white/40">
              <Clock className="h-8 w-8 mb-2" />
              <p>No deployment history yet</p>
            </div>
          ) : (
            <div className="space-y-2">
              <AnimatePresence>
                {history.map((job, index) => (
                  <motion.div
                    key={`${job.id}-${index}`}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    transition={{ delay: index * 0.05 }}
                    className="p-4 rounded-lg bg-gradient-to-br from-white/5 to-white/10 backdrop-blur-md border border-white/10 hover:border-white/20 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        {getStatusIcon(job.status)}
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-white">
                              {getProviderName(job.providerId)}
                            </span>
                            {getStatusBadge(job.status)}
                            {job.retryCount !== undefined && job.retryCount > 0 && (
                              <Badge variant="outline" className="bg-orange-500/20 text-orange-400 border-orange-500/30">
                                Retry {job.retryCount}
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-4 text-xs text-white/60">
                            <span>{job.startedAt.toLocaleString()}</span>
                            <span>•</span>
                            <span>{getDuration(job)}</span>
                            <span>•</span>
                            <span className="font-mono">{job.id.slice(0, 8)}...</span>
                            {syncRecords[job.id] && (
                              <>
                                <span>•</span>
                                <span className="flex items-center gap-1">
                                  <GitMerge className="h-3 w-3" />
                                  Synced
                                </span>
                              </>
                            )}
                          </div>
                          {job.error && (
                            <p className="text-xs text-red-400 mt-1">
                              {job.error}
                            </p>
                          )}
                        </div>
                      </div>
                      
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 text-white/60 hover:text-white"
                          >
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="bg-[#212121]/95 backdrop-blur-xl border-white/10">
                          <DropdownMenuItem
                            onClick={() => {
                              setSelectedJob(job);
                              setDetailsModalOpen(true);
                            }}
                            className="text-white hover:bg-white/10"
                          >
                            View Details
                          </DropdownMenuItem>
                          {job.status === 'completed' && (
                            <DropdownMenuItem
                              onClick={() => onRedeploy?.(job)}
                              className="text-white hover:bg-white/10"
                            >
                              <RefreshCw className="mr-2 h-4 w-4" />
                              Re-deploy
                            </DropdownMenuItem>
                          )}
                          {job.status === 'failed' && (
                            <DropdownMenuItem
                              onClick={() => onRedeploy?.(job)}
                              className="text-white hover:bg-white/10"
                            >
                              <RefreshCw className="mr-2 h-4 w-4" />
                              Retry
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem
                            onClick={() => handleExportLogs(job)}
                            className="text-white hover:bg-white/10"
                          >
                            <Download className="mr-2 h-4 w-4" />
                            Export Logs
                          </DropdownMenuItem>
                          {syncRecords[job.id] && (
                            <DropdownMenuItem
                              onClick={() => onViewSyncAnalytics?.(job.id)}
                              className="text-white hover:bg-white/10"
                            >
                              <BarChart3 className="mr-2 h-4 w-4" />
                              View Sync Analytics
                            </DropdownMenuItem>
                          )}
                          {job.status === 'completed' && (
                            <DropdownMenuItem
                              onClick={() => window.open(`https://${job.providerId}-preview.example.com/deployment/${job.id}`, '_blank')}
                              className="text-white hover:bg-white/10"
                            >
                              <ExternalLink className="mr-2 h-4 w-4" />
                              View Deployed
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Details Modal */}
      <AnimatePresence>
        {detailsModalOpen && selectedJob && (
          <Dialog open={detailsModalOpen} onOpenChange={setDetailsModalOpen}>
            <DialogContent className="sm:max-w-[600px] bg-[#212121]/95 backdrop-blur-xl border-white/10">
              <DialogHeader>
                <DialogTitle className="text-white">
                  Deployment Details
                </DialogTitle>
                <DialogDescription className="text-white/60">
                  Full details for deployment {selectedJob.id}
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4">
                {/* Summary */}
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold text-white">Summary</h4>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-white/60">Provider:</span>
                      <span className="ml-2 text-white">{getProviderName(selectedJob.providerId)}</span>
                    </div>
                    <div>
                      <span className="text-white/60">Status:</span>
                      <span className="ml-2">{getStatusBadge(selectedJob.status)}</span>
                    </div>
                    <div>
                      <span className="text-white/60">Started:</span>
                      <span className="ml-2 text-white">{selectedJob.startedAt.toLocaleString()}</span>
                    </div>
                    <div>
                      <span className="text-white/60">Duration:</span>
                      <span className="ml-2 text-white">{getDuration(selectedJob)}</span>
                    </div>
                    {selectedJob.retryCount !== undefined && (
                      <div>
                        <span className="text-white/60">Retry Count:</span>
                        <span className="ml-2 text-white">{selectedJob.retryCount}</span>
                      </div>
                    )}
                    <div>
                      <span className="text-white/60">Progress:</span>
                      <span className="ml-2 text-white">{selectedJob.progress}%</span>
                    </div>
                  </div>
                </div>
                
                {/* Error (if any) */}
                {selectedJob.error && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-semibold text-white">Error</h4>
                    <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30">
                      <p className="text-sm text-red-400">{selectedJob.error}</p>
                    </div>
                  </div>
                )}
                
                {/* Logs */}
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold text-white">Deployment Logs</h4>
                  <ScrollArea className="h-[200px] rounded-lg bg-black/30 border border-white/10 p-3">
                    <div className="space-y-1">
                      {selectedJob.logs.map((log, index) => (
                        <div key={`log-${index}`} className="flex items-start gap-2 text-xs">
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
                  </ScrollArea>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </AnimatePresence>
    </>
  );
}
