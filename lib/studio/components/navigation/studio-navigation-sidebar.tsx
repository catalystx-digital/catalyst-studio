'use client';

/**
 * Studio Navigation Sidebar
 *
 * Navigation sidebar for studio studio pages.
 * All routes point to /studio/ paths with websiteId as query param.
 *
 * Features:
 * - Collapsible with localStorage persistence
 * - Tooltips when collapsed
 * - Smooth transition animations
 */

import React, { useMemo, useState, useCallback, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Home,
  Database,
  Eye,
  BarChart3,
  Plug2,
  Settings,
  Rocket,
  Loader2,
  Users,
  Palette,
  Map,
  ChevronDown,
  PanelLeftClose,
  PanelLeft,
  Check,
  Plus,
  ExternalLink,
  Globe,
} from 'lucide-react';
import { useWebsiteContext } from '@/lib/context/website-context';
import { useWebsites } from '@/lib/api/hooks/use-websites';
import { cn } from '@/lib/utils';

const SIDEBAR_COLLAPSED_KEY = 'catalyst-sidebar-collapsed';

interface NavItem {
  id: string;
  label: string;
  href: string;
  icon: React.ReactNode;
  tooltip?: string;
}

export const StudioNavigationSidebar = React.memo(function StudioNavigationSidebar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();

  // Get websiteId from query params
  const websiteId = searchParams?.get('websiteId') ?? null;

  // Fetch all websites for the switcher dropdown
  const { data: allWebsites = [], isLoading: isLoadingWebsites } = useWebsites({
    enabled: true,
    refetchInterval: 120_000, // 2 minutes - less aggressive for sidebar
  });

  // Try to get website context (may not be available if no websiteId)
  let websiteContext: ReturnType<typeof useWebsiteContext> | null = null;
  try {
    websiteContext = useWebsiteContext();
  } catch {
    // Context not available
  }

  const website = websiteContext?.website;

  // Collapsed state with localStorage persistence
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);

  // Load collapsed state from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(SIDEBAR_COLLAPSED_KEY);
    if (stored !== null) {
      setIsCollapsed(stored === 'true');
    }
    setIsHydrated(true);
  }, []);

  // Toggle collapsed state and persist to localStorage
  const toggleCollapsed = useCallback(() => {
    setIsCollapsed(prev => {
      const next = !prev;
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(next));
      return next;
    });
  }, []);

  // Build URL with websiteId query param
  const buildUrl = useCallback((path: string) => {
    return websiteId ? `${path}?websiteId=${websiteId}` : path;
  }, [websiteId]);

  // Account-level links (not website-specific)
  const accountLinks: NavItem[] = useMemo(() => [
    {
      id: 'home',
      label: 'Dashboard',
      href: '/dashboard',
      icon: <Home className="h-4 w-4" />,
      tooltip: 'Return to main dashboard',
    },
  ], []);

  // Website-level links (require website context) - flat structure, no nested sections
  const websiteLinks: NavItem[] = useMemo(() => [
    {
      id: 'site-builder',
      label: 'Pages',
      href: buildUrl('/studio/site-builder'),
      icon: <Map className="h-4 w-4" />,
      tooltip: 'Visual page editor',
    },
    {
      id: 'content-types',
      label: 'Content Types',
      href: buildUrl('/studio/content-types'),
      icon: <Database className="h-4 w-4" />,
      tooltip: 'Manage page, component, and folder types',
    },
    {
      id: 'design-system',
      label: 'Colors & Styles',
      href: buildUrl('/studio/design-system'),
      icon: <Palette className="h-4 w-4" />,
      tooltip: 'Customize your brand colors and styles',
    },
    {
      id: 'preview',
      label: 'Preview',
      href: buildUrl('/studio/preview'),
      icon: <Eye className="h-4 w-4" />,
      tooltip: 'Preview your website on different devices',
    },
    {
      id: 'deploy',
      label: 'Publish',
      href: buildUrl('/studio/deployment'),
      icon: <Rocket className="h-4 w-4" />,
      tooltip: 'Publish your website changes',
    },
    {
      id: 'integrations',
      label: 'Integrations',
      href: buildUrl('/studio/integrations'),
      icon: <Plug2 className="h-4 w-4" />,
      tooltip: 'Connect to your CMS platform',
    },
    {
      id: 'settings',
      label: 'Website Settings',
      href: buildUrl('/studio/settings') + (websiteId ? '&tab=general' : '?tab=general'),
      icon: <Settings className="h-4 w-4" />,
      tooltip: 'Configure this website',
    },
  ], [buildUrl, websiteId]);

  // Account settings items (not website-specific)
  const accountSettingsItems: NavItem[] = useMemo(() => [
    {
      id: 'team',
      label: 'Team',
      href: '/studio/team',
      icon: <Users className="h-4 w-4" />,
      tooltip: 'Manage team members',
    },
    {
      id: 'usage',
      label: 'Usage & Quotas',
      href: '/studio/settings?tab=usage',
      icon: <BarChart3 className="h-4 w-4" />,
      tooltip: 'View account usage and quotas',
    },
  ], []);

  // Switch to a different website
  const switchToWebsite = useCallback((newWebsiteId: string) => {
    if (!pathname) return;
    // Build new URL with the selected website's ID
    const newUrl = `${pathname}?websiteId=${newWebsiteId}`;
    router.push(newUrl);
  }, [pathname, router]);

  // Get limited list of websites for dropdown (max 10)
  const displayWebsites = useMemo(() => {
    return allWebsites.slice(0, 10);
  }, [allWebsites]);

  const isActive = useCallback((href: string) => {
    if (!pathname) return false;

    // Parse href to get path and query params
    const [hrefPath, hrefQuery] = href.split('?');
    const hrefParams = new URLSearchParams(hrefQuery || '');
    const hrefTab = hrefParams.get('tab');

    // Get current tab from search params
    const currentTab = searchParams?.get('tab');

    // For settings page with tabs, require tab match
    if (hrefPath === '/studio/settings' || hrefPath.endsWith('/studio/settings')) {
      const pathMatches = pathname === hrefPath || pathname.endsWith('/studio/settings');
      if (!pathMatches) return false;

      // If href specifies a tab, current tab must match exactly
      if (hrefTab) {
        // 'general' tab matches both explicit 'general' and no tab (default)
        if (hrefTab === 'general') {
          return !currentTab || currentTab === 'general';
        }
        return currentTab === hrefTab;
      }
      // If href has no tab, only active when current has no tab
      return !currentTab;
    }

    // For other paths, use path-based matching
    return pathname === hrefPath || pathname.startsWith(hrefPath + '/');
  }, [pathname, searchParams]);

  const renderDirectLink = (item: NavItem) => {
    const active = isActive(item.href);

    const linkButton = (
      <Link key={item.id} href={item.href}>
        <Button
          variant={active ? 'secondary' : 'ghost'}
          className={cn(
            'w-full text-sm font-medium transition-colors',
            isCollapsed ? 'justify-center px-2' : 'justify-start',
            active
              ? 'bg-primary/10 text-primary hover:bg-primary/15'
              : 'text-muted-foreground hover:text-foreground hover:bg-accent',
          )}
        >
          {item.icon}
          {!isCollapsed && <span className="ml-2">{item.label}</span>}
        </Button>
      </Link>
    );

    // Always show tooltip when collapsed, otherwise show if item has tooltip
    const tooltipLabel = isCollapsed ? item.label : item.tooltip;

    if (tooltipLabel) {
      return (
        <TooltipProvider key={item.id}>
          <Tooltip>
            <TooltipTrigger asChild>
              {linkButton}
            </TooltipTrigger>
            <TooltipContent side="right">
              <p>{tooltipLabel}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    }

    return linkButton;
  };

  // Prevent layout shift during hydration
  const sidebarWidth = isCollapsed ? 'w-[68px]' : 'w-[260px]';

  return (
    <nav className={cn(
      'flex h-full flex-col border-r bg-card transition-all duration-200',
      isHydrated ? sidebarWidth : 'w-[260px]'
    )}>
      {/* Header Section */}
      <div className="border-b p-4">
        <div className={cn('flex items-center', isCollapsed ? 'justify-center' : 'gap-3')}>
          <div className="flex size-11 items-center justify-center rounded-lg bg-primary text-primary-foreground flex-shrink-0">
            <span className="text-sm font-semibold">C</span>
          </div>
          {!isCollapsed && (
            <div className="overflow-hidden">
              <h2 className="text-base font-semibold">Catalyst Studio</h2>
              <p className="text-xs text-muted-foreground">Studio Edition</p>
            </div>
          )}
        </div>
      </div>

      {/* Website Switcher */}
      {!isCollapsed && (
        <div className="border-b px-3 py-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="w-full justify-between px-2 py-1.5 h-auto text-left hover:bg-accent"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Globe className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">Current website</p>
                    <p className="text-sm font-medium truncate">
                      {website?.name ?? 'Select website'}
                    </p>
                  </div>
                </div>
                <ChevronDown className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-[220px]">
              {/* Website list */}
              {isLoadingWebsites ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              ) : displayWebsites.length === 0 ? (
                <div className="py-4 text-center text-sm text-muted-foreground">
                  No websites found
                </div>
              ) : (
                <>
                  {displayWebsites.map((site) => (
                    <DropdownMenuItem
                      key={site.id}
                      onClick={() => switchToWebsite(site.id)}
                      className="flex items-center gap-2 cursor-pointer"
                    >
                      <Check
                        className={cn(
                          'h-4 w-4 flex-shrink-0',
                          site.id === websiteId ? 'opacity-100' : 'opacity-0'
                        )}
                      />
                      <span className="truncate">{site.name}</span>
                    </DropdownMenuItem>
                  ))}
                  {allWebsites.length > 10 && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem asChild>
                        <Link href="/dashboard" className="flex items-center gap-2 cursor-pointer">
                          <ExternalLink className="h-4 w-4 flex-shrink-0" />
                          <span>View all websites ({allWebsites.length})</span>
                        </Link>
                      </DropdownMenuItem>
                    </>
                  )}
                </>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/dashboard?action=create" className="flex items-center gap-2 cursor-pointer">
                  <Plus className="h-4 w-4 flex-shrink-0" />
                  <span>Create new website</span>
                </Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
      {/* Website icon when collapsed */}
      {isCollapsed && websiteId && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="border-b py-3 flex justify-center">
                <Globe className="h-4 w-4 text-muted-foreground" />
              </div>
            </TooltipTrigger>
            <TooltipContent side="right">
              <p>{website?.name ?? 'Current website'}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}

      {/* Navigation Content */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="flex flex-col gap-1">
          {/* Account-Level Links */}
          {accountLinks.map(renderDirectLink)}

          {/* Website Context Section - only show if website is selected */}
          {websiteId && (
            <>
              {/* Website Label */}
              {!isCollapsed && (
                <div className="mt-4 mb-1 px-2">
                  <span className="text-xs font-medium uppercase tracking-wider text-primary/70">
                    Website
                  </span>
                </div>
              )}

              {/* Website Links - flat structure */}
              {websiteLinks.map(renderDirectLink)}
            </>
          )}

          {/* Account Section */}
          {!isCollapsed && (
            <div className="mt-4 mb-1 px-2">
              <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground/70">
                Account
              </span>
            </div>
          )}
          <div className={cn(isCollapsed && 'border-t mt-2 pt-2')}>
            {accountSettingsItems.map(renderDirectLink)}
          </div>
        </div>
      </div>

      {/* Footer Section with Collapse Toggle */}
      <div className="border-t p-4">
        <div className={cn('flex items-center', isCollapsed ? 'justify-center' : 'justify-between')}>
          {!isCollapsed && (
            <p className="text-xs text-muted-foreground">
              v2.0.0 Studio
            </p>
          )}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                  onClick={toggleCollapsed}
                  aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                >
                  {isCollapsed ? (
                    <PanelLeft className="h-4 w-4" />
                  ) : (
                    <PanelLeftClose className="h-4 w-4" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">
                <p>{isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>
    </nav>
  );
});
