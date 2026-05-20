#!/usr/bin/env tsx
/**
 * Build Sandbox Tarball
 *
 * Creates a pre-built tarball of the standalone HEAD for sandbox deployments.
 * This script is run during the build process to create a website-agnostic
 * tarball that can be quickly deployed to Vercel Sandbox instances.
 *
 * TKT-084: Vercel Blob Storage Migration
 * - Uploads to Vercel Blob for cheaper data transfer ($0.06/GB vs $0.15/GB)
 * - Falls back to Supabase S3 if BLOB_READ_WRITE_TOKEN not set
 *
 * Usage:
 *   pnpm tsx scripts/build-sandbox-tarball.ts
 *
 * Output:
 *   Uploads to Vercel Blob: sandbox-template.tar.gz
 *   Public URL stored in VERCEL_BLOB_TARBALL_URL env var for sandbox-manager
 */

import { execSync, spawnSync } from 'child_process'
import * as fs from 'fs'
import * as path from 'path'
import * as tar from 'tar'
import { put } from '@vercel/blob'
import { S3Client } from '@aws-sdk/client-s3'
import { Upload } from '@aws-sdk/lib-storage'
import { config } from 'dotenv'

// Load environment variables from .env.local
config({ path: '.env.local' })

const ROOT_DIR = process.cwd()
const TEMP_DIR = path.join(ROOT_DIR, 'tmp', 'sandbox-build')
const OUTPUT_FILE = path.join(ROOT_DIR, 'tmp', 'sandbox-template.tar.gz') // Temp location, not public

// Vercel Blob configuration
const BLOB_READ_WRITE_TOKEN = process.env.BLOB_READ_WRITE_TOKEN
const BLOB_FILENAME = 'sandbox-template.tar.gz'

// S3 configuration from environment (fallback)
const S3_BUCKET = process.env.STUDIO_MEDIA_STORAGE_S3_BUCKET || 'Catalyst Studio'
const S3_REGION = process.env.STUDIO_MEDIA_STORAGE_S3_REGION || 'ap-southeast-2'
const S3_ENDPOINT = process.env.STUDIO_MEDIA_STORAGE_S3_ENDPOINT
const S3_PUBLIC_BASE_URL = process.env.STUDIO_MEDIA_STORAGE_S3_PUBLIC_BASE_URL
const S3_ACCESS_KEY_ID = process.env.STUDIO_MEDIA_STORAGE_S3_ACCESS_KEY_ID
const S3_SECRET_ACCESS_KEY = process.env.STUDIO_MEDIA_STORAGE_S3_SECRET_ACCESS_KEY
const S3_KEY = 'sandbox-templates/sandbox-template.tar.gz'

// Files/patterns to exclude from tarball
// NOTE: We INCLUDE node_modules AND .next to create a pre-compiled, ready-to-run sandbox
// This eliminates both npm install AND next build at runtime
// IMPORTANT: Do NOT exclude .node files - both Next.js SWC and Prisma need them!
const EXCLUDE_PATTERNS = [
  // We now INCLUDE Prisma binaries (Linux ones downloaded during build)
  // Only exclude Windows/macOS Prisma binaries
  /libquery_engine-windows/,
  /libquery_engine-darwin/,
  // We now INCLUDE .next build output for pre-compiled production mode
  // /^\.next/,  // REMOVED - we want to include the build
  /^dist$/,  // Only root dist folder, not node_modules/**/dist
  // Git
  /^\.git/,
  /\/\.git\//,
  // Test files
  /\.test\.tsx?$/,
  /__tests__/,
  // Other large/unnecessary files
  /^\.vercel/,
  /\/\.vercel\//,
  /^coverage/,
  /\/coverage\//,
  /^\.turbo/,
  /\/\.turbo\//,
  // Tarball itself (if it exists from previous build)
  /sandbox-template\.tar\.gz$/,
  // Cache directories inside node_modules
  /node_modules\/\.cache/,
  // Next.js cache (webpack cache, fetch cache) - not needed for production
  /^\.next\/cache/,
  // TypeScript build info files
  /\.tsbuildinfo$/,
  // Windows-only SWC binaries (sandbox runs on Linux, doesn't need Windows binaries)
  /@next\/swc-win32/,
  /@next\/swc-darwin/,  // Also exclude macOS binaries
]

function log(message: string): void {
  console.log(`[build-sandbox-tarball] ${message}`)
}

function run(cmd: string, cwd?: string): void {
  log(`Running: ${cmd}`)
  execSync(cmd, { stdio: 'inherit', cwd: cwd || ROOT_DIR, shell: true })
}

function shouldExclude(filePath: string): boolean {
  return EXCLUDE_PATTERNS.some(pattern => pattern.test(filePath))
}

async function createTarball(sourceDir: string, outputPath: string): Promise<void> {
  log(`Creating tarball from ${sourceDir} to ${outputPath}`)

  // Collect all files to include
  const files: string[] = []
  // Track which files should be executable (for node_modules/.bin)
  const executablePaths = new Set<string>()

  function walkDir(dir: string, relativePath: string = ''): void {
    const entries = fs.readdirSync(dir, { withFileTypes: true })
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name)
      const relPath = relativePath ? `${relativePath}/${entry.name}` : entry.name

      if (shouldExclude(relPath)) {
        continue
      }

      if (entry.isDirectory()) {
        walkDir(fullPath, relPath)
      } else {
        files.push(relPath)
        // Mark node_modules/.bin files as executable
        // Also mark .node files (native binaries) as executable
        if (
          relPath.includes('node_modules/.bin/') ||
          relPath.endsWith('.node')
        ) {
          executablePaths.add(relPath)
        }
      }
    }
  }

  walkDir(sourceDir)
  log(`Found ${files.length} files to include in tarball`)
  log(`Found ${executablePaths.size} files that need executable permission`)

  // Create tar.gz using the tar package
  // Note: On Windows, we can't set Unix permissions directly, but we can use
  // the 'portable' mode which sets reasonable defaults, then fix permissions
  // after extraction in the sandbox
  await tar.create(
    {
      gzip: true,
      file: outputPath,
      cwd: sourceDir,
      portable: true, // Use portable mode for cross-platform compatibility
    },
    files
  )
}

/**
 * Upload tarball to Vercel Blob
 * Returns the public URL of the uploaded blob
 */
async function uploadToVercelBlob(filePath: string): Promise<string> {
  log('Uploading tarball to Vercel Blob...')
  const uploadStart = Date.now()

  const fileBuffer = fs.readFileSync(filePath)

  const blob = await put(BLOB_FILENAME, fileBuffer, {
    access: 'public',
    token: BLOB_READ_WRITE_TOKEN,
    addRandomSuffix: false, allowOverwrite: true, // Use consistent filename for easy reference
  })

  const uploadTime = ((Date.now() - uploadStart) / 1000).toFixed(1)
  log(`Uploaded to Vercel Blob in ${uploadTime}s`)
  log(`Public URL: ${blob.url}`)

  return blob.url
}

/**
 * Upload tarball to Supabase S3 (fallback)
 * Returns the public URL of the uploaded file
 */
async function uploadToS3(filePath: string): Promise<string> {
  log('Uploading tarball to Supabase S3 (fallback)...')
  const uploadStart = Date.now()

  const s3Client = new S3Client({
    region: S3_REGION,
    endpoint: S3_ENDPOINT,
    forcePathStyle: true,
    credentials: {
      accessKeyId: S3_ACCESS_KEY_ID!,
      secretAccessKey: S3_SECRET_ACCESS_KEY!,
    },
  })

  // Use multipart upload for large files (680MB+)
  const fileStream = fs.createReadStream(filePath)
  const upload = new Upload({
    client: s3Client,
    params: {
      Bucket: S3_BUCKET,
      Key: S3_KEY,
      Body: fileStream,
      ContentType: 'application/gzip',
    },
    partSize: 10 * 1024 * 1024, // 10 MB per part
    queueSize: 4, // Concurrent uploads
  })

  // Log progress
  upload.on('httpUploadProgress', (progress) => {
    if (progress.loaded && progress.total) {
      const percent = Math.round((progress.loaded / progress.total) * 100)
      log(`Upload progress: ${percent}% (${(progress.loaded / (1024 * 1024)).toFixed(1)}/${(progress.total / (1024 * 1024)).toFixed(1)} MB)`)
    }
  })

  await upload.done()

  const uploadTime = ((Date.now() - uploadStart) / 1000).toFixed(1)
  log(`Uploaded to S3 in ${uploadTime}s`)

  // Build the public URL
  const publicUrl = S3_PUBLIC_BASE_URL
    ? `${S3_PUBLIC_BASE_URL}/${S3_KEY}`
    : `https://${S3_BUCKET}.s3.${S3_REGION}.amazonaws.com/${S3_KEY}`
  log(`Public URL: ${publicUrl}`)

  return publicUrl
}

async function main(): Promise<void> {
  log('Starting sandbox tarball build...')

  // Clean up previous builds
  if (fs.existsSync(TEMP_DIR)) {
    log(`Cleaning up ${TEMP_DIR}`)
    fs.rmSync(TEMP_DIR, { recursive: true })
  }
  fs.mkdirSync(TEMP_DIR, { recursive: true })

  // Ensure output directory exists
  const outputDir = path.dirname(OUTPUT_FILE)
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true })
  }

  // Step 1: Generate standalone HEAD
  log('Generating standalone HEAD...')
  run(`pnpm tsx scripts/generate-head/index.ts --provider standalone --website-id PLACEHOLDER --output "${TEMP_DIR}" --force --copy-env`)

  // Step 2: Check that schema.prisma exists (required for prisma generate)
  const schemaPath = path.join(TEMP_DIR, 'lib', 'generated', 'prisma', 'schema.prisma')
  if (!fs.existsSync(schemaPath)) {
    throw new Error(`Missing schema.prisma at ${schemaPath}`)
  }
  log('Verified schema.prisma exists')

  // Step 3: Install dependencies (node_modules will be included in tarball)
  // This saves ~57 seconds in sandbox by eliminating npm install at runtime
  log('Installing dependencies (will be included in tarball)...')
  const installStart = Date.now()
  run('npm install', TEMP_DIR)
  const installTime = ((Date.now() - installStart) / 1000).toFixed(1)
  log(`Dependencies installed in ${installTime}s`)

  // Step 3b: Install Linux SWC binaries for Vercel Sandbox
  // The sandbox runs on Linux, but npm install on Windows doesn't download cross-platform binaries
  // We manually download and extract the Linux binaries using npm pack + tar
  log('Installing Linux SWC binaries for sandbox compatibility...')

  const swcPackages = [
    '@next/swc-linux-x64-gnu',
    '@next/swc-linux-x64-musl',
  ]

  for (const pkg of swcPackages) {
    const pkgName = pkg.replace('@next/', '')
    log(`Downloading ${pkg}...`)

    // Get the version of Next.js installed
    const nextPkgPath = path.join(TEMP_DIR, 'node_modules', 'next', 'package.json')
    const nextPkg = JSON.parse(fs.readFileSync(nextPkgPath, 'utf-8'))
    let nextVersion = nextPkg.version

    // Try to download exact version, fall back to compatible version if not found
    // Some Next.js patch versions (e.g., 15.4.10) don't have corresponding SWC packages
    try {
      execSync(`npm pack ${pkg}@${nextVersion}`, { cwd: TEMP_DIR, stdio: 'pipe' })
    } catch {
      // Try stripping patch version and finding nearest match
      const [major, minor] = nextVersion.split('.')
      const fallbackVersion = `${major}.${minor}.8` // Use .8 as safe fallback
      log(`Version ${nextVersion} not found for ${pkg}, trying ${fallbackVersion}...`)
      nextVersion = fallbackVersion
      execSync(`npm pack ${pkg}@${nextVersion}`, { cwd: TEMP_DIR, stdio: 'pipe' })
    }

    // Find the downloaded tarball
    const tarballName = `next-${pkgName}-${nextVersion}.tgz`
    const tarballPath = path.join(TEMP_DIR, tarballName)

    // Create the target directory
    const targetDir = path.join(TEMP_DIR, 'node_modules', '@next', pkgName)
    fs.mkdirSync(targetDir, { recursive: true })

    // Extract the tarball using Node.js tar package (cross-platform)
    await tar.extract({
      file: tarballPath,
      cwd: targetDir,
      strip: 1, // Remove 'package/' prefix
    })

    // Clean up tarball
    fs.unlinkSync(tarballPath)
    log(`Installed ${pkg}@${nextVersion}`)
  }

  log('Linux SWC binaries installed')

  // Step 3c: Fix execute permissions on node_modules/.bin scripts
  // Windows doesn't preserve Unix permissions in tarballs, so we need to mark
  // all bin scripts as executable (mode 0755) for Linux
  log('Setting executable permissions on bin scripts...')
  const binDir = path.join(TEMP_DIR, 'node_modules', '.bin')
  if (fs.existsSync(binDir)) {
    const binFiles = fs.readdirSync(binDir)
    log(`Found ${binFiles.length} files in node_modules/.bin`)
    // We can't actually set Unix permissions on Windows, but we can track which
    // files need to be executable and handle this in the tar creation
  }

  // Step 4: Generate Prisma client with Linux binaries
  // We need to modify the schema to specify binaryTargets for Linux
  log('Generating Prisma client with Linux binaries...')
  const prismaStart = Date.now()

  // Modify schema.prisma to add Linux binary target and engineType
  const schemaContent = fs.readFileSync(schemaPath, 'utf-8')
  const modifiedSchema = schemaContent.replace(
    /generator\s+client\s*\{([^}]*)\}/,
    (match, inner) => {
      // Check if binaryTargets already exists
      if (inner.includes('binaryTargets')) {
        return match // Don't modify if already present
      }
      // Add binaryTargets for Linux (rhel-openssl-3.0.x is what Vercel Sandbox uses)
      // Add engineType = "library" to explicitly use bundled query engine (suppresses --no-engine warning)
      return `generator client {${inner}  binaryTargets = ["native", "rhel-openssl-3.0.x"]\n  engineType = "library"\n}`
    }
  )
  fs.writeFileSync(schemaPath, modifiedSchema)
  log('Modified schema.prisma to include Linux binary target and engineType')

  // Run prisma generate
  execSync('npx prisma generate --schema=./lib/generated/prisma/schema.prisma', {
    cwd: TEMP_DIR,
    stdio: 'inherit',
  })

  const prismaTime = ((Date.now() - prismaStart) / 1000).toFixed(1)
  log(`Prisma client generated in ${prismaTime}s`)

  // Verify Linux binary exists in node_modules/.prisma/client
  const prismaClientDir = path.join(TEMP_DIR, 'node_modules', '.prisma', 'client')
  if (fs.existsSync(prismaClientDir)) {
    const clientFiles = fs.readdirSync(prismaClientDir)
    const linuxBinary = clientFiles.find(f => f.includes('rhel') || f.includes('linux'))
    if (linuxBinary) {
      log(`Found Linux Prisma binary: ${linuxBinary}`)
    } else {
      log('WARNING: No Linux Prisma binary found in .prisma/client')
      log(`Files: ${clientFiles.join(', ')}`)
    }
  }

  // Also check lib/generated/prisma for query engine
  const libPrismaDir = path.join(TEMP_DIR, 'lib', 'generated', 'prisma')
  if (fs.existsSync(libPrismaDir)) {
    const libFiles = fs.readdirSync(libPrismaDir)
    const queryEngines = libFiles.filter(f => f.includes('query') || f.endsWith('.node'))
    if (queryEngines.length > 0) {
      log(`Found query engines in lib/generated/prisma: ${queryEngines.join(', ')}`)
    }
  }

  // Step 4b: Build Next.js for production
  // This pre-compiles all pages so we can use 'npm start' instead of 'npm run dev'
  log('Building Next.js for production (this may take a minute)...')
  const buildStart = Date.now()

  // Write a placeholder .env.local for the build (will be overwritten at runtime)
  fs.writeFileSync(
    path.join(TEMP_DIR, '.env.local'),
    `# Placeholder for build - will be replaced at sandbox runtime
HEAD_RUNTIME_WEBSITE_ID=PLACEHOLDER
HEAD_RUNTIME_PROVIDER=ucs
DATABASE_URL=""
DIRECT_URL=""
`
  )

  execSync('npm run build', {
    cwd: TEMP_DIR,
    stdio: 'inherit',
    env: {
      ...process.env,
      NODE_ENV: 'production',
    },
  })

  const buildTime = ((Date.now() - buildStart) / 1000).toFixed(1)
  log(`Next.js build completed in ${buildTime}s`)

  // Verify .next directory exists
  const nextDir = path.join(TEMP_DIR, '.next')
  if (!fs.existsSync(nextDir)) {
    throw new Error('.next directory not found after build')
  }
  log('.next build output verified')

  // Step 5: Create tarball using Node.js tar package (cross-platform)
  log('Creating compressed tarball (includes node_modules)...')
  await createTarball(TEMP_DIR, OUTPUT_FILE)

  // Step 6: Report size and upload
  const stats = fs.statSync(OUTPUT_FILE)
  const sizeMB = (stats.size / (1024 * 1024)).toFixed(2)
  log(`Tarball created: ${OUTPUT_FILE}`)
  log(`Size: ${sizeMB} MB`)

  // Upload to storage
  let publicUrl: string

  // TKT-084: Prefer Vercel Blob (cheaper transfer costs)
  if (BLOB_READ_WRITE_TOKEN) {
    publicUrl = await uploadToVercelBlob(OUTPUT_FILE)
    log('')
    log('='.repeat(70))
    log('IMPORTANT: Set this env var in Vercel for sandbox-manager to use:')
    log(`VERCEL_BLOB_TARBALL_URL=${publicUrl}`)
    log('='.repeat(70))
  } else if (S3_ACCESS_KEY_ID && S3_SECRET_ACCESS_KEY) {
    log('WARNING: BLOB_READ_WRITE_TOKEN not set, falling back to Supabase S3')
    log('For cheaper transfer costs ($0.06/GB vs $0.15/GB), set BLOB_READ_WRITE_TOKEN')
    publicUrl = await uploadToS3(OUTPUT_FILE)
  } else {
    log('WARNING: No storage credentials found, skipping upload')
    log('Set BLOB_READ_WRITE_TOKEN for Vercel Blob (recommended)')
    log('Or set STUDIO_MEDIA_STORAGE_S3_ACCESS_KEY_ID and STUDIO_MEDIA_STORAGE_S3_SECRET_ACCESS_KEY for S3')
    publicUrl = OUTPUT_FILE
  }

  // Step 7: Clean up temp files
  log('Cleaning up temp files...')
  fs.rmSync(TEMP_DIR, { recursive: true })
  if (fs.existsSync(OUTPUT_FILE)) {
    fs.unlinkSync(OUTPUT_FILE) // Remove local tarball
  }

  log('Done!')
  log(`Tarball URL: ${publicUrl}`)
}

main().catch(err => {
  console.error('[build-sandbox-tarball] Error:', err)
  process.exit(1)
})
