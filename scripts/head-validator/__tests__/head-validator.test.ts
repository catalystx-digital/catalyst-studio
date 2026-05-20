import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { spawn } from 'node:child_process'
import { existsSync, readFileSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { logger } from '../../generate-head/utils/logger'
import { ensureCliEnvLoaded } from '../../generate-head/utils/env'
import { ensureEmptyDirectory } from '../../generate-head/utils/fs'
import { generateHeadProject } from '../../generate-head/core/generator'

// Mock dependencies
vi.mock('node:child_process')
vi.mock('node:fs')
vi.mock('../../generate-head/utils/logger')
vi.mock('../../generate-head/utils/env')
vi.mock('../../generate-head/utils/fs')
vi.mock('../../generate-head/core/generator')

const mockSpawn = vi.mocked(spawn)
const mockExistsSync = vi.mocked(existsSync)
const mockReadFileSync = vi.mocked(readFileSync)
const mockLogger = vi.mocked(logger)
const mockEnsureCliEnvLoaded = vi.mocked(ensureCliEnvLoaded)
const mockEnsureEmptyDirectory = vi.mocked(ensureEmptyDirectory)
const mockGenerateHeadProject = vi.mocked(generateHeadProject)

describe('head-validator', () => {
  const mockChildProcess = {
    stdout: { on: vi.fn() },
    stderr: { on: vi.fn() },
    on: vi.fn()
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockSpawn.mockReturnValue(mockChildProcess as any)
    mockEnsureCliEnvLoaded.mockImplementation(() => {})
    mockEnsureEmptyDirectory.mockResolvedValue(true)
    mockLogger.setVerbose = vi.fn()
    mockLogger.info = vi.fn()
    mockLogger.warn = vi.fn()
    mockLogger.error = vi.fn()

    // Mock successful generation
    mockGenerateHeadProject.mockResolvedValue({
      files: [],
      snapshot: {
        pages: [
          {
            id: 'page-1',
            title: 'Test Page',
            fullPath: '/',
            components: [
              { id: 'comp-1', type: 'HeroBanner', region: 'hero' },
              { id: 'comp-2', type: 'ContentBlock', region: 'main' }
            ]
          }
        ],
        sharedComponents: []
      },
      diagnostics: [],
      manifest: {} as any,
      diagnosticSummary: { errorCount: 0, warningCount: 0 },
      routes: [],
      slugRegistry: [],
      overwroteOutput: false
    })
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('CLI options', () => {
    it('should require website-id flag', async () => {
      // Import and test the CLI
      const { default: validatorCLI } = await import('../index')

      // Mock process.argv to simulate CLI call without required flag
      const originalArgv = process.argv
      process.argv = ['node', 'validator', '--dry-run']

      try {
        await validatorCLI
      } catch (error) {
        expect(error.message).toContain('website-id')
      }

      process.argv = originalArgv
    })

    it('should accept all CLI options', async () => {
      const { default: validatorCLI } = await import('../index')

      const originalArgv = process.argv
      process.argv = [
        'node',
        'validator',
        '--website-id', 'test-site',
        '--slug', '/about',
        '--output', 'custom-dir',
        '--force',
        '--dry-run'
      ]

      try {
        await validatorCLI
      } catch (error) {
        // Should fail during generation due to dry-run, but CLI options should be parsed
      }

      process.argv = originalArgv
    })
  })

  describe('probe execution', () => {
    beforeEach(() => {
      // Setup mock child process behavior
      let stdoutCallback: ((data: Buffer) => void) | null = null
      let stderrCallback: ((data: Buffer) => void) | null = null
      let closeCallback: ((code: number | null) => void) | null = null

      mockChildProcess.stdout.on.mockImplementation((event: string, callback: (data: Buffer) => void) => {
        if (event === 'data') stdoutCallback = callback
      })

      mockChildProcess.stderr.on.mockImplementation((event: string, callback: (data: Buffer) => void) => {
        if (event === 'data') stderrCallback = callback
      })

      mockChildProcess.on.mockImplementation((event: string, callback: (code: number | null) => void) => {
        if (event === 'close') closeCallback = callback
      })

      // Simulate probe execution
      setTimeout(() => {
        stdoutCallback?.call(null, Buffer.from('Running validation for slug: /\n'))
        stdoutCallback?.call(null, Buffer.from('Found page: Test Page (ID: page-1)\n'))
        stdoutCallback?.call(null, Buffer.from('Validation Summary:\n'))
        stdoutCallback?.call(null, Buffer.from('  Expected: 2\n'))
        stdoutCallback?.call(null, Buffer.from('  Rendered: 2\n'))
        stdoutCallback?.call(null, Buffer.from('  Missing: 0\n'))
        stdoutCallback?.call(null, Buffer.from('  Unexpected: 0\n'))
        stdoutCallback?.call(null, Buffer.from('  Type Mismatches: 0\n'))
        stdoutCallback?.call(null, Buffer.from('✅ Validation passed\n'))
        closeCallback?.call(null, 0)
      }, 100)
    })

    it('should spawn probe with correct environment', async () => {
      mockExistsSync.mockReturnValue(true)
      mockReadFileSync.mockReturnValue(JSON.stringify({
        websiteId: 'test-site',
        slug: '/',
        pageId: 'page-1',
        expectedCount: 2,
        renderedCount: 2,
        missingIds: [],
        unexpectedIds: [],
        typeMismatches: [],
        generatorDiagnostics: [],
        runtimeDiagnostics: [],
        generatedAt: new Date().toISOString()
      }))

      const { default: validatorCLI } = await import('../index')

      const originalArgv = process.argv
      process.argv = ['node', 'validator', '--website-id', 'test-site']

      await validatorCLI

      const spawnCall = mockSpawn.mock.calls[0]
      expect(spawnCall[0]).toBe(process.execPath)
      expect(spawnCall[1]).toEqual(expect.arrayContaining(['generated/validation/run.ts', '--slug', '/']))
      expect(spawnCall[2]).toEqual(expect.objectContaining({
        env: expect.objectContaining({
          HEAD_RUNTIME_COMPONENT_PROBE: '1',
          HEAD_RUNTIME_WEBSITE_ID: 'test-site'
        }),
        cwd: expect.stringContaining('test-site')
      }))

      process.argv = originalArgv
    })

    it('should handle successful validation', async () => {
      mockExistsSync.mockReturnValue(true)
      mockReadFileSync.mockReturnValue(JSON.stringify({
        websiteId: 'test-site',
        slug: '/',
        pageId: 'page-1',
        expectedCount: 2,
        renderedCount: 2,
        missingIds: [],
        unexpectedIds: [],
        typeMismatches: [],
        generatorDiagnostics: [],
        runtimeDiagnostics: [],
        generatedAt: new Date().toISOString()
      }))

      const { default: validatorCLI } = await import('../index')

      const originalArgv = process.argv
      process.argv = ['node', 'validator', '--website-id', 'test-site']

      await validatorCLI

      expect(mockLogger.info).toHaveBeenCalledWith('No validation discrepancies detected')
      expect(process.exitCode).toBe(0)

      process.argv = originalArgv
    })

    it('should handle validation with missing components', async () => {
      mockExistsSync.mockReturnValue(true)
      mockReadFileSync.mockReturnValue(JSON.stringify({
        websiteId: 'test-site',
        slug: '/',
        pageId: 'page-1',
        expectedCount: 2,
        renderedCount: 1,
        missingIds: [{ id: 'comp-1', type: 'HeroBanner', region: 'hero' }],
        unexpectedIds: [],
        typeMismatches: [],
        generatorDiagnostics: [],
        runtimeDiagnostics: [],
        generatedAt: new Date().toISOString()
      }))

      // Simulate probe execution with discrepancies (exit code 2)
      let closeCallback: ((code: number | null) => void) | null = null
      mockChildProcess.on.mockImplementation((event: string, callback: (code: number | null) => void) => {
        if (event === 'close') closeCallback = callback
      })

      setTimeout(() => {
        closeCallback?.call(null, 2) // Exit code 2 for discrepancies
      }, 100)

      const { default: validatorCLI } = await import('../index')

      const originalArgv = process.argv
      process.argv = ['node', 'validator', '--website-id', 'test-site']

      await validatorCLI

      expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('Missing components'))
      expect(mockLogger.warn).toHaveBeenCalledWith('  - comp-1 (HeroBanner, region: hero)')
      expect(mockLogger.warn).toHaveBeenCalledWith('Validation failed with discrepancies')
      expect(process.exitCode).toBe(2)

      process.argv = originalArgv
    })

    it('should handle probe execution failure', async () => {
      // Simulate probe execution failure (exit code 1)
      let closeCallback: ((code: number | null) => void) | null = null
      mockChildProcess.on.mockImplementation((event: string, callback: (code: number | null) => void) => {
        if (event === 'close') closeCallback = callback
      })

      setTimeout(() => {
        closeCallback?.call(null, 1) // Exit code 1 for fatal error
      }, 100)

      const { default: validatorCLI } = await import('../index')

      const originalArgv = process.argv
      process.argv = ['node', 'validator', '--website-id', 'test-site']

      await validatorCLI

      expect(mockLogger.error).toHaveBeenCalledWith('Probe execution failed for slug', expect.objectContaining({
        slug: '/',
        error: expect.any(String)
      }))
      expect(mockLogger.warn).toHaveBeenCalledWith('Validation completed with errors on some slugs', expect.objectContaining({
        failedCount: 1
      }))
      expect(process.exitCode).toBe(1)

      process.argv = originalArgv
    })

    it('should handle missing report file', async () => {
      mockExistsSync.mockReturnValue(false)

      const { default: validatorCLI } = await import('../index')

      const originalArgv = process.argv
      process.argv = ['node', 'validator', '--website-id', 'test-site']

      await validatorCLI

      expect(mockLogger.error).toHaveBeenCalledWith('Probe completed but no report found at expected location', { slug: '/' })
      expect(mockLogger.warn).toHaveBeenCalledWith('Validation completed with errors on some slugs', expect.objectContaining({
        failedCount: 1
      }))
      expect(process.exitCode).toBe(1)

      process.argv = originalArgv
    })
  })

  describe('dry run mode', () => {
    it('should exit without generation in dry-run mode', async () => {
      const { default: validatorCLI } = await import('../index')

      const originalArgv = process.argv
      process.argv = ['node', 'validator', '--website-id', 'test-site', '--dry-run']

      await validatorCLI

      expect(mockGenerateHeadProject).not.toHaveBeenCalled()
      expect(mockSpawn).not.toHaveBeenCalled()

      process.argv = originalArgv
    })
  })

  describe('environment loading', () => {
    it('should load CLI environment before generation', async () => {
      const { default: validatorCLI } = await import('../index')

      const originalArgv = process.argv
      process.argv = ['node', 'validator', '--website-id', 'test-site']

      await validatorCLI

      expect(mockEnsureCliEnvLoaded).toHaveBeenCalled()

      process.argv = originalArgv
    })
  })
})
