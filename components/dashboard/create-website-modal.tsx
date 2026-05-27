'use client';

import { useCallback, useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { BadgeDollarSign, Loader2, Sparkles, Upload, LayoutTemplate, ExternalLink, X, FileText } from 'lucide-react';
import {
  extractTextFromFile,
  getAcceptedFileTypes,
  type ExtractionResult,
} from '@/lib/services/file-text-extractor';
import { useUser } from '@/lib/auth/hooks';
import { AIPromptProcessor } from '@/lib/services/ai-prompt-processor';
import { useImportTrackerStore } from '@/lib/studio/stores/import-tracker-store';
import type { ImportJobSnapshot, ImportModelMode } from '@/lib/services/ai-prompt-processor';
import type { ImportActivityItem } from '@/lib/api/hooks/use-import-activity';
import { useToast } from '@/components/ui/use-toast';
import { getStudioWebsiteRoute } from '@/lib/config/deployment';
import { monitoring } from '@/lib/monitoring';
import { getBuilderAssistantSessionId } from '@/lib/studio/components/site-builder/assistant-session';
import {
  adoptDashboardChatSession,
  createPromptIdempotencyKey,
  getDashboardSessionId,
  logDashboardPrompt,
} from '@/lib/studio/services/dashboard-chat-logger';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { QuickCategoryTags } from './quick-category-tags';
import { cn } from '@/lib/utils';

interface CreateWebsiteModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultTab?: 'ai' | 'import' | 'templates';
  onWebsiteCreated?: (websiteId: string) => void;
}

const IMPORT_PROMPT_STORAGE_PREFIX = 'import_prompt_';
const MAX_TOTAL_CHARS = 100000;

const toImportActivity = (job: ImportJobSnapshot): ImportActivityItem => ({
  id: job.id,
  websiteId: job.websiteId,
  status: job.status,
  state: job.state,
  progress: job.progress,
  stage: job.stage,
  message: job.message,
  url: job.url,
  createdAt: job.createdAt,
  startedAt: job.startedAt,
  updatedAt: job.updatedAt,
  completedAt: job.completedAt,
  queuePosition: job.queuePosition ?? null,
  estimatedStartSeconds: job.estimatedStartSeconds ?? null,
  website: job.website
    ? {
        id: job.website.id,
        name: job.website.name ?? 'Imported website',
        icon: job.website.icon ?? null,
        metadata: null,
        updatedAt: job.updatedAt,
        createdAt: job.createdAt,
      }
    : null,
});

export function CreateWebsiteModal({
  open,
  onOpenChange,
  defaultTab = 'ai',
  onWebsiteCreated,
}: CreateWebsiteModalProps) {
  const router = useRouter();
  const user = useUser();
  const queryClient = useQueryClient();
  const hydrateJobs = useImportTrackerStore((state) => state.hydrateJobs);
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState<string>(defaultTab);
  const [prompt, setPrompt] = useState('');
  const [importUrl, setImportUrl] = useState('');
  const [importModelMode, setImportModelMode] = useState<ImportModelMode>('quality');
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // File upload state
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [extractedContent, setExtractedContent] = useState<ExtractionResult | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractionError, setExtractionError] = useState<string | null>(null);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (open) {
      setActiveTab(defaultTab);
      setError(null);
    } else {
      // Clear form on close
      setTimeout(() => {
        setPrompt('');
        setImportUrl('');
        setImportModelMode('quality');
        setError(null);
        setUploadedFile(null);
        setExtractedContent(null);
        setExtractionError(null);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }, 200);
    }
  }, [open, defaultTab]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 150)}px`;
    }
  }, [prompt]);

  const getTotalCharCount = useCallback(() => {
    const promptLength = prompt.length;
    const fileLength = extractedContent?.charCount || 0;
    return promptLength + fileLength;
  }, [prompt, extractedContent]);

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadedFile(file);
    setExtractionError(null);
    setIsExtracting(true);

    try {
      const result = await extractTextFromFile(file);
      setExtractedContent(result);
    } catch (err) {
      setExtractionError(err instanceof Error ? err.message : 'Failed to extract text');
      setExtractedContent(null);
    } finally {
      setIsExtracting(false);
    }
  }, []);

  const handleRemoveFile = useCallback(() => {
    setUploadedFile(null);
    setExtractedContent(null);
    setExtractionError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  const primeImportStores = useCallback(
    (job: ImportJobSnapshot) => {
      hydrateJobs([
        {
          id: job.id,
          websiteId: job.websiteId,
          url: job.url,
          status: job.status,
          state: job.state,
          progress: job.progress,
          stage: job.stage,
          message: job.message ?? undefined,
          mode: job.mode,
          queuePosition: job.queuePosition ?? null,
          estimatedStartSeconds: job.estimatedStartSeconds ?? null,
          startedAt: job.startedAt ?? undefined,
          updatedAt: job.updatedAt ?? undefined,
          completedAt: job.completedAt ?? undefined,
        },
      ]);

      queryClient.setQueryData<ImportActivityItem[] | undefined>(
        ['dashboard', 'import-activity'],
        (existing) => {
          const current = Array.isArray(existing)
            ? existing.filter((item) => item.id !== job.id)
            : [];
          return [toImportActivity(job), ...current];
        }
      );
    },
    [hydrateJobs, queryClient]
  );

  const handleAICreate = useCallback(async () => {
    if ((!prompt.trim() && !extractedContent) || isCreating) return;

    setIsCreating(true);
    setError(null);

    // Combine prompt with file content if available
    const combinedPrompt = extractedContent
      ? `${prompt}

--- Uploaded Document Content (${extractedContent.fileName}) ---

${extractedContent.text}`
      : prompt;

    const accountId = user?.id ?? null;
    const sessionId = accountId ? getDashboardSessionId(accountId) : null;
    const idempotencyKey = sessionId ? createPromptIdempotencyKey(sessionId, combinedPrompt) : null;

    if (sessionId && idempotencyKey) {
      try {
        await logDashboardPrompt({
          sessionId,
          prompt: combinedPrompt,
          idempotencyKey,
          metadata: {
            scope: { type: 'site', label: 'Dashboard Prompt' },
            scopeLabel: 'Dashboard Prompt',
            source: 'dashboard',
          },
        });
      } catch (err) {
        monitoring.logError('dashboard_prompt_log_failed', err instanceof Error ? err : undefined, {
          sessionId,
        });
      }
    }

    const adoptSession = async (websiteId: string) => {
      if (!sessionId) return;
      try {
        await adoptDashboardChatSession({
          sourceSessionId: sessionId,
          websiteId,
          targetSessionId: getBuilderAssistantSessionId(websiteId),
        });
      } catch (err) {
        monitoring.logError(
          'dashboard_chat_session_adopt_failed',
          err instanceof Error ? err : undefined,
          { sessionId, websiteId }
        );
      }
    };

    try {
      const processor = new AIPromptProcessor();
      const processedPrompt = await processor.processPrompt(combinedPrompt);
      const result = await processor.createWebsiteFromPrompt(combinedPrompt, processedPrompt);

      if (result.type === 'import') {
        primeImportStores(result.job);
        if (sessionId) {
          await adoptSession(result.job.websiteId);
        }

        if (typeof window !== 'undefined') {
          sessionStorage.setItem(
            `${IMPORT_PROMPT_STORAGE_PREFIX}${result.job.id}`,
            JSON.stringify({
              jobId: result.job.id,
              websiteId: result.job.websiteId,
              original: combinedPrompt,
              processed: result.prompt,
              url: result.url,
              createdAt: result.job.createdAt,
              timestamp: Date.now(),
            })
          );
          sessionStorage.setItem(
            `ai_prompt_${result.job.websiteId}`,
            JSON.stringify({
              original: combinedPrompt,
              processed: result.prompt,
              timestamp: Date.now(),
            })
          );
        }

        toast({
          title: 'Import started',
          description: `Importing ${result.url}. Opening site builder...`,
        });

        onWebsiteCreated?.(result.job.websiteId);
        onOpenChange(false);

        const destination = getStudioWebsiteRoute(result.job.websiteId, {
          query: { importJobId: result.job.id },
        });
        setTimeout(() => router.push(destination), 200);
        return;
      }

      if (typeof window !== 'undefined') {
        sessionStorage.setItem(
          `ai_prompt_${result.websiteId}`,
          JSON.stringify({
            original: combinedPrompt,
            processed: result.prompt,
            timestamp: Date.now(),
          })
        );
      }

      toast({
        title: 'Website Created!',
        description: `${result.prompt.websiteName} is ready for development`,
      });

      if (sessionId) {
        await adoptSession(result.websiteId);
      }

      onWebsiteCreated?.(result.websiteId);
      onOpenChange(false);

      const destination = getStudioWebsiteRoute(result.websiteId, {
        legacyView: 'ai',
        query: result.jobId ? { importJobId: result.jobId } : undefined
      });
      setTimeout(() => router.push(destination), 500);
    } catch (err) {
      console.error('Website creation failed:', err);
      setError(err instanceof Error ? err.message : 'Unable to create website. Please try again.');
    } finally {
      setIsCreating(false);
    }
  }, [prompt, extractedContent, isCreating, user, primeImportStores, toast, onWebsiteCreated, onOpenChange, router]);

  const handleImport = useCallback(async () => {
    if (!importUrl.trim() || isCreating) return;

    // Basic URL validation
    let validUrl: string;
    try {
      const urlObj = new URL(
        importUrl.startsWith('http') ? importUrl : `https://${importUrl}`
      );
      validUrl = urlObj.toString();
    } catch {
      setError('Please enter a valid URL');
      return;
    }

    // Use the AI prompt processor with an import prompt (internal only, not shown to user)
    const importPrompt = `Import ${validUrl}`;

    // Trigger creation with the import prompt
    setIsCreating(true);
    setError(null);

    try {
      const processor = new AIPromptProcessor();
      const processedPrompt = await processor.processPrompt(importPrompt);
      const result = await processor.createWebsiteFromPrompt(importPrompt, processedPrompt, {
        importModelMode,
      });

      if (result.type === 'import') {
        primeImportStores(result.job);

        toast({
          title: 'Import started',
          description: `Importing ${validUrl}. Opening site builder...`,
        });

        onWebsiteCreated?.(result.job.websiteId);
        onOpenChange(false);

        const destination = getStudioWebsiteRoute(result.job.websiteId, {
          query: { importJobId: result.job.id },
        });
        setTimeout(() => router.push(destination), 200);
      }
    } catch (err) {
      console.error('Import failed:', err);
      setError(err instanceof Error ? err.message : 'Unable to import website. Please try again.');
    } finally {
      setIsCreating(false);
    }
  }, [importUrl, importModelMode, isCreating, primeImportStores, toast, onWebsiteCreated, onOpenChange, router]);

  const handleTagClick = useCallback((tagPrompt: string) => {
    // If this is the import tag, switch to import tab instead of showing verbose prompt
    if (tagPrompt.startsWith('Import an existing website')) {
      setActiveTab('import');
      return;
    }
    setPrompt(tagPrompt);
    textareaRef.current?.focus();
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        handleAICreate();
      }
    },
    [handleAICreate]
  );

  const totalCharCount = getTotalCharCount();
  const isOverLimit = totalCharCount > MAX_TOTAL_CHARS;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl bg-gray-900 border-gray-700 text-gray-100">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold text-white">
            Create New Website
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-4">
          <TabsList className="grid w-full grid-cols-3 bg-gray-800">
            <TabsTrigger
              value="ai"
              className="data-[state=active]:bg-gray-700 data-[state=active]:text-white"
            >
              <Sparkles className="h-4 w-4 mr-2" />
              AI Builder
            </TabsTrigger>
            <TabsTrigger
              value="import"
              className="data-[state=active]:bg-gray-700 data-[state=active]:text-white"
            >
              <Upload className="h-4 w-4 mr-2" />
              Import
            </TabsTrigger>
            <TabsTrigger
              value="templates"
              className="data-[state=active]:bg-gray-700 data-[state=active]:text-white"
            >
              <LayoutTemplate className="h-4 w-4 mr-2" />
              Templates
            </TabsTrigger>
          </TabsList>

          {/* AI Builder Tab */}
          <TabsContent value="ai" className="mt-6 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="ai-prompt" className="text-gray-300">
                Describe your website idea
              </Label>
              <textarea
                ref={textareaRef}
                id="ai-prompt"
                value={prompt}
                onChange={(e) => {
                  if (e.target.value.length <= MAX_TOTAL_CHARS) {
                    setPrompt(e.target.value);
                    setError(null);
                  }
                }}
                onKeyDown={handleKeyDown}
                placeholder="e.g., A CRM for small businesses with lead tracking and email automation"
                className={cn(
                  'w-full min-h-[100px] max-h-[150px] p-3 rounded-lg resize-none',
                  'bg-gray-800 border border-gray-700 text-gray-100',
                  'placeholder:text-gray-500',
                  'focus:outline-none focus:ring-2 focus:ring-catalyst-orange focus:border-transparent',
                  'transition-all'
                )}
                disabled={isCreating}
              />
              
              {/* File Upload Section */}
              <div className="mt-3">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={getAcceptedFileTypes()}
                  onChange={handleFileSelect}
                  className="hidden"
                  id="file-upload"
                />

                {!uploadedFile ? (
                  <label
                    htmlFor="file-upload"
                    className="flex items-center gap-2 px-3 py-2 text-sm text-gray-400 hover:text-gray-200 cursor-pointer border border-dashed border-gray-600 rounded-md hover:border-catalyst-orange transition-colors"
                  >
                    <Upload className="h-4 w-4" />
                    <span>Upload PDF, Word, or Markdown file (optional)</span>
                  </label>
                ) : (
                  <div className="flex items-center gap-2 px-3 py-2 text-sm border border-gray-600 rounded-md bg-gray-800/50">
                    {isExtracting ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin text-catalyst-orange" />
                        <span className="text-gray-300">Extracting text...</span>
                      </>
                    ) : extractionError ? (
                      <>
                        <FileText className="h-4 w-4 text-red-400" />
                        <span className="text-red-400 flex-1">{extractionError}</span>
                        <button
                          onClick={handleRemoveFile}
                          className="p-1 hover:bg-gray-700 rounded"
                          type="button"
                        >
                          <X className="h-4 w-4 text-gray-400" />
                        </button>
                      </>
                    ) : (
                      <>
                        <FileText className="h-4 w-4 text-catalyst-orange" />
                        <span className="flex-1 text-gray-200">{uploadedFile.name}</span>
                        <span className="text-gray-500">
                          ({extractedContent?.charCount.toLocaleString()} chars)
                        </span>
                        <button
                          onClick={handleRemoveFile}
                          className="p-1 hover:bg-gray-700 rounded"
                          type="button"
                        >
                          <X className="h-4 w-4 text-gray-400" />
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>

              <div className="flex justify-between text-xs text-gray-500">
                <span>
                  Press <kbd className="px-1.5 py-0.5 bg-gray-700 rounded">Ctrl</kbd> +{' '}
                  <kbd className="px-1.5 py-0.5 bg-gray-700 rounded">Enter</kbd> to create
                </span>
                {(prompt.length > 800 || extractedContent) && (
                  <span className={cn(getTotalCharCount() > MAX_TOTAL_CHARS && 'text-red-400')}>
                    {getTotalCharCount().toLocaleString()}/{MAX_TOTAL_CHARS.toLocaleString()}
                    {extractedContent && (
                      <span className="text-gray-600">
                        {' '}({prompt.length.toLocaleString()} typed + {extractedContent.charCount.toLocaleString()} from file)
                      </span>
                    )}
                  </span>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-sm text-gray-400">Quick starts:</p>
              <QuickCategoryTags onTagClick={handleTagClick} />
            </div>

            {error && (
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 text-sm">
                {error}
              </div>
            )}

            <div className="flex justify-end gap-3 pt-4">
              <Button
                variant="ghost"
                onClick={() => onOpenChange(false)}
                className="text-gray-400 hover:text-white"
              >
                Cancel
              </Button>
              <Button
                onClick={handleAICreate}
                disabled={isCreating || getTotalCharCount() > MAX_TOTAL_CHARS || (!prompt.trim() && !extractedContent)}
                className="bg-catalyst-orange hover:bg-catalyst-orange/90 text-gray-950 font-semibold"
              >
                {isCreating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Create Website
                  </>
                )}
              </Button>
            </div>
          </TabsContent>

          {/* Import Tab */}
          <TabsContent value="import" className="mt-6 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="import-url" className="text-gray-300">
                Website URL to import
              </Label>
              <div className="relative">
                <ExternalLink className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
                <Input
                  id="import-url"
                  type="url"
                  value={importUrl}
                  onChange={(e) => {
                    setImportUrl(e.target.value);
                    setError(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleImport();
                    }
                  }}
                  placeholder="https://example.com"
                  className="pl-10 bg-gray-800 border-gray-700 text-gray-100 placeholder:text-gray-500 focus:ring-catalyst-orange"
                  disabled={isCreating}
                />
              </div>
              <p className="text-xs text-gray-500">
                We'll recreate the structure, navigation, and content of the website
              </p>
            </div>

            <div className="space-y-2">
              <Label className="text-gray-300">
                Model
              </Label>
              <div className="grid grid-cols-2 gap-2 rounded-lg bg-gray-800 p-1">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setImportModelMode('quality')}
                  disabled={isCreating}
                  className={cn(
                    'h-9 justify-center gap-2 text-sm text-gray-300 hover:bg-gray-700 hover:text-white',
                    importModelMode === 'quality' && 'bg-gray-700 text-white'
                  )}
                >
                  <Sparkles className="h-4 w-4" />
                  Quality
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setImportModelMode('cheap')}
                  disabled={isCreating}
                  className={cn(
                    'h-9 justify-center gap-2 text-sm text-gray-300 hover:bg-gray-700 hover:text-white',
                    importModelMode === 'cheap' && 'bg-gray-700 text-white'
                  )}
                >
                  <BadgeDollarSign className="h-4 w-4" />
                  Cheap
                </Button>
              </div>
            </div>

            {error && (
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 text-sm">
                {error}
              </div>
            )}

            <div className="flex justify-end gap-3 pt-4">
              <Button
                variant="ghost"
                onClick={() => onOpenChange(false)}
                className="text-gray-400 hover:text-white"
              >
                Cancel
              </Button>
              <Button
                onClick={handleImport}
                disabled={!importUrl.trim() || isCreating}
                className="bg-catalyst-orange hover:bg-catalyst-orange/90 text-gray-950 font-semibold"
              >
                {isCreating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Importing...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" />
                    Start Import
                  </>
                )}
              </Button>
            </div>
          </TabsContent>

          {/* Templates Tab */}
          <TabsContent value="templates" className="mt-6 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              {['SaaS Landing', 'E-commerce', 'Portfolio', 'Agency'].map((template) => (
                <div
                  key={template}
                  className="relative p-4 rounded-lg border border-gray-700 bg-gray-800/50 opacity-60 cursor-not-allowed"
                >
                  <div className="aspect-video bg-gray-700 rounded mb-3 flex items-center justify-center">
                    <LayoutTemplate className="h-8 w-8 text-gray-500" />
                  </div>
                  <p className="text-sm font-medium text-gray-300">{template}</p>
                  <span className="absolute top-2 right-2 px-2 py-0.5 text-xs bg-gray-700 text-gray-400 rounded">
                    Coming Soon
                  </span>
                </div>
              ))}
            </div>

            <div className="flex justify-end pt-4">
              <Button
                variant="ghost"
                onClick={() => onOpenChange(false)}
                className="text-gray-400 hover:text-white"
              >
                Cancel
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
