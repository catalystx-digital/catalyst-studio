import { promoteSourceFeatureTilesToCardGrid } from '../feature-tile-grid-processor'
import type { DetectedComponent } from '@/lib/studio/import/detection/types'

function component(type: string, content: Record<string, unknown>): DetectedComponent {
  return {
    component: type,
    type: type as DetectedComponent['type'],
    confidence: 0.9,
    content,
  }
}

const rchFeatureHtml = `
  <section>
    <div class="row">
      <div class="col-sm-6 rch-home-emerg">
        <a href="/emerg_rch/status/" title="View the Emergency Department status page.">
          <div style="background-color:#ffffff;">
            <h2>Emergency Department status</h2>
            <div>View the <u>Emergency Department status</u> page for a real time guide to how busy we are.</div>
          </div>
        </a>
      </div>
      <div class="col-sm-6 rch-home-history">
        <a href="/teeninfo/" title="Teen Health Info fact sheets">
          <div style="background: #FFFFFF url('/TemplateAssets/images/home/poll.png') no-repeat;">
            <h2>Teen Health Info fact sheets</h2>
            <div><u>Health topics in simple language</u> for young people aged 12 to 25.</div>
          </div>
        </a>
      </div>
    </div>
    <div class="row">
      <div class="col-sm-6 rch-home-emerg">
        <a href="https://www.rch.org.au/translation-resources/" title="Translation resources">
          <div style="background-color:#ffffff;">
            <h2>Translation resources</h2>
            <div>Explore <u>translated resources</u> <br>in over 22 languages.</div>
          </div>
        </a>
      </div>
      <div class="col-sm-6 rch-home-history">
        <a href="/telehealth/" title="Telehealth appointments">
          <div style="background: #FFFFFF url('https://www.rch.org.au/TemplateAssets/images/home/telehealth-lg.png') no-repeat;">
            <h2>Telehealth appointments</h2>
            <div><u>Access to RCH telehealth</u> for patients, families, interpreters and external callers.</div>
          </div>
        </a>
      </div>
    </div>
  </section>
`

describe('promoteSourceFeatureTilesToCardGrid', () => {
  it('promotes sparse two-column feature tiles to a source-backed card-grid', () => {
    const components = [
      component('two-column', {
        leftColumn: [
          {
            type: 'cta-simple',
            content: {
              heading: 'Emergency Department status',
              body: 'View the page for a real time guide to how busy we are.',
            },
          },
        ],
        rightColumn: [
          {
            type: 'cta-simple',
            content: {
              heading: 'Teen Health Info fact sheets',
              body: 'for young people aged 12 to 25.',
            },
          },
        ],
      }),
    ]

    const result = promoteSourceFeatureTilesToCardGrid(components, {
      domSnapshot: rchFeatureHtml,
      pageUrl: 'https://www.rch.org.au/home/',
    })

    expect(result).toHaveLength(1)
    expect(result[0].type).toBe('card-grid')
    expect((result[0].content as any).cards).toEqual([
      expect.objectContaining({
        title: 'Emergency Department status',
        href: { url: 'https://www.rch.org.au/emerg_rch/status/' },
      }),
      expect.objectContaining({
        title: 'Teen Health Info fact sheets',
        href: { url: 'https://www.rch.org.au/teeninfo/' },
        image: expect.objectContaining({
          src: expect.objectContaining({
            url: 'https://www.rch.org.au/TemplateAssets/images/home/poll.png',
          }),
        }),
      }),
      expect.objectContaining({
        title: 'Translation resources',
        href: { url: 'https://www.rch.org.au/translation-resources/' },
      }),
      expect.objectContaining({
        title: 'Telehealth appointments',
        href: { url: 'https://www.rch.org.au/telehealth/' },
        image: expect.objectContaining({
          src: expect.objectContaining({
            url: 'https://www.rch.org.au/TemplateAssets/images/home/telehealth-lg.png',
          }),
        }),
      }),
    ])
  })

  it('keeps true two-column layouts when the DOM does not provide a larger matching tile cluster', () => {
    const components = [
      component('two-column', {
        leftColumn: [{ type: 'text-block', content: { heading: 'About us' } }],
        rightColumn: [{ type: 'image-gallery', content: { images: [{ src: '/team.jpg' }] } }],
      }),
    ]

    expect(
      promoteSourceFeatureTilesToCardGrid(components, {
        domSnapshot: rchFeatureHtml,
        pageUrl: 'https://www.rch.org.au/home/',
      })
    ).toEqual(components)
  })

  it('only promotes from the matching source tile cluster', () => {
    const unrelatedCluster = `
      <section class="featured-links">
        <a href="/alpha/"><h2>Alpha service</h2><p>First unrelated feature.</p></a>
        <a href="/beta/"><h2>Beta service</h2><p>Second unrelated feature.</p></a>
        <a href="/gamma/"><h2>Gamma service</h2><p>Third unrelated feature.</p></a>
      </section>
    `
    const separatedSource = `${unrelatedCluster}<div>${'x'.repeat(3000)}</div>${rchFeatureHtml}`
    const components = [
      component('two-column', {
        leftColumn: [{ type: 'cta-simple', content: { heading: 'Emergency Department status' } }],
        rightColumn: [{ type: 'cta-simple', content: { heading: 'Teen Health Info fact sheets' } }],
      }),
    ]

    const result = promoteSourceFeatureTilesToCardGrid(components, {
      domSnapshot: separatedSource,
      pageUrl: 'https://www.rch.org.au/home/',
    })

    expect(result[0].type).toBe('card-grid')
    expect((result[0].content as any).cards.map((card: { title: string }) => card.title)).toEqual([
      'Emergency Department status',
      'Teen Health Info fact sheets',
      'Translation resources',
      'Telehealth appointments',
    ])
  })

  it('does not promote without source DOM evidence', () => {
    const components = [
      component('two-column', {
        leftColumn: [{ type: 'cta-simple', content: { heading: 'Emergency Department status' } }],
        rightColumn: [{ type: 'cta-simple', content: { heading: 'Teen Health Info fact sheets' } }],
      }),
    ]

    expect(promoteSourceFeatureTilesToCardGrid(components, {})).toEqual(components)
  })
})
