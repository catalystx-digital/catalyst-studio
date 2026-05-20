import { PrismaClient } from '@/lib/generated/prisma'

const prisma = new PrismaClient()

async function checkTestWebsiteData() {
  try {
    console.log('=== Checking test-website data ===\n')
    
    // 1. Check if website exists
    const website = await prisma.website.findFirst({
      where: { id: 'test-website' },
      include: {
        contentTypes: true,
        websitePages: true,
        websiteStructures: true,
        websiteComponentTypes: true,
        websiteSharedComponents: true
      }
    })
    
    if (!website) {
      console.log('❌ Website "test-website" not found in database')
      return
    }
    
    console.log('✅ Website found:', {
      id: website.id,
      name: website.name,
      category: website.category
    })
    
    // 2. Check content types
    console.log('\n📋 Content Types:', website.contentTypes.length)
    website.contentTypes.forEach(ct => {
      console.log(`  - ${ct.name} (${ct.category}): ${ct.key}`)
    })
    
    // 3. Check pages
    console.log('\n📄 Website Pages:', website.websitePages.length)
    website.websitePages.forEach(page => {
      console.log(`  - ${page.title} (${page.type}): ${page.id}`)
      if (page.content) {
        console.log(`    Content: ${JSON.stringify(page.content).substring(0, 100)}...`)
      }
    })
    
    // 4. Check website structures
    console.log('\n🏗️ Website Structures:', website.websiteStructures.length)
    const structures = await prisma.websiteStructure.findMany({
      where: { websiteId: 'test-website' },
      orderBy: { position: 'asc' }
    })
    
    structures.forEach(struct => {
      console.log(`  - ${struct.slug}:`)
      console.log(`    Path: ${struct.fullPath}`)
      console.log(`    Parent: ${struct.parentId || 'root'}`)
      console.log(`    Position: ${struct.position}`)
      console.log(`    PageId: ${struct.websitePageId || 'none'}`)
    })
    
    // 5. Check component types
    console.log('\n🧩 Component Types:', website.websiteComponentTypes.length)
    website.websiteComponentTypes.forEach(ct => {
      console.log(`  - ${ct.type} (${ct.category})`)
    })
    
    // 6. Check shared components
    console.log('\n🔗 Shared Components:', website.websiteSharedComponents.length)
    website.websiteSharedComponents.forEach(sc => {
      console.log(`  - ${sc.id}`)
    })
    
  } catch (error) {
    console.error('Error checking data:', error)
  } finally {
    await prisma.$disconnect()
  }
}

checkTestWebsiteData()