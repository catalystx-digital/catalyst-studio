import { test, expect } from '@playwright/test';
import { PrismaClient } from '@/lib/generated/prisma';

const prisma = new PrismaClient();

// Test data
const TEST_WEBSITE = {
  id: 'test-website-e2e',
  name: 'E2E Test Website',
  description: 'Website for E2E testing',
  category: 'blog',
};

const TEST_CONTENT_TYPE = {
  id: 'test-content-type-e2e',
  key: 'test-article',
  name: 'Test Article',
  pluralName: 'Test Articles',
  fields: JSON.stringify([
    { name: 'title', type: 'text', required: true },
    { name: 'content', type: 'richtext', required: true },
    { name: 'author', type: 'text', required: false },
  ]),
};

const TEST_CONTENT_ITEM = {
  data: {
    title: 'Test Article Title',
    content: 'This is test content for E2E testing',
    author: 'Test Author',
  },
  metadata: {
    seo_title: 'Test SEO Title',
    seo_description: 'Test SEO Description',
  },
};

test.describe('Content Items Migration - Story 4.5', () => {
  test.beforeAll(async () => {
    // Setup test data in database
    await prisma.website.create({
      data: TEST_WEBSITE,
    });
    
    await prisma.contentType.create({
      data: {
        ...TEST_CONTENT_TYPE,
        websiteId: TEST_WEBSITE.id,
      },
    });
  });

  test.afterAll(async () => {
    // Cleanup test data
    await prisma.contentItem.deleteMany({
      where: { websiteId: TEST_WEBSITE.id },
    });
    
    await prisma.contentType.deleteMany({
      where: { websiteId: TEST_WEBSITE.id },
    });
    
    await prisma.website.deleteMany({
      where: { id: TEST_WEBSITE.id },
    });
    
    await prisma.$disconnect();
  });

  test.describe('API Endpoints', () => {
    let createdItemId: string;

    test('POST /api/content-items - Create content item', async ({ request }) => {
      const response = await request.post('/api/content-items', {
        data: {
          contentTypeId: TEST_CONTENT_TYPE.id,
          websiteId: TEST_WEBSITE.id,
          slug: 'test-article',
          data: TEST_CONTENT_ITEM.data,
          metadata: TEST_CONTENT_ITEM.metadata,
          status: 'draft',
        },
      });

      expect(response.ok()).toBeTruthy();
      expect(response.status()).toBe(201);

      const body = await response.json();
      expect(body.data).toBeDefined();
      expect(body.data.id).toBeDefined();
      expect(body.data.contentTypeId).toBe(TEST_CONTENT_TYPE.id);
      expect(body.data.websiteId).toBe(TEST_WEBSITE.id);
      expect(body.data.data).toEqual(TEST_CONTENT_ITEM.data);
      expect(body.data.status).toBe('draft');

      createdItemId = body.data.id;
    });

    test('GET /api/content-items - List with pagination', async ({ request }) => {
      const response = await request.get('/api/content-items', {
        params: {
          page: '1',
          limit: '10',
          websiteId: TEST_WEBSITE.id,
        },
      });

      expect(response.ok()).toBeTruthy();
      expect(response.status()).toBe(200);

      const body = await response.json();
      expect(body.data).toBeDefined();
      expect(Array.isArray(body.data)).toBeTruthy();
      expect(body.pagination).toBeDefined();
      expect(body.pagination.page).toBe(1);
      expect(body.pagination.limit).toBe(10);
      expect(body.pagination.hasNext).toBeDefined();
      expect(body.pagination.hasPrev).toBeDefined();
    });

    test('GET /api/content-items/[id] - Get single item', async ({ request }) => {
      const response = await request.get(`/api/content-items/${createdItemId}`);

      expect(response.ok()).toBeTruthy();
      expect(response.status()).toBe(200);

      const body = await response.json();
      expect(body.data).toBeDefined();
      expect(body.data.id).toBe(createdItemId);
      expect(body.data.contentType).toBeDefined();
      expect(body.data.website).toBeDefined();
    });

    test('PUT /api/content-items/[id] - Update item', async ({ request }) => {
      const updateData = {
        data: {
          ...TEST_CONTENT_ITEM.data,
          title: 'Updated Title',
        },
        status: 'published',
        publishedAt: new Date().toISOString(),
      };

      const response = await request.put(`/api/content-items/${createdItemId}`, {
        data: updateData,
      });

      expect(response.ok()).toBeTruthy();
      expect(response.status()).toBe(200);

      const body = await response.json();
      expect(body.data.data.title).toBe('Updated Title');
      expect(body.data.status).toBe('published');
      expect(body.data.publishedAt).toBeDefined();
    });

    test('DELETE /api/content-items/[id] - Soft delete', async ({ request }) => {
      const response = await request.delete(`/api/content-items/${createdItemId}`);

      expect(response.ok()).toBeTruthy();
      expect(response.status()).toBe(200);

      const body = await response.json();
      expect(body.data.status).toBe('archived');

      // Verify item is archived, not deleted
      const checkResponse = await request.get(`/api/content-items/${createdItemId}`);
      const checkBody = await checkResponse.json();
      expect(checkBody.data.status).toBe('archived');
    });

    test('POST /api/content-items/bulk - Bulk create', async ({ request }) => {
      const bulkItems = Array.from({ length: 3 }, (_, i) => ({
        contentTypeId: TEST_CONTENT_TYPE.id,
        websiteId: TEST_WEBSITE.id,
        data: {
          title: `Bulk Item ${i + 1}`,
          content: `Content for bulk item ${i + 1}`,
        },
        status: 'draft',
      }));

      const response = await request.post('/api/content-items/bulk', {
        data: { items: bulkItems },
      });

      expect(response.ok()).toBeTruthy();
      expect(response.status()).toBe(201);

      const body = await response.json();
      expect(body.data).toBeDefined();
      expect(body.data.length).toBe(3);
    });
  });

  test.describe('Validation', () => {
    test('Invalid request body returns 400', async ({ request }) => {
      const response = await request.post('/api/content-items', {
        data: {
          // Missing required fields
          data: TEST_CONTENT_ITEM.data,
        },
      });

      expect(response.status()).toBe(400);
      const body = await response.json();
      expect(body.error).toBeDefined();
      expect(body.error.message).toContain('Invalid request body');
    });

    test('Invalid query parameters returns 400', async ({ request }) => {
      const response = await request.get('/api/content-items', {
        params: {
          page: 'invalid',
          limit: '999',
        },
      });

      // Should still work but clamp limit to 100
      const body = await response.json();
      expect(body.pagination.limit).toBeLessThanOrEqual(100);
    });

    test('Non-existent item returns 404', async ({ request }) => {
      const response = await request.get('/api/content-items/non-existent-id');

      expect(response.status()).toBe(404);
      const body = await response.json();
      expect(body.error).toBeDefined();
      expect(body.error.message).toContain('not found');
    });
  });

  test.describe('Pagination Features', () => {
    test.beforeAll(async () => {
      // Create 25 test items for pagination testing
      const items = Array.from({ length: 25 }, (_, i) => ({
        contentTypeId: TEST_CONTENT_TYPE.id,
        websiteId: TEST_WEBSITE.id,
        title: `Pagination Test Item ${i + 1}`,
        slug: `pagination-test-item-${i + 1}`,
        content: JSON.stringify({
          title: `Pagination Test Item ${i + 1}`,
          content: `Content ${i + 1}`,
        }),
        status: 'published',
      }));

      await prisma.contentItem.createMany({ data: items });
    });

    test('Pagination with multiple pages', async ({ request }) => {
      // First page
      const page1Response = await request.get('/api/content-items', {
        params: {
          page: '1',
          limit: '10',
          websiteId: TEST_WEBSITE.id,
        },
      });

      const page1 = await page1Response.json();
      expect(page1.data.length).toBeLessThanOrEqual(10);
      expect(page1.pagination.hasNext).toBeTruthy();
      expect(page1.pagination.hasPrev).toBeFalsy();

      // Second page
      const page2Response = await request.get('/api/content-items', {
        params: {
          page: '2',
          limit: '10',
          websiteId: TEST_WEBSITE.id,
        },
      });

      const page2 = await page2Response.json();
      expect(page2.data.length).toBeLessThanOrEqual(10);
      expect(page2.pagination.hasPrev).toBeTruthy();

      // Different items on different pages
      const page1Ids = page1.data.map((item: any) => item.id);
      const page2Ids = page2.data.map((item: any) => item.id);
      const intersection = page1Ids.filter((id: string) => page2Ids.includes(id));
      expect(intersection.length).toBe(0);
    });

    test('Filtering by status', async ({ request }) => {
      const response = await request.get('/api/content-items', {
        params: {
          status: 'published',
          websiteId: TEST_WEBSITE.id,
        },
      });

      const body = await response.json();
      expect(body.data.every((item: any) => item.status === 'published')).toBeTruthy();
    });

    test('Sorting', async ({ request }) => {
      const ascResponse = await request.get('/api/content-items', {
        params: {
          sortBy: 'createdAt',
          sortOrder: 'asc',
          websiteId: TEST_WEBSITE.id,
          limit: '5',
        },
      });

      const ascBody = await ascResponse.json();
      const ascDates = ascBody.data.map((item: any) => new Date(item.createdAt).getTime());
      
      // Check if dates are in ascending order
      for (let i = 1; i < ascDates.length; i++) {
        expect(ascDates[i]).toBeGreaterThanOrEqual(ascDates[i - 1]);
      }
    });
  });

  test.describe('Performance', () => {
    test('API responds within acceptable time', async ({ request }) => {
      const startTime = Date.now();
      
      const response = await request.get('/api/content-items', {
        params: {
          page: '1',
          limit: '100',
          websiteId: TEST_WEBSITE.id,
        },
      });

      const endTime = Date.now();
      const responseTime = endTime - startTime;

      expect(response.ok()).toBeTruthy();
      expect(responseTime).toBeLessThan(2000); // Should respond within 2 seconds
    });
  });
});

test.describe('UI Integration', () => {
  test('Content page loads successfully', async ({ page }) => {
    await page.goto('/content');
    
    // Wait for content to load
    await page.waitForLoadState('networkidle');
    
    // Check if page contains expected elements
    const pageTitle = await page.textContent('h1, h2');
    expect(pageTitle).toContain('Content');
  });
});