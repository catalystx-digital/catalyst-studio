import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)

const README_SOURCE_PATH = fileURLToPath(
  new URL('../../../docs/head-generator-phase1.md', import.meta.url)
)

const DEFAULT_SCRIPTS = {
  dev: 'next dev',
  build: 'next build',
  start: 'next start',
  lint: 'next lint'
}

function readPackageManifest(packageName) {
  try {
    return require(`${packageName}/package.json`)
  } catch (error) {
    throw new Error(`Unable to resolve package.json for \"${packageName}\": ${error.message}`)
  }
}

function maybeReadPackageManifest(packageName) {
  try {
    return require(`${packageName}/package.json`)
  } catch (error) {
    return null
  }
}

function sortRecord(record) {
  return Object.keys(record)
    .sort()
    .reduce((acc, key) => {
      acc[key] = record[key]
      return acc
    }, {})
}

function resolveEslintDevVersion() {
  const eslintConfigPkg = readPackageManifest('eslint-config-next')
  const peerRange = eslintConfigPkg.peerDependencies?.eslint?.trim()
  const installedEslint = maybeReadPackageManifest('eslint')?.version

  if (peerRange) {
    if (installedEslint) {
      try {
        const semver = require('next/dist/compiled/semver')
        if (!semver.satisfies(installedEslint, peerRange)) {
          throw new Error(
            `Installed ESLint version ${installedEslint} does not satisfy eslint-config-next peer range ${peerRange}`
          )
        }
      } catch (error) {
        throw new Error(`Failed to verify ESLint peer dependency compatibility: ${error.message}`)
      }
    }

    return peerRange
  }

  if (installedEslint) {
    return installedEslint
  }

  throw new Error('Unable to determine ESLint version requirement for generated package.json')
}

function collectTypeScriptDevDependencies() {
  const optionalPackages = [
    '@types/node',
    '@types/react',
    '@types/react-dom',
    'typescript'
  ]

  const versions = optionalPackages.reduce((acc, packageName) => {
    const manifest = maybeReadPackageManifest(packageName)
    if (manifest?.version) {
      acc[packageName] = manifest.version
    }
    return acc
  }, {})

  return versions
}

export function buildPackageJson(options = {}) {
  const { name = 'demo-head', includeTypeScript = false } = options

  const nextVersion = readPackageManifest('next').version
  const reactVersion = readPackageManifest('react').version
  const reactDomVersion = readPackageManifest('react-dom').version
  const eslintConfigVersion = readPackageManifest('eslint-config-next').version

  const dependencies = sortRecord({
    next: nextVersion,
    react: reactVersion,
    'react-dom': reactDomVersion
  })

  const devDependencies = {
    'eslint-config-next': eslintConfigVersion,
    eslint: resolveEslintDevVersion()
  }

  if (includeTypeScript) {
    Object.assign(devDependencies, collectTypeScriptDevDependencies())
  }

  return {
    name,
    version: '0.1.0',
    private: true,
    scripts: { ...DEFAULT_SCRIPTS },
    dependencies,
    devDependencies: sortRecord(devDependencies)
  }
}

export function buildReadme() {
  const contents = readFileSync(README_SOURCE_PATH, 'utf8')
  return contents.endsWith('\n') ? contents : `${contents}\n`
}

export default buildPackageJson
