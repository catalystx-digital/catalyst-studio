import { renderLocalWebsitePreview } from '@/lib/studio/preview/local-renderer'
import { ApiError } from '@/lib/api/errors'
import { assertStudioWebsiteAccess } from '@/lib/studio/preview/access'

interface PageProps {
  params: Promise<{
    websiteId: string
    slug?: string[]
  }>
  searchParams?: Promise<{
    designConcept?: string
  }>
}

export default async function StudioLocalPreviewPage(props: PageProps) {
  const params = await props.params
  const searchParams = await props.searchParams

  try {
    await assertStudioWebsiteAccess(undefined, params.websiteId)
  } catch (error) {
    const message = error instanceof ApiError ? error.message : 'Preview access denied'
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
  })
}
