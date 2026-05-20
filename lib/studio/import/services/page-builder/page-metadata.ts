import { DetectionResult, PageData } from '../interfaces'

export function extractPageMetadata(detectionResults: DetectionResult[]): PageData['metadata'] {
  const root = detectionResults && detectionResults.length > 0 ? detectionResults[0] : undefined
  const llmMeta = (root?.metadata as any)?.pageMetadata
  if (llmMeta && typeof llmMeta === 'object') {
    return {
      description: llmMeta.description,
      keywords: llmMeta.keywords,
      openGraph: llmMeta.openGraph
    }
  }

  const titleComponents = detectionResults.filter(component =>
    component.type.includes('title') || component.type.includes('heading')
  )
  const descriptionComponents = detectionResults.filter(component =>
    component.type.includes('description') || component.type.includes('text')
  )

  const descriptionContent = descriptionComponents[0]?.content
  const titleContent = titleComponents[0]?.content

  const descriptionText = typeof descriptionContent === 'string' ? descriptionContent : undefined
  const titleText = typeof titleContent === 'string' ? titleContent : undefined

  return {
    description: descriptionText,
    keywords: extractKeywordsFromContent(detectionResults),
    openGraph: {
      title: titleText,
      description: descriptionText
    }
  }
}

export function generatePageTitle(pageData: PageData): string {
  if (pageData.title && pageData.title.trim()) {
    return pageData.title.trim()
  }

  try {
    const root = pageData.detectedComponents && pageData.detectedComponents[0]
    const metaTitle = (root?.metadata as any)?.pageMetadata?.title
    if (typeof metaTitle === 'string' && metaTitle.trim()) {
      return metaTitle.trim()
    }
  } catch {
    // ignore metadata parsing failures
  }

  try {
    const url = new URL(pageData.url)
    const pathParts = url.pathname.split('/').filter(Boolean)
    if (pathParts.length === 0) return 'Homepage'
    const lastSegment = pathParts[pathParts.length - 1]
    const formatted = lastSegment
      .replace(/[-_]/g, ' ')
      .replace(/\b\w/g, letter => letter.toUpperCase())
    return formatted || 'Untitled Page'
  } catch {
    return 'Untitled Page'
  }
}

export function determinePageType(pageData: PageData): 'page' | 'folder' {
  if (!pageData?.url) {
    return 'page'
  }

  try {
    const url = new URL(pageData.url)
    const pathname = url.pathname
    if (pathname === '/') {
      return 'page'
    }
    const isFolder = (pathname.endsWith('/') && pathname !== '/') || pageData.detectedComponents.length === 0
    return isFolder ? 'folder' : 'page'
  } catch {
    return 'page'
  }
}

export function extractKeywordsFromContent(detectionResults: DetectionResult[]): string[] {
  const allText = detectionResults
    .map(result => (typeof result.content === 'string' ? result.content : ''))
    .filter(Boolean)
    .join(' ')

  return allText
    .toLowerCase()
    .split(/\s+/)
    .filter(word => word.length > 3)
    .filter((word, index, array) => array.indexOf(word) === index)
    .slice(0, 10)
}
