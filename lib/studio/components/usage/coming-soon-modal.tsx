'use client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface ComingSoonModalProps {
  open: boolean;
  onClose: () => void;
}

/**
 * Coming Soon Modal - displays Pro plan features and waitlist option
 */
export function ComingSoonModal({ open, onClose }: ComingSoonModalProps) {
  const handleJoinWaitlist = () => {
    // TODO: Integrate with waitlist service when available
    // For now, just close the modal
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Pro Plan Coming Soon!</DialogTitle>
          <DialogDescription>
            We're working on unlimited features for power users:
          </DialogDescription>
        </DialogHeader>
        <ul className="my-4 space-y-2 text-sm">
          <li className="flex items-center gap-2">
            <span className="text-green-600">&#10003;</span>
            <span>Unlimited websites</span>
          </li>
          <li className="flex items-center gap-2">
            <span className="text-green-600">&#10003;</span>
            <span>Unlimited pages</span>
          </li>
          <li className="flex items-center gap-2">
            <span className="text-green-600">&#10003;</span>
            <span>5M tokens/month</span>
          </li>
          <li className="flex items-center gap-2">
            <span className="text-green-600">&#10003;</span>
            <span>Priority support</span>
          </li>
        </ul>
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          <Button onClick={handleJoinWaitlist}>Join Waitlist</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
