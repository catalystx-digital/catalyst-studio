import { test, expect } from '@playwright/test'
import { spawn } from 'node:child_process'
import { rmSync, existsSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { once } from 'node:events'
import net, { AddressInfo } from 'node:net'

const PNPM = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm'
const NPX = process.platform === 'win32' ? 'npx.cmd' : 'npx'
const OUTPUT_DIR = '.playwright-head'
const HOST = '127.0.0.1'
const repoRoot = process.cwd()
const projectDir = path.resolve(repoRoot, OUTPUT_DIR)

/**
 * Robust directory cleanup that handles Windows file locking issues
 * Uses retry logic, renaming, and platform-specific commands as fallback
 */
async function robustCleanup(dirPath: string, maxRetries = 3): Promise<void> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const backupPath = `${dirPath}.old-${timestamp}`

  // First, clean up any existing backup directories
  const parentDir = path.dirname(dirPath)
  const baseName = path.basename(dirPath)
  try {
    const existingEntries = readdirSync(parentDir)
    const backupDirs = existingEntries.filter(entry =>
      entry.startsWith(`${baseName}.old-`)
    )
    for (const backupDir of backupDirs) {
      const backupFullPath = path.join(parentDir, backupDir)
      console.log(`[cleanup] Removing existing backup directory: ${backupFullPath}`)
      try {
        rmSync(backupFullPath, { recursive: true, force: true })
      } catch (cleanupError) {
        console.log(`[cleanup] Failed to remove backup ${backupFullPath}:`, cleanupError instanceof Error ? cleanupError.message : String(cleanupError))
      }
    }
  } catch (error) {
    console.log('[cleanup] Error checking for backup directories:', error instanceof Error ? error.message : String(error))
  }

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      if (existsSync(dirPath)) {
        console.log(`[cleanup] Attempt ${attempt}/${maxRetries}: removing ${dirPath}`)

        // On Windows, first try to rename the directory if direct removal fails
        if (process.platform === 'win32' && attempt === 1) {
          try {
            if (existsSync(backupPath)) {
              rmSync(backupPath, { recursive: true, force: true })
            }
            console.log(`[cleanup] Attempting to rename ${dirPath} to ${backupPath}`)
            rmSync(backupPath, { recursive: true, force: true }) // Clean backup location first
            // Use move command instead of rename to handle locked files
            await runCommand('cmd', ['/c', 'move', `"${dirPath}"`, `"${backupPath}"`])
            console.log('[cleanup] Successfully renamed directory, now removing backup')
            rmSync(backupPath, { recursive: true, force: true, maxRetries: 2 })
            console.log('[cleanup] Successfully removed backup directory')
            return
          } catch (renameError) {
            console.log('[cleanup] Rename strategy failed, trying direct removal')
          }
        }

        rmSync(dirPath, { recursive: true, force: true, maxRetries: 3 })
        console.log('[cleanup] Successfully removed directory')
        return
      } else {
        console.log('[cleanup] Directory does not exist, nothing to clean')
        return
      }
    } catch (error) {
      console.log(`[cleanup] Attempt ${attempt}/${maxRetries} failed:`, error instanceof Error ? error.message : String(error))

      if (attempt === maxRetries) {
        // Last resort: try platform-specific commands
        try {
          console.log('[cleanup] Last resort: trying platform-specific commands')
          if (process.platform === 'win32') {
            // Try to rename first, then remove
            try {
              if (existsSync(backupPath)) {
                await runCommand('cmd', ['/c', 'rmdir', '/s', '/q', `"${backupPath}"`])
              }
              await runCommand('cmd', ['/c', 'move', `"${dirPath}"`, `"${backupPath}"`])
              await runCommand('cmd', ['/c', 'rmdir', '/s', '/q', `"${backupPath}"`])
              console.log('[cleanup] Rename + remove strategy succeeded')
            } catch {
              await runCommand('cmd', ['/c', 'rmdir', '/s', '/q', `"${dirPath}"`])
            }
          } else {
            await runCommand('rm', ['-rf', dirPath])
          }
          console.log('[cleanup] Platform-specific command succeeded')
          return
        } catch (platformError) {
          console.log('[cleanup] Platform-specific command also failed:', platformError instanceof Error ? platformError.message : String(platformError))
          console.log('[cleanup] WARNING: Could not fully clean directory, but continuing...')
          // Don't throw error, just log and continue - the --force flag should handle remaining files
          return
        }
      }

      // Wait before retrying (increasing backoff)
      const delay = Math.min(1000 * attempt, 3000)
      console.log(`[cleanup] Waiting ${delay}ms before retry...`)
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }
}

interface RunCommandOptions {
  cwd?: string
  env?: NodeJS.ProcessEnv
  inheritStdio?: boolean
}

function runCommand(command: string, args: string[], options: RunCommandOptions = {}): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn(command, args, {
      cwd: options.cwd ?? repoRoot,
      stdio: options.inheritStdio ? 'inherit' : ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, ...options.env },
      shell: process.platform === 'win32'
    })

    let stderr = ''
    if (!options.inheritStdio && proc.stderr) {
      proc.stderr.on('data', chunk => {
        stderr += chunk.toString()
      })
    }

    proc.on('error', reject)
    proc.on('close', code => {
      if (code === 0) {
        resolve()
      } else {
        reject(new Error(`${command} ${args.join(' ')} exited with code ${code}${stderr ? `\n${stderr}` : ''}`))
      }
    })
  })
}

async function waitForDevReady(dev: ReturnType<typeof spawn>, url: string): Promise<void> {
  let closed = false
  let exitCode: number | null = null
  let stderr = ''

  dev.once('close', code => {
    closed = true
    exitCode = typeof code === 'number' ? code : null
  })

  if (dev.stderr) {
    dev.stderr.on('data', chunk => {
      stderr += chunk.toString()
    })
  }

  if (dev.stdout) {
    dev.stdout.on('data', chunk => {
      process.stdout.write(chunk.toString())
    })
  }

  const deadline = Date.now() + 120_000
  while (Date.now() < deadline) {
    if (closed) {
      const message = stderr.trim()
      throw new Error(
        `Dev server exited before readiness (code ${exitCode ?? 'unknown'})${message ? `: ${message}` : ''}`
      )
    }

    try {
      const response = await fetch(url, { method: 'GET' })
      if (response.ok || response.status === 404) {
        return
      }
    } catch {
      // ignore connection errors until server is ready
    }

    await new Promise(resolve => setTimeout(resolve, 500))
  }

  throw new Error('Timed out waiting for dev server readiness')
}

async function tryReservePort(targetPort: number): Promise<number | null> {
  return new Promise(resolve => {
    const server = net.createServer()

    const finalize = (result: number | null): void => {
      server.close(() => resolve(result))
    }

    server.once('error', () => finalize(null))

    server.listen({ port: targetPort, host: '0.0.0.0', exclusive: true }, () => {
      const address = server.address() as AddressInfo | null
      const value = address?.port ?? null
      finalize(value)
    })
  })
}

async function findAvailablePort(preferred: number): Promise<number> {
  const direct = await tryReservePort(preferred)
  if (direct && Number.isFinite(direct)) {
    return direct
  }

  const fallback = await tryReservePort(0)
  if (!fallback) {
    throw new Error('Failed to allocate port for dev server')
  }
  return fallback
}

let devProcess: ReturnType<typeof spawn> | null = null
let port: number | null = null
let baseUrl = `http://${HOST}:0`

test.describe('head generator routing smoke', () => {
  test.describe.configure({ timeout: 300_000, mode: 'serial' })

  test.beforeAll(async () => {
    test.info().setTimeout(300_000)

    console.log('[setup] Starting robust cleanup of .playwright-head directory')
    await robustCleanup(projectDir)
    console.log('[setup] Cleanup completed, proceeding with test setup')

    await runCommand(PNPM, ['tsx', 'scripts/generate-head/index.ts', '--provider', 'stub', '--output', OUTPUT_DIR, '--force'], {
      inheritStdio: true
    })

    // Remove any pnpm-lock.yaml file from the generated directory to avoid conflicts with workspace
    const lockfilePath = path.join(projectDir, 'pnpm-lock.yaml')
    if (existsSync(lockfilePath)) {
      console.log('[setup] Removing pnpm-lock.yaml from generated directory to avoid conflicts')
      try {
        rmSync(lockfilePath, { force: true })
      } catch (error) {
        console.log('[setup] Warning: Failed to remove pnpm-lock.yaml:', error instanceof Error ? error.message : String(error))
      }
    }

    await runCommand(PNPM, ['--dir', OUTPUT_DIR, 'install', '--ignore-workspace'], { inheritStdio: true })

    // Clean any .next directory that might have been created during install to avoid locked trace files
    const nextDir = path.join(projectDir, '.next')
    if (existsSync(nextDir)) {
      console.log('[setup] Removing .next directory to avoid trace file locking issues')
      try {
        rmSync(nextDir, { recursive: true, force: true })
      } catch (error) {
        console.log('[setup] Warning: Failed to remove .next directory:', error instanceof Error ? error.message : String(error))
      }
    }

    const selectedPort = await findAvailablePort(4100)
    port = selectedPort
    baseUrl = `http://${HOST}:${selectedPort}`

    await runCommand(NPX, ['kill-port', selectedPort.toString()]).catch(() => undefined)

    devProcess = spawn(PNPM, ['--dir', OUTPUT_DIR, 'exec', 'next', 'dev', '--hostname', HOST, '--port', selectedPort.toString()], {
      cwd: repoRoot,
      env: { ...process.env, PORT: selectedPort.toString() },
      shell: process.platform === 'win32'
    })

    await waitForDevReady(devProcess, `${baseUrl}/`)
  })

  test.afterAll(async () => {
    console.log('[teardown] Starting cleanup process')

    if (devProcess) {
      console.log('[teardown] Killing dev process')
      devProcess.kill('SIGINT')
      await once(devProcess, 'exit').catch(() => undefined)
      devProcess = null
    }

    if (typeof port === 'number' && Number.isFinite(port) && port > 0) {
      console.log('[teardown] Killing port', port)
      await runCommand(NPX, ['kill-port', port.toString()]).catch(() => undefined)
    }

    console.log('[teardown] Starting robust cleanup of .playwright-head directory')
    await robustCleanup(projectDir)
    console.log('[teardown] All cleanup completed')
  })

  test('renders the home route via redirect', async ({ page }) => {
    const response = await page.goto(`${baseUrl}/`, { waitUntil: 'networkidle' })
    expect(response?.status()).toBe(200)
    await expect(page.locator('h1')).toContainText('Home')
    expect(page.url()).toContain('/home')
  })

  test('renders nested slugs', async ({ page }) => {
    const response = await page.goto(`${baseUrl}/home/products`, { waitUntil: 'networkidle' })
    expect(response?.status()).toBe(200)
    await expect(page.locator('h1')).toContainText('Products')
  })

  test('returns not found for missing slugs', async ({ page }) => {
    const response = await page.goto(`${baseUrl}/missing-slug`, { waitUntil: 'domcontentloaded' })
    expect(response?.status()).toBe(404)
  })
})
