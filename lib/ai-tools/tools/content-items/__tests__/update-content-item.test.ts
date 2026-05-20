import { updateContentItem } from '../update-content-item';
import { getClient } from '@/lib/db/client';
import { getContentType } from '@/lib/services/content-type-service';
import { businessRules } from '@/lib/ai-tools/business-rules';

jest.mock('@/lib/db/client', () => ({
  getClient: jest.fn()
}));

jest.mock('@/lib/services/content-type-service', () => ({
  getContentType: jest.fn()
}));

jest.mock('@/lib/ai-tools/business-rules', () => ({
  businessRules: {
    validateForCategory: jest.fn()
  }
}));

describe('AI Tools - Update Content Item', () => {
  let mockPrisma: any;
  let mockTransaction: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockTransaction = jest.fn((callback) => callback({
      websitePage: {
        update: jest.fn()
      },
      websiteCustomContentData: {
        update: jest.fn()
      }
    }));
    
    mockPrisma = {
      websitePage: {
        findUnique: jest.fn()
      },
      websiteCustomContentData: {
        findUnique: jest.fn()
      },
      $transaction: mockTransaction
    };
    
    (getClient as jest.Mock).mockReturnValue(mockPrisma);
    (businessRules.validateForCategory as jest.Mock).mockResolvedValue({ valid: true });
  });

  it('should find and update a page from websitePage model', async () => {
    const mockPage = {
      id: 'page1',
      title: 'Test Page',
      type: 'page',
      content: { components: [] },
      metadata: {},
      websiteId: 'website1',
      contentTypeId: 'contentType1',
      status: 'draft',
      createdAt: new Date(),
      updatedAt: new Date(),
      contentType: {
        id: 'contentType1',
        name: 'Page',
        fields: { fields: [] },
        category: 'page'
      },
      website: {
        id: 'website1',
        name: 'Test Website',
        category: 'business'
      }
    };

    const updatedPage = { ...mockPage, title: 'Updated Page', status: 'published' };

    mockPrisma.websitePage.findUnique.mockResolvedValue(mockPage);
    mockPrisma.websiteCustomContentData.findUnique.mockResolvedValue(null);
    (getContentType as jest.Mock).mockResolvedValue(mockPage.contentType);
    
    mockTransaction.mockImplementation(async (callback) => {
      const tx = {
        websitePage: {
          update: jest.fn().mockResolvedValue(updatedPage)
        },
        websiteCustomContentData: {
          update: jest.fn()
        }
      };
      return callback(tx);
    });

    const result = await updateContentItem.execute({
      id: 'page1',
      title: 'Updated Page',
      status: 'published'
    });

    expect(result.success).toBe(true);
    expect(result.item.title).toBe('Updated Page');
    expect(result.item.status).toBe('published');
    expect(result.item.modelType).toBe('page');
    
    expect(mockPrisma.websitePage.findUnique).toHaveBeenCalledWith({
      where: { id: 'page1' },
      include: {
        contentType: true,
        website: true
      }
    });
  });

  it('should find and update custom content from websiteCustomContentData model', async () => {
    const mockCustomContent = {
      id: 'custom1',
      title: 'Test Custom',
      data: { field1: 'value1' },
      websiteId: 'website1',
      contentTypeId: 'contentType2',
      status: 'draft',
      createdAt: new Date(),
      updatedAt: new Date(),
      contentType: {
        id: 'contentType2',
        name: 'Custom',
        fields: { fields: [] },
        category: 'component'
      },
      website: {
        id: 'website1',
        name: 'Test Website',
        category: 'business'
      }
    };

    const updatedCustom = { ...mockCustomContent, title: 'Updated Custom' };

    mockPrisma.websitePage.findUnique.mockResolvedValue(null);
    mockPrisma.websiteCustomContentData.findUnique.mockResolvedValue(mockCustomContent);
    (getContentType as jest.Mock).mockResolvedValue(mockCustomContent.contentType);
    
    mockTransaction.mockImplementation(async (callback) => {
      const tx = {
        websitePage: {
          update: jest.fn()
        },
        websiteCustomContentData: {
          update: jest.fn().mockResolvedValue(updatedCustom)
        }
      };
      return callback(tx);
    });

    const result = await updateContentItem.execute({
      id: 'custom1',
      title: 'Updated Custom'
    });

    expect(result.success).toBe(true);
    expect(result.item.title).toBe('Updated Custom');
    expect(result.item.modelType).toBe('customContent');
    
    expect(mockPrisma.websiteCustomContentData.findUnique).toHaveBeenCalledWith({
      where: { id: 'custom1' },
      include: {
        contentType: true,
        website: true
      }
    });
  });

  it('should return error when item not found in either model', async () => {
    mockPrisma.websitePage.findUnique.mockResolvedValue(null);
    mockPrisma.websiteCustomContentData.findUnique.mockResolvedValue(null);

    const result = await updateContentItem.execute({
      id: 'nonexistent',
      title: 'Test'
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('not found in either pages or custom content');
  });

  it('should merge data correctly for pages', async () => {
    const mockPage = {
      id: 'page1',
      title: 'Test Page',
      type: 'page',
      content: { existing: 'data' },
      metadata: {},
      websiteId: 'website1',
      contentTypeId: 'contentType1',
      status: 'draft',
      createdAt: new Date(),
      updatedAt: new Date(),
      contentType: {
        id: 'contentType1',
        name: 'Page',
        fields: { fields: [] },
        category: 'page'
      },
      website: {
        id: 'website1',
        name: 'Test Website',
        category: 'business'
      }
    };

    mockPrisma.websitePage.findUnique.mockResolvedValue(mockPage);
    (getContentType as jest.Mock).mockResolvedValue(mockPage.contentType);
    
    const updatedPage = {
      ...mockPage,
      content: { existing: 'data', new: 'field' }
    };
    
    mockTransaction.mockImplementation(async (callback) => {
      const tx = {
        websitePage: {
          update: jest.fn().mockResolvedValue(updatedPage)
        },
        websiteCustomContentData: {
          update: jest.fn()
        }
      };
      return callback(tx);
    });

    const result = await updateContentItem.execute({
      id: 'page1',
      data: { new: 'field' }
    });

    expect(result.success).toBe(true);
    expect(result.item.content).toEqual({ existing: 'data', new: 'field' });
  });

  it('should merge data correctly for custom content', async () => {
    const mockCustom = {
      id: 'custom1',
      title: 'Test Custom',
      data: { existing: 'value' },
      websiteId: 'website1',
      contentTypeId: 'contentType2',
      status: 'draft',
      createdAt: new Date(),
      updatedAt: new Date(),
      contentType: {
        id: 'contentType2',
        name: 'Custom',
        fields: { fields: [] },
        category: 'component'
      },
      website: {
        id: 'website1',
        name: 'Test Website',
        category: 'business'
      }
    };

    mockPrisma.websitePage.findUnique.mockResolvedValue(null);
    mockPrisma.websiteCustomContentData.findUnique.mockResolvedValue(mockCustom);
    (getContentType as jest.Mock).mockResolvedValue(mockCustom.contentType);
    
    const updatedCustom = {
      ...mockCustom,
      data: { existing: 'value', new: 'field' }
    };
    
    mockTransaction.mockImplementation(async (callback) => {
      const tx = {
        websitePage: {
          update: jest.fn()
        },
        websiteCustomContentData: {
          update: jest.fn().mockResolvedValue(updatedCustom)
        }
      };
      return callback(tx);
    });

    const result = await updateContentItem.execute({
      id: 'custom1',
      data: { new: 'field' }
    });

    expect(result.success).toBe(true);
    expect(result.item.content).toEqual({ existing: 'value', new: 'field' });
  });

  it('should validate required fields', async () => {
    const mockPage = {
      id: 'page1',
      title: 'Test Page',
      type: 'page',
      content: { requiredField: 'value' },
      metadata: {},
      websiteId: 'website1',
      contentTypeId: 'contentType1',
      status: 'draft',
      createdAt: new Date(),
      updatedAt: new Date(),
      contentType: {
        id: 'contentType1',
        name: 'Page',
        fields: {
          fields: [
            {
              name: 'requiredField',
              label: 'Required Field',
              type: 'text',
              required: true
            }
          ]
        },
        category: 'page'
      },
      website: {
        id: 'website1',
        name: 'Test Website',
        category: 'business'
      }
    };

    mockPrisma.websitePage.findUnique.mockResolvedValue(mockPage);
    (getContentType as jest.Mock).mockResolvedValue(mockPage.contentType);

    const result = await updateContentItem.execute({
      id: 'page1',
      data: { requiredField: null }
    });

    expect(result.success).toBe(false);
    expect(result.validationErrors).toBeDefined();
  });

  it('should handle errors gracefully', async () => {
    const error = new Error('Database connection failed');
    mockPrisma.websitePage.findUnique.mockRejectedValue(error);

    const result = await updateContentItem.execute({
      id: 'page1',
      title: 'Test'
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('Database connection failed');
    expect(result.executionTime).toBeDefined();
  });
});