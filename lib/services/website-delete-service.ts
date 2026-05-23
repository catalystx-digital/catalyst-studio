import { Prisma } from '@/lib/generated/prisma';
import type { PrismaClient } from '@/lib/generated/prisma';

/**
 * Deletes a website and all dependent records.
 *
 * The order is important because the schema intentionally avoids cascading
 * deletes. Update this list if new relations are added.
 *
 * Tables with onDelete: Cascade on website relation will be auto-deleted,
 * but we explicitly delete them for clarity and to handle edge cases.
 *
 * Order matters:
 * 1. Delete leaf tables (no dependencies)
 * 2. Delete tables that reference other tables
 * 3. Delete parent tables last
 */
const deletionSteps = [
  // Delete content references first (references pages/media)
  async (tx: Prisma.TransactionClient, websiteId: string) => {
    await tx.contentReference.deleteMany({ where: { websiteId } });
  },
  async (tx: Prisma.TransactionClient, websiteId: string) => {
    await tx.failedReference.deleteMany({ where: { websiteId } });
  },
  // Delete node positions before structures (references structures)
  async (tx: Prisma.TransactionClient, websiteId: string) => {
    await tx.nodePosition.deleteMany({ where: { websiteId } });
  },
  // Delete structures before pages (structures reference pages)
  async (tx: Prisma.TransactionClient, websiteId: string) => {
    await tx.websiteStructure.deleteMany({ where: { websiteId } });
  },
  async (tx: Prisma.TransactionClient, websiteId: string) => {
    await tx.websitePage.deleteMany({ where: { websiteId } });
  },
  async (tx: Prisma.TransactionClient, websiteId: string) => {
    await tx.contentType.deleteMany({ where: { websiteId } });
  },
  async (tx: Prisma.TransactionClient, websiteId: string) => {
    await tx.componentAnalytics.deleteMany({ where: { component: { websiteId } } });
  },
  async (tx: Prisma.TransactionClient, websiteId: string) => {
    await tx.websiteSharedComponent.deleteMany({ where: { websiteId } });
  },
  async (tx: Prisma.TransactionClient, websiteId: string) => {
    await tx.websiteComponentType.deleteMany({ where: { websiteId } });
  },
  // Delete redirects
  async (tx: Prisma.TransactionClient, websiteId: string) => {
    await tx.redirect.deleteMany({ where: { websiteId } });
  },
  async (tx: Prisma.TransactionClient, websiteId: string) => {
    await tx.deployment.deleteMany({ where: { websiteId } });
  },
  async (tx: Prisma.TransactionClient, websiteId: string) => {
    await tx.integrationUsage.deleteMany({ where: { websiteId } });
  },
  // Delete media usages and sources before media
  async (tx: Prisma.TransactionClient, websiteId: string) => {
    await tx.websiteMediaUsage.deleteMany({ where: { websiteId } });
  },
  async (tx: Prisma.TransactionClient, websiteId: string) => {
    await tx.websiteMediaSource.deleteMany({ where: { websiteId } });
  },
  async (tx: Prisma.TransactionClient, websiteId: string) => {
    await tx.websiteMedia.deleteMany({ where: { websiteId } });
  },
  // Delete design systems before design concepts (design systems reference concepts)
  async (tx: Prisma.TransactionClient, websiteId: string) => {
    await tx.websiteDesignSystem.deleteMany({ where: { websiteId } });
  },
  async (tx: Prisma.TransactionClient, websiteId: string) => {
    await tx.websiteDesignConcept.deleteMany({ where: { websiteId } });
  },
  // Delete import page detections before import jobs
  async (tx: Prisma.TransactionClient, websiteId: string) => {
    await tx.importPageDetection.deleteMany({ where: { websiteId } });
  },
  async (tx: Prisma.TransactionClient, websiteId: string) => {
    await tx.importJob.deleteMany({ where: { websiteId } });
  },
  // Delete preview jobs
  async (tx: Prisma.TransactionClient, websiteId: string) => {
    await tx.previewJob.deleteMany({ where: { websiteId } });
  },
  // Delete API keys and their events (events have cascade, but explicit is clearer)
  async (tx: Prisma.TransactionClient, websiteId: string) => {
    await tx.accountApiKeyEvent.deleteMany({ where: { websiteId } });
  },
  async (tx: Prisma.TransactionClient, websiteId: string) => {
    await tx.accountApiKey.deleteMany({ where: { websiteId } });
  },
  async (tx: Prisma.TransactionClient, websiteId: string) => {
    await tx.aIContext.deleteMany({ where: { websiteId } });
  }
] as const;

export async function deleteWebsiteWithDependencies(
  prisma: PrismaClient,
  websiteId: string
): Promise<void> {
  await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    for (const step of deletionSteps) {
      await step(tx, websiteId);
    }

    await tx.website.delete({ where: { id: websiteId } });
  });
}

export function getDeletionStepCount(): number {
  return deletionSteps.length;
}
