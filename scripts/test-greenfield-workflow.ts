/**
 * Test script to verify greenfield workflow triggering
 *
 * This script manually triggers the workflow to debug the issue where
 * new AI Build websites have 0 pages.
 *
 * Usage: npx tsx scripts/test-greenfield-workflow.ts [websiteId]
 */

// Load environment variables first (shared utility ensures override: true)
import './lib/load-env'

import { PrismaClient } from '../lib/generated/prisma'

const prisma = new PrismaClient()

async function testBootstrap(websiteId: string) {
  console.log('\n=== Testing Greenfield Workflow ===\n')

  // 1. Verify website exists
  const website = await prisma.website.findUnique({
    where: { id: websiteId },
    select: {
      id: true,
      name: true,
      accountId: true,
      metadata: true
    }
  })

  if (!website) {
    console.error(`Website ${websiteId} not found`)
    await prisma.$disconnect()
    return
  }

  console.log('Website found:', {
    id: website.id,
    name: website.name,
    accountId: website.accountId,
    metadata: website.metadata
  })

  // 2. Check existing pages
  const pages = await prisma.websitePage.findMany({
    where: { websiteId },
    select: { id: true, title: true }
  })

  console.log(`\nExisting pages: ${pages.length}`)
  pages.forEach(p => console.log(`  - ${p.title} (${p.id})`))

  // 3. Check content types
  const contentTypes = await prisma.contentType.findMany({
    where: { websiteId },
    select: { id: true, name: true, category: true }
  })

  console.log(`\nContent types: ${contentTypes.length}`)
  contentTypes.forEach(ct => console.log(`  - ${ct.name} (${ct.category}): ${ct.id}`))

  // 4. Check env vars needed for workflow
  console.log('\n=== Environment Check ===')
  console.log('OPENROUTER_API_KEY:', process.env.OPENROUTER_API_KEY ? 'SET' : 'NOT SET')
  console.log('OPENROUTER_BASE_URL:', process.env.OPENROUTER_BASE_URL || 'default (openrouter.ai)')
  console.log('OPENROUTER_MODEL:', process.env.OPENROUTER_MODEL || 'default')
  console.log('VERCEL_URL:', process.env.VERCEL_URL || 'NOT SET (local dev)')
  console.log('VERCEL_AUTOMATION_BYPASS_SECRET:', process.env.VERCEL_AUTOMATION_BYPASS_SECRET ? 'SET' : 'NOT SET')

  // 5. Try to import the workflow module
  console.log('\n=== Module Import Test ===')
  try {
    const { GreenfieldBootstrapper } = await import('../lib/studio/ai/greenfield-bootstrapper')
    console.log('GreenfieldBootstrapper imported successfully')

    const bootstrapper = new GreenfieldBootstrapper()
    console.log('GreenfieldBootstrapper instantiated')

    // Get metadata to extract original prompt
    const meta = website.metadata as { originalPrompt?: string } | null
    const originalPrompt = meta?.originalPrompt || 'Test website for debugging'

    console.log('\n=== Starting Bootstrap (this will take a while) ===')
    console.log('Original prompt:', originalPrompt.substring(0, 100) + '...')

    const startTime = Date.now()
    const result = await bootstrapper.bootstrapWebsite({
      websiteId,
      accountId: website.accountId,
      originalPrompt,
      processedPrompt: {
        websiteName: website.name || 'Test Website',
        description: originalPrompt,
        category: 'page',
        suggestedFeatures: [],
        technicalRequirements: [],
        targetAudience: 'General audience'
      }
    })

    const duration = ((Date.now() - startTime) / 1000).toFixed(1)

    console.log('\n=== Bootstrap Result ===')
    console.log('Duration:', duration, 'seconds')
    console.log('Success:', result.success)
    console.log('Pages created:', result.pagesCreated)
    console.log('Populated pages:', result.populatedPages)
    console.log('Error:', result.error || 'none')

    // Check pages again
    const finalPages = await prisma.websitePage.findMany({
      where: { websiteId },
      select: { id: true, title: true }
    })

    console.log(`\nFinal page count: ${finalPages.length}`)
    finalPages.forEach(p => console.log(`  - ${p.title} (${p.id})`))

  } catch (error) {
    console.error('Import/execution error:', error)
  }

  await prisma.$disconnect()
}

// Get websiteId from command line or use a recent one
const websiteId = process.argv[2]

if (!websiteId) {
  // Find the most recent AI Build website with 0 pages
  prisma.website.findFirst({
    where: {
      metadata: {
        path: ['createdViaAI'],
        equals: true
      }
    },
    orderBy: { createdAt: 'desc' },
    select: { id: true, name: true }
  }).then(async (recent) => {
    if (recent) {
      console.log(`No websiteId provided. Using most recent AI Build site: ${recent.name} (${recent.id})`)
      await testBootstrap(recent.id)
    } else {
      console.log('No AI Build websites found. Please provide a websiteId.')
      await prisma.$disconnect()
    }
  })
} else {
  testBootstrap(websiteId)
}
