/**
 * Shared Environment Loader
 *
 * All test scripts should import this FIRST to ensure .env.local is loaded
 * correctly with override enabled.
 *
 * Usage (MUST be first import):
 * ```typescript
 * import '../lib/load-env'  // or adjust path as needed
 * // ... rest of imports
 * ```
 *
 * Why this exists:
 * - dotenv.config() doesn't override existing env vars by default
 * - Shell environment can have stale values (old API keys, etc.)
 * - This ensures .env.local ALWAYS takes precedence
 */

import * as dotenv from 'dotenv'
import * as path from 'path'
import * as fs from 'fs'

// Find project root (where .env.local lives)
function findProjectRoot(startDir: string): string {
  let dir = startDir
  while (dir !== path.parse(dir).root) {
    if (fs.existsSync(path.join(dir, '.env.local'))) {
      return dir
    }
    if (fs.existsSync(path.join(dir, 'package.json'))) {
      return dir
    }
    dir = path.dirname(dir)
  }
  return startDir
}

const projectRoot = findProjectRoot(__dirname)
const envPath = path.join(projectRoot, '.env.local')

// Load with override: true to ensure .env.local takes precedence
const result = dotenv.config({
  path: envPath,
  override: true
})

if (result.error) {
  console.warn(`[load-env] Warning: Could not load ${envPath}:`, result.error.message)
} else {
  // Only log in debug mode to avoid noise
  if (process.env.DEBUG_ENV) {
    console.log(`[load-env] Loaded environment from ${envPath}`)
    console.log(`[load-env] OPENROUTER_API_KEY: ${process.env.OPENROUTER_API_KEY?.slice(0, 8)}...`)
    console.log(`[load-env] OPENROUTER_BASE_URL: ${process.env.OPENROUTER_BASE_URL}`)
    console.log(`[load-env] OPENROUTER_MODEL: ${process.env.OPENROUTER_MODEL}`)
  }
}

// Export for explicit usage if needed
export { envPath, projectRoot }
