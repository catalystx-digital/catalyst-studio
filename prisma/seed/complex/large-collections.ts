import { PrismaClient } from '../../../lib/generated/prisma'

/**
 * Creates large content collections for performance testing
 * Tests handling of 100+ items in various structures
 */
export async function createLargeCollections(
  prisma: PrismaClient,
  websiteId: string
): Promise<number> {
  let createdCount = 0
  
  // Test Case 1: Large blog collection (100 items)
  const blogType = await prisma.contentType.create({
    data: {
      key: 'large_blog_post',
      name: 'Large Blog Post',
      pluralName: 'Large Blog Posts',
      category: 'page',
      displayField: 'title',
      websiteId,
        
      fields: [
        { name: 'title', type: 'text', required: true },
        { name: 'slug', type: 'text', required: true },
        { name: 'excerpt', type: 'textarea', required: false },
        { name: 'content', type: 'richtext', required: true },
        { name: 'author', type: 'text', required: false },
        { name: 'tags', type: 'array', required: false },
        { name: 'publishDate', type: 'date', required: false }
      ]
    }
  })
  
  // Create 100 blog posts
  for (let i = 0; i < 100; i++) {
    await prisma.websitePage.create({
      data: {
        contentTypeId: blogType.id,
        websiteId,
        type: 'page',
        title: `Blog Post ${i + 1}: ${generateTitle()}`,
        status: i % 3 === 0 ? 'published' : i % 3 === 1 ? 'draft' : 'archived',
        content: {
          title: `Blog Post ${i + 1}: ${generateTitle()}`,
          excerpt: generateExcerpt(),
          content: generateRichContent(),
          author: ['John Doe', 'Jane Smith', 'Bob Wilson'][i % 3],
          tags: generateTags(),
          publishDate: new Date(Date.now() - i * 86400000).toISOString()
        },
        publishedAt: i % 3 === 0 ? new Date(Date.now() - i * 86400000) : null
      }
    })
    createdCount++
  }
  
  // Test Case 2: Product catalog (50 items)
  const productType = await prisma.contentType.create({
    data: {
      key: 'large_product',
      name: 'Large Product',
      pluralName: 'Large Products',
      category: 'page',
      displayField: 'name',
      websiteId,
        
      fields: [
        { name: 'name', type: 'text', required: true },
        { name: 'sku', type: 'text', required: true },
        { name: 'price', type: 'number', required: true },
        { name: 'description', type: 'richtext', required: false },
        { name: 'category', type: 'text', required: true },
        { name: 'inventory', type: 'number', required: true }
      ]
    }
  })
  
  const categories = ['Electronics', 'Clothing', 'Books', 'Home', 'Sports']
  
  for (let i = 0; i < 50; i++) {
    await prisma.websitePage.create({
      data: {
        contentTypeId: productType.id,
        websiteId,
        type: 'page',
        title: `Product ${i + 1}`,
        status: 'published',
        content: {
          name: `Product ${i + 1}: ${generateProductName()}`,
          sku: `SKU-${1000 + i}`,
          price: Math.floor(Math.random() * 500) + 10,
          description: generateProductDescription(),
          category: categories[i % categories.length],
          inventory: Math.floor(Math.random() * 100)
        }
      }
    })
    createdCount++
  }
  
  // Test Case 3: Deep folder structure with many items
  const folderType = await prisma.contentType.create({
    data: {
      key: 'large_folder_structure',
      name: 'Large Folder',
      pluralName: 'Large Folders',
      category: 'folder',
      displayField: 'name',
      websiteId,
        
      fields: [
        { name: 'name', type: 'text', required: true },
        { name: 'path', type: 'text', required: true },
        { name: 'depth', type: 'number', required: true }
      ]
    }
  })
  
  // Create hierarchical folder structure
  const createFolderStructure = async (parentPath: string, depth: number, maxDepth: number) => {
    if (depth > maxDepth) return
    
    for (let i = 0; i < 3; i++) {
      const folderName = `Folder-L${depth}-${i}`
      const folderPath = `${parentPath}/${folderName}`
      // Make slug unique by including parent path hash
      const uniqueSlug = `${folderName}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`.toLowerCase()
      
      await prisma.websitePage.create({
        data: {
          contentTypeId: folderType.id,
          websiteId,
          type: 'folder',  // Add required type field for folder
          title: folderName,
          status: 'published',
          content: {
            name: folderName,
            path: folderPath,
            depth
          }
        }
      })
      createdCount++
      
      // Recursively create subfolders
      if (depth < maxDepth) {
        await createFolderStructure(folderPath, depth + 1, maxDepth)
      }
    }
  }
  
  await createFolderStructure('', 1, 4) // Creates 3^4 = 81 folders
  
  return createdCount
}

// Helper functions
function generateTitle(): string {
  const titles = [
    'Ultimate Guide to Modern Web Development',
    'Best Practices for Cloud Architecture',
    'Understanding Microservices Design Patterns',
    'Advanced TypeScript Techniques',
    'Building Scalable Applications'
  ]
  return titles[Math.floor(Math.random() * titles.length)]
}

function generateExcerpt(): string {
  return 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.'
}

function generateRichContent(): string {
  return `<h2>Introduction</h2>
<p>Lorem ipsum dolor sit amet, consectetur adipiscing elit.</p>
<h3>Main Content</h3>
<p>Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.</p>
<ul>
  <li>Point one</li>
  <li>Point two</li>
  <li>Point three</li>
</ul>
<h3>Conclusion</h3>
<p>Ut enim ad minim veniam, quis nostrud exercitation.</p>`
}

function generateTags(): string[] {
  const allTags = ['javascript', 'typescript', 'react', 'nodejs', 'cloud', 'devops', 'security', 'performance']
  const tagCount = Math.floor(Math.random() * 4) + 1
  const tags: string[] = []
  for (let i = 0; i < tagCount; i++) {
    tags.push(allTags[Math.floor(Math.random() * allTags.length)])
  }
  return Array.from(new Set(tags))
}

function generateProductName(): string {
  const adjectives = ['Studio', 'Professional', 'Ultimate', 'Essential', 'Advanced']
  const products = ['Laptop', 'Headphones', 'Camera', 'Smartphone', 'Tablet']
  return `${adjectives[Math.floor(Math.random() * adjectives.length)]} ${products[Math.floor(Math.random() * products.length)]}`
}

function generateProductDescription(): string {
  return 'High-quality product with advanced features. Perfect for professionals and enthusiasts alike. Comes with comprehensive warranty and support.'
}