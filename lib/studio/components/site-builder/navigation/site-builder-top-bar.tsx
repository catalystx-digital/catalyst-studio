'use client';

/**
 * Site Builder Top Bar
 *
 * Top navigation bar with logo menu, website selector, and action buttons.
 * Height: 48px
 */

import React, { useMemo, useCallback } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Home,
  Map,
  Database,
  Palette,
  Eye,
  Rocket,
  Plug2,
  Settings,
  Users,
  BarChart3,
  HelpCircle,
  Keyboard,
  ChevronDown,
  Check,
  Globe,
  Plus,
  ExternalLink,
  Loader2,
  FileText,
  Sparkles,
} from 'lucide-react';
import { useWebsiteContext } from '@/lib/context/website-context';
import { useWebsites } from '@/lib/api/hooks/use-websites';
import { cn } from '@/lib/utils';
import type { WebsiteIconValue } from '@/types/api';

interface SiteBuilderTopBarProps {
  websiteId: string | null;
  onHelpClick?: () => void;
  onShortcutsClick?: () => void;
  onGenerateProposal?: () => void;
  onAISuggestions?: () => void;
}

function getWebsiteIconUrl(icon: WebsiteIconValue | null | undefined): string | null {
  if (typeof icon === 'string') {
    const trimmed = icon.trim();
    return trimmed.startsWith('/') || trimmed.startsWith('http://') || trimmed.startsWith('https://')
      ? trimmed
      : null;
  }

  if (!icon || typeof icon !== 'object') {
    return null;
  }

  return icon.signedUrl ?? icon.publicUrl ?? icon.originalUrl ?? null;
}

export function SiteBuilderTopBar({
  websiteId,
  onHelpClick,
  onShortcutsClick,
  onGenerateProposal,
  onAISuggestions,
}: SiteBuilderTopBarProps) {
  const pathname = usePathname();
  const router = useRouter();

  // Try to get website context
  let websiteContext: ReturnType<typeof useWebsiteContext> | null = null;
  try {
    websiteContext = useWebsiteContext();
  } catch {
    // Context not available
  }

  const website = websiteContext?.website;
  const websiteIconUrl = getWebsiteIconUrl(website?.icon);

  // Fetch all websites for the switcher dropdown
  const { data: allWebsites = [], isLoading: isLoadingWebsites } = useWebsites({
    enabled: true,
    refetchInterval: 120_000,
  });

  const displayWebsites = useMemo(() => allWebsites.slice(0, 10), [allWebsites]);

  const buildUrl = useCallback((path: string) => {
    return websiteId ? `${path}?websiteId=${websiteId}` : path;
  }, [websiteId]);

  const switchToWebsite = useCallback((newWebsiteId: string) => {
    if (!pathname) return;
    const newUrl = `${pathname}?websiteId=${newWebsiteId}`;
    router.push(newUrl);
  }, [pathname, router]);

  // Check if current page matches
  const isActive = useCallback((href: string) => {
    if (!pathname) return false;
    const [hrefPath] = href.split('?');
    return pathname === hrefPath || pathname.startsWith(hrefPath + '/');
  }, [pathname]);

  // Menu items for the logo dropdown
  const menuItems = useMemo(() => [
    { type: 'item' as const, id: 'dashboard', label: 'Dashboard', href: '/dashboard', icon: Home },
    { type: 'separator' as const },
    { type: 'item' as const, id: 'pages', label: 'Pages', href: buildUrl('/studio/site-builder'), icon: Map, current: true },
    { type: 'item' as const, id: 'page-templates', label: 'Page Templates', href: buildUrl('/studio/content-types'), icon: Database },
    { type: 'item' as const, id: 'design-system', label: 'Colors & Styles', href: buildUrl('/studio/design-system'), icon: Palette },
    { type: 'item' as const, id: 'preview', label: 'Preview', href: buildUrl('/studio/preview'), icon: Eye },
    { type: 'item' as const, id: 'publish', label: 'Publish', href: buildUrl('/studio/deployment'), icon: Rocket },
    { type: 'item' as const, id: 'integrations', label: 'Integrations', href: buildUrl('/studio/integrations'), icon: Plug2 },
    { type: 'item' as const, id: 'settings', label: 'Website Settings', href: buildUrl('/studio/settings') + (websiteId ? '&tab=general' : '?tab=general'), icon: Settings },
    { type: 'separator' as const },
    { type: 'action' as const, id: 'generate-proposal', label: 'Generate Proposal', icon: FileText, onClick: onGenerateProposal },
    { type: 'action' as const, id: 'ai-suggestions', label: 'AI Suggestions', icon: Sparkles, onClick: onAISuggestions },
    { type: 'separator' as const },
    { type: 'item' as const, id: 'team', label: 'Team', href: '/studio/team', icon: Users },
    { type: 'item' as const, id: 'usage', label: 'Usage & Quotas', href: '/studio/settings?tab=usage', icon: BarChart3 },
    { type: 'separator' as const },
    { type: 'action' as const, id: 'help', label: 'Help', icon: HelpCircle, onClick: onHelpClick },
    { type: 'action' as const, id: 'shortcuts', label: 'Keyboard Shortcuts', icon: Keyboard, onClick: onShortcutsClick },
  ], [buildUrl, websiteId, onHelpClick, onShortcutsClick, onGenerateProposal, onAISuggestions]);

  return (
    <header
      className="h-12 border-b border-border bg-card flex items-center justify-between px-2"
      role="banner"
    >
      {/* Left Section */}
      <div className="flex items-center gap-2">
        {/* Logo Menu Button */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-10 w-10 p-0 hover:bg-accent"
            >
              <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <span className="text-xs font-semibold">C</span>
              </div>
              <ChevronDown className="h-3 w-3 ml-0.5 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            {menuItems.map((item, index) => {
              if (item.type === 'separator') {
                return <DropdownMenuSeparator key={`sep-${index}`} />;
              }

              if (item.type === 'action') {
                const Icon = item.icon;
                return (
                  <DropdownMenuItem
                    key={item.id}
                    onClick={item.onClick}
                    className="cursor-pointer"
                  >
                    <Icon className="h-4 w-4 mr-2" />
                    {item.label}
                  </DropdownMenuItem>
                );
              }

              const Icon = item.icon;
              const active = item.current || isActive(item.href);

              return (
                <DropdownMenuItem key={item.id} asChild>
                  <Link
                    href={item.href}
                    className={cn(
                      'flex items-center cursor-pointer',
                      active && 'bg-primary/10 text-primary'
                    )}
                  >
                    <Icon className="h-4 w-4 mr-2" />
                    {item.label}
                    {active && <Check className="h-4 w-4 ml-auto" />}
                  </Link>
                </DropdownMenuItem>
              );
            })}
            {/* Version Info Footer */}
            <DropdownMenuSeparator />
            <div className="px-2 py-1.5 text-xs text-muted-foreground text-center">
              Catalyst Studio v1.0.0
            </div>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Website Selector */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-9 max-w-[200px] px-2 hover:bg-accent"
            >
              <div className="flex items-center gap-2 min-w-0">
                {websiteIconUrl ? (
                  <img
                    src={websiteIconUrl}
                    alt=""
                    className="h-4 w-4 rounded flex-shrink-0"
                  />
                ) : (
                  <Globe className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                )}
                <span className="truncate text-sm">
                  {website?.name ?? 'Select website'}
                </span>
              </div>
              <ChevronDown className="h-3 w-3 ml-1 text-muted-foreground flex-shrink-0" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-[220px]">
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

      {/* Center Section */}
      <div className="flex-1 flex items-center justify-center">
        <h1 className="text-lg font-semibold text-foreground">
          Site Builder
        </h1>
      </div>

      {/* Right Section */}
      <div className="flex items-center gap-2">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-9"
                onClick={onGenerateProposal}
              >
                <FileText className="h-4 w-4 mr-2" />
                Proposal
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Generate client proposal (PDF)</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-9"
                asChild
              >
                <Link href={buildUrl('/studio/preview')}>
                  <Eye className="h-4 w-4 mr-2" />
                  Preview
                </Link>
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Preview your website</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="sm"
                className="h-9"
                asChild
              >
                <Link href={buildUrl('/studio/deployment')}>
                  <Rocket className="h-4 w-4 mr-2" />
                  Publish
                </Link>
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Publish your changes</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </header>
  );
}
