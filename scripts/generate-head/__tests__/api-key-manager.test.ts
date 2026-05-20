import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { writeFile } from 'node:fs/promises'
import { ApiKeyManager } from '../utils/api-key-manager'
import type { ApiKeyEvent } from '../utils/api-key-manager'
import type { ApiAccessClient } from '../utils/api-access-client'
import type { AccountApiKeySummary } from '@/types/api'

function createTempDir(): string {
  return mkdtempSync(join(tmpdir(), 'api-key-manager-'))
}

function createClientMocks(overrides?: Partial<Record<keyof ApiAccessClient, jest.Mock>>): jest.Mocked<ApiAccessClient> {
  return {
    listKeys: jest.fn().mockResolvedValue([]),
    createKey: jest.fn().mockResolvedValue({
      key: {
        id: 'key-1',
        accountId: 'acct',
        websiteId: 'site-1',
        label: 'Auto',
        scopes: [],
        status: 'active',
        issuedAt: new Date(),
        issuedBy: null,
        expiresAt: null,
        lastUsedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        keyPreview: 'abcd',
        hasSecondaryKey: false
      },
      plaintextKey: 'ucs_auto_new'
    }),
    rotateKey: jest.fn(),
    ...overrides
  } as unknown as jest.Mocked<ApiAccessClient>
}

describe('ApiKeyManager', () => {
  it('reuses persisted key file when available', async () => {
    const dir = createTempDir()
    const file = join(dir, 'key.txt')
    await writeFile(file, 'persisted_key', { mode: 0o600 })
    const client = createClientMocks()
    const manager = new ApiKeyManager(client, {
      websiteId: 'site-abc',
      persistKeyPath: file
    })

    const key = await manager.getApiKey()
    expect(key).toBe('persisted_key')
    expect(client.listKeys).not.toHaveBeenCalled()

    rmSync(dir, { recursive: true, force: true })
  })

  it('creates a new key when none exist remotely', async () => {
    const client = createClientMocks()
    const manager = new ApiKeyManager(client, { websiteId: 'site-xyz' })

    const key = await manager.getApiKey()
    expect(key).toBe('ucs_auto_new')
    expect(client.createKey).toHaveBeenCalledWith(
      expect.objectContaining({
        websiteId: 'site-xyz'
      })
    )
  })

  it('rotates the latest key when one exists', async () => {
    const existingKey: AccountApiKeySummary = {
      id: 'existing',
      accountId: 'acct',
      websiteId: 'site-xyz',
      label: 'Existing',
      scopes: [],
      status: 'active',
      issuedAt: new Date(),
      issuedBy: null,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      lastUsedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      keyPreview: 'prev',
      hasSecondaryKey: false
    }

    const client = createClientMocks({
      listKeys: jest.fn().mockResolvedValue([existingKey]),
      rotateKey: jest.fn().mockResolvedValue({
        key: existingKey,
        plaintextKey: 'rotated_value'
      })
    })

    const manager = new ApiKeyManager(client, { websiteId: 'site-xyz' })
    const key = await manager.getApiKey()
    expect(key).toBe('rotated_value')
    expect(client.rotateKey).toHaveBeenCalledWith('existing')
  })

  it('cleans up persisted key files the CLI created on exit', async () => {
    const dir = createTempDir()
    const file = join(dir, 'temp.key')
    const exitHandlers: Record<string, (() => void)[]> = {}
    const onceSpy = jest.spyOn(process, 'once').mockImplementation(((event: any, handler: any) => {
      exitHandlers[event] = exitHandlers[event] ?? []
      exitHandlers[event]?.push(handler)
      return process
    }) as any)

    try {
      const client = createClientMocks()
      const manager = new ApiKeyManager(client, {
        websiteId: 'site-temp',
        persistKeyPath: file
      })

      await manager.getApiKey()
      expect(existsSync(file)).toBe(true)

      exitHandlers.exit?.forEach(handler => handler())
      await new Promise(resolve => setImmediate(resolve))
      expect(existsSync(file)).toBe(false)
    } finally {
      onceSpy.mockRestore()
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('preserves pre-existing persisted key files after exit', async () => {
    const dir = createTempDir()
    const file = join(dir, 'existing.key')
    await writeFile(file, 'persisted_key', { mode: 0o600 })
    const exitHandlers: Record<string, (() => void)[]> = {}
    const onceSpy = jest.spyOn(process, 'once').mockImplementation(((event: any, handler: any) => {
      exitHandlers[event] = exitHandlers[event] ?? []
      exitHandlers[event]?.push(handler)
      return process
    }) as any)

    try {
      const client = createClientMocks()
      const manager = new ApiKeyManager(client, {
        websiteId: 'site-temp',
        persistKeyPath: file
      })

      await manager.getApiKey()
      expect(existsSync(file)).toBe(true)

      exitHandlers.exit?.forEach(handler => handler())
      await new Promise(resolve => setImmediate(resolve))
      expect(existsSync(file)).toBe(true)
    } finally {
      onceSpy.mockRestore()
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('emits lifecycle events for mint, persist, and reuse actions', async () => {
    const dir = createTempDir()
    const file = join(dir, 'events.key')
    const client = createClientMocks()
    const events: ApiKeyEvent[] = []

    const manager = new ApiKeyManager(client, {
      websiteId: 'site-events',
      persistKeyPath: file,
      onEvent: event => events.push(event)
    })

    await manager.getApiKey()
    await manager.getApiKey()

    const minted = events.filter(event => event.type === 'minted')
    const persisted = events.filter(event => event.type === 'persisted')
    const reused = events.filter(event => event.type === 'reused')

    expect(minted).toHaveLength(1)
    expect(persisted).toHaveLength(1)
    expect(reused.length).toBeGreaterThanOrEqual(1)

    rmSync(dir, { recursive: true, force: true })
  })
})
