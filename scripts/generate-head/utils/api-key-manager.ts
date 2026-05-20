import { readFile, unlink, writeFile } from 'node:fs/promises'
import type { AccountApiKeyScope, AccountApiKeySummary } from '@/types/api'
import { ApiAccessClient, ApiAccessClientError } from './api-access-client'

const ROTATION_THRESHOLD_MS = 2 * 60 * 60 * 1000 // 2 hours
const WEBSITE_SCOPE: AccountApiKeyScope = 'WEBSITE_READ'

type Logger = {
  info: (message: string, context?: Record<string, unknown>) => void
  warn: (message: string, context?: Record<string, unknown>) => void
}

export type ApiKeyEvent =
  | { type: 'reused'; websiteId: string; source: 'memory' | 'file'; persistPath?: string }
  | { type: 'minted'; websiteId: string; keyId: string; expiresAt?: string | null }
  | { type: 'rotated'; websiteId: string; keyId: string; expiresAt?: string | null; reason: string }
  | { type: 'persisted'; websiteId: string; persistPath: string }

export interface ApiKeyManagerOptions {
  websiteId: string
  label?: string
  persistKeyPath?: string
  autoManageKeys?: boolean
  logger?: Partial<Logger>
  onEvent?: (event: ApiKeyEvent) => void
}

export class ApiKeyManager {
  private cachedKey: string | null = null
  private readonly label: string
  private readonly persistKeyPath?: string
  private persistLoaded = false
  private persistedFilePreexisting = false
  private cleanupRegistered = false
  private readonly logger: Logger

  constructor(
    private readonly client: ApiAccessClient,
    private readonly options: ApiKeyManagerOptions
  ) {
    this.label = options.label?.trim() || `Head Export ${options.websiteId}`
    this.persistKeyPath = options.persistKeyPath
    const noop = () => {}
    this.logger = {
      info: options.logger?.info ?? noop,
      warn: options.logger?.warn ?? noop
    }
  }

  async getApiKey(): Promise<string> {
    if (this.cachedKey) {
      this.emit({ type: 'reused', websiteId: this.options.websiteId, source: 'memory' })
      return this.cachedKey
    }

    await this.maybeLoadPersistedKey()
    if (this.cachedKey) {
      this.logger.info('apiKeyReuse', { websiteId: this.options.websiteId, source: 'file' })
      this.emit({ type: 'reused', websiteId: this.options.websiteId, source: 'file', persistPath: this.persistKeyPath })
      return this.cachedKey
    }

    const key = await this.refreshKey()
    this.cachedKey = key
    await this.persistKey(key)
    return key
  }

  private async refreshKey(): Promise<string> {
    try {
      const keys = await this.client.listKeys({ websiteId: this.options.websiteId })
      const activeWebsiteKeys = keys
        .filter(entry => entry.websiteId === this.options.websiteId && entry.status === 'active')
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

      const candidate = activeWebsiteKeys[0]
      if (candidate) {
        const shouldRotate = this.shouldRotate(candidate)
        if (!shouldRotate) {
          this.logger.warn('apiKeyPlaintextUnavailable', {
            websiteId: this.options.websiteId,
            keyId: candidate.id,
            action: 'rotate_for_plaintext'
          })
        }
        const rotation = await this.client.rotateKey(candidate.id)
        this.logger.info('apiKeyRotated', {
          websiteId: this.options.websiteId,
          keyId: rotation.key.id,
          expiresAt: rotation.key.expiresAt,
          reason: shouldRotate ? 'expiry_threshold' : 'plaintext_missing'
        })
        this.emit({
          type: 'rotated',
          websiteId: this.options.websiteId,
          keyId: rotation.key.id,
          expiresAt: rotation.key.expiresAt ? new Date(rotation.key.expiresAt).toISOString() : null,
          reason: shouldRotate ? 'expiry_threshold' : 'plaintext_missing'
        })
        return rotation.plaintextKey
      }

      const created = await this.client.createKey({
        label: this.label,
        websiteId: this.options.websiteId,
        scopes: [WEBSITE_SCOPE]
      })
      this.logger.info('apiKeyMinted', {
        websiteId: this.options.websiteId,
        keyId: created.key.id,
        expiresAt: created.key.expiresAt
      })
      this.emit({
        type: 'minted',
        websiteId: this.options.websiteId,
        keyId: created.key.id,
        expiresAt: created.key.expiresAt ? new Date(created.key.expiresAt).toISOString() : null
      })
      return created.plaintextKey
    } catch (error) {
      if (error instanceof ApiAccessClientError) {
        throw new Error(
          `API key automation failed (${error.status} ${error.code ?? ''}). Re-run with --api-key or refresh app auth.`
        )
      }
      throw error
    }
  }

  private shouldRotate(entry: AccountApiKeySummary): boolean {
    if (!entry.expiresAt) {
      return false
    }
    const expiresMs = new Date(entry.expiresAt).getTime()
    if (Number.isNaN(expiresMs)) {
      return false
    }
    return expiresMs - Date.now() <= ROTATION_THRESHOLD_MS
  }

  private async maybeLoadPersistedKey(): Promise<void> {
    if (this.persistLoaded || !this.persistKeyPath) {
      return
    }
    this.persistLoaded = true
    try {
      const data = await readFile(this.persistKeyPath, 'utf-8')
      const trimmed = data.trim()
      if (trimmed) {
        this.cachedKey = trimmed
        this.persistedFilePreexisting = true
        this.logger.info('apiKeyReuse', {
          websiteId: this.options.websiteId,
          source: 'file',
          persistPath: this.persistKeyPath
        })
      }
    } catch {
      // ignore missing file; refreshKey will mint or rotate
    }
  }

  private async persistKey(key: string): Promise<void> {
    if (!this.persistKeyPath) {
      return
    }
    await writeFile(this.persistKeyPath, key, { mode: 0o600 })
    if (!this.persistedFilePreexisting) {
      this.registerCleanup()
    }
    this.logger.info('apiKeyPersisted', {
      websiteId: this.options.websiteId,
      persistPath: this.persistKeyPath
    })
    this.emit({
      type: 'persisted',
      websiteId: this.options.websiteId,
      persistPath: this.persistKeyPath
    })
  }

  private registerCleanup(): void {
    if (this.cleanupRegistered || !this.persistKeyPath) {
      return
    }
    this.cleanupRegistered = true

    const cleanup = async (): Promise<void> => {
      if (!this.persistKeyPath || this.persistedFilePreexisting) {
        return
      }
      try {
        await unlink(this.persistKeyPath)
        this.logger.info('apiKeyPersistedCleanup', {
          websiteId: this.options.websiteId,
          persistPath: this.persistKeyPath
        })
      } catch {
        // swallow cleanup errors; nothing else to do
      }
    }

    const handleExit = (): void => {
      cleanup().catch(() => {})
    }

    process.once('exit', handleExit)
    process.once('SIGINT', () => {
      handleExit()
      process.exit(1)
    })
    process.once('SIGTERM', () => {
      handleExit()
      process.exit(1)
    })
  }

  private emit(event: ApiKeyEvent): void {
    if (typeof this.options.onEvent === 'function') {
      this.options.onEvent(event)
    }
  }
}
