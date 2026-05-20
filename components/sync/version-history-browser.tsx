'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  GitBranch, 
  Clock, 
  User, 
  FileText, 
  ChevronRight,
  RotateCcw,
  Eye,
  GitCommit
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface VersionHistoryItem {
  id: string;
  contentTypeId: string;
  version: string;
  hash: string;
  parentHash?: string;
  createdAt: string;
  changeSource: 'UI' | 'API' | 'SYNC';
  author: string;
  changes: {
    added: number;
    modified: number;
    removed: number;
  };
  description?: string;
}

interface VersionHistoryBrowserProps {
  contentTypeId?: string;
}

export function VersionHistoryBrowser({ contentTypeId }: VersionHistoryBrowserProps) {
  const [history, setHistory] = useState<VersionHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedVersion, setSelectedVersion] = useState<VersionHistoryItem | null>(null);
  const [showDiffDialog, setShowDiffDialog] = useState(false);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const limit = 20;

  useEffect(() => {
    fetchHistory();
  }, [contentTypeId, offset]);

  const fetchHistory = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        limit: limit.toString(),
        offset: offset.toString(),
        ...(contentTypeId && { contentTypeId })
      });
      
      const response = await fetch(`/api/sync/history?${params}`);
      if (response.ok) {
        const data = await response.json();
        if (offset === 0) {
          setHistory(data.items);
        } else {
          setHistory(prev => [...prev, ...data.items]);
        }
        setHasMore(data.items.length === limit);
      }
    } catch (error) {
      console.error('Failed to fetch version history:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadMore = () => {
    setOffset(prev => prev + limit);
  };

  const handleViewDiff = (version: VersionHistoryItem) => {
    setSelectedVersion(version);
    setShowDiffDialog(true);
  };

  const handleRollback = async (version: VersionHistoryItem) => {
    if (confirm(`Are you sure you want to rollback to version ${version.version}?`)) {
      console.log('Rollback to version:', version);
    }
  };

  const formatDate = (isoString: string) => {
    return new Date(isoString).toLocaleString();
  };

  const getSourceBadgeVariant = (source: string) => {
    switch (source) {
      case 'UI':
        return 'default';
      case 'API':
        return 'secondary';
      case 'SYNC':
        return 'outline';
      default:
        return 'outline';
    }
  };

  const renderVersionTree = (item: VersionHistoryItem, index: number) => {
    const hasParent = item.parentHash && index > 0;
    const isLatest = index === 0;
    
    return (
      <div key={item.id} className="relative">
        {hasParent && (
          <div className="absolute left-4 -top-4 h-8 w-0.5 bg-muted" />
        )}
        
        <div className="flex items-start gap-3">
          <div className="relative mt-1">
            <GitCommit className={`h-8 w-8 ${isLatest ? 'text-primary' : 'text-muted-foreground'}`} />
          </div>
          
          <Card className="flex-1">
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div className="space-y-2 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-medium">v{item.version}</span>
                    <Badge variant={getSourceBadgeVariant(item.changeSource) as any}>
                      {item.changeSource}
                    </Badge>
                    {isLatest && (
                      <Badge variant="default" className="bg-green-100 text-green-800">Latest</Badge>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <User className="h-3 w-3" />
                      <span>{item.author}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      <span>{formatDate(item.createdAt)}</span>
                    </div>
                  </div>
                  
                  {item.description && (
                    <p className="text-sm text-muted-foreground">{item.description}</p>
                  )}
                  
                  <div className="flex items-center gap-3 text-sm">
                    <span className="text-green-600">+{item.changes.added} added</span>
                    <span className="text-yellow-600">~{item.changes.modified} modified</span>
                    <span className="text-red-600">-{item.changes.removed} removed</span>
                  </div>
                  
                  <div className="text-xs text-muted-foreground font-mono">
                    Hash: {item.hash.substring(0, 8)}
                    {item.parentHash && (
                      <span> ← {item.parentHash.substring(0, 8)}</span>
                    )}
                  </div>
                </div>
                
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleViewDiff(item)}
                  >
                    <Eye className="h-4 w-4 mr-1" />
                    View
                  </Button>
                  {!isLatest && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRollback(item)}
                    >
                      <RotateCcw className="h-4 w-4 mr-1" />
                      Rollback
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <GitBranch className="h-5 w-5" />
            <CardTitle>Version History</CardTitle>
          </div>
          <CardDescription>
            Browse and manage content type version history
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[500px] pr-4">
            {loading && offset === 0 ? (
              <div className="flex items-center justify-center py-8">
                <div className="text-muted-foreground">Loading version history...</div>
              </div>
            ) : history.length === 0 ? (
              <div className="flex items-center justify-center py-8">
                <div className="text-muted-foreground">No version history available</div>
              </div>
            ) : (
              <div className="space-y-4">
                {history.map((item, index) => renderVersionTree(item, index))}
                
                {hasMore && (
                  <div className="flex justify-center pt-4">
                    <Button
                      variant="outline"
                      onClick={loadMore}
                      disabled={loading}
                    >
                      {loading ? 'Loading...' : 'Load More'}
                    </Button>
                  </div>
                )}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>

      <Dialog open={showDiffDialog} onOpenChange={setShowDiffDialog}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Version Details</DialogTitle>
            <DialogDescription>
              Version {selectedVersion?.version} - {selectedVersion?.hash.substring(0, 8)}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {selectedVersion && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-sm text-muted-foreground">Author:</span>
                    <p className="font-medium">{selectedVersion.author}</p>
                  </div>
                  <div>
                    <span className="text-sm text-muted-foreground">Created:</span>
                    <p className="font-medium">{formatDate(selectedVersion.createdAt)}</p>
                  </div>
                  <div>
                    <span className="text-sm text-muted-foreground">Source:</span>
                    <p className="font-medium">{selectedVersion.changeSource}</p>
                  </div>
                  <div>
                    <span className="text-sm text-muted-foreground">Changes:</span>
                    <p className="font-medium">
                      +{selectedVersion.changes.added} / 
                      ~{selectedVersion.changes.modified} / 
                      -{selectedVersion.changes.removed}
                    </p>
                  </div>
                </div>
                
                {selectedVersion.description && (
                  <div>
                    <span className="text-sm text-muted-foreground">Description:</span>
                    <p className="mt-1">{selectedVersion.description}</p>
                  </div>
                )}
                
                <div className="bg-muted p-4 rounded-lg">
                  <p className="text-sm text-muted-foreground">
                    Diff viewer would show changes between this version and its parent here
                  </p>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}