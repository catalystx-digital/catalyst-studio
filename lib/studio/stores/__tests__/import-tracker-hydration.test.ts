import { act } from '@testing-library/react'

import { useImportTrackerStore } from '@/lib/studio/stores/import-tracker-store'

describe('import tracker hydration', () => {
  beforeEach(() => {
    act(() => {
      useImportTrackerStore.setState((state) => {
        state.jobs = []
      })
    })
  })

  it('adds hydrated jobs to the tracker', () => {
    act(() => {
      useImportTrackerStore.getState().hydrateJobs([
        {
          id: 'job-1',
          websiteId: 'site-1',
          url: 'https://example.com',
          status: 'processing',
          progress: 30,
          stage: 'fetching',
          message: 'Fetching content',
          mode: 'new',
          startedAt: '2025-09-17T10:00:00.000Z',
          updatedAt: '2025-09-17T10:02:00.000Z',
          completedAt: null,
        },
      ])
    })

    const jobs = useImportTrackerStore.getState().jobs
    expect(jobs).toHaveLength(1)
    expect(jobs[0]).toMatchObject({
      id: 'job-1',
      status: 'processing',
      state: 'active',
      progress: 30,
      mode: 'new',
    })
  })

  it('captures queued jobs with queue metadata', () => {
    act(() => {
      useImportTrackerStore.getState().hydrateJobs([
        {
          id: 'job-queue',
          websiteId: 'site-queue',
          url: 'https://queued.example',
          status: 'queued',
          progress: 0,
          stage: 'queued',
          message: 'Queued - waiting for an available import slot',
          mode: 'new',
          queuePosition: 3,
          estimatedStartSeconds: 360,
        },
      ])
    })

    const job = useImportTrackerStore.getState().jobs.find((entry) => entry.id === 'job-queue')
    expect(job).toBeDefined()
    expect(job?.state).toBe('queued')
    expect(job?.queuePosition).toBe(3)
    expect(job?.estimatedStartSeconds).toBe(360)
    expect(job?.startedAt).toBeNull()
  })

  it('updates existing jobs when new hydration data arrives', () => {
    act(() => {
      useImportTrackerStore.getState().registerJob({
        id: 'job-2',
        websiteId: 'site-2',
        url: 'https://example.org',
        mode: 'new',
      })
    })

    act(() => {
      useImportTrackerStore.getState().hydrateJobs([
        {
          id: 'job-2',
          websiteId: 'site-2',
          url: 'https://example.org',
          status: 'processing',
          progress: 80,
          stage: 'generating',
          message: 'Generating components',
          mode: 'new',
          startedAt: '2025-09-17T09:00:00.000Z',
          updatedAt: '2025-09-17T09:08:00.000Z',
          completedAt: null,
        },
      ])
    })

    const job = useImportTrackerStore.getState().jobs.find((entry) => entry.id === 'job-2')
    expect(job).toBeDefined()
    expect(job?.progress).toBe(80)
    expect(job?.stage).toBe('generating')
    expect(job?.message).toBe('Generating components')
  })
})

