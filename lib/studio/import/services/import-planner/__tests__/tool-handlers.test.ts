/**
 * Tests for Import Planner Tool Handlers
 */

import { checkSitemap, probePageLinks } from '../tool-handlers'

// Mock fetch globally
const mockFetch = jest.fn()
global.fetch = mockFetch

describe('checkSitemap', () => {
  beforeEach(() => {
    mockFetch.mockReset()
  })

  it('should return exists: true when sitemap is found', async () => {
    // Mock HEAD request
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
    })
    // Mock GET request
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: () =>
        Promise.resolve(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://example.com/</loc></url>
  <url><loc>https://example.com/about</loc></url>
  <url><loc>https://example.com/contact</loc></url>
</urlset>`),
    })

    const result = await checkSitemap('https://example.com')

    expect(result.exists).toBe(true)
    expect(result.url).toBe('https://example.com/sitemap.xml')
    expect(result.urlCount).toBe(3)
    expect(result.error).toBeUndefined()
  })

  it('should return exists: false when sitemap not found', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
    })

    const result = await checkSitemap('https://example.com')

    expect(result.exists).toBe(false)
    expect(result.url).toBe('https://example.com/sitemap.xml')
    expect(result.urlCount).toBeUndefined()
  })

  it('should handle sitemap index (no url count)', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
    })
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: () =>
        Promise.resolve(`<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap><loc>https://example.com/sitemap-pages.xml</loc></sitemap>
  <sitemap><loc>https://example.com/sitemap-posts.xml</loc></sitemap>
</sitemapindex>`),
    })

    const result = await checkSitemap('https://example.com/')

    expect(result.exists).toBe(true)
    expect(result.urlCount).toBeUndefined() // Index doesn't have direct URLs
  })

  it('should handle network errors gracefully', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'))

    const result = await checkSitemap('https://example.com')

    expect(result.exists).toBe(false)
    expect(result.error).toBe('Network error')
  })
})

describe('probePageLinks', () => {
  beforeEach(() => {
    mockFetch.mockReset()
  })

  it('should extract internal links from HTML', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: () =>
        Promise.resolve(`<html>
<body>
  <a href="https://example.com/about">About</a>
  <a href="https://example.com/contact">Contact</a>
  <a href="/courses">Courses</a>
  <a href="https://external.com/link">External</a>
</body>
</html>`),
    })

    const result = await probePageLinks('https://example.com')

    expect(result.url).toBe('https://example.com')
    expect(result.linkCount).toBe(4) // Total unique links
    expect(result.internalLinkCount).toBe(3) // Same domain
    expect(result.externalLinkCount).toBe(1) // Different domain
    expect(result.sampleLinks.length).toBeLessThanOrEqual(10)
    expect(result.error).toBeUndefined()
  })

  it('should skip javascript:, mailto:, tel: links', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: () =>
        Promise.resolve(`<html>
<body>
  <a href="javascript:void(0)">JS Link</a>
  <a href="mailto:test@example.com">Email</a>
  <a href="tel:+1234567890">Phone</a>
  <a href="https://example.com/page">Valid</a>
</body>
</html>`),
    })

    const result = await probePageLinks('https://example.com')

    expect(result.linkCount).toBe(1) // Only the valid HTTP link
    expect(result.internalLinkCount).toBe(1)
  })

  it('should handle HTTP errors', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
    })

    const result = await probePageLinks('https://example.com')

    expect(result.linkCount).toBe(0)
    expect(result.error).toBe('HTTP 500')
  })

  it('should handle network errors', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Connection refused'))

    const result = await probePageLinks('https://example.com')

    expect(result.linkCount).toBe(0)
    expect(result.error).toBe('Connection refused')
  })

  it('should deduplicate links', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: () =>
        Promise.resolve(`<html>
<body>
  <a href="https://example.com/about">About 1</a>
  <a href="https://example.com/about">About 2</a>
  <a href="https://example.com/about">About 3</a>
</body>
</html>`),
    })

    const result = await probePageLinks('https://example.com')

    expect(result.linkCount).toBe(1) // Deduplicated
    expect(result.internalLinkCount).toBe(1)
  })
})
