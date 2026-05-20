import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)

interface RootPackageJson {
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
}

let rootPackage: RootPackageJson | null = null

function loadRootPackageJson(): RootPackageJson {
  if (!rootPackage) {
    const rootPath = fileURLToPath(new URL('../../../package.json', import.meta.url))
    rootPackage = JSON.parse(readFileSync(rootPath, 'utf8')) as RootPackageJson
  }
  return rootPackage
}

function resolveFromRoot(packageName: string): { version: string } | null {
  const pkg = loadRootPackageJson()
  const version = pkg.dependencies?.[packageName] ?? pkg.devDependencies?.[packageName]
  if (!version) {
    return null
  }
  return { version }
}

export function readPackageManifest<T extends Record<string, unknown>>(name: string): T {
  try {
    // eslint-disable-next-line import/no-dynamic-require, global-require
    return require(`${name}/package.json`) as T
  } catch (error: unknown) {
    const fallback = resolveFromRoot(name)
    if (fallback) {
      return fallback as unknown as T
    }
    throw new Error(`Unable to resolve package manifest for ${name}: ${(error as Error).message}`)
  }
}

export function maybeReadPackageManifest<T extends Record<string, unknown>>(name: string): T | null {
  try {
    // eslint-disable-next-line import/no-dynamic-require, global-require
    return require(`${name}/package.json`) as T
  } catch (error: unknown) {
    const fallback = resolveFromRoot(name)
    return fallback ? (fallback as unknown as T) : null
  }
}
