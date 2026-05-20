/**
 * Write Progress Tool
 *
 * Allows the AI to create and update a task list for multi-step operations.
 * Progress is stored in the AIContext metadata and persists across messages.
 */

import { tool } from 'ai';
import { z } from 'zod';
import { AIContextService } from '@/lib/services/ai-context-service';

/**
 * Task status enum
 */
const taskStatusSchema = z.enum(['pending', 'in_progress', 'completed', 'failed', 'skipped']);

/**
 * Task schema
 */
const taskSchema = z.object({
  id: z.string().describe('Unique task identifier'),
  title: z.string().describe('Short task title'),
  description: z.string().optional().describe('Detailed task description'),
  status: taskStatusSchema.default('pending').describe('Current task status'),
  completedAt: z.string().optional().describe('ISO timestamp when task was completed'),
  error: z.string().optional().describe('Error message if task failed'),
});

type Task = z.infer<typeof taskSchema>;

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
 * Write Progress Tool
 *
 * Use this tool to:
 * - Create a task list at the start of a multi-step operation
 * - Update task statuses as you progress
 * - Mark tasks as completed or failed
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const writeProgress = (tool as any)({
  description: `Create or update a progress task list for multi-step operations.

Use this tool when:
- Starting a complex task that requires multiple steps
- You want to show the user what you're working on
- Updating the status of tasks as you complete them

The progress is persisted and will be displayed to the user in the assistant panel.

Examples:
- Creating a new page with multiple components: Create tasks for each step
- Updating multiple components: Create a task for each component update
- Complex migrations: Break down into discrete steps`,

  inputSchema: z.object({
    websiteId: z.string().describe('The website ID'),
    sessionId: z.string().describe('The chat session ID'),
    action: z.enum(['create', 'update', 'complete']).describe('Action to perform'),
    tasks: z.array(taskSchema).optional().describe('Task list (required for create action)'),
    taskUpdates: z.array(z.object({
      id: z.string().describe('Task ID to update'),
      status: taskStatusSchema.optional().describe('New status'),
      error: z.string().optional().describe('Error message if failed'),
    })).optional().describe('Updates to apply to existing tasks'),
    currentTaskId: z.string().optional().describe('ID of the task currently being worked on'),
  }),

  execute: async ({
    websiteId,
    sessionId,
    action,
    tasks,
    taskUpdates,
    currentTaskId,
  }: {
    websiteId: string;
    sessionId: string;
    action: 'create' | 'update' | 'complete';
    tasks?: Task[];
    taskUpdates?: Array<{ id: string; status?: Task['status']; error?: string }>;
    currentTaskId?: string;
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

      const currentMetadata = context.metadata || {};
      let progressData: ProgressData | undefined = currentMetadata.progress as ProgressData | undefined;

      switch (action) {
        case 'create': {
          if (!tasks || tasks.length === 0) {
            return {
              success: false,
              error: 'Tasks array is required for create action',
              executionTime: `${Date.now() - startTime}ms`,
            };
          }

          progressData = {
            tasks: tasks.map(t => ({
              ...t,
              status: t.status || 'pending',
            })),
            currentTaskId: currentTaskId || tasks[0]?.id,
            startedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          break;
        }

        case 'update': {
          if (!progressData) {
            return {
              success: false,
              error: 'No progress data exists. Use action: "create" first.',
              executionTime: `${Date.now() - startTime}ms`,
            };
          }

          // Apply task updates
          if (taskUpdates && taskUpdates.length > 0) {
            for (const update of taskUpdates) {
              const taskIndex = progressData.tasks.findIndex(t => t.id === update.id);
              if (taskIndex >= 0) {
                const task = progressData.tasks[taskIndex];
                if (update.status) {
                  task.status = update.status;
                  if (update.status === 'completed') {
                    task.completedAt = new Date().toISOString();
                  }
                }
                if (update.error) {
                  task.error = update.error;
                }
              }
            }
          }

          // Update current task
          if (currentTaskId !== undefined) {
            progressData.currentTaskId = currentTaskId;
          }

          progressData.updatedAt = new Date().toISOString();
          break;
        }

        case 'complete': {
          if (!progressData) {
            return {
              success: false,
              error: 'No progress data exists.',
              executionTime: `${Date.now() - startTime}ms`,
            };
          }

          // Mark all remaining pending tasks as completed
          for (const task of progressData.tasks) {
            if (task.status === 'pending' || task.status === 'in_progress') {
              task.status = 'completed';
              task.completedAt = new Date().toISOString();
            }
          }

          progressData.currentTaskId = undefined;
          progressData.completedAt = new Date().toISOString();
          progressData.updatedAt = new Date().toISOString();
          break;
        }
      }

      // Update metadata with progress
      const updatedMetadata = {
        ...currentMetadata,
        progress: progressData,
      };

      await AIContextService.updateMetadata(websiteId, sessionId, {
        metadata: updatedMetadata,
      });

      // Calculate summary
      const summary = progressData ? {
        total: progressData.tasks.length,
        completed: progressData.tasks.filter(t => t.status === 'completed').length,
        failed: progressData.tasks.filter(t => t.status === 'failed').length,
        pending: progressData.tasks.filter(t => t.status === 'pending').length,
        inProgress: progressData.tasks.filter(t => t.status === 'in_progress').length,
        currentTask: progressData.currentTaskId
          ? progressData.tasks.find(t => t.id === progressData!.currentTaskId)?.title
          : null,
      } : null;

      return {
        success: true,
        action,
        progress: progressData,
        summary,
        executionTime: `${Date.now() - startTime}ms`,
      };

    } catch (error) {
      console.error('Error in writeProgress:', error);

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update progress',
        executionTime: `${Date.now() - startTime}ms`,
      };
    }
  },
});
