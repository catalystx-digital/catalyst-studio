'use client';

/**
 * Pending Invitations Table
 *
 * Displays pending invitations with actions to resend/revoke.
 */

import { useState } from 'react';
import { MoreHorizontal, RefreshCw, X, Mail, MailWarning, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Skeleton } from '@/components/ui/skeleton';

// =============================================================================
// Types
// =============================================================================

export interface PendingInvitation {
  id: string;
  email: string;
  role: 'admin' | 'member';
  websiteAccess: 'all' | 'specific';
  websiteNames: string[];
  status: 'pending' | 'accepted' | 'declined' | 'expired' | 'revoked';
  emailStatus: 'pending' | 'sent' | 'failed';
  emailSentAt: string | null;
  expiresAt: string;
  createdAt: string;
  invitedBy: {
    id: string;
    name: string | null;
    email: string | null;
  };
}

interface PendingInvitationsTableProps {
  invitations: PendingInvitation[];
  isLoading?: boolean;
  onResend: (invitationId: string) => void;
  onRevoke: (invitationId: string) => void;
}

// =============================================================================
// Component
// =============================================================================

export function PendingInvitationsTable({
  invitations,
  isLoading = false,
  onResend,
  onRevoke,
}: PendingInvitationsTableProps) {
  const [invitationToRevoke, setInvitationToRevoke] = useState<PendingInvitation | null>(null);

  if (isLoading) {
    return <PendingInvitationsTableSkeleton />;
  }

  const pendingInvitations = invitations.filter((inv) => inv.status === 'pending');

  if (pendingInvitations.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p>No pending invitations</p>
      </div>
    );
  }

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Email</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Access</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Expires</TableHead>
            <TableHead className="w-[50px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {pendingInvitations.map((invitation) => (
            <TableRow key={invitation.id}>
              <TableCell>
                <div className="flex items-center gap-2">
                  <span className="font-medium">{invitation.email}</span>
                </div>
              </TableCell>
              <TableCell>
                <Badge variant={invitation.role === 'admin' ? 'default' : 'secondary'}>
                  {invitation.role === 'admin' ? 'Admin' : 'Member'}
                </Badge>
              </TableCell>
              <TableCell>
                {invitation.websiteAccess === 'all' ? (
                  <span className="text-muted-foreground">All websites</span>
                ) : (
                  <span className="text-muted-foreground">
                    {invitation.websiteNames.length} website
                    {invitation.websiteNames.length !== 1 ? 's' : ''}
                  </span>
                )}
              </TableCell>
              <TableCell>
                <EmailStatusBadge status={invitation.emailStatus} sentAt={invitation.emailSentAt} />
              </TableCell>
              <TableCell>
                <ExpiryStatus expiresAt={invitation.expiresAt} />
              </TableCell>
              <TableCell>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon">
                      <MoreHorizontal className="h-4 w-4" />
                      <span className="sr-only">Actions</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => onResend(invitation.id)}>
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Resend Invitation
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-destructive"
                      onClick={() => setInvitationToRevoke(invitation)}
                    >
                      <X className="mr-2 h-4 w-4" />
                      Revoke
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <AlertDialog
        open={invitationToRevoke !== null}
        onOpenChange={(open) => !open && setInvitationToRevoke(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke Invitation</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to revoke the invitation for{' '}
              <strong>{invitationToRevoke?.email}</strong>? The invitation link will no longer work.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (invitationToRevoke) {
                  onRevoke(invitationToRevoke.id);
                  setInvitationToRevoke(null);
                }
              }}
            >
              Revoke
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// =============================================================================
// Helper Components
// =============================================================================

function EmailStatusBadge({
  status,
  sentAt,
}: {
  status: 'pending' | 'sent' | 'failed';
  sentAt: string | null;
}) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger>
          {status === 'sent' && (
            <Badge variant="outline" className="gap-1 text-green-600 border-green-200">
              <Mail className="h-3 w-3" />
              Sent
            </Badge>
          )}
          {status === 'pending' && (
            <Badge variant="outline" className="gap-1 text-yellow-600 border-yellow-200">
              <Clock className="h-3 w-3" />
              Pending
            </Badge>
          )}
          {status === 'failed' && (
            <Badge variant="outline" className="gap-1 text-red-600 border-red-200">
              <MailWarning className="h-3 w-3" />
              Failed
            </Badge>
          )}
        </TooltipTrigger>
        <TooltipContent>
          {status === 'sent' && sentAt && `Sent ${formatDate(sentAt)}`}
          {status === 'pending' && 'Email not yet sent'}
          {status === 'failed' && 'Failed to send email'}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function ExpiryStatus({ expiresAt }: { expiresAt: string }) {
  const expiry = new Date(expiresAt);
  const now = new Date();
  const daysRemaining = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  if (daysRemaining <= 0) {
    return <span className="text-destructive">Expired</span>;
  }

  if (daysRemaining <= 3) {
    return <span className="text-yellow-600">{daysRemaining} day{daysRemaining !== 1 ? 's' : ''}</span>;
  }

  return <span className="text-muted-foreground">{daysRemaining} days</span>;
}

function PendingInvitationsTableSkeleton() {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Email</TableHead>
          <TableHead>Role</TableHead>
          <TableHead>Access</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Expires</TableHead>
          <TableHead className="w-[50px]"></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {[...Array(2)].map((_, i) => (
          <TableRow key={i}>
            <TableCell>
              <Skeleton className="h-4 w-40" />
            </TableCell>
            <TableCell>
              <Skeleton className="h-5 w-16" />
            </TableCell>
            <TableCell>
              <Skeleton className="h-4 w-20" />
            </TableCell>
            <TableCell>
              <Skeleton className="h-5 w-14" />
            </TableCell>
            <TableCell>
              <Skeleton className="h-4 w-12" />
            </TableCell>
            <TableCell></TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

// =============================================================================
// Helpers
// =============================================================================

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}
