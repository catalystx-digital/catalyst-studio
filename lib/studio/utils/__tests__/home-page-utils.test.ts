/**
 * @jest-environment node
 */
import { isHomeLike, isHomeNode, isHomeSitemapNode } from '../home-page-utils';

describe('isHomeLike', () => {
  it('accepts the exact spellings of a home page', () => {
    for (const value of ['home', 'Home', 'HOMEPAGE', 'home page', 'home-page', 'home_page', 'index']) {
      expect(isHomeLike(value)).toBe(true);
    }
  });

  it('accepts a root path', () => {
    expect(isHomeLike('/', { allowEmpty: true })).toBe(true);
    expect(isHomeLike('/home')).toBe(true);
    expect(isHomeLike('/index/')).toBe(true);
  });

  it('no longer treats any value containing the word "home" as the home page', () => {
    // The bug this replaced: token matching meant each of these was the homepage.
    expect(isHomeLike('About Our Home Services')).toBe(false);
    expect(isHomeLike('home-loans')).toBe(false);
    expect(isHomeLike('nursing home')).toBe(false);
    expect(isHomeLike('home-and-garden')).toBe(false);
    expect(isHomeLike('Homepage Design Tips')).toBe(false);
  });

  it('treats an empty value as home only when the caller allows it', () => {
    expect(isHomeLike('', { allowEmpty: true })).toBe(true);
    expect(isHomeLike('')).toBe(false);
    expect(isHomeLike('   ')).toBe(false);
  });

  it('treats the root path as home without the caller having to allow it', () => {
    // '/' is a path that says "the root", not a value that is missing, so it
    // does not go through allowEmpty. Normalising strips the slashes, which
    // once made '/' indistinguishable from '' and handed this answer to the
    // caller; the two are separated again.
    expect(isHomeLike('/')).toBe(true);
    expect(isHomeLike('/', { allowEmpty: false })).toBe(true);
    expect(isHomeLike('//')).toBe(true);
    expect(isHomeLike(' / ')).toBe(true);
    // Still distinct from a missing value.
    expect(isHomeLike('')).toBe(false);
    expect(isHomeLike('   ')).toBe(false);
  });

  it('rejects non-strings', () => {
    expect(isHomeLike(undefined)).toBe(false);
    expect(isHomeLike(null)).toBe(false);
    expect(isHomeLike(42)).toBe(false);
  });

  it('does not treat a locale root as the home page', () => {
    // A known, deliberate limitation. Matching any two-letter path would
    // capture real pages such as /ai.
    expect(isHomeLike('/en')).toBe(false);
    expect(isHomeLike('en')).toBe(false);
  });
});

describe('isHomeNode', () => {
  it('matches on a home slug', () => {
    expect(isHomeNode({ slug: 'home' })).toBe(true);
    expect(isHomeNode({ slug: '/' })).toBe(true);
  });

  it('matches a root path wherever it arrives, slug, title or page type', () => {
    // Every branch now asks the same question, so '/' means the root in all
    // three. It is matched before the empty-value rule is ever consulted.
    expect(isHomeNode({ slug: 'start', title: '/' })).toBe(true);
    expect(isHomeNode({ slug: 'start', metadata: { pageType: '/' } })).toBe(true);
  });

  it('reads a blank slug as unset, not as the site root', () => {
    // The decision, taken deliberately: isHomeNode no longer passes
    // allowEmpty to isHomeLike, so a slug that is missing or blank is not the
    // home page.
    //
    // It is not the blank value that identifies the root in this codebase. A
    // root says so explicitly — as the path '/', or as the name 'home' — and
    // both still match. Callers that care about the root path check fullPath,
    // which is '/' and matches unconditionally.
    //
    // A blank slug, by contrast, is what the code invents when there is no
    // page to describe: getTree() returns { title: 'Root', slug: '',
    // websitePageId: null, children: [] } for a site with no root structure,
    // and the sitemap read route returns that same placeholder when the real
    // root is a hidden import draft. Both reach the site builder, which asks
    // isHomeNode whether the site has a home page. Answering yes there would
    // block creating the home page on the one kind of site that has none.
    //
    // The option was not deleted for being merely decorative: '' did short
    // circuit on the old `candidate.slug &&` guard, but a whitespace-only slug
    // got past the guard and came back true. That was an accident of the
    // guard, not a policy, and blank is now blank either way.
    expect(isHomeNode({ slug: '' })).toBe(false);
    expect(isHomeNode({ slug: '   ' })).toBe(false);
    expect(isHomeNode({ slug: undefined })).toBe(false);

    // The same placeholder, as the site builder actually sees it.
    expect(isHomeNode({ title: 'Root', slug: '', metadata: undefined })).toBe(false);

    // A root that says what it is still matches.
    expect(isHomeNode({ slug: '/' })).toBe(true);
    expect(isHomeNode({ slug: 'home' })).toBe(true);

    // And a blank slug does not suppress the other two branches.
    expect(isHomeNode({ slug: '', title: 'Home' })).toBe(true);
    expect(isHomeNode({ slug: '   ', metadata: { pageType: 'homepage' } })).toBe(true);
  });

  it('matches on a declared page type', () => {
    expect(isHomeNode({ slug: 'landing', metadata: { pageType: 'home' } })).toBe(true);
    expect(isHomeNode({ slug: 'landing', metadata: { classification: { pageType: 'homepage' } } })).toBe(true);
  });

  it('matches a page whose title is exactly Home', () => {
    expect(isHomeNode({ slug: 'start', title: 'Home' })).toBe(true);
  });

  it('does not match a page that merely mentions home in its title', () => {
    expect(isHomeNode({ slug: 'services', title: 'About Our Home Services' })).toBe(false);
  });

  it('returns false for nothing at all', () => {
    expect(isHomeNode({})).toBe(false);
    expect(isHomeNode(undefined as never)).toBe(false);
  });
});

describe('isHomeSitemapNode', () => {
  it('reads label, slug and metadata off the node data', () => {
    expect(isHomeSitemapNode({ data: { slug: 'home' } })).toBe(true);
    expect(isHomeSitemapNode({ data: { label: 'Home', slug: 'start' } })).toBe(true);
    expect(isHomeSitemapNode({ data: { label: 'Home Loans', slug: 'loans' } })).toBe(false);
    expect(isHomeSitemapNode({})).toBe(false);
  });
});
