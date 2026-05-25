/**
 * Import Checkpoint Service Tests
 *
 * Tests for the disk-based checkpoint system.
 */

import * as fs from 'fs'
import * as path from 'path'
import { promisify } from 'util'
import { ImportCheckpointService, createCheckpointService } from '../checkpoint-service'
import type { ImportDetectionResult } from '../../web-detection'

const mkdir = promisify(fs.mkdir)
const rmdir = promisify(fs.rmdir)
const readdir = promisify(fs.readdir)
const unlink = promisify(fs.unlink)
const stat = promisify(fs.stat)

// Test directory
const TEST_BASE_DIR = '.test-checkpoint-cache'

// Helper to clean up test directory
async function cleanupTestDir(): Promise<void> {
  try {
    const rmrf = async (dir: string): Promise<void> => {
      try {
        const entries = await readdir(dir, { withFileTypes: true })
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name)
          if (entry.isDirectory()) {
            await rmrf(fullPath)
          } else {
            await unlink(fullPath)
          }
        }
        await rmdir(dir)
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
          throw error
        }
      }
    }
    await rmrf(TEST_BASE_DIR)
  } catch {
    // Ignore cleanup errors
  }
}

// Mock detection result
function createMockDetectionResult(url: string): ImportDetectionResult {
  return {
    pageUrl: url,
    components: [
      {
        type: 'hero',
        component: 'hero-banner',
        content: { title: 'Test Hero', subtitle: 'Test subtitle' },
        confidence: 0.95,
        location: 'header'
      },
      {
        type: 'text-block',
        component: 'paragraph',
        content: { text: 'Some test content' },
        confidence: 0.9,
        location: 'main'
      }
    ],
    pageMetadata: {
      title: 'Test Page',
      description: 'A test page',
      pageType: 'landing'
    }
  }
}

describe('ImportCheckpointService', () => {
  let service: ImportCheckpointService

  beforeAll(async () => {
    await cleanupTestDir()
  })

  afterAll(async () => {
    await cleanupTestDir()
  })

  beforeEach(async () => {
    await cleanupTestDir()
    service = createCheckpointService(TEST_BASE_DIR)
  })

  describe('initializeSession', () => {
    it('should create a new checkpoint session', async () => {
      const session = await service.initializeSession(
        'job-123',
        'website-456',
        'https://example.com',
        { maxPages: 10 }
      )

      expect(session.jobId).toBe('job-123')
      expect(session.websiteId).toBe('website-456')
      expect(session.manifest.sourceUrl).toBe('https://example.com')
      expect(session.manifest.status).toBe('in_progress')
      expect(session.manifest.config.maxPages).toBe(10)

      // Verify directory structure
      const pagesDir = path.join(session.cacheDir, 'pages')
      const errorsDir = path.join(session.cacheDir, 'errors')
      const sectionsDir = path.join(session.cacheDir, 'sections')
      const sectionErrorsDir = path.join(session.cacheDir, 'section-errors')
      const pagePlansDir = path.join(session.cacheDir, 'page-plans')
      const assembledDir = path.join(session.cacheDir, 'assembled')
      const aggregatedDir = path.join(session.cacheDir, 'aggregated')

      expect(await stat(pagesDir).then(() => true).catch(() => false)).toBe(true)
      expect(await stat(errorsDir).then(() => true).catch(() => false)).toBe(true)
      expect(await stat(sectionsDir).then(() => true).catch(() => false)).toBe(true)
      expect(await stat(sectionErrorsDir).then(() => true).catch(() => false)).toBe(true)
      expect(await stat(pagePlansDir).then(() => true).catch(() => false)).toBe(true)
      expect(await stat(assembledDir).then(() => true).catch(() => false)).toBe(true)
      expect(await stat(aggregatedDir).then(() => true).catch(() => false)).toBe(true)
    })

    it('should throw if session already exists', async () => {
      await service.initializeSession('job-123', 'website-456', 'https://example.com')

      await expect(
        service.initializeSession('job-123', 'website-456', 'https://example.com')
      ).rejects.toThrow('already exists')
    })
  })

  describe('resumeSession', () => {
    it('should resume an existing session', async () => {
      // Create a session
      const original = await service.initializeSession(
        'job-resume-test',
        'website-456',
        'https://example.com'
      )

      // Update status to failed (simulating interrupted import)
      await service.updateStatus(original, 'failed')

      // Resume
      const resumed = await service.resumeSession('job-resume-test')

      expect(resumed).not.toBeNull()
      expect(resumed!.jobId).toBe('job-resume-test')
      expect(resumed!.manifest.status).toBe('in_progress')
    })

    it('should return null for non-existent session', async () => {
      const result = await service.resumeSession('non-existent-job')
      expect(result).toBeNull()
    })
  })

  describe('saveSitemap', () => {
    it('should save sitemap with URLs and skipped entries', async () => {
      const session = await service.initializeSession(
        'job-sitemap',
        'website-456',
        'https://example.com'
      )

      await service.saveSitemap(
        session,
        ['https://example.com', 'https://example.com/about', 'https://example.com/contact'],
        [{ url: 'https://example.com/admin', reason: 'login required' }]
      )

      const sitemap = await service.loadSitemap(session)

      expect(sitemap).not.toBeNull()
      expect(sitemap!.urls).toHaveLength(3)
      expect(sitemap!.urls[0].url).toBe('https://example.com')
      expect(sitemap!.urls[0].status).toBe('pending')
      expect(sitemap!.skipped).toHaveLength(1)
      expect(sitemap!.skipped[0].url).toBe('https://example.com/admin')

      // Manifest should be updated
      const manifest = await service.loadManifest(session)
      expect(manifest.progress.totalUrls).toBe(3)
      expect(manifest.progress.skippedUrls).toBe(1)
    })
  })

  describe('section checkpoints', () => {
    it('should save, load, and stream section results by original section key', async () => {
      const session = await service.initializeSession(
        'job-section-result',
        'website-456',
        'https://example.com'
      )
      const url = 'https://example.com/about'
      const components = [
        {
          type: 'text-block',
          component: 'text-block',
          content: { text: 'About us' },
          confidence: 0.9,
          location: 'main'
        }
      ] as any

      await service.saveSectionResult(
        session,
        url,
        'main:0-99',
        1,
        components,
        123,
        { title: 'About Example', description: 'About page' },
        {
          model: 'test-model',
          rawResponseLength: 42
        }
      )

      const loaded = await service.loadSectionResult(session, url, 'main:0-99')
      expect(loaded?.sectionKey).toBe('main:0-99')
      expect(loaded?.components).toHaveLength(1)
      expect(loaded?.pageMetadata?.title).toBe('About Example')
      expect(loaded?.llmDebug?.rawResponseLength).toBe(42)

      const completed = await service.getCompletedSections(session, url)
      expect(completed.has('main:0-99')).toBe(true)

      const streamed = []
      for await (const result of service.streamSectionResults(session, url)) {
        streamed.push(result.sectionKey)
      }
      expect(streamed).toEqual(['main:0-99'])
    })

    it('should save section errors with output limit stage', async () => {
      const session = await service.initializeSession(
        'job-section-error',
        'website-456',
        'https://example.com'
      )
      const url = 'https://example.com/about'

      await service.saveSectionError(session, url, 'main:0-99', 1, new Error('too long'), 1, 'output_limit')

      const loaded = await service.loadSectionError(session, url, 'main:0-99')
      expect(loaded?.error.stage).toBe('output_limit')
      expect(loaded?.error.message).toBe('too long')
    })

    it('should clear stale section errors when a section result succeeds', async () => {
      const session = await service.initializeSession(
        'job-section-error-clear',
        'website-456',
        'https://example.com'
      )
      const url = 'https://example.com/about'

      await service.saveSectionError(session, url, 'main:0-99', 1, new Error('first failure'), 1, 'parsing')
      expect(await service.loadSectionError(session, url, 'main:0-99')).not.toBeNull()

      await service.saveSectionResult(session, url, 'main:0-99', 1, [], 50)

      expect(await service.loadSectionError(session, url, 'main:0-99')).toBeNull()
    })
  })

  describe('savePageResult', () => {
    it('should save a successful page result', async () => {
      const session = await service.initializeSession(
        'job-page-result',
        'website-456',
        'https://example.com'
      )

      const url = 'https://example.com/about'
      const detection = createMockDetectionResult(url)

      await service.savePageResult(session, url, detection)

      const result = await service.loadPageResult(session, url)

      expect(result).not.toBeNull()
      expect(result!.url).toBe(url)
      expect(result!.detection.components).toHaveLength(2)
      expect(result!.detection.pageMetadata?.title).toBe('Test Page')

      // In-memory counters are updated; persisted progress is reconstructed from page files on resume.
      expect(session.manifest.progress.completedUrls).toBe(1)
    })

    it('should include LLM debug info when provided', async () => {
      const session = await service.initializeSession(
        'job-llm-debug',
        'website-456',
        'https://example.com'
      )

      const url = 'https://example.com/about'
      const detection = createMockDetectionResult(url)

      await service.savePageResult(session, url, detection, {
        requestCount: 3,
        toolCallCount: 5,
        rawResponseLength: 10000
      })

      const result = await service.loadPageResult(session, url)

      expect(result!.llmDebug).toBeDefined()
      expect(result!.llmDebug!.requestCount).toBe(3)
      expect(result!.llmDebug!.toolCallCount).toBe(5)
    })
  })

  describe('savePageError', () => {
    it('should save a page error', async () => {
      const session = await service.initializeSession(
        'job-page-error',
        'website-456',
        'https://example.com'
      )

      const url = 'https://example.com/broken'
      const error = new Error('LLM request failed')

      await service.savePageError(session, url, error, 1, 'llm_call')

      const result = await service.loadPageError(session, url)

      expect(result).not.toBeNull()
      expect(result!.url).toBe(url)
      expect(result!.error.message).toBe('LLM request failed')
      expect(result!.error.stage).toBe('llm_call')
      expect(result!.attemptCount).toBe(1)

      // In-memory counters are updated; persisted progress is reconstructed from error files on resume.
      expect(session.manifest.progress.failedUrls).toBe(1)
    })

    it('saves failed LLM debug metadata without raw output by default', async () => {
      const session = await service.initializeSession(
        'job-page-error-debug',
        'website-456',
        'https://example.com'
      )

      const url = 'https://example.com/broken-debug'
      const error = new Error('Detection response components[0].content is invalid')

      await service.savePageError(session, url, error, 1, 'parsing', {
        model: 'openai/gpt-4.1-nano',
        stage: 'validation',
        finishReason: 'stop',
        rawResponseLength: 42,
        rawResponse: '{"components":[]}',
        validationPath: 'components.0.content',
        requestCount: 2,
        toolCallCount: 1,
        usage: { total_tokens: 123 }
      })

      const result = await service.loadPageError(session, url)

      expect(result?.llmDebug).toEqual(expect.objectContaining({
        model: 'openai/gpt-4.1-nano',
        stage: 'validation',
        finishReason: 'stop',
        rawResponseLength: 42,
        validationPath: 'components.0.content',
        requestCount: 2,
        toolCallCount: 1
      }))
      expect(result?.llmDebug?.rawResponse).toBeUndefined()
      expect(result?.error.retryable).toBe(false)
    })
  })

  describe('getPendingUrls', () => {
    it('should return pending and retryable failed URLs', async () => {
      const session = await service.initializeSession(
        'job-pending',
        'website-456',
        'https://example.com'
      )

      // Save sitemap
      await service.saveSitemap(session, [
        'https://example.com',
        'https://example.com/about',
        'https://example.com/contact'
      ], [])

      // Complete one page
      await service.savePageResult(
        session,
        'https://example.com',
        createMockDetectionResult('https://example.com')
      )

      // Fail one page with retryable error
      await service.savePageError(
        session,
        'https://example.com/about',
        new Error('Timeout'),
        1
      )

      const pending = await service.getPendingUrls(session)

      // Should include: /contact (pending) and /about (failed but retryable)
      expect(pending).toContain('https://example.com/contact')
      expect(pending).toContain('https://example.com/about')
      expect(pending).not.toContain('https://example.com')
    })
  })

  describe('getCompletedUrls', () => {
    it('should return set of completed URLs', async () => {
      const session = await service.initializeSession(
        'job-completed',
        'website-456',
        'https://example.com'
      )

      // Complete two pages
      await service.savePageResult(
        session,
        'https://example.com',
        createMockDetectionResult('https://example.com')
      )
      await service.savePageResult(
        session,
        'https://example.com/about',
        createMockDetectionResult('https://example.com/about')
      )

      const completed = await service.getCompletedUrls(session)

      expect(completed.size).toBe(2)
      expect(completed.has('https://example.com')).toBe(true)
      expect(completed.has('https://example.com/about')).toBe(true)
    })
  })

  describe('streamCompletedResults', () => {
    it('should stream all completed results', async () => {
      const session = await service.initializeSession(
        'job-stream',
        'website-456',
        'https://example.com'
      )

      // Complete three pages
      await service.savePageResult(
        session,
        'https://example.com',
        createMockDetectionResult('https://example.com')
      )
      await service.savePageResult(
        session,
        'https://example.com/about',
        createMockDetectionResult('https://example.com/about')
      )
      await service.savePageResult(
        session,
        'https://example.com/contact',
        createMockDetectionResult('https://example.com/contact')
      )

      const results: string[] = []
      for await (const result of service.streamCompletedResults(session)) {
        results.push(result.url)
      }

      expect(results).toHaveLength(3)
      expect(results).toContain('https://example.com')
      expect(results).toContain('https://example.com/about')
      expect(results).toContain('https://example.com/contact')
    })
  })

  describe('updateStatus and finalize', () => {
    it('should update status and record error', async () => {
      const session = await service.initializeSession(
        'job-status',
        'website-456',
        'https://example.com'
      )

      await service.updateStatus(session, 'failed', new Error('Import crashed'))

      const manifest = await service.loadManifest(session)

      expect(manifest.status).toBe('failed')
      expect(manifest.error?.message).toBe('Import crashed')
      expect(manifest.timing.completedAt).toBeDefined()
    })

    it('should cleanup on successful finalize when retainOnSuccess is false', async () => {
      const session = await service.initializeSession(
        'job-finalize',
        'website-456',
        'https://example.com'
      )

      await service.savePageResult(
        session,
        'https://example.com',
        createMockDetectionResult('https://example.com')
      )

      // Finalize - should cleanup since default retainOnSuccess is false
      await service.finalize(session, true)

      // Session directory should be deleted
      expect(await stat(session.cacheDir).then(() => true).catch(() => false)).toBe(false)
    })
  })

  describe('saveAggregated', () => {
    it('should save aggregated data', async () => {
      const session = await service.initializeSession(
        'job-aggregated',
        'website-456',
        'https://example.com'
      )

      await service.saveAggregated(session, 'navigation', {
        pages: [{ url: '/', title: 'Home' }],
        hierarchy: { '/': [] }
      })

      // Verify file exists
      const aggregatedPath = path.join(session.cacheDir, 'aggregated', 'navigation.json')
      expect(await stat(aggregatedPath).then(() => true).catch(() => false)).toBe(true)
    })
  })

  describe('listSessions', () => {
    it('should list all sessions for a website', async () => {
      // Create multiple sessions for the same website
      await service.initializeSession('job-list-1', 'website-list', 'https://example.com')
      await service.initializeSession('job-list-2', 'website-list', 'https://example.com/v2')
      await service.initializeSession('job-other', 'website-other', 'https://other.com')

      const sessions = await service.listSessions('website-list')

      expect(sessions).toHaveLength(2)
      expect(sessions.map(s => s.jobId)).toContain('job-list-1')
      expect(sessions.map(s => s.jobId)).toContain('job-list-2')
    })
  })
})
