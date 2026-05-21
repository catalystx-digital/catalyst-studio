import { renderHook } from '@testing-library/react'
import { useImportProgressHybrid } from '../use-import-progress-hybrid'
import { useImportTrackerStore } from '@/lib/studio/stores/import-tracker-store'

describe('useImportProgressHybrid', () => {
  const originalFetch = global.fetch
  const originalEventSource = global.EventSource

  beforeEach(() => {
    useImportTrackerStore.setState((draft) => {
      draft.jobs = []
      draft.dismissedJobIds = new Set()
    })
    global.fetch = jest.fn() as typeof global.fetch
  })

  afterEach(() => {
    global.fetch = originalFetch
    global.EventSource = originalEventSource
    jest.restoreAllMocks()
  })

  it('does not poll progress or activity when website SSE must hydrate the job', () => {
    global.EventSource = jest.fn() as unknown as typeof EventSource

    const { result } = renderHook(() =>
      useImportProgressHybrid('job-1', 'site-1', 'session-1'),
    )

    expect(global.fetch).not.toHaveBeenCalled()
    expect(result.current.status).toBe('unknown')
    expect(result.current.message).toContain('Waiting for website real-time updates')
  })

  it('does not fall back to polling when EventSource is unavailable', () => {
    // @ts-expect-error test environment override
    global.EventSource = undefined

    const { result } = renderHook(() =>
      useImportProgressHybrid('job-1', 'site-1', 'session-1'),
    )

    expect(global.fetch).not.toHaveBeenCalled()
    expect(result.current.message).toContain('Waiting for website real-time updates')
  })
})
