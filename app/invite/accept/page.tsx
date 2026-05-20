'use client';

/**
 * Accept Invitation Page
 *
 * Displays invitation details and allows user to accept.
 */

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Shield, User, Check, X, Loader2, AlertCircle, LogIn } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

// =============================================================================
// Types
// =============================================================================

interface InvitationData {
  id: string;
  email: string;
  role: 'admin' | 'member';
  websiteAccess: 'all' | 'specific';
  websiteNames: string[];
  status: string;
  invitedBy: {
    name: string | null;
    email: string | null;
  };
  expiresAt: string;
  account: {
    id: string;
    name: string;
  };
}

// =============================================================================
// Page Component
// =============================================================================

function AcceptInvitationContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams?.get('token') ?? null;

  const [invitation, setInvitation] = useState<InvitationData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAccepting, setIsAccepting] = useState(false);
  const [isDeclining, setIsDeclining] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);

  // Check authentication and fetch invitation
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await fetch('/api/auth/session');
        if (res.ok) {
          const session = await res.json();
          setIsAuthenticated(!!session.user);
          setCurrentUserEmail(session.user?.email ?? null);
        } else {
          setIsAuthenticated(false);
        }
      } catch {
        setIsAuthenticated(false);
      }
    };

    const fetchInvitation = async () => {
      if (!token) {
        setError('Invalid invitation link');
        setIsLoading(false);
        return;
      }

      try {
        const res = await fetch(`/api/studio/invitations/lookup?token=${token}`);

        if (!res.ok) {
          if (res.status === 404) {
            setError('This invitation was not found or has been revoked.');
          } else {
            const data = await res.json();
            setError(data.error?.message ?? 'Failed to load invitation');
          }
          setIsLoading(false);
          return;
        }

        const data = await res.json();
        setInvitation(data.data);
      } catch {
        setError('Failed to load invitation');
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
    fetchInvitation();
  }, [token]);

  // Handle accept
  const handleAccept = async () => {
    if (!invitation) return;

    setIsAccepting(true);
    try {
      const res = await fetch(`/api/studio/invitations/${invitation.id}/accept`, {
        method: 'POST',
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error?.message ?? 'Failed to accept invitation');
      }

      // Redirect to dashboard with welcome message
      const websiteName = invitation.websiteAccess === 'all'
        ? invitation.account.name
        : invitation.websiteNames.join(', ') || invitation.account.name;
      router.push(`/dashboard?welcome=invited&website=${encodeURIComponent(websiteName)}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to accept invitation');
      setIsAccepting(false);
    }
  };

  // Handle decline
  const handleDecline = async () => {
    if (!invitation) return;

    setIsDeclining(true);
    try {
      const res = await fetch(`/api/studio/invitations/${invitation.id}/decline`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error?.message ?? 'Failed to decline invitation');
      }

      router.push('/invite/decline?success=true');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to decline invitation');
      setIsDeclining(false);
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-muted/30">
        <Card className="w-full max-w-md">
          <CardHeader>
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-10 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  // Error state
  if (error && !invitation) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-muted/30">
        <Card className="w-full max-w-md">
          <CardHeader>
            <div className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-6 w-6" />
              <CardTitle>Invitation Error</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">{error}</p>
          </CardContent>
          <CardFooter>
            <Button variant="outline" asChild className="w-full">
              <Link href="/">Go to Homepage</Link>
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  if (!invitation) return null;

  // Check invitation status
  if (invitation.status !== 'pending') {
    const statusMessages: Record<string, { title: string; description: string }> = {
      accepted: {
        title: 'Already Accepted',
        description: 'This invitation has already been accepted. You may already have access.',
      },
      declined: {
        title: 'Invitation Declined',
        description: 'This invitation was previously declined.',
      },
      expired: {
        title: 'Invitation Expired',
        description: 'This invitation has expired. Please ask for a new one.',
      },
      revoked: {
        title: 'Invitation Revoked',
        description: 'This invitation is no longer valid.',
      },
    };

    const status = statusMessages[invitation.status] ?? {
      title: 'Invalid Invitation',
      description: 'This invitation cannot be used.',
    };

    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-muted/30">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>{status.title}</CardTitle>
            <CardDescription>{status.description}</CardDescription>
          </CardHeader>
          <CardFooter>
            <Button variant="outline" asChild className="w-full">
              <Link href="/">Go to Homepage</Link>
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  // Check if email matches
  const emailMismatch = currentUserEmail && currentUserEmail.toLowerCase() !== invitation.email.toLowerCase();

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-muted/30">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>You're Invited!</CardTitle>
          <CardDescription>
            {invitation.invitedBy.name ?? invitation.invitedBy.email ?? 'A team member'} invited you to join
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Account Info */}
          <div className="p-4 bg-muted rounded-lg text-center">
            <h3 className="text-xl font-semibold">{invitation.account.name}</h3>
          </div>

          {/* Role & Access */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Your Role</span>
              <Badge variant={invitation.role === 'admin' ? 'default' : 'secondary'} className="gap-1">
                {invitation.role === 'admin' ? (
                  <>
                    <Shield className="h-3 w-3" />
                    Administrator
                  </>
                ) : (
                  <>
                    <User className="h-3 w-3" />
                    Team Member
                  </>
                )}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Website Access</span>
              <span className="text-sm">
                {invitation.websiteAccess === 'all'
                  ? 'All websites'
                  : `${invitation.websiteNames.length} website${invitation.websiteNames.length !== 1 ? 's' : ''}`}
              </span>
            </div>
            {invitation.websiteAccess === 'specific' && invitation.websiteNames.length > 0 && (
              <div className="pl-4 text-sm text-muted-foreground">
                {invitation.websiteNames.join(', ')}
              </div>
            )}
          </div>

          {/* Expiry */}
          <p className="text-sm text-muted-foreground text-center">
            This invitation expires on {formatDate(invitation.expiresAt)}
          </p>

          {/* Error Alert */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Email Mismatch Warning */}
          {emailMismatch && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Different Account</AlertTitle>
              <AlertDescription>
                You're signed in as {currentUserEmail}, but this invitation was sent to{' '}
                {invitation.email}. Please sign in with the correct account.
              </AlertDescription>
            </Alert>
          )}

          {/* Not Authenticated */}
          {isAuthenticated === false && (
            <Alert>
              <LogIn className="h-4 w-4" />
              <AlertTitle>Sign Up Required</AlertTitle>
              <AlertDescription>
                Please sign up with {invitation.email} to accept this invitation.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>

        <CardFooter className="flex flex-col gap-3">
          {isAuthenticated === false ? (
            <Button asChild className="w-full">
              <Link href={`/sign-up?email=${encodeURIComponent(invitation.email)}&redirect_url=${encodeURIComponent(window.location.pathname + window.location.search)}`}>
                <LogIn className="mr-2 h-4 w-4" />
                Sign Up to Accept
              </Link>
            </Button>
          ) : emailMismatch ? (
            <Button asChild className="w-full">
              <Link href={`/sign-up?email=${encodeURIComponent(invitation.email)}&redirect_url=${encodeURIComponent(window.location.pathname + window.location.search)}`}>
                Sign Up with {invitation.email}
              </Link>
            </Button>
          ) : (
            <Button
              onClick={handleAccept}
              disabled={isAccepting || isDeclining}
              className="w-full"
            >
              {isAccepting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Check className="mr-2 h-4 w-4" />
              )}
              Accept Invitation
            </Button>
          )}

          <Button
            variant="outline"
            onClick={handleDecline}
            disabled={isAccepting || isDeclining}
            className="w-full"
          >
            {isDeclining ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <X className="mr-2 h-4 w-4" />
            )}
            Decline
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}

export default function AcceptInvitationPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center p-4 bg-muted/30">
          <Card className="w-full max-w-md">
            <CardHeader>
              <Skeleton className="h-8 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </CardHeader>
            <CardContent className="space-y-4">
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-10 w-full" />
            </CardContent>
          </Card>
        </div>
      }
    >
      <AcceptInvitationContent />
    </Suspense>
  );
}

// =============================================================================
// Helpers
// =============================================================================

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}
