import { PrismaClient } from '../../lib/generated/prisma'
import { execSync } from 'child_process'
import path from 'path'

describe('Database Seeding', () => {
  let prisma: PrismaClient

  beforeAll(() => {
    prisma = new PrismaClient()
  })

  afterAll(async () => {
    await prisma.$disconnect()
  })

  it('should seed database with correct data', async () => {
    // Run seed script
    execSync('npm run db:seed', { 
      cwd: path.resolve(__dirname, '../..'),
      encoding: 'utf-8',
      timeout: 60000
    })

    // Verify websites were created
    const websites = await prisma.website.findMany()
    expect(websites).toHaveLength(3)
    
    const websiteNames = websites.map(w => w.name)
    expect(websiteNames).toContain('TechVerse Blog')
    expect(websiteNames).toContain('ShopFlow Store')
    expect(websiteNames).toContain('Creative Portfolio')

    // Verify content types
    const contentTypes = await prisma.contentType.findMany()
    expect(contentTypes).toHaveLength(4)
    
    const typeNames = contentTypes.map(ct => ct.name)
    expect(typeNames).toContain('Blog Post')
    expect(typeNames).toContain('Author')
    expect(typeNames).toContain('Product')
    expect(typeNames).toContain('Project')

    // Verify content items
    const contentItems = await prisma.contentItem.findMany()
    expect(contentItems).toHaveLength(9)

    // Verify AI contexts
    const aiContexts = await prisma.aiContext.findMany()
    expect(aiContexts).toHaveLength(3)

    // Verify relationships
    const techBlog = websites.find(w => w.name === 'TechVerse Blog')
    const blogPosts = await prisma.contentItem.findMany({
      where: { websiteId: techBlog?.id }
    })
    expect(blogPosts.length).toBeGreaterThan(0)
  }, 15000)

  it('should handle reset and reseed correctly', async () => {
    // Run fresh reset
    execSync('npm run db:fresh', {
      cwd: path.resolve(__dirname, '../..'),
      encoding: 'utf-8',
      timeout: 60000
    })

    // Verify data is fresh
    const websites = await prisma.website.findMany()
    expect(websites).toHaveLength(3)
    
    // Check that old data was cleared and new data created
    const firstWebsite = websites[0]
    expect(firstWebsite.createdAt).toBeDefined()
    expect(firstWebsite.updatedAt).toBeDefined()
  }, 30000)
})