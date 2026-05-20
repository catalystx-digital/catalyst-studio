import { test, expect } from '@playwright/test';

test.describe('Epic 4 - Story 4.5: Content Items API', () => {
  const API_BASE = 'http://localhost:3000/api';
  let testWebsiteId: string;
  let testContentTypeId: string;
  let createdItemId: string;

  test.beforeAll(async ({ request }) => {
    // Get existing website and content type from seed data
    const websitesResponse = await request.get(`${API_BASE}/websites`);
    if (websitesResponse.ok()) {
      const websitesData = await websitesResponse.json();
      if (websitesData.data && websitesData.data.length > 0) {
        testWebsiteId = websitesData.data[0].id;
      }
    }

    // Get content types for the website
    if (testWebsiteId) {
      const typesResponse = await request.get(`${API_BASE}/content-types?websiteId=${testWebsiteId}`);
      if (typesResponse.ok()) {
        const typesData = await typesResponse.json();
        if (typesData.data && typesData.data.length > 0) {
          testContentTypeId = typesData.data[0].id;
        }
      }
    }
  });

  test.describe('CRUD Operations', () => {
    test('POST /api/content-items - Create new content item', async ({ request }) => {
      const contentData = {
        contentTypeId: testContentTypeId || 'test-type-id',
        websiteId: testWebsiteId || 'test-website-id',
        slug: 'test-article-e2e',
        data: {
          title: 'E2E Test Article',
          content: 'This is content created during E2E testing',
          author: 'E2E Test Suite',
          tags: ['test', 'e2e', 'automated'],
        },
        metadata: {
          seoTitle: 'E2E Test Article - SEO Title',
          seoDescription: 'Description for E2E test article',
        },
        status: 'draft',
      };

      const response = await request.post(`${API_BASE}/content-items`, {
        data: contentData,
      });

      // Check response status
      expect(response.status()).toBe(201);

      const responseBody = await response.json();
      expect(responseBody.data).toBeDefined();
      expect(responseBody.data.id).toBeDefined();
      expect(responseBody.data.slug).toBe('test-article-e2e');
      expect(responseBody.data.status).toBe('draft');
      expect(responseBody.data.data).toMatchObject(contentData.data);

      // Store created ID for later tests
      createdItemId = responseBody.data.id;
    });

    test('GET /api/content-items - List with pagination', async ({ request }) => {
      const response = await request.get(`${API_BASE}/content-items?page=1&limit=10`);
      
      expect(response.ok()).toBeTruthy();
      const responseBody = await response.json();
      
      // Check pagination structure
      expect(responseBody.pagination).toBeDefined();
      expect(responseBody.pagination.page).toBe(1);
      expect(responseBody.pagination.limit).toBe(10);
      expect(responseBody.pagination.total).toBeGreaterThanOrEqual(0);
      expect(responseBody.pagination.totalPages).toBeGreaterThanOrEqual(0);
      expect(responseBody.pagination.hasNext).toBeDefined();
      expect(responseBody.pagination.hasPrev).toBe(false);

      // Check data structure
      expect(Array.isArray(responseBody.data)).toBeTruthy();
      if (responseBody.data.length > 0) {
        const item = responseBody.data[0];
        expect(item.id).toBeDefined();
        expect(item.contentTypeId).toBeDefined();
        expect(item.websiteId).toBeDefined();
        expect(item.data).toBeDefined();
        expect(item.status).toBeDefined();
      }
    });

    test('GET /api/content-items/[id] - Get single item with relations', async ({ request }) => {
      if (!createdItemId) {
        test.skip();
        return;
      }

      const response = await request.get(`${API_BASE}/content-items/${createdItemId}`);
      
      expect(response.ok()).toBeTruthy();
      const responseBody = await response.json();
      
      expect(responseBody.data).toBeDefined();
      expect(responseBody.data.id).toBe(createdItemId);
      expect(responseBody.data.contentType).toBeDefined();
      expect(responseBody.data.website).toBeDefined();
      expect(responseBody.data.data.title).toBe('E2E Test Article');
    });

    test('PUT /api/content-items/[id] - Update content item', async ({ request }) => {
      if (!createdItemId) {
        test.skip();
        return;
      }

      const updateData = {
        data: {
          title: 'Updated E2E Test Article',
          content: 'Updated content for E2E testing',
          author: 'E2E Test Suite - Updated',
          tags: ['updated', 'test'],
        },
        status: 'published',
        publishedAt: new Date().toISOString(),
      };

      const response = await request.put(`${API_BASE}/content-items/${createdItemId}`, {
        data: updateData,
      });

      expect(response.ok()).toBeTruthy();
      const responseBody = await response.json();
      
      expect(responseBody.data.data.title).toBe('Updated E2E Test Article');
      expect(responseBody.data.status).toBe('published');
      expect(responseBody.data.publishedAt).toBeDefined();
    });

    test('DELETE /api/content-items/[id] - Soft delete (archive)', async ({ request }) => {
      if (!createdItemId) {
        test.skip();
        return;
      }

      const response = await request.delete(`${API_BASE}/content-items/${createdItemId}`);
      
      expect(response.ok()).toBeTruthy();
      const responseBody = await response.json();
      
      expect(responseBody.data.status).toBe('archived');
      expect(responseBody.data.message).toContain('archived successfully');

      // Verify item is archived, not hard deleted
      const checkResponse = await request.get(`${API_BASE}/content-items/${createdItemId}`);
      const checkBody = await checkResponse.json();
      expect(checkBody.data.status).toBe('archived');
    });
  });

  test.describe('Bulk Operations', () => {
    test('POST /api/content-items/bulk - Bulk create items', async ({ request }) => {
      const bulkItems = [
        {
          contentTypeId: testContentTypeId || 'test-type-id',
          websiteId: testWebsiteId || 'test-website-id',
          data: { title: 'Bulk Item 1', content: 'Content 1' },
          status: 'draft',
        },
        {
          contentTypeId: testContentTypeId || 'test-type-id',
          websiteId: testWebsiteId || 'test-website-id',
          data: { title: 'Bulk Item 2', content: 'Content 2' },
          status: 'draft',
        },
        {
          contentTypeId: testContentTypeId || 'test-type-id',
          websiteId: testWebsiteId || 'test-website-id',
          data: { title: 'Bulk Item 3', content: 'Content 3' },
          status: 'draft',
        },
      ];

      const response = await request.post(`${API_BASE}/content-items/bulk`, {
        data: { items: bulkItems },
      });

      expect(response.status()).toBe(201);
      const responseBody = await response.json();
      
      expect(responseBody.data).toBeDefined();
      expect(responseBody.data.length).toBe(3);
      expect(responseBody.message).toContain('Successfully created 3');
    });

    test('DELETE /api/content-items/bulk - Bulk archive items', async ({ request }) => {
      // First create some items to delete
      const createResponse = await request.post(`${API_BASE}/content-items/bulk`, {
        data: {
          items: [
            {
              contentTypeId: testContentTypeId || 'test-type-id',
              websiteId: testWebsiteId || 'test-website-id',
              data: { title: 'To Delete 1' },
              status: 'draft',
            },
            {
              contentTypeId: testContentTypeId || 'test-type-id',
              websiteId: testWebsiteId || 'test-website-id',
              data: { title: 'To Delete 2' },
              status: 'draft',
            },
          ],
        },
      });

      const createdItems = await createResponse.json();
      const idsToDelete = createdItems.data.map((item: any) => item.id);

      // Now bulk delete them
      const deleteResponse = await request.delete(`${API_BASE}/content-items/bulk`, {
        data: { ids: idsToDelete },
      });

      expect(deleteResponse.ok()).toBeTruthy();
      const deleteBody = await deleteResponse.json();
      
      expect(deleteBody.data.count).toBe(2);
      expect(deleteBody.data.message).toContain('Successfully archived 2');
    });
  });

  test.describe('Validation', () => {
    test('Invalid request body returns 400 with details', async ({ request }) => {
      const invalidData = {
        // Missing required fields
        data: { title: 'Invalid Item' },
      };

      const response = await request.post(`${API_BASE}/content-items`, {
        data: invalidData,
      });

      expect(response.status()).toBe(400);
      const responseBody = await response.json();
      
      expect(responseBody.error).toBeDefined();
      expect(responseBody.error.message).toContain('Invalid request body');
      expect(responseBody.error.details).toBeDefined();
    });

    test('Query parameters are validated', async ({ request }) => {
      const response = await request.get(`${API_BASE}/content-items?page=0&limit=999`);
      
      // Should still work but apply constraints
      expect(response.ok()).toBeTruthy();
      const responseBody = await response.json();
      
      expect(responseBody.pagination.page).toBeGreaterThanOrEqual(1);
      expect(responseBody.pagination.limit).toBeLessThanOrEqual(100);
    });

    test('Non-existent item returns 404', async ({ request }) => {
      const response = await request.get(`${API_BASE}/content-items/non-existent-id-123`);
      
      expect(response.status()).toBe(404);
      const responseBody = await response.json();
      
      expect(responseBody.error).toBeDefined();
      expect(responseBody.error.message).toContain('not found');
    });
  });

  test.describe('Filtering and Sorting', () => {
    test('Filter by status', async ({ request }) => {
      const response = await request.get(`${API_BASE}/content-items?status=published`);
      
      expect(response.ok()).toBeTruthy();
      const responseBody = await response.json();
      
      // All items should have status 'published'
      for (const item of responseBody.data) {
        expect(item.status).toBe('published');
      }
    });

    test('Filter by websiteId', async ({ request }) => {
      if (!testWebsiteId) {
        test.skip();
        return;
      }

      const response = await request.get(`${API_BASE}/content-items?websiteId=${testWebsiteId}`);
      
      expect(response.ok()).toBeTruthy();
      const responseBody = await response.json();
      
      // All items should belong to the test website
      for (const item of responseBody.data) {
        expect(item.websiteId).toBe(testWebsiteId);
      }
    });

    test('Sort by createdAt ascending', async ({ request }) => {
      const response = await request.get(`${API_BASE}/content-items?sortBy=createdAt&sortOrder=asc&limit=5`);
      
      expect(response.ok()).toBeTruthy();
      const responseBody = await response.json();
      
      // Check items are sorted correctly
      if (responseBody.data.length > 1) {
        for (let i = 1; i < responseBody.data.length; i++) {
          const prevDate = new Date(responseBody.data[i - 1].createdAt).getTime();
          const currDate = new Date(responseBody.data[i].createdAt).getTime();
          expect(currDate).toBeGreaterThanOrEqual(prevDate);
        }
      }
    });
  });

  test.describe('Performance', () => {
    test('API responds within acceptable time for large limit', async ({ request }) => {
      const startTime = performance.now();
      
      const response = await request.get(`${API_BASE}/content-items?limit=100`);
      
      const endTime = performance.now();
      const responseTime = endTime - startTime;
      
      expect(response.ok()).toBeTruthy();
      expect(responseTime).toBeLessThan(3000); // Should respond within 3 seconds
    });

    test('Optimistic updates structure is correct', async ({ request }) => {
      const response = await request.get(`${API_BASE}/content-items?limit=1`);
      
      expect(response.ok()).toBeTruthy();
      const responseBody = await response.json();
      
      // Check that response structure supports optimistic updates
      expect(responseBody.data).toBeDefined();
      expect(responseBody.pagination).toBeDefined();
      
      if (responseBody.data.length > 0) {
        const item = responseBody.data[0];
        // All fields needed for optimistic updates
        expect(item.id).toBeDefined();
        expect(item.createdAt).toBeDefined();
        expect(item.updatedAt).toBeDefined();
      }
    });
  });
});