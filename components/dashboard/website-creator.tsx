'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { useUser } from '@/lib/supabase/hooks';
import { AIPromptProcessor } from '@/lib/services/ai-prompt-processor';
import { useImportTrackerStore } from '@/lib/studio/stores/import-tracker-store';
import type { ImportJobSnapshot } from '@/lib/services/ai-prompt-processor';
import type { ImportActivityItem } from '@/lib/api/hooks/use-import-activity';
import { useToast } from '@/components/ui/use-toast';
import { AIPromptSection } from './ai-prompt-section';
import { PromptAuthModal } from './prompt-auth-modal';
import { getStudioWebsiteRoute } from '@/lib/config/deployment';
import { monitoring } from '@/lib/monitoring';
import { getBuilderAssistantSessionId } from '@/lib/studio/components/site-builder/assistant-session';
import { adoptDashboardChatSession, createPromptIdempotencyKey, getDashboardSessionId, logDashboardPrompt } from '@/lib/studio/services/dashboard-chat-logger';

const IMPORT_PROMPT_STORAGE_PREFIX = 'import_prompt_';
const PENDING_PROMPT_STORAGE_KEY = 'dashboard_pending_prompt';

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

export function WebsiteCreator() {
  const router = useRouter();
  const user = useUser();
  const queryClient = useQueryClient();
  const hydrateJobs = useImportTrackerStore((state) => state.hydrateJobs);
  const { toast } = useToast();
  const [isCreating, setIsCreating] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [pendingPrompt, setPendingPrompt] = useState<string | null>(null);

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
          const current = Array.isArray(existing) ? existing.filter((item) => item.id !== job.id) : [];
          return [toImportActivity(job), ...current];
        },
      );
    },
    [hydrateJobs, queryClient],
  );

  const clearPendingPromptStorage = useCallback(() => {
    setPendingPrompt(null);
    if (typeof window === 'undefined') return;
    try {
      sessionStorage.removeItem(PENDING_PROMPT_STORAGE_KEY);
    } catch {
      // ignore storage failures
    }
  }, []);

  const persistPendingPrompt = useCallback((prompt: string) => {
    if (typeof window === 'undefined') return;
    try {
      sessionStorage.setItem(
        PENDING_PROMPT_STORAGE_KEY,
        JSON.stringify({ prompt, timestamp: Date.now() }),
      );
    } catch {
      // ignore storage failures
    }
  }, []);

  const handleWebsiteCreation = useCallback(
    async (userPrompt: string, options?: { skipAuthCheck?: boolean }) => {
      if (!options?.skipAuthCheck && !user) {
        setPendingPrompt(userPrompt);
        persistPendingPrompt(userPrompt);
        setShowAuthModal(true);
        return;
      }

      clearPendingPromptStorage();
      setIsCreating(true);
      const accountId = user?.id ?? null;
      const sessionId = accountId ? getDashboardSessionId(accountId) : null;
      const idempotencyKey = sessionId ? createPromptIdempotencyKey(sessionId, userPrompt) : null;

      if (sessionId && idempotencyKey) {
        try {
          await logDashboardPrompt({
            sessionId,
            prompt: userPrompt,
            idempotencyKey,
            metadata: {
              scope: { type: 'site', label: 'Dashboard Prompt' },
              scopeLabel: 'Dashboard Prompt',
              source: 'dashboard',
            },
          });
        } catch (error) {
          monitoring.logError('dashboard_prompt_log_failed', error instanceof Error ? error : undefined, {
            sessionId,
          });
        }
      }

      const adoptSession = async (websiteId: string) => {
        if (!sessionId) {
          return;
        }
        try {
          await adoptDashboardChatSession({
            sourceSessionId: sessionId,
            websiteId,
            targetSessionId: getBuilderAssistantSessionId(websiteId),
          });
        } catch (error) {
          monitoring.logError(
            'dashboard_chat_session_adopt_failed',
            error instanceof Error ? error : undefined,
            {
              sessionId,
              websiteId,
            },
          );
        }
      };

      try {
        const processor = new AIPromptProcessor();
        const processedPrompt = await processor.processPrompt(userPrompt);
        const result = await processor.createWebsiteFromPrompt(userPrompt, processedPrompt);

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
                original: userPrompt,
                processed: result.prompt,
                url: result.url,
                createdAt: result.job.createdAt,
                timestamp: Date.now(),
              }),
            );
            sessionStorage.setItem(
              `ai_prompt_${result.job.websiteId}`,
              JSON.stringify({
                original: userPrompt,
                processed: result.prompt,
                timestamp: Date.now(),
              }),
            );
          }

          toast({
            title: 'Import started',
            description: `Importing ${result.url}. Opening site builder...`,
          });

          const destination = getStudioWebsiteRoute(result.job.websiteId, {
            query: { importJobId: result.job.id },
          });

          setTimeout(() => {
            router.push(destination);
          }, 200);

          return;
        }

        if (typeof window !== 'undefined') {
          sessionStorage.setItem(
            `ai_prompt_${result.websiteId}`,
            JSON.stringify({
              original: userPrompt,
              processed: result.prompt,
              timestamp: Date.now(),
            }),
          );

          // Check for bootstrap errors
          const errorData = sessionStorage.getItem(`bootstrap_error_${result.websiteId}`);
          if (errorData) {
            try {
              const { error } = JSON.parse(errorData);
              toast({
                title: 'Website Created (No Content)',
                description: error || 'AI generation failed. Please add content or try with more details.',
                variant: 'destructive',
              });
              sessionStorage.removeItem(`bootstrap_error_${result.websiteId}`);
              // Still navigate - user can add content manually
            } catch {
              // ignore parsing errors
            }
          } else {
            toast({
              title: 'Website Created!',
              description: `${result.prompt.websiteName} is ready for development`,
            });
          }
        } else {
          toast({
            title: 'Website Created!',
            description: `${result.prompt.websiteName} is ready for development`,
          });
        }

        if (sessionId) {
          await adoptSession(result.websiteId);
        }

        // Pass jobId to URL for progress tracking (same as import flow)
        const destination = getStudioWebsiteRoute(result.websiteId, {
          legacyView: 'ai',
          query: result.jobId ? { importJobId: result.jobId } : undefined,
        });

        setTimeout(() => {
          router.push(destination);
        }, 500);
      } catch (error) {
        console.error('Website creation failed:', error);
        toast({
          title: 'Creation Failed',
          description: error instanceof Error ? error.message : 'Unable to create website. Please try again.',
          variant: 'destructive',
        });
      } finally {
        setIsCreating(false);
      }
    },
    [user, persistPendingPrompt, clearPendingPromptStorage, primeImportStores, toast, router],
  );

  useEffect(() => {
    if (!user || typeof window === 'undefined') {
      return;
    }

    try {
      const raw = sessionStorage.getItem(PENDING_PROMPT_STORAGE_KEY);
      if (!raw) {
        return;
      }
      const parsed = JSON.parse(raw) as { prompt?: string } | null;
      if (parsed?.prompt) {
        clearPendingPromptStorage();
        void handleWebsiteCreation(parsed.prompt, { skipAuthCheck: true });
      }
    } catch {
      clearPendingPromptStorage();
    }
  }, [user, handleWebsiteCreation, clearPendingPromptStorage]);

  const handleAuthSuccess = useCallback(() => {
    let nextPrompt = pendingPrompt;
    if (typeof window !== 'undefined') {
      try {
        const raw = sessionStorage.getItem(PENDING_PROMPT_STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as { prompt?: string } | null;
          if (parsed?.prompt) {
            nextPrompt = parsed.prompt;
          }
        }
      } catch {
        // ignore parse errors
      }
    }

    clearPendingPromptStorage();
    setShowAuthModal(false);

    if (nextPrompt) {
      void handleWebsiteCreation(nextPrompt, { skipAuthCheck: true });
    }
  }, [pendingPrompt, clearPendingPromptStorage, handleWebsiteCreation]);

  return (
    <div className="website-creator">
      <AIPromptSection onWebsiteCreated={(prompt) => handleWebsiteCreation(prompt)} isCreating={isCreating} />
      <PromptAuthModal
        open={showAuthModal}
        initialPrompt={pendingPrompt}
        onClose={() => setShowAuthModal(false)}
        onAuthenticated={handleAuthSuccess}
      />
    </div>
  );
}

