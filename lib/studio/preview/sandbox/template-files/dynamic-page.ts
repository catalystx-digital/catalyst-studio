/**
 * Dynamic Page Template for Sandbox Preview
 *
 * This file is written to the sandbox via writeFiles() API.
 * It creates a catch-all route that fetches content from the preview API.
 */

export const dynamicPageTemplate = `
import { PreviewRenderer } from '@/lib/preview-renderer'

interface PageData {
  id: string
  title: string
  slug: string
  fullPath?: string
  components: Array<{
    type: string
    props: Record<string, unknown>
  }>
}

interface PreviewResponse {
  success: boolean
  data?: {
    websiteId: string
    websiteName: string
    designSystem: Record<string, unknown>
    designSystemCss: string
    pages: PageData[]
  }
  error?: string
}

async function getHomepageData(searchParams?: { [key: string]: string | string[] | undefined }): Promise<PageData | null> {
  const websiteId = process.env.WEBSITE_ID
  const apiUrl = process.env.PREVIEW_API_URL || 'http://localhost:3000/api/studio/preview/data'

  if (!websiteId) {
    console.error('[preview] WEBSITE_ID not set')
    return null
  }

  // Build query params - include designConcept if provided in URL
  const params = new URLSearchParams({ websiteId })
  const designConcept = typeof searchParams?.designConcept === 'string' ? searchParams.designConcept : undefined
  if (designConcept) {
    params.set('designConcept', designConcept)
  }

  try {
    const response = await fetch(\`\${apiUrl}?\${params.toString()}\`, {
      cache: 'no-store', // Always fetch fresh data for preview
    })

    if (!response.ok) {
      console.error('[preview] API error:', response.status)
      return null
    }

    const data: PreviewResponse = await response.json()

    if (!data.success || !data.data) {
      console.error('[preview] API returned error:', data.error)
      return null
    }

    const normalizePath = (value?: string): string => {
      if (!value) return '/'
      try {
        value = decodeURIComponent(value)
      } catch {
        // Keep the original value if it is not URI encoded.
      }
      const withoutQuery = value.split('?')[0].split('#')[0]
      const trimmed = withoutQuery.replace(/^\/+|\/+$/g, '')
      return trimmed ? \`/\${trimmed}\` : '/'
    }

    const requestedPath = normalizePath(
      typeof searchParams?.path === 'string'
        ? searchParams.path
        : typeof searchParams?.page === 'string'
          ? searchParams.page
          : undefined
    )

    const page = data.data.pages.find((candidate) => {
      const fullPath = normalizePath(candidate.fullPath || candidate.slug)
      const slugPath = normalizePath(candidate.slug)
      return fullPath === requestedPath || slugPath === requestedPath
    })

    if (page) {
      return page
    }

    // Fallback to homepage - look for root slug/path or first page
    const homepage = data.data.pages.find((candidate) => {
      const fullPath = normalizePath(candidate.fullPath || candidate.slug)
      const slugPath = normalizePath(candidate.slug)
      return fullPath === '/' || slugPath === '/' || slugPath === '/home'
    }) || data.data.pages[0]

    return homepage || null
  } catch (error) {
    console.error('[preview] Fetch error:', error)
    return null
  }
}

export default async function PreviewPage({
  searchParams,
}: {
  searchParams?: { [key: string]: string | string[] | undefined }
}) {
  const page = await getHomepageData(searchParams)

  if (!page) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Preview Not Available</h1>
          <p className="text-muted-foreground">No page data found for this website.</p>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen">
      <PreviewRenderer components={page.components} />
    </main>
  )
}
`

export const homePageTemplate = `
import { redirect } from 'next/navigation'

export default function HomePage() {
  // Redirect to catch-all route which handles the homepage
  redirect('/')
}
`
