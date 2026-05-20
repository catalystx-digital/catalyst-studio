export interface MediaRenditionMetadata {
  width: number
  height: number | null
  storageKey: string
}

function sortRenditionsByWidth(renditions: MediaRenditionMetadata[]): MediaRenditionMetadata[] {
  return [...renditions].sort((a, b) => {
    const widthA = typeof a.width === 'number' ? a.width : 0
    const widthB = typeof b.width === 'number' ? b.width : 0
    return widthA - widthB
  })
}

export function resolveRenditionForWidth(params: {
  mediaId: string
  renditions?: MediaRenditionMetadata[] | null
  width: number
}): MediaRenditionMetadata | null {
  const { renditions, width } = params
  if (!Array.isArray(renditions) || renditions.length === 0) {
    return null
  }

  const ordered = sortRenditionsByWidth(renditions)
  for (const rendition of ordered) {
    if (typeof rendition.width === 'number' && rendition.width >= width) {
      return rendition
    }
  }

  return ordered[ordered.length - 1] ?? null
}
