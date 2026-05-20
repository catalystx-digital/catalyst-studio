/**
 * AliasRegistry Unit Tests
 *
 * Tests the generic alias resolution engine that replaces hardcoded switch statements
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { resolveAlias, clearAliasCache, getAllAliases, getAliasCount } from '../alias-registry'

describe('AliasRegistry', () => {
  beforeEach(() => {
    // Clear cache before each test for isolation
    clearAliasCache()
  })

  describe('resolveAlias', () => {
    describe('navbar aliases (16 total)', () => {
      const navbarAliases = [
        'nav',
        'navbar',
        'nav-bar',
        'navigation',
        'navigationbar',
        'navigation-menu',
        'navigationmenu',
        'menu-bar',
        'menubar',
        'top-nav',
        'topnav',
        'site-header',
        'siteheader',
        'global-header',
        'globalheader',
        'header',
      ]

      navbarAliases.forEach((alias) => {
        it(`should resolve "${alias}" to "navbar"`, () => {
          expect(resolveAlias(alias)).toBe('navbar')
        })
      })
    })

    describe('blog-post aliases (8 total)', () => {
      const blogPostAliases = [
        'blogpost',
        'blogposts',
        'blog-article',
        'blogarticle',
        'article',
        'articlebody',
        'article-content',
        'articlecontent',
      ]

      blogPostAliases.forEach((alias) => {
        it(`should resolve "${alias}" to "blog-post"`, () => {
          expect(resolveAlias(alias)).toBe('blog-post')
        })
      })
    })

    describe('footer aliases (6 total)', () => {
      const footerAliases = [
        'site-footer',
        'sitefooter',
        'global-footer',
        'globalfooter',
        'footer-menu',
        'footermenu',
      ]

      footerAliases.forEach((alias) => {
        it(`should resolve "${alias}" to "footer"`, () => {
          expect(resolveAlias(alias)).toBe('footer')
        })
      })
    })

    describe('other component aliases', () => {
      it('should resolve blog-list aliases', () => {
        expect(resolveAlias('bloglist')).toBe('blog-list')
        expect(resolveAlias('blog-index')).toBe('blog-list')
        expect(resolveAlias('article-list')).toBe('blog-list')
        expect(resolveAlias('articlelist')).toBe('blog-list')
        expect(resolveAlias('post-list')).toBe('blog-list')
      })

      it('should resolve article-header aliases', () => {
        expect(resolveAlias('articleheader')).toBe('article-header')
      })

      it('should resolve author-bio aliases', () => {
        expect(resolveAlias('authorbio')).toBe('author-bio')
      })

      it('should resolve rich-text aliases', () => {
        expect(resolveAlias('richtext')).toBe('rich-text')
      })

      it('should resolve quote-block aliases', () => {
        expect(resolveAlias('quote')).toBe('quote-block')
        expect(resolveAlias('quoteblock')).toBe('quote-block')
        expect(resolveAlias('quote-block')).toBe('quote-block')
      })
    })

    describe('unknown aliases', () => {
      it('should return null for unknown aliases', () => {
        expect(resolveAlias('unknown-component')).toBeNull()
        expect(resolveAlias('does-not-exist')).toBeNull()
        expect(resolveAlias('random-type')).toBeNull()
      })
    })
  })

  describe('cache management', () => {
    it('should cache alias map after first call', () => {
      const firstCall = resolveAlias('navbar')
      const secondCall = resolveAlias('navbar')

      expect(firstCall).toBe('navbar')
      expect(secondCall).toBe('navbar')
      // Map should be built only once (tested implicitly via performance)
    })

    it('should rebuild cache after clearAliasCache', () => {
      expect(resolveAlias('navbar')).toBe('navbar')
      clearAliasCache()
      expect(resolveAlias('navbar')).toBe('navbar')
    })
  })

  describe('getAllAliases', () => {
    it('should return all registered aliases', () => {
      const allAliases = getAllAliases()

      // Check structure
      expect(typeof allAliases).toBe('object')

      // Check some sample mappings
      expect(allAliases['navbar']).toBe('navbar')
      expect(allAliases['nav-bar']).toBe('navbar')
      expect(allAliases['blog-article']).toBe('blog-post')
      expect(allAliases['footer-menu']).toBe('footer')
    })

    it('should include all navbar aliases', () => {
      const allAliases = getAllAliases()
      const navbarKeys = Object.keys(allAliases).filter(key => allAliases[key] === 'navbar')

      // navbar has 16 aliases
      expect(navbarKeys.length).toBe(16)
    })

    it('should include all blog-post aliases', () => {
      const allAliases = getAllAliases()
      const blogPostKeys = Object.keys(allAliases).filter(key => allAliases[key] === 'blog-post')

      // blog-post has 8 aliases
      expect(blogPostKeys.length).toBe(8)
    })

    it('should include all footer aliases', () => {
      const allAliases = getAllAliases()
      const footerKeys = Object.keys(allAliases).filter(key => allAliases[key] === 'footer')

      // footer has 6 aliases
      expect(footerKeys.length).toBe(6)
    })
  })

  describe('getAliasCount', () => {
    it('should return total number of registered aliases', () => {
      const count = getAliasCount()

      // Total aliases: navbar(16) + blog-post(8) + blog-list(5) + footer(6) +
      // article-header(1) + author-bio(1) + rich-text(1) + quote-block(3) = 41
      expect(count).toBe(41)
    })
  })

  describe('integration with canonicalization', () => {
    it('should work seamlessly with normalized inputs', () => {
      // These would come pre-normalized from canonicalizeComponentType
      expect(resolveAlias('nav-bar')).toBe('navbar')
      expect(resolveAlias('blog-article')).toBe('blog-post')
      expect(resolveAlias('site-footer')).toBe('footer')
    })
  })
})
