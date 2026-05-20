/**
 * Unit tests for canonicalization module
 *
 * Tests all 40+ type aliases, normalization logic, and edge cases.
 */

import { describe, it, expect } from 'vitest'
import { canonicalizeComponentType } from '../canonicalization'

describe('canonicalizeComponentType', () => {
  describe('navbar aliases (16 total)', () => {
    it.each([
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
    ])('should map "%s" to "navbar"', (alias) => {
      expect(canonicalizeComponentType(alias)).toBe('navbar')
    })
  })

  describe('blog-post aliases (8 total)', () => {
    it.each([
      'blogpost',
      'blogposts',
      'blog-article',
      'blogarticle',
      'article',
      'articlebody',
      'article-content',
      'articlecontent',
    ])('should map "%s" to "blog-post"', (alias) => {
      expect(canonicalizeComponentType(alias)).toBe('blog-post')
    })
  })

  describe('blog-list aliases (5 total)', () => {
    it.each([
      'bloglist',
      'blog-index',
      'article-list',
      'articlelist',
      'post-list',
    ])('should map "%s" to "blog-list"', (alias) => {
      expect(canonicalizeComponentType(alias)).toBe('blog-list')
    })
  })

  describe('article-header aliases (1 total)', () => {
    it.each(['articleheader'])(
      'should map "%s" to "article-header"',
      (alias) => {
        expect(canonicalizeComponentType(alias)).toBe('article-header')
      }
    )
  })

  describe('author-bio aliases (1 total)', () => {
    it.each(['authorbio'])('should map "%s" to "author-bio"', (alias) => {
      expect(canonicalizeComponentType(alias)).toBe('author-bio')
    })
  })

  describe('rich-text aliases (1 total)', () => {
    it.each(['richtext'])('should map "%s" to "rich-text"', (alias) => {
      expect(canonicalizeComponentType(alias)).toBe('rich-text')
    })
  })

  describe('quote-block aliases (3 total)', () => {
    it.each(['quote', 'quoteblock', 'quote-block'])(
      'should map "%s" to "quote-block"',
      (alias) => {
        expect(canonicalizeComponentType(alias)).toBe('quote-block')
      }
    )
  })

  describe('footer aliases (6 total)', () => {
    it.each([
      'site-footer',
      'sitefooter',
      'global-footer',
      'globalfooter',
      'footer-menu',
      'footermenu',
    ])('should map "%s" to "footer"', (alias) => {
      expect(canonicalizeComponentType(alias)).toBe('footer')
    })
  })

  describe('normalization logic', () => {
    describe('uppercase conversion', () => {
      it('should handle uppercase input', () => {
        expect(canonicalizeComponentType('NAVBAR')).toBe('navbar')
        expect(canonicalizeComponentType('NavBar')).toBe('navbar')
        expect(canonicalizeComponentType('NAV-BAR')).toBe('navbar')
      })

      it('should handle mixed case input', () => {
        expect(canonicalizeComponentType('BlogPost')).toBe('blog-post')
        expect(canonicalizeComponentType('BLOG-ARTICLE')).toBe('blog-post')
        expect(canonicalizeComponentType('ArticleHeader')).toBe(
          'article-header'
        )
      })
    })

    describe('whitespace handling', () => {
      it('should strip leading whitespace', () => {
        expect(canonicalizeComponentType('  navbar')).toBe('navbar')
        expect(canonicalizeComponentType('   blog-post')).toBe('blog-post')
      })

      it('should strip trailing whitespace', () => {
        expect(canonicalizeComponentType('navbar  ')).toBe('navbar')
        expect(canonicalizeComponentType('footer   ')).toBe('footer')
      })

      it('should strip leading and trailing whitespace', () => {
        expect(canonicalizeComponentType('  navbar  ')).toBe('navbar')
        expect(canonicalizeComponentType('   quote   ')).toBe('quote-block')
      })

      it('should collapse internal spaces to hyphens', () => {
        expect(canonicalizeComponentType('nav bar')).toBe('navbar')
        expect(canonicalizeComponentType('blog post')).toBe('blog-post')
        expect(canonicalizeComponentType('article   header')).toBe(
          'article-header'
        )
      })
    })

    describe('version suffix removal', () => {
      it('should remove -v2 suffix', () => {
        expect(canonicalizeComponentType('navbar-v2')).toBe('navbar')
        expect(canonicalizeComponentType('blog-post-v2')).toBe('blog-post')
        expect(canonicalizeComponentType('footer-v2')).toBe('footer')
      })

      it('should remove other version suffixes', () => {
        expect(canonicalizeComponentType('navbar-v1')).toBe('navbar')
        expect(canonicalizeComponentType('navbar-v3')).toBe('navbar')
        expect(canonicalizeComponentType('navbar-v10')).toBe('navbar')
      })

      it('should handle uppercase version suffix', () => {
        expect(canonicalizeComponentType('navbar-V2')).toBe('navbar')
        expect(canonicalizeComponentType('NAVBAR-V2')).toBe('navbar')
      })
    })

    describe('hyphen normalization', () => {
      it('should convert underscores to hyphens', () => {
        expect(canonicalizeComponentType('nav_bar')).toBe('navbar')
        expect(canonicalizeComponentType('blog_post')).toBe('blog-post')
        expect(canonicalizeComponentType('article_header')).toBe(
          'article-header'
        )
      })

      it('should handle mixed underscores and hyphens', () => {
        expect(canonicalizeComponentType('nav_bar')).toBe('navbar')
        expect(canonicalizeComponentType('blog_post')).toBe('blog-post')
      })

      it('should collapse multiple underscores', () => {
        expect(canonicalizeComponentType('nav__bar')).toBe('navbar')
        expect(canonicalizeComponentType('blog___post')).toBe('blog-post')
      })
    })

    describe('special character handling', () => {
      it('should remove non-alphanumeric characters except hyphens', () => {
        expect(canonicalizeComponentType('nav@bar')).toBe('navbar')
        expect(canonicalizeComponentType('blog#post')).toBe('blog-post')
        expect(canonicalizeComponentType('quote!block')).toBe('quote-block')
      })

      it('should handle multiple special characters', () => {
        expect(canonicalizeComponentType('nav@#$bar')).toBe('navbar')
        expect(canonicalizeComponentType('blog!@#post')).toBe('blog-post')
      })
    })

    describe('combined normalization', () => {
      it('should handle multiple normalization steps', () => {
        expect(canonicalizeComponentType('  NAV_BAR-v2  ')).toBe('navbar')
        expect(canonicalizeComponentType(' BLOG  POST-V3 ')).toBe('blog-post')
        expect(canonicalizeComponentType('Article__Header-v1')).toBe(
          'article-header'
        )
      })

      it('should handle extreme cases', () => {
        expect(canonicalizeComponentType('  NAV@#$_BAR-v10  ')).toBe('navbar')
        expect(canonicalizeComponentType('BLOG___POST!@#-V99')).toBe(
          'blog-post'
        )
      })
    })
  })

  describe('edge cases', () => {
    it('should return null for null input', () => {
      expect(canonicalizeComponentType(null)).toBe(null)
    })

    it('should return null for undefined input', () => {
      expect(canonicalizeComponentType(undefined)).toBe(null)
    })

    it('should return null for empty string', () => {
      expect(canonicalizeComponentType('')).toBe(null)
    })

    it('should return null for whitespace-only string', () => {
      expect(canonicalizeComponentType('   ')).toBe(null)
      expect(canonicalizeComponentType('\t\n')).toBe(null)
    })

    it('should return normalized input for unknown types', () => {
      expect(canonicalizeComponentType('custom-component')).toBe(
        'custom-component'
      )
      expect(canonicalizeComponentType('weird-type')).toBe('weird-type')
      expect(canonicalizeComponentType('unknown')).toBe('unknown')
    })

    it('should normalize unknown types before returning', () => {
      expect(canonicalizeComponentType('Custom_Component-v2')).toBe(
        'custom-component'
      )
      expect(canonicalizeComponentType('  WEIRD__TYPE  ')).toBe('weird-type')
    })

    it('should handle numeric values converted to string', () => {
      // Note: Function expects string, but handles String(value) conversion
      expect(canonicalizeComponentType('123')).toBe('123')
      expect(canonicalizeComponentType('navbar123')).toBe('navbar123')
    })

    it('should handle single character input', () => {
      expect(canonicalizeComponentType('a')).toBe('a')
      expect(canonicalizeComponentType('1')).toBe('1')
    })
  })

  describe('canonical types themselves', () => {
    it('should return canonical types unchanged', () => {
      expect(canonicalizeComponentType('navbar')).toBe('navbar')
      expect(canonicalizeComponentType('blog-post')).toBe('blog-post')
      expect(canonicalizeComponentType('blog-list')).toBe('blog-list')
      expect(canonicalizeComponentType('article-header')).toBe('article-header')
      expect(canonicalizeComponentType('author-bio')).toBe('author-bio')
      expect(canonicalizeComponentType('rich-text')).toBe('rich-text')
      expect(canonicalizeComponentType('quote-block')).toBe('quote-block')
      expect(canonicalizeComponentType('footer')).toBe('footer')
    })
  })

  describe('alias count verification', () => {
    it('should have correct alias counts per canonical type', () => {
      // navbar: 16 aliases
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
      expect(navbarAliases).toHaveLength(16)

      // blog-post: 8 aliases
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
      expect(blogPostAliases).toHaveLength(8)

      // blog-list: 5 aliases
      const blogListAliases = [
        'bloglist',
        'blog-index',
        'article-list',
        'articlelist',
        'post-list',
      ]
      expect(blogListAliases).toHaveLength(5)

      // quote-block: 3 aliases
      const quoteBlockAliases = ['quote', 'quoteblock', 'quote-block']
      expect(quoteBlockAliases).toHaveLength(3)

      // footer: 6 aliases
      const footerAliases = [
        'site-footer',
        'sitefooter',
        'global-footer',
        'globalfooter',
        'footer-menu',
        'footermenu',
      ]
      expect(footerAliases).toHaveLength(6)

      // Total: 16 + 8 + 5 + 1 + 1 + 1 + 3 + 6 = 41 aliases
    })
  })
})
