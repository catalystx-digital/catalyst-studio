#!/usr/bin/env npx tsx
import * as dotenv from 'dotenv'
import * as path from 'path'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local'), quiet: true })

interface Args {
  websiteId: string
  url: string
  jobId?: string
}

function parseArgs(argv: string[]): Args {
  const args: Partial<Args> = {}

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === '--website-id' && argv[index + 1]) {
      args.websiteId = argv[++index]
    } else if (arg === '--url' && argv[index + 1]) {
      args.url = argv[++index]
    } else if (arg === '--job-id' && argv[index + 1]) {
      args.jobId = argv[++index]
    } else if (arg === '--help' || arg === '-h') {
      printUsage()
      process.exit(0)
    }
  }

  if (!args.websiteId || !args.url) {
    printUsage()
    process.exit(1)
  }

  return args as Args
}

function printUsage(): void {
  console.error('Usage:')
  console.error('  npx tsx scripts/regenerate-design-system.ts --website-id <id> --url <url> [--job-id <id>]')
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2))

  const [{ PrismaClient }, { importDesignSystemFromUrl }] = await Promise.all([
    import('../lib/generated/prisma'),
    import('../lib/studio/design-system/import-design-system'),
  ])

  const prisma = new PrismaClient()

  try {
    const result = await importDesignSystemFromUrl(
      {
        websiteId: args.websiteId,
        url: args.url,
        jobId: args.jobId,
        useNewFormat: true,
        onProgress: progress => {
          console.error(`[design-system] ${progress.stageProgress ?? 0}% ${progress.message}`)
        },
      },
      { prisma }
    )

    if (!result.success) {
      throw new Error(`Design system import failed: ${result.errors.join('; ') || 'unknown error'}`)
    }

    if (!result.persistedId) {
      throw new Error('Design system import did not persist a WebsiteDesignSystem record')
    }

    const variables = result.shadcnTokens?.variables
    if (!variables?.['--background'] || !variables?.['--foreground']) {
      throw new Error('Design system import did not produce semantic --background and --foreground tokens')
    }

    const current = await prisma.websiteDesignSystem.findFirst({
      where: {
        websiteId: args.websiteId,
        isCurrent: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
      select: {
        id: true,
        createdAt: true,
        updatedAt: true,
        isCurrent: true,
        tokens: true,
        sourceJobId: true,
      },
    })

    console.log(JSON.stringify({
      success: true,
      designSystemId: result.persistedId,
      conceptId: result.conceptId,
      conceptName: result.conceptName,
      storageFormat: result.storageFormat,
      metrics: result.metrics,
      warnings: result.warnings,
      current,
    }, null, 2))
  } finally {
    await prisma.$disconnect()
  }
}

main().catch(error => {
  console.error('[design-system] failed')
  console.error(error)
  process.exit(1)
})
