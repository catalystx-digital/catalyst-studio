/**
 * Database Write Timing Test
 *
 * Tests the performance of page creation in different modes to diagnose
 * import persist bottlenecks.
 *
 * Usage:
 *   npx tsx scripts/test-db-write-timing.ts
 *   npx tsx scripts/test-db-write-timing.ts --website-id <id> --content-type-id <id>
 *
 * Created for TKT-063 investigation. Key findings:
 * - P6005 error was caused by timeout: 180000ms exceeding Prisma Accelerate's 15000ms limit
 * - This is a CONFIG error, not an actual timeout - Accelerate rejects the parameter
 * - Local DB writes are fast (~500ms for 5 pages in transaction)
 * - The fix: change timeout to 14000ms in page-builder-service.ts
 *
 * @see docs/tickets/current/TKT-063-import-persist-timeout/work.md
 */

import { prisma } from '../lib/prisma'

interface TestConfig {
  websiteId: string
  contentTypeId: string
  pageCount: number
  componentCount: number
}

async function findDefaultWebsite(): Promise<{ websiteId: string; contentTypeId: string }> {
  const website = await prisma.website.findFirst({
    where: { contentTypes: { some: {} } },
    include: { contentTypes: true }
  })

  if (!website || website.contentTypes.length === 0) {
    throw new Error('No website with content types found. Run an import first.')
  }

  const contentType = website.contentTypes.find(ct => ct.name === 'Generic Content Page') || website.contentTypes[0]

  return {
    websiteId: website.id,
    contentTypeId: contentType.id
  }
}

function createMockContent(componentCount: number) {
  return {
    components: Array.from({ length: componentCount }, (_, i) => ({
      id: `component-${i}-${Date.now()}`,
      type: i === 0 ? 'hero' : 'content-section',
      parentId: null,
      position: i,
      props: {
        title: `Section ${i}`,
        content: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. '.repeat(20),
        image: 'https://example.com/image.jpg',
        cta: { text: 'Learn More', href: '/learn-more' }
      },
      children: []
    })),
    metadata: {
      totalComponents: componentCount,
      maxDepth: 1,
      componentTypes: ['hero', 'content-section']
    }
  }
}

async function runTimingTests(config: TestConfig) {
  const { websiteId, contentTypeId, pageCount, componentCount } = config

  console.log('=== Database Write Timing Test ===\n')
  console.log(`Website ID: ${websiteId}`)
  console.log(`Content Type ID: ${contentTypeId}`)
  console.log(`Pages to create: ${pageCount}`)
  console.log(`Components per page: ${componentCount}`)

  const content = createMockContent(componentCount)
  const contentSize = JSON.stringify(content).length
  console.log(`Content size per page: ${(contentSize / 1024).toFixed(2)} KB\n`)

  const createdIds: string[] = []
  const timestamp = Date.now()

  try {
    // Test 1: Sequential writes (no transaction)
    console.log(`--- Test 1: ${pageCount} sequential writes (no transaction) ---`)
    let start = performance.now()
    for (let i = 0; i < pageCount; i++) {
      const p = await prisma.websitePage.create({
        data: {
          websiteId,
          contentTypeId,
          type: 'page',
          title: `Timing Test Seq ${timestamp}-${i}`,
          content,
          metadata: { test: true, timestamp: new Date().toISOString() },
          templateKey: 'generic-page',
          status: 'draft',
        }
      })
      createdIds.push(p.id)
    }
    const seqTime = performance.now() - start
    console.log(`Total: ${seqTime.toFixed(2)}ms`)
    console.log(`Average per write: ${(seqTime / pageCount).toFixed(2)}ms\n`)

    // Test 2: Writes in transaction (simulates createPagesInBatch)
    console.log(`--- Test 2: ${pageCount} writes in transaction ---`)
    start = performance.now()
    const txPages = await prisma.$transaction(async (tx) => {
      const created = []
      for (let i = 0; i < pageCount; i++) {
        const p = await tx.websitePage.create({
          data: {
            websiteId,
            contentTypeId,
            type: 'page',
            title: `Timing Test TX ${timestamp}-${i}`,
            content,
            metadata: { test: true, timestamp: new Date().toISOString() },
            templateKey: 'generic-page',
            status: 'draft',
          }
        })
        created.push(p)
      }
      return created
    }, {
      maxWait: 10000,
      timeout: 14000, // Prisma Accelerate limit is 15000ms
    })
    const txTime = performance.now() - start
    console.log(`Total: ${txTime.toFixed(2)}ms`)
    console.log(`Average per write: ${(txTime / pageCount).toFixed(2)}ms\n`)
    createdIds.push(...txPages.map(p => p.id))

    // Summary
    console.log('=== Results ===')
    console.log(`Sequential: ${seqTime.toFixed(0)}ms (${(seqTime / pageCount).toFixed(0)}ms/page)`)
    console.log(`Transaction: ${txTime.toFixed(0)}ms (${(txTime / pageCount).toFixed(0)}ms/page)`)

    if (txTime > 14000) {
      console.log('\n⚠️  WARNING: Transaction time exceeds 14s Prisma Accelerate limit!')
    } else if (txTime > 10000) {
      console.log('\n⚠️  CAUTION: Transaction time approaching limit')
    } else {
      console.log('\n✅ Transaction time is safe')
    }

  } finally {
    // Cleanup
    console.log('\n--- Cleanup ---')
    for (const id of createdIds) {
      await prisma.websitePage.delete({ where: { id } }).catch(() => {})
    }
    console.log(`Deleted ${createdIds.length} test pages`)
  }
}

// Parse CLI args
const args = process.argv.slice(2)
const getArg = (name: string) => {
  const idx = args.indexOf(`--${name}`)
  return idx !== -1 && args[idx + 1] ? args[idx + 1] : undefined
}

async function main() {
  const websiteIdArg = getArg('website-id')
  const contentTypeIdArg = getArg('content-type-id')
  const pageCount = parseInt(getArg('pages') || '5', 10)
  const componentCount = parseInt(getArg('components') || '8', 10)

  let websiteId: string
  let contentTypeId: string

  if (websiteIdArg && contentTypeIdArg) {
    websiteId = websiteIdArg
    contentTypeId = contentTypeIdArg
  } else {
    console.log('Finding a website with content types...\n')
    const defaults = await findDefaultWebsite()
    websiteId = defaults.websiteId
    contentTypeId = defaults.contentTypeId
  }

  await runTimingTests({ websiteId, contentTypeId, pageCount, componentCount })
}

main()
  .then(() => process.exit(0))
  .catch(e => {
    console.error('Error:', e)
    process.exit(1)
  })
