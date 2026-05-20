'use client';

import { useCallback, useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Globe,
  Plus,
  Upload,
  Settings,
  Users,
  Search,
  Edit3,
  Palette,
  ExternalLink,
  LogOut,
  LayoutTemplate,
} from 'lucide-react';
import { useWebsites } from '@/lib/api/hooks/use-websites';
import { getStudioWebsiteRoute } from '@/lib/config/deployment';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from '@/components/ui/command';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onNewWebsite: () => void;
  onImportWebsite: () => void;
  isAuthenticated: boolean;
}

interface Website {
  id: string;
  name: string;
  description?: string | null;
  icon?: string | null;
  updatedAt: string | Date;
}

// Store recent items in localStorage
const RECENT_KEY = 'command-palette-recent';
const MAX_RECENT = 5;

function getRecentItems(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const stored = localStorage.getItem(RECENT_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function addRecentItem(websiteId: string) {
  if (typeof window === 'undefined') return;
  try {
    const recent = getRecentItems().filter((id) => id !== websiteId);
    recent.unshift(websiteId);
    localStorage.setItem(RECENT_KEY, JSON.stringify(recent.slice(0, MAX_RECENT)));
  } catch {
    // Ignore localStorage errors
  }
}

export function CommandPalette({
  open,
  onOpenChange,
  onNewWebsite,
  onImportWebsite,
  isAuthenticated,
}: CommandPaletteProps) {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [recentIds, setRecentIds] = useState<string[]>([]);

  const { data: websites = [] } = useWebsites({
    enabled: isAuthenticated && open,
    refetchInterval: 0,
  });

  // Load recent items when opened
  useEffect(() => {
    if (open) {
      setRecentIds(getRecentItems());
      setSearch('');
    }
  }, [open]);

  // Filter websites by search
  const filteredWebsites = useMemo(() => {
    if (!search.trim()) return [];
    const query = search.toLowerCase();
    return (websites as Website[])
      .filter((w) => {
        const name = w.name?.toLowerCase() ?? '';
        const description = w.description?.toLowerCase() ?? '';
        return name.includes(query) || description.includes(query);
      })
      .slice(0, 10);
  }, [websites, search]);

  // Get recent websites
  const recentWebsites = useMemo(() => {
    if (search.trim()) return [];
    return recentIds
      .map((id) => (websites as Website[]).find((w) => w.id === id))
      .filter((w): w is Website => w !== undefined)
      .slice(0, MAX_RECENT);
  }, [websites, recentIds, search]);

  const handleSelect = useCallback(
    (callback: () => void) => {
      onOpenChange(false);
      callback();
    },
    [onOpenChange]
  );

  const handleWebsiteSelect = useCallback(
    (websiteId: string) => {
      addRecentItem(websiteId);
      onOpenChange(false);
      router.push(getStudioWebsiteRoute(websiteId, { legacyView: 'overview' }));
    },
    [onOpenChange, router]
  );

  const handleWebsiteAction = useCallback(
    (websiteId: string, action: 'edit' | 'team' | 'settings' | 'design' | 'preview') => {
      addRecentItem(websiteId);
      onOpenChange(false);

      switch (action) {
        case 'edit':
          router.push(getStudioWebsiteRoute(websiteId, { legacyView: 'overview' }));
          break;
        case 'team':
          router.push(`/studio/team?websiteId=${websiteId}`);
          break;
        case 'settings':
          router.push(`/studio/settings?websiteId=${websiteId}`);
          break;
        case 'design':
          router.push(getStudioWebsiteRoute(websiteId, { legacyView: 'design' }));
          break;
        case 'preview':
          router.push(`/studio/preview?websiteId=${websiteId}`);
          break;
      }
    },
    [onOpenChange, router]
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="overflow-hidden p-0 max-w-lg bg-gray-900 border-gray-700">
        <Command
          className="[&_[cmdk-group-heading]]:text-gray-400 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-item]]:px-3 [&_[cmdk-item]]:py-2.5"
          shouldFilter={false}
        >
          <div className="flex items-center border-b border-gray-700 px-3">
            <Search className="h-4 w-4 text-gray-500 shrink-0" />
            <CommandInput
              placeholder="Search websites, actions..."
              value={search}
              onValueChange={setSearch}
              className="flex-1 bg-transparent border-0 focus:ring-0 text-gray-100 placeholder:text-gray-500"
            />
            <kbd className="hidden sm:inline-flex h-5 select-none items-center gap-1 rounded border border-gray-700 bg-gray-800 px-1.5 font-mono text-[10px] text-gray-400">
              ESC
            </kbd>
          </div>
          <CommandList className="max-h-[400px]">
            <CommandEmpty className="py-6 text-center text-sm text-gray-400">
              No results found.
            </CommandEmpty>

            {/* Search Results */}
            {filteredWebsites.length > 0 && (
              <CommandGroup heading="Websites">
                {filteredWebsites.map((website) => (
                  <CommandItem
                    key={website.id}
                    value={website.id}
                    onSelect={() => handleWebsiteSelect(website.id)}
                    className="cursor-pointer text-gray-200 aria-selected:bg-gray-800"
                  >
                    <Globe className="h-4 w-4 text-gray-400" />
                    <span className="flex-1 truncate">{website.name}</span>
                    <span className="text-xs text-gray-500 truncate max-w-[150px]">
                      {website.description}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {/* Recent Websites */}
            {!search && recentWebsites.length > 0 && (
              <CommandGroup heading="Recent">
                {recentWebsites.map((website) => (
                  <CommandItem
                    key={website.id}
                    value={`recent-${website.id}`}
                    onSelect={() => handleWebsiteSelect(website.id)}
                    className="cursor-pointer text-gray-200 aria-selected:bg-gray-800"
                  >
                    <Globe className="h-4 w-4 text-gray-400" />
                    <span className="flex-1 truncate">{website.name}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {/* Quick Actions */}
            {!search && (
              <>
                <CommandSeparator className="bg-gray-700" />
                <CommandGroup heading="Actions">
                  <CommandItem
                    onSelect={() => handleSelect(onNewWebsite)}
                    className="cursor-pointer text-gray-200 aria-selected:bg-gray-800"
                  >
                    <Plus className="h-4 w-4 text-catalyst-orange" />
                    <span>Create new website</span>
                    <CommandShortcut className="text-gray-500">AI</CommandShortcut>
                  </CommandItem>
                  <CommandItem
                    onSelect={() => handleSelect(onImportWebsite)}
                    className="cursor-pointer text-gray-200 aria-selected:bg-gray-800"
                  >
                    <Upload className="h-4 w-4 text-gray-400" />
                    <span>Import website</span>
                  </CommandItem>
                </CommandGroup>
              </>
            )}

            {/* Navigation */}
            {!search && (
              <>
                <CommandSeparator className="bg-gray-700" />
                <CommandGroup heading="Navigation">
                  <CommandItem
                    onSelect={() => handleSelect(() => router.push('/dashboard'))}
                    className="cursor-pointer text-gray-200 aria-selected:bg-gray-800"
                  >
                    <LayoutTemplate className="h-4 w-4 text-gray-400" />
                    <span>Dashboard</span>
                  </CommandItem>
                  <CommandItem
                    onSelect={() => handleSelect(() => router.push('/studio/settings'))}
                    className="cursor-pointer text-gray-200 aria-selected:bg-gray-800"
                  >
                    <Settings className="h-4 w-4 text-gray-400" />
                    <span>Account Settings</span>
                  </CommandItem>
                  <CommandItem
                    onSelect={() =>
                      handleSelect(() => router.push('/studio/team?context=account'))
                    }
                    className="cursor-pointer text-gray-200 aria-selected:bg-gray-800"
                  >
                    <Users className="h-4 w-4 text-gray-400" />
                    <span>Team Management</span>
                  </CommandItem>
                </CommandGroup>
              </>
            )}
          </CommandList>

          {/* Footer */}
          <div className="flex items-center justify-between border-t border-gray-700 px-3 py-2 text-xs text-gray-500">
            <div className="flex items-center gap-2">
              <span>Navigate</span>
              <kbd className="px-1.5 py-0.5 bg-gray-800 border border-gray-700 rounded text-[10px]">
                ↑↓
              </kbd>
              <span>Select</span>
              <kbd className="px-1.5 py-0.5 bg-gray-800 border border-gray-700 rounded text-[10px]">
                ↵
              </kbd>
            </div>
            <div className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-gray-800 border border-gray-700 rounded text-[10px]">
                ⌘
              </kbd>
              <kbd className="px-1.5 py-0.5 bg-gray-800 border border-gray-700 rounded text-[10px]">
                K
              </kbd>
              <span className="ml-1">to toggle</span>
            </div>
          </div>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
