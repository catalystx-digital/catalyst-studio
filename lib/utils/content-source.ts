import type { Prisma, PrismaClient } from '@/lib/generated/prisma'
import { toCanonicalPageContent } from '@/lib/studio/page-content'

export type ContentSource = {
  content: Record<string, unknown>
  type: 'page'
  model: 'websitePage'
  id: string
}

/**
 * Retrieves visual editing content from WebsitePage.
 */
export async function getContentSource(
  tx: Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$extends">,
  contentItemId: string
): Promise<ContentSource> {
  const startTime = Date.now()
  
  const pageData = await tx.websitePage.findUnique({
    where: { id: contentItemId }
  })
  
  if (pageData) {
    const lookupTime = Date.now() - startTime
    console.log(`[PERF] Content lookup (WebsitePage): ${lookupTime}ms for ID: ${contentItemId}`)
    
    return {
      content: pageData.content as Record<string, unknown>,
      type: 'page',
      model: 'websitePage',
      id: contentItemId
    }
  }

  throw new Error('Content item not found')
}

/**
 * Updates visual editing content in WebsitePage.
 * @param tx Prisma transaction client
 * @param source The content source to update
 * @param updatedContent The new content to save
 */
export async function updateContentSource(
  tx: Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$extends">,
  source: ContentSource,
  updatedContent: Record<string, unknown>
): Promise<void> {
  const startTime = Date.now()
  
  await tx.websitePage.update({
    where: { id: source.id },
    data: {
      content: toCanonicalPageContent(updatedContent, undefined, { mode: 'strict-write' }) as unknown as Prisma.InputJsonValue
    }
  })
  
  const updateTime = Date.now() - startTime
  console.log(`[PERF] Content update (${source.model}): ${updateTime}ms for ID: ${source.id}`)
}
