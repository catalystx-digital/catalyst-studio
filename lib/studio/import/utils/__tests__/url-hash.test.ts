/**
 * URL Hash Utility Tests
 */

import { hashUrl, normalizeUrl, createUrlHashMap, verifyUrlHash } from '../url-hash'

describe('url-hash', () => {
  describe('normalizeUrl', () => {
    it('should normalize trailing slashes', () => {
      expect(normalizeUrl('https://example.com/about/')).toBe('https://example.com/about')
      expect(normalizeUrl('https://example.com/about')).toBe('https://example.com/about')
    })

    it('should preserve root trailing slash', () => {
      // Root paths should keep trailing slash behavior consistent
      const normalized = normalizeUrl('https://example.com/')
      expect(normalized).toBe('https://example.com/')
    })

    it('should remove fragments', () => {
      expect(normalizeUrl('https://example.com/about#section')).toBe('https://example.com/about')
      expect(normalizeUrl('https://example.com/about#section#nested')).toBe('https://example.com/about')
    })

    it('should preserve query parameters', () => {
      expect(normalizeUrl('https://example.com/search?q=test')).toBe('https://example.com/search?q=test')
      expect(normalizeUrl('https://example.com/search?q=test&page=2')).toBe('https://example.com/search?q=test&page=2')
    })

    it('should handle invalid URLs gracefully', () => {
      expect(normalizeUrl('not-a-url')).toBe('not-a-url')
    })
  })

  describe('hashUrl', () => {
    it('should produce consistent 16-character hash', () => {
      const hash = hashUrl('https://example.com/about')
      expect(hash).toHaveLength(16)
      expect(hash).toMatch(/^[a-f0-9]+$/)
    })

    it('should produce same hash for equivalent URLs', () => {
      expect(hashUrl('https://example.com/about')).toBe(hashUrl('https://example.com/about/'))
      expect(hashUrl('https://example.com/about')).toBe(hashUrl('https://example.com/about#section'))
    })

    it('should produce different hashes for different URLs', () => {
      const hash1 = hashUrl('https://example.com/about')
      const hash2 = hashUrl('https://example.com/contact')
      expect(hash1).not.toBe(hash2)
    })

    it('should handle URLs with query parameters', () => {
      const hash1 = hashUrl('https://example.com/search?q=foo')
      const hash2 = hashUrl('https://example.com/search?q=bar')
      expect(hash1).not.toBe(hash2)
    })
  })

  describe('createUrlHashMap', () => {
    it('should create map of URL to hash', () => {
      const urls = [
        'https://example.com',
        'https://example.com/about',
        'https://example.com/contact'
      ]

      const map = createUrlHashMap(urls)

      expect(map.size).toBe(3)
      expect(map.get('https://example.com')).toHaveLength(16)
      expect(map.get('https://example.com/about')).toHaveLength(16)
      expect(map.get('https://example.com/contact')).toHaveLength(16)

      // Each hash should be unique
      const hashes = Array.from(map.values())
      expect(new Set(hashes).size).toBe(3)
    })
  })

  describe('verifyUrlHash', () => {
    it('should verify matching hash', () => {
      const url = 'https://example.com/about'
      const hash = hashUrl(url)
      expect(verifyUrlHash(url, hash)).toBe(true)
    })

    it('should reject non-matching hash', () => {
      expect(verifyUrlHash('https://example.com/about', 'incorrect_hash_')).toBe(false)
    })
  })
})
