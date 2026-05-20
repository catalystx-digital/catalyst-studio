'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  BarChart3, 
  TrendingUp, 
  Clock, 
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Activity,
  Calendar,
  FileText
} from 'lucide-react';

interface SyncAnalytics {
  totalSyncs: number;
  successfulSyncs: number;
  failedSyncs: number;
  successRate: number;
  averageDuration: number;
  conflictsPerSync: number;
  validationErrorsPerSync: number;
  mostSyncedContentTypes: Array<{
    contentTypeId: string;
    name: string;
    count: number;
  }>;
  syncVolumeOverTime: Array<{
    date: string;
    count: number;
    successful: number;
    failed: number;
  }>;
  recentSyncs: Array<{
    id: string;
    timestamp: string;
    status: 'success' | 'failed';
    duration: number;
    conflicts: number;
    validationErrors: number;
  }>;
}

export function SyncAnalyticsDashboard() {
  const [analytics, setAnalytics] = useState<SyncAnalytics | null>(null);
  const [period, setPeriod] = useState<string>('7d');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAnalytics();
  }, [period]);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/sync/analytics?period=${period}`);
      if (response.ok) {
        const data = await response.json();
        setAnalytics(data);
      }
    } catch (error) {
      console.error('Failed to fetch analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDuration = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  };

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString();
  };

  if (loading || !analytics) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-6">
          <div className="text-muted-foreground">Loading analytics...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">Total Syncs</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.totalSyncs}</div>
            <div className="flex items-center gap-2 mt-2">
              <Badge variant="default" className="text-xs bg-green-100 text-green-800">
                {analytics.successfulSyncs} successful
              </Badge>
              <Badge variant="destructive" className="text-xs">
                {analytics.failedSyncs} failed
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.successRate.toFixed(1)}%</div>
            <Progress value={analytics.successRate} className="mt-2 h-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">Avg Duration</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatDuration(analytics.averageDuration)}</div>
            <p className="text-xs text-muted-foreground mt-2">Per sync operation</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">Avg Issues</CardTitle>
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              <div>
                <div className="text-lg font-bold">{analytics.conflictsPerSync.toFixed(1)}</div>
                <p className="text-xs text-muted-foreground">Conflicts</p>
              </div>
              <div className="h-8 w-px bg-border" />
              <div>
                <div className="text-lg font-bold">{analytics.validationErrorsPerSync.toFixed(1)}</div>
                <p className="text-xs text-muted-foreground">Errors</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="content-types">Content Types</TabsTrigger>
          <TabsTrigger value="recent">Recent Syncs</TabsTrigger>
          <TabsTrigger value="trends">Trends</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Sync Volume Over Time</CardTitle>
              <CardDescription>Daily synchronization activity</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {analytics.syncVolumeOverTime.map((day) => (
                  <div key={day.date} className="flex items-center gap-4">
                    <div className="w-24 text-sm text-muted-foreground">
                      {new Date(day.date).toLocaleDateString()}
                    </div>
                    <div className="flex-1">
                      <div className="flex h-6 rounded-full overflow-hidden bg-muted">
                        <div 
                          className="bg-green-500" 
                          style={{ width: `${(day.successful / day.count) * 100}%` }}
                        />
                        <div 
                          className="bg-red-500" 
                          style={{ width: `${(day.failed / day.count) * 100}%` }}
                        />
                      </div>
                    </div>
                    <div className="w-16 text-sm text-right">
                      {day.count} syncs
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="content-types">
          <Card>
            <CardHeader>
              <CardTitle>Most Synced Content Types</CardTitle>
              <CardDescription>Content types with highest sync frequency</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {analytics.mostSyncedContentTypes.map((ct, index) => (
                  <div key={ct.contentTypeId} className="flex items-center gap-4">
                    <div className="w-6 text-center text-sm text-muted-foreground">
                      #{index + 1}
                    </div>
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">{ct.name}</p>
                          <p className="text-xs text-muted-foreground">{ct.contentTypeId}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold">{ct.count}</p>
                          <p className="text-xs text-muted-foreground">syncs</p>
                        </div>
                      </div>
                      <Progress 
                        value={(ct.count / analytics.totalSyncs) * 100} 
                        className="mt-2 h-1"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="recent">
          <Card>
            <CardHeader>
              <CardTitle>Recent Sync Operations</CardTitle>
              <CardDescription>Latest synchronization activity</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {analytics.recentSyncs.map((sync) => (
                  <div key={sync.id} className="flex items-center justify-between p-3 rounded-lg border">
                    <div className="flex items-center gap-3">
                      {sync.status === 'success' ? (
                        <CheckCircle2 className="h-5 w-5 text-green-500" />
                      ) : (
                        <XCircle className="h-5 w-5 text-red-500" />
                      )}
                      <div>
                        <p className="text-sm font-medium">{sync.id}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatTimestamp(sync.timestamp)}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-4">
                      <div className="text-sm text-right">
                        <p className="font-medium">{formatDuration(sync.duration)}</p>
                        <p className="text-xs text-muted-foreground">duration</p>
                      </div>
                      
                      {(sync.conflicts > 0 || sync.validationErrors > 0) && (
                        <div className="flex gap-2">
                          {sync.conflicts > 0 && (
                            <Badge variant="secondary">
                              {sync.conflicts} conflict{sync.conflicts !== 1 ? 's' : ''}
                            </Badge>
                          )}
                          {sync.validationErrors > 0 && (
                            <Badge variant="destructive">
                              {sync.validationErrors} error{sync.validationErrors !== 1 ? 's' : ''}
                            </Badge>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="trends">
          <Card>
            <CardHeader>
              <CardTitle>Performance Trends</CardTitle>
              <CardDescription>Sync performance metrics over time</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">Success Rate Trend</span>
                    <span className="text-sm text-muted-foreground">
                      {analytics.successRate > 90 ? '↑ Improving' : '↓ Needs attention'}
                    </span>
                  </div>
                  <Progress value={analytics.successRate} className="h-2" />
                </div>
                
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">Conflict Resolution Rate</span>
                    <span className="text-sm text-muted-foreground">
                      {100 - (analytics.conflictsPerSync * 10)}% resolved
                    </span>
                  </div>
                  <Progress value={100 - (analytics.conflictsPerSync * 10)} className="h-2" />
                </div>
                
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">Validation Pass Rate</span>
                    <span className="text-sm text-muted-foreground">
                      {100 - (analytics.validationErrorsPerSync * 10)}% passing
                    </span>
                  </div>
                  <Progress value={100 - (analytics.validationErrorsPerSync * 10)} className="h-2" />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}