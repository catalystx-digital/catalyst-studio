import path from 'node:path'
import os from 'node:os'
import { promises as fsp } from 'node:fs'

import type {
  MediaDeleteObjectInput,
  MediaGetObjectInput,
  MediaGetObjectOutput,
  MediaGetPublicUrlInput,
  MediaGetSignedUrlInput,
  MediaPutObjectInput,
  MediaPutObjectOutput,
  MediaStorageProvider
} from '@/lib/studio/media/storage/media-storage-provider'
import type { DomDesignSystemCapture, DomProbeManifest } from '../types'
import type { DomDesignSystemCaptureMetadata } from '../types'
import { DomProbeEvidenceExporter } from '../evidence-exporter'

class FakeStorageProvider implements MediaStorageProvider {
  uploads: MediaPutObjectInput[] = []

  async put(input: MediaPutObjectInput): Promise<MediaPutObjectOutput> {
    this.uploads.push(input)
    return { etag: 'fake-etag' }
  }

  async get(_: MediaGetObjectInput): Promise<MediaGetObjectOutput> {
    throw new Error('Not implemented')
  }

  async delete(_: MediaDeleteObjectInput): Promise<void> {
    throw new Error('Not implemented')
  }

  async getPublicUrl(input: MediaGetPublicUrlInput): Promise<string> {
    return `https://example.com/${input.key}`
  }

  async getSignedUrl(_: MediaGetSignedUrlInput): Promise<string> {
    throw new Error('Not implemented')
  }
}

function createCaptureMetadata(runDir: string, runId: string): DomDesignSystemCaptureMetadata {
  return {
    baseline: 'test',
    url: 'https://example.com',
    timestamp: new Date().toISOString(),
    runId,
    runnerVersion: 'test',
    viewport: { width: 1280, height: 720, deviceScaleFactor: 1 },
    browser: { name: 'chromium', version: '1.0.0', userAgent: 'test-agent' },
    timings: [],
    captureDurationMs: 1234,
    cached: false,
    artifacts: {
      runLog: path.join(runDir, 'run.log'),
      captureJson: path.join(runDir, 'capture.json'),
      domSnapshot: path.join(runDir, 'dom.html'),
      screenshots: [path.join(runDir, 'screenshots', 'full-page.png')],
      diffs: [],
      manifest: path.join(runDir, 'manifest.json')
    },
    configuration: {
      refreshRequested: true,
      evaluationRequested: true,
      flags: {},
      playwright: {}
    }
  }
}

describe('DomProbeEvidenceExporter', () => {
  let tmpDir: string

  beforeEach(async () => {
    tmpDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'dom-probe-evidence-'))
    await fsp.mkdir(path.join(tmpDir, 'screenshots'), { recursive: true })
    await fsp.mkdir(path.join(tmpDir, 'diffs'), { recursive: true })
    await Promise.all([
      fsp.writeFile(path.join(tmpDir, 'capture.json'), JSON.stringify({ ok: true }), 'utf-8'),
      fsp.writeFile(path.join(tmpDir, 'manifest.json'), JSON.stringify({ run: true }), 'utf-8'),
      fsp.writeFile(path.join(tmpDir, 'manifest.md'), '# Manifest', 'utf-8'),
      fsp.writeFile(path.join(tmpDir, 'run.log'), 'log output', 'utf-8'),
      fsp.writeFile(path.join(tmpDir, 'dom.html'), '<html></html>', 'utf-8'),
      fsp.writeFile(path.join(tmpDir, 'diffs', 'diff.json'), JSON.stringify({ diff: true }), 'utf-8'),
      fsp.writeFile(path.join(tmpDir, 'screenshots', 'full-page.png'), Buffer.from([0, 1, 2, 3]))
    ])
  })

  afterEach(async () => {
    await fsp.rm(tmpDir, { recursive: true, force: true })
  })

  it('uploads capture artifacts with deterministic keys', async () => {
    const storage = new FakeStorageProvider()
    const exporter = new DomProbeEvidenceExporter({ storage, prefix: 'design-system' })
    const runId = '2025-01-01T00-00-00-000Z'

    const metadata = createCaptureMetadata(tmpDir, runId)
    metadata.artifacts.diffs = [path.join(tmpDir, 'diffs', 'diff.json')]

    const capture: DomDesignSystemCapture = {
      metadata,
      typography: [],
      palette: {
        colors: [],
        primary: null,
        secondary: null,
        neutrals: []
      },
      spacing: {
        baseUnitPx: 8,
        scale: [],
        gapTokens: []
      },
      components: [],
      diagnostics: {
        errors: [],
        warnings: [],
        infos: [],
        missingFonts: [],
        consoleErrors: []
      },
      rawDomSnapshotPath: metadata.artifacts.domSnapshot
    }

    const manifest: DomProbeManifest = {
      baseline: 'test',
      runId,
      timestamp: metadata.timestamp,
      url: metadata.url,
      artifacts: {
        runLog: metadata.artifacts.runLog,
        captureJson: metadata.artifacts.captureJson,
        domSnapshot: metadata.artifacts.domSnapshot,
        screenshots: metadata.artifacts.screenshots,
        diffs: [path.join(tmpDir, 'diffs', 'diff.json')],
        manifest: metadata.artifacts.manifest
      },
      status: 'success',
      errors: [],
      checkpoints: {}
    }

    const result = await exporter.exportCapture({
      captureResult: {
        capture,
        manifest,
        metadata,
        runDir: tmpDir
      },
      websiteId: 'site-123',
      jobId: 'job-456'
    })

    expect(result.baseKey).toBe('design-system/site-123/job-456/2025-01-01T00-00-00-000Z')
    expect(result.captureJson?.key).toBe('design-system/site-123/job-456/2025-01-01T00-00-00-000Z/capture.json')
    expect(result.manifestJson?.key).toBe('design-system/site-123/job-456/2025-01-01T00-00-00-000Z/manifest.json')
    expect(result.manifestMarkdown?.key).toBe('design-system/site-123/job-456/2025-01-01T00-00-00-000Z/manifest.md')
    expect(result.runLog?.key).toBe('design-system/site-123/job-456/2025-01-01T00-00-00-000Z/run.log')
    expect(result.domSnapshot?.key).toBe('design-system/site-123/job-456/2025-01-01T00-00-00-000Z/dom.html')
    expect(result.diffReport?.key).toBe(
      'design-system/site-123/job-456/2025-01-01T00-00-00-000Z/diffs/diff.json'
    )
    expect(result.screenshots[0]?.key).toBe(
      'design-system/site-123/job-456/2025-01-01T00-00-00-000Z/screenshots/full-page.png'
    )
    expect(result.captureJson?.url).toBe('https://example.com/design-system/site-123/job-456/2025-01-01T00-00-00-000Z/capture.json')
    expect(storage.uploads.length).toBeGreaterThanOrEqual(6)

    expect(manifest.remoteArtifacts?.captureJson?.key).toBe(result.captureJson?.key)
    expect(manifest.remoteArtifacts?.screenshots?.[0]?.key).toBe(result.screenshots[0]?.key)

    const manifestFile = await fsp.readFile(path.join(tmpDir, 'manifest.json'), 'utf-8')
    const persistedManifest = JSON.parse(manifestFile)
    expect(persistedManifest.remoteArtifacts.captureJson.key).toBe(result.captureJson?.key)
    expect(persistedManifest.remoteArtifacts.screenshots[0].key).toBe(result.screenshots[0]?.key)
  })
})
