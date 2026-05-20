import { createDetectionTelemetry } from '../detection-telemetry'

jest.mock('@/lib/studio/components/cms/_import/performance', () => {
  const measure = jest.fn(async (_name: string, fn: any) => fn())
  const measureSync = jest.fn((_name: string, fn: any) => fn())
  const startTimer = jest.fn(() => 'timer-id')
  const endTimer = jest.fn(() => 25)
  return {
    performanceMonitor: {
      measure,
      measureSync,
      startTimer,
      endTimer
    }
  }
})

const performanceModule = jest.requireMock('@/lib/studio/components/cms/_import/performance') as {
  performanceMonitor: {
    measure: jest.Mock
    measureSync: jest.Mock
    startTimer: jest.Mock
    endTimer: jest.Mock
  }
}

describe('createDetectionTelemetry', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    performanceModule.performanceMonitor.endTimer.mockImplementation(() => 25)
    performanceModule.performanceMonitor.startTimer.mockImplementation(() => 'timer-id')
  })

  it('records phase timing and summary logs', async () => {
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined)
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined)

    try {
      const telemetry = createDetectionTelemetry({ url: 'https://example.com/path?utm=q', model: 'test-model', runId: 'run-123' })
      await telemetry.timePhase('prompt_build', async () => 'ok', () => ({ context: 'prompt' }))
      telemetry.flush({ tokenUsage: 321 })

      expect(logSpy).toHaveBeenCalledWith(
        '[DETECTION][PhaseTiming]',
        expect.objectContaining({
          phase: 'prompt_build',
          status: 'ok',
          url: 'https://example.com/path',
          metadata: expect.objectContaining({ context: 'prompt' })
        })
      )
      expect(logSpy).toHaveBeenCalledWith(
        '[DETECTION][Summary]',
        expect.objectContaining({
          url: 'https://example.com/path',
          phaseCount: 1,
          totalDurationMs: expect.any(Number),
          tokenUsage: 321
        })
      )
      expect(warnSpy).not.toHaveBeenCalled()
    } finally {
      logSpy.mockRestore()
      warnSpy.mockRestore()
    }
  })

  it('emits threshold warning when duration exceeds baseline', async () => {
    performanceModule.performanceMonitor.endTimer.mockImplementationOnce(() => 5000)
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined)

    try {
      const telemetry = createDetectionTelemetry({ url: 'https://example.com', model: 'test-model' })
      await telemetry.timePhase('fetch', async () => undefined)
      expect(warnSpy).toHaveBeenCalledWith(
        '[DETECTION][PhaseThreshold]',
        expect.objectContaining({ phase: 'fetch', durationMs: 5000 })
      )
    } finally {
      warnSpy.mockRestore()
    }
  })
})
