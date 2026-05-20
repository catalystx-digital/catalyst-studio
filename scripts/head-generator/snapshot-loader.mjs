import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const MODULE_PATH = fileURLToPath(import.meta.url)

export const STUB_SITE_SNAPSHOT = Object.freeze({
  site: {
    id: 'stub-site',
    name: 'Catalyst Demo Site (stub)',
    description: 'Fallback snapshot used when no file is provided.'
  },
  pages: []
})

export const SNAPSHOT_LOADER_ERROR_CODES = {
  MISSING_SNAPSHOT_PATH: 'MISSING_SNAPSHOT_PATH',
  SNAPSHOT_READ_FAILED: 'SNAPSHOT_READ_FAILED',
  SNAPSHOT_PARSE_FAILED: 'SNAPSHOT_PARSE_FAILED'
}

export class SnapshotLoaderError extends Error {
  constructor(message, code) {
    super(message)
    this.name = 'SnapshotLoaderError'
    this.code = code
  }
}

function normalizeMode(mode) {
  return (mode ?? 'stub').toLowerCase()
}

export async function loadSiteSnapshot(options = {}) {
  const { mode, snapshotPath } = options
  const normalizedMode = normalizeMode(mode)

  if (normalizedMode === 'snapshot') {
    if (!snapshotPath) {
      throw new SnapshotLoaderError(
        'Snapshot mode requires a snapshotPath option or --snapshot <file> CLI argument.',
        SNAPSHOT_LOADER_ERROR_CODES.MISSING_SNAPSHOT_PATH
      )
    }

    const absolutePath = resolve(process.cwd(), snapshotPath)

    let rawContents
    try {
      rawContents = await readFile(absolutePath, 'utf8')
    } catch (error) {
      throw new SnapshotLoaderError(
        `Unable to read snapshot file at ${absolutePath}: ${error.message}`,
        SNAPSHOT_LOADER_ERROR_CODES.SNAPSHOT_READ_FAILED
      )
    }

    try {
      return JSON.parse(rawContents)
    } catch (error) {
      throw new SnapshotLoaderError(
        `Snapshot file at ${absolutePath} is not valid JSON: ${error.message}`,
        SNAPSHOT_LOADER_ERROR_CODES.SNAPSHOT_PARSE_FAILED
      )
    }
  }

  return STUB_SITE_SNAPSHOT
}

function parseArgs(argv = []) {
  const result = {
    mode: undefined,
    snapshotPath: undefined,
    help: false
  }

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index]

    if (token === '--help' || token === '-h') {
      result.help = true
      continue
    }

    if (token === '--mode') {
      result.mode = argv[index + 1]
      index += 1
      continue
    }

    if (token.startsWith('--mode=')) {
      result.mode = token.split('=')[1]
      continue
    }

    if (token === '--snapshot') {
      result.snapshotPath = argv[index + 1]
      index += 1
      continue
    }

    if (token.startsWith('--snapshot=')) {
      result.snapshotPath = token.split('=')[1]
    }
  }

  return result
}

function printUsage() {
  console.log('Usage: node scripts/head-generator/snapshot-loader.mjs --mode <stub|snapshot> [--snapshot <file>]')
  console.log('')
  console.log('Options:')
  console.log('  --mode <value>       Loader mode. Use "snapshot" to read a JSON file or "stub" (default) for fallback data.')
  console.log('  --snapshot <file>    Absolute or relative path to a site snapshot JSON file (required for snapshot mode).')
  console.log('  --help               Show this message.')
}

async function runCli(argv = process.argv.slice(2)) {
  const { mode, snapshotPath, help } = parseArgs(argv)

  if (help) {
    printUsage()
    return
  }

  try {
    const snapshot = await loadSiteSnapshot({ mode, snapshotPath })
    console.log(JSON.stringify(snapshot, null, 2))
  } catch (error) {
    if (error instanceof SnapshotLoaderError) {
      if (error.code === SNAPSHOT_LOADER_ERROR_CODES.MISSING_SNAPSHOT_PATH) {
        console.error('Error: --snapshot <file> must be provided when --mode snapshot is used.')
        console.error('')
        printUsage()
      } else {
        console.error(`Error loading site snapshot: ${error.message}`)
      }
    } else {
      console.error(`Unexpected error loading site snapshot: ${error.message}`)
    }

    process.exitCode = 1
  }
}

if (process.argv[1] && resolve(process.argv[1]) === MODULE_PATH) {
  runCli().catch((error) => {
    console.error(`Unexpected error loading site snapshot: ${error.message}`)
    process.exit(1)
  })
}
