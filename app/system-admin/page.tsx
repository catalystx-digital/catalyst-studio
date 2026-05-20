'use client';

/**
 * System Admin Dashboard
 *
 * Dashboard for system administrators to manage users and impersonation.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  Search,
  UserCog,
  Users,
  Play,
  Square,
  Shield,
  ShieldOff,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useToast } from '@/components/ui/use-toast';
import { Skeleton } from '@/components/ui/skeleton';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

// =============================================================================
// Types
// =============================================================================

interface User {
  id: string;
  email: string | null;
  name: string | null;
  createdAt: string;
  accounts: {
    accountId: string;
    accountName: string;
    role: string;
  }[];
}

interface SystemAdmin {
  userId: string;
  email: string | null;
  name: string | null;
  isActive: boolean;
  grantedAt: string;
}

interface ImpersonationSession {
  id: string;
  targetUserId: string;
  targetAccountId: string;
  reason: string;
  startedAt: string;
}

// =============================================================================
// Page Component
// =============================================================================

export default function SystemAdminPage() {
  const { toast } = useToast();

  // State
  const [users, setUsers] = useState<User[]>([]);
  const [admins, setAdmins] = useState<SystemAdmin[]>([]);
  const [activeSession, setActiveSession] = useState<ImpersonationSession | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [isLoadingAdmins, setIsLoadingAdmins] = useState(true);
  const [isLoadingSession, setIsLoadingSession] = useState(true);

  const [impersonateDialog, setImpersonateDialog] = useState<{
    user: User;
    accountId: string;
    accountName: string;
  } | null>(null);
  const [impersonateReason, setImpersonateReason] = useState('');
  const [isImpersonating, setIsImpersonating] = useState(false);
  const [isEndingSession, setIsEndingSession] = useState(false);

  // Fetch functions
  const fetchActiveSession = useCallback(async () => {
    setIsLoadingSession(true);
    try {
      const res = await fetch('/api/system-admin/impersonate');
      if (res.ok) {
        const data = await res.json();
        setActiveSession(data.data);
      }
    } catch {
      // Silently fail
    } finally {
      setIsLoadingSession(false);
    }
  }, []);

  const fetchAdmins = useCallback(async () => {
    setIsLoadingAdmins(true);
    try {
      const res = await fetch('/api/system-admin/admins');
      if (res.ok) {
        const data = await res.json();
        setAdmins(data.data.admins);
      }
    } catch {
      // Silently fail
    } finally {
      setIsLoadingAdmins(false);
    }
  }, []);

  const searchUsers = useCallback(async (query: string) => {
    if (!query.trim()) {
      setUsers([]);
      return;
    }

    setIsLoadingUsers(true);
    try {
      const res = await fetch(`/api/system-admin/users?q=${encodeURIComponent(query)}`);
      if (res.ok) {
        const data = await res.json();
        setUsers(data.data.users);
      }
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to search users',
        variant: 'destructive',
      });
    } finally {
      setIsLoadingUsers(false);
    }
  }, [toast]);

  // Initial load
  useEffect(() => {
    fetchActiveSession();
    fetchAdmins();
  }, [fetchActiveSession, fetchAdmins]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      searchUsers(searchQuery);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, searchUsers]);

  // Handlers
  const handleStartImpersonation = async () => {
    if (!impersonateDialog) return;

    setIsImpersonating(true);
    try {
      const res = await fetch('/api/system-admin/impersonate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetUserId: impersonateDialog.user.id,
          targetAccountId: impersonateDialog.accountId,
          reason: impersonateReason,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error?.message ?? 'Failed to start impersonation');
      }

      const data = await res.json();
      setActiveSession(data.data);
      setImpersonateDialog(null);
      setImpersonateReason('');

      toast({
        title: 'Impersonation Started',
        description: `Now impersonating ${impersonateDialog.user.email}`,
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to start impersonation',
        variant: 'destructive',
      });
    } finally {
      setIsImpersonating(false);
    }
  };

  const handleEndImpersonation = async () => {
    if (!activeSession) return;

    setIsEndingSession(true);
    try {
      const res = await fetch(`/api/system-admin/impersonate/${activeSession.id}/end`, {
        method: 'POST',
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error?.message ?? 'Failed to end impersonation');
      }

      setActiveSession(null);
      toast({
        title: 'Impersonation Ended',
        description: 'Session has been terminated',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to end impersonation',
        variant: 'destructive',
      });
    } finally {
      setIsEndingSession(false);
    }
  };

  const handleRevokeAdmin = async (userId: string) => {
    try {
      const res = await fetch(`/api/system-admin/admins/${userId}/revoke`, {
        method: 'POST',
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error?.message ?? 'Failed to revoke admin');
      }

      toast({
        title: 'Admin Revoked',
        description: 'System admin status has been revoked',
      });

      fetchAdmins();
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to revoke admin',
        variant: 'destructive',
      });
    }
  };

  const handleGrantAdmin = async (userId: string, email: string | null) => {
    try {
      const res = await fetch('/api/system-admin/admins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error?.message ?? 'Failed to grant admin');
      }

      toast({
        title: 'Admin Granted',
        description: `${email ?? 'User'} is now a system admin`,
      });

      fetchAdmins();
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to grant admin',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="container max-w-6xl py-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">System Admin</h1>
        <p className="text-muted-foreground">
          Manage platform users and impersonation sessions.
        </p>
      </div>

      {/* Active Impersonation Banner */}
      {isLoadingSession ? (
        <Skeleton className="h-16 w-full" />
      ) : activeSession ? (
        <Alert className="border-yellow-500 bg-yellow-50 dark:bg-yellow-950">
          <AlertCircle className="h-4 w-4 text-yellow-600" />
          <AlertTitle className="text-yellow-800 dark:text-yellow-200">
            Active Impersonation Session
          </AlertTitle>
          <AlertDescription className="flex items-center justify-between">
            <span className="text-yellow-700 dark:text-yellow-300">
              Impersonating user since {formatDate(activeSession.startedAt)}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={handleEndImpersonation}
              disabled={isEndingSession}
              className="border-yellow-500 hover:bg-yellow-100"
            >
              {isEndingSession ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Square className="mr-2 h-4 w-4" />
              )}
              End Session
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}

      <Tabs defaultValue="users" className="space-y-6">
        <TabsList>
          <TabsTrigger value="users" className="gap-2">
            <Users className="h-4 w-4" />
            User Lookup
          </TabsTrigger>
          <TabsTrigger value="admins" className="gap-2">
            <UserCog className="h-4 w-4" />
            System Admins
          </TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>User Lookup</CardTitle>
              <CardDescription>
                Search for users to view their accounts or start an impersonation session.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search by email or name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>

              {isLoadingUsers ? (
                <div className="space-y-2">
                  {[...Array(3)].map((_, i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : users.length === 0 ? (
                <p className="text-center py-8 text-muted-foreground">
                  {searchQuery ? 'No users found' : 'Search for a user to get started'}
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Accounts</TableHead>
                      <TableHead className="w-[100px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell>
                          <div>
                            <div className="font-medium">{user.name ?? 'No name'}</div>
                            <div className="text-sm text-muted-foreground">{user.email}</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {user.accounts.map((acc) => (
                              <Badge
                                key={acc.accountId}
                                variant="outline"
                                className="cursor-pointer hover:bg-muted"
                                onClick={() =>
                                  setImpersonateDialog({
                                    user,
                                    accountId: acc.accountId,
                                    accountName: acc.accountName,
                                  })
                                }
                              >
                                {acc.accountName}
                                {acc.role === 'admin' && (
                                  <Shield className="ml-1 h-3 w-3" />
                                )}
                              </Badge>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            {user.accounts.length > 0 && (
                              <Button
                                variant="ghost"
                                size="sm"
                                disabled={!!activeSession}
                                onClick={() =>
                                  setImpersonateDialog({
                                    user,
                                    accountId: user.accounts[0].accountId,
                                    accountName: user.accounts[0].accountName,
                                  })
                                }
                              >
                                <Play className="mr-2 h-4 w-4" />
                                Impersonate
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleGrantAdmin(user.id, user.email)}
                            >
                              <Shield className="mr-2 h-4 w-4" />
                              Grant Admin
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="admins" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>System Administrators</CardTitle>
              <CardDescription>
                Users with system-wide administrative access.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingAdmins ? (
                <div className="space-y-2">
                  {[...Array(2)].map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : admins.length === 0 ? (
                <p className="text-center py-8 text-muted-foreground">No system admins found</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Admin</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Granted</TableHead>
                      <TableHead className="w-[100px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {admins.map((admin) => (
                      <TableRow key={admin.userId}>
                        <TableCell>
                          <div>
                            <div className="font-medium">{admin.name ?? 'No name'}</div>
                            <div className="text-sm text-muted-foreground">{admin.email}</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={admin.isActive ? 'default' : 'secondary'}>
                            {admin.isActive ? 'Active' : 'Inactive'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {formatDate(admin.grantedAt)}
                        </TableCell>
                        <TableCell>
                          {admin.isActive && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-destructive"
                              onClick={() => handleRevokeAdmin(admin.userId)}
                            >
                              <ShieldOff className="mr-2 h-4 w-4" />
                              Revoke
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Impersonate Dialog */}
      <Dialog
        open={!!impersonateDialog}
        onOpenChange={(open) => !open && setImpersonateDialog(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Start Impersonation</DialogTitle>
            <DialogDescription>
              You are about to impersonate {impersonateDialog?.user.email} in the account "
              {impersonateDialog?.accountName}". This action will be logged.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="reason">Reason (required)</Label>
              <Textarea
                id="reason"
                placeholder="e.g., Support ticket #12345 - User cannot access settings"
                value={impersonateReason}
                onChange={(e) => setImpersonateReason(e.target.value)}
                rows={3}
              />
              <p className="text-sm text-muted-foreground">
                Provide a detailed reason for this impersonation session.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setImpersonateDialog(null)}
              disabled={isImpersonating}
            >
              Cancel
            </Button>
            <Button
              onClick={handleStartImpersonation}
              disabled={isImpersonating || impersonateReason.trim().length < 10}
            >
              {isImpersonating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Start Impersonation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// =============================================================================
// Helpers
// =============================================================================

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}
