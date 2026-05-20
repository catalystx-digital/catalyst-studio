import { mkdir, readdir, stat, rm, readFile, writeFile } from 'node:fs/promises'
import { rmSync, existsSync } from 'node:fs'
import { spawn } from 'node:child_process'
import { resolve, parse } from 'node:path'
import { parse as parseEnv } from 'dotenv'

function isRootPath(target: string): boolean {
  const resolved = resolve(target)
  const parsed = parse(resolved)
  return parsed.root === resolved
}

/**
 * Run a platform-specific command with promise wrapper
 */
function runCommand(command: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn(command, args, {
      stdio: 'ignore',
      shell: process.platform === 'win32'
    })

    proc.on('error', reject)
    proc.on('close', code => {
      if (code === 0) {
        resolve()
      } else {
        reject(new Error(`${command} ${args.join(' ')} exited with code ${code}`))
      }
    })
  })
}

/**
 * Robust directory cleanup that handles Windows file locking issues
 * Similar to the one in Playwright tests but adapted for async usage
 * @param dirPath - Directory path to clear
 * @param options - Options including maxRetries and verbose logging
 */
async function robustClearDirectory(
  dirPath: string,
  options: { maxRetries?: number; verbose?: boolean } = {}
): Promise<void> {
  const { maxRetries = 3, verbose = false } = options
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const backupPath = `${dirPath}.old-${timestamp}`

  // Helper for conditional logging - only log details in verbose mode
  const log = verbose ? console.log : () => {}

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      if (existsSync(dirPath)) {
        log(`[ensureEmptyDirectory] Attempt ${attempt}/${maxRetries}: removing ${dirPath}`)

        // On Windows, first try to rename the directory if direct removal fails
        if (process.platform === 'win32' && attempt === 1) {
          try {
            if (existsSync(backupPath)) {
              rmSync(backupPath, { recursive: true, force: true })
            }
            log(`[ensureEmptyDirectory] Attempting to rename ${dirPath} to ${backupPath}`)
            rmSync(backupPath, { recursive: true, force: true }) // Clean backup location first
            await runCommand('cmd', ['/c', 'move', `"${dirPath}"`, `"${backupPath}"`])
            log('[ensureEmptyDirectory] Successfully renamed directory, now removing backup')
            rmSync(backupPath, { recursive: true, force: true, maxRetries: 2 })
            log('[ensureEmptyDirectory] Successfully removed backup directory')
            await mkdir(dirPath, { recursive: true })
            return
          } catch (renameError) {
            log('[ensureEmptyDirectory] Rename strategy failed, trying direct removal')
          }
        }

        // Try async removal first
        await rm(dirPath, { recursive: true, force: true })
        await mkdir(dirPath, { recursive: true })
        log('[ensureEmptyDirectory] Successfully removed directory')
        return
      } else {
        await mkdir(dirPath, { recursive: true })
        log('[ensureEmptyDirectory] Directory does not exist, created new one')
        return
      }
    } catch (error) {
      // Always log failures since they're important for debugging
      console.log(`[ensureEmptyDirectory] Attempt ${attempt}/${maxRetries} failed:`, error instanceof Error ? error.message : String(error))

      if (attempt === maxRetries) {
        // Last resort: try platform-specific commands
        try {
          log('[ensureEmptyDirectory] Last resort: trying platform-specific commands')
          if (process.platform === 'win32') {
            // Try to rename first, then remove
            try {
              if (existsSync(backupPath)) {
                await runCommand('cmd', ['/c', 'rmdir', '/s', '/q', `"${backupPath}"`])
              }
              await runCommand('cmd', ['/c', 'move', `"${dirPath}"`, `"${backupPath}"`])
              await runCommand('cmd', ['/c', 'rmdir', '/s', '/q', `"${backupPath}"`])
              log('[ensureEmptyDirectory] Rename + remove strategy succeeded')
            } catch {
              await runCommand('cmd', ['/c', 'rmdir', '/s', '/q', `"${dirPath}"`])
            }
          } else {
            await runCommand('rm', ['-rf', dirPath])
          }
          log('[ensureEmptyDirectory] Platform-specific command succeeded')
          await mkdir(dirPath, { recursive: true })
          return
        } catch (platformError) {
          // Always log final failures
          console.log('[ensureEmptyDirectory] Platform-specific command also failed:', platformError instanceof Error ? platformError.message : String(platformError))
          throw new Error(`Failed to clear ${dirPath} after ${maxRetries} attempts and platform fallback`)
        }
      }

      // Wait before retrying (increasing backoff)
      const delay = Math.min(1000 * attempt, 3000)
      log(`[ensureEmptyDirectory] Waiting ${delay}ms before retry...`)
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }
}

async function clearDirectory(path: string, options: { verbose?: boolean } = {}): Promise<void> {
  if (isRootPath(path)) {
    throw new Error(`Refusing to clear root directory: ${path}`)
  }
  await robustClearDirectory(path, { verbose: options.verbose })
}

export async function pathExists(path: string): Promise<boolean> {
  try {
    await stat(path)
    return true
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return false
    }
    throw error
  }
}

export async function ensureDirectory(path: string): Promise<void> {
  await mkdir(path, { recursive: true })
}

export async function ensureEmptyDirectory(
  path: string,
  options: { force?: boolean; verbose?: boolean } = {}
): Promise<boolean> {
  const { force = false, verbose = false } = options

  if (!(await pathExists(path))) {
    await mkdir(path, { recursive: true })
    return false
  }

  const entries = await readdir(path)
  if (entries.length === 0) {
    return false
  }

  if (!force) {
    throw new Error(`Output directory ${path} is not empty. Re-run with --force to overwrite.`)
  }

  await clearDirectory(path, { verbose })
  return true
}

export async function copyEnvironmentFiles(
  sourceDir: string,
  targetDir: string,
  options: { files?: string[]; keys?: string[]; overwrite?: boolean } = {}
): Promise<string[]> {
  const files = options.files ?? ['.env.local', '.env']
  const keys = options.keys ?? ['DATABASE_URL', 'DIRECT_URL']
  const overwrite = options.overwrite ?? true
  const copied: string[] = []

  if (keys.length === 0) {
    return copied
  }

  for (const name of files) {
    const sourcePath = resolve(sourceDir, name)
    if (!existsSync(sourcePath)) {
      continue
    }

    const raw = await readFile(sourcePath, 'utf8')
    const parsed = parseEnv(raw)
    const updates: Record<string, string> = {}

    for (const key of keys) {
      if (Object.prototype.hasOwnProperty.call(parsed, key)) {
        const value = parsed[key]
        if (value !== undefined && value !== null) {
          const stringValue = String(value)
          if (stringValue.length > 0) {
            updates[key] = stringValue
          }
        }
      }
    }

    if (Object.keys(updates).length === 0) {
      continue
    }

    const destinationPath = resolve(targetDir, name)
    let destinationRaw = ''
    if (existsSync(destinationPath)) {
      if (!overwrite) {
        continue
      }
      destinationRaw = await readFile(destinationPath, 'utf8')
    }

    const { content, changed } = applyEnvUpdates(destinationRaw, updates)
    if (changed) {
      await writeFile(destinationPath, content, 'utf8')
      copied.push(name)
    }
  }

  return copied
}

function applyEnvUpdates(original: string, updates: Record<string, string>): { content: string; changed: boolean } {
  const sanitized = original.replace(/\r\n/g, '\n')
  const hadContent = sanitized.length > 0
  const lines = hadContent ? sanitized.split('\n') : []
  const seenKeys = new Set<string>()
  let changed = false
  const keyRegex = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/

  for (let i = 0; i < lines.length; i += 1) {
    const match = lines[i].match(keyRegex)
    if (!match) {
      continue
    }

    const key = match[1]
    if (Object.prototype.hasOwnProperty.call(updates, key)) {
      const nextValue = updates[key]
      const nextLine = `${key}=${formatEnvValue(nextValue)}`
      if (lines[i] !== nextLine) {
        lines[i] = nextLine
        changed = true
      }
      seenKeys.add(key)
    }
  }

  const missingKeys = Object.keys(updates).filter(key => !seenKeys.has(key))
  if (missingKeys.length > 0) {
    while (lines.length > 0 && lines[lines.length - 1] === '') {
      lines.pop()
      changed = true
    }
  }

  for (const key of missingKeys) {
    lines.push(`${key}=${formatEnvValue(updates[key])}`)
    changed = true
  }

  if (lines.length === 0) {
    const newLines = Object.entries(updates).map(([key, value]) => `${key}=${formatEnvValue(value)}`)
    const content = `${newLines.join('\n')}\n`
    return { content, changed: changed || newLines.length > 0 }
  }

  let content = lines.join('\n')
  if (!content.endsWith('\n')) {
    content += '\n'
  }
  return { content, changed }
}

function formatEnvValue(value: string): string {
  const escaped = value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
  return `"${escaped}"`
}
