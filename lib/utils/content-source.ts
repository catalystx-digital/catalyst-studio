import type { Prisma, PrismaClient } from '@/lib/generated/prisma'

export type ContentSource = {
  content: Record<string, unknown>
  type: 'page' | 'custom'
  model: 'websitePage' | 'websiteCustomContentData'
  id: string
}

/**
 * Retrieves content from either WebsitePage or WebsiteCustomContentData
 * Uses dual-model pattern: checks WebsitePage first (most common), falls back to WebsiteCustomContentData
 */
export async function getContentSource(
  tx: Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$extends">,
  contentItemId: string
): Promise<ContentSource> {
  const startTime = Date.now()
  
  // Try WebsitePage first (most common case)
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
  
  // Fall back to WebsiteCustomContentData
  const customData = await tx.websiteCustomContentData.findUnique({
    where: { id: contentItemId }
  })
  
  if (customData) {
    const lookupTime = Date.now() - startTime
    console.log(`[PERF] Content lookup (WebsiteCustomContentData): ${lookupTime}ms for ID: ${contentItemId}`)
    
    return {
      content: customData.data as Record<string, unknown>,
      type: 'custom',
      model: 'websiteCustomContentData',
      id: contentItemId
    }
  }
  
  throw new Error('Content item not found')
}

/**
 * Updates content in either WebsitePage or WebsiteCustomContentData
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
  
  if (source.model === 'websitePage') {
    await tx.websitePage.update({
      where: { id: source.id },
      data: {
        content: updatedContent as unknown as Prisma.InputJsonValue
      }
    })
  } else {
    await tx.websiteCustomContentData.update({
      where: { id: source.id },
      data: {
        data: updatedContent as unknown as Prisma.InputJsonValue
      }
    })
  }
  
  const updateTime = Date.now() - startTime
  console.log(`[PERF] Content update (${source.model}): ${updateTime}ms for ID: ${source.id}`)
}
