'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { usePreviewContext } from '@/lib/context/preview-context';
import {
  RefreshCw,
  ZoomIn,
  ZoomOut,
  Maximize,
  Copy,
  Settings,
  Minimize
} from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';

interface PreviewControlsProps {
  className?: string;
}

const ZOOM_PRESETS = [
  { label: '50%', value: 0.5 },
  { label: '75%', value: 0.75 },
  { label: '100%', value: 1 },
  { label: '125%', value: 1.25 },
  { label: '150%', value: 1.5 },
];

function PreviewControlsComponent({ className }: PreviewControlsProps) {
  const { state, refresh, updateZoom, updateSettings, clearCache } = usePreviewContext();
  const { toast } = useToast();
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [customZoom, setCustomZoom] = useState(state.zoom * 100);

  const handleRefresh = useCallback(() => {
    refresh();
    toast({
      title: 'Preview refreshed',
      description: 'The preview has been reloaded.',
      duration: 2000,
    });
  }, [refresh, toast]);

  const handleZoomIn = useCallback(() => {
    const newZoom = Math.min(state.zoom + 0.25, 2);
    updateZoom(newZoom);
  }, [state.zoom, updateZoom]);

  const handleZoomOut = useCallback(() => {
    const newZoom = Math.max(state.zoom - 0.25, 0.25);
    updateZoom(newZoom);
  }, [state.zoom, updateZoom]);

  const handleZoomReset = useCallback(() => {
    updateZoom(1);
  }, [updateZoom]);

  const enterFullscreen = useCallback(() => {
    const element = document.querySelector('.preview-frame-container');
    if (element && element.requestFullscreen) {
      element.requestFullscreen();
      setIsFullscreen(true);
    }
  }, []);

  const exitFullscreen = useCallback(() => {
    if (document.exitFullscreen) {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (!isFullscreen) {
      enterFullscreen();
    } else {
      exitFullscreen();
    }
  }, [isFullscreen, enterFullscreen, exitFullscreen]);

  const handleZoomPreset = (value: number) => {
    updateZoom(value);
  };

  const handleCustomZoomChange = (value: number[]) => {
    const zoom = value[0] / 100;
    setCustomZoom(value[0]);
    updateZoom(zoom);
  };

  const handleCopyURL = async () => {
    const currentURL = window.location.href.replace('/preview', '');
    const previewURL = `${currentURL}/preview/${state.currentPage || 'index'}`;
    
    try {
      await navigator.clipboard.writeText(previewURL);
      toast({
        title: 'URL copied',
        description: 'Preview URL has been copied to clipboard.',
        duration: 2000,
      });
    } catch {
      toast({
        title: 'Failed to copy',
        description: 'Could not copy URL to clipboard.',
        variant: 'destructive',
        duration: 2000,
      });
    }
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Check for modifier keys
      const isCtrlOrCmd = e.ctrlKey || e.metaKey;
      
      if (isCtrlOrCmd) {
        switch (e.key) {
          case 'r':
          case 'R':
            e.preventDefault();
            handleRefresh();
            break;
          case '=':
          case '+':
            e.preventDefault();
            handleZoomIn();
            break;
          case '-':
          case '_':
            e.preventDefault();
            handleZoomOut();
            break;
          case '0':
            e.preventDefault();
            handleZoomReset();
            break;
          case 'Enter':
            e.preventDefault();
            toggleFullscreen();
            break;
        }
      }
      
      // ESC to exit fullscreen
      if (e.key === 'Escape' && isFullscreen) {
        exitFullscreen();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen, handleRefresh, handleZoomIn, handleZoomOut, handleZoomReset, toggleFullscreen, exitFullscreen]);

  // Update custom zoom when state changes
  useEffect(() => {
    setCustomZoom(state.zoom * 100);
  }, [state.zoom]);

  // Check fullscreen state changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Load settings from localStorage
  useEffect(() => {
    const savedSettings = localStorage.getItem('previewSettings');
    if (savedSettings) {
      try {
        const settings = JSON.parse(savedSettings);
        updateSettings(settings);
      } catch {
        console.error('Failed to load preview settings');
      }
    }
  }, [updateSettings]);

  // Save settings to localStorage
  useEffect(() => {
    localStorage.setItem('previewSettings', JSON.stringify(state.settings));
  }, [state.settings]);

  return (
    <div className={cn('flex items-center gap-2 p-2 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800', className)}>
      {/* Refresh Button */}
      <Button
        variant="ghost"
        size="sm"
        onClick={handleRefresh}
        disabled={state.isLoading}
        title="Refresh preview (Ctrl+R)"
        className="gap-2"
      >
        <RefreshCw className={cn('w-4 h-4', state.isLoading && 'animate-spin')} />
        <span className="hidden sm:inline">Refresh</span>
      </Button>

      <div className="w-px h-6 bg-gray-200 dark:bg-gray-700" />

      {/* Zoom Controls */}
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          onClick={handleZoomOut}
          disabled={state.zoom <= 0.25}
          title="Zoom out (Ctrl+-)"
          className="size-11"
        >
          <ZoomOut className="w-4 h-4" />
        </Button>

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="sm" className="min-w-[60px]">
              {Math.round(state.zoom * 100)}%
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64">
            <div className="space-y-4">
              <div>
                <Label className="text-sm font-medium">Zoom Level</Label>
                <div className="flex flex-wrap gap-1 mt-2">
                  {ZOOM_PRESETS.map((preset) => (
                    <Button
                      key={preset.value}
                      variant={state.zoom === preset.value ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => handleZoomPreset(preset.value)}
                      className="text-xs"
                    >
                      {preset.label}
                    </Button>
                  ))}
                </div>
              </div>
              <div>
                <Label className="text-sm font-medium">Custom: {Math.round(customZoom)}%</Label>
                <Slider
                  value={[customZoom]}
                  onValueChange={handleCustomZoomChange}
                  min={25}
                  max={200}
                  step={5}
                  className="mt-2"
                />
              </div>
            </div>
          </PopoverContent>
        </Popover>

        <Button
          variant="ghost"
          size="icon"
          onClick={handleZoomIn}
          disabled={state.zoom >= 2}
          title="Zoom in (Ctrl++)"
          className="size-11"
        >
          <ZoomIn className="w-4 h-4" />
        </Button>
      </div>

      <div className="w-px h-6 bg-gray-200 dark:bg-gray-700" />

      {/* Fullscreen Toggle */}
      <Button
        variant="ghost"
        size="icon"
        onClick={toggleFullscreen}
        title={isFullscreen ? 'Exit fullscreen (ESC)' : 'Enter fullscreen (Ctrl+Enter)'}
        className="size-11"
      >
        {isFullscreen ? (
          <Minimize className="w-4 h-4" />
        ) : (
          <Maximize className="w-4 h-4" />
        )}
      </Button>

      {/* Copy URL */}
      <Button
        variant="ghost"
        size="icon"
        onClick={handleCopyURL}
        title="Copy preview URL"
        className="size-11"
      >
        <Copy className="w-4 h-4" />
      </Button>

      <div className="flex-1" />

      {/* Settings */}
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="icon" title="Preview settings" className="size-11">
            <Settings className="w-4 h-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80" align="end">
          <div className="space-y-4">
            <h3 className="font-medium text-sm">Preview Settings</h3>
            
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label htmlFor="show-frame" className="text-sm">Show device frame</Label>
                <Switch
                  id="show-frame"
                  checked={state.settings.showDeviceFrame}
                  onCheckedChange={(checked) => 
                    updateSettings({ ...state.settings, showDeviceFrame: checked })
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="auto-refresh" className="text-sm">Auto-refresh on changes</Label>
                <Switch
                  id="auto-refresh"
                  checked={state.settings.autoRefresh}
                  onCheckedChange={(checked) => 
                    updateSettings({ ...state.settings, autoRefresh: checked })
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="show-grid" className="text-sm">Show grid overlay</Label>
                <Switch
                  id="show-grid"
                  checked={state.settings.showGrid}
                  onCheckedChange={(checked) => 
                    updateSettings({ ...state.settings, showGrid: checked })
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="show-rulers" className="text-sm">Show rulers</Label>
                <Switch
                  id="show-rulers"
                  checked={state.settings.showRulers}
                  onCheckedChange={(checked) => 
                    updateSettings({ ...state.settings, showRulers: checked })
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="highlight-interactive" className="text-sm">Highlight interactive elements</Label>
                <Switch
                  id="highlight-interactive"
                  checked={state.settings.highlightInteractive}
                  onCheckedChange={(checked) => 
                    updateSettings({ ...state.settings, highlightInteractive: checked })
                  }
                />
              </div>
            </div>

            <div className="pt-3 border-t">
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => {
                  clearCache();
                  toast({
                    title: 'Cache cleared',
                    description: 'Preview cache has been cleared.',
                    duration: 2000,
                  });
                }}
              >
                Clear cache
              </Button>
            </div>

            <div className="text-xs text-gray-500 dark:text-gray-400">
              <p className="font-medium mb-1">Keyboard shortcuts:</p>
              <ul className="space-y-0.5">
                <li>Ctrl+R: Refresh</li>
                <li>Ctrl+Plus/Minus: Zoom</li>
                <li>Ctrl+0: Reset zoom</li>
                <li>Ctrl+Enter: Fullscreen</li>
                <li>ESC: Exit fullscreen</li>
              </ul>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

// Export memoized component for performance
export const PreviewControls = React.memo(PreviewControlsComponent)