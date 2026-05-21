const writeFilesMock = jest.fn()
const runCommandMock = jest.fn()
const domainMock = jest.fn()

jest.mock('@vercel/sandbox', () => ({
  Sandbox: {
    create: jest.fn(async () => ({
      sandboxId: 'sandbox-1',
      writeFiles: writeFilesMock,
      runCommand: runCommandMock,
      domain: domainMock,
    })),
  },
}))

describe('sandbox-manager', () => {
  const originalEnv = process.env

  beforeEach(() => {
    jest.resetModules()
    jest.clearAllMocks()
    process.env = {
      ...originalEnv,
      SANDBOX_TARBALL_URL: 'https://example.com/sandbox-template.tar.gz',
      VERCEL_TEAM_ID: 'team-1',
      VERCEL_PROJECT_ID: 'project-1',
      VERCEL_TOKEN: 'token-1',
      DATABASE_URL: 'postgres://db',
      DIRECT_URL: 'postgres://direct',
    }
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
})
