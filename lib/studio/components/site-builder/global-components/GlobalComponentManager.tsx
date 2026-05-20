'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Globe, Lock, Unlock, Users, AlertCircle } from 'lucide-react';
import { GlobalBadge } from './GlobalBadge';
import { cn } from '@/lib/utils';

interface GlobalComponentManagerProps {
  componentId: string;
  componentName: string;
  componentType: string;
  websiteId: string;
  isGlobal?: boolean;
  onGlobalStateChange?: (isGlobal: boolean) => void;
  className?: string;
}

export function GlobalComponentManager({
  componentId,
  componentName,
  componentType,
  websiteId,
  isGlobal: initialIsGlobal = false,
  onGlobalStateChange,
  className
}: GlobalComponentManagerProps) {
  const [isGlobal, setIsGlobal] = useState(initialIsGlobal);
  const [isLoading, setIsLoading] = useState(false);
  const [usageCount, setUsageCount] = useState(0);
  const [showConversionDialog, setShowConversionDialog] = useState(false);
  const [conversionType, setConversionType] = useState<'toGlobal' | 'toLocal'>('toGlobal');

  const fetchUsageCount = useCallback(async () => {
    try {
      const response = await fetch(`/api/studio/site-builder/global-components/${componentId}/usage`);
      if (response.ok) {
        const data = await response.json();
        setUsageCount(data.usageCount || 0);
      }
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
      console.error('Failed to fetch usage count:', error);
      }
    }
  }, [componentId]);

  useEffect(() => {
    if (isGlobal) {
      fetchUsageCount();
    }
  }, [isGlobal, componentId, fetchUsageCount]);

  const handleToggleGlobal = () => {
    const newType = isGlobal ? 'toLocal' : 'toGlobal';
    setConversionType(newType);
    setShowConversionDialog(true);
  };

  const confirmConversion = async () => {
    setIsLoading(true);
    setShowConversionDialog(false);

    try {
      const response = await fetch('/api/studio/site-builder/global-components', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          componentId,
          websiteId,
          name: componentName,
          type: componentType,
          properties: {}, // This would be filled with actual component properties
          makeGlobal: !isGlobal,
          createdBy: 'current-user' // This would be the actual user ID
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update component global state');
      }

      const data = await response.json();
      const newGlobalState = !isGlobal;
      
      setIsGlobal(newGlobalState);
      onGlobalStateChange?.(newGlobalState);
      
      toast.success(
        newGlobalState
          ? `Component "${componentName}" is now global`
          : `Component "${componentName}" is now local`
      );

      if (newGlobalState) {
        setUsageCount(data.usageCount || 0);
      }
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
      console.error('Failed to update component:', error);
      }
      toast.error('Failed to update component. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Card className={cn('border-l-4', isGlobal ? 'border-l-blue-500' : 'border-l-gray-300', className)}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CardTitle className="text-lg">{componentName}</CardTitle>
              {isGlobal && <GlobalBadge />}
            </div>
            <div className="flex items-center gap-2">
              {isGlobal && (
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  <Users className="h-4 w-4" />
                  <span>{usageCount} uses</span>
                </div>
              )}
            </div>
          </div>
          <CardDescription className="text-sm">
            Type: {componentType}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Switch
                id={`global-toggle-${componentId}`}
                checked={isGlobal}
                onCheckedChange={handleToggleGlobal}
                disabled={isLoading}
              />
              <Label
                htmlFor={`global-toggle-${componentId}`}
                className="cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  {isGlobal ? (
                    <>
                      <Lock className="h-4 w-4" />
                      Global Component
                    </>
                  ) : (
                    <>
                      <Unlock className="h-4 w-4" />
                      Local Component
                    </>
                  )}
                </div>
              </Label>
            </div>
          </div>
          
          {isGlobal && (
            <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-950 rounded-md">
              <p className="text-sm text-blue-700 dark:text-blue-300">
                Changes to this component will be propagated to all {usageCount} instances across your website.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={showConversionDialog} onOpenChange={setShowConversionDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {conversionType === 'toGlobal' ? 'Convert to Global Component' : 'Convert to Local Component'}
            </DialogTitle>
            <DialogDescription>
              {conversionType === 'toGlobal' ? (
                <>
                  <div className="space-y-3 mt-4">
                    <div className="flex items-start gap-2">
                      <Globe className="h-5 w-5 text-blue-500 mt-0.5" />
                      <div>
                        <p className="font-medium">Global components are centrally managed</p>
                        <p className="text-sm text-muted-foreground">
                          Changes will automatically propagate to all pages using this component
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <AlertCircle className="h-5 w-5 text-amber-500 mt-0.5" />
                      <div>
                        <p className="font-medium">Use for consistent elements</p>
                        <p className="text-sm text-muted-foreground">
                          Best for headers, footers, CTAs, and other elements that should be identical across pages
                        </p>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="space-y-3 mt-4">
                    <div className="flex items-start gap-2">
                      <Unlock className="h-5 w-5 text-gray-500 mt-0.5" />
                      <div>
                        <p className="font-medium">Local components are page-specific</p>
                        <p className="text-sm text-muted-foreground">
                          Each instance can be edited independently without affecting others
                        </p>
                      </div>
                    </div>
                    {usageCount > 0 && (
                      <div className="flex items-start gap-2">
                        <AlertCircle className="h-5 w-5 text-amber-500 mt-0.5" />
                        <div>
                          <p className="font-medium">This will affect {usageCount} instances</p>
                          <p className="text-sm text-muted-foreground">
                            All instances will become independent local components
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowConversionDialog(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={confirmConversion}
              disabled={isLoading}
            >
              {conversionType === 'toGlobal' ? 'Make Global' : 'Make Local'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
