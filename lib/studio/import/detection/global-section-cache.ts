import { createHash } from 'crypto'
import type { SectionExtractionArtifact } from './section-aggregation'
import type { DetectionSectionRole } from './section-plan'

export type GlobalSectionExtractionMode = 'fresh' | 'reused'

export interface GlobalSectionReuseKeyInput {
  role: DetectionSectionRole
  origin: string
  sectionSlice: unknown
  candidateTypes: Iterable<string>
  model: string
}

export interface GlobalSectionReuseKey {
  key: string
  role: 'header' | 'footer'
  origin: string
  sectionContentHash: string
  candidateTypesHash: string
  model: string
  version: string
}

export interface GlobalSectionReuseProvenance {
  extractionMode: GlobalSectionExtractionMode
  reusedFromUrl?: string
  reusedFromSectionKey?: string
  sectionContentHash?: string
  reuseKey?: string
  reuseVersion?: string
  cacheHit?: boolean
  cacheMissReason?: string
}

interface CacheEntry {
  artifact: SectionExtractionArtifact
  sourceUrl: string
  sourceSectionKey: string
  key: GlobalSectionReuseKey
}

interface InflightResult {
  entry?: CacheEntry
  artifact: SectionExtractionArtifact
}

export interface GlobalSectionCacheResult {
  artifact: SectionExtractionArtifact
  provenance: GlobalSectionReuseProvenance
}

const REUSE_VERSION = 'global-section-cache:v1;schema:strict;parser:section-response;normalizer:nav-v1'
const GLOBAL_REUSE_ROLES = new Set<DetectionSectionRole>(['header', 'footer'])
const VOLATILE_KEYS = new Set([
  'aria-current',
  'data-active',
  'data-current',
  'pathId',
  'dataPathId',
  'index',
  'order',
  'offset',
  'byteOffset',
  'start',
  'end',
  'hash',
  'sectionKey',
  'sectionOrder'
])

const VOLATILE_CLASS_TOKENS = new Set([
  'active',
  'current',
  'is-active',
  'is-current',
  'selected',
  'router-link-active',
  'router-link-exact-active'
])

function normalizeValue(key: string, value: unknown): unknown {
  if ((key === 'class' || key === 'className') && typeof value === 'string') {
    return value
      .split(/\s+/)
      .filter(token => token && !VOLATILE_CLASS_TOKENS.has(token.toLowerCase()))
      .join(' ')
  }
  return value
}

function stableStringify(value: unknown): string {
  if (value == null || typeof value !== 'object') {
    return JSON.stringify(value)
  }
  if (Array.isArray(value)) {
    return `[${value.map(item => stableStringify(item)).join(',')}]`
  }
  const record = value as Record<string, unknown>
  const entries = Object.keys(record)
    .filter(key => !VOLATILE_KEYS.has(key))
    .sort()
    .map(key => `${JSON.stringify(key)}:${stableStringify(normalizeValue(key, record[key]))}`)
  return `{${entries.join(',')}}`
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

function cloneArtifact(artifact: SectionExtractionArtifact): SectionExtractionArtifact {
  return {
    ...artifact,
    components: artifact.components.map(component => ({
      ...component,
      content: JSON.parse(JSON.stringify(component.content)),
      metadata: component.metadata ? JSON.parse(JSON.stringify(component.metadata)) : undefined
    })),
    pageMetadata: artifact.pageMetadata ? JSON.parse(JSON.stringify(artifact.pageMetadata)) : undefined,
    invalidComponents: artifact.invalidComponents
      ? artifact.invalidComponents.map(component => ({ ...component }))
      : undefined,
    parserRepairs: artifact.parserRepairs
      ? artifact.parserRepairs.map(repair => ({ ...repair }))
      : undefined
  }
}

export class GlobalSectionArtifactCache {
  private entries = new Map<string, CacheEntry>()
  private inflight = new Map<string, Promise<InflightResult>>()

  createKey(input: GlobalSectionReuseKeyInput): GlobalSectionReuseKey | null {
    if (input.role !== 'header' && input.role !== 'footer') {
      return null
    }
    const expectedType = input.role === 'header' ? 'navbar' : 'footer'
    const candidateSet = new Set(input.candidateTypes)
    const sortedCandidateTypes = candidateSet.has(expectedType)
      ? [expectedType]
      : Array.from(candidateSet).sort()
    const sectionContentHash = sha256(stableStringify(input.sectionSlice))
    const candidateTypesHash = sha256(sortedCandidateTypes.join('|'))
    const keyParts = [
      REUSE_VERSION,
      input.role,
      input.origin,
      input.model,
      sectionContentHash,
      candidateTypesHash
    ]
    return {
      key: sha256(keyParts.join('\n')),
      role: input.role,
      origin: input.origin,
      sectionContentHash,
      candidateTypesHash,
      model: input.model,
      version: REUSE_VERSION
    }
  }

  async getOrCreate(
    key: GlobalSectionReuseKey | null,
    source: { url: string; sectionKey: string },
    produce: () => Promise<SectionExtractionArtifact>
  ): Promise<GlobalSectionCacheResult> {
    if (!key) {
      return {
        artifact: await produce(),
        provenance: { extractionMode: 'fresh', cacheHit: false, cacheMissReason: 'role_not_reusable' }
      }
    }

    const existing = this.entries.get(key.key)
    if (existing) {
      return {
        artifact: cloneArtifact(existing.artifact),
        provenance: {
          extractionMode: 'reused',
          reusedFromUrl: existing.sourceUrl,
          reusedFromSectionKey: existing.sourceSectionKey,
          sectionContentHash: key.sectionContentHash,
          reuseKey: key.key,
          reuseVersion: key.version,
          cacheHit: true
        }
      }
    }

    const active = this.inflight.get(key.key)
    if (active) {
      try {
        const result = await active
        if (!result.entry) {
          // The in-flight extraction completed but did not meet cacheability rules.
          // This caller must run its own extraction rather than sharing a rejected cache candidate.
        } else {
          const entry = result.entry
          return {
            artifact: cloneArtifact(entry.artifact),
            provenance: {
              extractionMode: 'reused',
              reusedFromUrl: entry.sourceUrl,
              reusedFromSectionKey: entry.sourceSectionKey,
              sectionContentHash: key.sectionContentHash,
              reuseKey: key.key,
              reuseVersion: key.version,
              cacheHit: true
            }
          }
        }
      } catch (error) {
        throw error
      }
    }

    const promise = (async (): Promise<InflightResult> => {
      const artifact = await produce()
      if (!this.isCacheableArtifact(key.role, artifact)) {
        return { artifact: cloneArtifact(artifact) }
      }
      const entry: CacheEntry = {
        artifact: cloneArtifact(artifact),
        sourceUrl: source.url,
        sourceSectionKey: source.sectionKey,
        key
      }
      this.entries.set(key.key, entry)
      return { artifact: cloneArtifact(artifact), entry }
    })()
    this.inflight.set(key.key, promise)

    try {
      const result = await promise
      if (!result.entry) {
        return {
          artifact: cloneArtifact(result.artifact),
          provenance: {
            extractionMode: 'fresh',
            sectionContentHash: key.sectionContentHash,
            reuseKey: key.key,
            reuseVersion: key.version,
            cacheHit: false,
            cacheMissReason: 'fresh_extraction_not_cacheable'
          }
        }
      }
      const entry = result.entry
      return {
        artifact: cloneArtifact(entry.artifact),
        provenance: {
          extractionMode: 'fresh',
          sectionContentHash: key.sectionContentHash,
          reuseKey: key.key,
          reuseVersion: key.version,
          cacheHit: false,
          cacheMissReason: 'new_validated_artifact'
        }
      }
    } catch (error) {
      throw error
    } finally {
      if (this.inflight.get(key.key) === promise) {
        this.inflight.delete(key.key)
      }
    }
  }

  private isCacheableArtifact(role: 'header' | 'footer', artifact: SectionExtractionArtifact): boolean {
    if (!GLOBAL_REUSE_ROLES.has(role)) {
      return false
    }
    if (artifact.components.length === 0) {
      return false
    }
    const expectedType = role === 'header' ? 'navbar' : 'footer'
    return artifact.components.some(component => component.type === expectedType)
  }
}
