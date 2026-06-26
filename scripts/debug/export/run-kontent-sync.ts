#!/usr/bin/env tsx

import dotenv from 'dotenv';
import path from 'path';

// override: true ensures .env.local takes precedence over shell environment
dotenv.config({ path: path.resolve(process.cwd(), '.env.local'), override: true });
import { BundleExporter } from '@/lib/services/export/bundle-exporter';
import { KontentProvider } from '@/lib/cms-export/kontent';

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required. Set it in .env.local or the shell before running Kontent sync.`);
  }
  return value;
}

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
    environmentId: requireEnv('KONTENT_ENVIRONMENT_ID'),
    managementApiKey: requireEnv('KONTENT_MANAGEMENT_API_KEY'),
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
