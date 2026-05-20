import { renderLocalWebsitePreview } from '@/lib/studio/preview/local-renderer'

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

  return renderLocalWebsitePreview({
    websiteId: params.websiteId,
    slug: params.slug,
    designConcept: searchParams?.designConcept,
  })
}
