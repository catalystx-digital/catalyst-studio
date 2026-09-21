/**
 * Tests for content type path cue matching.
 *
 * The point of these tests is that the answer must come from the path, not
 * from where a tag happens to sit in CONTENT_TYPE_PATH_CUES. Several cases
 * below deliberately pit an earlier-declared tag against a later-declared one.
 */

import {
  CONTENT_TYPE_PATH_CUES,
  CONTENT_TYPE_TAGS,
  PATH_CUE_TIE_BREAKS,
  collectPathCueMatches,
  findPathCueTie,
  matchTagFromPath,
  type ContentTypeTag
} from '../content-type-patterns'

/**
 * One representative path per cue in CONTENT_TYPE_PATH_CUES, including every
 * spelling variant the cue admits. Kept in step with the table by the
 * "covers every cue" test below.
 */
const CUE_SAMPLES: Record<ContentTypeTag, string[]> = {
  news: ['/news/', '/press/', '/media/', '/stories/', '/updates/', '/update/'],
  events: ['/events/', '/event/', '/whatson/', '/whats-on/', '/whats_on/', '/calendar/', '/webinars/', '/webinar/'],
  blog: ['/blog/', '/blogs/', '/insights/', '/insight/', '/articles/', '/article/', '/posts/', '/post/'],
  products: ['/products/', '/product/', '/catalogue/', '/catalog/', '/merchandise/', '/merch/'],
  collections: ['/collections/', '/collection/', '/categories/', '/category/', '/departments/', '/department/'],
  shop: ['/shop/', '/store/'],
  resources: ['/resources/', '/resource/', '/library/', '/guides/', '/guide/', '/downloads/', '/download/'],
  showcase: ['/showcase/', '/portfolio/', '/case-studies/', '/case-study/', '/customers/', '/customer/', '/work/'],
  projects: ['/projects/', '/project/', '/research/'],
  pricing: ['/pricing/', '/plans/', '/plan/', '/tiers/', '/tier/'],
  features: ['/features/', '/feature/', '/capabilities/'],
  changelog: ['/changelog/', '/releases/', '/release/', '/whats-new/', '/whatsnew/', '/whats_new/'],
  docs: ['/docs/', '/doc/', '/documentation/', '/api/', '/reference/'],
  support: ['/support/', '/help/', '/faq/', '/knowledge-base/', '/knowledgebase/', '/contact-us/', '/contactus/'],
  donate: [
    '/donate/', '/donations/', '/donation/', '/give/', '/giving/',
    '/ways-to-give/', '/waystogive/', '/foundation/', '/fundraise/',
    '/fundraising/', '/make-a-difference/', '/makeadifference/'
  ]
}

const ALL_SAMPLES = Object.values(CUE_SAMPLES).flat()

/** Where a tag sits in the literal - what used to decide matches. */
function declarationRank(tag: ContentTypeTag): number {
  return (CONTENT_TYPE_TAGS as readonly string[]).indexOf(tag)
}

describe('matchTagFromPath', () => {
  describe('the /updates/ decision', () => {
    // Both `news` and `changelog` claim /updates/ with the identical pattern,
    // so this is settled by PATH_CUE_TIE_BREAKS, not by declaration order.
    it.each([
      '/updates/',
      '/updates',
      '/update/',
      '/updates/q3-platform-release'
    ])('tags %s as news', path => {
      expect(matchTagFromPath(path)).toBe('news')
    })

    it('records the collision as a declared tie, not an accident', () => {
      expect(findPathCueTie('/updates/').sort()).toEqual(['changelog', 'news'])
      const rule = PATH_CUE_TIE_BREAKS.find(entry => entry.pattern.test('/updates/'))
      expect(rule).toBeDefined()
      expect(rule?.winner).toBe('news')
      expect(rule?.contenders.slice().sort()).toEqual(['changelog', 'news'])
      expect(rule?.reason).toBeTruthy()
    })

    it('leaves changelog its own unambiguous routes', () => {
      expect(matchTagFromPath('/changelog/')).toBe('changelog')
      expect(matchTagFromPath('/releases/')).toBe('changelog')
      expect(matchTagFromPath('/release/')).toBe('changelog')
      expect(matchTagFromPath('/whats-new/')).toBe('changelog')
      expect(matchTagFromPath('/whatsnew/')).toBe('changelog')
    })
  })

  describe('editorial routes beyond /blog/', () => {
    // These were previously untagged, so no CMS source binding was generated
    // for them even though the detector offered blog-list for the page.
    it.each([
      ['/insights/', 'blog'],
      ['/insights/q3-outlook', 'blog'],
      ['/insight/', 'blog'],
      ['/articles/', 'blog'],
      ['/articles/how-we-scaled', 'blog'],
      ['/article/', 'blog'],
      ['/posts/', 'blog'],
      ['/posts/hello-world', 'blog'],
      ['/post/', 'blog'],
      ['/blog/', 'blog'],
      ['/blogs/', 'blog']
    ])('tags %s as %s', (path, expected) => {
      expect(matchTagFromPath(path)).toBe(expected)
    })

    it('does not fire on words that merely start with a cue', () => {
      expect(matchTagFromPath('/postgres/')).toBeUndefined()
      expect(matchTagFromPath('/articulate/')).toBeUndefined()
      expect(matchTagFromPath('/insightful/')).toBeUndefined()
    })
  })

  describe('specificity beats declaration order', () => {
    it('keeps /resources/articles/ with resources, though blog is declared first', () => {
      expect(declarationRank('blog')).toBeLessThan(declarationRank('resources'))
      expect(matchTagFromPath('/resources/articles/')).toBe('resources')
      expect(matchTagFromPath('/resources/insights/')).toBe('resources')
    })

    it('gives /blog/resources/ to blog, the reverse nesting', () => {
      expect(matchTagFromPath('/blog/resources/')).toBe('blog')
    })

    it('lets a later-declared tag win when it matches the shallower segment', () => {
      // `news` is declared before `showcase` and before `donate`; under the old
      // first-match rule it took both of these paths.
      expect(declarationRank('news')).toBeLessThan(declarationRank('showcase'))
      expect(matchTagFromPath('/showcase/news/')).toBe('showcase')

      expect(declarationRank('news')).toBeLessThan(declarationRank('donate'))
      expect(matchTagFromPath('/foundation/news/')).toBe('donate')

      expect(declarationRank('events')).toBeLessThan(declarationRank('support'))
      expect(matchTagFromPath('/support/events/')).toBe('support')
    })

    it('prefers the longer literal match when two cues start at the same place', () => {
      // A shared prefix must not decide: /whats-new/ belongs to changelog and
      // /whats-on/ to events.
      expect(matchTagFromPath('/whats-new/')).toBe('changelog')
      expect(matchTagFromPath('/whats-on/')).toBe('events')
    })

    it('orders collected matches by position, not by declaration', () => {
      const matches = collectPathCueMatches('/resources/articles/')
      expect(matches.map(match => match.tag)).toEqual(['resources', 'blog'])
      expect(matches[0].index).toBeLessThan(matches[1].index)
    })
  })

  describe('the table as a whole', () => {
    it('covers every cue with at least one sample path', () => {
      for (const [tag, patterns] of Object.entries(CONTENT_TYPE_PATH_CUES) as Array<[ContentTypeTag, RegExp[]]>) {
        for (const pattern of patterns) {
          const covered = ALL_SAMPLES.some(sample => pattern.test(sample))
          expect({ tag, pattern: pattern.source, covered }).toEqual({ tag, pattern: pattern.source, covered: true })
        }
      }
    })

    it('resolves every sample path to its own tag', () => {
      for (const [tag, samples] of Object.entries(CUE_SAMPLES) as Array<[ContentTypeTag, string[]]>) {
        for (const sample of samples) {
          // A tied path is decided by PATH_CUE_TIE_BREAKS and is asserted
          // separately; here we only check the tags nothing else contests.
          if (findPathCueTie(sample).length > 0) {
            continue
          }
          expect({ sample, tag: matchTagFromPath(sample) }).toEqual({ sample, tag })
        }
      }
    })

    it('has no undeclared head-on collision anywhere in the table', () => {
      // Every cue against every cue, flat and nested. Any collision that is not
      // listed in PATH_CUE_TIE_BREAKS shows up here by name, so a future cue
      // that steals a path cannot land quietly.
      const undeclared: Array<{ path: string; tied: ContentTypeTag[] }> = []

      const check = (path: string) => {
        const tied = findPathCueTie(path)
        if (tied.length === 0) {
          return
        }
        const declared = PATH_CUE_TIE_BREAKS.some(
          rule => rule.pattern.test(path) && tied.includes(rule.winner)
        )
        if (!declared) {
          undeclared.push({ path, tied: tied.slice().sort() })
        }
      }

      for (const outer of ALL_SAMPLES) {
        check(outer)
        for (const inner of ALL_SAMPLES) {
          check(outer + inner.slice(1))
        }
      }

      expect(undeclared).toEqual([])
    })

    it('never lets a nested cue outrank the section segment', () => {
      for (const outer of ALL_SAMPLES) {
        const outerTag = matchTagFromPath(outer)
        if (!outerTag) {
          continue
        }
        for (const inner of ALL_SAMPLES) {
          const nested = outer + inner.slice(1)
          expect({ nested, tag: matchTagFromPath(nested) }).toEqual({ nested, tag: outerTag })
        }
      }
    })
  })

  it('returns undefined for empty or unmatched paths', () => {
    expect(matchTagFromPath()).toBeUndefined()
    expect(matchTagFromPath('')).toBeUndefined()
    expect(matchTagFromPath('/about/')).toBeUndefined()
  })
})
