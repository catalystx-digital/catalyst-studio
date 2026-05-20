'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatOptimizelyDisplayName } from '@/lib/cms-export/optimizely/utils/display-name';

interface ContentType {
  id: string;
  name: string;
  fields: Array<{
    name: string;
    type: string;
  }>;
}

interface ContentMappingProps {
  providerId: string;
  websiteId?: string;
  onMappingComplete?: (types: ContentType[]) => void;
  className?: string;
}

export function ContentMapping({ providerId, websiteId, onMappingComplete, className }: ContentMappingProps) {
  const [loading, setLoading] = useState(true);
  const [rawContentTypes, setRawContentTypes] = useState<ContentType[]>([]);
  const contentTypes = useMemo(() => {
    return rawContentTypes.map(type => ({
      ...type,
      name: formatOptimizelyDisplayName(type.name)
    }));
  }, [rawContentTypes]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    extractContentTypes();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [websiteId]);

  useEffect(() => {
    onMappingComplete?.(contentTypes);
  }, [contentTypes, onMappingComplete]);

  const extractContentTypes = async () => {
    try {
      setLoading(true);
      setError(null);

      // Call the API endpoint to extract content types from the database
      const url = websiteId 
        ? `/api/extract-content-types?websiteId=${websiteId}`
        : '/api/extract-content-types';
      const response = await fetch(url);
      const result = await response.json();

      if (result.success) {
        setRawContentTypes(result.data);
      } else {
        throw new Error(result.error || 'Failed to extract content types');
      }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      console.error('Failed to extract content types:', error);
      setError(error.message || 'Failed to extract content types');
      
      // No fallback - show error state to user
      setRawContentTypes([]);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className={cn("p-6 rounded-xl bg-gradient-to-br from-white/5 to-white/10 backdrop-blur-md border border-white/10", className)}>
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-white/60" />
          <span className="ml-3 text-white/60">Extracting content types from database...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn("p-6 rounded-xl bg-red-500/10 border border-red-500/30", className)}>
        <div className="flex items-start gap-2">
          <AlertCircle className="h-5 w-5 text-red-400 mt-0.5" />
          <div>
            <p className="text-red-400 font-semibold">Extraction Error</p>
            <p className="text-red-400/80 text-sm mt-1">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("space-y-4", className)}>
      <div className="p-6 rounded-xl bg-gradient-to-br from-white/5 to-white/10 backdrop-blur-md border border-white/10">
        <h3 className="text-lg font-semibold text-white mb-4">
          Content Types ({contentTypes.length} found)
        </h3>
        <div className="space-y-3">
          {contentTypes.map((type) => (
            <div key={type.id} className="p-3 rounded-lg bg-white/5 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-white font-medium">{type.name}</span>
                  <span className="text-white/40 text-sm ml-2">
                    ({type.fields.length} fields)
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span className="text-xs text-green-400">Ready to sync</span>
                </div>
              </div>
              {type.fields.length > 0 && (
                <div className="grid grid-cols-2 gap-2 mt-2 pl-4">
                  {type.fields.slice(0, 4).map((field) => (
                    <div key={field.name} className="text-xs text-white/50">
                      <span className="text-white/70">{field.name}:</span> {field.type}
                    </div>
                  ))}
                  {type.fields.length > 4 && (
                    <div className="text-xs text-white/40 col-span-2">
                      ...and {type.fields.length - 4} more fields
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
      
      {contentTypes.length > 0 && (
        <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/30">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-5 w-5 text-blue-400 mt-0.5" />
            <div>
              <p className="text-blue-400 text-sm">
                All {contentTypes.length} content types are ready to sync to {providerId === 'optimizely' ? 'Optimizely' : 'your CMS'}.
              </p>
              <p className="text-blue-400/60 text-xs mt-1">
                The sync engine will create these content types in your CMS.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}