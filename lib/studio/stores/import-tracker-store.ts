import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { enableMapSet } from 'immer';

enableMapSet();

export type ImportSessionMode = 'new' | 'merge';

export type ImportTrackerStatus = 'pending' | 'processing' | 'queued' | 'completed' | 'failed' | 'cancelled';

export interface ImportJobSummary {
  pagesCreated?: number;
  componentsCreated?: number;
  sharedComponentsDetected?: number;
  processingTimeMs?: number;
  notes?: string;
}

export type ImportLifecycleState = 'active' | 'queued' | 'completed';

export interface ImportJobEntry {
  id: string;
  websiteId: string;
  url: string;
  mode: ImportSessionMode;
  status: ImportTrackerStatus;
  state: ImportLifecycleState;
  progress: number;
  stage?: string;
  message?: string;
  startedAt: string | null;
  updatedAt?: string | null;
  completedAt?: string | null;
  summary?: ImportJobSummary;
  error?: string;
  queuePosition?: number | null;
  estimatedStartSeconds?: number | null;
  metadata?: Record<string, unknown> | null;
}

interface HydratedImportJobPayload {
  id: string;
  websiteId: string;
  url: string;
  status?: ImportTrackerStatus;
  state?: ImportLifecycleState;
  progress?: number;
  stage?: string | null;
  message?: string | null;
  mode?: ImportSessionMode;
  startedAt?: string | null;
  updatedAt?: string | null;
  completedAt?: string | null;
  queuePosition?: number | null;
  estimatedStartSeconds?: number | null;
  metadata?: Record<string, unknown> | null;
}

interface RegisterJobPayload {
  id: string;
  websiteId: string;
  url: string;
  mode: ImportSessionMode;
  status?: ImportTrackerStatus;
  state?: ImportLifecycleState;
  progress?: number;
  stage?: string;
  message?: string;
  queuePosition?: number | null;
  estimatedStartSeconds?: number | null;
  startedAt?: string | null;
  updatedAt?: string | null;
  completedAt?: string | null;
  metadata?: Record<string, unknown> | null;
}

interface ImportTrackerState {
  jobs: ImportJobEntry[];
  dismissedJobIds: Set<string>;
  registerJob: (job: RegisterJobPayload) => void;
  updateJob: (
    jobId: string,
    patch: Partial<
      Pick<
        ImportJobEntry,
        'progress' | 'stage' | 'message' | 'status' | 'state' | 'queuePosition' | 'estimatedStartSeconds' | 'metadata'
      >
    >,
  ) => void;
  completeJob: (jobId: string, summary?: ImportJobSummary) => void;
  failJob: (jobId: string, errorMessage: string) => void;
  dismissJob: (jobId: string) => void;
  clearCompleted: () => void;
  hydrateJobs: (jobs: HydratedImportJobPayload[]) => void;
}

const MAX_TRACKED_JOBS = 8;

const isoNow = () => new Date().toISOString();

const clampProgress = (value: number) => Math.max(0, Math.min(100, value));

const deriveLifecycleState = (status: ImportTrackerStatus): ImportLifecycleState => {
  switch (status) {
    case 'queued':
      return 'queued';
    case 'completed':
    case 'failed':
    case 'cancelled':
      return 'completed';
    default:
      return 'active';
  }
};

const resolveLifecycleState = (
  status: ImportTrackerStatus,
  explicit?: ImportLifecycleState | null,
): ImportLifecycleState => explicit ?? deriveLifecycleState(status);

export const useImportTrackerStore = create<ImportTrackerState>()(
  immer((set) => ({
    jobs: [],
    dismissedJobIds: new Set<string>(),
    registerJob: (payload) => {
      const defaultTimestamp = isoNow();
      set((state) => {
        state.dismissedJobIds.delete(payload.id);
        const status = payload.status ?? 'processing';
        const startedAt =
          payload.startedAt === undefined ? defaultTimestamp : payload.startedAt;
        const updatedAt =
          payload.updatedAt === undefined ? defaultTimestamp : payload.updatedAt;
        const entry: ImportJobEntry = {
          id: payload.id,
          websiteId: payload.websiteId,
          url: payload.url,
          mode: payload.mode,
          status,
          state: resolveLifecycleState(status, payload.state),
          progress: clampProgress(
            status === 'completed' ? 100 : payload.progress ?? 0,
          ),
          stage:
            payload.stage ??
            (status === 'queued'
              ? 'queued'
              : status === 'completed'
              ? 'creating'
              : 'fetching'),
          message: payload.message,
          queuePosition: payload.queuePosition ?? null,
          estimatedStartSeconds: payload.estimatedStartSeconds ?? null,
          metadata: payload.metadata ?? null,
          startedAt,
          updatedAt,
          completedAt: payload.completedAt ?? null,
        };

        const index = state.jobs.findIndex((job) => job.id === entry.id);
        if (index >= 0) {
          state.jobs[index] = {
            ...state.jobs[index],
            ...entry,
            summary: state.jobs[index].summary,
            error: state.jobs[index].error,
          };
        } else {
          state.jobs.unshift(entry);
          if (state.jobs.length > MAX_TRACKED_JOBS) {
            state.jobs.pop();
          }
        }
      });
    },
    updateJob: (jobId, patch) => {
      set((state) => {
        const index = state.jobs.findIndex((job) => job.id === jobId);
        if (index === -1) return;
        const job = state.jobs[index];

        const nextStatus = patch.status ?? job.status;
        const nextState = resolveLifecycleState(nextStatus, patch.state ?? null);

        state.jobs[index] = {
          ...job,
          ...patch,
          status: nextStatus,
          state: nextState,
          progress: clampProgress(patch.progress ?? job.progress),
          stage: patch.stage ?? job.stage,
          message: patch.message ?? job.message,
          metadata: patch.metadata ?? job.metadata ?? null,
          queuePosition:
            patch.queuePosition !== undefined ? patch.queuePosition : job.queuePosition ?? null,
          estimatedStartSeconds:
            patch.estimatedStartSeconds !== undefined
              ? patch.estimatedStartSeconds
              : job.estimatedStartSeconds ?? null,
          updatedAt: isoNow(),
        };

        if (nextState === 'active') {
          state.dismissedJobIds.delete(jobId);
        }
      });
    },
    completeJob: (jobId, summary) => {
      set((state) => {
        const index = state.jobs.findIndex((job) => job.id === jobId);
        if (index === -1) return;
        const timestamp = isoNow();
        state.jobs[index] = {
          ...state.jobs[index],
          status: 'completed',
          state: 'completed',
          progress: 100,
          stage: 'creating',
          summary,
          completedAt: timestamp,
          updatedAt: timestamp,
          message: summary?.notes ?? state.jobs[index].message,
          error: undefined,
          queuePosition: null,
          estimatedStartSeconds: null,
        };
      });
    },
    failJob: (jobId, errorMessage) => {
      set((state) => {
        const index = state.jobs.findIndex((job) => job.id === jobId);
        if (index === -1) return;
        const timestamp = isoNow();
        state.jobs[index] = {
          ...state.jobs[index],
          status: 'failed',
          state: 'completed',
          error: errorMessage,
          completedAt: timestamp,
          updatedAt: timestamp,
          queuePosition: null,
          estimatedStartSeconds: null,
        };
      });
    },
    dismissJob: (jobId) => {
      set((state) => {
        state.jobs = state.jobs.filter((job) => job.id !== jobId);
        state.dismissedJobIds.add(jobId);
      });
    },
    hydrateJobs: (jobs) => {
      if (!Array.isArray(jobs) || jobs.length === 0) {
        return;
      }

      set((state) => {
        for (const payload of jobs) {
          if (!payload || typeof payload !== 'object') continue;
          const { id } = payload;
          if (!id) continue;

          const existingIndex = state.jobs.findIndex((job) => job.id === id);
          const existing = existingIndex >= 0 ? state.jobs[existingIndex] : undefined;

          const status = payload.status ?? existing?.status ?? 'pending';
          const isTerminal = status === 'completed' || status === 'failed' || status === 'cancelled';
          if (state.dismissedJobIds.has(id)) {
            if (isTerminal) {
              continue;
            }
            state.dismissedJobIds.delete(id);
          }
          const stateValue = resolveLifecycleState(status, payload.state ?? existing?.state ?? null);
          const progress =
            status === 'completed'
              ? 100
              : clampProgress(payload.progress ?? existing?.progress ?? 0);
          const stage =
            payload.stage ??
            existing?.stage ??
            (status === 'queued' ? 'queued' : status === 'completed' ? 'creating' : 'fetching');
          const message = payload.message ?? existing?.message;
          const startedAt =
            payload.startedAt !== undefined ? payload.startedAt : existing?.startedAt ?? null;
          const updatedAt = payload.updatedAt ?? isoNow();
          const completedAt =
            payload.completedAt ??
            (status === 'completed' ? updatedAt : existing?.completedAt ?? undefined);
          const queuePosition =
            payload.queuePosition ?? existing?.queuePosition ?? null;
          const estimatedStartSeconds =
            payload.estimatedStartSeconds ?? existing?.estimatedStartSeconds ?? null;
          const mode = payload.mode ?? existing?.mode ?? 'new';
          const error = status === 'failed' ? message ?? 'Import failed' : existing?.error;

          const nextEntry: ImportJobEntry = {
            id,
            websiteId: payload.websiteId ?? existing?.websiteId ?? '',
            url: payload.url ?? existing?.url ?? '',
            mode,
            status,
            state: stateValue,
            progress,
            stage: stage ?? undefined,
            message: message ?? undefined,
            startedAt,
            updatedAt,
            completedAt,
            summary: existing?.summary,
            error: error ?? undefined,
            queuePosition,
            estimatedStartSeconds,
            metadata: payload.metadata ?? existing?.metadata ?? null,
          };

          if (existingIndex >= 0) {
            state.jobs[existingIndex] = {
              ...state.jobs[existingIndex],
              ...nextEntry,
              summary: state.jobs[existingIndex].summary,
            };
          } else {
            state.jobs.unshift(nextEntry);
            if (state.jobs.length > MAX_TRACKED_JOBS) {
              state.jobs.pop();
            }
          }
        }
      });
    },
    clearCompleted: () => {
      set((state) => {
        state.jobs.forEach((job) => {
          if (job.state === 'completed') {
            state.dismissedJobIds.add(job.id);
          }
        });
        state.jobs = state.jobs.filter((job) => job.state !== 'completed');
      });
    },
  })),
);

export const deriveActiveImportJobs = (jobs: ImportJobEntry[]) =>
  jobs.filter((job) => job.state === 'active' || job.state === 'queued');

export const deriveCompletedImportJobs = (jobs: ImportJobEntry[]) =>
  jobs.filter((job) => job.state === 'completed');

export const selectActiveImportJobs = (state: ImportTrackerState) =>
  deriveActiveImportJobs(state.jobs);

export const selectCompletedImportJobs = (state: ImportTrackerState) =>
  deriveCompletedImportJobs(state.jobs);

