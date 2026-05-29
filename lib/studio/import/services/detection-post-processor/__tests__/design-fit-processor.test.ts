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
        cards: [
          { title: 'Strategy', image: { src: { mediaId: 'strategy', mediaType: 'image', url: 'https://example.com/strategy.jpg' } } },
          { title: 'Design', image: { src: { mediaId: 'design', mediaType: 'image', url: 'https://example.com/design.jpg' } } },
          { title: 'Build', image: { src: { mediaId: 'build', mediaType: 'image', url: 'https://example.com/build.jpg' } } },
        ],
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

  it('uses compact presentation for text-only quick link grids', () => {
    const components = [{
      component: ComponentType.CardGrid,
      type: ComponentType.CardGrid,
      confidence: 0.9,
      content: {
        heading: 'Quick links',
        cards: [{ title: 'Admissions' }, { title: 'Contact' }, { title: 'Support' }],
      },
    }] as DetectedComponent[]

    const result = applyDesignFit(components, { designProfile, skeleton })

    expect(result.components[0].content).toMatchObject({
      columns: 3,
      gap: 'medium',
      cardStyle: 'compact',
    })
    expect(result.components[0].content).not.toHaveProperty('imagePosition')
    expect(result.components[0].content).not.toHaveProperty('imageAspectRatio')
    expect(result.mutations.map(mutation => mutation.evidence)).toContain('card-grid.source-shape.text-only')
  })

  it('uses horizontal presentation for two-card editorial image grids', () => {
    const components = [{
      component: ComponentType.CardGrid,
      type: ComponentType.CardGrid,
      confidence: 0.9,
      content: {
        heading: 'Featured stories',
        cards: [
          { title: 'Story 1', image: { src: { mediaId: 'story-1', mediaType: 'image', url: 'https://example.com/story-1.jpg' } } },
          { title: 'Story 2', image: { src: { mediaId: 'story-2', mediaType: 'image', url: 'https://example.com/story-2.jpg' } } },
        ],
      },
    }] as DetectedComponent[]

    const result = applyDesignFit(components, { designProfile, skeleton })

    expect(result.components[0].content).toMatchObject({
      columns: 2,
      gap: 'medium',
      cardStyle: 'horizontal',
      imagePosition: 'left',
      imageAspectRatio: '4:3',
    })
    expect(result.mutations.map(mutation => mutation.evidence)).toContain('card-grid.source-shape.two-card-editorial')
  })

  it('preserves explicit card-grid presentation props', () => {
    const components = [{
      component: ComponentType.CardGrid,
      type: ComponentType.CardGrid,
      confidence: 0.9,
      content: {
        heading: 'Projects',
        cardStyle: 'vertical',
        imagePosition: 'background',
        imageAspectRatio: '1:1',
        cards: [
          { title: 'Project 1', image: { src: { mediaId: 'project-1', mediaType: 'image', url: 'https://example.com/project-1.jpg' } } },
          { title: 'Project 2', image: { src: { mediaId: 'project-2', mediaType: 'image', url: 'https://example.com/project-2.jpg' } } },
        ],
      },
    }] as DetectedComponent[]

    const result = applyDesignFit(components, { designProfile, skeleton })

    expect(result.components[0].content).toMatchObject({
      cardStyle: 'vertical',
      imagePosition: 'background',
      imageAspectRatio: '1:1',
    })
  })

  it('does not treat image objects without URLs as image-heavy evidence', () => {
    const components = [{
      component: ComponentType.CardGrid,
      type: ComponentType.CardGrid,
      confidence: 0.9,
      content: {
        heading: 'Links',
        cards: [
          { title: 'One', image: { alt: 'Decorative' } },
          { title: 'Two' },
        ],
      },
    }] as DetectedComponent[]

    const result = applyDesignFit(components, { designProfile, skeleton })

    expect(result.components[0].content).toMatchObject({
      cardStyle: 'compact',
    })
    expect(result.components[0].content).not.toHaveProperty('imagePosition')
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
