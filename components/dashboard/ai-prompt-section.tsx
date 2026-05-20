'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Loader2, Sparkles } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { QuickCategoryTags } from './quick-category-tags';

interface AIPromptSectionProps {
  onWebsiteCreated: (userPrompt: string) => Promise<void>;
  isCreating: boolean;
}

// Skeleton loading component shown during AI website generation
function CreationSkeleton() {
  return (
    <div className="ai-prompt-container bg-gray-900 rounded-2xl p-8 shadow-lg border border-gray-700">
      <div className="max-w-4xl mx-auto">
        {/* Header with spinner */}
        <div className="flex items-center gap-3 mb-6">
          <div className="relative">
            <Sparkles className="w-8 h-8 text-catalyst-orange animate-pulse" />
          </div>
          <div className="flex flex-col gap-1">
            <h2 className="text-2xl font-bold text-white">
              Creating your website...
            </h2>
            <p className="text-sm text-gray-400">
              AI is generating your site structure and content
            </p>
          </div>
        </div>

        {/* Progress skeleton cards */}
        <div className="space-y-4">
          {/* Processing step indicator */}
          <div className="flex items-center gap-3 p-4 bg-gray-800/50 rounded-lg border border-gray-700">
            <Loader2 className="w-5 h-5 text-catalyst-orange animate-spin shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-3/4 bg-gray-700" />
              <Skeleton className="h-3 w-1/2 bg-gray-700/50" />
            </div>
          </div>

          {/* Site structure skeleton */}
          <div className="grid grid-cols-3 gap-4">
            <div className="p-4 bg-gray-800/30 rounded-lg border border-gray-700/50">
              <Skeleton className="h-3 w-12 mb-2 bg-gray-700/50" />
              <Skeleton className="h-5 w-full bg-gray-700" />
            </div>
            <div className="p-4 bg-gray-800/30 rounded-lg border border-gray-700/50">
              <Skeleton className="h-3 w-16 mb-2 bg-gray-700/50" />
              <Skeleton className="h-5 w-full bg-gray-700" />
            </div>
            <div className="p-4 bg-gray-800/30 rounded-lg border border-gray-700/50">
              <Skeleton className="h-3 w-14 mb-2 bg-gray-700/50" />
              <Skeleton className="h-5 w-full bg-gray-700" />
            </div>
          </div>

          {/* Page preview skeletons */}
          <div className="grid grid-cols-2 gap-4 mt-4">
            <div className="p-4 bg-gray-800/30 rounded-lg border border-gray-700/50 space-y-3">
              <Skeleton className="h-4 w-20 bg-gray-700" />
              <Skeleton className="h-16 w-full bg-gray-700/50" />
              <div className="space-y-1">
                <Skeleton className="h-2 w-full bg-gray-700/30" />
                <Skeleton className="h-2 w-4/5 bg-gray-700/30" />
              </div>
            </div>
            <div className="p-4 bg-gray-800/30 rounded-lg border border-gray-700/50 space-y-3">
              <Skeleton className="h-4 w-24 bg-gray-700" />
              <Skeleton className="h-16 w-full bg-gray-700/50" />
              <div className="space-y-1">
                <Skeleton className="h-2 w-full bg-gray-700/30" />
                <Skeleton className="h-2 w-3/5 bg-gray-700/30" />
              </div>
            </div>
          </div>
        </div>

        {/* Subtle hint */}
        <p className="text-xs text-gray-500 mt-6 text-center">
          This usually takes a few seconds. You&apos;ll be redirected automatically.
        </p>
      </div>
    </div>
  );
}

export function AIPromptSection({ onWebsiteCreated, isCreating }: AIPromptSectionProps) {
  const [prompt, setPrompt] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea based on content
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [prompt]);

  const handleTagClick = (tagPrompt: string) => {
    setPrompt(tagPrompt);
    textareaRef.current?.focus();
  };

  const handleCreate = async () => {
    if (!prompt.trim() || isProcessing || isCreating) return;

    setIsProcessing(true);
    try {
      await onWebsiteCreated(prompt);
      setPrompt(''); // Clear prompt on success
    } catch (error) {
      // Error is handled by parent component
      console.error('Failed to create website:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleCreate();
    }
  };

  // Show skeleton loading when creating
  if (isProcessing || isCreating) {
    return <CreationSkeleton />;
  }

  return (
    <div className="ai-prompt-container bg-gray-900 rounded-2xl p-8 shadow-lg border border-gray-700">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <Sparkles className="w-8 h-8 text-catalyst-orange" />
          <h2 className="text-3xl font-bold text-white">
            What would you build today?
          </h2>
        </div>

        <div className="prompt-input-wrapper space-y-4">
          <div className="relative">
            <textarea
              ref={textareaRef}
              value={prompt}
              onChange={(e) => {
                // Limit prompt to 4000 characters for detailed descriptions
                if (e.target.value.length <= 4000) {
                  setPrompt(e.target.value);
                }
              }}
              onKeyDown={handleKeyDown}
              placeholder="Describe your website idea... (e.g., 'A CRM for small businesses with lead tracking and email automation')"
              className="w-full min-h-[100px] max-h-[200px] p-4 pr-32 border-2 border-gray-700 rounded-xl resize-none 
                       bg-gray-800 text-gray-100
                       placeholder:text-gray-500
                       focus:outline-none focus:ring-2 focus:ring-catalyst-orange focus:border-transparent
                       transition-all duration-200"
              disabled={isProcessing || isCreating}
              aria-label="Website description prompt"
              maxLength={4000}
            />

            <button
              onClick={handleCreate}
              disabled={!prompt.trim() || isProcessing || isCreating}
              className="absolute right-3 bottom-3 px-4 py-2 
                       bg-catalyst-orange hover:bg-catalyst-orange-dark
                       disabled:bg-gray-600 disabled:cursor-not-allowed
                       text-white font-medium rounded-lg
                       transition-all duration-200 transform hover:scale-105 disabled:hover:scale-100
                       flex items-center gap-2 shadow-md"
              aria-label="Create website from prompt"
              type="button"
            >
              {(isProcessing || isCreating) ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Creating...</span>
                </>
              ) : (
                <span>Create Website</span>
              )}
            </button>
          </div>

          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="flex-1">
              <p className="text-sm text-gray-400 mb-2">
                Need inspiration? Start from proven playbooks:
              </p>
              <QuickCategoryTags onTagClick={handleTagClick} />
            </div>
          </div>

          <div className="flex justify-between items-center">
            <p className="text-xs text-gray-500">
              Pro tip: Press <kbd className="px-1.5 py-0.5 text-xs bg-gray-700 rounded">Ctrl</kbd> + <kbd className="px-1.5 py-0.5 text-xs bg-gray-700 rounded">Enter</kbd> to create
            </p>
            {prompt.length > 3500 && (
              <p className="text-xs text-gray-500">
                {prompt.length}/4000 characters
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
