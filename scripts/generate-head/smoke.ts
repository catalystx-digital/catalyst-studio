#!/usr/bin/env tsx
import { once } from 'node:events'
import { spawn } from 'node:child_process'
import { rmSync, existsSync, mkdirSync } from 'node:fs'
import path from 'node:path'
import { performance } from 'node:perf_hooks'

const PNPM = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm'
const NPX = process.platform === 'win32' ? 'npx.cmd' : 'npx'

const OUTPUT_DIR = '.smoke-head'
const PORT = 4000
const repoRoot = process.cwd()
const projectDir = path.resolve(repoRoot, OUTPUT_DIR)

/**
 * Ensures that the parent directory exists for a given path
 */
function ensureParentDirectoryExists(targetPath: string): void {
  const parentDir = path.dirname(targetPath)
  if (!existsSync(parentDir)) {
    console.log(`[smoke] Creating parent directory: ${parentDir}`)
    mkdirSync(parentDir, { recursive: true })
  }
}

/**
 * Robust directory cleanup that handles Windows file locking issues
 */
async function robustCleanup(dirPath: string, maxRetries = 3): Promise<void> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      if (existsSync(dirPath)) {
        console.log(`[smoke] Cleanup attempt ${attempt}/${maxRetries}: removing ${dirPath}`)
        rmSync(dirPath, { recursive: true, force: true, maxRetries: 3 })
        console.log('[smoke] Successfully removed directory')
        return
      } else {
        console.log('[smoke] Directory does not exist, nothing to clean')
        return
      }
    } catch (error) {
      console.log(`[smoke] Cleanup attempt ${attempt}/${maxRetries} failed:`, error instanceof Error ? error.message : String(error))

      if (attempt === maxRetries) {
        // Last resort: try platform-specific commands
        try {
          console.log('[smoke] Last resort: trying platform-specific commands')
          if (process.platform === 'win32') {
            await runCommand('cmd', ['/c', 'rmdir', '/s', '/q', `"${dirPath}"`])
          } else {
            await runCommand('rm', ['-rf', dirPath])
          }
          console.log('[smoke] Platform-specific command succeeded')
          return
        } catch (platformError) {
          console.log('[smoke] Platform-specific command also failed:', platformError instanceof Error ? platformError.message : String(platformError))
          throw new Error(`Failed to clean ${dirPath} after ${maxRetries} attempts and platform fallback`)
        }
      }

      // Wait before retrying (increasing backoff)
      const delay = Math.min(1000 * attempt, 3000)
      console.log(`[smoke] Waiting ${delay}ms before retry...`)
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }
}

interface RunOptions {
  cwd?: string
  env?: NodeJS.ProcessEnv
  inheritStdio?: boolean
}

function runCommand(command: string, args: string[], options: RunOptions = {}): Promise<void> {
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

async function waitForDevReady(devProcess: ReturnType<typeof spawn>): Promise<void> {
  if (!devProcess.stdout) {
    throw new Error('Expected dev process stdout')
  }

  for await (const chunk of devProcess.stdout) {
    const text = chunk.toString()
    process.stdout.write(text)
    if (text.includes('Ready in') || text.includes('started server on')) {
      return
    }
  }

  throw new Error('Dev server exited before it became ready')
}

async function runSmoke() {
  console.log('[smoke] Running CLI head smoke test...')

  // Ensure parent directory exists before cleanup and generation
  ensureParentDirectoryExists(projectDir)

  console.log('[smoke] Starting robust cleanup')
  await robustCleanup(projectDir)

  console.log('[smoke] Generating stub project')
  await runCommand(PNPM, ['tsx', 'scripts/generate-head/index.ts', '--provider', 'stub', '--output', OUTPUT_DIR, '--force'], { inheritStdio: true })

  console.log('[smoke] Installing dependencies')
  await runCommand(PNPM, ['--dir', OUTPUT_DIR, 'install', '--ignore-workspace'], { inheritStdio: true })

  console.log(`[smoke] Verifying dev server on port ${PORT}`)
  await runCommand(NPX, ['kill-port', PORT.toString()]).catch(() => undefined)

  const dev = spawn(PNPM, ['--dir', OUTPUT_DIR, 'exec', 'next', 'dev', '--hostname', '127.0.0.1', '--port', PORT.toString()], {
    cwd: repoRoot,
    env: { ...process.env, PORT: PORT.toString() },
    shell: process.platform === 'win32'
  })

  try {
    await waitForDevReady(dev)
    const homeStart = performance.now()
    const response = await fetch(`http://127.0.0.1:${PORT}/`)
    if (!response.ok) {
      throw new Error(`GET / responded with ${response.status}`)
    }
    const homeElapsed = performance.now() - homeStart
    console.log('[smoke] GET / responded with', response.status, `(${homeElapsed.toFixed(1)}ms)`) 

    const nestedStart = performance.now()
    const nestedResponse = await fetch(`http://127.0.0.1:${PORT}/home/products`)
    if (!nestedResponse.ok) {
      throw new Error(`GET /home/products responded with ${nestedResponse.status}`)
    }
    const nestedElapsed = performance.now() - nestedStart
    console.log('[smoke] GET /home/products responded with', nestedResponse.status, `(${nestedElapsed.toFixed(1)}ms)`)

    const missingStart = performance.now()
    const missingResponse = await fetch(`http://127.0.0.1:${PORT}/missing-slug`)
    const missingElapsed = performance.now() - missingStart
    if (missingResponse.status !== 404) {
      throw new Error(`Expected GET /missing-slug to return 404 but received ${missingResponse.status}`)
    }
    console.log('[smoke] GET /missing-slug responded with', missingResponse.status, `(${missingElapsed.toFixed(1)}ms)`)

    const diagnosticsResponse = await fetch(`http://127.0.0.1:${PORT}/api/head-runtime/diagnostics`)
    if (!diagnosticsResponse.ok) {
      throw new Error(`GET /api/head-runtime/diagnostics responded with ${diagnosticsResponse.status}`)
    }
    const diagnosticsPayload = await diagnosticsResponse.json() as {
      runtimeDiagnostics?: unknown[]
      providerDiagnostics?: unknown[]
    }
    console.log('[smoke] Diagnostics payload', {
      runtime: Array.isArray(diagnosticsPayload.runtimeDiagnostics)
        ? diagnosticsPayload.runtimeDiagnostics.length
        : 'unknown',
      provider: Array.isArray(diagnosticsPayload.providerDiagnostics)
        ? diagnosticsPayload.providerDiagnostics.length
        : 'unknown'
    })
  } finally {
    dev.kill('SIGINT')
    await once(dev, 'exit').catch(() => undefined)
    await runCommand(NPX, ['kill-port', PORT.toString()]).catch(() => undefined)
  }

  console.log('[smoke] Completed successfully')
}

runSmoke().catch(error => {
  console.error('Smoke test failed:', error)
  process.exitCode = 1
})
