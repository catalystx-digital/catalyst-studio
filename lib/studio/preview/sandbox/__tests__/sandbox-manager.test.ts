const writeFilesMock = jest.fn()
const runCommandMock = jest.fn()
const domainMock = jest.fn()
const stopMock = jest.fn()
const sandboxCreateMock = jest.fn()

function mockSandbox(overrides: Record<string, unknown> = {}) {
  return {
    sandboxId: 'sandbox-1',
    writeFiles: writeFilesMock,
    runCommand: runCommandMock,
    domain: domainMock,
    stop: stopMock,
    ...overrides,
  }
}

jest.mock('@vercel/sandbox', () => ({
  Sandbox: {
    create: sandboxCreateMock,
    get: jest.fn(),
  },
}))

describe('sandbox-manager', () => {
  const originalEnv = process.env

  beforeEach(() => {
    jest.resetModules()
    jest.clearAllMocks()
    globalThis.__sandboxStore = undefined
    process.env = {
      ...originalEnv,
      SANDBOX_TARBALL_URL: 'https://example.com/sandbox-template.tar.gz',
      VERCEL_TEAM_ID: 'team-1',
      VERCEL_PROJECT_ID: 'project-1',
      VERCEL_TOKEN: 'token-1',
      DATABASE_URL: 'postgres://db',
      DIRECT_URL: 'postgres://direct',
    }
    sandboxCreateMock.mockResolvedValue(mockSandbox())
    stopMock.mockResolvedValue(undefined)
    writeFilesMock.mockResolvedValue(undefined)
    runCommandMock.mockResolvedValue({
      exitCode: 0,
      logs: async function* logs() {},
    })
    domainMock.mockReturnValue('https://sandbox.example.com')
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it('does not write generated component preview pages during sandbox creation', async () => {
    const { createSandbox } = await import('../sandbox-manager')

    const sandbox = await createSandbox('website-1')

    expect(sandbox.previewUrl).toBe('https://sandbox.example.com')

    const writtenPaths = writeFilesMock.mock.calls
      .flatMap(([files]) => files)
      .map((file: { path: string }) => file.path)

    expect(writtenPaths).toContain('.env.local')
    expect(writtenPaths).not.toContain('app/preview/page.tsx')
    expect(
      writeFilesMock.mock.calls
        .flatMap(([files]) => files)
        .some((file: { content: Buffer }) => file.content.toString().includes('@/lib/studio/components/cms/'))
    ).toBe(false)
  })

  it('exposes creating state without fake id or previewUrl while sandbox creation is pending', async () => {
    let resolveCreate: (sandbox: ReturnType<typeof mockSandbox>) => void = () => {}
    sandboxCreateMock.mockReturnValueOnce(new Promise((resolve) => {
      resolveCreate = resolve
    }))

    const { createSandbox, getSandbox } = await import('../sandbox-manager')

    const creation = createSandbox('website-creating')
    await Promise.resolve()

    const creating = getSandbox('website-creating')
    expect(creating).toMatchObject({
      websiteId: 'website-creating',
      status: 'creating',
    })
    expect(creating?.id).toBeUndefined()
    expect(creating?.previewUrl).toBeUndefined()

    resolveCreate(mockSandbox())
    await expect(creation).resolves.toMatchObject({
      id: 'sandbox-1',
      previewUrl: 'https://sandbox.example.com',
      status: 'ready',
    })
  })

  it('keeps a visible error state and rethrows when sandbox creation fails', async () => {
    sandboxCreateMock.mockRejectedValueOnce(new Error('quota exceeded'))

    const { createSandbox, getSandbox } = await import('../sandbox-manager')

    await expect(createSandbox('website-fail')).rejects.toThrow('quota exceeded')

    const failed = getSandbox('website-fail')
    expect(failed).toMatchObject({
      websiteId: 'website-fail',
      status: 'error',
      error: 'quota exceeded',
    })
    expect(failed?.id).toBeUndefined()
    expect(failed?.previewUrl).toBeUndefined()
  })

  it('throws non-zero chmod results, cleans up the created sandbox, and keeps error visible', async () => {
    runCommandMock.mockResolvedValueOnce({
      exitCode: 126,
      logs: async function* logs() {},
    })

    const { createSandbox, getSandbox } = await import('../sandbox-manager')

    await expect(createSandbox('website-chmod')).rejects.toThrow('chmod node_modules/.bin failed with exit code 126')
    expect(stopMock).toHaveBeenCalledTimes(1)

    expect(getSandbox('website-chmod')).toMatchObject({
      status: 'error',
      error: 'chmod node_modules/.bin failed with exit code 126',
    })
  })

  it('surfaces cleanup failure after a partial setup failure and keeps the handle retryable', async () => {
    writeFilesMock.mockRejectedValueOnce(new Error('env write failed'))
    stopMock.mockRejectedValueOnce(new Error('stop denied'))

    const { createSandbox, getSandbox, stopSandbox } = await import('../sandbox-manager')

    await expect(createSandbox('website-cleanup-fail')).rejects.toThrow(
      'env write failed; cleanup failed: stop denied'
    )

    expect(getSandbox('website-cleanup-fail')).toMatchObject({
      id: 'sandbox-1',
      status: 'error',
      error: 'env write failed; cleanup failed: stop denied',
    })
    expect(stopMock).toHaveBeenCalledTimes(1)

    await expect(stopSandbox('website-cleanup-fail')).resolves.toBeUndefined()

    expect(stopMock).toHaveBeenCalledTimes(2)
    expect(getSandbox('website-cleanup-fail')).toBeUndefined()
  })

  it('stops a retained failed setup handle before retrying sandbox creation', async () => {
    writeFilesMock.mockRejectedValueOnce(new Error('env write failed'))
    stopMock
      .mockRejectedValueOnce(new Error('stop denied'))
      .mockResolvedValueOnce(undefined)
    sandboxCreateMock
      .mockResolvedValueOnce(mockSandbox({ sandboxId: 'sandbox-old' }))
      .mockResolvedValueOnce(mockSandbox({ sandboxId: 'sandbox-new' }))

    const { createSandbox, getSandbox } = await import('../sandbox-manager')

    await expect(createSandbox('website-retry-create')).rejects.toThrow(
      'env write failed; cleanup failed: stop denied'
    )
    expect(getSandbox('website-retry-create')).toMatchObject({
      id: 'sandbox-old',
      status: 'error',
    })

    await expect(createSandbox('website-retry-create')).resolves.toMatchObject({
      id: 'sandbox-new',
      status: 'ready',
      previewUrl: 'https://sandbox.example.com',
    })

    expect(stopMock).toHaveBeenCalledTimes(2)
    expect(sandboxCreateMock).toHaveBeenCalledTimes(2)
  })

  it('rejects retry creation and keeps the old handle visible when retained handle cleanup fails', async () => {
    writeFilesMock.mockRejectedValueOnce(new Error('env write failed'))
    stopMock
      .mockRejectedValueOnce(new Error('cleanup stop denied'))
      .mockRejectedValueOnce(new Error('retry stop denied'))
    sandboxCreateMock
      .mockResolvedValueOnce(mockSandbox({ sandboxId: 'sandbox-old' }))
      .mockResolvedValueOnce(mockSandbox({ sandboxId: 'sandbox-new' }))

    const { createSandbox, getSandbox, stopSandbox } = await import('../sandbox-manager')

    await expect(createSandbox('website-retry-blocked')).rejects.toThrow(
      'env write failed; cleanup failed: cleanup stop denied'
    )

    await expect(createSandbox('website-retry-blocked')).rejects.toThrow(
      'Cannot create sandbox for website-retry-blocked because existing sandbox sandbox-old could not be stopped: retry stop denied'
    )

    expect(sandboxCreateMock).toHaveBeenCalledTimes(1)
    expect(getSandbox('website-retry-blocked')).toMatchObject({
      id: 'sandbox-old',
      status: 'error',
      error: 'Failed to cleanup existing sandbox before retry: retry stop denied. Previous error: env write failed; cleanup failed: cleanup stop denied',
    })

    stopMock.mockResolvedValueOnce(undefined)
    await expect(stopSandbox('website-retry-blocked')).resolves.toBeUndefined()
    expect(stopMock).toHaveBeenCalledTimes(3)
    expect(getSandbox('website-retry-blocked')).toBeUndefined()
  })

  it('refreshes lastActivityAt only for active usable sandbox states', async () => {
    const { createSandbox, getSandbox } = await import('../sandbox-manager')

    const ready = await createSandbox('website-ready')
    const readyActivity = ready.lastActivityAt
    getSandbox('website-ready')
    expect(ready.lastActivityAt.getTime()).toBeGreaterThanOrEqual(readyActivity.getTime())

    sandboxCreateMock.mockRejectedValueOnce(new Error('create failed'))
    await expect(createSandbox('website-error')).rejects.toThrow('create failed')
    const errored = getSandbox('website-error')
    const errorActivity = errored?.lastActivityAt
    getSandbox('website-error')
    expect(errored?.lastActivityAt).toBe(errorActivity)
  })

  it('throws stop failures and preserves a retryable error state', async () => {
    stopMock.mockRejectedValueOnce(new Error('api unavailable'))

    const { createSandbox, stopSandbox, getSandbox } = await import('../sandbox-manager')

    await createSandbox('website-stop')
    await expect(stopSandbox('website-stop')).rejects.toThrow('api unavailable')

    expect(getSandbox('website-stop')).toMatchObject({
      id: 'sandbox-1',
      status: 'error',
      error: 'Failed to stop sandbox: api unavailable',
    })
  })

  it('continues cleaning up all idle sandboxes and then reports failures', async () => {
    const { createSandbox, getSandbox, cleanupIdleSandboxes } = await import('../sandbox-manager')

    await createSandbox('website-idle-fail')
    await createSandbox('website-idle-ok')

    const oldActivity = new Date(Date.now() - 16 * 60 * 1000)
    const fail = getSandbox('website-idle-fail')
    const ok = getSandbox('website-idle-ok')
    if (fail) fail.lastActivityAt = oldActivity
    if (ok) ok.lastActivityAt = oldActivity

    stopMock
      .mockRejectedValueOnce(new Error('first stop failed'))
      .mockResolvedValueOnce(undefined)

    await expect(cleanupIdleSandboxes()).rejects.toThrow(
      'Failed to cleanup 1 idle sandbox(es): website-idle-fail: first stop failed'
    )

    expect(stopMock).toHaveBeenCalledTimes(2)
    expect(getSandbox('website-idle-fail')).toMatchObject({
      status: 'error',
      error: 'Failed to stop sandbox: first stop failed',
    })
    expect(getSandbox('website-idle-ok')).toBeUndefined()
  })
})
