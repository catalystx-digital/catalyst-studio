import { applyDesignFit } from '../design-fit-processor'
import { ComponentType } from '@/lib/studio/components/cms/_core/types'
import type { DetectedComponent } from '@/lib/studio/import/detection/types'
import type { ImportDesignProfile, PresentationSkeletonSelection } from '@/lib/studio/import/types/design-profile.types'

const skeleton: PresentationSkeletonSelection = {
  key: 'agency-home',
  confidence: 0.82,
  reason: 'test',
  diagnostics: [],
}

const designProfile: ImportDesignProfile = {
  sourceUrl: 'https://example.com/',
  capturedAt: '2026-05-28T00:00:00.000Z',
  confidence: 0.7,
  palette: {
    primary: { source: 'domProbe.palette.primary', value: '#0055aa', confidence: 'high' },
    foreground: { source: 'domProbe.palette.text', value: '#111111', confidence: 'high' },
  },
  typography: {},
  spacing: { density: 'comfortable' },
  brandAssets: {},
  imagery: { detectedCount: 0, evidence: [] },
  diagnostics: [],
}

describe('applyDesignFit', () => {
  it('applies only schema-supported presentation props', () => {
    const components = [{
      component: ComponentType.CardGrid,
      type: ComponentType.CardGrid,
      confidence: 0.9,
      content: {
        heading: 'Services',
        cards: [{ title: 'Strategy' }, { title: 'Design' }, { title: 'Build' }],
      },
    }] as DetectedComponent[]

    const result = applyDesignFit(components, { designProfile, skeleton })

    expect(result.components[0].content).toMatchObject({
      columns: 3,
      gap: 'medium',
      cardStyle: 'vertical',
      imagePosition: 'top',
      imageAspectRatio: '16:9',
    })
    expect(result.components[0].content).not.toHaveProperty('backgroundColor')
    expect(result.mutations.map(mutation => mutation.field)).toEqual([
      'columns',
      'gap',
      'cardStyle',
      'imagePosition',
      'imageAspectRatio',
    ])
  })

  it('does not invent navbar behavior or colors from global profile tokens', () => {
    const components = [{
      component: ComponentType.NavBar,
      type: ComponentType.NavBar,
      confidence: 0.9,
      content: {
        menuItems: [{ label: 'Home', href: { type: 'internal', pageId: 'home', path: '/' } }],
      },
    }] as DetectedComponent[]

    const result = applyDesignFit(components, { designProfile, skeleton })

    expect(result.components[0].content.menuItems).toHaveLength(1)
    expect(result.components[0].content).not.toHaveProperty('sticky')
    expect(result.components[0].content).not.toHaveProperty('layout')
    expect(result.components[0].content).not.toHaveProperty('styles')
    expect(result.mutations).toEqual([])
    expect((result.components[0].metadata as any).designFit.mutations).toEqual([])
  })

  it('does not mutate presentation props when skeleton selection is unknown', () => {
    const components = [{
      component: ComponentType.CardGrid,
      type: ComponentType.CardGrid,
      confidence: 0.9,
      content: {
        heading: 'Services',
        cards: [{ title: 'Strategy' }, { title: 'Design' }],
      },
    }] as DetectedComponent[]

    const result = applyDesignFit(components, {
      designProfile,
      skeleton: { key: 'unknown', confidence: 0, reason: 'test', diagnostics: [] },
    })

    expect(result.components[0].content).toEqual({
      heading: 'Services',
      cards: [{ title: 'Strategy' }, { title: 'Design' }],
    })
    expect(result.mutations).toEqual([])
    expect(result.diagnostics[0]?.message).toContain('skipped')
  })

  it('does not mutate presentation props when design profile evidence is missing', () => {
    const components = [{
      component: ComponentType.CardGrid,
      type: ComponentType.CardGrid,
      confidence: 0.9,
      content: {
        heading: 'Services',
        cards: [{ title: 'Strategy' }, { title: 'Design' }],
      },
    }] as DetectedComponent[]

    const result = applyDesignFit(components, {
      designProfile: {
        ...designProfile,
        confidence: 0,
        diagnostics: [{
          code: 'DESIGN_PROFILE_MISSING_PROBE',
          severity: 'warning',
          message: 'missing',
        }],
      },
      skeleton,
    })

    expect(result.components[0].content).toEqual({
      heading: 'Services',
      cards: [{ title: 'Strategy' }, { title: 'Design' }],
    })
    expect(result.mutations).toEqual([])
    expect(result.diagnostics[0]?.message).toContain('insufficient')
  })

  it('does not mutate presentation props when DOM-backed design profile confidence is low', () => {
    const components = [{
      component: ComponentType.CardGrid,
      type: ComponentType.CardGrid,
      confidence: 0.9,
      content: {
        heading: 'Services',
        cards: [{ title: 'Strategy' }, { title: 'Design' }],
      },
    }] as DetectedComponent[]

    const result = applyDesignFit(components, {
      designProfile: {
        ...designProfile,
        confidence: 0.2,
        diagnostics: [{
          code: 'DESIGN_PROFILE_LOW_CONFIDENCE',
          severity: 'warning',
          message: 'low',
        }],
      },
      skeleton,
    })

    expect(result.components[0].content).toEqual({
      heading: 'Services',
      cards: [{ title: 'Strategy' }, { title: 'Design' }],
    })
    expect(result.mutations).toEqual([])
    expect(result.diagnostics[0]?.message).toContain('insufficient')
  })
})
