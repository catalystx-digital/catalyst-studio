import { NextRequest } from 'next/server';
import { POST as createPage } from '../route';
import { PATCH as updatePage, DELETE as deletePage } from '../[id]/route';
import { POST as movePage } from '../[id]/move/route';
import { GET as resolveUrl } from '../resolve/route';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';

const mockSession = {
  user: { id: 'test-user-id', email: 'test@example.com' }
};

jest.mock('next-auth');

describe('Pages API Integration Tests', () => {
  let websiteId: string;
  let contentTypeId: string;

  beforeAll(async () => {
    // Setup test data
    const website = await prisma.website.create({
      data: {
        name: 'Test Website',
        domain: 'test.example.com',
        metadata: {}
      }
    });
    websiteId = website.id;

    const contentType = await prisma.contentType.create({
      data: {
        websiteId,
        name: 'Page',
        slug: 'page',
        fields: {},
        metadata: {}
      }
    });
    contentTypeId = contentType.id;
  });

  afterAll(async () => {
    // Cleanup test data
    await prisma.siteStructure.deleteMany({ where: { websiteId } });
    await prisma.contentItem.deleteMany({ where: { websiteId } });
    await prisma.contentType.deleteMany({ where: { websiteId } });
    await prisma.website.delete({ where: { id: websiteId } });
  });

  beforeEach(() => {
    (getServerSession as jest.Mock).mockResolvedValue(mockSession);
  });

  afterEach(async () => {
    // Clean up created pages after each test
    await prisma.siteStructure.deleteMany({ where: { websiteId } });
    await prisma.contentItem.deleteMany({ 
      where: { 
        websiteId,
        contentTypeId 
      } 
    });
  });

  describe('POST /api/pages', () => {
    it('should create a page with ContentItem and SiteStructure', async () => {
      // Arrange
      const requestBody = {
        title: 'Test Page',
        contentTypeId,
        content: { body: 'Test content' },
        metadata: { key: 'value' }
      };

      const request = new NextRequest('http://localhost/api/pages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-website-id': websiteId
        },
        body: JSON.stringify(requestBody)
      });

      // Act
      const response = await createPage(request);
      const data = await response.json();

      // Assert
      expect(response.status).toBe(201);
      expect(data.contentItem).toBeDefined();
      expect(data.siteStructure).toBeDefined();
      expect(data.contentItem.title).toBe('Test Page');
      expect(data.contentItem.slug).toBe('test-page');
      expect(data.siteStructure.fullPath).toBe('/test-page');
      expect(data.fullPath).toBe('/test-page');

      // Verify in database
      const contentItem = await prisma.contentItem.findUnique({
        where: { id: data.contentItem.id }
      });
      expect(contentItem).toBeTruthy();
      expect(contentItem?.title).toBe('Test Page');

      const siteStructure = await prisma.siteStructure.findUnique({
        where: { id: data.siteStructure.id }
      });
      expect(siteStructure).toBeTruthy();
      expect(siteStructure?.slug).toBe('test-page');
    });

    it('should create nested page with correct hierarchy', async () => {
      // Create parent page first
      const parentRequest = new NextRequest('http://localhost/api/pages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-website-id': websiteId
        },
        body: JSON.stringify({
          title: 'Parent Page',
          contentTypeId
        })
      });

      const parentResponse = await createPage(parentRequest);
      const parentData = await parentResponse.json();

      // Create child page
      const childRequest = new NextRequest('http://localhost/api/pages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-website-id': websiteId
        },
        body: JSON.stringify({
          title: 'Child Page',
          contentTypeId,
          parentId: parentData.siteStructure.id
        })
      });

      const childResponse = await createPage(childRequest);
      const childData = await childResponse.json();

      // Assert
      expect(childResponse.status).toBe(201);
      expect(childData.siteStructure.parentId).toBe(parentData.siteStructure.id);
      expect(childData.siteStructure.depth).toBe(1);
      expect(childData.fullPath).toBe('/parent-page/child-page');
      expect(childData.breadcrumbs).toHaveLength(2);
    });

    it('should return 409 for duplicate slugs', async () => {
      // Create first page
      await createPage(new NextRequest('http://localhost/api/pages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-website-id': websiteId
        },
        body: JSON.stringify({
          title: 'Duplicate Test',
          contentTypeId,
          slug: 'duplicate-slug'
        })
      }));

      // Try to create second page with same slug
      const duplicateRequest = new NextRequest('http://localhost/api/pages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-website-id': websiteId
        },
        body: JSON.stringify({
          title: 'Another Page',
          contentTypeId,
          slug: 'duplicate-slug'
        })
      });

      const response = await createPage(duplicateRequest);
      
      // Assert
      expect(response.status).toBe(409);
      const data = await response.json();
      expect(data.error).toContain('already exists');
    });
  });

  describe('PATCH /api/pages/[id]', () => {
    it('should update page title and slug', async () => {
      // Create a page first
      const createRequest = new NextRequest('http://localhost/api/pages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-website-id': websiteId
        },
        body: JSON.stringify({
          title: 'Original Title',
          contentTypeId
        })
      });

      const createResponse = await createPage(createRequest);
      const createdPage = await createResponse.json();

      // Update the page
      const updateRequest = new NextRequest(`http://localhost/api/pages/${createdPage.siteStructure.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          title: 'Updated Title',
          slug: 'updated-slug'
        })
      });

      const updateResponse = await updatePage(updateRequest, {
        params: { id: createdPage.siteStructure.id }
      });
      const updatedPage = await updateResponse.json();

      // Assert
      expect(updateResponse.status).toBe(200);
      expect(updatedPage.contentItem.title).toBe('Updated Title');
      expect(updatedPage.contentItem.slug).toBe('updated-slug');
      expect(updatedPage.siteStructure.slug).toBe('updated-slug');
      expect(updatedPage.fullPath).toBe('/updated-slug');

      // Verify in database
      const contentItem = await prisma.contentItem.findUnique({
        where: { id: createdPage.contentItem.id }
      });
      expect(contentItem?.title).toBe('Updated Title');
      expect(contentItem?.slug).toBe('updated-slug');
    });

    it('should cascade path updates to descendants', async () => {
      // Create parent and child pages
      const parentRequest = new NextRequest('http://localhost/api/pages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-website-id': websiteId
        },
        body: JSON.stringify({
          title: 'Parent',
          contentTypeId,
          slug: 'parent'
        })
      });
      const parentResponse = await createPage(parentRequest);
      const parent = await parentResponse.json();

      const childRequest = new NextRequest('http://localhost/api/pages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-website-id': websiteId
        },
        body: JSON.stringify({
          title: 'Child',
          contentTypeId,
          parentId: parent.siteStructure.id,
          slug: 'child'
        })
      });
      const childResponse = await createPage(childRequest);
      const child = await childResponse.json();

      // Update parent slug
      const updateRequest = new NextRequest(`http://localhost/api/pages/${parent.siteStructure.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          slug: 'updated-parent'
        })
      });

      await updatePage(updateRequest, {
        params: { id: parent.siteStructure.id }
      });

      // Check child path was updated
      const updatedChild = await prisma.siteStructure.findUnique({
        where: { id: child.siteStructure.id }
      });

      expect(updatedChild?.fullPath).toBe('/updated-parent/child');
    });
  });

  describe('DELETE /api/pages/[id]', () => {
    it('should delete page and content', async () => {
      // Create a page
      const createRequest = new NextRequest('http://localhost/api/pages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-website-id': websiteId
        },
        body: JSON.stringify({
          title: 'To Delete',
          contentTypeId
        })
      });

      const createResponse = await createPage(createRequest);
      const page = await createResponse.json();

      // Delete the page
      const deleteRequest = new NextRequest(`http://localhost/api/pages/${page.siteStructure.id}`, {
        method: 'DELETE'
      });

      const deleteResponse = await deletePage(deleteRequest, {
        params: { id: page.siteStructure.id }
      });

      // Assert
      expect(deleteResponse.status).toBe(200);

      // Verify deletion in database
      const contentItem = await prisma.contentItem.findUnique({
        where: { id: page.contentItem.id }
      });
      expect(contentItem).toBeNull();

      const siteStructure = await prisma.siteStructure.findUnique({
        where: { id: page.siteStructure.id }
      });
      expect(siteStructure).toBeNull();
    });

    it('should cascade delete children when option specified', async () => {
      // Create parent and child
      const parentRequest = new NextRequest('http://localhost/api/pages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-website-id': websiteId
        },
        body: JSON.stringify({
          title: 'Parent to Delete',
          contentTypeId
        })
      });
      const parentResponse = await createPage(parentRequest);
      const parent = await parentResponse.json();

      const childRequest = new NextRequest('http://localhost/api/pages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-website-id': websiteId
        },
        body: JSON.stringify({
          title: 'Child to Delete',
          contentTypeId,
          parentId: parent.siteStructure.id
        })
      });
      const childResponse = await createPage(childRequest);
      const child = await childResponse.json();

      // Delete parent with cascade
      const deleteRequest = new NextRequest(`http://localhost/api/pages/${parent.siteStructure.id}?cascade=true`, {
        method: 'DELETE'
      });

      const deleteResponse = await deletePage(deleteRequest, {
        params: { id: parent.siteStructure.id }
      });

      // Assert
      expect(deleteResponse.status).toBe(200);

      // Verify both are deleted
      const childStructure = await prisma.siteStructure.findUnique({
        where: { id: child.siteStructure.id }
      });
      expect(childStructure).toBeNull();
    });
  });

  describe('POST /api/pages/[id]/move', () => {
    it('should move page to new parent', async () => {
      // Create two parent pages and a child
      const parent1Response = await createPage(new NextRequest('http://localhost/api/pages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-website-id': websiteId
        },
        body: JSON.stringify({
          title: 'Parent 1',
          contentTypeId,
          slug: 'parent1'
        })
      }));
      const parent1 = await parent1Response.json();

      const parent2Response = await createPage(new NextRequest('http://localhost/api/pages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-website-id': websiteId
        },
        body: JSON.stringify({
          title: 'Parent 2',
          contentTypeId,
          slug: 'parent2'
        })
      }));
      const parent2 = await parent2Response.json();

      const childResponse = await createPage(new NextRequest('http://localhost/api/pages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-website-id': websiteId
        },
        body: JSON.stringify({
          title: 'Child',
          contentTypeId,
          parentId: parent1.siteStructure.id,
          slug: 'child'
        })
      }));
      const child = await childResponse.json();

      // Move child from parent1 to parent2
      const moveRequest = new NextRequest(`http://localhost/api/pages/${child.siteStructure.id}/move`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          newParentId: parent2.siteStructure.id
        })
      });

      const moveResponse = await movePage(moveRequest, {
        params: { id: child.siteStructure.id }
      });
      const movedPage = await moveResponse.json();

      // Assert
      expect(moveResponse.status).toBe(200);
      expect(movedPage.siteStructure.parentId).toBe(parent2.siteStructure.id);
      expect(movedPage.fullPath).toBe('/parent2/child');
    });

    it('should prevent circular references', async () => {
      // Create parent and child
      const parentResponse = await createPage(new NextRequest('http://localhost/api/pages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-website-id': websiteId
        },
        body: JSON.stringify({
          title: 'Parent',
          contentTypeId
        })
      }));
      const parent = await parentResponse.json();

      const childResponse = await createPage(new NextRequest('http://localhost/api/pages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-website-id': websiteId
        },
        body: JSON.stringify({
          title: 'Child',
          contentTypeId,
          parentId: parent.siteStructure.id
        })
      }));
      const child = await childResponse.json();

      // Try to move parent under child (circular reference)
      const moveRequest = new NextRequest(`http://localhost/api/pages/${parent.siteStructure.id}/move`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          newParentId: child.siteStructure.id
        })
      });

      const moveResponse = await movePage(moveRequest, {
        params: { id: parent.siteStructure.id }
      });

      // Assert
      expect(moveResponse.status).toBe(400);
      const error = await moveResponse.json();
      expect(error.error).toContain('Circular');
    });
  });

  describe('GET /api/pages/resolve', () => {
    it('should resolve URL path to page', async () => {
      // Create a nested page structure
      const aboutResponse = await createPage(new NextRequest('http://localhost/api/pages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-website-id': websiteId
        },
        body: JSON.stringify({
          title: 'About',
          contentTypeId,
          slug: 'about'
        })
      }));
      const about = await aboutResponse.json();

      const teamResponse = await createPage(new NextRequest('http://localhost/api/pages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-website-id': websiteId
        },
        body: JSON.stringify({
          title: 'Team',
          contentTypeId,
          parentId: about.siteStructure.id,
          slug: 'team'
        })
      }));
      await teamResponse.json();

      // Resolve the URL
      const resolveRequest = new NextRequest('http://localhost/api/pages/resolve?path=/about/team', {
        method: 'GET',
        headers: {
          'x-website-id': websiteId
        }
      });

      const resolveResponse = await resolveUrl(resolveRequest);
      const resolved = await resolveResponse.json();

      // Assert
      expect(resolveResponse.status).toBe(200);
      expect(resolved.contentItem.title).toBe('Team');
      expect(resolved.fullPath).toBe('/about/team');
      expect(resolved.breadcrumbs).toHaveLength(2);
      expect(resolved.breadcrumbs[0].title).toBe('About');
      expect(resolved.breadcrumbs[1].title).toBe('Team');
    });

    it('should return 404 for non-existent paths', async () => {
      const resolveRequest = new NextRequest('http://localhost/api/pages/resolve?path=/non-existent', {
        method: 'GET',
        headers: {
          'x-website-id': websiteId
        }
      });

      const resolveResponse = await resolveUrl(resolveRequest);

      expect(resolveResponse.status).toBe(404);
      const error = await resolveResponse.json();
      expect(error.error).toBe('Page not found');
    });

    it('should complete URL resolution in under 10ms', async () => {
      // Create a page
      await createPage(new NextRequest('http://localhost/api/pages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-website-id': websiteId
        },
        body: JSON.stringify({
          title: 'Performance Test',
          contentTypeId,
          slug: 'performance'
        })
      }));

      // Measure resolution time
      const startTime = Date.now();
      
      const resolveRequest = new NextRequest('http://localhost/api/pages/resolve?path=/performance', {
        method: 'GET',
        headers: {
          'x-website-id': websiteId
        }
      });

      await resolveUrl(resolveRequest);
      
      const endTime = Date.now();
      const duration = endTime - startTime;

      // Assert performance requirement
      expect(duration).toBeLessThan(10);
    });
  });

  describe('Authentication', () => {
    it('should return 401 for unauthenticated requests', async () => {
      (getServerSession as jest.Mock).mockResolvedValue(null);

      const request = new NextRequest('http://localhost/api/pages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-website-id': websiteId
        },
        body: JSON.stringify({
          title: 'Test',
          contentTypeId
        })
      });

      const response = await createPage(request);

      expect(response.status).toBe(401);
      const error = await response.json();
      expect(error.error).toBe('Unauthorized');
    });
  });

  describe('Concurrent Operations', () => {
    it('should handle concurrent page creations', async () => {
      const promises = Array.from({ length: 5 }, (_, i) => 
        createPage(new NextRequest('http://localhost/api/pages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-website-id': websiteId
          },
          body: JSON.stringify({
            title: `Concurrent Page ${i}`,
            contentTypeId,
            slug: `concurrent-${i}`
          })
        }))
      );

      const responses = await Promise.all(promises);
      const statuses = responses.map(r => r.status);

      // All should succeed
      expect(statuses.every(s => s === 201)).toBe(true);

      // Verify all pages exist
      const pages = await prisma.siteStructure.findMany({
        where: {
          websiteId,
          slug: { startsWith: 'concurrent-' }
        }
      });

      expect(pages).toHaveLength(5);
    });
  });
});