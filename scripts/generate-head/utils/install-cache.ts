import { createHash } from 'node:crypto'
import { spawn } from 'node:child_process'
import { promises as fs } from 'node:fs'
import { constants as fsConstants } from 'node:fs'
import os from 'node:os'
import { resolve, join, dirname, isAbsolute } from 'node:path'

export type InstallCacheResult = 'restored' | 'populated' | 'skipped'

export interface InstallCacheOptions {
  repoRoot: string
  projectDir: string
  logger: {
    info: (message: string, context?: Record<string, unknown>) => void
    warn: (message: string, context?: Record<string, unknown>) => void
    error: (message: string, context?: Record<string, unknown>) => void
  }
  cacheDir?: string
  packageManager?: 'pnpm'
}

interface CachePaths {
  cacheRoot: string
  cacheEntryDir: string
  cacheNodeModules: string
  cacheLockfile: string
  cachePackageJson: string
}

const DEFAULT_CACHE_DIR = '.cache/head-installs'
const PACKAGE_LOCK = 'pnpm-lock.yaml'

function resolveCachePaths(options: InstallCacheOptions, cacheKey: string): CachePaths {
  const cacheRootRequested = options.cacheDir ?? DEFAULT_CACHE_DIR
  const cacheRoot = isAbsolute(cacheRootRequested)
    ? cacheRootRequested
    : resolve(options.repoRoot, cacheRootRequested)
  const cacheEntryDir = join(cacheRoot, cacheKey)
  return {
    cacheRoot,
    cacheEntryDir,
    cacheNodeModules: join(cacheEntryDir, 'node_modules'),
    cacheLockfile: join(cacheEntryDir, PACKAGE_LOCK),
    cachePackageJson: join(cacheEntryDir, 'package.json')
  }
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await fs.access(path, fsConstants.F_OK)
    return true
  } catch {
    return false
  }
}

async function readPackageJson(projectDir: string): Promise<string> {
  const packageJsonPath = join(projectDir, 'package.json')
  return fs.readFile(packageJsonPath, 'utf8')
}

function createCacheKey(packageJsonContents: string): string {
  return createHash('sha256').update(packageJsonContents).digest('hex')
}

async function copyFileIfExists(source: string, destination: string): Promise<void> {
  if (!(await pathExists(source))) {
    return
  }
  await fs.mkdir(dirname(destination), { recursive: true })
  await fs.copyFile(source, destination)
}

async function createDirectorySymlink(target: string, linkPath: string): Promise<void> {
  await fs.rm(linkPath, { recursive: true, force: true })
  await fs.mkdir(dirname(linkPath), { recursive: true })
  const type = process.platform === 'win32' ? 'junction' : 'dir'
  await fs.symlink(target, linkPath, type)
}

function isRunningInWsl(): boolean {
  if (process.platform !== 'linux') {
    return false
  }
  if (process.env.WSL_DISTRO_NAME || process.env.WSL_INTEROP) {
    return true
  }
  try {
    return os.release().toLowerCase().includes('microsoft')
  } catch {
    return false
  }
}

function isWindowsMountPath(path: string): boolean {
  return path.startsWith('/mnt/')
}

function isCrossEnvironmentPath(projectDir: string): boolean {
  return isRunningInWsl() && isWindowsMountPath(projectDir)
}

async function runPnpmInstall(projectDir: string, logger: InstallCacheOptions['logger']): Promise<void> {
  const command = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm'
  logger.info('Running pnpm install to populate install cache', { projectDir })
  await new Promise<void>((resolvePromise, reject) => {
    const child = spawn(command, ['install'], {
      cwd: projectDir,
      stdio: 'inherit',
      env: process.env
    })

    child.on('error', error => {
      reject(error)
    })

    child.on('close', code => {
      if (code === 0) {
        resolvePromise()
      } else {
        reject(new Error(`pnpm install exited with code ${code}`))
      }
    })
  })
}

export async function ensureInstallCache(options: InstallCacheOptions): Promise<InstallCacheResult> {
  if (options.packageManager && options.packageManager !== 'pnpm') {
    options.logger.warn('Install cache currently supports pnpm only; skipping hydration.')
    return 'skipped'
  }

  const packageJsonContents = await readPackageJson(options.projectDir)
  const cacheKey = createCacheKey(packageJsonContents)
  const paths = resolveCachePaths(options, cacheKey)
  const projectNodeModules = join(options.projectDir, 'node_modules')
  const crossEnvironment = isCrossEnvironmentPath(options.projectDir)

  if (crossEnvironment) {
    options.logger.info(
      'WSL path detected on Windows mount; skipping install cache to avoid cross-environment node_modules. Run pnpm install in your target shell.',
      { projectDir: options.projectDir }
    )
    return 'skipped'
  }

  await fs.mkdir(paths.cacheRoot, { recursive: true })

  if (await pathExists(paths.cacheNodeModules)) {
    options.logger.info('Restoring node_modules from install cache', {
      cacheKey,
      cacheDir: paths.cacheEntryDir
    })
    await createDirectorySymlink(paths.cacheNodeModules, projectNodeModules)
    await copyFileIfExists(paths.cacheLockfile, join(options.projectDir, PACKAGE_LOCK))
    return 'restored'
  }

  options.logger.info('Install cache miss; installing dependencies', {
    cacheKey,
    cacheDir: paths.cacheEntryDir
  })

  await runPnpmInstall(options.projectDir, options.logger)

  const projectLockfile = join(options.projectDir, PACKAGE_LOCK)

  if (!(await pathExists(projectNodeModules))) {
    options.logger.warn('pnpm install completed but node_modules is missing; skipping cache population', {
      projectDir: options.projectDir
    })
    return 'skipped'
  }

  await fs.rm(paths.cacheEntryDir, { recursive: true, force: true })
  await fs.mkdir(paths.cacheEntryDir, { recursive: true })

  try {
    await fs.rename(projectNodeModules, paths.cacheNodeModules)
  } catch (error: unknown) {
    options.logger.warn('Unable to move node_modules into install cache; falling back to copy', {
      cacheDir: paths.cacheEntryDir,
      error: error instanceof Error ? error.message : String(error)
    })
    await fs.rm(paths.cacheNodeModules, { recursive: true, force: true })
    await fs.cp(projectNodeModules, paths.cacheNodeModules, { recursive: true, dereference: false })
  }

  await copyFileIfExists(projectLockfile, paths.cacheLockfile)
  await copyFileIfExists(join(options.projectDir, 'package.json'), paths.cachePackageJson)

  await fs.rm(projectNodeModules, { recursive: true, force: true })
  await createDirectorySymlink(paths.cacheNodeModules, projectNodeModules)

  options.logger.info('Populated install cache', {
    cacheKey,
    cacheDir: paths.cacheEntryDir
  })

  return 'populated'
}
