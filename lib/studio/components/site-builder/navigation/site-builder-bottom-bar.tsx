'use client';

/**
 * Site Builder Bottom Bar
 *
 * Bottom toolbar with quick actions and zoom controls.
 * Height: 40px
 */

import React, { useState, useCallback, useEffect } from 'react';
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
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Database,
  History,
  Keyboard,
  Maximize2,
  Minus,
  ZoomIn,
  ChevronUp,
  LayoutGrid,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface SiteBuilderBottomBarProps {
  onOpenContentTypes?: () => void;
  onOpenHistory?: () => void;
  onOpenShortcuts?: () => void;
  /** Current zoom level (0-1 scale, e.g., 0.5 = 50%) */
  zoom?: number;
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  onFitView?: () => void;
  onZoomTo?: (level: number) => void;
  /** Whether auto layout is enabled */
  autoLayoutEnabled?: boolean;
  /** Toggle auto layout */
  onAutoLayoutToggle?: () => void;
}

const ZOOM_PRESETS = [
  { label: '25%', value: 0.25 },
  { label: '50%', value: 0.5 },
  { label: '75%', value: 0.75 },
  { label: '100%', value: 1 },
  { label: '125%', value: 1.25 },
  { label: '150%', value: 1.5 },
  { label: '200%', value: 2 },
];

export function SiteBuilderBottomBar({
  onOpenContentTypes,
  onOpenHistory,
  onOpenShortcuts,
  zoom = 1,
  onZoomIn,
  onZoomOut,
  onFitView,
  onZoomTo,
  autoLayoutEnabled = true,
  onAutoLayoutToggle,
}: SiteBuilderBottomBarProps) {
  const [localZoom, setLocalZoom] = useState(zoom);

  // Listen for zoom changes from ReactFlow
  useEffect(() => {
    const handleZoomChange = (event: CustomEvent<{ zoom: number }>) => {
      setLocalZoom(event.detail.zoom);
    };

    window.addEventListener('sitebuilder:zoom-change' as any, handleZoomChange);
    return () => window.removeEventListener('sitebuilder:zoom-change' as any, handleZoomChange);
  }, []);

  // Sync with prop changes
  useEffect(() => {
    setLocalZoom(zoom);
  }, [zoom]);

  const handleFitView = useCallback(() => {
    onFitView?.();
    // Also dispatch event for ReactFlow canvas
    window.dispatchEvent(new CustomEvent('sitebuilder:fit-view'));
  }, [onFitView]);

  const handleZoomIn = useCallback(() => {
    onZoomIn?.();
    // Dispatch event for ReactFlow canvas
    window.dispatchEvent(new CustomEvent('sitebuilder:zoom-in'));
  }, [onZoomIn]);

  const handleZoomOut = useCallback(() => {
    onZoomOut?.();
    // Dispatch event for ReactFlow canvas
    window.dispatchEvent(new CustomEvent('sitebuilder:zoom-out'));
  }, [onZoomOut]);

  const handleZoomTo = useCallback((level: number) => {
    onZoomTo?.(level);
    // Dispatch event for ReactFlow canvas
    window.dispatchEvent(new CustomEvent('sitebuilder:zoom-to', {
      detail: { zoom: level },
    }));
  }, [onZoomTo]);

  const zoomPercentage = Math.round(localZoom * 100);

  return (
    <footer className="h-10 border-t border-border bg-card flex items-center justify-between px-2">
      {/* Left Section - Quick Actions */}
      <div className="flex items-center gap-1">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-xs"
                onClick={onOpenContentTypes}
              >
                <Database className="h-3.5 w-3.5 mr-1" />
                Content Types
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">
              <p>Manage content types</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-xs"
                onClick={onOpenHistory}
              >
                <History className="h-3.5 w-3.5 mr-1" />
                History
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">
              <p>View version history</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={onOpenShortcuts}
              >
                <Keyboard className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">
              <p>Keyboard shortcuts</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {/* Right Section - Auto Layout & Zoom Controls */}
      <div className="flex items-center gap-1">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  'h-8 text-xs',
                  autoLayoutEnabled && 'text-primary bg-primary/10 hover:bg-primary/15'
                )}
                onClick={onAutoLayoutToggle}
              >
                <LayoutGrid className="h-3.5 w-3.5 mr-1" />
                Auto Layout
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">
              <p>{autoLayoutEnabled ? 'Disable' : 'Enable'} auto layout</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <div className="w-px h-5 bg-border mx-1" />

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={handleFitView}
              >
                <Maximize2 className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">
              <p>Fit to view</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <div className="flex items-center border rounded-md bg-background">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 rounded-r-none border-r"
                  onClick={handleZoomOut}
                  disabled={localZoom <= 0.1}
                >
                  <Minus className="h-3 w-3" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">
                <p>Zoom out</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 rounded-none min-w-[52px] font-mono text-xs"
              >
                {zoomPercentage}%
                <ChevronUp className="h-3 w-3 ml-1" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-24">
              {ZOOM_PRESETS.map((preset) => (
                <DropdownMenuItem
                  key={preset.value}
                  onClick={() => handleZoomTo(preset.value)}
                  className={cn(
                    'cursor-pointer font-mono text-xs justify-center',
                    Math.abs(localZoom - preset.value) < 0.05 && 'bg-accent'
                  )}
                >
                  {preset.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 rounded-l-none border-l"
                  onClick={handleZoomIn}
                  disabled={localZoom >= 4}
                >
                  <ZoomIn className="h-3 w-3" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">
                <p>Zoom in</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>
    </footer>
  );
}
