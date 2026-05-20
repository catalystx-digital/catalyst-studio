import { mkdtemp, rm, writeFile, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { copyEnvironmentFiles } from '../utils/fs'

async function createTempDir(): Promise<string> {
  const base = await mkdtemp(join(tmpdir(), 'head-env-'))
  return base
}

describe('copyEnvironmentFiles', () => {
  it('copies .env and .env.local when present', async () => {
    const source = await createTempDir()
    const destination = await createTempDir()
    try {
      const dbUrl = `postgres://${randomUUID()}:password@localhost:5432/db`
      const directUrl = `postgres://${randomUUID()}:password@localhost:5432/direct`
      const envLocalContent = `DATABASE_URL=${dbUrl}\nUNRELATED=value\n`
      const envContent = `DIRECT_URL=${directUrl}\nNEXT_PUBLIC_API=${randomUUID()}\n`

      await writeFile(join(source, '.env.local'), envLocalContent, 'utf8')
      await writeFile(join(source, '.env'), envContent, 'utf8')

      const existingEnvLocal = `EXISTING=1\nDATABASE_URL=old\n`
      const existingEnv = `NEXT_PUBLIC_FEATURE=true\n`
      await writeFile(join(destination, '.env.local'), existingEnvLocal, 'utf8')
      await writeFile(join(destination, '.env'), existingEnv, 'utf8')

      const copied = await copyEnvironmentFiles(source, destination)
      expect(copied).toEqual(['.env.local', '.env'])

      const copiedEnvLocal = await readFile(join(destination, '.env.local'), 'utf8')
      const copiedEnv = await readFile(join(destination, '.env'), 'utf8')

      expect(copiedEnvLocal).toBe(`EXISTING=1\nDATABASE_URL="${dbUrl}"\n`)
      expect(copiedEnv).toBe(`NEXT_PUBLIC_FEATURE=true\nDIRECT_URL="${directUrl}"\n`)
    } finally {
      await rm(source, { recursive: true, force: true })
      await rm(destination, { recursive: true, force: true })
    }
  })

  it('returns an empty list when no environment files exist', async () => {
    const source = await createTempDir()
    const destination = await createTempDir()
    try {
      const copied = await copyEnvironmentFiles(source, destination)
      expect(copied).toEqual([])
    } finally {
      await rm(source, { recursive: true, force: true })
      await rm(destination, { recursive: true, force: true })
    }
  })
})
