/**
 * Unit Tests for External Link Helper
 *
 * Tests the openExternalLink utility for:
 * - URL validation
 * - Security attributes (noopener, noreferrer)
 * - Error handling
 * - Target behavior (_blank, _self)
 */

import { openExternalLink, isExternalUrl } from '../open-external-link'

describe('openExternalLink', () => {
  // Mock window.open and window.location
  const mockWindowOpen = jest.fn()
  const originalOpen = window.open
  const originalLocation = window.location

  beforeEach(() => {
    // Reset mocks
    mockWindowOpen.mockReset()
    window.open = mockWindowOpen

    // Mock location
    delete (window as any).location
    window.location = {
      ...originalLocation,
      href: 'http://localhost:3000',
      origin: 'http://localhost:3000',
    }

    // Mock console methods
    jest.spyOn(console, 'error').mockImplementation()
    jest.spyOn(console, 'warn').mockImplementation()
  })

  afterEach(() => {
    window.open = originalOpen
    window.location = originalLocation
    jest.restoreAllMocks()
  })

  describe('Valid URL Handling', () => {
    it('opens valid http URL in new tab', () => {
      const mockWindow = { opener: {} }
      mockWindowOpen.mockReturnValue(mockWindow)

      openExternalLink('http://example.com')

      expect(mockWindowOpen).toHaveBeenCalledWith(
        'http://example.com',
        '_blank',
        'noopener,noreferrer'
      )
      expect(mockWindow.opener).toBeNull()
    })

    it('opens valid https URL in new tab', () => {
      const mockWindow = { opener: {} }
      mockWindowOpen.mockReturnValue(mockWindow)

      openExternalLink('https://example.com')

      expect(mockWindowOpen).toHaveBeenCalledWith(
        'https://example.com',
        '_blank',
        'noopener,noreferrer'
      )
    })

    it('opens URL in same tab when target is _self', () => {
      openExternalLink('https://example.com', '_self')

      expect(window.location.href).toBe('https://example.com')
      expect(mockWindowOpen).not.toHaveBeenCalled()
    })

    it('allows relative URLs', () => {
      const mockWindow = { opener: {} }
      mockWindowOpen.mockReturnValue(mockWindow)

      openExternalLink('/contact')

      expect(mockWindowOpen).toHaveBeenCalledWith(
        '/contact',
        '_blank',
        'noopener,noreferrer'
      )
    })

    it('handles URLs with query parameters', () => {
      const mockWindow = { opener: {} }
      mockWindowOpen.mockReturnValue(mockWindow)

      openExternalLink('https://example.com?param=value&other=123')

      expect(mockWindowOpen).toHaveBeenCalledWith(
        'https://example.com?param=value&other=123',
        '_blank',
        'noopener,noreferrer'
      )
    })

    it('handles URLs with fragments', () => {
      const mockWindow = { opener: {} }
      mockWindowOpen.mockReturnValue(mockWindow)

      openExternalLink('https://example.com#section')

      expect(mockWindowOpen).toHaveBeenCalledWith(
        'https://example.com#section',
        '_blank',
        'noopener,noreferrer'
      )
    })

    it('trims whitespace from URLs', () => {
      const mockWindow = { opener: {} }
      mockWindowOpen.mockReturnValue(mockWindow)

      openExternalLink('  https://example.com  ')

      expect(mockWindowOpen).toHaveBeenCalledWith(
        'https://example.com',
        '_blank',
        'noopener,noreferrer'
      )
    })
  })

  describe('Invalid URL Handling', () => {
    it('throws error for empty string', () => {
      expect(() => openExternalLink('')).toThrow('Invalid URL')
      expect(console.error).toHaveBeenCalled()
    })

    it('throws error for null', () => {
      expect(() => openExternalLink(null as any)).toThrow('Invalid URL')
    })

    it('throws error for undefined', () => {
      expect(() => openExternalLink(undefined as any)).toThrow('Invalid URL')
    })

    it('throws error for non-string input', () => {
      expect(() => openExternalLink(123 as any)).toThrow('Invalid URL')
    })

    it('throws error for invalid URL format', () => {
      expect(() => openExternalLink('not-a-url')).toThrow('Invalid URL')
      expect(console.error).toHaveBeenCalled()
    })

    it('throws error for javascript: protocol', () => {
      expect(() => openExternalLink('javascript:alert("XSS")')).toThrow('Invalid URL')
    })

    it('throws error for data: protocol', () => {
      expect(() => openExternalLink('data:text/html,<script>alert(1)</script>')).toThrow('Invalid URL')
    })

    it('throws error for ftp: protocol', () => {
      expect(() => openExternalLink('ftp://example.com')).toThrow('Invalid URL')
    })

    it('throws error for file: protocol', () => {
      expect(() => openExternalLink('file:///etc/passwd')).toThrow('Invalid URL')
    })
  })

  describe('Security Features', () => {
    it('sets opener to null for new tabs', () => {
      const mockWindow = { opener: {} }
      mockWindowOpen.mockReturnValue(mockWindow)

      openExternalLink('https://example.com')

      expect(mockWindow.opener).toBeNull()
    })

    it('includes noopener in window features', () => {
      const mockWindow = { opener: {} }
      mockWindowOpen.mockReturnValue(mockWindow)

      openExternalLink('https://example.com')

      expect(mockWindowOpen).toHaveBeenCalledWith(
        expect.any(String),
        '_blank',
        expect.stringContaining('noopener')
      )
    })

    it('includes noreferrer in window features', () => {
      const mockWindow = { opener: {} }
      mockWindowOpen.mockReturnValue(mockWindow)

      openExternalLink('https://example.com')

      expect(mockWindowOpen).toHaveBeenCalledWith(
        expect.any(String),
        '_blank',
        expect.stringContaining('noreferrer')
      )
    })
  })

  describe('Popup Blocker Handling', () => {
    it('throws error when popup is blocked (window.open returns null)', () => {
      mockWindowOpen.mockReturnValue(null)

      expect(() => openExternalLink('https://example.com')).toThrow('Popup blocked')
      expect(console.warn).toHaveBeenCalled()
    })

    it('throws error when popup is blocked (window.open returns undefined)', () => {
      mockWindowOpen.mockReturnValue(undefined)

      expect(() => openExternalLink('https://example.com')).toThrow('Popup blocked')
    })

    it('does not throw popup error for _self target', () => {
      // _self uses location.href, not window.open
      expect(() => openExternalLink('https://example.com', '_self')).not.toThrow()
    })
  })

  describe('Error Handling', () => {
    it('logs error when window.open throws', () => {
      mockWindowOpen.mockImplementation(() => {
        throw new Error('Browser error')
      })

      expect(() => openExternalLink('https://example.com')).toThrow('Browser error')
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to open URL'),
        expect.any(Error)
      )
    })

    it('logs validation errors', () => {
      expect(() => openExternalLink('invalid')).toThrow()
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('URL validation failed'),
        'invalid'
      )
    })
  })
})

describe('isExternalUrl', () => {
  beforeEach(() => {
    // Mock window.location
    delete (window as any).location
    window.location = {
      origin: 'http://localhost:3000',
      href: 'http://localhost:3000',
    } as any
  })

  describe('External URLs', () => {
    it('identifies external http URL', () => {
      expect(isExternalUrl('http://example.com')).toBe(true)
    })

    it('identifies external https URL', () => {
      expect(isExternalUrl('https://example.com')).toBe(true)
    })

    it('identifies external URL with different subdomain', () => {
      expect(isExternalUrl('http://subdomain.localhost')).toBe(true)
    })

    it('identifies external URL with different port', () => {
      expect(isExternalUrl('http://localhost:4000')).toBe(true)
    })
  })

  describe('Internal URLs', () => {
    it('identifies relative URL as internal', () => {
      expect(isExternalUrl('/contact')).toBe(false)
    })

    it('identifies hash link as internal', () => {
      expect(isExternalUrl('#section')).toBe(false)
    })

    it('identifies same-origin URL as internal', () => {
      expect(isExternalUrl('http://localhost:3000/page')).toBe(false)
    })

    it('identifies root path as internal', () => {
      expect(isExternalUrl('/')).toBe(false)
    })

    it('identifies relative path with subdirectories as internal', () => {
      expect(isExternalUrl('/path/to/page')).toBe(false)
    })
  })

  describe('Edge Cases', () => {
    it('returns false for empty string', () => {
      expect(isExternalUrl('')).toBe(false)
    })

    it('returns false for null', () => {
      expect(isExternalUrl(null as any)).toBe(false)
    })

    it('returns false for undefined', () => {
      expect(isExternalUrl(undefined as any)).toBe(false)
    })

    it('returns false for non-string input', () => {
      expect(isExternalUrl(123 as any)).toBe(false)
    })

    it('handles whitespace correctly', () => {
      expect(isExternalUrl('  /contact  ')).toBe(false)
      expect(isExternalUrl('  https://example.com  ')).toBe(true)
    })

    it('returns false for malformed URLs', () => {
      expect(isExternalUrl('not-a-url')).toBe(false)
    })

    it('handles protocol-relative URLs', () => {
      // Protocol-relative URLs (//example.com) are considered external
      expect(isExternalUrl('//example.com')).toBe(true)
    })
  })
})
