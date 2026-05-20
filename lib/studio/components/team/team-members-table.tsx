'use client';

/**
 * Team Members Table
 *
 * Displays a list of team members with actions to edit/remove.
 */

import { useState } from 'react';
import { MoreHorizontal, Shield, User, Trash2, Edit } from 'lucide-react';
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
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

// =============================================================================
// Types
// =============================================================================

export interface TeamMember {
  id: string;
  userId: string;
  email: string | null;
  name: string | null;
  role: 'admin' | 'member';
  websiteAccess: 'all' | 'specific';
  websiteIds: string[];
  websiteNames: string[];
  joinedAt: string;
}

interface TeamMembersTableProps {
  members: TeamMember[];
  currentUserId: string;
  isLoading?: boolean;
  onEdit: (member: TeamMember) => void;
  onRemove: (memberId: string) => void;
}

// =============================================================================
// Component
// =============================================================================

export function TeamMembersTable({
  members,
  currentUserId,
  isLoading = false,
  onEdit,
  onRemove,
}: TeamMembersTableProps) {
  const [memberToRemove, setMemberToRemove] = useState<TeamMember | null>(null);

  if (isLoading) {
    return <TeamMembersTableSkeleton />;
  }

  if (members.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p>No team members yet. Invite someone to get started.</p>
      </div>
    );
  }

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Member</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Access</TableHead>
            <TableHead>Joined</TableHead>
            <TableHead className="w-[50px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {members.map((member) => (
            <TableRow key={member.id}>
              <TableCell>
                <div className="flex items-center gap-3">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src="" alt={member.name ?? 'Team member'} />
                    <AvatarFallback>
                      {getInitials(member.name ?? member.email ?? '?')}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="font-medium">
                      {member.name ?? 'No name'}
                      {member.userId === currentUserId && (
                        <span className="text-muted-foreground ml-2">(You)</span>
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground">{member.email}</div>
                  </div>
                </div>
              </TableCell>
              <TableCell>
                <RoleBadge role={member.role} />
              </TableCell>
              <TableCell>
                <AccessBadge
                  websiteAccess={member.websiteAccess}
                  websiteNames={member.websiteNames}
                />
              </TableCell>
              <TableCell className="text-muted-foreground">
                {formatDate(member.joinedAt)}
              </TableCell>
              <TableCell>
                {member.userId !== currentUserId && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreHorizontal className="h-4 w-4" />
                        <span className="sr-only">Actions</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => onEdit(member)}>
                        <Edit className="mr-2 h-4 w-4" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-destructive"
                        onClick={() => setMemberToRemove(member)}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Remove
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <AlertDialog
        open={memberToRemove !== null}
        onOpenChange={(open) => !open && setMemberToRemove(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Team Member</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove{' '}
              <strong>{memberToRemove?.name ?? memberToRemove?.email}</strong> from this account?
              They will lose access to all websites.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (memberToRemove) {
                  onRemove(memberToRemove.id);
                  setMemberToRemove(null);
                }
              }}
            >
              Remove
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

function RoleBadge({ role }: { role: 'admin' | 'member' }) {
  if (role === 'admin') {
    return (
      <Badge variant="default" className="gap-1">
        <Shield className="h-3 w-3" />
        Admin
      </Badge>
    );
  }

  return (
    <Badge variant="secondary" className="gap-1">
      <User className="h-3 w-3" />
      Member
    </Badge>
  );
}

function AccessBadge({
  websiteAccess,
  websiteNames,
}: {
  websiteAccess: 'all' | 'specific';
  websiteNames: string[];
}) {
  if (websiteAccess === 'all') {
    return <span className="text-muted-foreground">All websites</span>;
  }

  if (websiteNames.length === 0) {
    return <span className="text-muted-foreground">No websites</span>;
  }

  if (websiteNames.length <= 2) {
    return <span className="text-muted-foreground">{websiteNames.join(', ')}</span>;
  }

  return (
    <span className="text-muted-foreground">
      {websiteNames[0]} and {websiteNames.length - 1} more
    </span>
  );
}

function TeamMembersTableSkeleton() {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Member</TableHead>
          <TableHead>Role</TableHead>
          <TableHead>Access</TableHead>
          <TableHead>Joined</TableHead>
          <TableHead className="w-[50px]"></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {[...Array(3)].map((_, i) => (
          <TableRow key={i}>
            <TableCell>
              <div className="flex items-center gap-3">
                <Skeleton className="h-8 w-8 rounded-full" />
                <div className="space-y-1">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-3 w-32" />
                </div>
              </div>
            </TableCell>
            <TableCell>
              <Skeleton className="h-5 w-16" />
            </TableCell>
            <TableCell>
              <Skeleton className="h-4 w-20" />
            </TableCell>
            <TableCell>
              <Skeleton className="h-4 w-16" />
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

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((word) => word[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}
