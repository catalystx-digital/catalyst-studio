#!/usr/bin/env tsx
/**
 * Runs real sitemap discovery against a site in shadow mode, so page.isInternal
 * is asked about every candidate url while the old two-substring rule still
 * decides. Discovery is the only path that asks that question.
 *
 * Usage: tsx scripts/decisions/shadow-discovery.ts <url> [maxUrls]
 */
import { SitemapDiscoveryService } from '@/lib/studio/import/services/sitemap-discovery.service'

async function main() {
  const [url, maxUrlsArg] = process.argv.slice(2)
  if (!url) {
    console.error('usage: shadow-discovery.ts <url> [maxUrls]')
    process.exit(1)
  }
  const maxUrls = Number.parseInt(maxUrlsArg ?? '40', 10)

  const service = new SitemapDiscoveryService()
  const started = Date.now()
  const result = await service.expandUrlsForImport(url, { maxUrls })

  console.log(`\ndiscovered ${result.urls.length} url(s) in ${Math.round((Date.now() - started) / 1000)}s`)
  for (const discovered of result.urls) {
    console.log(`  ${discovered}`)
  }
}

main()
