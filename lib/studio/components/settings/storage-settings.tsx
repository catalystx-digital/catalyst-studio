'use client';

import React, { useState, useEffect } from 'react';
import { 
  Trash2, 
  Download, 
  Upload, 
  HardDrive,
  AlertCircle,
  CheckCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/components/ui/use-toast';
import { useChatPersistence } from '@/hooks/use-chat-persistence';
import { useWebsiteId } from '@/lib/hooks/use-website-id';
import { useUser } from '@/lib/auth/hooks';

interface StorageSettingsProps {
  sessionId?: string;
  onClear?: () => void;
}

export function StorageSettings({ 
  sessionId = 'default',
  onClear 
}: StorageSettingsProps) {
  const { toast } = useToast();
  const websiteId = useWebsiteId();
  const user = useUser();
  const hasWebsiteScope = !!websiteId && websiteId !== 'default';
  const [isClearing, setIsClearing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  const {
    clearMessages,
    exportMessages,
    importMessages,
    saveCount,
    lastSaved,
    storageStrategy,
    storageUsage
  } = useChatPersistence({
    websiteId: hasWebsiteScope ? websiteId : null,
    accountId: user?.id ?? null,
    sessionId,
    enabled: true
  });

  const handleClearHistory = async () => {
    setIsClearing(true);
    try {
      await clearMessages();
      
      onClear?.();
      
      toast({
        title: 'Chat history cleared',
        description: 'All chat messages have been removed from storage.',
      });
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
      console.error('Failed to clear history:', error);
      }
      toast({
        title: 'Failed to clear history',
        description: 'An error occurred while clearing chat history.',
        variant: 'destructive',
      });
    } finally {
      setIsClearing(false);
    }
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const jsonData = await exportMessages();
      
      // Create and download file
      const blob = new Blob([jsonData], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `catalyst-chat-${sessionId}-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast({
        title: 'Chat exported',
        description: 'Chat history has been downloaded as JSON.',
      });
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
      console.error('Failed to export:', error);
      }
      toast({
        title: 'Export failed',
        description: 'An error occurred while exporting chat history.',
        variant: 'destructive',
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    try {
      const text = await file.text();
      await importMessages(text);
      
      toast({
        title: 'Chat imported',
        description: 'Chat history has been imported successfully.',
      });
      
      // Reset input
      event.target.value = '';
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
      console.error('Failed to import:', error);
      }
      toast({
        title: 'Import failed',
        description: 'Invalid file format or corrupted data.',
        variant: 'destructive',
      });
    } finally {
      setIsImporting(false);
    }
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getStorageStatusColor = (percentage: number): string => {
    if (percentage < 50) return 'text-green-500';
    if (percentage < 80) return 'text-yellow-500';
    return 'text-red-500';
  };

  const getStorageStatusIcon = (percentage: number) => {
    if (percentage < 80) {
      return <CheckCircle className="w-4 h-4 text-green-500" />;
    }
    return <AlertCircle className="w-4 h-4 text-yellow-500" />;
  };

  return (
    <div className="space-y-6">
      {/* Storage Status Card */}
      <Card className="p-6 bg-background/60 backdrop-blur border-border/50">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <HardDrive className="w-5 h-5" />
              Storage Status
            </h3>
            {storageUsage && getStorageStatusIcon(storageUsage.percentage)}
          </div>

          {storageUsage && (
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Storage Type:</span>
                <span className="font-medium">{storageStrategy}</span>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Usage:</span>
                  <span className={`font-medium ${getStorageStatusColor(storageUsage.percentage)}`}>
                    {formatBytes(storageUsage.usage)} / {formatBytes(storageUsage.quota)}
                  </span>
                </div>
                
                <div className="w-full bg-secondary rounded-full h-2">
                  <div 
                    className={`h-2 rounded-full transition-all ${
                      storageUsage.percentage < 50 ? 'bg-green-500' :
                      storageUsage.percentage < 80 ? 'bg-yellow-500' : 'bg-red-500'
                    }`}
                    style={{ width: `${Math.min(storageUsage.percentage, 100)}%` }}
                  />
                </div>
                
                <p className="text-xs text-muted-foreground">
                  {storageUsage.percentage.toFixed(1)}% used
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-2 border-t">
                <div className="text-sm">
                  <span className="text-muted-foreground">Messages saved:</span>
                  <p className="font-medium">{saveCount} times</p>
                </div>
                <div className="text-sm">
                  <span className="text-muted-foreground">Last saved:</span>
                  <p className="font-medium">
                    {lastSaved ? lastSaved.toLocaleTimeString() : 'Never'}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Actions Card */}
      <Card className="p-6 bg-background/60 backdrop-blur border-border/50">
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Chat History Management</h3>
          
          <div className="space-y-3">
            {/* Clear History */}
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button 
                  variant="destructive" 
                  className="w-full justify-start"
                  disabled={isClearing}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Clear Chat History
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Clear Chat History?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete all saved chat messages. This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleClearHistory}>
                    Clear History
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            {/* Export */}
            <Button 
              variant="outline" 
              className="w-full justify-start"
              onClick={handleExport}
              disabled={isExporting || saveCount === 0}
            >
              <Download className="mr-2 h-4 w-4" />
              Export Chat History
            </Button>

            {/* Import */}
            <div>
              <input
                type="file"
                accept=".json"
                onChange={handleImport}
                className="hidden"
                id="import-file"
                disabled={isImporting}
              />
              <Button 
                variant="outline" 
                className="w-full justify-start"
                onClick={() => document.getElementById('import-file')?.click()}
                disabled={isImporting}
              >
                <Upload className="mr-2 h-4 w-4" />
                Import Chat History
              </Button>
            </div>
          </div>

          <div className="pt-4 border-t">
            <p className="text-xs text-muted-foreground">
              Chat history is stored securely in the database. Messages are associated with your website 
              and session. Old messages are automatically pruned to maintain performance.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
