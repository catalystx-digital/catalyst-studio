import { GET, POST } from '../route';
import { GET as GETBYID, PUT as PUTBYID, DELETE as DELETEBYID } from '../[id]/route';
import { NextRequest } from 'next/server';

// Mock prisma with factory function
jest.mock('@/lib/prisma', () => {
  const mockPrisma = {
    websiteComponentType: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    websiteSharedComponent: {
      count: jest.fn(),
    },
    website: {
      findUnique: jest.fn(),
    },
    $transaction: jest.fn((fn) => fn(mockPrisma)),
  };
  
  return {
    prisma: mockPrisma,
  };
});

import { prisma } from '@/lib/prisma';

describe('Website Component Type API Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/studio/site-builder/components', () => {
    it('should return all component types when websiteId is not provided', async () => {
      const mockComponentTypes = [
        {
          id: 'comp-1',
          websiteId: 'test-site',
          type: 'hero',
          category: 'marketing',
          defaultConfig: { 
            name: 'Hero Banner',
            description: 'Main hero component',
            layout: 'centered' 
          },
          placeholderData: { title: 'Welcome' },
          styles: null,
          aiMetadata: { tags: ['hero', 'banner'] },
          version: '1.0.0',
          isGlobal: false,
          confidence: 0.85,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'comp-2',
          websiteId: 'test-site',
          type: 'navbar',
          category: 'navigation',
          defaultConfig: { 
            name: 'Navigation Bar',
            description: 'Top navigation',
            style: 'horizontal' 
          },
          placeholderData: { links: [] },
          styles: null,
          aiMetadata: { tags: ['nav', 'menu'] },
          version: '1.0.0',
          isGlobal: true,
          confidence: 0.9,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      (prisma.websiteComponentType.findMany as jest.Mock).mockResolvedValue(mockComponentTypes);
      (prisma.websiteComponentType.count as jest.Mock).mockResolvedValue(2);

      const request = new NextRequest('http://localhost:3000/api/studio/site-builder/components');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.items).toHaveLength(2);
      expect(data.total).toBe(2);
      expect(prisma.websiteComponentType.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {},
          skip: 0,
          take: 10,
          orderBy: { createdAt: 'desc' },
        })
      );
    });

    it('should filter by websiteId when provided', async () => {
      const mockComponentTypes = [
        {
          id: 'comp-1',
          websiteId: 'test-site',
          type: 'hero',
          category: 'marketing',
          defaultConfig: { 
            name: 'Hero Banner'
          },
          placeholderData: { title: 'Welcome' },
          styles: null,
          aiMetadata: { tags: ['hero'] },
          version: '1.0.0',
          isGlobal: false,
          confidence: 0.85,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      (prisma.websiteComponentType.findMany as jest.Mock).mockResolvedValue(mockComponentTypes);
      (prisma.websiteComponentType.count as jest.Mock).mockResolvedValue(1);

      const request = new NextRequest('http://localhost:3000/api/studio/site-builder/components?websiteId=test-site');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.items).toHaveLength(1);
      expect(prisma.websiteComponentType.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { websiteId: 'test-site' },
        })
      );
    });

    it('should handle pagination parameters', async () => {
      const mockComponentTypes = Array(5).fill(null).map((_, i) => ({
        id: `comp-${i}`,
        websiteId: 'test-site',
        type: `component-${i}`,
        category: 'general',
        defaultConfig: { 
          name: `Component ${i}` 
        },
        placeholderData: {},
        styles: null,
        aiMetadata: {},
        version: '1.0.0',
        isGlobal: false,
        confidence: 0.8,
        createdAt: new Date(),
        updatedAt: new Date(),
      }));

      (prisma.websiteComponentType.findMany as jest.Mock).mockResolvedValue(mockComponentTypes);
      (prisma.websiteComponentType.count as jest.Mock).mockResolvedValue(10);

      const request = new NextRequest('http://localhost:3000/api/studio/site-builder/components?page=2&limit=5');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.page).toBe(2);
      expect(data.limit).toBe(5);
      expect(prisma.websiteComponentType.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 5, // (page - 1) * limit
          take: 5,
        })
      );
    });

    it('should filter by category', async () => {
      const request = new NextRequest('http://localhost:3000/api/studio/site-builder/components?category=marketing');
      
      (prisma.websiteComponentType.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.websiteComponentType.count as jest.Mock).mockResolvedValue(0);

      await GET(request);

      expect(prisma.websiteComponentType.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { category: 'marketing' },
        })
      );
    });
  });

  describe('POST /api/studio/site-builder/components', () => {
    it('should create a new component type', async () => {
      const newComponent = {
        websiteId: 'test-site',
        type: 'cta-button',
        category: 'marketing',
        defaultConfig: { 
          name: 'Call to Action',
          description: 'CTA button component',
          style: 'primary' 
        },
        placeholderData: { text: 'Click Here' },
        aiMetadata: { tags: ['cta', 'button'] },
        version: '1.0.0',
        isGlobal: false,
        confidence: 0.9,
      };

      const createdComponent = {
        id: 'new-comp-id',
        ...newComponent,
        styles: null,
        createdBy: 'api',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (prisma.websiteComponentType.create as jest.Mock).mockResolvedValue(createdComponent);

      const request = new NextRequest('http://localhost:3000/api/studio/site-builder/components', {
        method: 'POST',
        body: JSON.stringify(newComponent),
      });
      
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data).toMatchObject({
        id: 'new-comp-id',
        type: 'cta-button',
        defaultConfig: expect.objectContaining({
          name: 'Call to Action',
        }),
      });
    });
  });

  describe('GET /api/studio/site-builder/components/[id]', () => {
    it('should return a component type by ID', async () => {
      const mockComponent = {
        id: 'comp-1',
        websiteId: 'test-site',
        type: 'hero',
        category: 'marketing',
        defaultConfig: { 
          name: 'Hero Banner',
          description: 'Main hero component' 
        },
        placeholderData: { title: 'Welcome' },
        styles: null,
        aiMetadata: { tags: ['hero'] },
        version: '1.0.0',
        isGlobal: false,
        confidence: 0.85,
        createdAt: new Date(),
        updatedAt: new Date(),
        sharedComponents: [],
      };

      (prisma.websiteComponentType.findUnique as jest.Mock).mockResolvedValue(mockComponent);

      const request = new NextRequest('http://localhost:3000/api/studio/site-builder/components/comp-1');
      const response = await GETBYID(request, { params: { id: 'comp-1' } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.id).toBe('comp-1');
      expect(data.type).toBe('hero');
    });
  });

  describe('PUT /api/studio/site-builder/components/[id]', () => {
    it('should update a component type', async () => {
      const updateData = {
        defaultConfig: { 
          name: 'Hero Banner',
          description: 'Updated hero component with new features',
          layout: 'fullwidth' 
        },
      };

      const updatedComponent = {
        id: 'comp-1',
        websiteId: 'test-site',
        type: 'hero',
        category: 'marketing',
        ...updateData,
        placeholderData: { title: 'Welcome' },
        styles: null,
        aiMetadata: { tags: ['hero'] },
        version: '1.0.0',
        isGlobal: false,
        confidence: 0.85,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (prisma.websiteComponentType.update as jest.Mock).mockResolvedValue(updatedComponent);

      const request = new NextRequest('http://localhost:3000/api/studio/site-builder/components/comp-1', {
        method: 'PUT',
        body: JSON.stringify(updateData),
      });
      
      const response = await PUTBYID(request, { params: { id: 'comp-1' } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.defaultConfig.description).toContain('Updated hero component');
    });
  });

  describe('DELETE /api/studio/site-builder/components/[id]', () => {
    it('should delete a component type with no dependencies', async () => {
      (prisma.websiteSharedComponent.count as jest.Mock).mockResolvedValue(0);
      (prisma.websiteComponentType.delete as jest.Mock).mockResolvedValue({
        id: 'comp-1',
        type: 'deprecated',
        defaultConfig: { 
          name: 'Deprecated Component' 
        },
      });

      const request = new NextRequest('http://localhost:3000/api/studio/site-builder/components/comp-1', {
        method: 'DELETE',
      });
      
      const response = await DELETEBYID(request, { params: { id: 'comp-1' } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.message).toBe('Component type deleted successfully');
    });

    it('should prevent deletion of component with dependencies', async () => {
      (prisma.websiteSharedComponent.count as jest.Mock).mockResolvedValue(3);

      const request = new NextRequest('http://localhost:3000/api/studio/site-builder/components/comp-1', {
        method: 'DELETE',
      });
      
      const response = await DELETEBYID(request, { params: { id: 'comp-1' } });
      const data = await response.json();

      expect(response.status).toBe(409);
      expect(data.error).toContain('Cannot delete component type');
      expect(data.dependentCount).toBe(3);
    });
  });

  describe('Advanced Filtering and Edge Cases', () => {
    it('should filter by AI metadata tags', async () => {
      const mockComponent = {
        id: 'ai-comp-1',
        websiteId: 'test-site',
        type: 'smart-form',
        category: 'ai-enhanced',
        defaultConfig: { 
          name: 'Smart Form' 
        },
        placeholderData: {},
        styles: null,
        aiMetadata: { 
          tags: ['form', 'smart', 'ai'],
          confidence: 0.95,
        },
        version: '2.0.0',
        isGlobal: false,
        confidence: 0.95,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (prisma.websiteComponentType.findMany as jest.Mock).mockResolvedValue([mockComponent]);
      (prisma.websiteComponentType.count as jest.Mock).mockResolvedValue(1);

      const request = new NextRequest('http://localhost:3000/api/studio/site-builder/components?aiTag=smart');
      await GET(request);

      expect(prisma.websiteComponentType.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            aiMetadata: {
              path: '$.tags',
              array_contains: 'smart',
            },
          },
        })
      );
    });

    it('should handle multiple category filters', async () => {
      const mockComponents = [
        {
          id: 'comp-1',
          websiteId: 'test-site',
          type: 'hero',
          category: 'marketing',
          defaultConfig: { 
            name: 'AI Hero' 
          },
          placeholderData: {},
          styles: null,
          aiMetadata: {},
          version: '1.0.0',
          isGlobal: false,
          confidence: 0.8,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'comp-2',
          websiteId: 'test-site',
          type: 'navbar',
          category: 'navigation',
          defaultConfig: { 
            name: 'Navigation Bar' 
          },
          placeholderData: {},
          styles: null,
          aiMetadata: {},
          version: '1.0.0',
          isGlobal: true,
          confidence: 0.9,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'comp-3',
          websiteId: 'test-site',
          type: 'sidebar',
          category: 'layout',
          defaultConfig: { 
            name: 'Sidebar' 
          },
          placeholderData: {},
          styles: null,
          aiMetadata: {},
          version: '1.0.0',
          isGlobal: false,
          confidence: 0.85,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      (prisma.websiteComponentType.findMany as jest.Mock).mockResolvedValue(mockComponents);
      (prisma.websiteComponentType.count as jest.Mock).mockResolvedValue(3);

      const request = new NextRequest('http://localhost:3000/api/studio/site-builder/components?categories=marketing,navigation,layout');
      await GET(request);

      expect(prisma.websiteComponentType.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            category: { in: ['marketing', 'navigation', 'layout'] },
          },
        })
      );
    });

    it('should handle invalid request parameters gracefully', async () => {
      const request = new NextRequest('http://localhost:3000/api/studio/site-builder/components?page=invalid&limit=abc');
      
      (prisma.websiteComponentType.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.websiteComponentType.count as jest.Mock).mockResolvedValue(0);

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.page).toBe(1); // Default to page 1
      expect(data.limit).toBe(10); // Default limit
    });

    it('should handle database errors gracefully', async () => {
      (prisma.websiteComponentType.findMany as jest.Mock).mockRejectedValue(new Error('Database connection failed'));

      const request = new NextRequest('http://localhost:3000/api/studio/site-builder/components');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to fetch component types');
    });

    it('should validate required fields on POST', async () => {
      const invalidComponent = {
        // Missing required 'type' field
        category: 'marketing',
        defaultConfig: { 
          name: 'Hero' 
        },
      };

      const request = new NextRequest('http://localhost:3000/api/studio/site-builder/components', {
        method: 'POST',
        body: JSON.stringify(invalidComponent),
      });
      
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid request data');
    });

    it('should handle unique constraint violations', async () => {
      const duplicateComponent = {
        websiteId: 'test-site',
        type: 'existing-hero',
        category: 'marketing',
        defaultConfig: { 
          name: 'Hero',
          description: 'Another hero' 
        },
      };

      (prisma.websiteComponentType.create as jest.Mock).mockRejectedValue(
        new Error('Unique constraint failed on the fields: (`websiteId`, `type`)')
      );

      const request = new NextRequest('http://localhost:3000/api/studio/site-builder/components', {
        method: 'POST',
        body: JSON.stringify(duplicateComponent),
      });
      
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(409);
      expect(data.error).toBe('Component type already exists');
    });

    it('should handle partial updates with undefined fields', async () => {
      const partialUpdate = {
        defaultConfig: { 
          name: 'Form',
          style: 'modern' 
        },
        // Other fields undefined/not provided
      };

      (prisma.websiteComponentType.update as jest.Mock).mockResolvedValue({
        id: 'comp-1',
        websiteId: 'test-site',
        type: 'form',
        category: 'inputs',
        ...partialUpdate,
        placeholderData: {},
        styles: null,
        aiMetadata: {},
        version: '1.0.0',
        isGlobal: false,
        confidence: 0.8,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const request = new NextRequest('http://localhost:3000/api/studio/site-builder/components/comp-1', {
        method: 'PUT',
        body: JSON.stringify(partialUpdate),
      });
      
      const response = await PUTBYID(request, { params: { id: 'comp-1' } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(prisma.websiteComponentType.update).toHaveBeenCalledWith({
        where: { id: 'comp-1' },
        data: partialUpdate,
      });
    });
  });
});