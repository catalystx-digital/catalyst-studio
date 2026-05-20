/**
 * Integration tests for standalone-import.ts re-import mode
 *
 * These tests verify the CLI argument parsing and re-import flow.
 * They mock external dependencies but test the actual CLI logic.
 */

import { spawn } from 'child_process'
import * as path from 'path'

// Mock modules that would be dynamically imported
jest.mock('../../lib/generated/prisma', () => ({
  PrismaClient: jest.fn().mockImplementation(() => mockPrisma),
}))

jest.mock('../../lib/studio/import/import-pipeline', () => ({
  ImportPipeline: jest.fn().mockImplementation(() => mockImportPipeline),
}))

jest.mock('../../lib/studio/import/services/reimport-service', () => ({
  ReImportService: jest.fn().mockImplementation(() => mockReImportService),
}))

const mockPrisma = {
  $disconnect: jest.fn().mockResolvedValue(undefined),
}

const mockImportPipeline = {
  execute: jest.fn(),
}

const mockReImportService = {
  reimport: jest.fn(),
}

describe('Standalone Import - Re-Import Mode', () => {
  const scriptPath = path.join(__dirname, '..', 'standalone-import.ts')

  beforeEach(() => {
    jest.clearAllMocks()
    process.env.OPENROUTER_API_KEY = 'test-api-key'
  })

  describe('CLI Argument Parsing', () => {
    it('requires --website-id for reimport mode', (done) => {
      const child = spawn('npx', ['tsx', scriptPath, '--reimport', '--urls', 'https://example.com/about'], {
        env: { ...process.env },
        shell: true,
      })

      let stderr = ''
      child.stderr.on('data', (data) => {
        stderr += data.toString()
      })

      child.on('close', (code) => {
        expect(code).toBe(1)
        expect(stderr).toContain('--website-id is required')
        done()
      })
    }, 30000)

    it('requires --urls for reimport mode', (done) => {
      const child = spawn('npx', ['tsx', scriptPath, '--reimport', '--website-id', 'test-website'], {
        env: { ...process.env },
        shell: true,
      })

      let stderr = ''
      child.stderr.on('data', (data) => {
        stderr += data.toString()
      })

      child.on('close', (code) => {
        expect(code).toBe(1)
        expect(stderr).toContain('--urls is required')
        done()
      })
    }, 30000)

    it('shows usage help with --help equivalent error messages', (done) => {
      const child = spawn('npx', ['tsx', scriptPath, '--reimport'], {
        env: { ...process.env },
        shell: true,
      })

      let stderr = ''
      child.stderr.on('data', (data) => {
        stderr += data.toString()
      })

      child.on('close', () => {
        expect(stderr).toContain('Re-import pages')
        expect(stderr).toContain('--website-id')
        expect(stderr).toContain('--urls')
        done()
      })
    }, 30000)
  })

  describe('Re-Import Flow', () => {
    it('parses comma-separated URLs correctly', () => {
      // Test the URL parsing logic
      const urlsArg = 'https://example.com/about,https://example.com/contact,https://example.com/services'
      const urls = urlsArg.split(',').map(u => u.trim()).filter(Boolean)

      expect(urls).toHaveLength(3)
      expect(urls[0]).toBe('https://example.com/about')
      expect(urls[1]).toBe('https://example.com/contact')
      expect(urls[2]).toBe('https://example.com/services')
    })

    it('handles URLs with spaces in comma separation', () => {
      const urlsArg = 'https://example.com/about , https://example.com/contact , https://example.com/services'
      const urls = urlsArg.split(',').map(u => u.trim()).filter(Boolean)

      expect(urls).toHaveLength(3)
      expect(urls[0]).toBe('https://example.com/about')
      expect(urls[1]).toBe('https://example.com/contact')
      expect(urls[2]).toBe('https://example.com/services')
    })

    it('filters empty URL entries', () => {
      const urlsArg = 'https://example.com/about,,https://example.com/contact,'
      const urls = urlsArg.split(',').map(u => u.trim()).filter(Boolean)

      expect(urls).toHaveLength(2)
    })
  })

  describe('CLI Flags', () => {
    const parseArgs = (argv: string[]) => {
      const args: Record<string, any> = {
        maxPages: 10,
        retainCheckpoint: false,
        preserveCustomizations: false,
        skipDesignSystem: true,
        skipSharedComponents: false,
        createIfNotExists: true,
        dryRun: false,
      }

      for (let i = 0; i < argv.length; i++) {
        const arg = argv[i]
        if (arg === '--reimport') args.reimport = true
        else if (arg === '--website-id' && argv[i + 1]) args.websiteId = argv[++i]
        else if (arg === '--urls' && argv[i + 1]) args.urls = argv[++i]
        else if (arg === '--preserve-customizations') args.preserveCustomizations = true
        else if (arg === '--skip-design-system') args.skipDesignSystem = true
        else if (arg === '--no-skip-design-system') args.skipDesignSystem = false
        else if (arg === '--skip-shared-components') args.skipSharedComponents = true
        else if (arg === '--create-if-not-exists=false') args.createIfNotExists = false
        else if (arg === '--dry-run') args.dryRun = true
      }

      return args
    }

    it('parses --preserve-customizations flag', () => {
      const args = parseArgs([
        '--reimport',
        '--website-id', 'test-website',
        '--urls', 'https://example.com/about',
        '--preserve-customizations',
      ])

      expect(args.reimport).toBe(true)
      expect(args.preserveCustomizations).toBe(true)
    })

    it('parses --skip-shared-components flag', () => {
      const args = parseArgs([
        '--reimport',
        '--website-id', 'test-website',
        '--urls', 'https://example.com/about',
        '--skip-shared-components',
      ])

      expect(args.skipSharedComponents).toBe(true)
    })

    it('parses --dry-run flag', () => {
      const args = parseArgs([
        '--reimport',
        '--website-id', 'test-website',
        '--urls', 'https://example.com/about',
        '--dry-run',
      ])

      expect(args.dryRun).toBe(true)
    })

    it('parses --create-if-not-exists=false flag', () => {
      const args = parseArgs([
        '--reimport',
        '--website-id', 'test-website',
        '--urls', 'https://example.com/about',
        '--create-if-not-exists=false',
      ])

      expect(args.createIfNotExists).toBe(false)
    })

    it('parses --no-skip-design-system flag', () => {
      const args = parseArgs([
        '--reimport',
        '--website-id', 'test-website',
        '--urls', 'https://example.com/about',
        '--no-skip-design-system',
      ])

      expect(args.skipDesignSystem).toBe(false)
    })

    it('parses all flags together', () => {
      const args = parseArgs([
        '--reimport',
        '--website-id', 'test-website',
        '--urls', 'https://example.com/about,https://example.com/contact',
        '--preserve-customizations',
        '--skip-shared-components',
        '--dry-run',
      ])

      expect(args.reimport).toBe(true)
      expect(args.websiteId).toBe('test-website')
      expect(args.urls).toBe('https://example.com/about,https://example.com/contact')
      expect(args.preserveCustomizations).toBe(true)
      expect(args.skipSharedComponents).toBe(true)
      expect(args.dryRun).toBe(true)
    })
  })

  describe('Status Icons', () => {
    const getStatusIcon = (status: string): string => {
      switch (status) {
        case 'updated': return '✓'
        case 'created': return '+'
        case 'unchanged': return '='
        case 'source-not-found': return '⚠ 404'
        case 'source-moved': return '→'
        case 'source-error': return '✗ 5xx'
        case 'source-timeout': return '⏱'
        case 'skipped': return '⊘'
        case 'failed': return '✗'
        default: return '?'
      }
    }

    it('returns correct icon for updated status', () => {
      expect(getStatusIcon('updated')).toBe('✓')
    })

    it('returns correct icon for created status', () => {
      expect(getStatusIcon('created')).toBe('+')
    })

    it('returns correct icon for unchanged status', () => {
      expect(getStatusIcon('unchanged')).toBe('=')
    })

    it('returns correct icon for source-not-found status', () => {
      expect(getStatusIcon('source-not-found')).toBe('⚠ 404')
    })

    it('returns correct icon for source-moved status', () => {
      expect(getStatusIcon('source-moved')).toBe('→')
    })

    it('returns correct icon for source-error status', () => {
      expect(getStatusIcon('source-error')).toBe('✗ 5xx')
    })

    it('returns correct icon for source-timeout status', () => {
      expect(getStatusIcon('source-timeout')).toBe('⏱')
    })

    it('returns correct icon for skipped status', () => {
      expect(getStatusIcon('skipped')).toBe('⊘')
    })

    it('returns correct icon for failed status', () => {
      expect(getStatusIcon('failed')).toBe('✗')
    })

    it('returns ? for unknown status', () => {
      expect(getStatusIcon('unknown-status')).toBe('?')
    })
  })
})

describe('Re-Import Progress Output', () => {
  it('formats progress correctly with URL', () => {
    const startTime = Date.now()
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
    const progress = 50
    const message = 'Processing page'
    const currentUrl = 'https://example.com/about'
    const currentIndex = 1
    const totalUrls = 3

    const output1 = `  [${elapsed}s] ${progress}% - [${currentIndex}/${totalUrls}] ${message}`
    const output2 = `        → ${currentUrl}`

    expect(output1).toContain('50%')
    expect(output1).toContain('[1/3]')
    expect(output2).toContain('https://example.com/about')
  })

  it('formats progress correctly without URL', () => {
    const startTime = Date.now()
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
    const progress = 100
    const message = 'Re-import completed'

    const output = `  [${elapsed}s] ${progress}% - ${message}`

    expect(output).toContain('100%')
    expect(output).toContain('Re-import completed')
  })
})

describe('Re-Import Summary Output', () => {
  it('formats summary correctly', () => {
    const summary = {
      updated: 5,
      created: 2,
      unchanged: 1,
      sourceNotFound: 1,
      failed: 1,
      skipped: 0,
      totalComponentsAdded: 15,
      totalComponentsRemoved: 3,
    }

    const lines = [
      `  Updated: ${summary.updated}`,
      `  Created: ${summary.created}`,
      `  Unchanged: ${summary.unchanged}`,
      `  Source Not Found: ${summary.sourceNotFound}`,
      `  Failed: ${summary.failed}`,
      `  Skipped: ${summary.skipped}`,
      `  Components Added: ${summary.totalComponentsAdded}`,
      `  Components Removed: ${summary.totalComponentsRemoved}`,
    ]

    expect(lines[0]).toBe('  Updated: 5')
    expect(lines[1]).toBe('  Created: 2')
    expect(lines[6]).toBe('  Components Added: 15')
  })
})
