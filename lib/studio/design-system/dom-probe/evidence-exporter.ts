import path from 'node:path'
import { createHash } from 'node:crypto'
import { promises as fsp } from 'node:fs'

import type { MediaStorageProvider } from '@/lib/studio/media/storage/media-storage-provider'
import { getMediaStorageProvider } from '@/lib/studio/media/storage/media-storage-factory'
import type { CaptureDesignSystemResult } from './service'
import { renderManifestMarkdown } from './artifacts'
import type { DomProbeRemoteArtifact, DomProbeRemoteArtifacts } from './types'

function slugSegment(value: string | undefined, fallback: string): string {
  if (!value) return fallback
  const trimmed = value.trim()
  if (!trimmed) return fallback
  return trimmed
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, '-')
    .replace(/^-+|-+$/g, '') || fallback
}

function joinKey(...segments: Array<string | undefined>): string {
  return segments
    .filter(segment => Boolean(segment && segment.length > 0))
    .map(segment => segment!.replace(/^\/+|\/+$/g, ''))
    .join('/')
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fsp.access(filePath)
    return true
  } catch {
    return false
  }
}

async function readFileBuffer(filePath: string): Promise<Buffer | null> {
  if (!(await fileExists(filePath))) {
    return null
  }
  return fsp.readFile(filePath)
}

function resolveArtifactPath(artifactPath: string | undefined | null): string | null {
  if (!artifactPath) return null
  return path.isAbsolute(artifactPath) ? artifactPath : path.resolve(process.cwd(), artifactPath)
}

export interface EvidenceLink {
  key: string
  url?: string | null
  checksum?: string
  size?: number
  contentType: string
  etag?: string
}

export interface DomProbeEvidenceLinks {
  captureJson?: EvidenceLink
  manifestJson?: EvidenceLink
  manifestMarkdown?: EvidenceLink
  runLog?: EvidenceLink
  domSnapshot?: EvidenceLink
  diffReport?: EvidenceLink
  screenshots: EvidenceLink[]
  baseKey: string
}

export interface DomProbeEvidenceExportParams {
  captureResult: CaptureDesignSystemResult
  websiteId: string
  jobId?: string
  prefix?: string
}

export interface DomProbeEvidenceExporterOptions {
  storage?: MediaStorageProvider
  prefix?: string
}

interface UploadRequest {
  key: string
  filePath: string
  contentType: string
  metadata?: Record<string, string>
}

export class DomProbeEvidenceExporter {
  private readonly storage: MediaStorageProvider
  private readonly prefix: string

  constructor(options: DomProbeEvidenceExporterOptions = {}) {
    if (options.storage) {
      this.storage = options.storage
    } else {
      const { provider } = getMediaStorageProvider()
      this.storage = provider
    }
    this.prefix = options.prefix ?? 'design-system'
  }

  async exportCapture(params: DomProbeEvidenceExportParams): Promise<DomProbeEvidenceLinks> {
    const capture = params.captureResult
    const runId = capture.metadata.runId || 'run'
    const websiteSegment = slugSegment(params.websiteId, 'unknown-website')
    const jobSegment = slugSegment(params.jobId, 'adhoc')
    const prefix = params.prefix ?? this.prefix
    const baseKey = joinKey(prefix, websiteSegment, jobSegment, runId)

    const links: DomProbeEvidenceLinks = {
      screenshots: [],
      baseKey
    }

    const upload = async (request: UploadRequest): Promise<EvidenceLink | undefined> => {
      const buffer = await readFileBuffer(request.filePath)
      if (!buffer) {
        return undefined
      }
      const checksum = createHash('sha256').update(buffer).digest('hex')
      const size = buffer.length
      const metadata = {
        ...(request.metadata ?? {}),
        checksum
      }
      const putResult = await this.storage.put({
        key: request.key,
        contentType: request.contentType,
        body: buffer,
        metadata
      })
      const url = await this.storage.getPublicUrl({ key: request.key })
      return {
        key: request.key,
        url,
        checksum,
        size,
        contentType: request.contentType,
        etag: putResult.etag
      }
    }

    const captureJsonPath = resolveArtifactPath(capture.metadata.artifacts.captureJson)
    if (captureJsonPath) {
      const key = joinKey(baseKey, 'capture.json')
      const link = await upload({
        key,
        filePath: captureJsonPath,
        contentType: 'application/json',
        metadata: {
          artifact: 'capture.json',
          websiteId: params.websiteId,
          jobId: params.jobId ?? ''
        }
      })
      if (link) {
        links.captureJson = link
      }
    }

    const manifestJsonPath = resolveArtifactPath(capture.manifest.artifacts.manifest)
    if (manifestJsonPath) {
      const key = joinKey(baseKey, 'manifest.json')
      const link = await upload({
        key,
        filePath: manifestJsonPath,
        contentType: 'application/json',
        metadata: {
          artifact: 'manifest.json',
          websiteId: params.websiteId,
          jobId: params.jobId ?? ''
        }
      })
      if (link) {
        links.manifestJson = link
      }
    }

    const manifestMarkdownPath = path.join(capture.runDir, 'manifest.md')
    if (await fileExists(manifestMarkdownPath)) {
      const key = joinKey(baseKey, 'manifest.md')
      const link = await upload({
        key,
        filePath: manifestMarkdownPath,
        contentType: 'text/markdown',
        metadata: {
          artifact: 'manifest.md',
          websiteId: params.websiteId,
          jobId: params.jobId ?? ''
        }
      })
      if (link) {
        links.manifestMarkdown = link
      }
    }

    const runLogPath = resolveArtifactPath(capture.metadata.artifacts.runLog)
    if (runLogPath) {
      const key = joinKey(baseKey, 'run.log')
      const link = await upload({
        key,
        filePath: runLogPath,
        contentType: 'text/plain',
        metadata: {
          artifact: 'run.log',
          websiteId: params.websiteId,
          jobId: params.jobId ?? ''
        }
      })
      if (link) {
        links.runLog = link
      }
    }

    const domSnapshotPath = resolveArtifactPath(capture.metadata.artifacts.domSnapshot)
    if (domSnapshotPath) {
      const key = joinKey(baseKey, 'dom.html')
      const link = await upload({
        key,
        filePath: domSnapshotPath,
        contentType: 'text/html',
        metadata: {
          artifact: 'dom.html',
          websiteId: params.websiteId,
          jobId: params.jobId ?? ''
        }
      })
      if (link) {
        links.domSnapshot = link
      }
    }

    const diffPath = capture.manifest.artifacts.diffs?.[0]
    const resolvedDiffPath = resolveArtifactPath(diffPath)
    if (resolvedDiffPath) {
      const key = joinKey(baseKey, 'diffs', path.basename(resolvedDiffPath))
      const link = await upload({
        key,
        filePath: resolvedDiffPath,
        contentType: 'application/json',
        metadata: {
          artifact: 'diff.json',
          websiteId: params.websiteId,
          jobId: params.jobId ?? ''
        }
      })
      if (link) {
        links.diffReport = link
      }
    }

    const screenshotPaths = capture.manifest.artifacts.screenshots ?? []
    for (const screenshot of screenshotPaths) {
      const resolved = resolveArtifactPath(screenshot)
      if (!resolved) continue
      const key = joinKey(baseKey, 'screenshots', path.basename(resolved))
      const link = await upload({
        key,
        filePath: resolved,
        contentType: 'image/png',
        metadata: {
          artifact: 'screenshot',
          websiteId: params.websiteId,
          jobId: params.jobId ?? ''
        }
      })
      if (link) {
        links.screenshots.push(link)
      }
    }

    const remoteArtifacts = this.buildRemoteArtifacts(links)
    capture.manifest.remoteArtifacts = remoteArtifacts

    const manifestPath = resolveArtifactPath(capture.metadata.artifacts.manifest)
    if (manifestPath) {
      await fsp.writeFile(manifestPath, JSON.stringify(capture.manifest, null, 2))
      const markdownPath = path.join(capture.runDir, 'manifest.md')
      const markdown = renderManifestMarkdown(capture.manifest, capture.metadata.runnerVersion)
      await fsp.writeFile(markdownPath, markdown, 'utf-8')
    }

    return links
  }

  private buildRemoteArtifacts(links: DomProbeEvidenceLinks): DomProbeRemoteArtifacts {
    const toRemote = (link?: EvidenceLink): DomProbeRemoteArtifact | undefined => {
      if (!link) return undefined
      return {
        key: link.key,
        url: link.url ?? null,
        checksum: link.checksum
      }
    }

    const diffReports = links.diffReport ? [links.diffReport] : []
    const screenshotArtifacts = (links.screenshots ?? [])
      .map(toRemote)
      .filter((entry): entry is DomProbeRemoteArtifact => Boolean(entry))

    const remote: DomProbeRemoteArtifacts = {
      captureJson: toRemote(links.captureJson),
      manifestJson: toRemote(links.manifestJson),
      manifestMarkdown: toRemote(links.manifestMarkdown),
      runLog: toRemote(links.runLog),
      domSnapshot: toRemote(links.domSnapshot),
      diffReports: diffReports
        .map(toRemote)
        .filter((entry): entry is DomProbeRemoteArtifact => Boolean(entry)),
      screenshots: screenshotArtifacts.length > 0 ? screenshotArtifacts : undefined
    }

    return remote
  }
}
