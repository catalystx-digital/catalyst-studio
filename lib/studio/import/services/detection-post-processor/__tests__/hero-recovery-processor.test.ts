import { ComponentType } from '@/lib/studio/components/cms/_core/types'
import type { DetectedComponent } from '@/lib/studio/import/detection/types'
import { adjustDetectedComponents } from '../../detection-post-processor'
import { recoverMissingHomepageHero } from '../hero-recovery-processor'

function nav(): DetectedComponent {
  return {
    component: ComponentType.NavBar,
    type: ComponentType.NavBar,
    confidence: 0.95,
    location: 'header',
    content: { menuItems: [] },
  }
}

function cardGrid(): DetectedComponent {
  return {
    component: ComponentType.CardGrid,
    type: ComponentType.CardGrid,
    confidence: 0.9,
    content: { heading: 'Some of our latest projects', cards: [{ title: 'Project' }] },
  }
}

describe('recoverMissingHomepageHero', () => {
  it('recovers a source-backed homepage hero before main content', () => {
    const components = [nav(), cardGrid()]
    const nestedHeroMarkup = '<div class="wrapper">'.repeat(20)
    const closingNestedMarkup = '</div>'.repeat(20)
    const longResponsiveImageMarkup = '<span></span>'.repeat(900)
    const domSnapshot = `
      <main>
        <aside class="newsletter-modal">
          <h2>The Luminary newsletter</h2>
          <p>Global modal markup can appear before the visible homepage hero.</p>
        </aside>
        <section class="homepage-hero bg-theme-gradient-2 diagonal">
          ${nestedHeroMarkup}
            <h1>Brighter digital experiences</h1>
            <div class="introduction">
              <p>A full service digital agency creating bright digital experiences for your customers and your organisation.</p>
            </div>
            <button>Play showreel</button>
          ${closingNestedMarkup}
          <div class="image-container">
            ${longResponsiveImageMarkup}
            <img src="/hero.png?width=474&amp;format=webp" alt="Picture of luminary team members within sunrise graphic" />
          </div>
        </section>
        <section><h2>Some of our latest projects</h2></section>
      </main>
    `

    recoverMissingHomepageHero(components, {
      domSnapshot,
      pageUrl: 'https://www.luminary.com/',
    })

    expect(components.map(component => component.type)).toEqual([
      ComponentType.NavBar,
      ComponentType.HeroWithImage,
      ComponentType.CardGrid,
    ])
    expect(components[1].content).toMatchObject({
      heading: 'Brighter digital experiences',
      subheading: 'A full service digital agency creating bright digital experiences for your customers and your organisation.',
      layout: 'image-right',
      image: {
        alt: 'Picture of luminary team members within sunrise graphic',
        originalUrl: 'https://www.luminary.com/hero.png?width=474&format=webp',
        src: {
          mediaType: 'image',
          url: 'https://www.luminary.com/hero.png?width=474&format=webp',
        },
      },
    })
    expect(components[1].metadata).toMatchObject({
      region: 'hero',
      source: 'source-hero-recovery',
      sourceEvidence: {
        heading: true,
        image: true,
        subheading: true,
      },
    })
  })

  it('inserts the recovered hero through the full post-processor before main content', () => {
    const adjusted = adjustDetectedComponents([nav(), cardGrid()], {
      pageUrl: 'https://www.luminary.com/',
      domSnapshot: `
        <main>
          <section class="homepage-hero">
            <h1>Brighter digital experiences</h1>
            <p>A full service digital agency creating bright digital experiences for your customers and your organisation.</p>
            <img src="/hero.png" alt="Picture of luminary team members within sunrise graphic" />
          </section>
          <section><h2>Some of our latest projects</h2></section>
        </main>
      `,
    })

    expect(adjusted.map(component => component.type).slice(0, 3)).toEqual([
      ComponentType.NavBar,
      ComponentType.HeroWithImage,
      ComponentType.CardGrid,
    ])
    expect(adjusted[1].content.heading).toBe('Brighter digital experiences')
  })

  it('does not recover a hero on non-home paths', () => {
    const components = [nav(), cardGrid()]

    recoverMissingHomepageHero(components, {
      domSnapshot: '<main><section class="hero"><h1>About us</h1><p>Useful page body.</p></section></main>',
      pageUrl: 'https://www.example.com/about',
    })

    expect(components.map(component => component.type)).toEqual([
      ComponentType.NavBar,
      ComponentType.CardGrid,
    ])
  })

  it('does not recover a hero when a hero already exists', () => {
    const components: DetectedComponent[] = [
      nav(),
      {
        component: ComponentType.HeroSimple,
        type: ComponentType.HeroSimple,
        confidence: 0.9,
        content: { heading: 'Existing hero' },
      },
      cardGrid(),
    ]

    recoverMissingHomepageHero(components, {
      domSnapshot: '<main><section class="hero"><h1>Recovered hero</h1><p>Body text.</p></section></main>',
      pageUrl: 'https://www.example.com/',
    })

    expect(components).toHaveLength(3)
    expect(components[1].content.heading).toBe('Existing hero')
  })

  it('does not recover a hero from a bare title without hero evidence', () => {
    const components = [cardGrid()]

    recoverMissingHomepageHero(components, {
      domSnapshot: '<main><h1>Welcome</h1><p>Plain page title.</p><h2>Projects</h2></main>',
      pageUrl: 'https://www.example.com/',
    })

    expect(components).toHaveLength(1)
  })

  it('does not recover a hero from hidden source markup', () => {
    const components = [cardGrid()]

    recoverMissingHomepageHero(components, {
      domSnapshot: `
        <main>
          <section class="homepage-hero" hidden>
            <h1>Hidden campaign hero</h1>
            <p>This should not become the visible page hero.</p>
            <img src="/hidden.png" alt="Hidden" />
          </section>
          <section><h2>Visible page content</h2></section>
        </main>
      `,
      pageUrl: 'https://www.example.com/',
    })

    expect(components).toHaveLength(1)
  })

  it('does not recover a hero from a bare title with an unrelated image', () => {
    const components = [cardGrid()]

    recoverMissingHomepageHero(components, {
      domSnapshot: '<main><h1>Welcome</h1><img src="/logo.png" alt="Logo" /><h2>Projects</h2></main>',
      pageUrl: 'https://www.example.com/',
    })

    expect(components).toHaveLength(1)
  })
})
