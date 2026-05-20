'use client';

import { useCallback, useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Search, Plus, Upload, X, Settings, Users, LogOut, Sparkles } from 'lucide-react';
import { useAuthActions, useUser } from '@/lib/auth/hooks';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

interface DashboardTopBarProps {
  onNewWebsite: () => void;
  onImportWebsite: () => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  isAuthenticated: boolean;
}

export function DashboardTopBar({
  onNewWebsite,
  onImportWebsite,
  searchQuery,
  onSearchChange,
  isAuthenticated,
}: DashboardTopBarProps) {
  const router = useRouter();
  const user = useUser();
  const { signOut } = useAuthActions();
  const queryClient = useQueryClient();
  const [localSearch, setLocalSearch] = useState(searchQuery);
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    debounceRef.current = setTimeout(() => {
      onSearchChange(localSearch);
    }, 300);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [localSearch, onSearchChange]);

  // Sync external changes
  useEffect(() => {
    setLocalSearch(searchQuery);
  }, [searchQuery]);

  const handleSignOut = useCallback(async () => {
    await signOut();
    queryClient.clear();
    router.replace('/sign-in');
  }, [queryClient, router, signOut]);

  const handleClearSearch = useCallback(() => {
    setLocalSearch('');
    onSearchChange('');
    searchInputRef.current?.focus();
  }, [onSearchChange]);

  const handleSearchKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      handleClearSearch();
      setIsSearchExpanded(false);
    }
  }, [handleClearSearch]);

  const metadata = user?.user_metadata as Record<string, unknown> | null | undefined;
  const email = user?.email ?? (metadata?.email as string) ?? 'Signed in';
  const initials = email.slice(0, 2).toUpperCase();

  return (
    <header className="sticky top-0 z-50 h-[60px] bg-gray-950 border-b border-gray-800">
      <div className="h-full px-4 lg:px-6 flex items-center justify-between gap-4">
        {/* Left: Logo + Search */}
        <div className="flex items-center gap-4 flex-1 min-w-0">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 shrink-0"
            aria-label="Go to dashboard"
          >
            <Sparkles className="h-6 w-6 text-catalyst-orange" />
            <span className="hidden sm:inline font-semibold text-white text-lg">
              Catalyst Studio
            </span>
          </Link>

          {/* Search - Desktop */}
          <div className="hidden md:flex relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
            <Input
              ref={searchInputRef}
              type="text"
              placeholder="Search websites..."
              value={localSearch}
              onChange={(e) => setLocalSearch(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              className={cn(
                'pl-10 pr-10 h-9 bg-gray-900 border-gray-700 text-gray-100',
                'placeholder:text-gray-500 focus:border-catalyst-orange focus:ring-catalyst-orange/20'
              )}
              aria-label="Search websites"
            />
            {localSearch && (
              <button
                onClick={handleClearSearch}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                aria-label="Clear search"
                type="button"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Search - Mobile (collapsible) */}
          <div className="md:hidden flex items-center">
            {isSearchExpanded ? (
              <div className="relative flex-1">
                <Input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Search..."
                  value={localSearch}
                  onChange={(e) => setLocalSearch(e.target.value)}
                  onKeyDown={handleSearchKeyDown}
                  onBlur={() => !localSearch && setIsSearchExpanded(false)}
                  autoFocus
                  className="h-9 bg-gray-900 border-gray-700 text-gray-100 w-full"
                  aria-label="Search websites"
                />
              </div>
            ) : (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsSearchExpanded(true)}
                className="text-gray-400 hover:text-white"
                aria-label="Open search"
              >
                <Search className="h-5 w-5" />
              </Button>
            )}
          </div>
        </div>

        {/* Right: Actions + User Menu */}
        <div className="flex items-center gap-2 shrink-0">
          {isAuthenticated && (
            <>
              {/* Import Button - Secondary */}
              <Button
                variant="ghost"
                size="sm"
                onClick={onImportWebsite}
                className="hidden sm:flex items-center gap-2 text-gray-300 hover:text-white hover:bg-gray-800"
              >
                <Upload className="h-4 w-4" />
                <span className="hidden lg:inline">Import</span>
              </Button>

              {/* New Website Button - Primary */}
              <Button
                size="sm"
                onClick={onNewWebsite}
                className="bg-catalyst-orange hover:bg-catalyst-orange/90 text-gray-950 font-semibold"
              >
                <Plus className="h-4 w-4 mr-1" />
                <span className="hidden sm:inline">New Website</span>
                <span className="sm:hidden">New</span>
              </Button>
            </>
          )}

          {/* User Menu */}
          {isAuthenticated && user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 rounded-full bg-gray-800 text-gray-200 hover:bg-gray-700 font-medium"
                  aria-label="Open user menu"
                >
                  {initials}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="w-56 bg-gray-900 border-gray-700 text-gray-200"
              >
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-xs text-gray-400">Signed in as</p>
                    <p className="text-sm font-medium truncate">{email}</p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-gray-700" />
                <DropdownMenuItem
                  onClick={() => router.push('/studio/settings')}
                  className="cursor-pointer hover:bg-gray-800 focus:bg-gray-800"
                >
                  <Settings className="mr-2 h-4 w-4" />
                  Account Settings
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => router.push('/studio/team?context=account')}
                  className="cursor-pointer hover:bg-gray-800 focus:bg-gray-800"
                >
                  <Users className="mr-2 h-4 w-4" />
                  Team Management
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-gray-700" />
                <DropdownMenuItem
                  onClick={() => void handleSignOut()}
                  className="cursor-pointer text-red-400 hover:bg-gray-800 focus:bg-gray-800 focus:text-red-400"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push('/sign-in')}
              className="border-gray-700 text-gray-300 hover:bg-gray-800"
            >
              Sign in
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
