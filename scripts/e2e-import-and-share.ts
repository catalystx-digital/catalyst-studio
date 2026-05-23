#!/usr/bin/env tsx

/**
 * End-to-end import + shared-detection using real DB and LLM pipeline
 *
 * What it does:
 * 1) Reads DATABASE_URL and OPENROUTER_API_KEY from .env.local/.env
 * 2) Upserts a website for the run
 * 3) Kicks off ImportService.startImport({ websiteId, url })
 * 4) Polls job progress until completed/failed
 * 5) Runs CanonicalSignatureSharedComponentDetector.detectShared and createAndUpdateInTransaction to persist globals
 * 6) Prints DB summary: pages created, WebsiteSharedComponent count, and per-page shared refs
 */

import fs from 'fs'
import path from 'path'
import dotenv from 'dotenv'
// Load env from .env.local if present; fallback to .env
// override: true ensures .env.local takes precedence over shell environment
(() => {
  const local = path.join(process.cwd(), '.env.local')
  if (fs.existsSync(local)) dotenv.config({ path: local, override: true })
  else dotenv.config({ override: true })
})()
import { PrismaClient, Prisma } from '../lib/generated/prisma'
import { start } from 'workflow/api'
import { ImportService } from '../lib/studio/import/services/import-service'
import { importWebsiteWorkflow } from '../lib/studio/workflows/import-website.workflow'
import { CanonicalSignatureSharedComponentDetector } from '../lib/studio/import/services/shared-component-detectors/canonical-signature-detector'

const prisma = new PrismaClient()

async function ensureWebsite(id: string) {
  return prisma.website.upsert({
    where: { id },
    update: {},
    create: {
      id,
      name: `Imported Site (${id})`,
      category: 'import',
      metadata: { createdBy: 'e2e-import-and-share' }
    }
  })
}

async function ensurePageContentType(websiteId: string) {
  const existing = await prisma.contentType.findFirst({ where: { websiteId, key: 'page' } })
  if (existing) return existing
  return prisma.contentType.create({
    data: {
      websiteId,
      key: 'page',
      name: 'Page',
      pluralName: 'Pages',
      displayField: 'title',
      category: 'page' as any,
      fields: { title: { type: 'string', required: true }, content: { type: 'json' } } as any
    }
  })
}

async function ensureGenericComponentType(websiteId: string) {
  const existing = await prisma.websiteComponentType.findFirst({ where: { websiteId, type: 'shared-generic' } })
  if (existing) return existing
  return prisma.websiteComponentType.create({
    data: {
      websiteId,
      type: 'shared-generic',
      category: 'content',
      defaultConfig: {},
      placeholderData: {},
      styles: {},
      aiMetadata: { source: 'e2e-import' },
      isGlobal: true
    }
  })
}

async function wait(ms: number) { return new Promise(r => setTimeout(r, ms)) }

async function run(url: string) {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set')
  if (!process.env.OPENROUTER_API_KEY) throw new Error('OPENROUTER_API_KEY is not set')

  // Keep import run bounded
  process.env.IMPORT_MAX_URLS = process.env.IMPORT_MAX_URLS || '5'
  process.env.IMPORT_PER_PAGE_TIMEOUT_MS = process.env.IMPORT_PER_PAGE_TIMEOUT_MS || '45000'
  process.env.IMPORT_MAX_TIMEOUT_MS = process.env.IMPORT_MAX_TIMEOUT_MS || '300000'

  const websiteId = 'import-e2e-site'
  const site = await ensureWebsite(websiteId)
  await ensurePageContentType(site.id)

  // Clean previous data for this website to avoid duplicates across runs
  console.log(`Cleaning existing data for website ${site.id}...`)
  await prisma.componentAnalytics.deleteMany({ where: { component: { websiteId: site.id } } as any }).catch(() => {})
  await prisma.websiteSharedComponent.deleteMany({ where: { websiteId: site.id } })
  await prisma.websiteComponentType.deleteMany({ where: { websiteId: site.id } })
  await prisma.websiteStructure.deleteMany({ where: { websiteId: site.id } })
  await prisma.websitePage.deleteMany({ where: { websiteId: site.id } })
  await prisma.contentType.deleteMany({ where: { websiteId: site.id } })
  // Recreate core content type after cleanup
  await ensurePageContentType(site.id)

  console.log(`Starting import for ${url} into website ${site.id}`)

  const importService = new ImportService()
  const accountId = site.accountId ?? 'import-e2e-account'
  const { job } = await importService.startImport({ websiteId: site.id, url, accountId })
  console.log(`Job created: ${job.id}`)

  // Start Vercel Workflow for the import
  await start(importWebsiteWorkflow, [{
    jobId: job.id,
    websiteId: site.id,
    url,
    accountId,
  }])
  console.log('Workflow started')

  // Poll until completion or failure
  let status = 'pending'
  let lastProgress = -1
  let stableTicks = 0
  const startTime = Date.now()
  while (true) {
    await wait(5000)
    const info = await importService.getJobProgress(job.id)
    status = info.status
    const p = info.progress
    if (p !== lastProgress) {
      stableTicks = 0
      lastProgress = p
      console.log(`Progress: ${p}% (${info.stage || ''}) ${info.message || ''}`)
    } else {
      stableTicks++
      // Stop if progress hasn't changed for ~2 minutes
      if (stableTicks > 24) break
    }
    if (status === 'completed' || status === 'failed' || status === 'cancelled') break
    // Safety timeout at ~12 minutes
    if (Date.now() - startTime > 12 * 60 * 1000) {
      console.warn('Timeout waiting for import; proceeding to analysis stage')
      break
    }
  }

  console.log(`Job status: ${status}`)

  // Load imported pages
  const pages = await prisma.websitePage.findMany({ where: { websiteId: site.id } })
  console.log(`Imported pages: ${pages.length}`)
  if (pages.length === 0) {
    console.error('No pages imported; cannot continue shared detection.')
    process.exit(1)
  }

  // Detect and persist shared components
  const detector = new CanonicalSignatureSharedComponentDetector(prisma as any)
  const candidates = await detector.detectShared(pages as any, { minOccurrences: 2, similarityThreshold: 0.6 })
  console.log(`Shared candidates detected: ${candidates.length}`)

  if (candidates.length > 0) {
    const compType = await ensureGenericComponentType(site.id)
    const res = await detector.createAndUpdateInTransaction(candidates, site.id, compType.id, pages as any)
    console.log(`Persisted ${res.sharedComponents.length} WebsiteSharedComponent rows and updated ${res.updatedPages.length} pages.`)
  }

  const rows = await prisma.websiteSharedComponent.findMany({ where: { websiteId: site.id } })
  console.log(`WebsiteSharedComponent rows: ${rows.length}`)

  const updatedPages = await prisma.websitePage.findMany({ where: { websiteId: site.id } })
  for (const p of updatedPages) {
    const comps = (p.content as any)?.components || []
    const sharedRefs = comps.filter((c: any) => c.isShared)
    console.log(`Page ${p.id}: components=${comps.length}, sharedRefs=${sharedRefs.length}`)
  }
}

const url = process.argv[2] || 'https://www.parra.catholic.edu.au/'
run(url)
  .catch(async (e) => { console.error('E2E import failed:', e); process.exitCode = 1 })
  .finally(async () => { await prisma.$disconnect() })
