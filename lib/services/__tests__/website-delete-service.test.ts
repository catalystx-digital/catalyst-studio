import { deleteWebsiteWithDependencies } from '../website-delete-service';

describe('deleteWebsiteWithDependencies', () => {
  const websiteId = 'site-123';

  const createMockTx = () => {
    const calls: string[] = [];
    const tx: any = {
      contentReference: { deleteMany: jest.fn().mockImplementation(async () => { calls.push('contentReference'); }) },
      failedReference: { deleteMany: jest.fn().mockImplementation(async () => { calls.push('failedReference'); }) },
      nodePosition: { deleteMany: jest.fn().mockImplementation(async () => { calls.push('nodePosition'); }) },
      websiteStructure: { deleteMany: jest.fn().mockImplementation(async () => { calls.push('websiteStructure'); }) },
      websitePage: { deleteMany: jest.fn().mockImplementation(async () => { calls.push('websitePage'); }) },
      contentType: { deleteMany: jest.fn().mockImplementation(async () => { calls.push('contentType'); }) },
      componentAnalytics: { deleteMany: jest.fn().mockImplementation(async () => { calls.push('componentAnalytics'); }) },
      websiteSharedComponent: { deleteMany: jest.fn().mockImplementation(async () => { calls.push('websiteSharedComponent'); }) },
      websiteComponentType: { deleteMany: jest.fn().mockImplementation(async () => { calls.push('websiteComponentType'); }) },
      redirect: { deleteMany: jest.fn().mockImplementation(async () => { calls.push('redirect'); }) },
      deployment: { deleteMany: jest.fn().mockImplementation(async () => { calls.push('deployment'); }) },
      integrationUsage: { deleteMany: jest.fn().mockImplementation(async () => { calls.push('integrationUsage'); }) },
      websiteMediaUsage: { deleteMany: jest.fn().mockImplementation(async () => { calls.push('websiteMediaUsage'); }) },
      websiteMediaSource: { deleteMany: jest.fn().mockImplementation(async () => { calls.push('websiteMediaSource'); }) },
      websiteMedia: { deleteMany: jest.fn().mockImplementation(async () => { calls.push('websiteMedia'); }) },
      websiteDesignSystem: { deleteMany: jest.fn().mockImplementation(async () => { calls.push('websiteDesignSystem'); }) },
      websiteDesignConcept: { deleteMany: jest.fn().mockImplementation(async () => { calls.push('websiteDesignConcept'); }) },
      importPageDetection: { deleteMany: jest.fn().mockImplementation(async () => { calls.push('importPageDetection'); }) },
      importJob: { deleteMany: jest.fn().mockImplementation(async () => { calls.push('importJob'); }) },
      previewJob: { deleteMany: jest.fn().mockImplementation(async () => { calls.push('previewJob'); }) },
      accountApiKeyEvent: { deleteMany: jest.fn().mockImplementation(async () => { calls.push('accountApiKeyEvent'); }) },
      accountApiKey: { deleteMany: jest.fn().mockImplementation(async () => { calls.push('accountApiKey'); }) },
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
      'contentReference',
      'failedReference',
      'nodePosition',
      'websiteStructure',
      'websitePage',
      'contentType',
      'componentAnalytics',
      'websiteSharedComponent',
      'websiteComponentType',
      'redirect',
      'deployment',
      'integrationUsage',
      'websiteMediaUsage',
      'websiteMediaSource',
      'websiteMedia',
      'websiteDesignSystem',
      'websiteDesignConcept',
      'importPageDetection',
      'importJob',
      'previewJob',
      'accountApiKeyEvent',
      'accountApiKey',
      'aIContext',
      'website',
    ]);

    expect(tx.componentAnalytics.deleteMany).toHaveBeenCalledWith({ where: { component: { websiteId } } });
    expect(tx.website.delete).toHaveBeenCalledWith({ where: { id: websiteId } });
  });
});
