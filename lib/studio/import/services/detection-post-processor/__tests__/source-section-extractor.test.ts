import {
  classifySourceSection,
  extractSectionCards,
  extractSectionHeading,
  extractSectionNarrative,
  extractSourceSections
} from '../source-section-extractor'

describe('source-section-extractor', () => {
  it('extracts narrative sections with heading and paragraph copy', () => {
    const sections = extractSourceSections(`
      <main>
        <section>
          <h2>Who we are</h2>
          <p>We help teams create useful digital services for their customers.</p>
          <p>Our specialists work across strategy, design, and engineering.</p>
        </section>
      </main>
    `)

    expect(sections).toHaveLength(1)
    expect(sections[0]).toMatchObject({
      kind: 'narrative',
      heading: 'Who we are',
      body: 'We help teams create useful digital services for their customers.\n\nOur specialists work across strategy, design, and engineering.'
    })
  })

  it('extracts linked cards and resolves the largest srcset image', () => {
    const section = {
      html: `
        <section>
          <h2>Latest projects</h2>
          <a href="/work/a">
            <img src="/small.jpg" srcset="/small.jpg 320w, /large.jpg 1200w" alt="Project A">
            <h3>Project A</h3>
            <p>A useful project summary.</p>
          </a>
          <a href="https://example.com/work/b">
            <h3>Project B</h3>
          </a>
        </section>
      `
    }

    expect(extractSectionHeading(section)).toBe('Latest projects')
    expect(extractSectionNarrative(section)).toBe('A useful project summary.')
    expect(extractSectionCards(section, 'https://example.com/')).toEqual([
      {
        title: 'Project A',
        body: 'A useful project summary.',
        href: 'https://example.com/work/a',
        image: {
          src: 'https://example.com/large.jpg',
          alt: 'Project A'
        }
      },
      {
        title: 'Project B',
        href: 'https://example.com/work/b'
      }
    ])
  })

  it('classifies nav and footer sections separately from content', () => {
    expect(classifySourceSection({
      html: '<nav aria-label="Primary"><a href="/">Home</a></nav>',
      text: 'Home',
      cards: [],
      images: []
    })).toBe('nav')

    expect(classifySourceSection({
      html: '<footer><h2>Stay informed</h2><p>Subscribe for updates.</p></footer>',
      heading: 'Stay informed',
      body: 'Subscribe for updates.',
      text: 'Stay informed Subscribe for updates.',
      cards: [],
      images: []
    })).toBe('footer')
  })

  it('skips hidden sections', () => {
    const sections = extractSourceSections(`
      <section hidden><h2>Hidden</h2><p>This should not be imported.</p></section>
      <section style="display:none"><h2>Also hidden</h2></section>
      <section class="hidden-xs"><h2>Responsive visible</h2><p>This desktop or mobile alternate can still be useful.</p></section>
      <section><h2>Visible</h2><p>This content is visible and useful to visitors.</p></section>
    `)

    expect(sections.map(section => section.heading)).toEqual(['Responsive visible', 'Visible'])
  })

  it('extracts nested semantic sections separately instead of swallowing them as main content', () => {
    const sections = extractSourceSections(`
      <main>
        <section><h2>Intro</h2><p>Introductory source content for visitors that explains why the page matters and what the organization offers.</p></section>
        <section><h2>Projects</h2><a href="/work"><h3>Project A</h3></a></section>
      </main>
    `)

    expect(sections.map(section => section.heading)).toEqual(['Intro', 'Projects'])
    expect(sections.map(section => section.kind)).toEqual(['narrative', 'listing'])
  })
})
