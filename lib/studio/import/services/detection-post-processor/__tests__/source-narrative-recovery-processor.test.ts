import { ComponentType } from '@/lib/studio/components/cms/_core/types'
import type { DetectedComponent } from '@/lib/studio/import/detection/types'
import { recoverSourceNarrativeSections } from '../source-narrative-recovery-processor'

function component(type: ComponentType, content: Record<string, unknown>, location: DetectedComponent['location'] = 'main'): DetectedComponent {
  return {
    component: type,
    type,
    confidence: 0.9,
    location,
    content
  }
}

describe('source-narrative-recovery-processor', () => {
  it('recovers missing narrative sections as text blocks', () => {
    const result = recoverSourceNarrativeSections([
      component(ComponentType.HeroWithImage, { heading: 'Welcome' }, 'hero')
    ], {
      domSnapshot: `
        <section><h2>Who we are</h2><p>We help teams create useful digital services for customers and communities with strategy, design, and engineering.</p></section>
      `
    })

    expect(result).toHaveLength(2)
    expect(result[1]).toMatchObject({
      type: ComponentType.TextBlock,
      component: ComponentType.TextBlock,
      location: 'main',
      content: {
        heading: 'Who we are',
        body: 'We help teams create useful digital services for customers and communities with strategy, design, and engineering.'
      },
      metadata: {
        source: 'source-narrative-recovery',
        sourceEvidence: {
          narrativeRecovery: {
            sectionIndex: 0,
            heading: 'Who we are',
            kind: 'narrative'
          }
        }
      }
    })
  })

  it('uses html blocks for multi-paragraph narrative sections', () => {
    const result = recoverSourceNarrativeSections([], {
      domSnapshot: `
        <section>
          <h2>Our approach</h2>
          <p>We explore the opportunity with research and insight.</p>
          <p>We build the right experience with focused delivery teams.</p>
        </section>
      `
    })

    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      type: ComponentType.HtmlBlock,
      content: {
        title: 'Our approach',
        bodyHtml: '<p>We explore the opportunity with research and insight.</p><p>We build the right experience with focused delivery teams.</p>'
      }
    })
  })

  it('does not duplicate narrative content already represented by existing components', () => {
    const result = recoverSourceNarrativeSections([
      component(ComponentType.TextBlock, {
        heading: 'Who we are',
        body: 'We help teams create useful digital services for customers and communities with strategy, design, and engineering.'
      })
    ], {
      domSnapshot: `
        <section><h2>Who we are</h2><p>We help teams create useful digital services for customers and communities with strategy, design, and engineering.</p></section>
      `
    })

    expect(result).toHaveLength(1)
  })

  it('does not suppress missing body copy when only the heading exists elsewhere', () => {
    const result = recoverSourceNarrativeSections([
      component(ComponentType.CardGrid, {
        heading: 'Who we are',
        cards: [{ title: 'Strategy' }]
      })
    ], {
      domSnapshot: `
        <section><h2>Who we are</h2><p>We help teams create useful digital services for customers and communities with strategy, design, and engineering.</p></section>
      `
    })

    expect(result).toHaveLength(2)
    expect(result[1].type).toBe(ComponentType.TextBlock)
  })

  it('deduplicates repeated source narrative sections before inserting recovered components', () => {
    const domSnapshot = `
      <section><h2>Who we are</h2><p>We help teams create useful digital services for customers and communities with strategy, design, and engineering.</p></section>
      <section class="hidden-xs"><h2>Who we are</h2><p>We help teams create useful digital services for customers and communities with strategy, design, and engineering.</p></section>
    `

    const result = recoverSourceNarrativeSections([], { domSnapshot })

    expect(result).toHaveLength(1)
  })

  it('preserves list content when recovering rich narrative sections', () => {
    const result = recoverSourceNarrativeSections([], {
      domSnapshot: `
        <section>
          <h2>Our services</h2>
          <p>We support teams across the full lifecycle.</p>
          <ul><li>Strategy</li><li>Design and engineering</li></ul>
        </section>
      `
    })

    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      type: ComponentType.HtmlBlock,
      content: {
        title: 'Our services',
        bodyHtml: '<p>We support teams across the full lifecycle.</p><ul><li>Strategy</li><li>Design and engineering</li></ul>'
      }
    })
  })

  it('inserts recovered narrative sections before the footer', () => {
    const result = recoverSourceNarrativeSections([
      component(ComponentType.HeroWithImage, { heading: 'Welcome' }, 'hero'),
      component(ComponentType.Footer, { columns: [] }, 'footer')
    ], {
      domSnapshot: `
        <section><h2>About the team</h2><p>Our team supports organizations with thoughtful strategy, design, engineering, and long-term platform operations.</p></section>
      `
    })

    expect(result.map(entry => entry.type)).toEqual([
      ComponentType.HeroWithImage,
      ComponentType.TextBlock,
      ComponentType.Footer
    ])
  })
})
