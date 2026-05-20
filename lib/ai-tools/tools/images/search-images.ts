/**
 * AI Tool for Searching Stock Images via Pexels API
 *
 * Allows the AI to fetch contextually relevant images based on:
 * - Topic/query (e.g., "wedding photography", "team portraits")
 * - Number of images needed
 * - Optional orientation preference
 *
 * Used during website bootstrap to get relevant images for components.
 */

import { tool } from 'ai';
import { z } from 'zod';

const PEXELS_API_URL = 'https://api.pexels.com/v1/search';

interface PexelsPhoto {
  id: number;
  width: number;
  height: number;
  url: string;
  photographer: string;
  photographer_url: string;
  photographer_id: number;
  avg_color: string;
  src: {
    original: string;
    large2x: string;
    large: string;
    medium: string;
    small: string;
    portrait: string;
    landscape: string;
    tiny: string;
  };
  liked: boolean;
  alt: string;
}

interface PexelsResponse {
  total_results: number;
  page: number;
  per_page: number;
  photos: PexelsPhoto[];
  next_page?: string;
}

/**
 * Fallback images when Pexels API is unavailable or returns no results
 */
const FALLBACK_IMAGES = [
  {
    src: 'https://images.pexels.com/photos/590016/pexels-photo-590016.jpeg?auto=compress&cs=tinysrgb&w=1600',
    alt: 'Professional workspace',
    width: 1600,
    height: 1067
  },
  {
    src: 'https://images.pexels.com/photos/3184636/pexels-photo-3184636.jpeg?auto=compress&cs=tinysrgb&w=1600',
    alt: 'Team collaboration',
    width: 1600,
    height: 1067
  },
  {
    src: 'https://images.pexels.com/photos/1181354/pexels-photo-1181354.jpeg?auto=compress&cs=tinysrgb&w=1200',
    alt: 'Creative work',
    width: 1200,
    height: 800
  },
  {
    src: 'https://images.pexels.com/photos/3184291/pexels-photo-3184291.jpeg?auto=compress&cs=tinysrgb&w=1200',
    alt: 'Business meeting',
    width: 1200,
    height: 800
  },
  {
    src: 'https://images.pexels.com/photos/3184312/pexels-photo-3184312.jpeg?auto=compress&cs=tinysrgb&w=800',
    alt: 'Office environment',
    width: 800,
    height: 533
  },
  {
    src: 'https://images.pexels.com/photos/3861963/pexels-photo-3861963.jpeg?auto=compress&cs=tinysrgb&w=800',
    alt: 'Professional setting',
    width: 800,
    height: 533
  },
  {
    src: 'https://images.pexels.com/photos/3184463/pexels-photo-3184463.jpeg?auto=compress&cs=tinysrgb&w=800',
    alt: 'Teamwork',
    width: 800,
    height: 533
  },
  {
    src: 'https://images.pexels.com/photos/6476584/pexels-photo-6476584.jpeg?auto=compress&cs=tinysrgb&w=1600',
    alt: 'Modern workspace',
    width: 1600,
    height: 1067
  }
];

/**
 * Search for stock images using the Pexels API
 */
export const searchImages = tool({
  description: 'Search for stock images based on a topic. Use this to get contextually relevant images for website components like heroes, galleries, about sections, etc.',
  inputSchema: z.object({
    query: z.string().min(1).describe('The search query describing what images you need (e.g., "wedding photography elegant", "professional headshot portrait", "modern office workspace")'),
    count: z.number().min(1).max(15).default(5).describe('Number of images to return (1-15). Use 1 for hero backgrounds, 3-6 for galleries, etc.'),
    orientation: z.enum(['landscape', 'portrait', 'square']).optional().describe('Preferred image orientation. Use landscape for heroes/banners, portrait for team photos, square for cards/thumbnails.'),
    size: z.enum(['small', 'medium', 'large']).default('large').describe('Image size. Use large for heroes, medium for galleries, small for thumbnails.')
  }),
  execute: async ({ query, count = 5, orientation, size = 'large' }) => {
    const startTime = Date.now();

    try {
      const apiKey = process.env.PEXELS_API_KEY;

      if (!apiKey) {
        console.warn('[searchImages] PEXELS_API_KEY not configured, using fallback images');
        return {
          success: true,
          images: FALLBACK_IMAGES.slice(0, count),
          source: 'fallback',
          message: 'Using fallback images (PEXELS_API_KEY not configured)',
          executionTime: `${Date.now() - startTime}ms`
        };
      }

      // Build query params
      const params = new URLSearchParams({
        query,
        per_page: String(Math.min(count * 2, 30)), // Fetch extra in case some don't match orientation
        page: '1'
      });

      if (orientation) {
        params.append('orientation', orientation);
      }

      const response = await fetch(`${PEXELS_API_URL}?${params.toString()}`, {
        headers: {
          'Authorization': apiKey
        }
      });

      if (!response.ok) {
        console.error('[searchImages] Pexels API error:', {
          status: response.status,
          statusText: response.statusText
        });

        // Return fallback on API error
        return {
          success: true,
          images: FALLBACK_IMAGES.slice(0, count),
          source: 'fallback',
          message: `Using fallback images (API error: ${response.status})`,
          executionTime: `${Date.now() - startTime}ms`
        };
      }

      const data: PexelsResponse = await response.json();

      if (!data.photos || data.photos.length === 0) {
        console.warn('[searchImages] No results for query:', query);
        return {
          success: true,
          images: FALLBACK_IMAGES.slice(0, count),
          source: 'fallback',
          message: `No images found for "${query}", using fallback images`,
          executionTime: `${Date.now() - startTime}ms`
        };
      }

      // Map size to Pexels src property
      const sizeMap: Record<string, keyof PexelsPhoto['src']> = {
        small: 'small',
        medium: 'medium',
        large: 'large'
      };
      const srcKey = sizeMap[size] || 'large';

      // Format the images
      const images = data.photos.slice(0, count).map(photo => ({
        src: photo.src[srcKey],
        alt: photo.alt || `${query} image`,
        width: photo.width,
        height: photo.height,
        photographer: photo.photographer,
        pexelsUrl: photo.url
      }));

      console.info('[searchImages] Successfully fetched images', {
        query,
        requested: count,
        returned: images.length,
        orientation,
        size
      });

      return {
        success: true,
        images,
        source: 'pexels',
        totalAvailable: data.total_results,
        executionTime: `${Date.now() - startTime}ms`
      };

    } catch (error) {
      console.error('[searchImages] Error fetching images:', error);

      // Return fallback on any error
      return {
        success: true,
        images: FALLBACK_IMAGES.slice(0, count),
        source: 'fallback',
        message: `Using fallback images (Error: ${error instanceof Error ? error.message : 'Unknown'})`,
        executionTime: `${Date.now() - startTime}ms`
      };
    }
  }
});
