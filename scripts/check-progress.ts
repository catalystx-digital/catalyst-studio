import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env.local'), override: true });

import { PrismaClient } from '../lib/generated/prisma';
const prisma = new PrismaClient();

async function main() {
  const jobs = await prisma.importJob.findMany({
    where: { status: { in: ['processing', 'completed'] } },
    select: {
      id: true,
      status: true,
      detectionResults: true,
      updatedAt: true,
    },
    orderBy: { updatedAt: 'desc' },
    take: 5,
  });
  
  for (const job of jobs) {
    const dr = (job.detectionResults || {}) as Record<string, unknown>;
    console.log('---');
    console.log('Job ID:', job.id);
    console.log('Status:', job.status);
    console.log('Stored progress:', dr.progress);
    console.log('totalPages:', dr.totalPages);
    console.log('progressSummary:', JSON.stringify(dr.progressSummary));
    console.log('updatedAt:', job.updatedAt);
  }
  
  await prisma.$disconnect();
}

main();
