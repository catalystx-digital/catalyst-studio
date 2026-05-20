import { PrismaClient, WebsitePage } from '../../../lib/generated/prisma'

/**
 * Creates WebsiteStructure entries for all pages
 * Establishes hierarchical relationships and URL paths
 */
export async function createWebsiteStructures(
  prisma: PrismaClient,
  websiteId: string,
  pages: WebsitePage[]
): Promise<number> {
  try {
    // Map pages by title for easy lookup
    const pageMap = new Map<string, WebsitePage>()
    pages.forEach(page => {
      pageMap.set(page.title, page)
    })

    // Create root structure for Home page
    const homeStructure = await prisma.websiteStructure.create({
      data: {
        websiteId,
        slug: 'home',
        fullPath: '/home',
        websitePageId: pageMap.get('Home')?.id || null,
        parentId: null,
        position: 0,
        pathDepth: 0,
        weight: 0
      }
    })
    console.log('✅ Created root structure: /home')

    // Create level 1: Products under home
    const productsStructure = await prisma.websiteStructure.create({
      data: {
        websiteId,
        slug: 'products',
        fullPath: '/home/products',
        websitePageId: pageMap.get('Products')?.id || null,
        parentId: homeStructure.id,
        position: 0,
        pathDepth: 1,
        weight: 0
      }
    })
    console.log('✅ Created structure: /home/products')

    // Create level 2: Featured under products
    const featuredStructure = await prisma.websiteStructure.create({
      data: {
        websiteId,
        slug: "featured",
        fullPath: '/home/products/featured',
        websitePageId: pageMap.get('Featured Products')?.id || null,
        parentId: productsStructure.id,
        position: 0,
        pathDepth: 2,
        weight: 0
      }
    })
    console.log('✅ Created structure: /home/products/featured')

    // Create level 1: About under home
    const aboutStructure = await prisma.websiteStructure.create({
      data: {
        websiteId,
        slug: "about",
        fullPath: '/home/about',
        websitePageId: pageMap.get('About Us')?.id || null,
        parentId: homeStructure.id,
        position: 1,
        pathDepth: 1,
        weight: 1
      }
    })
    console.log('✅ Created structure: /home/about')

    // Create Blog under home
    const blogStructure = await prisma.websiteStructure.create({
      data: {
        websiteId,
        slug: "blog",
        fullPath: '/home/blog',
        websitePageId: pageMap.get('Blog')?.id || null,
        parentId: homeStructure.id,
        position: 2,
        pathDepth: 1,
        weight: 2
      }
    })
    console.log('✅ Created structure: /home/blog')

    // Create Resources under home
    const resourcesStructure = await prisma.websiteStructure.create({
      data: {
        websiteId,
        slug: "resources",
        fullPath: '/home/resources',
        websitePageId: pageMap.get('Resources & Documentation <>"\'')?.id || null,
        parentId: homeStructure.id,
        position: 3,
        pathDepth: 1,
        weight: 3
      }
    })
    console.log('✅ Created structure: /home/resources')

    // Create International under home
    const internationalStructure = await prisma.websiteStructure.create({
      data: {
        websiteId,
        slug: "international",
        fullPath: '/home/international',
        websitePageId: pageMap.get('International 你好 مرحبا 🌍')?.id || null,
        parentId: homeStructure.id,
        position: 4,
        pathDepth: 1,
        weight: 4
      }
    })
    console.log('✅ Created structure: /home/international')

    // Count total structures created
    const totalStructures = 7 // home, products, featured, about, blog, resources, international

    console.log(`✅ Created ${totalStructures} WebsiteStructure entries`)
    console.log('📋 Site hierarchy:')
    console.log('  /home (root page)')
    console.log('  ├── /home/products (page)')
    console.log('  │   └── /home/products/featured (page)')
    console.log('  ├── /home/about (page)')
    console.log('  ├── /home/blog (folder)')
    console.log('  ├── /home/resources (folder)')
    console.log('  └── /home/international (page)')

    return totalStructures
  } catch (error) {
    console.error('❌ Failed to create WebsiteStructures:', error)
    throw error
  }
}