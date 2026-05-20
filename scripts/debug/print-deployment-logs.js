#!/usr/bin/env node

const { PrismaClient } = require('../../lib/generated/prisma');

async function main() {
  const prisma = new PrismaClient();
  try {
    const deployments = await prisma.deployment.findMany({
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: {
        id: true,
        websiteId: true,
        provider: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        deploymentData: true,
        errorMessage: true,
      },
    });

    if (deployments.length === 0) {
      console.log('No deployments found.');
      return;
    }

    for (const deployment of deployments) {
      const data = (deployment.deploymentData || {});
      const logs = Array.isArray(data.logs) ? data.logs : [];

      console.log('='.repeat(80));
      console.log(`Deployment ${deployment.id}`);
      console.log(`  Website:   ${deployment.websiteId}`);
      console.log(`  Provider:  ${deployment.provider}`);
      console.log(`  Status:    ${deployment.status}`);
      console.log(`  Created:   ${deployment.createdAt.toISOString()}`);
      console.log(`  Updated:   ${deployment.updatedAt.toISOString()}`);
      if (deployment.errorMessage) {
        console.log(`  Error:     ${deployment.errorMessage}`);
      }
      console.log(`  Logs (${logs.length} entries):`);
      for (const log of logs) {
        const timestamp = typeof log.timestamp === 'string' ? log.timestamp : '';
        const level = typeof log.level === 'string' ? log.level.toUpperCase() : 'INFO';
        const message = log.message;
        console.log(`    [${timestamp}] [${level}] ${message}`);
      }
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(error => {
  console.error('Failed to print deployment logs', error);
  process.exit(1);
});
