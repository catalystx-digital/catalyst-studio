import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { config as loadEnv } from 'dotenv'

let isLoaded = false

export function ensureCliEnvLoaded(): void {
  if (isLoaded) {
    return
  }

  const cwd = process.cwd()
  const envFiles = ['.env.local', '.env']

  for (const file of envFiles) {
    const filePath = resolve(cwd, file)
    if (existsSync(filePath)) {
      loadEnv({ path: filePath })
    }
  }

  isLoaded = true
}
