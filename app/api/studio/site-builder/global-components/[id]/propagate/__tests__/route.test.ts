import { POST } from '../route';
import { NextRequest } from 'next/server';

jest.mock('@/lib/auth/context', () => ({
  getAuthContext: jest.fn().mockResolvedValue({ accountId: 'account-1' })
}));

jest.mock('@/lib/auth/ownership', () => ({
  assertWebsiteOwnership: jest.fn().mockResolvedValue(undefined)
}));

jest.mock('@/lib/services/unified-content-repository', () => ({
  ContentRepository: {
    saveSharedComponentContent: jest.fn(),
    convertFullPropsToOverrides: jest.fn()
  }
}));

jest.mock('@/lib/prisma', () => ({
  prisma: {
    websiteSharedComponent: {
      findUnique: jest.fn()
    },
    websitePage: {
      findMany: jest.fn()
    }
  }
}));

import { prisma } from '@/lib/prisma';
import { ContentRepository } from '@/lib/services/unified-content-repository';

describe('Global Components Propagation API', () => {
  const mockRequest = (body: Record<string, unknown>) => ({
    json: jest.fn().mockResolvedValue(body)
  }) as unknown as NextRequest;

  const mockParams = { id: 'test-component-id' };
  const mockSharedComponent = {
    id: 'test-component-id',
    websiteId: 'test-website-id',
    config: {}
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (prisma.websiteSharedComponent.findUnique as jest.Mock).mockResolvedValue(mockSharedComponent);
    (prisma.websitePage.findMany as jest.Mock).mockResolvedValue([]);
    (ContentRepository.saveSharedComponentContent as jest.Mock).mockResolvedValue(undefined);
    (ContentRepository.convertFullPropsToOverrides as jest.Mock).mockResolvedValue(undefined);
  });

  it('updates shared content without scanning page instances by default', async () => {
    const response = await POST(
      mockRequest({ properties: { title: 'New Title' } }),
      { params: Promise.resolve(mockParams) }
    );

    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({
      success: true,
      updated: 0,
      skipped: 0,
      errors: [],
      totalUsages: 0,
      partialSuccess: false,
      recoverableErrors: 0
    });
    expect(ContentRepository.saveSharedComponentContent).toHaveBeenCalledWith(
      'test-component-id',
      { title: 'New Title' },
      { mirrorDefaultProps: true }
    );
    expect(prisma.websitePage.findMany).not.toHaveBeenCalled();
  });

  it('dry-runs conversion for canonical props.sharedComponentId references only', async () => {
    (prisma.websitePage.findMany as jest.Mock).mockResolvedValue([
      {
        id: 'page-1',
        title: 'Page 1',
        content: {
          components: [
            { id: 'canonical-1', props: { sharedComponentId: 'test-component-id' } },
            { id: 'legacy-1', sharedComponentId: 'test-component-id' }
          ]
        }
      }
    ]);

    const response = await POST(
      mockRequest({
        properties: { title: 'New Title' },
        options: { convertToOverrides: true, dryRun: true }
      }),
      { params: Promise.resolve(mockParams) }
    );

    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({
      dryRun: true,
      wouldConvert: 1,
      affectedInstances: [
        {
          pageId: 'page-1',
          instanceId: 'canonical-1',
          hasOverrides: false,
          isUnified: true
        }
      ]
    });
  });

  it('does not convert root sharedComponentId references', async () => {
    (prisma.websitePage.findMany as jest.Mock).mockResolvedValue([
      {
        id: 'page-1',
        title: 'Page 1',
        content: {
          components: [
            { id: 'legacy-1', sharedComponentId: 'test-component-id' }
          ]
        }
      }
    ]);

    const response = await POST(
      mockRequest({
        properties: { title: 'New Title' },
        options: { convertToOverrides: true }
      }),
      { params: Promise.resolve(mockParams) }
    );

    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({
      success: true,
      converted: 0,
      attempted: 0,
      errors: []
    });
    expect(ContentRepository.convertFullPropsToOverrides).not.toHaveBeenCalled();
  });

  it('returns 404 when the shared component is missing', async () => {
    (prisma.websiteSharedComponent.findUnique as jest.Mock).mockResolvedValue(null);

    const response = await POST(
      mockRequest({ properties: { title: 'New Title' } }),
      { params: Promise.resolve(mockParams) }
    );

    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe('Shared component not found');
  });
});
