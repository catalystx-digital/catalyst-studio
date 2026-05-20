#!/usr/bin/env node

import { PrismaClient } from '../lib/generated/prisma'
import { CanonicalSignatureSharedComponentDetector } from '../lib/studio/import/services/shared-component-detectors/canonical-signature-detector'

// Mock Prisma Client for benchmarking
const mockPrisma = {
  websiteSharedComponent: {
    create: async () => ({ id: 'mock-id' }),
    update: async () => ({})
  },
  websitePage: {
    update: async () => ({})
  }
} as unknown as PrismaClient

interface BenchmarkResult {
  dataset: string
  pageCount: number
  candidates: number
  headerCandidates: number
  footerCandidates: number
  duplicateRate: number
  coverage: number
  falsePositives: number
  runtimeMs: number
  memoryUsageMB?: number
}

async function runBenchmark(name: string, pages: any[]): Promise<BenchmarkResult> {
  console.log(`\n=== Running ${name} Benchmark ===`)
  console.log(`Pages: ${pages.length}`)

  const detector = new CanonicalSignatureSharedComponentDetector(mockPrisma)

  // Measure initial memory if available
  const initialMemory = (global as any).process?.memoryUsage?.()
    ? (global as any).process.memoryUsage().heapUsed / 1024 / 1024
    : undefined

  const startTime = Date.now()
  const candidates = await detector.detectShared(pages)
  const endTime = Date.now()

  const finalMemory = (global as any).process?.memoryUsage?.()
    ? (global as any).process.memoryUsage().heapUsed / 1024 / 1024
    : undefined

  const headerCandidates = candidates.filter(c => c.category === 'header')
  const footerCandidates = candidates.filter(c => c.category === 'footer')

  // Calculate metrics as defined in PRD
  const duplicateRate = Math.max(headerCandidates.length, footerCandidates.length)
  const coverage = pages.length > 0
    ? Math.max(
        headerCandidates.length > 0 ? headerCandidates[0].pages.length / pages.length : 0,
        footerCandidates.length > 0 ? footerCandidates[0].pages.length / pages.length : 0
      )
    : 0

  // False positives = content components incorrectly grouped as shared
  const contentCandidates = candidates.filter(c => c.category === 'content')
  const falsePositives = contentCandidates.length

  const runtimeMs = endTime - startTime
  const memoryUsageMB = initialMemory && finalMemory ? finalMemory - initialMemory : undefined

  const result: BenchmarkResult = {
    dataset: name,
    pageCount: pages.length,
    candidates: candidates.length,
    headerCandidates: headerCandidates.length,
    footerCandidates: footerCandidates.length,
    duplicateRate,
    coverage,
    falsePositives,
    runtimeMs,
    memoryUsageMB
  }

  console.log(`Runtime: ${runtimeMs}ms`)
  console.log(`Candidates found: ${candidates.length}`)
  console.log(`Header candidates: ${headerCandidates.length}`)
  console.log(`Footer candidates: ${footerCandidates.length}`)
  console.log(`Duplicate rate: ${duplicateRate}`)
  console.log(`Coverage: ${coverage.toFixed(3)}`)
  console.log(`False positives: ${falsePositives}`)
  if (memoryUsageMB !== undefined) {
    console.log(`Memory usage: ${memoryUsageMB.toFixed(2)}MB`)
  }

  return result
}

function createDuplicateNavigationDataset(): any[] {
  const pages: any[] = []

  // Create 20 pages with duplicate navigation as described in PRD
  for (let i = 0; i < 20; i++) {
    const pageId = `page-${i}`
    pages.push({
      id: pageId,
      title: `Page ${i + 1}`,
      url: i === 0 ? '/' : `/page-${i + 1}`,
      content: {
        components: [
          {
            id: `header-${pageId}`,
            type: i % 3 === 0 ? 'header' : i % 3 === 1 ? 'main-header' : 'site-header',
            typeId: 'header-type',
            parentId: null,
            position: 0,
            props: {
              className: 'main-header',
              region: 'header',
              placementBucket: 'top',
              text: 'Welcome to Our Site',
              linkCount: '5-8',
              hasLogo: true
            }
          },
          {
            id: `nav-${pageId}`,
            type: 'navigation',
            typeId: 'nav-type',
            parentId: null,
            position: 1,
            props: {
              menuItemCount: '5-8',
              hasLogo: false
            }
          },
          {
            id: `content-${pageId}`,
            type: 'content',
            typeId: 'content-type',
            parentId: null,
            position: 2,
            props: {
              text: `Page ${i + 1} content goes here`
            }
          },
          {
            id: `footer-${pageId}`,
            type: i % 2 === 0 ? 'footer' : 'site-footer',
            typeId: 'footer-type',
            parentId: null,
            position: 3,
            props: {
              className: 'site-footer',
              region: 'footer',
              placementBucket: 'bottom',
              text: '© 2024 Our Company. All rights reserved.',
              linkCount: '4-8'
            }
          }
        ]
      }
    })
  }

  return pages
}

function createSyntheticDataset(pageCount: number): any[] {
  const pages: any[] = []

  for (let i = 0; i < pageCount; i++) {
    const pageId = `synthetic-page-${i}`
    const hasHeader = i % 10 !== 9 // 90% of pages have headers
    const hasFooter = i % 8 !== 7 // 87.5% of pages have footers
    const components: any[] = []

    if (hasHeader) {
      components.push({
        id: `header-${pageId}`,
        type: 'header',
        typeId: 'header-type',
        parentId: null,
        position: 0,
        props: {
          className: 'main-header',
          region: 'header',
          linkCount: Math.floor(Math.random() * 8) + 3,
          hasLogo: true,
          text: 'Site Header'
        }
      })
    }

    // Main content with some variation
    components.push({
      id: `content-${pageId}`,
      type: i % 5 === 0 ? 'hero' : 'content',
      typeId: 'content-type',
      parentId: null,
      position: components.length,
      props: {
        text: `Synthetic content for page ${i}`,
        className: i % 3 === 0 ? 'content-main' : 'content'
      }
    })

    if (hasFooter) {
      components.push({
        id: `footer-${pageId}`,
        type: 'footer',
        typeId: 'footer-type',
        parentId: null,
        position: components.length,
        props: {
          className: 'site-footer',
          region: 'footer',
          linkCount: Math.floor(Math.random() * 6) + 2,
          text: '© 2024 Company'
        }
      })
    }

    pages.push({
      id: pageId,
      title: `Synthetic Page ${i}`,
      url: i === 0 ? '/' : `/synthetic-${i}`,
      content: { components }
    })
  }

  return pages
}

async function main() {
  console.log('🚀 Starting Shared Component Benchmark Suite')
  console.log('📊 Using Canonical Hash Detection Strategy')
  console.log('⚠️  Note: Runtime may increase significantly on larger datasets (super-linear scaling)')

  const results: BenchmarkResult[] = []

  // Run benchmarks as specified in PRD
  results.push(await runBenchmark('duplicate-nav (20 pages)', createDuplicateNavigationDataset()))
  results.push(await runBenchmark('synthetic-120', createSyntheticDataset(120)))
  results.push(await runBenchmark('synthetic-300', createSyntheticDataset(300)))
  results.push(await runBenchmark('synthetic-600', createSyntheticDataset(600)))

  // Display final results table
  console.log('\n📈 Benchmark Results Summary')
  console.log('='.repeat(120))
  console.log('| Dataset | Pages | Candidates | Headers | Footers | Runtime (ms) | Duplicate Rate | Coverage | False Positives |')
  console.log('|'.padEnd(10, '-') + '|' +
              ''.padEnd(7, '-') + '|' +
              ''.padEnd(12, '-') + '|' +
              ''.padEnd(8, '-') + '|' +
              ''.padEnd(8, '-') + '|' +
              ''.padEnd(13, '-') + '|' +
              ''.padEnd(16, '-') + '|' +
              ''.padEnd(10, '-') + '|' +
              ''.padEnd(17, '-') + '|')

  results.forEach(result => {
    console.log(`| ${result.dataset.padEnd(24)} | ${result.pageCount.toString().padEnd(5)} | ${result.candidates.toString().padEnd(10)} | ${result.headerCandidates.toString().padEnd(6)} | ${result.footerCandidates.toString().padEnd(6)} | ${result.runtimeMs.toString().padEnd(11)} | ${result.duplicateRate.toString().padEnd(14)} | ${result.coverage.toFixed(3).padEnd(8)} | ${result.falsePositives.toString().padEnd(15)} |`)
  })

  // Performance analysis
  console.log('\n🔍 Performance Analysis')
  const avgRuntimePer120Pages = results
    .filter(r => r.pageCount >= 120)
    .reduce((sum, r) => sum + (r.runtimeMs / r.pageCount) * 120, 0) /
    results.filter(r => r.pageCount >= 120).length

  if (avgRuntimePer120Pages) {
    console.log(`Average runtime per 120 pages: ${avgRuntimePer120Pages.toFixed(2)}ms`)
    console.log(`Scaling factor from 120 to 300 pages: ${((results.find(r => r.pageCount === 300)?.runtimeMs || 0) / (results.find(r => r.pageCount === 120)?.runtimeMs || 1) * (120/300)).toFixed(2)}x`)
    console.log(`Scaling factor from 300 to 600 pages: ${((results.find(r => r.pageCount === 600)?.runtimeMs || 0) / (results.find(r => r.pageCount === 300)?.runtimeMs || 1) * (300/600)).toFixed(2)}x`)
  }

  // Check if we meet PRD criteria
  console.log('\n✅ PRD Criteria Check')
  const duplicateNavResult = results.find(r => r.dataset.includes('duplicate-nav'))
  if (duplicateNavResult) {
    console.log(`Duplicate Rate (target ≤ 1): ${duplicateNavResult.duplicateRate} ${duplicateNavResult.duplicateRate <= 1 ? '✅' : '❌'}`)
    console.log(`Coverage (target ≈ 1.00): ${duplicateNavResult.coverage.toFixed(3)} ${duplicateNavResult.coverage >= 0.95 ? '✅' : '❌'}`)
    console.log(`False Positives (target = 0): ${duplicateNavResult.falsePositives} ${duplicateNavResult.falsePositives === 0 ? '✅' : '❌'}`)
  }

  console.log('\n🏁 Benchmark suite completed!')
}

// Run if executed directly
if (require.main === module) {
  main().catch(console.error)
}