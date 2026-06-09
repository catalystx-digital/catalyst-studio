import { ComponentType } from '@/lib/studio/components/cms/_core/types'
import type { DetectedComponent } from '@/lib/studio/import/detection/types'
import { adjustDetectedComponents } from '../../detection-post-processor'
import { completeCardGridsFromSource } from '../card-grid-completion-processor'

function cardGrid(cards: Array<Record<string, unknown>>): DetectedComponent {
  return {
    component: ComponentType.CardGrid,
    type: ComponentType.CardGrid,
    confidence: 0.92,
    content: {
      heading: 'Some of our latest projects',
      cards,
    },
  }
}

const Example AgencyProjectsDom = `
  <main>
    <section class="columns-section cols-two">
      <div class="columns-header"><h2 class="title">Some of our latest projects</h2></div>
      <div class="column-wrapper">
        <a href="/mcg-and-melbourne-cricket-club" class="hero-image-tile">
          <img src="https://assets.example.com/Home-Page-Tile.png?h=570&amp;fm=webp" alt="A dad and kid at MCG" />
          <h3 class="hero-image-tile-title">MCG and MCC</h3>
          <p class="hero-image-tile-introduction">The Melbourne Cricket Club engaged Example Agency to reimagine and redevelop its digital ecosystem.</p>
        </a>
        <a href="/melbourne-airport-wayfinding-system" class="hero-image-tile">
          <img src="https://assets.example.com/hero_Wayfinding.png?h=570&amp;fm=webp" alt="Melbourne Airport Wayfinder" />
          <h3 class="hero-image-tile-title">Melbourne Airport Wayfinder</h3>
          <p class="hero-image-tile-introduction">Melbourne Airport's wayfinding system guides passengers seamlessly through the airport.</p>
        </a>
        <a href="/clipsal-electrical-design-application" class="hero-image-tile">
          <img src="https://assets.example.com/ClipSpec.png?h=570&amp;fm=webp" alt="Clipspec design application project" />
          <h3 class="hero-image-tile-title">Clipspec design application</h3>
          <p class="hero-image-tile-introduction">The Clipspec Design App is one example of digital disruption and innovation.</p>
        </a>
        <a href="/byd-discovery" class="hero-image-tile">
          <img src="https://assets.example.com/hero_BYD.png?h=570&amp;fm=webp" alt="BYD" />
          <h3 class="hero-image-tile-title">BYD</h3>
          <p class="hero-image-tile-introduction">Electric vehicle manufacturer BYD engaged Example Agency to provide it with a digital strategy.</p>
        </a>
      </div>
    </section>
  </main>
`

describe('completeCardGridsFromSource', () => {
  it('appends source-backed missing cards to a matched card grid', () => {
    const components = [
      cardGrid([
        {
          title: 'MCG and MCC',
          href: { type: 'internal', path: '/mcg-and-melbourne-cricket-club' },
          image: { src: { mediaType: 'image', url: '/mcg.png' }, alt: '' },
        },
        {
          title: 'Melbourne Airport Wayfinder',
          href: { type: 'internal', path: '/melbourne-airport-wayfinding-system' },
          image: { src: { mediaType: 'image', url: '/airport.png' }, alt: '' },
        },
        {
          title: 'Clipspec design application',
          href: { type: 'internal', path: '/clipsal-electrical-design-application' },
          image: { src: { mediaType: 'image', url: '/clipspec.png' }, alt: '' },
        },
      ]),
    ]

    completeCardGridsFromSource(components, {
      domSnapshot: Example AgencyProjectsDom,
      pageUrl: 'https://agency.example.com/',
    })

    const cards = components[0].content.cards as Array<Record<string, any>>
    expect(cards).toHaveLength(4)
    expect(cards[3]).toMatchObject({
      title: 'BYD',
      description: 'Electric vehicle manufacturer BYD engaged Example Agency to provide it with a digital strategy.',
      href: {
        type: 'internal',
        pageId: 'byd-discovery',
        path: '/byd-discovery',
      },
      image: {
        alt: 'BYD',
        originalUrl: 'https://assets.example.com/hero_BYD.png?h=570&fm=webp',
        src: {
          mediaType: 'image',
          url: 'https://assets.example.com/hero_BYD.png?h=570&fm=webp',
        },
      },
    })
    expect(components[0].metadata?.sourceEvidence).toMatchObject({
      cardGridCompletion: {
        heading: 'Some of our latest projects',
        addedCards: 1,
        sourceCards: 4,
      },
    })
  })

  it('does not complete a grid when the source heading does not match', () => {
    const components = [
      {
        ...cardGrid([{ title: 'MCG and MCC' }]),
        content: {
          heading: 'Services',
          cards: [{ title: 'Strategy' }],
        },
      },
    ]

    completeCardGridsFromSource(components, {
      domSnapshot: Example AgencyProjectsDom,
      pageUrl: 'https://agency.example.com/',
    })

    expect(components[0].content.cards).toHaveLength(1)
  })

  it('does not complete text-only framework grids even when source later contains links', () => {
    const components = [
      {
        ...cardGrid([
          { title: 'Explore', description: 'Understand context.' },
          { title: 'Build', description: 'Bring specialists together.' },
          { title: 'Grow', description: 'Keep improving.' },
        ]),
        content: {
          heading: 'Our flexible 3 stage framework to craft digital experiences',
          cards: [
            { title: 'Explore', description: 'Understand context.' },
            { title: 'Build', description: 'Bring specialists together.' },
            { title: 'Grow', description: 'Keep improving.' },
          ],
        },
      },
    ]

    completeCardGridsFromSource(components, {
      domSnapshot: `
        <main>
          <section>
            <h2>Our flexible 3 stage framework to craft digital experiences</h2>
            <p>Explore</p><p>Build</p><p>Grow</p>
            <a href="/unrelated"><img src="/unrelated.png" alt="Unrelated" /><h3>Unrelated</h3></a>
            <a href="/another"><img src="/another.png" alt="Another" /><h3>Another</h3></a>
          </section>
        </main>
      `,
      pageUrl: 'https://agency.example.com/',
    })

    expect(components[0].content.cards).toHaveLength(3)
  })

  it('does not complete linked grids that do not already have image-card evidence', () => {
    const components = [
      cardGrid([
        { title: 'MCG and MCC', href: { type: 'internal', path: '/mcg-and-melbourne-cricket-club' } },
        { title: 'Melbourne Airport Wayfinder', href: { type: 'internal', path: '/melbourne-airport-wayfinding-system' } },
        { title: 'Clipspec design application', href: { type: 'internal', path: '/clipsal-electrical-design-application' } },
      ]),
    ]

    completeCardGridsFromSource(components, {
      domSnapshot: Example AgencyProjectsDom,
      pageUrl: 'https://agency.example.com/',
    })

    expect(components[0].content.cards).toHaveLength(3)
  })

  it('does not complete from a duplicate heading section without existing title overlap', () => {
    const components = [
      cardGrid([
        {
          title: 'MCG and MCC',
          href: { type: 'internal', path: '/mcg-and-melbourne-cricket-club' },
          image: { src: { mediaType: 'image', url: '/mcg.png' }, alt: '' },
        },
        {
          title: 'Melbourne Airport Wayfinder',
          href: { type: 'internal', path: '/melbourne-airport-wayfinding-system' },
          image: { src: { mediaType: 'image', url: '/airport.png' }, alt: '' },
        },
        {
          title: 'Clipspec design application',
          href: { type: 'internal', path: '/clipsal-electrical-design-application' },
          image: { src: { mediaType: 'image', url: '/clipspec.png' }, alt: '' },
        },
      ]),
    ]

    completeCardGridsFromSource(components, {
      domSnapshot: `
        <main>
          <section>
            <h2>Some of our latest projects</h2>
            <a href="/wrong-1"><img src="/wrong-1.jpg" alt=""><h3>Wrong One</h3></a>
            <a href="/wrong-2"><img src="/wrong-2.jpg" alt=""><h3>Wrong Two</h3></a>
            <a href="/wrong-3"><img src="/wrong-3.jpg" alt=""><h3>Wrong Three</h3></a>
            <a href="/wrong-4"><img src="/wrong-4.jpg" alt=""><h3>Wrong Four</h3></a>
          </section>
        </main>
      `,
      pageUrl: 'https://agency.example.com/',
    })

    expect(components[0].content.cards).toHaveLength(3)
  })

  it('runs through the full post-processor before URL transformation', () => {
    const adjusted = adjustDetectedComponents([
      cardGrid([
        {
          title: 'MCG and MCC',
          href: { type: 'internal', path: '/mcg-and-melbourne-cricket-club' },
          image: { src: { mediaType: 'image', url: '/mcg.png' }, alt: '' },
        },
        {
          title: 'Melbourne Airport Wayfinder',
          href: { type: 'internal', path: '/melbourne-airport-wayfinding-system' },
          image: { src: { mediaType: 'image', url: '/airport.png' }, alt: '' },
        },
        {
          title: 'Clipspec design application',
          href: { type: 'internal', path: '/clipsal-electrical-design-application' },
          image: { src: { mediaType: 'image', url: '/clipspec.png' }, alt: '' },
        },
      ]),
    ], {
      domSnapshot: Example AgencyProjectsDom,
      pageUrl: 'https://agency.example.com/',
    })

    const cards = adjusted[0].content.cards as Array<Record<string, any>>
    expect(cards.map(card => card.title)).toEqual([
      'MCG and MCC',
      'Melbourne Airport Wayfinder',
      'Clipspec design application',
      'BYD',
    ])
    expect(cards[3].href).toMatchObject({ path: '/byd-discovery' })
  })
})
