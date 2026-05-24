import type { PreviewComponentConfig } from '@/lib/studio/preview/sandbox/types'
import { normalizePageContent, type PageContentDiagnostic } from '@/lib/studio/page-content'

export interface PreviewPageContentDiagnostic extends PageContentDiagnostic {
  pageId?: string
  pageTitle?: string
  slug?: string
  fullPath?: string
}

interface ExtractComponentsContext {
  pageId?: string
  pageTitle?: string
  slug?: string
  fullPath?: string
}

interface ExtractComponentsResult {
  components: PreviewComponentConfig[]
  diagnostics: PreviewPageContentDiagnostic[]
}

/**
 * Extract component configs from page content JSON.
 */
export function extractComponents(content: unknown): PreviewComponentConfig[] {
  return extractComponentsWithDiagnostics(content).components
}

export function extractComponentsWithDiagnostics(
  content: unknown,
  context: ExtractComponentsContext = {}
): ExtractComponentsResult {
  const normalizedContent = normalizePageContent(content)
  const pageContent = normalizedContent.pageContent
  const diagnostics = normalizedContent.diagnostics
  const previewDiagnostics = diagnostics.map((diagnostic): PreviewPageContentDiagnostic => ({
    ...diagnostic,
    ...context,
  }))

  if (previewDiagnostics.length > 0 && process.env.NODE_ENV !== 'production') {
    console.info('[preview-data] Adapted page content for sandbox preview', {
      pageId: context.pageId,
      fullPath: context.fullPath,
      diagnostics: previewDiagnostics.map(diagnostic => ({
        code: diagnostic.code,
        severity: diagnostic.severity,
        message: diagnostic.message,
        componentId: diagnostic.componentId,
        path: diagnostic.path,
      })),
    })
  }

  const components = pageContent.components.map((component): PreviewComponentConfig => {
    const props = { ...component.props }

    return {
      id: component.id,
      type: component.type,
      parentId: component.parentId,
      position: component.position,
      props,
      content: component.content as Record<string, unknown>,
      styles: component.styles as Record<string, unknown>,
      metadata: component.metadata as Record<string, unknown>,
    }
  })

  return { components, diagnostics: previewDiagnostics }
}
