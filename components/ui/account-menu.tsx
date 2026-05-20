'use client';

/**
 * Unified Account Menu (DASH-001 FIX)
 *
 * Consolidates account-level functionality into a single menu:
 * - Account Settings
 * - Team Management
 * - Help & Resources
 * - Sign Out
 *
 * This addresses the user confusion from having duplicate menus
 * (gear icon + avatar menu) with overlapping functionality.
 */

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useUser, useSupabaseClient } from '@/lib/supabase/hooks';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuGroup,
} from '@/components/ui/dropdown-menu';
import {
  LogOut,
  Settings,
  UserCircle2,
  Users,
  HelpCircle,
  BookOpen,
  MessageCircle,
  ExternalLink,
} from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';

export function AccountMenu() {
  const user = useUser();
  const supabase = useSupabaseClient();
  const router = useRouter();
  const queryClient = useQueryClient();

  const handleSignOut = useCallback(async () => {
    await supabase.auth.signOut();
    queryClient.clear();
    router.replace('/sign-in');
  }, [queryClient, router, supabase]);

  const handleOpenSettings = useCallback(() => {
    router.push('/studio/settings');
  }, [router]);

  const handleOpenTeam = useCallback(() => {
    router.push('/studio/team?context=account');
  }, [router]);

  if (!user) {
    return null;
  }

  const metadata = user.user_metadata as Record<string, any> | null | undefined;
  const email = user.email ?? metadata?.email ?? 'Signed in';
  const initials = email.slice(0, 2).toUpperCase();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="size-10 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 font-semibold"
          data-testid="account-menu-trigger"
        >
          {initials}
          <span className="sr-only">Open account menu</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-64 rounded-lg border bg-popover p-2 text-popover-foreground shadow-lg"
      >
        {/* User Info */}
        <DropdownMenuLabel className="flex items-center gap-3" data-testid="account-menu-email">
          <UserCircle2 className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
          <div className="flex flex-col">
            <span className="text-xs uppercase tracking-wide text-muted-foreground">Signed in as</span>
            <span className="truncate text-sm font-medium">{email}</span>
          </div>
        </DropdownMenuLabel>

        <DropdownMenuSeparator />

        {/* Account Section */}
        <DropdownMenuGroup>
          <DropdownMenuItem
            onSelect={handleOpenSettings}
            className="cursor-pointer focus:bg-accent focus:text-accent-foreground"
          >
            <Settings className="mr-2 h-4 w-4" aria-hidden="true" />
            Account Settings
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={handleOpenTeam}
            className="cursor-pointer focus:bg-accent focus:text-accent-foreground"
          >
            <Users className="mr-2 h-4 w-4" aria-hidden="true" />
            Team Management
          </DropdownMenuItem>
        </DropdownMenuGroup>

        <DropdownMenuSeparator />

        {/* Help Section */}
        <DropdownMenuGroup>
          <DropdownMenuLabel className="flex items-center gap-2 text-xs text-muted-foreground py-1">
            <HelpCircle className="h-3 w-3" />
            Help & Resources
          </DropdownMenuLabel>
          <DropdownMenuItem asChild>
            <a
              href="https://docs.catalyststudio.com/getting-started"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between cursor-pointer"
            >
              <span className="flex items-center">
                <BookOpen className="mr-2 h-4 w-4" />
                Getting Started
              </span>
              <ExternalLink className="h-3 w-3 text-muted-foreground" />
            </a>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <a
              href="https://docs.catalyststudio.com"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between cursor-pointer"
            >
              <span className="flex items-center">
                <BookOpen className="mr-2 h-4 w-4" />
                Documentation
              </span>
              <ExternalLink className="h-3 w-3 text-muted-foreground" />
            </a>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <a
              href="mailto:support@catalyststudio.com"
              className="flex items-center cursor-pointer"
            >
              <MessageCircle className="mr-2 h-4 w-4" />
              Contact Support
            </a>
          </DropdownMenuItem>
        </DropdownMenuGroup>

        <DropdownMenuSeparator />

        {/* Sign Out */}
        <DropdownMenuItem
          onSelect={() => {
            void handleSignOut();
          }}
          className="cursor-pointer text-destructive focus:bg-destructive/10 focus:text-destructive"
          data-testid="account-menu-sign-out"
        >
          <LogOut className="mr-2 h-4 w-4" aria-hidden="true" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
