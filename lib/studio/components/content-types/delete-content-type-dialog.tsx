'use client';

/**
 * Delete Content Type Dialog
 *
 * Confirmation dialog that shows the impact of deleting a content type
 * and requires explicit confirmation before proceeding.
 */

import { useState, useEffect, useCallback } from 'react';
import { AlertTriangle, FileText, Package, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { ContentTypeImpact } from '@/lib/services/content-type-service';

// =============================================================================
// Types
// =============================================================================

export interface ContentType {
  id: string;
  name: string;
}

interface DeleteContentTypeDialogProps {
  contentType: ContentType | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  isDeleting?: boolean;
}

// =============================================================================
// Component
// =============================================================================

export function DeleteContentTypeDialog({
  contentType,
  open,
  onOpenChange,
  onConfirm,
  isDeleting = false,
}: DeleteContentTypeDialogProps) {
  const [impact, setImpact] = useState<ContentTypeImpact | null>(null);
  const [isLoadingImpact, setIsLoadingImpact] = useState(false);
  const [impactError, setImpactError] = useState<string | null>(null);
  const [isConfirmed, setIsConfirmed] = useState(false);

  // Reset state when dialog opens/closes
  useEffect(() => {
    if (!open) {
      setImpact(null);
      setIsLoadingImpact(false);
      setImpactError(null);
      setIsConfirmed(false);
    }
  }, [open]);

  // Fetch impact when dialog opens
  const fetchImpact = useCallback(async () => {
    if (!contentType?.id) return;

    setIsLoadingImpact(true);
    setImpactError(null);

    try {
      const res = await fetch(`/api/content-types/${contentType.id}/impact`);

      if (!res.ok) {
        throw new Error('Failed to load impact analysis');
      }

      const response = await res.json();
      setImpact(response.data);
    } catch (error) {
      setImpactError(error instanceof Error ? error.message : 'Failed to load impact');
    } finally {
      setIsLoadingImpact(false);
    }
  }, [contentType?.id]);

  useEffect(() => {
    if (open && contentType?.id) {
      fetchImpact();
    }
  }, [open, contentType?.id, fetchImpact]);

  const handleConfirm = () => {
    if (isConfirmed || !impact?.impact.totalAffectedItems) {
      onConfirm();
    }
  };

  const hasAffectedItems = (impact?.impact?.totalAffectedItems ?? 0) > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Delete Content Type: "{contentType?.name}"
          </DialogTitle>
          <DialogDescription>
            This action will permanently delete the content type and all associated content.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Loading State */}
          {isLoadingImpact && (
            <div className="space-y-3">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          )}

          {/* Error State */}
          {impactError && (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 p-4 text-sm">
              <p className="font-medium text-destructive">{impactError}</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-2"
                onClick={fetchImpact}
              >
                Retry
              </Button>
            </div>
          )}

          {/* Impact Display */}
          {impact && !isLoadingImpact && (
            <>
              {/* Warning Banner */}
              {hasAffectedItems && (
                <div className="rounded-md border border-destructive/30 bg-destructive/10 p-4">
                  <p className="font-medium text-destructive">
                    WARNING: This will permanently delete:
                  </p>
                </div>
              )}

              {/* Pages Section */}
              {impact.impact.websitePages.count > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <FileText className="h-4 w-4" />
                    {impact.impact.websitePages.count}{' '}
                    {impact.impact.websitePages.count === 1 ? 'Page' : 'Pages'}
                  </div>
                  <ScrollArea className="h-[100px] rounded-md border p-3">
                    <ul className="space-y-1 text-sm">
                      {impact.impact.websitePages.items.slice(0, 5).map((page) => (
                        <li key={page.id} className="text-muted-foreground">
                          <span className="font-medium text-foreground">{page.title}</span>
                          <span className="text-xs"> ({page.path})</span>
                        </li>
                      ))}
                      {impact.impact.websitePages.count > 5 && (
                        <li className="text-muted-foreground italic">
                          ... and {impact.impact.websitePages.count - 5} more
                        </li>
                      )}
                    </ul>
                  </ScrollArea>
                </div>
              )}

              {/* Custom Content Section */}
              {impact.impact.customContent.count > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Package className="h-4 w-4" />
                    {impact.impact.customContent.count} Custom Content{' '}
                    {impact.impact.customContent.count === 1 ? 'Item' : 'Items'}
                  </div>
                  <ScrollArea className="h-[80px] rounded-md border p-3">
                    <ul className="space-y-1 text-sm">
                      {impact.impact.customContent.items.slice(0, 5).map((item) => (
                        <li key={item.id} className="text-muted-foreground">
                          <span className="font-medium text-foreground">{item.title}</span>
                        </li>
                      ))}
                      {impact.impact.customContent.count > 5 && (
                        <li className="text-muted-foreground italic">
                          ... and {impact.impact.customContent.count - 5} more
                        </li>
                      )}
                    </ul>
                  </ScrollArea>
                </div>
              )}

              {/* No Affected Items */}
              {!hasAffectedItems && (
                <p className="text-sm text-muted-foreground">
                  No pages or content items are using this content type. It can be safely deleted.
                </p>
              )}

              {/* Warning Messages */}
              {impact.warnings.length > 0 && (
                <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3">
                  <ul className="space-y-1 text-sm text-destructive">
                    {impact.warnings.map((warning, index) => (
                      <li key={index} className="flex items-start gap-2">
                        <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                        {warning}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Confirmation Checkbox (only if there are affected items) */}
              {hasAffectedItems && (
                <div className="flex items-start space-x-2 pt-2">
                  <Checkbox
                    id="confirm-delete"
                    checked={isConfirmed}
                    onCheckedChange={(checked) => setIsConfirmed(checked === true)}
                  />
                  <Label
                    htmlFor="confirm-delete"
                    className="text-sm font-normal cursor-pointer leading-tight"
                  >
                    I understand that all content will be permanently deleted
                  </Label>
                </div>
              )}
            </>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isDeleting}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={isLoadingImpact || (hasAffectedItems && !isConfirmed) || isDeleting}
          >
            {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Delete Content Type
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
