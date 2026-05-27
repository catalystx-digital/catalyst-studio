import type { DetectedComponent } from '@/lib/studio/import/detection/types'
import { enrichSourceNewsListing } from '../source-news-processor'

function component(type: string, content: Record<string, unknown>): DetectedComponent {
  return {
    component: type,
    type: type as DetectedComponent['type'],
    confidence: 0.9,
    content,
  }
}

const rchNewsHtml = `
  <div id="rch-news-carousel" class="hidden-xs">
    <div id="rch-news-sperator"><span class="rch-newstext">RCH News</span></div>
    <div class="row">
      <a href="https://blogs.rch.org.au/news/hope-at-last-for-butterfly-children/">Hope at last for 'butterfly children'</a>
      <p>Hope copy.</p>
      <img alt="Hope at last for 'butterfly children'" src="https://blogs.rch.org.au/news/files/2026/04/hope.jpg">
    </div>
    <div class="row">
      <a href="https://blogs.rch.org.au/news/a-visit-from-the-duke-and-duchess-of-sussex/">A visit from the Duke and Duchess of Sussex</a>
      <p>Visit copy.</p>
      <img alt="A visit from the Duke and Duchess of Sussex" src="https://blogs.rch.org.au/news/files/2026/04/visit.jpg">
    </div>
    <div class="row">
      <a href="https://blogs.rch.org.au/news/media-release-parents-in-the-dark-about-teens-nicotine-use/">Media release: Parents in the dark about teens' nicotine use</a>
      <p>Nicotine copy.</p>
      <img alt="Media release: Parents in the dark about teens' nicotine use" src="https://blogs.rch.org.au/news/files/2026/02/nicotine.png">
    </div>
    <div class="row">
      <a href="https://blogs.rch.org.au/news/emmas-story/">Emma's story</a>
      <p>Emma copy.</p>
      <img alt="Emma's story" src="https://blogs.rch.org.au/news/files/2025/11/emma.png">
    </div>
    <a href="#">›</a>
  </div>
  <div id="rch-news-carousel-xs" class="hidden-sm hidden-md hidden-lg row">
    <div id="rch-news-sperator"><span class="rch-newstext">RCH News</span></div>
    <a href="https://blogs.rch.org.au/news/hope-at-last-for-butterfly-children/">Hope at last for 'butterfly children'</a>
  </div>
`

describe('enrichSourceNewsListing', () => {
  it('replaces split imported news listings with the source-backed RCH News listing', () => {
    const components = [
      component('content-feed', {
        heading: 'Latest News',
        pinned: [
          { title: 'A visit from the Duke and Duchess of Sussex' },
          { title: "Media release: Parents in the dark about teens' nicotine use" },
        ],
      }),
      component('card-grid', {
        heading: 'RCH News',
        cards: [
          { title: "Emma's story" },
          { title: "Hope at last for 'butterfly children'" },
        ],
      }),
    ]

    const result = enrichSourceNewsListing(components, {
      domSnapshot: rchNewsHtml,
      pageUrl: 'https://www.rch.org.au/home/',
    })

    expect(result).toHaveLength(1)
    expect(result[0].type).toBe('card-grid')
    expect((result[0].content as any).heading).toBe('RCH News')
    expect((result[0].content as any).cards).toEqual([
      expect.objectContaining({
        title: "Hope at last for 'butterfly children'",
        description: 'Hope copy.',
        href: { url: 'https://blogs.rch.org.au/news/hope-at-last-for-butterfly-children/', type: 'external' },
        image: expect.objectContaining({
          src: expect.objectContaining({ url: 'https://blogs.rch.org.au/news/files/2026/04/hope.jpg' }),
        }),
      }),
      expect.objectContaining({ title: 'A visit from the Duke and Duchess of Sussex' }),
      expect.objectContaining({ title: "Media release: Parents in the dark about teens' nicotine use" }),
      expect.objectContaining({ title: "Emma's story" }),
    ])
  })

  it('does not drop Latest News when the source has an explicit Latest News heading', () => {
    const sourceHtml = `<section><h2>Latest News</h2></section>${rchNewsHtml}`
    const components = [
      component('content-feed', {
        heading: 'Latest News',
        pinned: [{ title: 'A visit from the Duke and Duchess of Sussex' }],
      }),
      component('card-grid', {
        heading: 'RCH News',
        cards: [
          { title: "Emma's story" },
          { title: "Hope at last for 'butterfly children'" },
        ],
      }),
    ]

    expect(enrichSourceNewsListing(components, {
      domSnapshot: sourceHtml,
      pageUrl: 'https://www.rch.org.au/home/',
    })).toHaveLength(2)
  })
})
