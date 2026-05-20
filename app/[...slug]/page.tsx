import { notFound } from 'next/navigation';
import { websiteResolver } from '@/lib/services/website-resolver';
import { renderLocalWebsitePreview } from '@/lib/studio/preview/local-renderer';

interface PageProps {
  params: Promise<{
    slug?: string[];
  }>;
}

function toSlugSegments(input?: string[]): string[] {
  if (!Array.isArray(input) || input.length === 0) {
    return [];
  }
  return input.filter(segment => typeof segment === 'string' && segment.length > 0);
}

export default async function DynamicPage(props: PageProps) {
  const params = await props.params;
  const slugSegments = toSlugSegments(params?.slug);

  const websiteId = await websiteResolver.resolveFromContext();
  if (!websiteId) {
    console.warn('[DynamicPage] Unable to resolve website ID. Did you configure WEBSITE_RESOLUTION_STRATEGY?');
    return notFound();
  }

  return renderLocalWebsitePreview({ websiteId, slug: slugSegments });
}
