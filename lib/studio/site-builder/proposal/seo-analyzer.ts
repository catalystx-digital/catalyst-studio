import { PrismaClient } from '@/lib/generated/prisma'
import { ProposalSEOAnalysis, ProposalSEOIssue } from './types'

/**
 * Collects SEO analysis data from WebsitePage records
 */
export async function collectSEOAnalysis(
  prisma: PrismaClient,
  websiteId: string
): Promise<ProposalSEOAnalysis | null> {
  try {
    const pages = await prisma.websitePage.findMany({
      where: { websiteId },
      select: {
        id: true,
        title: true,
        content: true,
        metadata: true
      }
    })

    if (pages.length === 0) {
      return null
    }

    let pagesWithMeta = 0
    let pagesWithoutMeta = 0
    let pagesWithImages = 0
    let imagesWithAlt = 0
    let imagesWithoutAlt = 0
    let internalLinks = 0
    let externalLinks = 0
    const issues: ProposalSEOIssue[] = []

    for (const page of pages) {
      const metadata = page.metadata as Record<string, unknown> | null
      const pageContent = page.content as Record<string, unknown> | null

      const hasMetaDescription =
        (metadata && typeof metadata.description === 'string' && metadata.description.length > 0) ||
        (pageContent && typeof (pageContent as any).seo?.description === 'string')
      if (hasMetaDescription) {
        pagesWithMeta++
      } else {
        pagesWithoutMeta++
      }

      if (pageContent) {
        const contentStr = JSON.stringify(pageContent)
        const imageMatches = contentStr.match(/"(src|image|imageUrl|thumbnail)":\s*"[^"]+"/g) || []
        if (imageMatches.length > 0) {
          pagesWithImages++
        }
        const altMatches = contentStr.match(/"alt":\s*"[^"]+"/g) || []
        imagesWithAlt += altMatches.length
        imagesWithoutAlt += Math.max(0, imageMatches.length - altMatches.length)

        const hrefMatches = contentStr.match(/"(href|url|link)":\s*"([^"]+)"/g) || []
        for (const match of hrefMatches) {
          if (match.includes('http://') || match.includes('https://')) {
            externalLinks++
          } else if (match.includes('/')) {
            internalLinks++
          }
        }
      }
    }

    const totalPages = pages.length

    if (pagesWithoutMeta > totalPages * 0.5) {
      issues.push({
        severity: 'critical',
        category: 'Meta Descriptions',
        message: 'More than 50% of pages are missing meta descriptions',
        affectedPages: pagesWithoutMeta
      })
    }

    if (imagesWithoutAlt > imagesWithAlt) {
      issues.push({
        severity: 'critical',
        category: 'Image Alt Text',
        message: 'Most images are missing alt text attributes',
        affectedPages: pagesWithImages
      })
    }

    if (pagesWithoutMeta > 0 && pagesWithoutMeta <= totalPages * 0.5) {
      issues.push({
        severity: 'warning',
        category: 'Meta Descriptions',
        message: 'Some pages are missing meta descriptions',
        affectedPages: pagesWithoutMeta
      })
    }

    if (internalLinks < totalPages) {
      issues.push({
        severity: 'warning',
        category: 'Internal Linking',
        message: 'Limited internal linking detected between pages'
      })
    }

    if (externalLinks === 0) {
      issues.push({
        severity: 'info',
        category: 'External Links',
        message: 'No external links detected - consider adding authoritative references'
      })
    }

    let score = 100
    const metaRatio = pagesWithMeta / totalPages
    score -= Math.round((1 - metaRatio) * 30)
    const totalImages = imagesWithAlt + imagesWithoutAlt
    if (totalImages > 0) {
      const altRatio = imagesWithAlt / totalImages
      score -= Math.round((1 - altRatio) * 25)
    }
    const linkRatio = Math.min(internalLinks / totalPages, 1)
    score -= Math.round((1 - linkRatio) * 15)
    score = Math.max(0, Math.min(100, score))

    return {
      score,
      issues,
      stats: {
        totalPages,
        pagesWithMeta,
        pagesWithoutMeta,
        pagesWithImages,
        imagesWithAlt,
        imagesWithoutAlt,
        internalLinks,
        externalLinks
      }
    }
  } catch (error) {
    console.error('SEO analysis failed:', error)
    return null
  }
}
