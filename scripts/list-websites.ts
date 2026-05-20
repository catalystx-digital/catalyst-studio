#!/usr/bin/env tsx
import { PrismaClient } from '@prisma/client'

async function listWebsites() {
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: process.env.DATABASE_URL
      }
    }
  })

  try {
    console.log('🔍 Fetching available websites from UCS database...')

    const websites = await prisma.website.findMany({
      select: {
        id: true,
        name: true,
        domain: true,
        isActive: true,
        createdAt: true
      },
      orderBy: {
        name: 'asc'
      }
    })

    if (websites.length === 0) {
      console.log('❌ No websites found in the database')
    } else {
      console.log(`✅ Found ${websites.length} websites:`)
      console.log('')

      websites.forEach(website => {
        const status = website.isActive ? '🟢 Active' : '🔴 Inactive'
        console.log(`  ${status} ${website.id}`)
        console.log(`      Name: ${website.name}`)
        console.log(`      Domain: ${website.domain || 'N/A'}`)
        console.log(`      Created: ${website.createdAt.toLocaleDateString()}`)
        console.log('')
      })

      console.log('💡 To validate a website, run:')
      console.log(`   pnpm tsx scripts/head-validator/index.ts --website-id <WEBSITE_ID> --provider ucs --force`)
      console.log('')
      console.log('Example with an active website:')
      const activeWebsite = websites.find(w => w.isActive)
      if (activeWebsite) {
        console.log(`   pnpm tsx scripts/head-validator/index.ts --website-id ${activeWebsite.id} --provider ucs --force`)
      }
    }
  } catch (error) {
    console.error('❌ Error connecting to database:', error instanceof Error ? error.message : String(error))
  } finally {
    await prisma.$disconnect()
  }
}

listWebsites()