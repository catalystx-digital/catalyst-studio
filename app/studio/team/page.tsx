'use client';

/**
 * Studio Team Management Page
 *
 * Manage team members and invitations.
 * Supports two modes:
 * - Account-wide mode (context=account or no websiteId): Shows all team members across all websites
 * - Website-specific mode (with websiteId): Shows team members for that specific website
 */

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { Plus, Users, Mail, RefreshCw } from 'lucide-react';
import { createBrowserClient } from '@/lib/supabase/client';
import { useWebsiteContext } from '@/lib/context/website-context';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/components/ui/use-toast';
import {
  TeamMembersTable,
  TeamMember,
  PendingInvitationsTable,
  PendingInvitation,
  InviteMemberModal,
  InviteMemberData,
  EditMemberModal,
  MemberToEdit,
  UpdateMemberData,
  Website,
} from '@/lib/studio/components/team';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

export default function StudioTeamManagementPage() {
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const websiteId = searchParams.get('websiteId');
  const context = searchParams.get('context');

  // Determine if we're in account-wide mode
  const isAccountWide = context === 'account' || !websiteId;

  // State
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [invitations, setInvitations] = useState<PendingInvitation[]>([]);
  const [websites, setWebsites] = useState<Website[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string>('');
  const [accountId, setAccountId] = useState<string>('');

  const [isLoadingMembers, setIsLoadingMembers] = useState(true);
  const [isLoadingInvitations, setIsLoadingInvitations] = useState(true);

  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [isInviteSubmitting, setIsInviteSubmitting] = useState(false);

  const [memberToEdit, setMemberToEdit] = useState<MemberToEdit | null>(null);
  const [isEditSubmitting, setIsEditSubmitting] = useState(false);

  // Get website from context (provides name for display)
  const { website: contextWebsite } = useWebsiteContext();

  // Fetch data
  const fetchMembers = useCallback(async () => {
    if (!accountId) return;

    setIsLoadingMembers(true);
    try {
      const res = await fetch(`/api/studio/accounts/${accountId}/members`);
      if (!res.ok) throw new Error('Failed to load members');

      const data = await res.json();
      setMembers(data.data.members);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to load team members',
        variant: 'destructive',
      });
    } finally {
      setIsLoadingMembers(false);
    }
  }, [accountId, toast]);

  const fetchInvitations = useCallback(async () => {
    setIsLoadingInvitations(true);
    try {
      const res = await fetch('/api/studio/invitations?status=pending');
      if (!res.ok) throw new Error('Failed to load invitations');

      const data = await res.json();
      setInvitations(data.data.invitations);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to load invitations',
        variant: 'destructive',
      });
    } finally {
      setIsLoadingInvitations(false);
    }
  }, [toast]);

  const fetchWebsites = useCallback(async () => {
    if (!accountId) return;

    try {
      const res = await fetch('/api/websites');
      if (!res.ok) throw new Error('Failed to load websites');

      const data = await res.json();
      setWebsites(
        data.data?.map((w: { id: string; name: string }) => ({
          id: w.id,
          name: w.name,
        })) ?? []
      );
    } catch (error) {
      console.error('Failed to load websites:', error);
    }
  }, [accountId]);

  // Initial load
  useEffect(() => {
    const loadAuthInfo = async () => {
      try {
        const supabase = createBrowserClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          setCurrentUserId(user.id);
          setAccountId(user.id);
        }
      } catch {
        // Silent fail
      }
    };

    loadAuthInfo();
  }, []);

  useEffect(() => {
    if (accountId) {
      fetchMembers();
      fetchInvitations();
      fetchWebsites();
    }
  }, [accountId, fetchMembers, fetchInvitations, fetchWebsites]);

  // Handlers
  const handleInvite = async (data: InviteMemberData) => {
    setIsInviteSubmitting(true);
    try {
      const res = await fetch('/api/studio/invitations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error?.message ?? 'Failed to send invitation');
      }

      toast({
        title: 'Invitation Sent',
        description: `An invitation has been sent to ${data.email}`,
      });

      setIsInviteModalOpen(false);
      fetchInvitations();
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to send invitation',
        variant: 'destructive',
      });
    } finally {
      setIsInviteSubmitting(false);
    }
  };

  const handleResend = async (invitationId: string) => {
    try {
      const res = await fetch(`/api/studio/invitations/${invitationId}/resend`, {
        method: 'POST',
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error?.message ?? 'Failed to resend invitation');
      }

      toast({
        title: 'Invitation Resent',
        description: 'A new invitation email has been sent',
      });

      fetchInvitations();
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to resend invitation',
        variant: 'destructive',
      });
    }
  };

  const handleRevoke = async (invitationId: string) => {
    try {
      const res = await fetch(`/api/studio/invitations/${invitationId}/revoke`, {
        method: 'POST',
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error?.message ?? 'Failed to revoke invitation');
      }

      toast({
        title: 'Invitation Revoked',
        description: 'The invitation has been cancelled',
      });

      fetchInvitations();
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to revoke invitation',
        variant: 'destructive',
      });
    }
  };

  const handleEditMember = (member: TeamMember) => {
    setMemberToEdit({
      id: member.id,
      userId: member.userId,
      email: member.email,
      name: member.name,
      role: member.role,
      websiteAccess: member.websiteAccess,
      websiteIds: member.websiteIds,
    });
  };

  const handleUpdateMember = async (memberId: string, data: UpdateMemberData) => {
    if (!accountId) return;

    setIsEditSubmitting(true);
    try {
      const res = await fetch(`/api/studio/accounts/${accountId}/members/${memberId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error?.message ?? 'Failed to update member');
      }

      toast({
        title: 'Member Updated',
        description: 'Team member settings have been updated',
      });

      setMemberToEdit(null);
      fetchMembers();
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to update member',
        variant: 'destructive',
      });
    } finally {
      setIsEditSubmitting(false);
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!accountId) return;

    try {
      const res = await fetch(`/api/studio/accounts/${accountId}/members/${memberId}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error?.message ?? 'Failed to remove member');
      }

      toast({
        title: 'Member Removed',
        description: 'Team member has been removed from the account',
      });

      fetchMembers();
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to remove member',
        variant: 'destructive',
      });
    }
  };

  const pendingCount = invitations.filter((inv) => inv.status === 'pending').length;

  return (
    <div className="h-full overflow-y-auto">
      {/* Header */}
      <div className="p-6 border-b border-border bg-card">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-foreground">
              {isAccountWide ? 'Team' : 'Website Team'}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {isAccountWide
                ? 'Manage team members who have access to your account and all websites.'
                : `Manage team members who have access to "${contextWebsite?.name ?? 'this website'}".`}
            </p>
          </div>
          <Button onClick={() => setIsInviteModalOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Invite Member
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        <Tabs defaultValue="members" className="space-y-6">
        <TabsList className="bg-muted/50">
          <TabsTrigger value="members" className="gap-2 data-[state=inactive]:text-foreground/70">
            <Users className="h-4 w-4" />
            Members ({members.length})
          </TabsTrigger>
          <TabsTrigger value="invitations" className="gap-2 data-[state=inactive]:text-foreground/70">
            <Mail className="h-4 w-4" />
            Invitations
            {pendingCount > 0 && (
              <span className="ml-1 px-1.5 py-0.5 text-xs bg-primary text-primary-foreground rounded-full">
                {pendingCount}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="members" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
              <div>
                <CardTitle>Team Members</CardTitle>
                <CardDescription>
                  {isAccountWide
                    ? 'People who have access to your account and can be granted access to websites.'
                    : `People who have access to ${contextWebsite?.name ?? 'this website'}.`}
                </CardDescription>
              </div>
              <Button
                variant="outline"
                size="icon"
                onClick={fetchMembers}
                disabled={isLoadingMembers}
              >
                <RefreshCw className={`h-4 w-4 ${isLoadingMembers ? 'animate-spin' : ''}`} />
              </Button>
            </CardHeader>
            <CardContent>
              <TeamMembersTable
                members={members}
                currentUserId={currentUserId}
                isLoading={isLoadingMembers}
                onEdit={handleEditMember}
                onRemove={handleRemoveMember}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="invitations" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
              <div>
                <CardTitle>Pending Invitations</CardTitle>
                <CardDescription>
                  Invitations waiting for a response
                </CardDescription>
              </div>
              <Button
                variant="outline"
                size="icon"
                onClick={fetchInvitations}
                disabled={isLoadingInvitations}
              >
                <RefreshCw className={`h-4 w-4 ${isLoadingInvitations ? 'animate-spin' : ''}`} />
              </Button>
            </CardHeader>
            <CardContent>
              <PendingInvitationsTable
                invitations={invitations}
                isLoading={isLoadingInvitations}
                onResend={handleResend}
                onRevoke={handleRevoke}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      </div>

      {/* Modals */}
      <InviteMemberModal
        open={isInviteModalOpen}
        onOpenChange={setIsInviteModalOpen}
        websites={websites}
        isSubmitting={isInviteSubmitting}
        onSubmit={handleInvite}
      />

      <EditMemberModal
        open={memberToEdit !== null}
        onOpenChange={(open) => !open && setMemberToEdit(null)}
        member={memberToEdit}
        websites={websites}
        isSubmitting={isEditSubmitting}
        onSubmit={handleUpdateMember}
      />
    </div>
  );
}
