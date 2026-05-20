import { describe, it, expect } from 'vitest'
import { prioritizeUrls, parsePriorityUrlsArg } from '../url-prioritizer'

describe('url-prioritizer', () => {
  describe('parsePriorityUrlsArg', () => {
    it('parses comma-separated paths', () => {
      const result = parsePriorityUrlsArg('/health-professionals,/research,/departments')
      expect(result).toEqual(['/health-professionals', '/research', '/departments'])
    })

    it('trims whitespace', () => {
      const result = parsePriorityUrlsArg('  /about , /contact  ,/services  ')
      expect(result).toEqual(['/about', '/contact', '/services'])
    })

    it('handles full URLs', () => {
      const result = parsePriorityUrlsArg('https://example.com/about,https://example.com/contact')
      expect(result).toEqual(['https://example.com/about', 'https://example.com/contact'])
    })

    it('returns empty array for empty string', () => {
      expect(parsePriorityUrlsArg('')).toEqual([])
      expect(parsePriorityUrlsArg('   ')).toEqual([])
    })

    it('filters out empty segments', () => {
      const result = parsePriorityUrlsArg('/about,,/contact,')
      expect(result).toEqual(['/about', '/contact'])
    })
  })

  describe('prioritizeUrls', () => {
    const testUrls = [
      'https://example.com/',
      'https://example.com/about',
      'https://example.com/contact',
      'https://example.com/health-professionals',
      'https://example.com/health-professionals/referrals',
      'https://example.com/health-professionals/clinical-guidelines',
      'https://example.com/health-professionals/clinical-guidelines/protocols',
      'https://example.com/research',
      'https://example.com/research/projects',
      'https://example.com/research/publications',
      'https://example.com/departments',
      'https://example.com/departments/emergency',
      'https://example.com/news',
      'https://example.com/blog',
    ]

    it('returns urls unchanged when no priority paths', () => {
      const result = prioritizeUrls({
        urls: testUrls,
        priorityPaths: [],
      })
      expect(result.urls).toEqual(testUrls)
      expect(result.stats.priorityExactCount).toBe(0)
      expect(result.stats.priorityChildrenCount).toBe(0)
    })

    it('puts home page first always', () => {
      const result = prioritizeUrls({
        urls: testUrls,
        priorityPaths: ['/health-professionals', '/research'],
      })
      expect(result.urls[0]).toBe('https://example.com/')
    })

    it('puts priority exact matches after home', () => {
      const result = prioritizeUrls({
        urls: testUrls,
        priorityPaths: ['/health-professionals', '/research'],
      })
      expect(result.urls[0]).toBe('https://example.com/')
      expect(result.urls[1]).toBe('https://example.com/health-professionals')
      expect(result.urls[2]).toBe('https://example.com/research')
    })

    it('puts priority children after exact matches', () => {
      const result = prioritizeUrls({
        urls: testUrls,
        priorityPaths: ['/health-professionals'],
      })

      // Home first
      expect(result.urls[0]).toBe('https://example.com/')
      // Exact match
      expect(result.urls[1]).toBe('https://example.com/health-professionals')
      // Children (sorted by depth)
      expect(result.urls[2]).toBe('https://example.com/health-professionals/referrals')
      expect(result.urls[3]).toBe('https://example.com/health-professionals/clinical-guidelines')
      // Deeper children
      expect(result.urls[4]).toBe('https://example.com/health-professionals/clinical-guidelines/protocols')
    })

    it('respects maxUrls limit', () => {
      const result = prioritizeUrls({
        urls: testUrls,
        priorityPaths: ['/health-professionals'],
        maxUrls: 5,
      })
      expect(result.urls.length).toBe(5)
      expect(result.stats.totalOutput).toBe(5)
    })

    it('handles case-insensitive comparison', () => {
      const result = prioritizeUrls({
        urls: ['https://example.com/About', 'https://example.com/CONTACT'],
        priorityPaths: ['/about'],
      })
      expect(result.urls[0]).toBe('https://example.com/About')
    })

    it('handles trailing slashes', () => {
      const result = prioritizeUrls({
        urls: ['https://example.com/about/', 'https://example.com/contact'],
        priorityPaths: ['/about/'],
      })
      // Should match even with trailing slash differences
      expect(result.urls[0]).toBe('https://example.com/about/')
    })

    it('handles full URL priority paths', () => {
      const result = prioritizeUrls({
        urls: testUrls,
        priorityPaths: ['https://example.com/research', 'https://other.com/ignored'],
      })
      // Home first, then research
      expect(result.urls[0]).toBe('https://example.com/')
      expect(result.urls[1]).toBe('https://example.com/research')
    })

    it('preserves order of non-priority URLs', () => {
      const result = prioritizeUrls({
        urls: testUrls,
        priorityPaths: ['/health-professionals'],
      })

      // Get non-priority URLs from result
      const nonPriorityUrls = result.urls.filter(
        url => !url.includes('/health-professionals') && url !== 'https://example.com/'
      )

      // They should be in the same order as original
      const originalNonPriority = testUrls.filter(
        url => !url.includes('/health-professionals') && url !== 'https://example.com/'
      )

      expect(nonPriorityUrls).toEqual(originalNonPriority)
    })

    it('provides accurate stats', () => {
      const result = prioritizeUrls({
        urls: testUrls,
        priorityPaths: ['/health-professionals', '/research'],
      })

      // health-professionals + research = 2 exact
      expect(result.stats.priorityExactCount).toBe(2)
      // 3 children under health-professionals + 2 under research = 5
      expect(result.stats.priorityChildrenCount).toBe(5)
      // Remaining non-priority (including home)
      expect(result.stats.nonPriorityCount).toBe(testUrls.length - 2 - 5)
      expect(result.stats.totalInput).toBe(testUrls.length)
      expect(result.stats.totalOutput).toBe(testUrls.length)
    })

    it('handles empty urls array', () => {
      const result = prioritizeUrls({
        urls: [],
        priorityPaths: ['/about'],
      })
      expect(result.urls).toEqual([])
      expect(result.stats.totalOutput).toBe(0)
    })

    it('handles URLs without home page', () => {
      const urlsWithoutHome = testUrls.filter(u => u !== 'https://example.com/')
      const result = prioritizeUrls({
        urls: urlsWithoutHome,
        priorityPaths: ['/research'],
      })
      // First should be research (no home to put first)
      expect(result.urls[0]).toBe('https://example.com/research')
    })
  })
})
