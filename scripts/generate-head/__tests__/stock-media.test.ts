import { applyStockMediaFallback } from '../core/stock-media'
import { createEmptyMediaDiagnosticsReport } from '../core/types'
import type { MediaReferenceHandle } from '../core/types'

describe('applyStockMediaFallback', () => {
  it('replaces unresolved references with stock media placeholders', () => {
    const reference: MediaReferenceHandle = {
      mediaId: 'missing-asset',
      target: {},
      path: 'props.image',
      pageId: 'page-1',
      pageTitle: 'Landing',
      componentId: 'component-hero',
      componentType: 'hero-with-image'
    }

    const diagnostics = createEmptyMediaDiagnosticsReport()
    diagnostics.unresolved.push({
      mediaId: 'missing-asset',
      reason: 'asset-not-found',
      path: 'props.image'
    })
    diagnostics.summary.unresolved = 1

    const replacements = applyStockMediaFallback({
      references: [reference],
      mediaDiagnostics: diagnostics
    })

    expect(replacements).toHaveLength(1)
    expect(typeof reference.target.src).toBe('string')
    expect(reference.target.mediaId).toBeNull()
    expect(reference.target.placeholderSource).toBe('stock')
    expect(diagnostics.summary.placeholders).toBe(1)
    expect(diagnostics.summary.unresolved).toBe(0)
    expect(diagnostics.unresolved).toHaveLength(0)
    expect(diagnostics.placeholders).toHaveLength(1)
  })

  it('skips references that already have a src value', () => {
    const reference: MediaReferenceHandle = {
      mediaId: 'already-filled',
      target: { src: 'https://cdn.example.com/existing.jpg' },
      path: 'content.image',
      componentType: 'feature-card'
    }

    const diagnostics = createEmptyMediaDiagnosticsReport()
    diagnostics.unresolved.push({
      mediaId: 'already-filled',
      reason: 'asset-not-found',
      path: 'content.image'
    })
    diagnostics.summary.unresolved = 1

    const replacements = applyStockMediaFallback({
      references: [reference],
      mediaDiagnostics: diagnostics
    })

    expect(replacements).toHaveLength(0)
    expect(diagnostics.summary.placeholders).toBe(0)
    expect(diagnostics.unresolved).toHaveLength(1)
  })
})
