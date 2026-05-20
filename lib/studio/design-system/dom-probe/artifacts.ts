import fs from 'node:fs'
import fsp from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { DOM_PROBE_NAMESPACE, DOM_PROBE_TMP_ROOT } from './constants'
import type { CachedRunInfo, DomProbeManifest, DomProbeRunConfig } from './types'

function slugify(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-+/g, '-')
}

function getTmpRoot(): string {
  // Use system temp dir in production (Vercel serverless has read-only /var/task)
  // Use project dir in development for easier debugging
  const isVercel = process.env.VERCEL === '1'
  const baseDir = isVercel ? os.tmpdir() : process.cwd()
  return path.join(baseDir, DOM_PROBE_TMP_ROOT)
}

export function resolveBaselineDir(baseline: string): string {
  return path.join(getTmpRoot(), slugify(baseline))
}

export function resolveRunDir(baseline: string, runId: string): string {
  return path.join(resolveBaselineDir(baseline), runId)
}

export async function ensureDir(dir: string): Promise<void> {
  await fsp.mkdir(dir, { recursive: true })
}

export function formatTimestamp(date = new Date()): string {
  const iso = date.toISOString()
  return iso.replace(/[:.]/g, '-')
}

export async function recordLatestRun(info: CachedRunInfo): Promise<void> {
  const baselineDir = resolveBaselineDir(info.baseline)
  await ensureDir(baselineDir)
  const latestPath = path.join(baselineDir, 'latest.json')
  await fsp.writeFile(latestPath, JSON.stringify(info, null, 2))
}

export async function loadLatestRun(baseline: string): Promise<CachedRunInfo | null> {
  try {
    const raw = await fsp.readFile(path.join(resolveBaselineDir(baseline), 'latest.json'), 'utf-8')
    const parsed = JSON.parse(raw) as CachedRunInfo
    if (!parsed?.runId || !parsed.capturePath) return null
    return parsed
  } catch (error) {
    if ((error as NodeJS.ErrnoException)?.code === 'ENOENT') {
      return null
    }
    throw error
  }
}

export async function listBaselineRuns(baseline: string): Promise<string[]> {
  try {
    const entries = await fsp.readdir(resolveBaselineDir(baseline), { withFileTypes: true })
    return entries
      .filter(entry => entry.isDirectory())
      .map(entry => entry.name)
      .filter(entry => /^\d{4}-\d{2}-\d{2}T/.test(entry))
      .sort()
  } catch (error) {
    if ((error as NodeJS.ErrnoException)?.code === 'ENOENT') {
      return []
    }
    throw error
  }
}

export class DomProbeArtifacts {
  readonly baselineSlug: string
  readonly runId: string
  readonly runDir: string
  readonly logPath: string
  readonly capturePath: string
  readonly manifestJsonPath: string
  readonly manifestMarkdownPath: string
  readonly domSnapshotPath: string
  readonly screenshotsDir: string
  readonly diffsDir: string
  readonly namespace = DOM_PROBE_NAMESPACE

  constructor(readonly config: DomProbeRunConfig, timestamp = new Date()) {
    this.baselineSlug = slugify(config.baseline)
    this.runId = formatTimestamp(timestamp)
    this.runDir = resolveRunDir(config.baseline, this.runId)
    this.logPath = path.join(this.runDir, 'run.log')
    this.capturePath = path.join(this.runDir, 'capture.json')
    this.manifestJsonPath = path.join(this.runDir, 'manifest.json')
    this.manifestMarkdownPath = path.join(this.runDir, 'manifest.md')
    this.domSnapshotPath = path.join(this.runDir, 'dom.html')
    this.screenshotsDir = path.join(this.runDir, 'screenshots')
    this.diffsDir = path.join(this.runDir, 'diffs')
  }

  async initialize(): Promise<void> {
    await ensureDir(this.screenshotsDir)
    await ensureDir(this.diffsDir)
    const runDirExists = fs.existsSync(this.runDir)
    if (!runDirExists) {
      await ensureDir(this.runDir)
    }
  }

  getArtifactsRecord(): DomProbeManifest['artifacts'] {
    return {
      runLog: this.logPath,
      captureJson: this.capturePath,
      domSnapshot: this.domSnapshotPath,
      screenshots: [],
      diffs: [],
      manifest: this.manifestJsonPath
    }
  }

  async appendLog(message: string): Promise<void> {
    await fsp.appendFile(this.logPath, `${message}\n`)
  }

  async writeText(relativePath: string, content: string): Promise<string> {
    const targetPath = path.join(this.runDir, relativePath)
    await ensureDir(path.dirname(targetPath))
    await fsp.writeFile(targetPath, content, 'utf-8')
    return targetPath
  }

  async writeJson<T>(relativePath: string, payload: T): Promise<string> {
    return this.writeText(relativePath, JSON.stringify(payload, null, 2))
  }

  async writeDomSnapshot(html: string): Promise<void> {
    await fsp.writeFile(this.domSnapshotPath, html, 'utf-8')
  }

  async finalizeManifest(manifest: DomProbeManifest): Promise<void> {
    manifest.artifacts = {
      ...manifest.artifacts,
      runLog: this.logPath,
      captureJson: this.capturePath,
      domSnapshot: this.domSnapshotPath,
      manifest: this.manifestJsonPath
    }
    await fsp.writeFile(this.manifestJsonPath, JSON.stringify(manifest, null, 2))
    const markdown = renderManifestMarkdown(manifest, this.config.runnerVersion)
    await fsp.writeFile(this.manifestMarkdownPath, markdown, 'utf-8')
    await recordLatestRun({
      baseline: manifest.baseline,
      runId: manifest.runId,
      timestamp: manifest.timestamp,
      capturePath: this.capturePath,
      manifestPath: this.manifestJsonPath
    })
  }

  buildManifestMarkdown(manifest: DomProbeManifest): string {
    return renderManifestMarkdown(manifest, this.config.runnerVersion)
  }
}

export function renderManifestMarkdown(manifest: DomProbeManifest, runnerVersion: string): string {
  const lines: string[] = []
  lines.push(`# DOM Probe Run – ${manifest.runId}`)
  lines.push('')
  lines.push(`- **Baseline:** ${manifest.baseline}`)
  lines.push(`- **URL:** ${manifest.url}`)
  lines.push(`- **Timestamp:** ${manifest.timestamp}`)
  lines.push(`- **Status:** ${manifest.status}`)
  lines.push('')
  lines.push('## Artifacts')
  lines.push('')
  for (const [label, value] of Object.entries(manifest.artifacts)) {
    if (!value || (Array.isArray(value) && value.length === 0)) continue
    if (Array.isArray(value)) {
      lines.push(`- **${label}:**`)
      for (const entry of value) {
        lines.push(`  - ${entry}`)
      }
    } else {
      lines.push(`- **${label}:** ${value}`)
    }
  }
  if (manifest.remoteArtifacts) {
    lines.push('')
    lines.push('## Remote Artifacts')
    lines.push('')
    for (const [label, value] of Object.entries(manifest.remoteArtifacts)) {
      if (!value || (Array.isArray(value) && value.length === 0)) continue
      if (Array.isArray(value)) {
        lines.push(`- **${label}:**`)
        for (const entry of value) {
          if (!entry?.key) continue
          const urlSuffix = entry.url ? ` → ${entry.url}` : ''
          lines.push(`  - ${entry.key}${urlSuffix}`)
        }
      } else if (value && typeof value === 'object' && 'key' in value) {
        const artifact = value as { key?: string; url?: string | null }
        if (!artifact.key) continue
        const urlSuffix = artifact.url ? ` → ${artifact.url}` : ''
        lines.push(`- **${label}:** ${artifact.key}${urlSuffix}`)
      }
    }
  }
  if (manifest.errors.length > 0) {
    lines.push('')
    lines.push('## Errors')
    lines.push('')
    manifest.errors.forEach(error => {
      lines.push(`- ${error}`)
    })
  }
  const completed = Object.entries(manifest.checkpoints).filter(([, cp]) => cp.completed)
  if (completed.length > 0) {
    lines.push('')
    lines.push('## Checkpoints')
    lines.push('')
    completed.forEach(([id, cp]) => {
      const suffix = cp.artifact ? ` (${cp.artifact})` : ''
      lines.push(`- ${id}${suffix}`)
    })
  }
  if (manifest.notes && manifest.notes.length > 0) {
    lines.push('')
    lines.push('## Notes')
    lines.push('')
    manifest.notes.forEach(note => lines.push(`- ${note}`))
  }
  lines.push('')
  lines.push(`_Generated by ${DOM_PROBE_NAMESPACE} v${runnerVersion}_`)
  return lines.join('\n')
}
