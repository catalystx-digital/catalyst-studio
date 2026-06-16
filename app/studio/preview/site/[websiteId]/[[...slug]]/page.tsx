import { renderLocalWebsitePreview } from '@/lib/studio/preview/local-renderer'
import { ApiError } from '@/lib/api/errors'
import { assertStudioWebsiteAccess } from '@/lib/studio/preview/access'
import { normalizePreviewPath } from '@/lib/studio/preview/qa-preview-token'

interface PageProps {
  params: Promise<{
    websiteId: string
    slug?: string[]
  }>
  searchParams?: Promise<{
    designConcept?: string
    previewToken?: string
  }>
}

export default async function StudioLocalPreviewPage(props: PageProps) {
  const params = await props.params
  const searchParams = await props.searchParams
  const previewPath = normalizePreviewPath(params.slug?.join('/') ?? '/')

  try {
    await assertStudioWebsiteAccess(undefined, params.websiteId, {
      previewToken: searchParams?.previewToken,
      path: previewPath,
    })
  } catch (error) {
    if (!(error instanceof ApiError)) {
      throw error
    }

    const message = error.message
    return (
      <main className="flex min-h-screen items-center justify-center bg-white p-8 text-slate-900">
        <div className="max-w-md text-center">
          <h1 className="mb-2 text-lg font-semibold">Preview unavailable</h1>
          <p className="text-sm text-slate-600">{message}</p>
        </div>
      </main>
    )
  }

  return renderLocalWebsitePreview({
    websiteId: params.websiteId,
    slug: params.slug,
    designConcept: searchParams?.designConcept,
    previewToken: searchParams?.previewToken,
    previewRouteBase: `/studio/preview/site/${encodeURIComponent(params.websiteId)}`,
  })
}
