/**
 * Read Progress Tool
 *
 * Retrieves the current progress task list from the AI context.
 * Used by the AI to check what tasks remain and track completion.
 */

import { tool } from 'ai';
import { z } from 'zod';
import { AIContextService } from '@/lib/services/ai-context-service';

/**
 * Task structure
 */
interface Task {
  id: string;
  title: string;
  description?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'skipped';
  completedAt?: string;
  error?: string;
}

/**
 * Progress structure stored in metadata
 */
interface ProgressData {
  tasks: Task[];
  currentTaskId?: string;
  startedAt: string;
  updatedAt: string;
  completedAt?: string;
}

/**
 * Read Progress Tool
 *
 * Use this tool to:
 * - Check what tasks remain in a multi-step operation
 * - Get the current task being worked on
 * - Review completion status
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const readProgress = (tool as any)({
  description: `Read the current progress task list from the session.

Use this tool when:
- You need to check what tasks remain
- You want to see the current task status
- Resuming a multi-step operation

Returns the full task list with status and completion information.`,

  inputSchema: z.object({
    websiteId: z.string().describe('The website ID'),
    sessionId: z.string().describe('The chat session ID'),
  }),

  execute: async ({
    websiteId,
    sessionId,
  }: {
    websiteId: string;
    sessionId: string;
  }) => {
    const startTime = Date.now();

    try {
      // Get current context
      const context = await AIContextService.getAIContext(websiteId, sessionId);

      if (!context) {
        return {
          success: false,
          error: 'Session not found',
          executionTime: `${Date.now() - startTime}ms`,
        };
      }

      const progressData: ProgressData | undefined = context.metadata?.progress as ProgressData | undefined;

      if (!progressData) {
        return {
          success: true,
          hasProgress: false,
          message: 'No progress data found for this session',
          executionTime: `${Date.now() - startTime}ms`,
        };
      }

      // Calculate summary
      const summary = {
        total: progressData.tasks.length,
        completed: progressData.tasks.filter(t => t.status === 'completed').length,
        failed: progressData.tasks.filter(t => t.status === 'failed').length,
        pending: progressData.tasks.filter(t => t.status === 'pending').length,
        inProgress: progressData.tasks.filter(t => t.status === 'in_progress').length,
        skipped: progressData.tasks.filter(t => t.status === 'skipped').length,
      };

      const currentTask = progressData.currentTaskId
        ? progressData.tasks.find(t => t.id === progressData.currentTaskId)
        : null;

      const nextPendingTask = progressData.tasks.find(t => t.status === 'pending');

      return {
        success: true,
        hasProgress: true,
        progress: progressData,
        summary,
        currentTask: currentTask || null,
        nextTask: nextPendingTask || null,
        isComplete: progressData.completedAt !== undefined,
        executionTime: `${Date.now() - startTime}ms`,
      };

    } catch (error) {
      console.error('Error in readProgress:', error);

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to read progress',
        executionTime: `${Date.now() - startTime}ms`,
      };
    }
  },
});
