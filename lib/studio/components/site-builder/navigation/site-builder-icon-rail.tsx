'use client';

/**
 * Site Builder Icon Rail
 *
 * Vertical icon rail for quick navigation and panel toggles.
 * Width: 44px
 */

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  FileText,
  LayoutTemplate,
  Palette,
  Plug2,
  Settings,
  HelpCircle,
  Layers,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePanelState } from './panel-provider';

interface SiteBuilderIconRailProps {
  websiteId: string | null;
  onHelpClick?: () => void;
}

interface IconButtonConfig {
  id: string;
  icon: React.ElementType;
  label: string;
  tooltip: string;
  action: 'toggle-panel' | 'navigate' | 'callback';
  panel?: 'pages';
  href?: string;
  onClick?: () => void;
}

export function SiteBuilderIconRail({
  websiteId,
  onHelpClick,
}: SiteBuilderIconRailProps) {
  const { activePanel, togglePanel } = usePanelState();
  const pathname = usePathname();

  const buildUrl = (path: string) => {
    return websiteId ? `${path}?websiteId=${websiteId}` : path;
  };

  // Check if current path matches the navigation href
  const isNavActive = (href: string) => {
    if (!pathname) return false;
    const [hrefPath] = href.split('?');
    return pathname === hrefPath || pathname.startsWith(hrefPath + '/');
  };

  const handleGlobalSectionsClick = () => {
    window.dispatchEvent(new CustomEvent('open-global-sections'));
  };

  const iconButtons: IconButtonConfig[] = [
    {
      id: 'pages',
      icon: FileText,
      label: 'Pages',
      tooltip: 'Pages',
      action: 'toggle-panel',
      panel: 'pages',
    },
    {
      id: 'global-sections',
      icon: Layers,
      label: 'Global Sections',
      tooltip: 'Global Sections',
      action: 'callback',
      onClick: handleGlobalSectionsClick,
    },
    {
      id: 'page-templates',
      icon: LayoutTemplate,
      label: 'Page Templates',
      tooltip: 'Page Templates',
      action: 'navigate',
      href: buildUrl('/studio/content-types'),
    },
    {
      id: 'design-system',
      icon: Palette,
      label: 'Colors & Styles',
      tooltip: 'Colors & Styles',
      action: 'navigate',
      href: buildUrl('/studio/design-system'),
    },
    {
      id: 'integrations',
      icon: Plug2,
      label: 'Integrations',
      tooltip: 'Integrations',
      action: 'navigate',
      href: buildUrl('/studio/integrations'),
    },
    {
      id: 'settings',
      icon: Settings,
      label: 'Website Settings',
      tooltip: 'Website Settings',
      action: 'navigate',
      href: buildUrl('/studio/settings'),
    },
  ];

  const bottomButtons: IconButtonConfig[] = [
    {
      id: 'help',
      icon: HelpCircle,
      label: 'Help & Shortcuts',
      tooltip: 'Help & Shortcuts',
      action: 'callback',
      onClick: onHelpClick,
    },
  ];

  const renderIconButton = (config: IconButtonConfig) => {
    const Icon = config.icon;
    // Check active state for both panel toggles and navigation items
    const isActive = Boolean(
      (config.action === 'toggle-panel' && activePanel === config.panel) ||
      (config.action === 'navigate' && config.href && isNavActive(config.href))
    );

    const handleClick = () => {
      if (config.action === 'toggle-panel' && config.panel) {
        togglePanel(config.panel);
      } else if (config.action === 'callback' && config.onClick) {
        config.onClick();
      }
    };

    const buttonContent = (
      <Button
        variant="ghost"
        size="sm"
        className={cn(
          'h-9 w-9 p-0 transition-colors duration-100 motion-reduce:transition-none',
          isActive
            ? 'text-primary bg-primary/10 hover:bg-primary/15'
            : 'text-muted-foreground hover:text-foreground hover:bg-accent'
        )}
        onClick={config.action !== 'navigate' ? handleClick : undefined}
        aria-label={config.label}
        aria-pressed={isActive}
        data-tutorial-id={config.id === 'global-sections' ? 'component-library' : undefined}
      >
        <Icon className="h-5 w-5" />
      </Button>
    );

    const wrappedButton = config.action === 'navigate' && config.href ? (
      <Link href={config.href}>
        {buttonContent}
      </Link>
    ) : buttonContent;

    return (
      <TooltipProvider key={config.id} delayDuration={500}>
        <Tooltip>
          <TooltipTrigger asChild>
            {wrappedButton}
          </TooltipTrigger>
          <TooltipContent side="right" sideOffset={8}>
            <p>{config.tooltip}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  };

  return (
    <nav
      className="w-11 border-r border-border bg-background flex flex-col items-center py-2"
      role="navigation"
      aria-label="Site Builder Tools"
    >
      {/* Main Navigation Icons */}
      <div className="flex flex-col items-center gap-1">
        {iconButtons.map(renderIconButton)}
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Bottom Icons */}
      <div className="flex flex-col items-center gap-1">
        {bottomButtons.map(renderIconButton)}
      </div>
    </nav>
  );
}
