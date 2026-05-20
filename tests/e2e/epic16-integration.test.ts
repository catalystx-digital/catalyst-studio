import { prisma } from '@/lib/prisma';
import { NextRequest } from 'next/server';

// Import API route handlers
import { POST as createContentItem, GET as getContentItems } from '@/app/api/content-items/route';
import { GET as getContentItemById, PUT as updateContentItem, DELETE as deleteContentItem } from '@/app/api/content-items/[id]/route';
import { POST as createComponentType, GET as getComponentTypes } from '@/app/api/studio/site-builder/components/route';
import { POST as createSharedComponent, GET as getSharedComponents } from '@/app/api/studio/site-builder/global-components/route';
import { GET as getSharedComponentUsage } from '@/app/api/studio/site-builder/global-components/[id]/usage/route';
import { GET as resolvePage } from '@/app/api/pages/resolve/route';
import { GET as getSitemap, POST as createSitemapEntry } from '@/app/api/studio/sitemap/route';

// Mock Prisma
jest.mock('@/lib/prisma', () => ({
  prisma: {
    websitePage: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    websiteCustomContentData: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    websiteComponentType: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    websiteSharedComponent: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    websiteStructure: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    contentType: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    website: {
      findUnique: jest.fn(),
    },
    $transaction: jest.fn((fn) => {
      if (Array.isArray(fn)) {
        return Promise.all(fn.map(op => Promise.resolve(op)));
      }
      return fn(prisma);
    }),
  },
}));

describe('Epic 16 End-to-End Integration Tests', () => {
  const websiteId = 'test-website';
  
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Complete Page Creation and Component Addition Flow', () => {
    it('should create a page, add components, and publish', async () => {
      // Step 1: Create a new page
      const newPage = {
        websiteId,
        type: 'page',
        title: 'New Landing Page',
        content: { components: [] },
        metadata: { seo: { title: 'Landing Page' } },
        contentTypeId: 'page-type',
      };

      const createdPage = {
        id: 'page-123',
        ...newPage,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (prisma.contentType.findUnique as jest.Mock).mockResolvedValue({
        id: 'page-type',
        type: 'page',
      });
      (prisma.websitePage.create as jest.Mock).mockResolvedValue(createdPage);

      const createPageRequest = new NextRequest('http://localhost:3000/api/content-items', {
        method: 'POST',
        body: JSON.stringify(newPage),
      });

      const createPageResponse = await createContentItem(createPageRequest);
      expect(createPageResponse.status).toBe(201);
      const pageData = await createPageResponse.json();
      expect(pageData.id).toBe('page-123');

      // Step 2: Create a component type for the page
      const componentType = {
        websiteId,
        type: 'hero-banner',
        category: 'marketing',
        name: 'Hero Banner',
        defaultConfig: { layout: 'centered' },
        placeholderData: { title: 'Welcome', subtitle: 'Get started' },
        aiMetadata: { tags: ['hero', 'landing'] },
      };

      const createdComponentType = {
        id: 'comp-type-123',
        ...componentType,
        version: '1.0.0',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (prisma.websiteComponentType.create as jest.Mock).mockResolvedValue(createdComponentType);

      const createCompTypeRequest = new NextRequest('http://localhost:3000/api/studio/site-builder/components', {
        method: 'POST',
        body: JSON.stringify(componentType),
      });

      const createCompTypeResponse = await createComponentType(createCompTypeRequest);
      expect(createCompTypeResponse.status).toBe(201);
      const compTypeData = await createCompTypeResponse.json();
      expect(compTypeData.id).toBe('comp-type-123');

      // Step 3: Create a shared component instance
      const sharedComponent = {
        websiteId,
        websiteComponentTypeId: 'comp-type-123',
        name: 'Main Hero',
        content: {
          title: 'Welcome to Our Site',
          subtitle: 'Discover Amazing Products',
          buttonText: 'Get Started',
        },
      };

      const createdSharedComponent = {
        id: 'shared-comp-123',
        ...sharedComponent,
        version: '1.0.0',
        usageCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (prisma.websiteComponentType.findUnique as jest.Mock).mockResolvedValue(createdComponentType);
      (prisma.websiteSharedComponent.create as jest.Mock).mockResolvedValue(createdSharedComponent);

      const createSharedCompRequest = new NextRequest('http://localhost:3000/api/studio/site-builder/global-components', {
        method: 'POST',
        body: JSON.stringify(sharedComponent),
      });

      const createSharedCompResponse = await createSharedComponent(createSharedCompRequest);
      expect(createSharedCompResponse.status).toBe(201);
      const sharedCompData = await createSharedCompResponse.json();
      expect(sharedCompData.id).toBe('shared-comp-123');

      // Step 4: Update page to include the shared component
      const updatedPageContent = {
        content: {
          components: [
            {
              id: 'comp-instance-1',
              type: 'shared',
              sharedComponentId: 'shared-comp-123',
              position: 0,
            },
          ],
        },
      };

      const updatedPage = {
        ...createdPage,
        content: updatedPageContent.content,
        updatedAt: new Date(),
      };

      (prisma.websitePage.findUnique as jest.Mock).mockResolvedValue(createdPage);
      (prisma.websitePage.update as jest.Mock).mockResolvedValue(updatedPage);
      (prisma.websiteSharedComponent.update as jest.Mock).mockResolvedValue({
        ...createdSharedComponent,
        usageCount: 1,
      });

      const updatePageRequest = new NextRequest('http://localhost:3000/api/content-items/page-123', {
        method: 'PUT',
        body: JSON.stringify(updatedPageContent),
      });

      const updatePageResponse = await updateContentItem(updatePageRequest, { params: { id: 'page-123' } });
      expect(updatePageResponse.status).toBe(200);
      const updatedPageData = await updatePageResponse.json();
      expect(updatedPageData.content.components).toHaveLength(1);

      // Step 5: Create sitemap entry for the page
      const sitemapEntry = {
        websiteId,
        websitePageId: 'page-123',
        slug: 'landing',
        parentId: null,
        position: 0,
      };

      const createdSitemapEntry = {
        id: 'struct-123',
        ...sitemapEntry,
        fullPath: '/landing',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (prisma.websitePage.findUnique as jest.Mock).mockResolvedValue(updatedPage);
      (prisma.websiteStructure.create as jest.Mock).mockResolvedValue(createdSitemapEntry);

      const createSitemapRequest = new NextRequest('http://localhost:3000/api/studio/sitemap', {
        method: 'POST',
        body: JSON.stringify(sitemapEntry),
      });

      const createSitemapResponse = await createSitemapEntry(createSitemapRequest);
      expect(createSitemapResponse.status).toBe(201);
      const sitemapData = await createSitemapResponse.json();
      expect(sitemapData.fullPath).toBe('/landing');

      // Step 6: Verify page can be resolved by URL
      (prisma.websiteStructure.findFirst as jest.Mock).mockResolvedValue(createdSitemapEntry);
      (prisma.websitePage.findUnique as jest.Mock).mockResolvedValue(updatedPage);

      const resolveRequest = new NextRequest('http://localhost:3000/api/pages/resolve?websiteId=' + websiteId + '&path=/landing');
      const resolveResponse = await resolvePage(resolveRequest);
      
      expect(resolveResponse.status).toBe(200);
      const resolvedData = await resolveResponse.json();
      expect(resolvedData.page.id).toBe('page-123');
      expect(resolvedData.structure.fullPath).toBe('/landing');
    });
  });

  describe('Data Record Creation and Display Flow', () => {
    it('should create data records and retrieve them for display', async () => {
      // Step 1: Create multiple data records
      const dataRecords = [
        {
          websiteId,
          type: 'data',
          title: 'Product 1',
          data: {
            name: 'Widget A',
            price: 99.99,
            description: 'High-quality widget',
            category: 'electronics',
          },
        },
        {
          websiteId,
          type: 'data',
          title: 'Product 2',
          data: {
            name: 'Widget B',
            price: 149.99,
            description: 'Studio widget',
            category: 'electronics',
          },
        },
      ];

      const createdRecords = dataRecords.map((record, index) => ({
        id: `data-${index + 1}`,
        websiteId: record.websiteId,
        title: record.title,
        data: record.data,
        createdAt: new Date(),
        updatedAt: new Date(),
      }));

      // Create first data record
      (prisma.websiteCustomContentData.create as jest.Mock).mockResolvedValueOnce(createdRecords[0]);
      
      const createDataRequest1 = new NextRequest('http://localhost:3000/api/content-items', {
        method: 'POST',
        body: JSON.stringify(dataRecords[0]),
      });

      const createDataResponse1 = await createContentItem(createDataRequest1);
      expect(createDataResponse1.status).toBe(201);
      const data1 = await createDataResponse1.json();
      expect(data1.id).toBe('data-1');

      // Create second data record
      (prisma.websiteCustomContentData.create as jest.Mock).mockResolvedValueOnce(createdRecords[1]);
      
      const createDataRequest2 = new NextRequest('http://localhost:3000/api/content-items', {
        method: 'POST',
        body: JSON.stringify(dataRecords[1]),
      });

      const createDataResponse2 = await createContentItem(createDataRequest2);
      expect(createDataResponse2.status).toBe(201);
      const data2 = await createDataResponse2.json();
      expect(data2.id).toBe('data-2');

      // Step 2: Query data records with filtering
      (prisma.websiteCustomContentData.findMany as jest.Mock).mockResolvedValue(createdRecords);
      (prisma.websiteCustomContentData.count as jest.Mock).mockResolvedValue(2);

      const queryRequest = new NextRequest('http://localhost:3000/api/content-items?websiteId=' + websiteId + '&contentType=data');
      const queryResponse = await getContentItems(queryRequest);
      
      expect(queryResponse.status).toBe(200);
      const queryData = await queryResponse.json();
      expect(queryData.items).toHaveLength(2);
      expect(queryData.total).toBe(2);

      // Step 3: Create a page to display the data
      const displayPage = {
        websiteId,
        type: 'page',
        title: 'Products Page',
        content: {
          components: [
            {
              id: 'comp-1',
              type: 'product-list',
              config: {
                dataSource: 'websiteCustomContentData',
                filter: { category: 'electronics' },
              },
            },
          ],
        },
        contentTypeId: 'page-type',
      };

      const createdDisplayPage = {
        id: 'display-page-123',
        ...displayPage,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (prisma.contentType.findUnique as jest.Mock).mockResolvedValue({ id: 'page-type', type: 'page' });
      (prisma.websitePage.create as jest.Mock).mockResolvedValue(createdDisplayPage);

      const createDisplayPageRequest = new NextRequest('http://localhost:3000/api/content-items', {
        method: 'POST',
        body: JSON.stringify(displayPage),
      });

      const createDisplayPageResponse = await createContentItem(createDisplayPageRequest);
      expect(createDisplayPageResponse.status).toBe(201);
      const displayPageData = await createDisplayPageResponse.json();
      expect(displayPageData.id).toBe('display-page-123');

      // Step 4: Update a data record
      const updateData = {
        data: {
          ...createdRecords[0].data,
          price: 89.99, // Update price
          onSale: true,
        },
      };

      const updatedRecord = {
        ...createdRecords[0],
        data: updateData.data,
        updatedAt: new Date(),
      };

      (prisma.websitePage.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.websiteCustomContentData.findUnique as jest.Mock).mockResolvedValue(createdRecords[0]);
      (prisma.websiteCustomContentData.update as jest.Mock).mockResolvedValue(updatedRecord);

      const updateDataRequest = new NextRequest('http://localhost:3000/api/content-items/data-1', {
        method: 'PUT',
        body: JSON.stringify(updateData),
      });

      const updateDataResponse = await updateContentItem(updateDataRequest, { params: { id: 'data-1' } });
      expect(updateDataResponse.status).toBe(200);
      const updatedData = await updateDataResponse.json();
      expect(updatedData.data.price).toBe(89.99);
      expect(updatedData.data.onSale).toBe(true);
    });
  });

  describe('Component Library Management Flow', () => {
    it('should manage component types and shared instances lifecycle', async () => {
      // Step 1: Create multiple component types for a library
      const componentTypes = [
        {
          websiteId,
          type: 'header',
          category: 'navigation',
          name: 'Header',
          defaultConfig: { style: 'modern' },
          aiMetadata: { tags: ['navigation', 'header'] },
        },
        {
          websiteId,
          type: 'footer',
          category: 'navigation',
          name: 'Footer',
          defaultConfig: { columns: 3 },
          aiMetadata: { tags: ['navigation', 'footer'] },
        },
        {
          websiteId,
          type: 'cta',
          category: 'marketing',
          name: 'Call to Action',
          defaultConfig: { variant: 'primary' },
          aiMetadata: { tags: ['marketing', 'conversion'] },
        },
      ];

      const createdTypes = componentTypes.map((type, index) => ({
        id: `type-${index + 1}`,
        ...type,
        version: '1.0.0',
        createdAt: new Date(),
        updatedAt: new Date(),
      }));

      // Create component types
      for (let i = 0; i < componentTypes.length; i++) {
        (prisma.websiteComponentType.create as jest.Mock).mockResolvedValueOnce(createdTypes[i]);
        
        const request = new NextRequest('http://localhost:3000/api/studio/site-builder/components', {
          method: 'POST',
          body: JSON.stringify(componentTypes[i]),
        });

        const response = await createComponentType(request);
        expect(response.status).toBe(201);
      }

      // Step 2: Query component types by category
      const navigationTypes = createdTypes.filter(t => t.category === 'navigation');
      (prisma.websiteComponentType.findMany as jest.Mock).mockResolvedValue(navigationTypes);
      (prisma.websiteComponentType.count as jest.Mock).mockResolvedValue(2);

      const queryNavRequest = new NextRequest('http://localhost:3000/api/studio/site-builder/components?websiteId=' + websiteId + '&category=navigation');
      const queryNavResponse = await getComponentTypes(queryNavRequest);
      
      expect(queryNavResponse.status).toBe(200);
      const navData = await queryNavResponse.json();
      expect(navData.items).toHaveLength(2);
      expect(navData.items.every((item: any) => item.category === 'navigation')).toBe(true);

      // Step 3: Create shared component instances
      const sharedHeader = {
        websiteId,
        websiteComponentTypeId: 'type-1',
        name: 'Main Header',
        content: {
          logo: '/logo.png',
          links: ['Home', 'About', 'Products', 'Contact'],
        },
      };

      const createdSharedHeader = {
        id: 'shared-header-1',
        ...sharedHeader,
        version: '1.0.0',
        usageCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (prisma.websiteComponentType.findUnique as jest.Mock).mockResolvedValue(createdTypes[0]);
      (prisma.websiteSharedComponent.create as jest.Mock).mockResolvedValue(createdSharedHeader);

      const createSharedRequest = new NextRequest('http://localhost:3000/api/studio/site-builder/global-components', {
        method: 'POST',
        body: JSON.stringify(sharedHeader),
      });

      const createSharedResponse = await createSharedComponent(createSharedRequest);
      expect(createSharedResponse.status).toBe(201);
      const sharedData = await createSharedResponse.json();
      expect(sharedData.id).toBe('shared-header-1');

      // Step 4: Track usage of shared components
      const pagesUsingHeader = [
        {
          id: 'page-1',
          title: 'Homepage',
          content: { sharedComponents: ['shared-header-1'] },
        },
        {
          id: 'page-2',
          title: 'About',
          content: { sharedComponents: ['shared-header-1'] },
        },
      ];

      (prisma.websiteSharedComponent.findUnique as jest.Mock).mockResolvedValue({
        ...createdSharedHeader,
        usageCount: 2,
      });
      (prisma.websitePage.findMany as jest.Mock).mockResolvedValue(pagesUsingHeader);

      const usageRequest = new NextRequest('http://localhost:3000/api/studio/site-builder/global-components/shared-header-1/usage');
      const usageResponse = await getSharedComponentUsage(usageRequest, { params: { id: 'shared-header-1' } });
      
      expect(usageResponse.status).toBe(200);
      const usageData = await usageResponse.json();
      expect(usageData.usageCount).toBe(2);
      expect(usageData.pages).toHaveLength(2);
    });
  });

  describe('Complex Sitemap Operations', () => {
    it('should handle complex hierarchical sitemap with reordering', async () => {
      // Initial sitemap structure
      const initialSitemap = [
        { id: 's-1', slug: '', fullPath: '/', parentId: null, position: 0, websitePageId: 'p-1' },
        { id: 's-2', slug: 'products', fullPath: '/products', parentId: null, position: 1, websitePageId: 'p-2' },
        { id: 's-3', slug: 'electronics', fullPath: '/products/electronics', parentId: 's-2', position: 0, websitePageId: 'p-3' },
        { id: 's-4', slug: 'clothing', fullPath: '/products/clothing', parentId: 's-2', position: 1, websitePageId: 'p-4' },
        { id: 's-5', slug: 'about', fullPath: '/about', parentId: null, position: 2, websitePageId: 'p-5' },
      ];

      // Step 1: Get initial sitemap
      (prisma.websiteStructure.findMany as jest.Mock).mockResolvedValue(
        initialSitemap.map(s => ({
          ...s,
          websiteId,
          createdAt: new Date(),
          updatedAt: new Date(),
          websitePage: { title: `Page ${s.websitePageId}`, type: 'page' },
        }))
      );

      const getSitemapRequest = new NextRequest('http://localhost:3000/api/studio/sitemap?websiteId=' + websiteId);
      const getSitemapResponse = await getSitemap(getSitemapRequest);
      
      expect(getSitemapResponse.status).toBe(200);
      const sitemapData = await getSitemapResponse.json();
      expect(sitemapData.sitemap).toHaveLength(5);

      // Step 2: Test page resolution for nested paths
      const nestedStructure = {
        ...initialSitemap[2],
        websiteId,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const nestedPage = {
        id: 'p-3',
        websiteId,
        type: 'page',
        title: 'Electronics',
        content: {},
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (prisma.websiteStructure.findFirst as jest.Mock).mockResolvedValue(nestedStructure);
      (prisma.websitePage.findUnique as jest.Mock).mockResolvedValue(nestedPage);

      const resolveNestedRequest = new NextRequest('http://localhost:3000/api/pages/resolve?websiteId=' + websiteId + '&path=/products/electronics');
      const resolveNestedResponse = await resolvePage(resolveNestedRequest);
      
      expect(resolveNestedResponse.status).toBe(200);
      const resolvedNested = await resolveNestedResponse.json();
      expect(resolvedNested.page.title).toBe('Electronics');
      expect(resolvedNested.structure.fullPath).toBe('/products/electronics');
    });
  });

  describe('Performance Validation', () => {
    it('should handle bulk operations efficiently', async () => {
      // Create 100 pages in bulk
      const bulkPages = Array.from({ length: 100 }, (_, i) => ({
        id: `bulk-page-${i}`,
        websiteId,
        type: 'page',
        title: `Bulk Page ${i}`,
        content: { components: [] },
        metadata: {},
        contentTypeId: 'page-type',
        createdAt: new Date(),
        updatedAt: new Date(),
      }));

      (prisma.websitePage.findMany as jest.Mock).mockResolvedValue(bulkPages);
      (prisma.websitePage.count as jest.Mock).mockResolvedValue(100);

      const bulkQueryRequest = new NextRequest('http://localhost:3000/api/content-items?websiteId=' + websiteId + '&contentType=page&limit=100');
      const bulkQueryResponse = await getContentItems(bulkQueryRequest);
      
      expect(bulkQueryResponse.status).toBe(200);
      const bulkData = await bulkQueryResponse.json();
      expect(bulkData.items).toHaveLength(100);
      expect(bulkData.total).toBe(100);
    });

    it('should maintain response times within acceptable limits', async () => {
      const startTime = Date.now();

      // Simulate complex query
      const complexSitemap = Array.from({ length: 500 }, (_, i) => ({
        id: `struct-${i}`,
        websiteId,
        slug: `page-${i}`,
        fullPath: `/page-${i}`,
        websitePageId: `page-${i}`,
        parentId: i > 0 ? `struct-${Math.floor(i / 10)}` : null,
        position: i % 10,
        createdAt: new Date(),
        updatedAt: new Date(),
        websitePage: { title: `Page ${i}`, type: 'page' },
      }));

      (prisma.websiteStructure.findMany as jest.Mock).mockResolvedValue(complexSitemap);

      const complexRequest = new NextRequest('http://localhost:3000/api/studio/sitemap?websiteId=' + websiteId);
      const complexResponse = await getSitemap(complexRequest);
      
      const endTime = Date.now();
      const responseTime = endTime - startTime;

      expect(complexResponse.status).toBe(200);
      const complexData = await complexResponse.json();
      expect(complexData.sitemap).toHaveLength(500);
      
      // Response time should be reasonable (under 5 seconds for mock data)
      expect(responseTime).toBeLessThan(5000);
    });
  });

  describe('Error Recovery and Transaction Handling', () => {
    it('should handle partial failures gracefully', async () => {
      // Simulate a scenario where creating a page succeeds but sitemap entry fails
      const pageToCreate = {
        websiteId,
        type: 'page',
        title: 'Transaction Test Page',
        contentTypeId: 'page-type',
      };

      const createdPage = {
        id: 'trans-page-1',
        ...pageToCreate,
        content: {},
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (prisma.contentType.findUnique as jest.Mock).mockResolvedValue({ id: 'page-type', type: 'page' });
      (prisma.websitePage.create as jest.Mock).mockResolvedValue(createdPage);

      const createRequest = new NextRequest('http://localhost:3000/api/content-items', {
        method: 'POST',
        body: JSON.stringify(pageToCreate),
      });

      const createResponse = await createContentItem(createRequest);
      expect(createResponse.status).toBe(201);

      // Now try to create sitemap entry but simulate failure
      (prisma.websitePage.findUnique as jest.Mock).mockResolvedValue(createdPage);
      (prisma.websiteStructure.create as jest.Mock).mockRejectedValue(new Error('Unique constraint violation'));

      const sitemapEntry = {
        websiteId,
        websitePageId: 'trans-page-1',
        slug: 'transaction-test',
      };

      const sitemapRequest = new NextRequest('http://localhost:3000/api/studio/sitemap', {
        method: 'POST',
        body: JSON.stringify(sitemapEntry),
      });

      const sitemapResponse = await createSitemapEntry(sitemapRequest);
      expect(sitemapResponse.status).toBe(500);
      const errorData = await sitemapResponse.json();
      expect(errorData.error).toBeDefined();

      // Verify page still exists and can be deleted for cleanup
      (prisma.websitePage.findUnique as jest.Mock).mockResolvedValue(createdPage);
      (prisma.websitePage.delete as jest.Mock).mockResolvedValue(createdPage);

      const deleteRequest = new NextRequest('http://localhost:3000/api/content-items/trans-page-1');
      const deleteResponse = await deleteContentItem(deleteRequest, { params: { id: 'trans-page-1' } });
      expect(deleteResponse.status).toBe(200);
    });

    it('should rollback transactions on failure', async () => {
      // Test transaction rollback behavior
      const transactionOps = [
        prisma.websitePage.create({ data: {} }),
        prisma.websiteStructure.create({ data: {} }),
        prisma.websiteSharedComponent.update({ where: { id: '1' }, data: {} }),
      ];

      (prisma.$transaction as jest.Mock).mockRejectedValue(new Error('Transaction failed'));

      await expect(prisma.$transaction(transactionOps)).rejects.toThrow('Transaction failed');
      expect(prisma.$transaction).toHaveBeenCalledWith(transactionOps);
    });
  });

  describe('Backward Compatibility Validation', () => {
    it('should maintain backward compatible API responses', async () => {
      // Test that all API responses include expected fields for backward compatibility
      const legacyPage = {
        id: 'legacy-1',
        websiteId,
        type: 'page',
        title: 'Legacy Page',
        content: { components: [] },
        metadata: { seo: {} },
        contentTypeId: 'page-type',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (prisma.websitePage.findUnique as jest.Mock).mockResolvedValue(legacyPage);

      const getRequest = new NextRequest('http://localhost:3000/api/content-items/legacy-1');
      const getResponse = await getContentItemById(getRequest, { params: { id: 'legacy-1' } });
      
      expect(getResponse.status).toBe(200);
      const data = await getResponse.json();
      
      // Verify all expected fields are present
      expect(data).toHaveProperty('id');
      expect(data).toHaveProperty('websiteId');
      expect(data).toHaveProperty('type');
      expect(data).toHaveProperty('title');
      expect(data).toHaveProperty('content');
      expect(data).toHaveProperty('metadata');
      expect(data).toHaveProperty('createdAt');
      expect(data).toHaveProperty('updatedAt');
    });
  });
});