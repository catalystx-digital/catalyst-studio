'use client';

/**
 * Studio Website Preview Page
 *
 * Live preview using Vercel Sandbox with hot-reload.
 * Displays real website content from the database.
 */

import React, { Suspense, useState, useEffect } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { SandboxPreview } from '@/lib/studio/components/preview/SandboxPreview';
import { Loader2, Monitor, Tablet, Smartphone, Palette, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface DesignConcept {
  id: string;
  name: string;
  slug: string;
  isDefault: boolean;
}

function PreviewPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const websiteId = searchParams?.get('websiteId') ?? null;
  const pageSlug = searchParams?.get('page') || 'home';
  const useSandbox = searchParams?.get('sandbox') === 'true'; // Sandbox is opt-in; local preview is the OSS default
  const designConceptParam = searchParams?.get('designConcept');

  // Design concepts state
  const [designConcepts, setDesignConcepts] = useState<DesignConcept[]>([]);
  const [selectedConcept, setSelectedConcept] = useState<string>(designConceptParam || '');

  // Device type state with localStorage persistence
  const [deviceType, setDeviceType] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');

  // Fetch design concepts for this website
  useEffect(() => {
    if (!websiteId) return;

    async function fetchDesignConcepts() {
      try {
        const response = await fetch(`/api/website/${websiteId}/design-system/concepts`);
        if (response.ok) {
          const data = await response.json();
          if (data.concepts && Array.isArray(data.concepts)) {
            setDesignConcepts(data.concepts);
            // If no concept is selected, select the default one
            if (!selectedConcept) {
              const defaultConcept = data.concepts.find((c: DesignConcept) => c.isDefault);
              if (defaultConcept) {
                setSelectedConcept(defaultConcept.slug);
              }
            }
          }
        }
      } catch {
        // Silently fail - concepts may not be available
      }
    }

    fetchDesignConcepts();
  }, [websiteId, selectedConcept]);

  // Handle design concept change
  const handleConceptChange = (conceptSlug: string) => {
    setSelectedConcept(conceptSlug);
    // Update URL to include the design concept
    const params = new URLSearchParams(searchParams?.toString());
    if (conceptSlug && conceptSlug !== 'default') {
      params.set('designConcept', conceptSlug);
    } else {
      params.delete('designConcept');
    }
    router.replace(`${pathname}?${params.toString()}`);
  };

  // Load saved device preference
  useEffect(() => {
    const saved = localStorage.getItem('preview-device-type');
    if (saved === 'desktop' || saved === 'tablet' || saved === 'mobile') {
      setDeviceType(saved);
    }
  }, []);

  // Save device preference
  const handleDeviceChange = (type: 'desktop' | 'tablet' | 'mobile') => {
    setDeviceType(type);
    localStorage.setItem('preview-device-type', type);
  };

  // Get preview width based on device type
  const getPreviewWidth = () => {
    switch (deviceType) {
      case 'mobile': return '375px';
      case 'tablet': return '768px';
      default: return '100%';
    }
  };

  const buildLocalPreviewUrl = () => {
    if (!websiteId) return '';

    const normalizedPage = pageSlug.trim().replace(/^\/+|\/+$/g, '');
    const path =
      normalizedPage && normalizedPage !== 'home' && normalizedPage !== 'index'
        ? `/${normalizedPage.split('/').map(encodeURIComponent).join('/')}`
        : '';
    const params = new URLSearchParams();
    if (selectedConcept) {
      params.set('designConcept', selectedConcept);
    }
    const query = params.toString();
    return `/studio/preview/site/${encodeURIComponent(websiteId)}${path}${query ? `?${query}` : ''}`;
  };

  // No website selected
  if (!websiteId) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <p className="text-muted-foreground mb-2">No website selected</p>
          <p className="text-sm text-muted-foreground">
            Select a website from the dashboard to preview it.
          </p>
        </div>
      </div>
    );
  }

  // Use Vercel Sandbox only when explicitly requested.
  if (useSandbox) {
    return (
      <div className="flex-1 flex flex-col h-full bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b bg-card">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-semibold">Live Preview</h1>
            <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
              Sandbox Mode
            </span>
          </div>
          <div className="flex items-center gap-4">
            {/* Design concept selector */}
            {designConcepts.length > 1 && (
              <div className="flex items-center gap-2">
                <Palette className="h-4 w-4 text-muted-foreground" />
                <Select value={selectedConcept} onValueChange={handleConceptChange}>
                  <SelectTrigger className="h-8 w-[180px]">
                    <SelectValue placeholder="Select design" />
                  </SelectTrigger>
                  <SelectContent>
                    {designConcepts.map((concept) => (
                      <SelectItem key={concept.id} value={concept.slug}>
                        {concept.name}
                        {concept.isDefault && ' (Default)'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {/* Device selector */}
            <div className="flex items-center gap-1 rounded-lg border bg-muted/50 p-1">
              <Button
                variant={deviceType === 'desktop' ? 'secondary' : 'ghost'}
                size="sm"
                className="h-8 w-8 p-0"
                onClick={() => handleDeviceChange('desktop')}
                title="Desktop"
              >
                <Monitor className="h-4 w-4" />
              </Button>
              <Button
                variant={deviceType === 'tablet' ? 'secondary' : 'ghost'}
                size="sm"
                className="h-8 w-8 p-0"
                onClick={() => handleDeviceChange('tablet')}
                title="Tablet"
              >
                <Tablet className="h-4 w-4" />
              </Button>
              <Button
                variant={deviceType === 'mobile' ? 'secondary' : 'ghost'}
                size="sm"
                className="h-8 w-8 p-0"
                onClick={() => handleDeviceChange('mobile')}
                title="Mobile"
              >
                <Smartphone className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              Hot-reload enabled
            </div>
          </div>
        </div>

        {/* Preview Area */}
        <div className="flex-1 p-6">
          <div
            className="h-full rounded-lg overflow-hidden border shadow-lg bg-white mx-auto transition-all duration-300"
            style={{ width: getPreviewWidth() }}
          >
            <SandboxPreview
              websiteId={websiteId}
              pageSlug={pageSlug}
              designConcept={selectedConcept}
              className="h-full"
            />
          </div>
        </div>
      </div>
    );
  }

  const localPreviewUrl = buildLocalPreviewUrl();

  return (
    <div className="flex-1 flex flex-col h-full bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
      <div className="flex items-center justify-between px-4 py-3 border-b bg-card">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-semibold">Live Preview</h1>
          <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
            Local Mode
          </span>
        </div>
        <div className="flex items-center gap-4">
          {designConcepts.length > 1 && (
            <div className="flex items-center gap-2">
              <Palette className="h-4 w-4 text-muted-foreground" />
              <Select value={selectedConcept} onValueChange={handleConceptChange}>
                <SelectTrigger className="h-8 w-[180px]">
                  <SelectValue placeholder="Select design" />
                </SelectTrigger>
                <SelectContent>
                  {designConcepts.map((concept) => (
                    <SelectItem key={concept.id} value={concept.slug}>
                      {concept.name}
                      {concept.isDefault && ' (Default)'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="flex items-center gap-1 rounded-lg border bg-muted/50 p-1">
            <Button
              variant={deviceType === 'desktop' ? 'secondary' : 'ghost'}
              size="sm"
              className="h-8 w-8 p-0"
              onClick={() => handleDeviceChange('desktop')}
              title="Desktop"
            >
              <Monitor className="h-4 w-4" />
            </Button>
            <Button
              variant={deviceType === 'tablet' ? 'secondary' : 'ghost'}
              size="sm"
              className="h-8 w-8 p-0"
              onClick={() => handleDeviceChange('tablet')}
              title="Tablet"
            >
              <Tablet className="h-4 w-4" />
            </Button>
            <Button
              variant={deviceType === 'mobile' ? 'secondary' : 'ghost'}
              size="sm"
              className="h-8 w-8 p-0"
              onClick={() => handleDeviceChange('mobile')}
              title="Mobile"
            >
              <Smartphone className="h-4 w-4" />
            </Button>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.open(localPreviewUrl, '_blank')}
          >
            <ExternalLink className="h-4 w-4 mr-2" />
            Open
          </Button>
        </div>
      </div>

      <div className="flex-1 p-6">
        <div
          className="h-full rounded-lg overflow-hidden border shadow-lg bg-white mx-auto transition-all duration-300"
          style={{ width: getPreviewWidth() }}
        >
          <iframe
            src={localPreviewUrl}
            className="w-full h-full border-0 bg-white"
            title="Website Preview"
          />
        </div>
      </div>
    </div>
  );
}

export default function StudioPreviewPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-full">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      }
    >
      <PreviewPageContent />
    </Suspense>
  );
}
