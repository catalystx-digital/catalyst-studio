/**
 * URL Transformer Tests
 *
 * Tests for URL transformation during import.
 */

import {
  transformUrl,
  transformHtmlUrls,
  transformObjectUrls,
  transformComponentUrls,
  extractOrigin,
  isAnchorLink,
  isSpecialProtocol,
  isProtocolRelative,
  isRelativePath,
  isSameOrigin,
  type UrlTransformContext,
} from '../url-transformer'

describe('URL Transformer', () => {
  describe('extractOrigin', () => {
    it('extracts origin from absolute URL', () => {
      expect(extractOrigin('https://example.com/path/page')).toBe('https://example.com')
    })

    it('extracts origin with port', () => {
      expect(extractOrigin('http://localhost:3000/test')).toBe('http://localhost:3000')
    })

    it('returns null for relative paths', () => {
      expect(extractOrigin('/about')).toBeNull()
    })

    it('returns null for undefined', () => {
      expect(extractOrigin(undefined)).toBeNull()
    })
  })

  describe('isAnchorLink', () => {
    it('detects anchor links', () => {
      expect(isAnchorLink('#section')).toBe(true)
      expect(isAnchorLink('#top')).toBe(true)
    })

    it('rejects non-anchor links', () => {
      expect(isAnchorLink('/about#section')).toBe(false)
      expect(isAnchorLink('https://example.com#hash')).toBe(false)
    })
  })

  describe('isSpecialProtocol', () => {
    it('detects mailto links', () => {
      expect(isSpecialProtocol('mailto:test@example.com')).toBe(true)
    })

    it('detects tel links', () => {
      expect(isSpecialProtocol('tel:+1234567890')).toBe(true)
    })

    it('detects javascript links', () => {
      expect(isSpecialProtocol('javascript:void(0)')).toBe(true)
    })

    it('rejects http/https', () => {
      expect(isSpecialProtocol('https://example.com')).toBe(false)
      expect(isSpecialProtocol('http://example.com')).toBe(false)
    })
  })

  describe('isProtocolRelative', () => {
    it('detects protocol-relative URLs', () => {
      expect(isProtocolRelative('//example.com/path')).toBe(true)
    })

    it('rejects absolute URLs', () => {
      expect(isProtocolRelative('https://example.com')).toBe(false)
    })

    it('rejects single slash paths', () => {
      expect(isProtocolRelative('/path')).toBe(false)
    })
  })

  describe('isRelativePath', () => {
    it('detects root-relative paths', () => {
      expect(isRelativePath('/about')).toBe(true)
      expect(isRelativePath('/path/to/page')).toBe(true)
    })

    it('detects relative paths', () => {
      expect(isRelativePath('./page')).toBe(true)
      expect(isRelativePath('../page')).toBe(true)
      expect(isRelativePath('page.html')).toBe(true)
    })

    it('rejects absolute URLs', () => {
      expect(isRelativePath('https://example.com')).toBe(false)
      expect(isRelativePath('http://example.com/path')).toBe(false)
    })

    it('rejects protocol-relative URLs', () => {
      expect(isRelativePath('//example.com')).toBe(false)
    })
  })

  describe('isSameOrigin', () => {
    it('returns true for same origin', () => {
      expect(isSameOrigin('https://example.com/path', 'https://example.com')).toBe(true)
      expect(isSameOrigin('https://example.com/', 'https://example.com/')).toBe(true)
    })

    it('returns true regardless of trailing slash', () => {
      expect(isSameOrigin('https://example.com/path', 'https://example.com/')).toBe(true)
    })

    it('returns false for different origins', () => {
      expect(isSameOrigin('https://other.com/path', 'https://example.com')).toBe(false)
    })

    it('returns false for relative paths', () => {
      expect(isSameOrigin('/path', 'https://example.com')).toBe(false)
    })
  })

  describe('transformUrl', () => {
    const ctx: UrlTransformContext = {
      sourceOrigin: 'https://old-site.com',
      mode: 'relative',
      preserveExternal: true,
    }

    it('transforms source origin URL to relative path', () => {
      const result = transformUrl('https://old-site.com/about', ctx)
      expect(result.url).toBe('/about')
      expect(result.transformed).toBe(true)
    })

    it('transforms URL with query and hash', () => {
      const result = transformUrl('https://old-site.com/page?id=1#section', ctx)
      expect(result.url).toBe('/page?id=1#section')
      expect(result.transformed).toBe(true)
    })

    it('preserves external links', () => {
      const result = transformUrl('https://external.com/page', ctx)
      expect(result.url).toBe('https://external.com/page')
      expect(result.transformed).toBe(false)
      expect(result.reason).toBe('external')
    })

    it('preserves anchor links', () => {
      const result = transformUrl('#section', ctx)
      expect(result.url).toBe('#section')
      expect(result.transformed).toBe(false)
      expect(result.reason).toBe('anchor')
    })

    it('preserves mailto links', () => {
      const result = transformUrl('mailto:test@example.com', ctx)
      expect(result.url).toBe('mailto:test@example.com')
      expect(result.transformed).toBe(false)
      expect(result.reason).toBe('special-protocol')
    })

    it('preserves tel links', () => {
      const result = transformUrl('tel:+1234567890', ctx)
      expect(result.url).toBe('tel:+1234567890')
      expect(result.transformed).toBe(false)
      expect(result.reason).toBe('special-protocol')
    })

    it('preserves already-relative paths', () => {
      const result = transformUrl('/about', ctx)
      expect(result.url).toBe('/about')
      expect(result.transformed).toBe(false)
      expect(result.reason).toBe('relative')
    })

    it('handles mode none', () => {
      const result = transformUrl('https://old-site.com/about', { ...ctx, mode: 'none' })
      expect(result.url).toBe('https://old-site.com/about')
      expect(result.transformed).toBe(false)
      expect(result.reason).toBe('mode-none')
    })

    it('handles absolute mode with target origin', () => {
      const result = transformUrl('https://old-site.com/about', {
        ...ctx,
        mode: 'absolute',
        targetOrigin: 'https://new-site.com',
      })
      expect(result.url).toBe('https://new-site.com/about')
      expect(result.transformed).toBe(true)
    })

    it('handles null/undefined input', () => {
      expect(transformUrl(null, ctx).url).toBe('')
      expect(transformUrl(undefined, ctx).url).toBe('')
      expect(transformUrl('', ctx).url).toBe('')
    })

    it('handles protocol-relative URLs from same host', () => {
      const result = transformUrl('//old-site.com/path', ctx)
      expect(result.url).toBe('/path')
      expect(result.transformed).toBe(true)
    })
  })

  describe('transformHtmlUrls', () => {
    const ctx: UrlTransformContext = {
      sourceOrigin: 'https://old-site.com',
      mode: 'relative',
      preserveExternal: true,
    }

    it('transforms href attributes', () => {
      const html = '<a href="https://old-site.com/about">About</a>'
      const result = transformHtmlUrls(html, ctx)
      expect(result.html).toBe('<a href="/about">About</a>')
      expect(result.transformedCount).toBe(1)
    })

    it('transforms src attributes', () => {
      const html = '<img src="https://old-site.com/image.png" />'
      const result = transformHtmlUrls(html, ctx)
      expect(result.html).toBe('<img src="/image.png" />')
      expect(result.transformedCount).toBe(1)
    })

    it('transforms multiple URLs', () => {
      const html = `
        <a href="https://old-site.com/page1">Page 1</a>
        <a href="https://old-site.com/page2">Page 2</a>
      `
      const result = transformHtmlUrls(html, ctx)
      expect(result.html).toContain('href="/page1"')
      expect(result.html).toContain('href="/page2"')
      expect(result.transformedCount).toBe(2)
    })

    it('preserves external URLs in HTML', () => {
      const html = '<a href="https://external.com/page">External</a>'
      const result = transformHtmlUrls(html, ctx)
      expect(result.html).toBe('<a href="https://external.com/page">External</a>')
      expect(result.transformedCount).toBe(0)
    })

    it('handles mode none', () => {
      const html = '<a href="https://old-site.com/about">About</a>'
      const result = transformHtmlUrls(html, { ...ctx, mode: 'none' })
      expect(result.html).toBe(html)
      expect(result.transformedCount).toBe(0)
    })
  })

  describe('transformObjectUrls', () => {
    const ctx: UrlTransformContext = {
      sourceOrigin: 'https://old-site.com',
      mode: 'relative',
      preserveExternal: true,
    }

    it('transforms URL fields', () => {
      const obj = { href: 'https://old-site.com/about', text: 'About Us' }
      const result = transformObjectUrls(obj, ctx)
      expect(result.href).toBe('/about')
      expect(result.text).toBe('About Us')
    })

    it('transforms nested objects', () => {
      const obj = {
        button: {
          href: 'https://old-site.com/cta',
          label: 'Click me',
        },
      }
      const result = transformObjectUrls(obj, ctx)
      expect(result.button.href).toBe('/cta')
    })

    it('transforms arrays', () => {
      const obj = {
        links: [
          { href: 'https://old-site.com/page1', text: 'Page 1' },
          { href: 'https://old-site.com/page2', text: 'Page 2' },
        ],
      }
      const result = transformObjectUrls(obj, ctx)
      expect(result.links[0].href).toBe('/page1')
      expect(result.links[1].href).toBe('/page2')
    })

    it('transforms HTML content fields', () => {
      const obj = {
        bodyHtml: '<a href="https://old-site.com/about">About</a>',
      }
      const result = transformObjectUrls(obj, ctx)
      expect(result.bodyHtml).toBe('<a href="/about">About</a>')
    })

    it('tracks transformation stats', () => {
      const obj = {
        href: 'https://old-site.com/page1',
        link: 'https://old-site.com/page2',
        url: 'https://external.com/page', // external URL - counted but not transformed
      }
      const stats = { transformed: 0, total: 0 }
      transformObjectUrls(obj, ctx, stats)
      expect(stats.total).toBe(3)
      expect(stats.transformed).toBe(2) // only 2 from source origin
    })
  })

  describe('transformComponentUrls', () => {
    it('transforms component content URLs', () => {
      const components = [
        {
          type: 'hero',
          content: {
            title: 'Welcome',
            button: { href: 'https://old-site.com/cta', text: 'Get Started' },
          },
        },
        {
          type: 'nav',
          content: {
            links: [
              { href: 'https://old-site.com/about', text: 'About' },
              { href: 'https://old-site.com/contact', text: 'Contact' },
            ],
          },
        },
      ]

      const { components: result, stats } = transformComponentUrls(
        components,
        'https://old-site.com',
        'relative'
      )

      expect(result[0].content.button.href).toBe('/cta')
      expect(result[1].content.links[0].href).toBe('/about')
      expect(result[1].content.links[1].href).toBe('/contact')
      expect(stats.transformed).toBe(3)
    })

    it('skips transformation when mode is none', () => {
      const components = [
        {
          content: { href: 'https://old-site.com/page' },
        },
      ]

      const { components: result, stats } = transformComponentUrls(
        components,
        'https://old-site.com',
        'none'
      )

      expect(result[0].content.href).toBe('https://old-site.com/page')
      expect(stats.transformed).toBe(0)
    })

    it('skips components without content', () => {
      const components = [{ type: 'spacer' }]
      const { components: result } = transformComponentUrls(
        components,
        'https://old-site.com',
        'relative'
      )
      expect(result).toEqual(components)
    })
  })
})
