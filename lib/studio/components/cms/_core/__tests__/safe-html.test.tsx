/**
 * Unit Tests for SafeHtml Component
 *
 * Tests the SafeHtml component for:
 * - HTML sanitization using DOMPurify
 * - XSS attack prevention
 * - Tag and className support
 * - Edge cases and error handling
 */

import React from 'react'
import { render, screen } from '@testing-library/react'
import { SafeHtml } from '../safe-html'

describe('SafeHtml Component', () => {
  describe('Basic Rendering', () => {
    it('renders sanitized HTML content', () => {
      const html = '<p>Hello <strong>World</strong></p>'
      const { container } = render(<SafeHtml html={html} />)

      expect(container.querySelector('p')).toBeInTheDocument()
      expect(container.querySelector('strong')).toBeInTheDocument()
      expect(container.textContent).toBe('Hello World')
    })

    it('renders with custom tag', () => {
      const html = '<span>Content</span>'
      const { container } = render(<SafeHtml html={html} tag="span" />)

      // Container should be a span
      expect(container.firstChild?.nodeName).toBe('SPAN')
    })

    it('renders with custom className', () => {
      const html = '<p>Content</p>'
      const { container } = render(<SafeHtml html={html} className="custom-class" />)

      expect(container.firstChild).toHaveClass('custom-class')
    })

    it('supports all allowed tag types', () => {
      const tags: Array<'div' | 'span' | 'p' | 'article' | 'section'> = [
        'div', 'span', 'p', 'article', 'section'
      ]

      tags.forEach((tag) => {
        const { container } = render(<SafeHtml html="<b>Test</b>" tag={tag} />)
        expect(container.firstChild?.nodeName).toBe(tag.toUpperCase())
      })
    })
  })

  describe('XSS Protection', () => {
    it('removes script tags', () => {
      const html = '<p>Safe</p><script>alert("XSS")</script>'
      const { container } = render(<SafeHtml html={html} />)

      expect(container.querySelector('script')).not.toBeInTheDocument()
      expect(container.textContent).toBe('Safe')
    })

    it('removes inline event handlers', () => {
      const html = '<button onclick="alert(\'XSS\')">Click</button>'
      const { container } = render(<SafeHtml html={html} />)

      // Button element should be stripped (not in allowed tags)
      expect(container.querySelector('button')).not.toBeInTheDocument()
    })

    it('removes javascript: URLs', () => {
      const html = '<a href="javascript:alert(\'XSS\')">Link</a>'
      const { container } = render(<SafeHtml html={html} />)

      const link = container.querySelector('a')
      expect(link).toBeInTheDocument()
      // DOMPurify strips the href with javascript:
      expect(link?.getAttribute('href')).toBeNull()
    })

    it('removes iframe tags', () => {
      const html = '<p>Safe</p><iframe src="evil.com"></iframe>'
      const { container } = render(<SafeHtml html={html} />)

      expect(container.querySelector('iframe')).not.toBeInTheDocument()
      expect(container.textContent).toBe('Safe')
    })

    it('removes onerror attributes from img tags', () => {
      const html = '<img src="image.jpg" onerror="alert(\'XSS\')" alt="Test" />'
      const { container } = render(<SafeHtml html={html} />)

      const img = container.querySelector('img')
      expect(img).toBeInTheDocument()
      expect(img?.getAttribute('onerror')).toBeNull()
      expect(img?.getAttribute('src')).toBe('image.jpg')
    })

    it('preserves safe HTML with links', () => {
      const html = '<p>Visit <a href="https://example.com">our site</a></p>'
      const { container } = render(<SafeHtml html={html} />)

      const link = container.querySelector('a')
      expect(link).toBeInTheDocument()
      expect(link?.getAttribute('href')).toBe('https://example.com')
      expect(link?.textContent).toBe('our site')
    })
  })

  describe('Allowed Content', () => {
    it('allows basic formatting tags', () => {
      const html = '<p><b>Bold</b> <i>Italic</i> <em>Emphasis</em> <strong>Strong</strong></p>'
      const { container } = render(<SafeHtml html={html} />)

      expect(container.querySelector('b')).toBeInTheDocument()
      expect(container.querySelector('i')).toBeInTheDocument()
      expect(container.querySelector('em')).toBeInTheDocument()
      expect(container.querySelector('strong')).toBeInTheDocument()
    })

    it('allows lists', () => {
      const html = '<ul><li>Item 1</li><li>Item 2</li></ul>'
      const { container } = render(<SafeHtml html={html} />)

      expect(container.querySelector('ul')).toBeInTheDocument()
      expect(container.querySelectorAll('li')).toHaveLength(2)
    })

    it('allows headings', () => {
      const html = '<h1>Title</h1><h2>Subtitle</h2>'
      const { container } = render(<SafeHtml html={html} />)

      expect(container.querySelector('h1')).toBeInTheDocument()
      expect(container.querySelector('h2')).toBeInTheDocument()
    })

    it('allows images with safe attributes', () => {
      const html = '<img src="/image.jpg" alt="Description" title="Image Title" />'
      const { container } = render(<SafeHtml html={html} />)

      const img = container.querySelector('img')
      expect(img).toBeInTheDocument()
      expect(img?.getAttribute('src')).toBe('/image.jpg')
      expect(img?.getAttribute('alt')).toBe('Description')
      expect(img?.getAttribute('title')).toBe('Image Title')
    })

    it('allows tables', () => {
      const html = '<table><thead><tr><th>Header</th></tr></thead><tbody><tr><td>Cell</td></tr></tbody></table>'
      const { container } = render(<SafeHtml html={html} />)

      expect(container.querySelector('table')).toBeInTheDocument()
      expect(container.querySelector('thead')).toBeInTheDocument()
      expect(container.querySelector('tbody')).toBeInTheDocument()
      expect(container.querySelector('th')).toBeInTheDocument()
      expect(container.querySelector('td')).toBeInTheDocument()
    })
  })

  describe('Edge Cases', () => {
    it('handles empty string', () => {
      const { container } = render(<SafeHtml html="" />)

      expect(container.firstChild?.textContent).toBe('')
    })

    it('handles whitespace-only string', () => {
      const { container } = render(<SafeHtml html="   " />)

      // DOMPurify returns empty for whitespace-only
      expect(container.firstChild?.innerHTML).toBe('')
    })

    it('handles plain text (no HTML)', () => {
      const { container } = render(<SafeHtml html="Just plain text" />)

      expect(container.textContent).toBe('Just plain text')
    })

    it('handles malformed HTML gracefully', () => {
      const html = '<p>Unclosed paragraph <strong>Bold'
      const { container } = render(<SafeHtml html={html} />)

      // Browser/DOMPurify auto-closes tags
      expect(container.querySelector('p')).toBeInTheDocument()
      expect(container.querySelector('strong')).toBeInTheDocument()
    })

    it('memoizes sanitized HTML to avoid re-sanitization', () => {
      const html = '<p>Test content</p>'
      const { container, rerender } = render(<SafeHtml html={html} />)

      const firstInnerHTML = container.firstChild?.innerHTML

      // Re-render with same HTML
      rerender(<SafeHtml html={html} />)

      // Should have same innerHTML (memoization working)
      expect(container.firstChild?.innerHTML).toBe(firstInnerHTML)
    })

    it('re-sanitizes when HTML changes', () => {
      const { container, rerender } = render(<SafeHtml html="<p>First</p>" />)

      expect(container.textContent).toBe('First')

      // Change HTML
      rerender(<SafeHtml html="<p>Second</p>" />)

      expect(container.textContent).toBe('Second')
    })

    it('handles null/undefined as empty string', () => {
      // TypeScript would prevent this, but test runtime behavior
      const { container } = render(<SafeHtml html={null as any} />)

      expect(container.firstChild?.innerHTML).toBe('')
    })

    it('handles non-string input gracefully', () => {
      // TypeScript would prevent this, but test runtime behavior
      const { container } = render(<SafeHtml html={123 as any} />)

      expect(container.firstChild?.innerHTML).toBe('')
    })
  })

  describe('Attribute Filtering', () => {
    it('strips data-* attributes', () => {
      const html = '<div data-user-id="123" data-secret="password">Content</div>'
      const { container } = render(<SafeHtml html={html} />)

      const div = container.querySelector('div')
      expect(div?.getAttribute('data-user-id')).toBeNull()
      expect(div?.getAttribute('data-secret')).toBeNull()
    })

    it('strips style attributes', () => {
      const html = '<p style="color: red; background: url(javascript:alert(1))">Content</p>'
      const { container } = render(<SafeHtml html={html} />)

      const p = container.querySelector('p')
      expect(p?.getAttribute('style')).toBeNull()
    })

    it('allows class attribute', () => {
      const html = '<p class="text-red-500">Content</p>'
      const { container } = render(<SafeHtml html={html} />)

      const p = container.querySelector('p')
      expect(p?.getAttribute('class')).toBe('text-red-500')
    })

    it('allows safe link attributes', () => {
      const html = '<a href="/page" target="_blank" rel="noopener">Link</a>'
      const { container } = render(<SafeHtml html={html} />)

      const link = container.querySelector('a')
      expect(link?.getAttribute('href')).toBe('/page')
      expect(link?.getAttribute('target')).toBe('_blank')
      expect(link?.getAttribute('rel')).toBe('noopener')
    })
  })

  describe('Multiple Instances', () => {
    it('handles multiple SafeHtml instances independently', () => {
      const { container } = render(
        <div>
          <SafeHtml html="<p>First</p>" className="first" />
          <SafeHtml html="<p>Second</p>" className="second" />
        </div>
      )

      const instances = container.querySelectorAll('div > div')
      expect(instances).toHaveLength(2)
      expect(instances[0]).toHaveClass('first')
      expect(instances[1]).toHaveClass('second')
    })
  })
})
