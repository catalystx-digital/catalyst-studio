import { GENERIC_PAGE_TEMPLATE_KEY, FOLDER_TEMPLATE_KEY } from '@/lib/studio/pages/_core/constants'
import { PrismaClient, Prisma } from '@/lib/generated/prisma'
import { ensureTemplatePageTypes } from '@/lib/studio/import/services/template-page-type-seeder'

const FALLBACK_TEMPLATE_KEY = GENERIC_PAGE_TEMPLATE_KEY


interface BackfillOptions {
  apply: boolean
  websiteId?: string
}

const prisma = new PrismaClient()

function parseArgs(): BackfillOptions {
  const args = process.argv.slice(2)
  const apply = args.includes('--apply')
  const websiteArg = args.find(arg => arg.startsWith('--website='))
  return {
    apply,
    websiteId: websiteArg ? websiteArg.split('=')[1] : undefined
  }
}

type TemplateAssignment = {
  templateKey: string
  templateProps: Prisma.InputJsonValue
  metadata: Prisma.InputJsonValue
}

function pickTemplate(page: {
  title: string
  metadata: Prisma.JsonValue | null
  type: string
}): TemplateAssignment {
  const metadata = (page.metadata as Record<string, unknown> | null) ?? {}
  const templateMeta = (metadata.template as Record<string, unknown> | undefined) ?? {}
  const title = page.title.toLowerCase().trim()
  const isFolder = page.type === 'folder'
  const isHome = title === 'home' || title === 'homepage' || title === 'landing page'
  const templateKey = (templateMeta.key as string | undefined)
    ?? (isFolder ? FOLDER_TEMPLATE_KEY : (isHome ? 'marketing/home-default' : FALLBACK_TEMPLATE_KEY))
  const templateProps = ((templateMeta.props as Prisma.InputJsonValue | undefined) ?? Prisma.JsonNull) as unknown as Prisma.InputJsonValue
  const nextMetadata = {
    ...metadata,
    template: {
      ...templateMeta,
      key: templateKey,
      assignedAt: new Date().toISOString(),
      source: templateMeta.source ?? 'backfill-script'
    }
  } as Prisma.InputJsonValue

  return {
    templateKey,
    templateProps,
    metadata: nextMetadata
  }
}

async function backfillTemplates(options: BackfillOptions): Promise<void> {
  const { apply, websiteId } = options
  const whereClause = websiteId ? { websiteId } : {}

  const pages = await prisma.websitePage.findMany({
    where: {
      ...whereClause,
      type: {
        in: ['page', 'folder']
      }
    }
  })

  const missing = pages.filter(page => !page.templateKey)
  if (missing.length === 0) {
    console.log('✅ All website pages already have template assignments.')
    return
  }

  console.log(`🔎 Found ${missing.length} pages missing template metadata${websiteId ? ` for website ${websiteId}` : ''}.`)

  if (!apply) {
    const breakdown = new Map<string, number>()
    for (const page of missing) {
      const title = page.title.toLowerCase().trim()
      const key = page.type === 'folder'
        ? FOLDER_TEMPLATE_KEY
        : (title === 'home' || title === 'homepage' || title === 'landing page'
            ? 'marketing/home-default'
            : FALLBACK_TEMPLATE_KEY)
      breakdown.set(key, (breakdown.get(key) ?? 0) + 1)
    }
    console.log('ℹ️ Dry run mode. No changes will be written.')
    for (const [key, count] of breakdown.entries()) {
      console.log(`   • ${key} → ${count} pages`)
    }
    console.log('   • Re-run with --apply to persist changes.')
    return
  }

  console.log('✏️ Applying template assignments...')

  for (const page of missing) {
    const assignment = pickTemplate({ ...page, type: page.type })
    await prisma.websitePage.update({
      where: { id: page.id },
      data: {
        templateKey: assignment.templateKey,
        templateProps: assignment.templateProps,
        metadata: assignment.metadata
      }
    })
  }

  console.log('✅ Template backfill complete.')
}

async function backfillContentTypeAssignments(options: BackfillOptions): Promise<void> {
  const { apply, websiteId } = options

  const legacyContentTypes = await prisma.contentType.findMany({
    where: {
      ...(websiteId ? { websiteId } : {}),
      key: { in: ['page', 'page_content'] }
    },
    select: { id: true, websiteId: true, key: true }
  })

  if (legacyContentTypes.length === 0) {
    console.log('✅ No legacy page content types to backfill.')
    return
  }

  const legacyContentTypeIds = legacyContentTypes.map(ct => ct.id)
  const pagesNeedingUpdate = await prisma.websitePage.findMany({
    where: {
      ...(websiteId ? { websiteId } : {}),
      type: {
        in: ['page', 'folder']
      },
      contentTypeId: { in: legacyContentTypeIds }
    },
    select: {
      id: true,
      title: true,
      websiteId: true,
      contentTypeId: true,
      templateKey: true,
      type: true
    }
  })

  if (pagesNeedingUpdate.length === 0) {
    console.log('✅ No website pages reference the legacy content type. Nothing to update.')
    return
  }

  const byWebsite = new Map<string, typeof pagesNeedingUpdate>()
  for (const page of pagesNeedingUpdate) {
    const list = byWebsite.get(page.websiteId) ?? []
    list.push(page)
    byWebsite.set(page.websiteId, list)
  }

  if (!apply) {
    console.log('ℹ️ Dry run for content type reassignment. No changes will be written.')
    for (const [siteId, pages] of byWebsite) {
      const templateBreakdown = new Map<string, number>()
      for (const page of pages) {
        const key = page.templateKey || (page.type === 'folder' ? FOLDER_TEMPLATE_KEY : FALLBACK_TEMPLATE_KEY)
        templateBreakdown.set(key, (templateBreakdown.get(key) ?? 0) + 1)
      }
      console.log(`   • Website ${siteId}: ${pages.length} pages to update`)
      for (const [key, count] of templateBreakdown.entries()) {
        console.log(`     - ${key}: ${count}`)
      }
    }
    console.log('   • Re-run with --apply to persist content type updates.')
    return
  }

  console.log('✏️ Reassigning website page content types to template-specific records...')

  const templateMapCache = new Map<string, Map<string, string>>()

  const resolveTemplateMap = async (siteId: string) => {
    if (!templateMapCache.has(siteId)) {
      const map = await ensureTemplatePageTypes({ prisma, websiteId: siteId })
      templateMapCache.set(siteId, map)
    }
    return templateMapCache.get(siteId) as Map<string, string>
  }

  for (const [siteId, pages] of byWebsite) {
    const templateMap = await resolveTemplateMap(siteId)
    const fallbackId = templateMap.get(FALLBACK_TEMPLATE_KEY)

    if (!fallbackId) {
      console.warn(`⚠️ Skipping website ${siteId}: fallback template content type not found.`)
      continue
    }

    for (const page of pages) {
      const key = page.templateKey && templateMap.has(page.templateKey)
        ? page.templateKey
        : (page.type === 'folder' && templateMap.has(FOLDER_TEMPLATE_KEY)
            ? FOLDER_TEMPLATE_KEY
            : FALLBACK_TEMPLATE_KEY)

      const targetContentTypeId = templateMap.get(key)

      if (!targetContentTypeId) {
        console.warn(`⚠️ Skipping page ${page.id}: no content type for template ${key}`)
        continue
      }

      if (targetContentTypeId === page.contentTypeId) {
        continue
      }

      await prisma.websitePage.update({
        where: { id: page.id },
        data: { contentTypeId: targetContentTypeId }
      })
    }
  }

  console.log('✅ Content type reassignment complete.')
}

async function main(): Promise<void> {
  const options = parseArgs()
  try {
    await backfillTemplates(options)
    await backfillContentTypeAssignments(options)
  } catch (error) {
    console.error('❌ Backfill failed:', error)
    process.exitCode = 1
  } finally {
    await prisma.$disconnect()
  }
}

if (require.main === module) {
  // eslint-disable-next-line @typescript-eslint/no-floating-promises
  main()
}


