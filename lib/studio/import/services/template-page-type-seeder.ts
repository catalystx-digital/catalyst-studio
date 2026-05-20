import type { PrismaClient } from '@/lib/generated/prisma'
import { Prisma } from '@/lib/generated/prisma'
import { getPageCatalogSummary } from '@/lib/studio/ai/page-catalog'

interface EnsureTemplatePageTypesOptions {
  prisma: Pick<PrismaClient, 'contentType'>
  websiteId: string
}

function buildContentTypeKey(templateKey: string): string {
  const normalized = templateKey
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9/\-]+/g, '-')
    .replace(/[\/]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
  return normalized ? `template-${normalized}` : 'template-page'
}

function buildPluralName(name: string): string {
  const trimmed = name.trim()
  if (trimmed.length === 0) {
    return 'Pages'
  }
  if (/pages?$/i.test(trimmed)) {
    return trimmed
  }
  if (/post$/i.test(trimmed)) {
    return `${trimmed}s`
  }
  return `${trimmed} Pages`
}

export async function ensureTemplatePageTypes({
  prisma,
  websiteId
}: EnsureTemplatePageTypesOptions): Promise<Map<string, string>> {
  const contentTypeClient = prisma.contentType as PrismaClient['contentType']
  if (!contentTypeClient || typeof contentTypeClient.upsert !== 'function') {
    console.warn('[TemplatePageTypeSeeder] Prisma contentType client unavailable; skipping seeding')
    return new Map()
  }

  const summary = await getPageCatalogSummary()
  const operations = summary.templates.map(async template => {
    const key = buildContentTypeKey(template.templateKey)
    const name = template.name?.trim() || 'Page'
    const pluralName = buildPluralName(name)
    const contentFields = template.contentSchema
      ? Object.entries(template.contentSchema).map(([name, meta]) => ({
          name,
          type: meta.type,
          required: meta.required,
          description: meta.description,
          allowedComponentTypes: meta.allowedComponentTypes ?? []
        }))
      : []

    const fieldsPayload: Record<string, any> = {
      name,
      pluralName,
      description: template.description,
      templateKey: template.templateKey,
      category: template.category,
      isHomeEligible: template.isHomeEligible,
      requiredRegions: template.requiredRegions,
      optionalRegions: template.optionalRegions,
      fields: contentFields,
      relationships: [],
      contentSchema: template.contentSchema ?? {},
      ...(Array.isArray(template.childContainment) && template.childContainment.length > 0
        ? { mayContainTypes: Array.from(new Set(template.childContainment)) }
        : {})
    }

    try {
      await contentTypeClient.upsert({
        where: {
          websiteId_key: {
            websiteId,
            key
          }
        },
        update: {
          name,
          pluralName,
          displayField: 'title',
          fields: fieldsPayload as Prisma.JsonObject
        },
        create: {
          websiteId,
          key,
          name,
          pluralName,
          displayField: 'title',
          category: 'page',
          fields: fieldsPayload as Prisma.JsonObject
        }
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      console.error('[TemplatePageTypeSeeder] Failed to upsert page type', {
        websiteId,
        key,
        templateKey: template.templateKey,
        error: message
      })
      throw error
    }
  })

  await Promise.all(operations)

  const mapping = new Map<string, string>()

  const records = await contentTypeClient.findMany({
    where: {
      websiteId,
      key: {
        startsWith: 'template-'
      }
    },
    select: {
      id: true,
      fields: true
    }
  })

  for (const record of records) {
    const fields = record.fields as Record<string, unknown> | null
    const templateKey = typeof fields?.templateKey === 'string' ? String(fields.templateKey) : undefined
    if (templateKey) {
      mapping.set(templateKey, record.id)
    }
  }

  return mapping
}
