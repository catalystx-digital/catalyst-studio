import { deleteWebsiteWithDependencies } from '../website-delete-service';

describe('deleteWebsiteWithDependencies', () => {
  const websiteId = 'site-123';

  const createMockTx = () => {
    const calls: string[] = [];
    const tx: any = {
      websiteStructure: { deleteMany: jest.fn().mockImplementation(async () => { calls.push('websiteStructure'); }) },
      websitePage: { deleteMany: jest.fn().mockImplementation(async () => { calls.push('websitePage'); }) },
      websiteCustomContentData: { deleteMany: jest.fn().mockImplementation(async () => { calls.push('websiteCustomContentData'); }) },
      contentType: { deleteMany: jest.fn().mockImplementation(async () => { calls.push('contentType'); }) },
      componentAnalytics: { deleteMany: jest.fn().mockImplementation(async () => { calls.push('componentAnalytics'); }) },
      websiteSharedComponent: { deleteMany: jest.fn().mockImplementation(async () => { calls.push('websiteSharedComponent'); }) },
      websiteComponentType: { deleteMany: jest.fn().mockImplementation(async () => { calls.push('websiteComponentType'); }) },
      redirect: { deleteMany: jest.fn().mockImplementation(async () => { calls.push('redirect'); }) },
      deployment: { deleteMany: jest.fn().mockImplementation(async () => { calls.push('deployment'); }) },
      integrationUsage: { deleteMany: jest.fn().mockImplementation(async () => { calls.push('integrationUsage'); }) },
      importJob: { deleteMany: jest.fn().mockImplementation(async () => { calls.push('importJob'); }) },
      aIContext: { deleteMany: jest.fn().mockImplementation(async () => { calls.push('aIContext'); }) },
      website: { delete: jest.fn().mockImplementation(async () => { calls.push('website'); }) },
    };

    return { tx, calls };
  };

  it('deletes dependent records in the expected order before removing the website', async () => {
    const { tx, calls } = createMockTx();
    const prisma: any = {
      $transaction: jest.fn(async (callback: (transaction: typeof tx) => Promise<void>) => {
        await callback(tx);
      }),
    };

    await deleteWebsiteWithDependencies(prisma, websiteId);

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(calls).toEqual([
      'websiteStructure',
      'websitePage',
      'websiteCustomContentData',
      'contentType',
      'componentAnalytics',
      'websiteSharedComponent',
      'websiteComponentType',
      'redirect',
      'deployment',
      'integrationUsage',
      'importJob',
      'aIContext',
      'website',
    ]);

    expect(tx.componentAnalytics.deleteMany).toHaveBeenCalledWith({ where: { component: { websiteId } } });
    expect(tx.website.delete).toHaveBeenCalledWith({ where: { id: websiteId } });
  });
});
