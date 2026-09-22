#!/usr/bin/env tsx
/**
 * End-to-end smoke test against real pages.
 *
 * Runs the production detection service — post-processors included — so the
 * fixes on this branch are exercised the way an import would exercise them,
 * not through a harness that reimplements them.
 *
 * What it is looking for, per page:
 *   - the page still imports at all (no throw, components produced)
 *   - pageTemplate.source reports 'url-scorer' rather than claiming 'model'
 *   - a paginated blog index does NOT collapse into a single blog-post
 *
 * Usage: tsx scripts/decisions/smoke-real-pages.ts <url> [url...]
 */
import { getDetectionService } from '@/lib/studio/import/web-detection'

function isPaginatedIndex(url: string): boolean {
  try {
    return /\/page\/\d+\/?$/.test(new URL(url).pathname)
  } catch {
    return false
  }
}

async function main() {
  const urls = process.argv.slice(2)
  if (urls.length === 0) {
    console.error('usage: smoke-real-pages.ts <url> [url...]')
    process.exit(1)
  }

  const service = getDetectionService()
  let failures = 0

  for (const url of urls) {
    console.log(`\n${'='.repeat(74)}`)
    console.log(url)
    try {
      const result = await service.detectComponentsFromUrl(url, { includeContent: true })
      const types = result.components.map(component => component.type)

      console.log(`  components (${types.length}): ${types.join(', ') || '(none)'}`)
      console.log(`  pageTemplate: ${result.pageTemplate?.templateKey ?? '(none)'}`)
      console.log(`  template source: ${result.pageTemplate?.source ?? '(none)'}`)
      console.log(`  ${Math.round(result.processingTime / 1000)}s, ${result.tokenUsage} tokens, $${(result.cost ?? 0).toFixed(4)}`)

      // The honesty fix: the URL keyword scorer must no longer claim to be a model.
      if (result.pageTemplate?.source === 'model') {
        console.log('  FAIL — template source says "model"; the scorer should report "url-scorer"')
        failures++
      }

      // The page-2 regression: a paginated index must not become one article.
      if (isPaginatedIndex(url)) {
        const blogPosts = types.filter(type => type === 'blog-post').length
        const hasListing = types.some(type =>
          type === 'blog-list' || type === 'content-feed' || type === 'card-grid'
        )
        if (blogPosts > 0 && !hasListing) {
          console.log(`  FAIL — paginated index collapsed into ${blogPosts} blog-post and no listing`)
          failures++
        } else {
          console.log(`  ok — paginated index kept a listing (blog-post x${blogPosts})`)
        }
      }

      if (types.length === 0) {
        console.log('  WARN — no components detected')
      }
    } catch (error) {
      console.log(`  THREW — ${error instanceof Error ? error.message : String(error)}`)
      failures++
    }
  }

  console.log(`\n${'='.repeat(74)}`)
  console.log(failures === 0 ? 'All checks passed.' : `${failures} check(s) failed.`)
  process.exitCode = failures === 0 ? 0 : 1
}

main()
