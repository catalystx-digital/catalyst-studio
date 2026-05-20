/**
 * Database Integration Tests
 * Tests the database client and operations
 */

import { execSync } from 'child_process';
import { PrismaClient } from '../../generated/prisma';

describe('Database Integration', () => {
  let prisma: PrismaClient;

  beforeAll(() => {
    // Set up test database
    process.env.DATABASE_URL = 'file:./test.db';
    
    // Clean and create test database with migrations
    try {
      execSync('rm -f test.db test.db-journal', { stdio: 'ignore' });
    } catch {
      // Ignore if files don't exist
    }
    
    execSync('npx prisma migrate deploy', {
      env: {
        ...process.env,
        DATABASE_URL: 'file:./test.db'
      },
      stdio: 'ignore'
    });

    // Create client
    prisma = new PrismaClient({
      datasources: {
        db: {
          url: 'file:./test.db'
        }
      }
    });
  });

  afterAll(async () => {
    // Disconnect and clean up
    await prisma.$disconnect();
    
    try {
      execSync('rm -f test.db test.db-journal', { stdio: 'ignore' });
    } catch {
      // Ignore cleanup errors
    }
  });

  beforeEach(async () => {
    // Clear data between tests
    await prisma.contentItem.deleteMany();
    await prisma.contentType.deleteMany();
    await prisma.website.deleteMany();
  });

  describe('Website Operations', () => {
    it('should create a website', async () => {
      const website = await prisma.website.create({
        data: {
          name: 'Test Website',
          description: 'A test website',
          category: 'Testing',
          metadata: JSON.stringify({ test: true })
        }
      });

      expect(website).toBeDefined();
      expect(website.id).toBeTruthy();
      expect(website.name).toBe('Test Website');
      expect(website.category).toBe('Testing');
    });

    it('should read a website', async () => {
      // Create a website first
      const created = await prisma.website.create({
        data: {
          name: 'Read Test',
          category: 'Test'
        }
      });

      // Read it back
      const found = await prisma.website.findUnique({
        where: { id: created.id }
      });

      expect(found).toBeDefined();
      expect(found?.name).toBe('Read Test');
    });

    it('should update a website', async () => {
      // Create a website
      const created = await prisma.website.create({
        data: {
          name: 'Update Test',
          description: 'Original',
          category: 'Test'
        }
      });

      // Update it
      const updated = await prisma.website.update({
        where: { id: created.id },
        data: { description: 'Updated' }
      });

      expect(updated.description).toBe('Updated');
      expect(updated.name).toBe('Update Test'); // Unchanged
    });

    it('should delete a website', async () => {
      // Create a website
      const created = await prisma.website.create({
        data: {
          name: 'Delete Test',
          category: 'Test'
        }
      });

      // Delete it
      const deleted = await prisma.website.delete({
        where: { id: created.id }
      });

      expect(deleted.id).toBe(created.id);

      // Verify it's gone
      const found = await prisma.website.findUnique({
        where: { id: created.id }
      });
      
      expect(found).toBeNull();
    });

    it('should list websites', async () => {
      // Create multiple websites
      await prisma.website.createMany({
        data: [
          { name: 'Website 1', category: 'Test' },
          { name: 'Website 2', category: 'Test' },
          { name: 'Website 3', category: 'Test' }
        ]
      });

      const websites = await prisma.website.findMany();
      expect(websites).toHaveLength(3);
    });
  });

  describe('Relationships', () => {
    it('should create website with content types', async () => {
      const website = await prisma.website.create({
        data: {
          name: 'Website with Content',
          category: 'Test',
          contentTypes: {
            create: [
              {
                name: 'Blog Post',
                fields: JSON.stringify([
                  { name: 'title', type: 'string' },
                  { name: 'content', type: 'text' }
                ])
              },
              {
                name: 'Product',
                fields: JSON.stringify([
                  { name: 'name', type: 'string' },
                  { name: 'price', type: 'number' }
                ])
              }
            ]
          }
        },
        include: {
          contentTypes: true
        }
      });

      expect(website.contentTypes).toHaveLength(2);
      expect(website.contentTypes[0].name).toBe('Blog Post');
      expect(website.contentTypes[1].name).toBe('Product');
    });

    it('should create content item with relationships', async () => {
      // Create website
      const website = await prisma.website.create({
        data: {
          name: 'Content Test',
          category: 'Test'
        }
      });

      // Create content type
      const contentType = await prisma.contentType.create({
        data: {
          websiteId: website.id,
          name: 'Article',
          fields: JSON.stringify([{ name: 'title', type: 'string' }])
        }
      });

      // Create content item
      const contentItem = await prisma.contentItem.create({
        data: {
          websiteId: website.id,
          contentTypeId: contentType.id,
          data: JSON.stringify({ title: 'Test Article' }),
          status: 'published'
        },
        include: {
          website: true,
          contentType: true
        }
      });

      expect(contentItem.website.name).toBe('Content Test');
      expect(contentItem.contentType.name).toBe('Article');
      expect(contentItem.status).toBe('published');
    });

    it('should handle foreign key relationships correctly', async () => {
      // Create website with content type
      const website = await prisma.website.create({
        data: {
          name: 'FK Test',
          category: 'Test',
          contentTypes: {
            create: {
              name: 'Test Type',
              fields: JSON.stringify([])
            }
          }
        },
        include: {
          contentTypes: true
        }
      });

      // Verify content type was created
      expect(website.contentTypes).toHaveLength(1);
      
      // Verify we can query the content type
      const contentType = await prisma.contentType.findFirst({
        where: { websiteId: website.id }
      });
      
      expect(contentType).toBeDefined();
      expect(contentType?.name).toBe('Test Type');
    });
  });
});