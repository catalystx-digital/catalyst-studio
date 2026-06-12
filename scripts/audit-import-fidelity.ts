#!/usr/bin/env tsx

import path from 'node:path'
import { promises as fs } from 'node:fs'
import dotenv from 'dotenv'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local'), quiet: true })
dotenv.config({ path: path.resolve(process.cwd(), '.env'), quiet: true })

interface Args {
  websiteId: string
  outDir: string
}

interface PageAudit {
  pageId: string
  title: string
  sourceUrl: string | null
  previewPath: string
  componentCount: number
  importedImageCount: number
  sourceImageCount: number
  malformedMediaRefs: string[]
  suspiciousImages: Array<{ path: string; url: string; reason: string }>
  emptyComponents: string[]
}

function readArg(name: string): string | undefined {
  const index = process.argv.indexOf(name)
  return index === -1 ? undefined : process.argv[index + 1]
}

function parseArgs(): Args {
  const websiteId = readArg('--website-id')
  if (!websiteId) {
    throw new Error('--website-id is required')
  }

  return {
    websiteId,
    outDir: readArg('--out-dir') ?? path.join('artifacts', 'import-fidelity-audit'),
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function hasNonEmptyString(value: unknown): boolean {
  return typeof value === 'string' && value.trim().length > 0
}

function hasNonEmptyArray(value: unknown): boolean {
  return Array.isArray(value) && value.length > 0
}

function hasMeaningfulFooterContent(content: Record<string, unknown>): boolean {
  return (
    hasNonEmptyString(content.logoAlt) ||
    hasNonEmptyString(content.siteName) ||
    hasNonEmptyString(content.description) ||
    hasNonEmptyString(content.copyright) ||
    isRecord(content.logo) ||
    hasNonEmptyArray(content.columns) ||
    hasNonEmptyArray(content.socialLinks) ||
    hasNonEmptyArray(content.legalLinks) ||
    isRecord(content.newsletter)
  )
}

function hasRealMenuItem(value: unknown): boolean {
  if (!isRecord(value)) return false
  const label = typeof (value.label ?? value.text ?? value.title) === 'string'
    ? String(value.label ?? value.text ?? value.title).trim()
    : ''
  const href = isRecord(value.href)
    ? value.href.path ?? value.href.url ?? value.href.href
    : value.href ?? value.url ?? value.link ?? value.path
  return label.length > 0 && typeof href === 'string' && href.trim().length > 0
}

function hasMeaningfulLogo(value: unknown): boolean {
  if (!isRecord(value)) return false
  if (hasNonEmptyString(value.text) || hasNonEmptyString(value.alt) || hasNonEmptyString(value.src)) {
    return true
  }
  return isRecord(value.src) && (
    hasNonEmptyString(value.src.url) ||
    hasNonEmptyString(value.src.src) ||
    hasNonEmptyString(value.src.originalUrl)
  )
}

function hasMeaningfulNavbarContent(content: Record<string, unknown>): boolean {
  const menuItems = Array.isArray(content.menuItems) ? content.menuItems : []
  const utilityNav = Array.isArray(content.utilityNav) ? content.utilityNav : []
  const search = isRecord(content.search) ? content.search : undefined
  const cta = isRecord(content.cta) ? content.cta : undefined

  return (
    menuItems.some(hasRealMenuItem) ||
    utilityNav.some(hasRealMenuItem) ||
    hasMeaningfulLogo(content.logo) ||
    search?.enabled === true ||
    Boolean(cta && hasNonEmptyString(cta.label) && hasRealMenuItem({ label: cta.label, href: cta.href }))
  )
}

function extractSourceImages(html: string): string[] {
  const images = new Set<string>()
  const regex = /<img\s+[^>]*?src\s*=\s*["']([^"']+)["'][^>]*>/gi
  let match: RegExpExecArray | null
  while ((match = regex.exec(html)) !== null) {
    const src = match[1]?.trim()
    if (src && !src.startsWith('data:')) {
      images.add(src)
    }
  }
  return Array.from(images)
}

function findSuspiciousReason(url: string, valuePath: string): string | null {
  if (/\blogo\b|\.logo\.|logo\./i.test(valuePath)) {
    return null
  }
  const lower = url.toLowerCase()
  if (lower.includes('facebook.com/tr?') || lower.includes('/tr?id=')) return 'tracking-pixel'
  if (lower.includes('pixel') || lower.includes('beacon') || lower.includes('tracking')) return 'tracking-pixel'
  if (lower.includes('favicon')) return 'favicon'
  if (lower.includes('logo') || lower.includes('brandmark')) return 'global-brand-asset'
  if (lower.includes('flag') || lower.includes('/flags/')) return 'flag-utility'
  if (lower.includes('auslan') || lower.includes('interpreter')) return 'accessibility-utility'
  return null
}

function deriveSourceUrl(params: { explicit: string | null; importUrl: string | null; previewPath: string }): string | null {
  if (params.explicit) {
    return params.explicit
  }
  if (!params.importUrl) {
    return null
  }
  try {
    const importUrl = new URL(params.importUrl)
    if (params.previewPath === '/') {
      return importUrl.toString()
    }
    return new URL(params.previewPath.replace(/\/?$/, '/'), importUrl.origin).toString()
  } catch {
    return null
  }
}

function resolveSharedComponentId(record: Record<string, unknown>): string | undefined {
  const props = isRecord(record.props) ? record.props : undefined
  const sharedId = props?.sharedComponentId
  return typeof sharedId === 'string' && sharedId.trim().length > 0 ? sharedId.trim() : undefined
}

function scanContent(value: unknown, sharedContentById: Map<string, unknown> = new Map()): {
  imageUrls: Array<{ path: string; url: string }>
  malformedMediaRefs: string[]
  suspiciousImages: Array<{ path: string; url: string; reason: string }>
  emptyComponents: string[]
} {
  const imageUrls: Array<{ path: string; url: string }> = []
  const malformedMediaRefs: string[] = []
  const suspiciousImages: Array<{ path: string; url: string; reason: string }> = []
  const emptyComponents: string[] = []

  const walk = (entry: unknown, trail: string[]): void => {
    if (!entry || typeof entry !== 'object') {
      return
    }

    if (Array.isArray(entry)) {
      entry.forEach((item, index) => walk(item, [...trail, String(index)]))
      return
    }

    const record = entry as Record<string, unknown>
    const componentType = typeof record.type === 'string' ? record.type : undefined
    const sharedContent = resolveSharedComponentId(record)
      ? sharedContentById.get(resolveSharedComponentId(record)!)
      : undefined
    const effectiveContent = isRecord(sharedContent) ? sharedContent : record.content

    if (componentType === 'navbar' && isRecord(effectiveContent) && !hasMeaningfulNavbarContent(effectiveContent)) {
      emptyComponents.push([...trail, componentType].join('.'))
    }
    if (componentType === 'footer' && isRecord(effectiveContent) && !hasMeaningfulFooterContent(effectiveContent)) {
      emptyComponents.push([...trail, componentType].join('.'))
    }
    if (
      componentType &&
      componentType !== 'navbar' &&
      componentType !== 'footer' &&
      !['breadcrumb', 'breadcrumbs'].includes(componentType) &&
      isRecord(effectiveContent) &&
      Object.keys(effectiveContent).length === 0
    ) {
      emptyComponents.push([...trail, componentType].join('.'))
    }

    if (trail.slice(-3).join('.') === 'image.src.url' && isRecord(record) && typeof record.src === 'string') {
      malformedMediaRefs.push(trail.join('.'))
    }

    for (const [key, child] of Object.entries(record)) {
      if (key === 'metadata' || key === 'sourceEvidence') {
        continue
      }
      const childPath = [...trail, key]
      if (typeof child === 'string' && /(^https?:\/\/|^\/).+\.(png|jpe?g|webp|gif|svg|avif)([?#].*)?$/i.test(child)) {
        imageUrls.push({ path: childPath.join('.'), url: child })
        const reason = findSuspiciousReason(child, childPath.join('.'))
        if (reason) {
          suspiciousImages.push({ path: childPath.join('.'), url: child, reason })
        }
      } else {
        walk(child, childPath)
      }
    }
  }

  walk(value, ['$'])
  return { imageUrls, malformedMediaRefs, suspiciousImages, emptyComponents }
}

async function fetchSourceImageCount(sourceUrl: string | null): Promise<number> {
  if (!sourceUrl) return 0
  try {
    const response = await fetch(sourceUrl)
    if (!response.ok) return 0
    const html = await response.text()
    return extractSourceImages(html).length
  } catch {
    return 0
  }
}

async function main() {
  const args = parseArgs()
  const { prisma } = await import('../lib/prisma')

  const pages = await prisma.websitePage.findMany({
    where: { websiteId: args.websiteId },
    select: {
      id: true,
      title: true,
      content: true,
      metadata: true,
      structures: {
        select: { fullPath: true },
        take: 1,
      },
    },
    orderBy: { createdAt: 'asc' },
  })
  const latestImportJob = await prisma.importJob.findFirst({
    where: { websiteId: args.websiteId },
    orderBy: { createdAt: 'desc' },
    select: { url: true },
  })
  const sharedComponents = await prisma.websiteSharedComponent.findMany({
    where: { websiteId: args.websiteId },
    select: { id: true, content: true },
  })
  const sharedContentById = new Map(sharedComponents.map(component => [component.id, component.content]))

  const audits: PageAudit[] = []
  for (const page of pages) {
    const metadata = isRecord(page.metadata) ? page.metadata : {}
    const explicitSourceUrl = typeof metadata.sourceUrl === 'string'
      ? metadata.sourceUrl
      : typeof metadata.importedFrom === 'string'
        ? metadata.importedFrom
        : null
    const previewPath = page.structures[0]?.fullPath ?? '/'
    const sourceUrl = deriveSourceUrl({
      explicit: explicitSourceUrl,
      importUrl: latestImportJob?.url ?? null,
      previewPath,
    })
    const scan = scanContent(page.content, sharedContentById)
    audits.push({
      pageId: page.id,
      title: page.title,
      sourceUrl,
      previewPath,
      componentCount: Array.isArray((page.content as Record<string, unknown> | null)?.components)
        ? ((page.content as Record<string, unknown>).components as unknown[]).length
        : 0,
      importedImageCount: scan.imageUrls.length,
      sourceImageCount: await fetchSourceImageCount(sourceUrl),
      malformedMediaRefs: scan.malformedMediaRefs,
      suspiciousImages: scan.suspiciousImages,
      emptyComponents: scan.emptyComponents,
    })
  }

  await fs.mkdir(args.outDir, { recursive: true })
  const outputPath = path.join(args.outDir, `${args.websiteId}.json`)
  await fs.writeFile(outputPath, JSON.stringify({ websiteId: args.websiteId, pages: audits }, null, 2))

  console.log(JSON.stringify({
    websiteId: args.websiteId,
    pages: audits.length,
    malformedMediaRefs: audits.reduce((sum, page) => sum + page.malformedMediaRefs.length, 0),
    suspiciousImages: audits.reduce((sum, page) => sum + page.suspiciousImages.length, 0),
    emptyComponents: audits.reduce((sum, page) => sum + page.emptyComponents.length, 0),
    outputPath,
  }, null, 2))
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
