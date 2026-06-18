'use client';

import { Globe, Plus, Upload, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface EmptyStateProps {
  onNewWebsite: () => void;
  onImportWebsite: () => void;
  className?: string;
}

export function EmptyState({
  onNewWebsite,
  onImportWebsite,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center py-16 px-4',
        className
      )}
    >
      {/* Icon */}
      <div className="relative mb-6">
        <div className="w-20 h-20 rounded-full bg-gray-800 flex items-center justify-center">
          <Globe className="h-10 w-10 text-gray-500" />
        </div>
        <div className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-catalyst-orange flex items-center justify-center">
          <Plus className="h-4 w-4 text-gray-950" />
        </div>
      </div>

      {/* Text */}
      <h2 className="text-xl font-semibold text-white mb-2">
        Create your first website
      </h2>
      <p className="text-gray-400 text-center max-w-md mb-8">
        AI-powered visual builder + full CMS. Generate from a prompt, import any live site, edit visually, preview instantly, model structured content, and export to real platforms — or use as a headless GraphQL CMS. One command gets you a complete seeded demo.
      </p>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row items-center gap-3">
        <Button
          size="lg"
          onClick={onNewWebsite}
          className="bg-catalyst-orange hover:bg-catalyst-orange/90 text-gray-950 font-semibold gap-2"
        >
          <Sparkles className="h-5 w-5" />
          Create with AI
        </Button>
        <Button
          variant="outline"
          size="lg"
          onClick={onImportWebsite}
          className="border-gray-700 text-gray-300 hover:bg-gray-800 hover:text-white gap-2"
        >
          <Upload className="h-5 w-5" />
          Import Website
        </Button>
      </div>

      {/* Subtle hint */}
      <p className="text-xs text-gray-600 mt-8">
        Tip: You can also paste a URL to import any website
      </p>
    </div>
  );
}
