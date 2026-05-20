'use client';

import { Loader2 } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface DeleteWebsiteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  websiteName: string;
  onConfirm: () => void;
  isDeleting?: boolean;
  errorMessage?: string;
}

export function DeleteWebsiteDialog({
  open,
  onOpenChange,
  websiteName,
  onConfirm,
  isDeleting = false,
  errorMessage,
}: DeleteWebsiteDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="bg-gray-900 border border-red-500/40">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-red-200">
            Delete “{websiteName}”?
          </AlertDialogTitle>
          <AlertDialogDescription className="text-gray-300">
            This action permanently removes the website, its pages, components, and imported data. This cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>

        {errorMessage && (
          <p className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
            {errorMessage}
          </p>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            disabled={isDeleting}
            className="bg-red-600 text-white hover:bg-red-500 focus:ring-red-500"
          >
            {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Delete website
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
