#!/usr/bin/env tsx

import dotenv from 'dotenv';
import path from 'path';

// override: true ensures .env.local takes precedence over shell environment
dotenv.config({ path: path.resolve(process.cwd(), '.env.local'), override: true });
import { BundleExporter } from '@/lib/services/export/bundle-exporter';
import { KontentProvider } from '@/lib/cms-export/kontent';

async function main() {
  const websiteId = process.argv[2];
  if (!websiteId) {
    console.error('Usage: run-kontent-sync <websiteId>');
    process.exit(1);
  }

  const parsedConcurrency = Number(process.env.KONTENT_MAX_CONCURRENCY);
  const maxConcurrency =
    Number.isFinite(parsedConcurrency) && parsedConcurrency > 0
      ? parsedConcurrency
      : undefined;

  const provider = new KontentProvider({
    environmentId: process.env.KONTENT_ENVIRONMENT_ID || '5ab1f731-664f-0083-cbe2-b5ae9c3d9ef5',
    managementApiKey: process.env.KONTENT_MANAGEMENT_API_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiI0ZGUzM2UxMjQ0NWE0ZTkwODA5ODI1NDFjMDA1ZmQwMSIsImlhdCI6MTc2MDA0ODg2MiwibmJmIjoxNzYwMDQ4ODYyLCJleHAiOjE3NzU3NzcyMjAsInZlciI6IjMuMC4wIiwidWlkIjoidmlydHVhbF9kZTk0MDc1MS1kYWQ0LTQzZDctYmRjOC1kYWM1ZTMzYWExNzciLCJzY29wZV9pZCI6ImUyMWJmNjFkNTNkYTQ1OWE4YWVkMDBlNjEyOGM3MTAyIiwicHJvamVjdF9jb250YWluZXJfaWQiOiIzMjdhNWYyZmQ4NmEwMDhkNGM2Y2UwMmFiYjg3OTgyMSIsImF1ZCI6Im1hbmFnZS5rZW50aWNvY2xvdWQuY29tIn0.9W8OQSNfRIyygxY2Dm7peVp3hkOPxFa_LUt-bUohgM0',
    languageCodename: process.env.KONTENT_LANGUAGE_CODE || 'default',
    rateLimitMs: Number(process.env.KONTENT_RATE_LIMIT_MS ?? '250'),
    maxRetries: Number(process.env.KONTENT_MAX_RETRIES ?? '5'),
    maxConcurrency,
  });
  console.log('Kontent sync concurrency', maxConcurrency ?? `${5} (default)`);
  const service = new BundleExporter(provider);

  const result = await service.export(websiteId, {
    includeComponents: true,
    includeContentItems: true,
  });

  console.log('Sync complete', {
    successCount: result.syncResults?.unifiedContent?.successCount,
    failureCount: result.syncResults?.unifiedContent?.failureCount,
  });

  if (result.syncResults?.unifiedContent?.details) {
    for (const detail of result.syncResults.unifiedContent.details) {
      if (detail.action === 'error') {
        console.error('Error detail', detail);
      }
    }
  }
}

main().catch(error => {
  console.error('Sync failed', error);
  process.exit(1);
});
