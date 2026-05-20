// @ts-expect-error Next bundles semver without type definitions
import semver from 'next/dist/compiled/semver'
import { maybeReadPackageManifest, readPackageManifest } from '../utils/package-manifest'

function sortRecord<T extends Record<string, string>>(record: T): T {
  const entries = Object.keys(record)
    .sort()
    .map((key) => [key, record[key]] as const);
  return Object.fromEntries(entries) as T;
}

function resolveVersion(packageName: string): string {
  const manifest = readPackageManifest<{ version: string }>(packageName)
  return manifest.version
}

function maybeResolveVersion(packageName: string): string | null {
  const manifest = maybeReadPackageManifest<{ version: string }>(packageName)
  return manifest?.version ?? null
}

function resolveEslintVersion(): string {
  const eslintConfig = readPackageManifest<{ version: string; peerDependencies?: Record<string, string> }>('eslint-config-next')
  const peerRange = eslintConfig.peerDependencies?.eslint?.trim()
  const installedEslint = maybeReadPackageManifest<{ version: string }>('eslint')?.version

  if (peerRange) {
    if (installedEslint && !semver.satisfies(installedEslint, peerRange)) {
      throw new Error(
        `Installed ESLint version ${installedEslint} does not satisfy eslint-config-next peer range ${peerRange}`
      )
    }
    return peerRange
  }

  if (installedEslint) {
    return installedEslint
  }

  throw new Error('Unable to determine ESLint version requirement for generated project')
}

export interface BuildPackageJsonOptions {
  projectName: string
}

export function buildPackageJson(options: BuildPackageJsonOptions): Record<string, unknown> {
  const dependencies: Record<string, string> = {
    '@prisma/client': resolveVersion('@prisma/client'),
    '@radix-ui/react-aspect-ratio': resolveVersion('@radix-ui/react-aspect-ratio'),
    '@radix-ui/react-accordion': resolveVersion('@radix-ui/react-accordion'),
    '@radix-ui/react-avatar': resolveVersion('@radix-ui/react-avatar'),
    '@radix-ui/react-checkbox': resolveVersion('@radix-ui/react-checkbox'),
    '@radix-ui/react-dialog': resolveVersion('@radix-ui/react-dialog'),
    '@radix-ui/react-icons': resolveVersion('@radix-ui/react-icons'),
    '@radix-ui/react-navigation-menu': resolveVersion('@radix-ui/react-navigation-menu'),
    '@radix-ui/react-select': resolveVersion('@radix-ui/react-select'),
    '@radix-ui/react-slot': resolveVersion('@radix-ui/react-slot'),
    '@radix-ui/react-switch': resolveVersion('@radix-ui/react-switch'),
    '@radix-ui/react-tabs': resolveVersion('@radix-ui/react-tabs'),
    '@radix-ui/react-tooltip': resolveVersion('@radix-ui/react-tooltip'),
    clsx: resolveVersion('clsx'),
    'class-variance-authority': resolveVersion('class-variance-authority'),
    cmdk: resolveVersion('cmdk'),
    'isomorphic-dompurify': resolveVersion('isomorphic-dompurify'),
    'lucide-react': resolveVersion('lucide-react'),
    next: resolveVersion('next'),
    react: resolveVersion('react'),
    'react-hook-form': resolveVersion('react-hook-form'),
    'react-dom': resolveVersion('react-dom'),
    'react-error-boundary': resolveVersion('react-error-boundary'),
    'react-virtualized-auto-sizer': resolveVersion('react-virtualized-auto-sizer'),
    'react-window': resolveVersion('react-window'),
    'react-window-infinite-loader': resolveVersion('react-window-infinite-loader'),
    'tailwind-merge': resolveVersion('tailwind-merge'),
    'tailwindcss-animate': resolveVersion('tailwindcss-animate'),
    zod: resolveVersion('zod')
  }

  const devDependencies: Record<string, string> = {
    autoprefixer: resolveVersion('autoprefixer'),
    '@types/node': resolveVersion('@types/node'),
    '@types/react': resolveVersion('@types/react'),
    '@types/react-dom': resolveVersion('@types/react-dom'),
    eslint: resolveEslintVersion(),
    'eslint-config-next': resolveVersion('eslint-config-next'),
    postcss: resolveVersion('postcss'),
    prisma: resolveVersion('prisma'),
    tailwindcss: resolveVersion('tailwindcss'),
    typescript: resolveVersion('typescript')
  }

  const optionalSwcPackages = [
    '@next/swc-darwin-arm64',
    '@next/swc-darwin-x64',
    '@next/swc-linux-arm64-gnu',
    '@next/swc-linux-arm64-musl',
    '@next/swc-linux-x64-gnu',
    '@next/swc-linux-x64-musl',
    '@next/swc-win32-arm64-msvc',
    '@next/swc-win32-x64-msvc'
  ] as const

  const optionalDependencies: Record<string, string> = optionalSwcPackages.reduce(
    (acc, pkg) => {
      const version = maybeResolveVersion(pkg)
      if (!version) {
        return acc
      }

      acc[pkg] = version
      return acc
    },
    {} as Record<string, string>
  )

  const scripts: Record<string, string> = {
    postinstall: 'prisma generate --schema=./lib/generated/prisma/schema.prisma',
    dev: 'next dev',
    build: 'prisma generate --schema=./lib/generated/prisma/schema.prisma && next build',
    start: 'next start',
    lint: 'next lint',
    'deploy:vercel': 'node scripts/deploy.mjs',
    'deploy:preview': 'node scripts/deploy.mjs preview'
  }

  return {
    name: options.projectName,
    version: '0.1.0',
    private: true,
    scripts,
    dependencies: sortRecord(dependencies),
    devDependencies: sortRecord(devDependencies),
    optionalDependencies: sortRecord(optionalDependencies)
  }
}
