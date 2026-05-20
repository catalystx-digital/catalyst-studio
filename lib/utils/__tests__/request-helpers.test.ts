import { isAssetLikeRequest } from '../request-helpers';

describe('isAssetLikeRequest', () => {
  describe('returns true for asset-like paths', () => {
    it('returns true for _next paths', () => {
      expect(isAssetLikeRequest(['_next', 'static', 'chunk.js'])).toBe(true);
      expect(isAssetLikeRequest(['_next'])).toBe(true);
      expect(isAssetLikeRequest(['_Next', 'data'])).toBe(true); // case insensitive
    });

    it('returns true for favicon.ico', () => {
      expect(isAssetLikeRequest(['favicon.ico'])).toBe(true);
      expect(isAssetLikeRequest(['FAVICON.ICO'])).toBe(true); // case insensitive
    });

    it('returns true for favicon.png', () => {
      expect(isAssetLikeRequest(['favicon.png'])).toBe(true);
    });

    it('returns true for robots.txt', () => {
      expect(isAssetLikeRequest(['robots.txt'])).toBe(true);
    });

    it('returns true for sitemap files', () => {
      expect(isAssetLikeRequest(['sitemap.xml'])).toBe(true);
      expect(isAssetLikeRequest(['sitemap.txt'])).toBe(true);
    });

    it('returns true for static paths', () => {
      expect(isAssetLikeRequest(['static', 'images', 'logo.png'])).toBe(true);
      expect(isAssetLikeRequest(['static'])).toBe(true);
    });

    it('returns true for static file extensions', () => {
      expect(isAssetLikeRequest(['sandbox-template.tar.gz'])).toBe(true);
      expect(isAssetLikeRequest(['file.pdf'])).toBe(true);
      expect(isAssetLikeRequest(['data.json'])).toBe(true);
      expect(isAssetLikeRequest(['archive.zip'])).toBe(true);
      expect(isAssetLikeRequest(['image.png'])).toBe(true);
      expect(isAssetLikeRequest(['font.woff2'])).toBe(true);
    });
  });

  describe('returns false for regular page paths', () => {
    it('returns false for empty segments', () => {
      expect(isAssetLikeRequest([])).toBe(false);
    });

    it('returns false for regular page paths', () => {
      expect(isAssetLikeRequest(['blog', 'my-post'])).toBe(false);
      expect(isAssetLikeRequest(['about'])).toBe(false);
      expect(isAssetLikeRequest(['products', 'category', 'item'])).toBe(false);
    });

    it('returns false for paths that contain but do not start with special prefixes', () => {
      // _next in the middle is NOT an asset path (only when it's the first segment)
      expect(isAssetLikeRequest(['pages', '_next'])).toBe(false);
    });

    it('returns true for nested static file extensions', () => {
      // Files with static extensions anywhere in the path should be treated as assets
      expect(isAssetLikeRequest(['downloads', 'sitemap.xml'])).toBe(true);
      expect(isAssetLikeRequest(['assets', 'archive.tar.gz'])).toBe(true);
    });

    it('returns false for paths with empty first segment', () => {
      expect(isAssetLikeRequest(['', 'page'])).toBe(false);
    });
  });
});
